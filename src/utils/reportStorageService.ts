/**
 * Report Storage Service
 * Handles persistent storage of medical reports in localStorage
 */

const REPORTS_KEY = 'clinic-medical-reports';

export interface StoredReport {
  id: string;
  patientId: string;
  patientName: string;
  doctorId?: string;
  doctorName?: string;
  fileName: string;
  fileSize: string;
  reportType: 'blood-test' | 'x-ray' | 'mri' | 'ct-scan' | 'ultrasound' | 'pathology' | 'cardiology' | 'other';
  dateUploaded: string;
  reportDate: string;
  status: 'uploaded' | 'analyzing' | 'analyzed' | 'reviewed';
  labName?: string;
  cost?: string;
  aiAnalysis?: any;
  doctorNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Get all reports from localStorage
 */
const getAllReports = (): StoredReport[] => {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(REPORTS_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

/**
 * Save all reports to localStorage
 */
const saveAllReports = (reports: StoredReport[]): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  
  // Dispatch custom event to notify components of the update (same-tab)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('medicalReportUpdated'));
  }
  
  // Note: Cross-tab synchronization is handled by the native 'storage' event
};

/**
 * Get reports for a specific patient
 */
export const getReportsForPatient = (patientId: string): StoredReport[] => {
  const allReports = getAllReports();
  return allReports.filter(r => r.patientId === patientId);
};

/**
 * Get a single report by ID
 */
export const getReportById = (reportId: string): StoredReport | null => {
  const allReports = getAllReports();
  return allReports.find(r => r.id === reportId) || null;
};

/**
 * Add a new report
 */
export const addReport = (report: StoredReport): StoredReport => {
  const allReports = getAllReports();
  const newReport = {
    ...report,
    createdAt: new Date().toISOString()
  };
  allReports.push(newReport);
  saveAllReports(allReports);
  return newReport;
};

/**
 * Update an existing report
 */
export const updateReport = (reportId: string, updates: Partial<StoredReport>): StoredReport | null => {
  const allReports = getAllReports();
  const index = allReports.findIndex(r => r.id === reportId);
  
  if (index === -1) return null;
  
  allReports[index] = {
    ...allReports[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  saveAllReports(allReports);
  return allReports[index];
};

/**
 * Delete a report
 */
export const deleteReport = (reportId: string): boolean => {
  const allReports = getAllReports();
  const filtered = allReports.filter(r => r.id !== reportId);
  
  if (filtered.length === allReports.length) return false;
  
  saveAllReports(filtered);
  return true;
};

/**
 * Get all reports (for doctors to see all patients' reports)
 */
export const getAllPatientReports = (): StoredReport[] => {
  return getAllReports();
};

/**
 * Initialize with demo reports if empty
 */
export const initializeDemoReports = (): void => {
  const existing = getAllReports();
  if (existing.length > 0) return;
  
  const demoReports: StoredReport[] = [
    {
      id: 'demo-report-1',
      patientId: 'demo-patient-1',
      patientName: 'Arjun Singh',
      fileName: 'blood_test_demo.pdf',
      fileSize: '2.3 MB',
      reportType: 'blood-test',
      dateUploaded: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      reportDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'analyzed',
      labName: 'SRL Diagnostics',
      cost: '₹1,250',
      aiAnalysis: {
        summary: 'Complete blood count shows normal values across all parameters. Hemoglobin and other markers are within healthy range.',
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
            value: '7.5',
            unit: '×10³/μL',
            normalRange: '4.0-10.0',
            status: 'normal',
            category: 'Blood'
          },
          {
            name: 'Platelets',
            value: '250',
            unit: '×10³/μL',
            normalRange: '150-400',
            status: 'normal',
            category: 'Blood'
          }
        ],
        riskFactors: [],
        recommendations: [
          'Continue current healthy lifestyle',
          'Regular exercise and balanced diet',
          'Next blood test in 6 months'
        ],
        analyzedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
      },
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];
  
  saveAllReports(demoReports);
};

/**
 * Clear all reports (for demo reset)
 */
export const clearAllReports = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REPORTS_KEY);
};
