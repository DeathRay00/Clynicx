const express = require('express');
const pdfParse = require('pdf-parse');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ── Gemini configuration ──────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL   = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ── Server-side rate-limit queue ─────────────────────────────────────────────
// Small gap between requests to avoid hitting rate limits.
const QUEUE_INTERVAL_MS = 2000;
// When a 429 is received we pause the queue for 65s.
const RATE_LIMIT_PAUSE_MS = 65000;

let lastCallAt = 0;
let rateLimitedUntil = 0;
const pendingQueue = [];

const drainQueue = () => {
  if (pendingQueue.length === 0) return;

  const now = Date.now();

  if (now < rateLimitedUntil) {
    const pauseLeft = rateLimitedUntil - now;
    console.log(`[analyze] Rate-limit pause active — waiting ${Math.ceil(pauseLeft / 1000)}s`);
    setTimeout(drainQueue, pauseLeft + 500);
    return;
  }

  const wait = Math.max(0, QUEUE_INTERVAL_MS - (now - lastCallAt));
  setTimeout(async () => {
    const { resolve, reject, fn } = pendingQueue.shift();
    lastCallAt = Date.now();
    try {
      resolve(await fn());
    } catch (e) {
      reject(e);
    }
    drainQueue();
  }, wait);
};

const enqueue = (fn) =>
  new Promise((resolve, reject) => {
    pendingQueue.push({ resolve, reject, fn });
    if (pendingQueue.length === 1) drainQueue();
  });

// ── PDF text extraction ───────────────────────────────────────────────────────
const extractPdfText = async (base64Data) => {
  const buffer = Buffer.from(base64Data, 'base64');
  const parsed = await pdfParse(buffer);
  return parsed.text || '';
};

// Reconstruct columnar lab PDFs where pdf-parse outputs data column-by-column.
// Heuristic: if a run of ≥4 lines are pure numbers, zip name/value/range columns.
const preprocessLabText = (rawText) => {
  const lines = rawText.split('\n').map(l => l.trimEnd()).filter(l => l.trim());

  const numberOnlyLine = /^\s*[\d.,\-<>]+\s*(%|g\/dL|mg\/dL|U\/L|mIU\/L|mmol\/L|IU\/L|pg\/mL|ng\/mL|µg\/dL|mEq\/L|fL|mm\/hr|cells\/µL|10\^3\/µL|10\^6\/µL|seconds?|ratio)?\s*$/i;
  const refRangeLine   = /^\s*[\d.,]+\s*[-–to]+\s*[\d.,]+\s*(%|g\/dL|mg\/dL|U\/L|mIU\/L|mmol\/L|IU\/L|pg\/mL|ng\/mL|µg\/dL|mEq\/L|fL|10\^3\/µL|10\^6\/µL)?\s*$/i;

  const annotated = lines.map(l => {
    const t = l.trim();
    if (refRangeLine.test(t))                            return { line: l, type: 'range' };
    if (numberOnlyLine.test(t))                          return { line: l, type: 'value' };
    if (/\d/.test(t) && /[a-zA-Z]{3,}/.test(t))         return { line: l, type: 'mixed' };
    return { line: l, type: 'name' };
  });

  let maxValueRun = 0, curRun = 0;
  for (const a of annotated) {
    curRun = a.type === 'value' ? curRun + 1 : 0;
    maxValueRun = Math.max(maxValueRun, curRun);
  }

  if (maxValueRun >= 4) {
    const nameLines  = annotated.filter(a => a.type === 'name').map(a => a.line.trim());
    const valueLines = annotated.filter(a => a.type === 'value').map(a => a.line.trim());
    const rangeLines = annotated.filter(a => a.type === 'range').map(a => a.line.trim());
    const mixedLines = annotated.filter(a => a.type === 'mixed').map(a => a.line.trim());

    const rebuilt = [];
    for (let i = 0; i < Math.max(nameLines.length, valueLines.length); i++) {
      const name = nameLines[i] || '', val = valueLines[i] || '', range = rangeLines[i] || '';
      if (name || val) rebuilt.push(`${name}\t${val}\t${range}`);
    }
    console.log('[analyze] Column-shift detected — text reconstructed into row format');
    return [...rebuilt, '', ...mixedLines].join('\n');
  }

  return lines.join('\n');
};

// ── Gemini prompt ─────────────────────────────────────────────────────────────
const GEMINI_PROMPT = `You are a medical AI assistant analyzing a medical report. Please analyze this medical report and provide:

1. A brief summary of the report
2. List all health parameters found with their values, units, and normal ranges
3. Identify any risk factors or abnormal values
4. Provide health recommendations based on the findings

Format your response as a JSON object with this exact structure:
{
  "summary": "Brief summary of the report",
  "reportType": "Type of report (e.g., Complete Blood Count, Lipid Profile, General Checkup)",
  "parameters": [
    {
      "name": "Parameter name",
      "value": "Measured value",
      "unit": "Unit of measurement",
      "normalRange": "Normal range",
      "status": "normal|low|high|critical",
      "category": "Category (Blood/Liver/Kidney/Lipid Profile/etc)"
    }
  ],
  "riskFactors": [
    {
      "severity": "low|medium|high|critical",
      "title": "Risk factor title",
      "description": "Detailed description",
      "recommendation": "What to do about it"
    }
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}

Important:
- Mark status as "low" if below normal range, "high" if above normal range, "critical" if dangerously out of range
- Provide specific, actionable recommendations
- Use Indian medical standards and units (e.g., mg/dL for glucose)
- Return only valid JSON, no markdown code blocks`;

// ── Helper: Repair Truncated JSON ─────────────────────────────────────────────
const repairTruncatedJSON = (jsonStr) => {
  let repaired = jsonStr.trim();
  
  // Remove trailing commas before closing braces/brackets (common in LLM output)
  repaired = repaired.replace(/,\s*([\]}])/g, '$1');

  // If it ends abruptly inside a string, quote, or key, we might be in trouble.
  // A simple heuristic: check balance of braces/brackets
  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;

  if (openBraces === closeBraces && openBrackets === closeBrackets) {
    return repaired; // Seems balanced
  }

  console.warn('[analyze] JSON appears truncated. Attempting repair...');
  
  // 1. If it ends with a comma, remove it
  repaired = repaired.replace(/,\s*$/, '');

  // 2. If inside a string value (odd number of quotes), close it
  const quoteCount = (repaired.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    repaired += '"';
  }

  // 3. Balance brackets/braces (simple stack approach is better, but counting works for simple cases)
  // We'll just append what's missing in a naive order: close arrays, then objects
  // This isn't perfect but handles the common case of "truncated at the very end"
  for (let i = 0; i < (openBrackets - closeBrackets); i++) repaired += ']';
  for (let i = 0; i < (openBraces - closeBraces); i++) repaired += '}';

  return repaired;
};

// ── Gemini AI call ────────────────────────────────────────────────────────────
// pdfText: extracted text (preferred — saves tokens).
// base64Data + mimeType: fallback for scanned/image PDFs with no extractable text.
const callAiModel = async ({ pdfText, base64Data, mimeType, fileName }) => {
  const useTextMode = Boolean(pdfText && pdfText.trim());
  console.log(`[analyze] Gemini (${GEMINI_MODEL}) — mode: ${useTextMode ? 'text' : 'inline'} — file: ${fileName || 'unknown'}`);

  // Build the content parts
  const parts = useTextMode
    ? [{ text: GEMINI_PROMPT + '\n\nREPORT TEXT:\n' + pdfText.slice(0, 12000) }]
    : [
        { text: GEMINI_PROMPT },
        { inline_data: { mime_type: mimeType || 'application/pdf', data: base64Data } }
      ];

  const body = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      // Disable thinking tokens for gemini-2.5-flash — they consume the token
      // budget silently and cause the JSON response to be truncated (MAX_TOKENS).
      thinkingConfig: { thinkingBudget: 0 }
    },
  };

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const errMsg  = errBody?.error?.message || response.statusText;
    const err = new Error(`Gemini API error: ${response.status} — ${errMsg}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const fullResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  console.log('[analyze] Gemini response length:', fullResponse ? fullResponse.length : 0);
  console.log('[analyze] Finish reason:', data?.candidates?.[0]?.finishReason);

  if (!fullResponse) {
    throw new Error(`Empty response from AI API`);
  }

  // Extract JSON — handle markdown code block or raw JSON
  let jsonStr = fullResponse.trim();
  
  const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlock) {
    jsonStr = codeBlock[1].trim();
  } else {
    // If no markdown, try to find the first '{' and the last '}'
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    
    if (firstBrace !== -1) {
       // If valid end brace found after start, take the substring
       if (lastBrace > firstBrace) {
         jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
       } else {
         // Truncated case: take from start brace to end of string
         jsonStr = jsonStr.substring(firstBrace);
       }
    }
  }

  let result;
  try {
    result = JSON.parse(jsonStr);
  } catch (parseErr) {
    // parsing failed, try repair
    try {
      const repaired = repairTruncatedJSON(jsonStr);
      result = JSON.parse(repaired);
      console.log('[analyze] JSON repaired successfully');
    } catch (repairErr) {
      console.error('[analyze] JSON parse failed. Raw text (first 300):', fullResponse.slice(0, 300));
      console.error('[analyze] JSON repair failed:', repairErr.message);
      // Fallback: Return a partial error object instead of crashing completely? 
      // Or simply throw for now.
      throw new Error('AI returned non-JSON response: ' + parseErr.message);
    }
  }
  return result;
};

// ── Mock Analysis Fallback ────────────────────────────────────────────────────
// Returns sample analysis data when AI is unavailable (rate limit, auth failure, etc.)
// Mirrors the getMockAnalysis logic from src12/utils/reportAnalysisService.ts
const getMockAnalysis = (fileName = '') => {
  const name = fileName.toLowerCase();
  const isBloodReport  = name.includes('blood') || name.includes('cbc');
  const isLipidReport  = name.includes('lipid') || name.includes('cholesterol');

  if (isBloodReport) {
    return {
      summary: 'Complete Blood Count (CBC) report shows mostly normal parameters with slight elevation in white blood cell count, which may indicate a mild infection or inflammation.',
      reportType: 'Complete Blood Count (CBC)',
      parameters: [
        { name: 'Hemoglobin',        value: '14.2', unit: 'g/dL',     normalRange: '13.0-17.0', status: 'normal', category: 'Blood' },
        { name: 'White Blood Cells', value: '11.5', unit: '×10³/μL',  normalRange: '4.0-10.0',  status: 'high',   category: 'Blood' },
        { name: 'Platelets',         value: '250',  unit: '×10³/μL',  normalRange: '150-400',   status: 'normal', category: 'Blood' },
        { name: 'Red Blood Cells',   value: '4.8',  unit: '×10⁶/μL', normalRange: '4.5-5.5',   status: 'normal', category: 'Blood' }
      ],
      riskFactors: [
        {
          severity: 'low',
          title: 'Elevated White Blood Cell Count',
          description: 'Your white blood cell count is slightly above the normal range at 11.5 ×10³/μL. This could indicate a mild infection, inflammation, or stress response.',
          recommendation: 'Monitor for symptoms like fever or fatigue. Consult your doctor if symptoms persist. Retest in 2-3 weeks if asymptomatic.'
        }
      ],
      recommendations: [
        'Stay well-hydrated and get adequate rest',
        'Monitor for any signs of infection (fever, pain, fatigue)',
        'Follow up with your doctor if WBC count remains elevated',
        'Maintain a balanced diet rich in vitamins and minerals'
      ]
    };
  }

  if (isLipidReport) {
    return {
      summary: 'Lipid profile shows elevated LDL cholesterol and total cholesterol levels, indicating increased cardiovascular risk. HDL cholesterol is within normal range.',
      reportType: 'Lipid Profile',
      parameters: [
        { name: 'Total Cholesterol', value: '220', unit: 'mg/dL', normalRange: '<200',  status: 'high',   category: 'Lipid Profile' },
        { name: 'LDL Cholesterol',   value: '145', unit: 'mg/dL', normalRange: '<100',  status: 'high',   category: 'Lipid Profile' },
        { name: 'HDL Cholesterol',   value: '48',  unit: 'mg/dL', normalRange: '>40',   status: 'normal', category: 'Lipid Profile' },
        { name: 'Triglycerides',     value: '165', unit: 'mg/dL', normalRange: '<150',  status: 'high',   category: 'Lipid Profile' }
      ],
      riskFactors: [
        {
          severity: 'medium',
          title: 'High LDL Cholesterol',
          description: 'Your LDL (bad) cholesterol is elevated at 145 mg/dL, which increases the risk of heart disease and stroke.',
          recommendation: 'Adopt a heart-healthy diet low in saturated fats, increase physical activity, and consider statin therapy if recommended by your doctor.'
        },
        {
          severity: 'medium',
          title: 'Elevated Triglycerides',
          description: 'Triglyceride levels are slightly above normal, which can contribute to atherosclerosis.',
          recommendation: 'Reduce sugar and refined carbohydrate intake, limit alcohol, and increase omega-3 fatty acids in your diet.'
        }
      ],
      recommendations: [
        'Follow a Mediterranean or DASH diet',
        'Exercise for at least 30 minutes, 5 days a week',
        'Limit saturated fats and trans fats',
        'Include more fiber-rich foods in your diet',
        'Consult a cardiologist for personalized treatment plan'
      ]
    };
  }

  // General health checkup (default)
  return {
    summary: 'General health checkup shows overall good health with some areas requiring attention. Blood sugar is slightly elevated, and vitamin D levels are low.',
    reportType: 'General Health Checkup',
    parameters: [
      { name: 'Fasting Blood Sugar', value: '108', unit: 'mg/dL',  normalRange: '70-100',  status: 'high',   category: 'Blood Sugar' },
      { name: 'Vitamin D',           value: '18',  unit: 'ng/mL',  normalRange: '30-100',  status: 'low',    category: 'Vitamins'   },
      { name: 'Hemoglobin',          value: '14.5',unit: 'g/dL',   normalRange: '13.0-17.0',status: 'normal', category: 'Blood'     },
      { name: 'Creatinine',          value: '0.9', unit: 'mg/dL',  normalRange: '0.6-1.2', status: 'normal', category: 'Kidney'     },
      { name: 'SGPT (ALT)',          value: '32',  unit: 'U/L',    normalRange: '7-56',     status: 'normal', category: 'Liver'      }
    ],
    riskFactors: [
      {
        severity: 'medium',
        title: 'Pre-Diabetic Blood Sugar Level',
        description: 'Fasting blood sugar at 108 mg/dL indicates pre-diabetes. This increases your risk of developing type 2 diabetes.',
        recommendation: 'Adopt lifestyle changes including regular exercise, weight management, and a low-glycemic diet. Monitor blood sugar regularly.'
      },
      {
        severity: 'low',
        title: 'Vitamin D Deficiency',
        description: 'Low vitamin D levels can affect bone health, immune function, and mood.',
        recommendation: 'Increase sun exposure (15-20 minutes daily), consume vitamin D-rich foods, or take supplements as prescribed.'
      }
    ],
    recommendations: [
      'Get 30-45 minutes of daily exercise',
      'Reduce refined sugar and carbohydrate intake',
      'Take Vitamin D supplements (1000-2000 IU daily)',
      'Get 15-20 minutes of sun exposure daily',
      'Retest blood sugar in 3 months',
      'Schedule follow-up with your doctor'
    ]
  };
};

// ── Extract Health Timeline Data ──────────────────────────────────────────────
// Mirrors extractHealthTimelineData from src12/utils/reportAnalysisService.ts
const extractHealthTimelineData = (analysis, reportId, reportDate) => {
  const trackableCategories = ['Blood', 'Blood Sugar', 'Lipid Profile', 'Kidney', 'Liver'];
  if (!Array.isArray(analysis.parameters)) return [];

  return analysis.parameters
    .filter(param => trackableCategories.includes(param.category))
    .map(param => ({
      id: `timeline-${reportId}-${param.name.toLowerCase().replace(/\s+/g, '-')}`,
      date: reportDate,
      type: 'lab_result',
      title: param.name,
      value: `${param.value} ${param.unit}`,
      normalRange: param.normalRange,
      status: param.status,
      category: param.category,
      reportId
    }));
};

// ── Wrapper: enqueue with automatic 429 pause ────────────────────────────────
const analyzeWithQueue = (payload) =>
  enqueue(async () => {
    try {
      return await callAiModel(payload);
    } catch (err) {
      if (err.status === 429 || err.message?.includes('429')) {
        rateLimitedUntil = Date.now() + RATE_LIMIT_PAUSE_MS;
        console.warn(`[analyze] Gemini 429 — pausing queue for ${RATE_LIMIT_PAUSE_MS / 1000}s`);
      }
      throw err;
    }
  });

// POST /analyze
router.post('/', requireAuth, async (req, res) => {
  const { fileData, mimeType, fileName } = req.body;

  if (!fileData) {
    return res.status(400).json({ error: 'fileData (base64) is required' });
  }

  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY missing - returning mock analysis');
    const mockResult = getMockAnalysis(fileName);
    return res.json({
      ...mockResult,
      analyzedAt: new Date().toISOString(),
      isMockAnalysis: true,
      errorMessage: 'AI service not configured. Showing sample analysis based on report type.'
    });
  }

  // ── Step 1: Extract text from PDF (saves Gemini tokens) ─────────────────
  const resolvedMimeType = mimeType || 'application/pdf';
  let pdfText = '';

  if (resolvedMimeType === 'application/pdf') {
    try {
      console.log(`[analyze] Extracting text from PDF: ${fileName || 'unknown'}`);
      const rawText = await extractPdfText(fileData);
      if (rawText.trim()) {
        pdfText = preprocessLabText(rawText);
        console.log(`[analyze] PDF text: ${rawText.length} raw chars → ${pdfText.length} preprocessed chars`);
      } else {
        console.log('[analyze] No text extracted (scanned PDF) — falling back to inline mode');
      }
    } catch (extractErr) {
      console.warn('[analyze] PDF text extraction failed:', extractErr.message, '— falling back to inline mode');
    }
  } else {
    // Images cannot have text extracted — check MIME type is supported for inline mode
    const supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!supportedImageTypes.includes(resolvedMimeType)) {
      return res.status(422).json({ error: `Unsupported file type: ${resolvedMimeType}. Supported: PDF, JPEG, PNG, WEBP.`, isMockAnalysis: true });
    }
  }

  // ── Step 2: Send to Gemini ────────────────────────────────────────────────
  // If text was extracted → send as text (cheap). Otherwise → send raw file (inline).
  const payload = { pdfText, base64Data: fileData, mimeType: resolvedMimeType, fileName };

  const queueLen = pendingQueue.length + 1;
  const estWaitSec = Math.ceil((queueLen * QUEUE_INTERVAL_MS) / 1000);
  console.log(`[analyze] Request queued for: ${fileName || 'unknown'} (queue depth: ${queueLen}, est. wait: ${estWaitSec}s)`);

  try {
    const analysis = await analyzeWithQueue(payload);
    return res.json({ ...analysis, analyzedAt: new Date().toISOString(), isMockAnalysis: false });
  } catch (err) {
    console.error('[analyze] Failed after retry:', err.message);

    // Rate limit — return mock analysis with retry info instead of a bare 429
    if (err.status === 429 || err.message?.includes('429')) {
      const waitSec = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
      const mockResult = getMockAnalysis(fileName);
      return res.json({
        ...mockResult,
        analyzedAt: new Date().toISOString(),
        isMockAnalysis: true,
        errorMessage: `AI quota reached. Showing sample analysis. Real AI analysis will be available in ~${waitSec > 0 ? waitSec : 65} seconds.`,
        retryAfter: waitSec > 0 ? waitSec : 65
      });
    }

    // Auth / config error
    if (err.status === 401 || err.status === 403 ||
        err.message?.includes('401') || err.message?.includes('403')) {
      const mockResult = getMockAnalysis(fileName);
      return res.json({
        ...mockResult,
        analyzedAt: new Date().toISOString(),
        isMockAnalysis: true,
        errorMessage: 'AI service authentication failed. Showing sample analysis. Please contact support.'
      });
    }

    // General failure — still return mock so the UI can display something useful
    console.warn('[analyze] Falling back to mock analysis after error:', err.message);
    const mockResult = getMockAnalysis(fileName);
    return res.json({
      ...mockResult,
      analyzedAt: new Date().toISOString(),
      isMockAnalysis: true,
      errorMessage: 'AI analysis failed. Showing sample analysis based on report type.'
    });
  }
});

// POST /analyze/extract-timeline
// Derives health timeline entries from a previously analysed report.
// Body: { analysis, reportId, reportDate }
router.post('/extract-timeline', requireAuth, (req, res) => {
  const { analysis, reportId, reportDate } = req.body;
  if (!analysis || !reportId || !reportDate) {
    return res.status(400).json({ error: 'analysis, reportId, and reportDate are required' });
  }
  const timelineEntries = extractHealthTimelineData(analysis, reportId, reportDate);
  return res.json({ timelineEntries });
});

module.exports = router;
