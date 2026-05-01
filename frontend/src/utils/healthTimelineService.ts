/**
 * Health Timeline Service
 * Manages health timeline data in localStorage
 */

const HEALTH_TIMELINE_KEY = 'clinic-health-timeline';

export interface HealthTimelineEntry {
  id: string;
  patientId: string;
  date: string;
  type: 'lab_result' | 'vital_sign' | 'diagnosis' | 'medication' | 'appointment';
  title: string;
  value?: string;
  normalRange?: string;
  status?: 'normal' | 'low' | 'high' | 'critical';
  category?: string;
  description?: string;
  reportId?: string;
  createdAt: string;
}

/**
 * Get all timeline entries from localStorage
 */
const getAllTimelineData = (): Record<string, HealthTimelineEntry[]> => {
  if (typeof window === 'undefined') return {};
  const data = localStorage.getItem(HEALTH_TIMELINE_KEY);
  if (!data) return {};
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
};

/**
 * Save all timeline data to localStorage
 */
const saveAllTimelineData = (data: Record<string, HealthTimelineEntry[]>): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HEALTH_TIMELINE_KEY, JSON.stringify(data));
};

/**
 * Get timeline entries for a specific patient
 */
export const getPatientTimeline = (patientId: string): HealthTimelineEntry[] => {
  const allData = getAllTimelineData();
  return allData[patientId] || [];
};

/**
 * Add timeline entry for a patient
 */
export const addTimelineEntry = (patientId: string, entry: Omit<HealthTimelineEntry, 'patientId' | 'createdAt'>): HealthTimelineEntry => {
  const allData = getAllTimelineData();
  
  const newEntry: HealthTimelineEntry = {
    ...entry,
    patientId,
    createdAt: new Date().toISOString()
  };
  
  if (!allData[patientId]) {
    allData[patientId] = [];
  }
  
  allData[patientId].push(newEntry);
  saveAllTimelineData(allData);
  
  return newEntry;
};

/**
 * Add multiple timeline entries for a patient
 */
export const addMultipleTimelineEntries = (patientId: string, entries: Omit<HealthTimelineEntry, 'patientId' | 'createdAt'>[]): HealthTimelineEntry[] => {
  const allData = getAllTimelineData();
  
  const newEntries: HealthTimelineEntry[] = entries.map(entry => ({
    ...entry,
    patientId,
    createdAt: new Date().toISOString()
  }));
  
  if (!allData[patientId]) {
    allData[patientId] = [];
  }
  
  allData[patientId].push(...newEntries);
  saveAllTimelineData(allData);
  
  return newEntries;
};

/**
 * Delete timeline entry
 */
export const deleteTimelineEntry = (patientId: string, entryId: string): boolean => {
  const allData = getAllTimelineData();
  
  if (!allData[patientId]) return false;
  
  const initialLength = allData[patientId].length;
  allData[patientId] = allData[patientId].filter(entry => entry.id !== entryId);
  
  if (allData[patientId].length === initialLength) return false;
  
  saveAllTimelineData(allData);
  return true;
};

/**
 * Delete all timeline entries associated with a report
 */
export const deleteTimelineEntriesByReport = (patientId: string, reportId: string): number => {
  const allData = getAllTimelineData();
  
  if (!allData[patientId]) return 0;
  
  const initialLength = allData[patientId].length;
  allData[patientId] = allData[patientId].filter(entry => entry.reportId !== reportId);
  
  const deletedCount = initialLength - allData[patientId].length;
  
  if (deletedCount > 0) {
    saveAllTimelineData(allData);
  }
  
  return deletedCount;
};

/**
 * Initialize demo timeline data
 */
export const initializeDemoTimeline = (patientId: string): void => {
  const existing = getPatientTimeline(patientId);
  if (existing.length > 0) return; // Already initialized
  
  const demoEntries: Omit<HealthTimelineEntry, 'patientId' | 'createdAt'>[] = [
    {
      id: 'demo-timeline-1',
      date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      type: 'lab_result',
      title: 'Blood Pressure',
      value: '120/80 mmHg',
      normalRange: '90-120/60-80',
      status: 'normal',
      category: 'Vital Signs'
    },
    {
      id: 'demo-timeline-2',
      date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      type: 'lab_result',
      title: 'Blood Sugar (Fasting)',
      value: '95 mg/dL',
      normalRange: '70-100 mg/dL',
      status: 'normal',
      category: 'Blood Sugar'
    },
    {
      id: 'demo-timeline-3',
      date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      type: 'diagnosis',
      title: 'Annual Physical Exam',
      description: 'Routine checkup - All parameters normal',
      category: 'General'
    }
  ];
  
  addMultipleTimelineEntries(patientId, demoEntries);
};
