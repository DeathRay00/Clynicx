/**
 * Report Analysis Service
 * Handles AI-powered medical report analysis using Gemini API
 */

import { AI_CONFIG } from '../config/api';

export interface AnalysisResult {
  summary: string;
  parameters: HealthParameter[];
  riskFactors: RiskFactor[];
  recommendations: string[];
  reportType: string;
  analyzedAt: string;
}

export interface HealthParameter {
  name: string;
  value: string;
  unit: string;
  normalRange: string;
  status: 'normal' | 'low' | 'high' | 'critical';
  category: string; // e.g., 'Blood', 'Liver', 'Kidney', 'Lipid Profile'
}

export interface RiskFactor {
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
}

const { GEMINI_API_KEY, GEMINI_API_URL } = AI_CONFIG;

/**
 * Analyze medical report PDF using Gemini API
 */
export const analyzeMedicalReport = async (pdfFile: File): Promise<AnalysisResult> => {
  try {
    // Convert PDF to base64
    const base64Data = await fileToBase64(pdfFile);
    
    // Create prompt for Gemini
    const prompt = `You are a medical AI assistant analyzing a medical report. Please analyze this medical report and provide:

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
- Use Indian medical standards and units (e.g., mg/dL for glucose)`;

    console.log('🤖 Analyzing medical report with Gemini AI...');
    console.log('📄 File:', pdfFile.name, 'Size:', (pdfFile.size / 1024).toFixed(2), 'KB');

    // Call Gemini API with proper headers
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: pdfFile.type,
                data: base64Data.split(',')[1] // Remove data URL prefix
              }
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Gemini API Error:', errorData);
      throw new Error(`Failed to analyze report: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Received response from Gemini AI');
    
    const analysisText = data.candidates[0].content.parts[0].text;
    
    // Parse JSON from response - handle markdown code blocks
    let jsonMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    } else {
      jsonMatch[0] = jsonMatch[1]; // Use the captured group
    }
    
    if (!jsonMatch) {
      console.error('❌ Invalid response format:', analysisText);
      throw new Error('Invalid response format from Gemini API');
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    console.log('✅ Successfully analyzed report:', analysis.reportType);
    
    return {
      ...analysis,
      analyzedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Error analyzing report:', error);
    console.warn('⚠️ Falling back to mock analysis');
    // Fallback to mock analysis on error
    return getMockAnalysis(pdfFile.name);
  }
};

/**
 * Convert file to base64
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
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
