/**
 * Report Analysis Service
 * Proxies medical report analysis through the backend (Node.js/Express).
 * The Mistral API key lives ONLY on the server — never in the browser.
 */

import { API_BASE_URL, getAuthHeaders } from '../config/api';
import { getToken } from './supabase/client';

export interface AnalysisResult {
  summary: string;
  parameters: HealthParameter[];
  riskFactors: RiskFactor[];
  recommendations: string[];
  reportType: string;
  analyzedAt: string;
  isMockAnalysis?: boolean;
  errorMessage?: string;
}

export interface HealthParameter {
  name: string;
  value: string;
  unit: string;
  normalRange: string;
  status: 'normal' | 'low' | 'high' | 'critical';
  category: string;
}

export interface RiskFactor {
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
}

// Local UI cooldown — only set when the *server* itself returns 429
// (meaning Mistral is exhausted even after server-side retries)
const RATE_LIMIT_KEY = 'mistral-rate-limit-cooldown';
const COOLDOWN_DURATION = 2 * 60 * 1000; // 2 minutes

const isInCooldown = (): boolean => {
  if (typeof window === 'undefined') return false;
  const val = localStorage.getItem(RATE_LIMIT_KEY);
  if (!val) return false;
  if (Date.now() < parseInt(val, 10)) return true;
  localStorage.removeItem(RATE_LIMIT_KEY);
  return false;
};

const setCooldown = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RATE_LIMIT_KEY, (Date.now() + COOLDOWN_DURATION).toString());
};

/** Clear the local rate-limit cooldown (used by the Retry AI button) */
export const clearRateLimitCooldown = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(RATE_LIMIT_KEY);
  console.log('✅ Rate-limit cooldown cleared');
};

/**
 * Convert a File to a base64 string (without the data-URL prefix).
 */
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // strip "data:...;base64,"
    };
    reader.onerror = reject;
  });

/**
 * Analyze a medical report PDF.
 * Sends the file to the backend, which calls Mistral with a server-side queue
 * and built-in retry logic — so the API key is never exposed in the browser.
 */
export const analyzeMedicalReport = async (pdfFile: File): Promise<AnalysisResult> => {
  // Respect local cooldown only when the server itself was rate-limited
  if (isInCooldown()) {
    console.warn('⏳ Server-side AI in cooldown. Using sample analysis.');
    return {
      ...getMockAnalysis(pdfFile.name),
      isMockAnalysis: true,
      errorMessage: 'AI service is temporarily busy. Showing sample analysis. Please retry in a moment.'
    };
  }

  const token = getToken();
  if (!token) {
    // Not logged in — fall back to mock
    return {
      ...getMockAnalysis(pdfFile.name),
      isMockAnalysis: true,
      errorMessage: 'Please log in to use real AI analysis.'
    };
  }

  try {
    console.log('🤖 Sending report to backend for Mistral analysis:', pdfFile.name);
    const base64Data = await fileToBase64(pdfFile);

    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({
        fileData: base64Data,
        mimeType: pdfFile.type || 'application/pdf',
        fileName: pdfFile.name,
      }),
    });

    if (response.status === 429) {
      setCooldown();
      console.warn('⏳ Backend returned 429 — Mistral quota exhausted after retries.');
      const body = await response.json().catch(() => ({}));
      const waitSec = body.retryAfter || 65;
      return {
        ...getMockAnalysis(pdfFile.name),
        isMockAnalysis: true,
        errorMessage: `AI quota reached. Showing sample analysis. Please retry in ~${waitSec} seconds.`
      };
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Backend error ${response.status}`);
    }

    const analysis: AnalysisResult = await response.json();
    console.log('✅ AI analysis received from backend:', analysis.reportType);
    return { ...analysis, isMockAnalysis: false };

  } catch (error: any) {
    console.error('💡 Analysis failed — using sample fallback:', error.message);
    return {
      ...getMockAnalysis(pdfFile.name),
      isMockAnalysis: true,
      errorMessage: 'AI analysis failed. Showing sample analysis based on report type.'
    };
  }
};

/**
 * Mock analysis for demo/development purposes
 */
const getMockAnalysis = (fileName: string): AnalysisResult => {
  // Simulate analysis based on common report types
  const isBloodReport = fileName.toLowerCase().includes('blood') || fileName.toLowerCase().includes('cbc');
  const isLipidReport = fileName.toLowerCase().includes('lipid') || fileName.toLowerCase().includes('cholesterol');
  
  if (isBloodReport) {
    return {
      summary: 'Complete Blood Count (CBC) report shows mostly normal parameters with slight elevation in white blood cell count, which may indicate a mild infection or inflammation.',
      reportType: 'Complete Blood Count (CBC)',
      parameters: [
        {
          name: 'Hemoglobin',
          value: '14.2',
          unit: 'g/dL',
          normalRange: '13.0-17.0',
          status: 'normal',
          category: 'Blood'
        },
        {
          name: 'White Blood Cells',
          value: '11.5',
          unit: '×10³/μL',
          normalRange: '4.0-10.0',
          status: 'high',
          category: 'Blood'
        },
        {
          name: 'Platelets',
          value: '250',
          unit: '×10³/μL',
          normalRange: '150-400',
          status: 'normal',
          category: 'Blood'
        },
        {
          name: 'Red Blood Cells',
          value: '4.8',
          unit: '×10⁶/μL',
          normalRange: '4.5-5.5',
          status: 'normal',
          category: 'Blood'
        }
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
      ],
      analyzedAt: new Date().toISOString()
    };
  } else if (isLipidReport) {
    return {
      summary: 'Lipid profile shows elevated LDL cholesterol and total cholesterol levels, indicating increased cardiovascular risk. HDL cholesterol is within normal range.',
      reportType: 'Lipid Profile',
      parameters: [
        {
          name: 'Total Cholesterol',
          value: '220',
          unit: 'mg/dL',
          normalRange: '<200',
          status: 'high',
          category: 'Lipid Profile'
        },
        {
          name: 'LDL Cholesterol',
          value: '145',
          unit: 'mg/dL',
          normalRange: '<100',
          status: 'high',
          category: 'Lipid Profile'
        },
        {
          name: 'HDL Cholesterol',
          value: '48',
          unit: 'mg/dL',
          normalRange: '>40',
          status: 'normal',
          category: 'Lipid Profile'
        },
        {
          name: 'Triglycerides',
          value: '165',
          unit: 'mg/dL',
          normalRange: '<150',
          status: 'high',
          category: 'Lipid Profile'
        }
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
      ],
      analyzedAt: new Date().toISOString()
    };
  } else {
    // General checkup
    return {
      summary: 'General health checkup shows overall good health with some areas requiring attention. Blood sugar is slightly elevated, and vitamin D levels are low.',
      reportType: 'General Health Checkup',
      parameters: [
        {
          name: 'Fasting Blood Sugar',
          value: '108',
          unit: 'mg/dL',
          normalRange: '70-100',
          status: 'high',
          category: 'Blood Sugar'
        },
        {
          name: 'Vitamin D',
          value: '18',
          unit: 'ng/mL',
          normalRange: '30-100',
          status: 'low',
          category: 'Vitamins'
        },
        {
          name: 'Hemoglobin',
          value: '14.5',
          unit: 'g/dL',
          normalRange: '13.0-17.0',
          status: 'normal',
          category: 'Blood'
        },
        {
          name: 'Creatinine',
          value: '0.9',
          unit: 'mg/dL',
          normalRange: '0.6-1.2',
          status: 'normal',
          category: 'Kidney'
        },
        {
          name: 'SGPT (ALT)',
          value: '32',
          unit: 'U/L',
          normalRange: '7-56',
          status: 'normal',
          category: 'Liver'
        }
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
      ],
      analyzedAt: new Date().toISOString()
    };
  }
};

/**
 * Extract health timeline data from analysis
 */
export const extractHealthTimelineData = (analysis: AnalysisResult, reportId: string, reportDate: string) => {
  // Only extract parameters that are commonly tracked in health timelines
  const trackableCategories = ['Blood', 'Blood Sugar', 'Lipid Profile', 'Kidney', 'Liver'];
  
  return analysis.parameters
    .filter(param => trackableCategories.includes(param.category))
    .map(param => ({
      id: `timeline-${reportId}-${param.name.toLowerCase().replace(/\s/g, '-')}`,
      date: reportDate,
      type: 'lab_result' as const,
      title: param.name,
      value: `${param.value} ${param.unit}`,
      normalRange: param.normalRange,
      status: param.status,
      category: param.category,
      reportId: reportId
    }));
};
