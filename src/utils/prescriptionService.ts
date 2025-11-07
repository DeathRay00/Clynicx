/**
 * Prescription Service
 * Handles prescription operations for both demo mode and real API
 */

const PRESCRIPTIONS_KEY = 'clinic-prescriptions';

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail?: string;
  doctorId: string;
  doctorName: string;
  diagnosis: string;
  medicines: any[];
  labTests?: string;
  instructions?: string;
  followUpDate?: string | null;
  prescribedDate: string;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt?: string;
}

// Get all prescriptions from localStorage
const getAllPrescriptions = (): Prescription[] => {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(PRESCRIPTIONS_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

// Save all prescriptions to localStorage
const saveAllPrescriptions = (prescriptions: Prescription[]): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PRESCRIPTIONS_KEY, JSON.stringify(prescriptions));
  
  // Dispatch custom event to notify components of the update
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('prescriptionUpdated'));
  }
};

// Get prescriptions for a specific patient
export const getPrescriptionsForPatient = (patientId: string): Prescription[] => {
  const allPrescriptions = getAllPrescriptions();
  return allPrescriptions.filter(p => p.patientId === patientId);
};

// Get prescriptions created by a specific doctor
export const getPrescriptionsForDoctor = (doctorId: string): Prescription[] => {
  const allPrescriptions = getAllPrescriptions();
  return allPrescriptions.filter(p => p.doctorId === doctorId);
};

// Add a new prescription
export const addPrescription = (prescription: Prescription): Prescription => {
  const allPrescriptions = getAllPrescriptions();
  allPrescriptions.push(prescription);
  saveAllPrescriptions(allPrescriptions);
  return prescription;
};

// Update an existing prescription
export const updatePrescription = (prescriptionId: string, updates: Partial<Prescription>): Prescription | null => {
  const allPrescriptions = getAllPrescriptions();
  const index = allPrescriptions.findIndex(p => p.id === prescriptionId);
  
  if (index === -1) return null;
  
  allPrescriptions[index] = {
    ...allPrescriptions[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  saveAllPrescriptions(allPrescriptions);
  return allPrescriptions[index];
};

// Delete a prescription
export const deletePrescription = (prescriptionId: string): boolean => {
  const allPrescriptions = getAllPrescriptions();
  const filtered = allPrescriptions.filter(p => p.id !== prescriptionId);
  
  if (filtered.length === allPrescriptions.length) return false; // Not found
  
  saveAllPrescriptions(filtered);
  return true;
};

// Get a single prescription by ID
export const getPrescriptionById = (prescriptionId: string): Prescription | null => {
  const allPrescriptions = getAllPrescriptions();
  return allPrescriptions.find(p => p.id === prescriptionId) || null;
};

// Clear all prescriptions (for demo reset)
export const clearAllPrescriptions = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PRESCRIPTIONS_KEY);
};

// Initialize with demo prescriptions if empty
export const initializeDemoPrescriptions = (): void => {
  const existing = getAllPrescriptions();
  if (existing.length > 0) return; // Already initialized
  
  const demoPrescriptions: Prescription[] = [
    {
      id: 'demo-presc-1',
      patientId: 'demo-patient-1',
      patientName: 'Arjun Singh',
      patientEmail: 'arjun.singh@email.com',
      doctorId: 'demo-doctor-1',
      doctorName: 'Dr. Demo Doctor',
      diagnosis: 'Seasonal Allergies',
      medicines: [
        {
          name: 'Cetirizine',
          dosage: '10mg',
          frequency: {
            breakfast: { before: false, after: false },
            lunch: { before: false, after: false },
            dinner: { before: false, after: true }
          },
          duration: '7 days',
          refills: 0
        }
      ],
      labTests: '',
      instructions: 'Avoid exposure to allergens',
      followUpDate: null,
      prescribedDate: new Date().toISOString(),
      status: 'active',
      createdAt: new Date().toISOString()
    }
  ];
  
  saveAllPrescriptions(demoPrescriptions);
};
