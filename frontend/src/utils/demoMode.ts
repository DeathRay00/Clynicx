/**
 * Demo Mode Utilities
 * Provides offline functionality when backend is unavailable
 */

export interface DemoUser {
  id: string;
  email: string;
  role: 'patient' | 'doctor';
  fullName: string;
  phone?: string;
}

const DEMO_MODE_KEY = 'clinic-demo-mode';
const DEMO_USER_KEY = 'clinic-demo-user';
const DEMO_DATA_KEY = 'clinic-demo-data';

// Check if demo mode is active
export const isDemoMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DEMO_MODE_KEY) === 'true';
};

// Enable demo mode
export const enableDemoMode = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEMO_MODE_KEY, 'true');
  console.log('📱 Demo mode enabled');
};

// Disable demo mode
export const disableDemoMode = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEMO_MODE_KEY);
  localStorage.removeItem(DEMO_USER_KEY);
  localStorage.removeItem(DEMO_DATA_KEY);
  console.log('📱 Demo mode disabled');
};

// Get current demo user
export const getDemoUser = (): DemoUser | null => {
  if (typeof window === 'undefined') return null;
  const userJson = localStorage.getItem(DEMO_USER_KEY);
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
};

// Set demo user
export const setDemoUser = (user: DemoUser | null): void => {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(DEMO_USER_KEY);
  }
};

// Clear demo user
export const clearDemoUser = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEMO_USER_KEY);
};

// Demo login
export const demoLogin = async (email: string, password: string): Promise<{ success: boolean; user?: DemoUser; error?: string }> => {
  // Predefined demo accounts
  const demoAccounts = {
    'patient@demo.com': {
      id: 'demo-patient-1',
      email: 'patient@demo.com',
      role: 'patient' as const,
      fullName: 'Demo Patient',
      phone: '+91 98765 43210'
    },
    'doctor@demo.com': {
      id: 'demo-doctor-1',
      email: 'doctor@demo.com',
      role: 'doctor' as const,
      fullName: 'Dr. Demo Doctor',
      phone: '+91 98765 54321'
    },
    // Additional patient demo accounts matching the sample patients
    'arjun.singh@email.com': {
      id: 'demo-patient-1',
      email: 'arjun.singh@email.com',
      role: 'patient' as const,
      fullName: 'Arjun Singh',
      phone: '+91 98765 11111'
    },
    'rahul@example.com': {
      id: 'demo-patient-1',
      email: 'rahul@example.com',
      role: 'patient' as const,
      fullName: 'Rahul Verma',
      phone: '+91 98765 11111'
    },
    'priya@example.com': {
      id: 'demo-patient-2',
      email: 'priya@example.com',
      role: 'patient' as const,
      fullName: 'Priya Singh',
      phone: '+91 98765 22222'
    }
  };

  // Check password (accept both demo123 and password123 for convenience)
  const validPassword = password === 'demo123' || password === 'password123';
  if (!validPassword) {
    // Try to get from localStorage for custom accounts
    const allData = getDemoData();
    const userAccount = Object.values(allData).find((data: any) => 
      data.user?.email === email && data.user?.password === password
    );
    
    if (userAccount) {
      const user = (userAccount as any).user;
      delete user.password; // Don't return password
      enableDemoMode();
      setDemoUser(user);
      initDemoData(user.id, user.role);
      return { success: true, user };
    }
    
    return { success: false, error: 'Invalid credentials' };
  }

  // Check if account exists
  const account = demoAccounts[email as keyof typeof demoAccounts];
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  enableDemoMode();
  setDemoUser(account);
  initDemoData(account.id, account.role);
  
  return { success: true, user: account };
};

// Demo signup
export const demoSignup = async (userData: any): Promise<{ success: boolean; user?: DemoUser; error?: string }> => {
  const userId = `demo-user-${Date.now()}`;
  const user: DemoUser = {
    id: userId,
    email: userData.email,
    role: userData.role,
    fullName: userData.fullName,
    phone: userData.phone,
  };

  enableDemoMode();
  setDemoUser(user);
  
  // Store user with password for future logins
  const allData = getDemoData();
  allData[userId] = {
    user: { ...user, password: userData.password },
    appointments: [],
    prescriptions: [],
    reports: [],
    patients: []
  };
  saveDemoData(allData);
  
  initDemoData(userId, userData.role);

  return { success: true, user };
};

// Get demo data
const getDemoData = (): any => {
  if (typeof window === 'undefined') return {};
  const dataJson = localStorage.getItem(DEMO_DATA_KEY);
  if (!dataJson) return {};
  try {
    return JSON.parse(dataJson);
  } catch {
    return {};
  }
};

// Save demo data
const saveDemoData = (data: any): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEMO_DATA_KEY, JSON.stringify(data));
};

// Initialize demo data for a user
export const initDemoData = (userId: string, role: 'patient' | 'doctor'): void => {
  const allData = getDemoData();
  
  if (!allData[userId]) {
    allData[userId] = {
      appointments: role === 'patient' ? getSamplePatientAppointments(userId) : getSampleDoctorAppointments(userId),
      prescriptions: role === 'patient' ? getSamplePrescriptions(userId) : [],
      reports: role === 'patient' ? getSampleReports(userId) : [],
      patients: role === 'doctor' ? getSamplePatients(userId) : []
    };
    saveDemoData(allData);
  }
};

// Sample data generators
const getSamplePatientAppointments = (userId: string) => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  return [
    {
      id: 'demo-apt-1',
      patientId: userId,
      patientName: 'Demo Patient',
      patientEmail: 'patient@demo.com',
      patientPhone: '+91 98765 43210',
      doctorId: 'demo-dr-1',
      doctorName: 'Dr. Priya Sharma',
      doctorSpecialization: 'Cardiologist',
      hospitalName: 'Apollo Hospital, Mumbai',
      appointmentDate: tomorrow.toISOString().split('T')[0],
      appointmentTime: '10:00',
      appointmentType: 'in-person',
      reasonForVisit: 'Regular checkup',
      status: 'confirmed',
      consultationFee: 800,
      bookedAt: new Date().toISOString(),
      notes: ''
    },
    {
      id: 'demo-apt-2',
      patientId: userId,
      patientName: 'Demo Patient',
      patientEmail: 'patient@demo.com',
      patientPhone: '+91 98765 43210',
      doctorId: 'demo-dr-2',
      doctorName: 'Dr. Rajesh Kumar',
      doctorSpecialization: 'General Physician',
      hospitalName: 'Fortis Hospital, Delhi',
      appointmentDate: nextWeek.toISOString().split('T')[0],
      appointmentTime: '14:00',
      appointmentType: 'telemedicine',
      reasonForVisit: 'Follow-up consultation',
      status: 'pending',
      consultationFee: 500,
      bookedAt: new Date().toISOString(),
      notes: ''
    }
  ];
};

const getSampleDoctorAppointments = (userId: string) => {
  const today = new Date();
  return [
    {
      id: 'demo-dr-apt-1',
      patientId: 'demo-patient-1',
      patientName: 'Arjun Singh',
      patientEmail: 'arjun.singh@email.com',
      patientPhone: '+91 98765 11111',
      doctorId: userId,
      doctorName: 'Dr. Demo Doctor',
      doctorSpecialization: 'General Physician',
      hospitalName: 'City Hospital',
      appointmentDate: today.toISOString().split('T')[0],
      appointmentTime: '11:00',
      appointmentType: 'in-person',
      reasonForVisit: 'Fever and cough',
      status: 'confirmed',
      consultationFee: 500,
      bookedAt: new Date().toISOString(),
      notes: ''
    }
  ];
};

const getSamplePrescriptions = (userId: string) => {
  return [
    {
      id: 'demo-presc-1',
      patientId: userId,
      doctorId: 'demo-dr-1',
      doctorName: 'Dr. Priya Sharma',
      prescribedDate: new Date().toISOString(),
      diagnosis: 'Hypertension',
      medicines: [
        {
          name: 'Amlodipine',
          dosage: '5mg',
          frequency: '1x daily',
          duration: '30 days',
          timing: 'After breakfast',
          instructions: 'Take with water'
        }
      ],
      labTests: ['Blood Pressure Monitoring', 'ECG'],
      instructions: 'Monitor blood pressure daily',
      followUpDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'active'
    }
  ];
};

const getSampleReports = (userId: string) => {
  return [
    {
      id: 'demo-report-1',
      patientId: userId,
      reportType: 'Blood Test',
      reportName: 'Complete Blood Count',
      uploadDate: new Date().toISOString(),
      fileUrl: '',
      notes: 'All values within normal range'
    }
  ];
};

const getSamplePatients = (userId: string) => {
  return [
    {
      id: 'demo-patient-1',
      fullName: 'Arjun Singh',
      email: 'arjun.singh@email.com',
      phone: '+91 98765 11111',
      dateOfBirth: '1990-05-15',
      gender: 'male',
      bloodGroup: 'O+',
      role: 'patient',
      lastVisit: new Date().toISOString().split('T')[0],
      totalAppointments: 5,
      totalPrescriptions: 3,
      totalReports: 4,
      createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString() // 180 days ago
    },
    {
      id: 'demo-patient-2',
      fullName: 'Priya Singh',
      email: 'priya@example.com',
      phone: '+91 98765 22222',
      dateOfBirth: '1985-08-22',
      gender: 'female',
      bloodGroup: 'A+',
      role: 'patient',
      lastVisit: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
      totalAppointments: 3,
      totalPrescriptions: 2,
      totalReports: 2,
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days ago
    }
  ];
};

// Sample doctors list - Returns empty array, only registered doctors will appear
export const getSampleDoctors = () => {
  // No mock doctors - only dynamically registered doctors from the database will appear
  return [];
};

// Demo fetch functions
export const demoFetch = {
  getProfile: async (userId: string): Promise<DemoUser | null> => {
    return getDemoUser();
  },

  getAppointments: async (userId: string): Promise<any[]> => {
    const allData = getDemoData();
    const userData = allData[userId];
    if (!userData) {
      initDemoData(userId, getDemoUser()?.role || 'patient');
      return getDemoData()[userId]?.appointments || [];
    }
    return userData.appointments || [];
  },

  getPrescriptions: async (userId: string): Promise<any[]> => {
    const allData = getDemoData();
    const userData = allData[userId];
    return userData?.prescriptions || [];
  },

  getReports: async (userId: string): Promise<any[]> => {
    const allData = getDemoData();
    const userData = allData[userId];
    return userData?.reports || [];
  },

  getPatients: async (userId: string): Promise<any[]> => {
    const allData = getDemoData();
    const userData = allData[userId];
    return userData?.patients || [];
  },

  getDoctors: async (): Promise<any[]> => {
    return getSampleDoctors();
  },

  bookAppointment: async (userId: string, appointmentData: any): Promise<any> => {
    const allData = getDemoData();
    if (!allData[userId]) {
      initDemoData(userId, 'patient');
    }

    const appointment = {
      id: `demo-apt-${Date.now()}`,
      patientId: userId,
      ...appointmentData,
      bookedAt: new Date().toISOString(),
      status: 'pending'
    };

    allData[userId].appointments.push(appointment);
    saveDemoData(allData);

    return { success: true, appointment };
  }
};
