import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Authentication middleware
const requireAuth = async (c: any, next: any) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  if (!accessToken) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (!user || error) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('user', user);
  c.set('accessToken', accessToken);
  await next();
};

// Health check endpoint
app.get("/make-server-53ddc61c/health", (c) => {
  return c.json({ status: "ok" });
});

// Create test patient account
app.post("/make-server-53ddc61c/create-test-patient", async (c) => {
  try {
    // Create test patient in Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'patient@test.com',
      password: 'password123',
      user_metadata: { 
        full_name: 'Arjun Sharma',
        role: 'patient',
      },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error && !error.message.includes('already registered')) {
      console.error('Supabase auth error:', error);
      return c.json({ error: error.message }, 400);
    }

    let userId = data?.user?.id;
    
    // If user already exists, get their ID
    if (error?.message.includes('already registered')) {
      // Try to get existing user by email
      const existingUsers = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers.data?.users?.find(u => u.email === 'patient@test.com');
      if (existingUser) {
        userId = existingUser.id;
      }
    }

    if (!userId) {
      return c.json({ error: 'Failed to create or find test user' }, 400);
    }

    // Store user profile in KV store
    const userProfile = {
      id: userId,
      email: 'patient@test.com',
      fullName: 'Arjun Sharma',
      phone: '+91 98765 43210',
      role: 'patient',
      dateOfBirth: '1985-06-15',
      gender: 'male',
      bloodGroup: 'O+',
      createdAt: new Date().toISOString(),
    };

    await kv.set(`user:${userId}`, userProfile);
    await kv.set(`user_email:patient@test.com`, userId);

    return c.json({ 
      success: true, 
      message: 'Test patient account created/verified',
      userId: userId 
    });
  } catch (error) {
    console.error('Test patient creation error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Initialize doctors data - NO LONGER CREATES MOCK DOCTORS
// Only dynamically registered doctors from signup will appear
app.post("/make-server-53ddc61c/init-doctors", async (c) => {
  try {
    // No mock doctors - return success without initializing any data
    return c.json({ 
      success: true, 
      message: 'No mock doctors to initialize. Only registered doctors will appear.',
      count: 0 
    });
  } catch (error) {
    console.error('Error in init-doctors:', error);
    return c.json({ error: 'Failed to process request' }, 500);
  }
});

// Get all doctors
app.get("/make-server-53ddc61c/doctors", async (c) => {
  try {
    // Get all users and filter for doctors
    const allUsers = await kv.getByPrefix('user:');
    const doctors = [];
    
    for (const user of allUsers) {
      if (user.role === 'doctor') {
        // Check if doctor has a full profile, otherwise create basic profile
        const doctorProfile = await kv.get(`doctor:${user.id}`);
        
        if (doctorProfile) {
          // Use existing full doctor profile
          doctors.push(doctorProfile);
        } else {
          // Create basic profile from user data for newly registered doctors
          const basicDoctorProfile = {
            id: user.id,
            email: user.email,
            name: user.fullName,
            specialization: user.specialization || 'General Physician',
            experience: user.experience || 'New Doctor',
            rating: user.rating || 4.5,
            consultationFee: user.consultationFee || 500,
            hospital: user.hospital || 'Available for Consultation',
            phone: user.phone || '',
            qualifications: user.qualifications || user.medicalLicenseNumber || 'MBBS',
            availableSlots: user.availableSlots || ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
            availableDays: user.availableDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            createdAt: user.createdAt,
            isActive: true
          };
          doctors.push(basicDoctorProfile);
        }
      }
    }
    
    // Sort by rating (highest first)
    doctors.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    return c.json({ doctors });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    return c.json({ error: 'Failed to fetch doctors' }, 500);
  }
});

// Get doctor by ID
app.get("/make-server-53ddc61c/doctors/:id", async (c) => {
  try {
    const doctorId = c.req.param('id');
    
    // Try to get full doctor profile first
    let doctor = await kv.get(`doctor:${doctorId}`);
    
    if (!doctor) {
      // If no full profile, get from user profile
      const user = await kv.get(`user:${doctorId}`);
      
      if (!user || user.role !== 'doctor') {
        return c.json({ error: 'Doctor not found' }, 404);
      }
      
      // Create basic doctor profile from user data
      doctor = {
        id: user.id,
        email: user.email,
        name: user.fullName,
        specialization: user.specialization || 'General Physician',
        experience: user.experience || 'New Doctor',
        rating: user.rating || 4.5,
        consultationFee: user.consultationFee || 500,
        hospital: user.hospital || 'Available for Consultation',
        phone: user.phone || '',
        qualifications: user.qualifications || user.medicalLicenseNumber || 'MBBS',
        availableSlots: user.availableSlots || ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
        availableDays: user.availableDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        createdAt: user.createdAt,
        isActive: true
      };
    }
    
    return c.json({ doctor });
  } catch (error) {
    console.error('Error fetching doctor:', error);
    return c.json({ error: 'Failed to fetch doctor' }, 500);
  }
});

// Authentication routes
app.post("/make-server-53ddc61c/auth/signup", async (c) => {
  try {
    const userData = await c.req.json();
    
    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      user_metadata: { 
        full_name: userData.fullName,
        role: userData.role,
      },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.error('Supabase auth error:', error);
      return c.json({ error: error.message }, 400);
    }

    if (!data.user) {
      return c.json({ error: 'Failed to create user' }, 400);
    }

    // Store user profile in KV store
    const userProfile = {
      id: data.user.id,
      email: userData.email,
      fullName: userData.fullName,
      phone: userData.phone,
      role: userData.role,
      createdAt: new Date().toISOString(),
    };

    // Role-specific data
    if (userData.role === 'patient') {
      Object.assign(userProfile, {
        dateOfBirth: userData.dateOfBirth,
        gender: userData.gender,
        bloodGroup: userData.bloodGroup,
      });
    } else if (userData.role === 'doctor') {
      Object.assign(userProfile, {
        medicalLicenseNumber: userData.medicalLicenseNumber,
        specialization: userData.specialization,
        // Default values for newly registered doctors
        experience: userData.experience || 'New Doctor',
        rating: userData.rating || 4.5,
        consultationFee: userData.consultationFee || 500,
        hospital: userData.hospital || 'Available for Consultation',
        qualifications: userData.qualifications || userData.medicalLicenseNumber || 'MBBS',
        availableSlots: userData.availableSlots || ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
        availableDays: userData.availableDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        isActive: true,
      });
    }

    await kv.set(`user:${data.user.id}`, userProfile);
    await kv.set(`user_email:${userData.email}`, data.user.id);

    return c.json({ success: true, userId: data.user.id });
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.get("/make-server-53ddc61c/auth/profile", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userProfile = await kv.get(`user:${user.id}`);
    
    if (!userProfile) {
      return c.json({ error: 'User profile not found' }, 404);
    }

    return c.json(userProfile);
  } catch (error) {
    console.error('Profile fetch error:', error);
    return c.json({ error: 'Failed to fetch profile' }, 500);
  }
});

// Initialize sample data for demo
app.post("/make-server-53ddc61c/init-sample-data", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userProfile = await kv.get(`user:${user.id}`);
    
    if (!userProfile) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Sample data for patients
    if (userProfile.role === 'patient') {
      const sampleAppointments = [
        {
          id: 'apt1',
          patientId: user.id,
          doctorId: 'dr1',
          doctorName: 'Dr. Priya Sharma',
          specialization: 'Cardiologist',
          appointmentDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], // 2 days from now
          appointmentTime: '10:00',
          status: 'confirmed',
          reasonForVisit: 'Regular checkup',
          appointmentType: 'in-person',
          hospital: 'Apollo Hospital, Mumbai'
        },
        {
          id: 'apt2',
          patientId: user.id,
          doctorId: 'dr2',
          doctorName: 'Dr. Rajesh Kumar',
          specialization: 'Neurologist',
          appointmentDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0], // 5 days from now
          appointmentTime: '14:30',
          status: 'pending',
          reasonForVisit: 'Follow-up consultation',
          appointmentType: 'telemedicine',
          hospital: 'Fortis Hospital, Delhi'
        },
        {
          id: 'apt3',
          patientId: user.id,
          doctorId: 'dr1',
          doctorName: 'Dr. Priya Sharma',
          specialization: 'Cardiologist',
          appointmentDate: new Date(Date.now() - 86400000 * 15).toISOString().split('T')[0], // 15 days ago
          appointmentTime: '09:00',
          status: 'completed',
          reasonForVisit: 'Blood pressure check',
          appointmentType: 'in-person',
          hospital: 'Apollo Hospital, Mumbai'
        },
        {
          id: 'apt4',
          patientId: user.id,
          doctorId: 'dr3',
          doctorName: 'Dr. Meera Reddy',
          specialization: 'General Physician',
          appointmentDate: new Date(Date.now() - 86400000 * 60).toISOString().split('T')[0], // 60 days ago
          appointmentTime: '11:30',
          status: 'completed',
          reasonForVisit: 'Annual health checkup',
          appointmentType: 'in-person',
          hospital: 'Max Healthcare, Bangalore'
        },
        {
          id: 'apt5',
          patientId: user.id,
          doctorId: 'dr2',
          doctorName: 'Dr. Rajesh Kumar',
          specialization: 'Neurologist',
          appointmentDate: new Date(Date.now() - 86400000 * 30).toISOString().split('T')[0], // 30 days ago
          appointmentTime: '15:00',
          status: 'completed',
          reasonForVisit: 'Consultation',
          appointmentType: 'telemedicine',
          hospital: 'Fortis Hospital, Delhi'
        }
      ];

      const samplePrescriptions = [
        {
          id: 'presc1',
          patientId: user.id,
          doctorId: 'dr1',
          doctorName: 'Dr. Priya Sharma',
          prescribedDate: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days ago
          status: 'active',
          consultationFee: '₹800',
          medicines: [
            { name: 'Telmisartan', dosage: '40mg', frequency: '1x daily', cost: '₹85' },
            { name: 'Metformin', dosage: '500mg', frequency: '2x daily', cost: '₹45' }
          ]
        },
        {
          id: 'presc2',
          patientId: user.id,
          doctorId: 'dr1',
          doctorName: 'Dr. Priya Sharma',
          prescribedDate: new Date(Date.now() - 86400000 * 15).toISOString(), // 15 days ago
          status: 'completed',
          consultationFee: '₹800',
          medicines: [
            { name: 'Azithromycin', dosage: '500mg', frequency: '1x daily', cost: '₹120' }
          ]
        },
        {
          id: 'presc3',
          patientId: user.id,
          doctorId: 'dr2',
          doctorName: 'Dr. Rajesh Kumar',
          prescribedDate: new Date(Date.now() - 86400000 * 30).toISOString(), // 30 days ago
          status: 'active',
          consultationFee: '₹1200',
          medicines: [
            { name: 'Calcirol Sachet', dosage: '60000 IU', frequency: 'Weekly', cost: '₹25' }
          ]
        }
      ];

      const sampleReports = [
        {
          id: 'report1',
          patientId: user.id,
          reportType: 'Blood Test',
          uploadDate: new Date(Date.now() - 86400000 * 7).toISOString(), // 7 days ago
          labName: 'SRL Diagnostics',
          cost: '₹1,250',
          aiAnalysis: {
            summary: 'Overall health parameters are within normal range. Slight improvement in cholesterol levels noted.',
            keyFindings: [
              { parameter: 'Total Cholesterol', value: '185', unit: 'mg/dL', status: 'normal' },
              { parameter: 'Blood Glucose', value: '95', unit: 'mg/dL', status: 'normal' }
            ]
          }
        },
        {
          id: 'report2',
          patientId: user.id,
          reportType: 'X-Ray',
          uploadDate: new Date(Date.now() - 86400000 * 45).toISOString(), // 45 days ago
          labName: 'Radiology Center',
          aiAnalysis: {
            summary: 'Chest X-ray shows clear lung fields with no abnormalities detected.',
            keyFindings: [
              { parameter: 'Lung Fields', value: 'Clear', unit: '', status: 'normal' },
              { parameter: 'Heart Size', value: 'Normal', unit: '', status: 'normal' }
            ]
          }
        },
        {
          id: 'report3',
          patientId: user.id,
          reportType: 'ECG',
          uploadDate: new Date(Date.now() - 86400000 * 90).toISOString(), // 90 days ago
          labName: 'Narayana Health Heart Centre',
          cost: '₹800',
          aiAnalysis: {
            summary: 'Normal sinus rhythm with regular rate and no significant abnormalities.',
            keyFindings: [
              { parameter: 'Heart Rate', value: '72', unit: 'BPM', status: 'normal' },
              { parameter: 'Rhythm', value: 'Sinus', unit: '', status: 'normal' }
            ]
          }
        }
      ];

      // Store sample data
      for (const apt of sampleAppointments) {
        await kv.set(`appointment:patient:${user.id}:${apt.id}`, apt);
      }
      for (const presc of samplePrescriptions) {
        await kv.set(`prescription:patient:${user.id}:${presc.id}`, presc);
      }
      for (const report of sampleReports) {
        await kv.set(`report:patient:${user.id}:${report.id}`, report);
      }
    }

    // Sample data for doctors
    if (userProfile.role === 'doctor') {
      const sampleAppointments = [
        {
          id: 'apt1',
          patientId: 'pat1',
          patientName: 'Arjun Singh',
          patientAge: 45,
          doctorId: user.id,
          appointmentDate: new Date().toISOString().split('T')[0], // today
          appointmentTime: '09:00',
          status: 'confirmed',
          reasonForVisit: 'Regular checkup',
          appointmentType: 'in-person'
        },
        {
          id: 'apt2',
          patientId: 'pat2',
          patientName: 'Priyanka Patel',
          patientAge: 32,
          doctorId: user.id,
          appointmentDate: new Date().toISOString().split('T')[0], // today
          appointmentTime: '11:00',
          status: 'pending',
          reasonForVisit: 'Follow-up consultation',
          appointmentType: 'in-person'
        },
        {
          id: 'apt3',
          patientId: 'pat3',
          patientName: 'Suresh Gupta',
          patientAge: 58,
          doctorId: user.id,
          appointmentDate: new Date().toISOString().split('T')[0], // today
          appointmentTime: '14:00',
          status: 'completed',
          reasonForVisit: 'Blood pressure monitoring',
          appointmentType: 'in-person'
        },
        {
          id: 'apt4',
          patientId: 'pat4',
          patientName: 'Kavya Iyer',
          patientAge: 29,
          doctorId: user.id,
          appointmentDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // tomorrow
          appointmentTime: '10:00',
          status: 'confirmed',
          reasonForVisit: 'Consultation',
          appointmentType: 'telemedicine'
        },
        {
          id: 'apt5',
          patientId: 'pat5',
          patientName: 'Vikram Joshi',
          patientAge: 41,
          doctorId: user.id,
          appointmentDate: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0], // 2 days ago
          appointmentTime: '15:30',
          status: 'completed',
          reasonForVisit: 'Prescription renewal',
          appointmentType: 'in-person'
        },
        {
          id: 'apt6',
          patientId: 'pat1',
          patientName: 'Arjun Singh',
          patientAge: 45,
          doctorId: user.id,
          appointmentDate: new Date(Date.now() - 86400000 * 7).toISOString().split('T')[0], // 1 week ago
          appointmentTime: '09:00',
          status: 'completed',
          reasonForVisit: 'Follow-up',
          appointmentType: 'in-person'
        }
      ];

      const sampleActivity = [
        {
          patientId: 'pat3',
          patientName: 'Suresh Gupta',
          reportType: 'X-Ray Chest',
          uploadDate: new Date(Date.now() - 86400000 * 1).toISOString() // 1 day ago
        },
        {
          patientId: 'pat1',
          patientName: 'Arjun Singh',
          reportType: 'Blood Test',
          uploadDate: new Date(Date.now() - 86400000 * 3).toISOString() // 3 days ago
        },
        {
          patientId: 'pat4',
          patientName: 'Kavya Iyer',
          reportType: 'MRI Brain',
          uploadDate: new Date(Date.now() - 86400000 * 5).toISOString() // 5 days ago
        }
      ];

      const samplePrescriptions = [
        {
          id: 'doc_presc1',
          patientId: 'pat1',
          patientName: 'Arjun Singh',
          doctorId: user.id,
          prescribedDate: new Date(Date.now() - 86400000 * 2).toISOString(),
          status: 'active',
          consultationFee: '₹800',
          medicines: [
            { name: 'Telmisartan', dosage: '40mg', frequency: '1x daily', cost: '₹85' }
          ]
        },
        {
          id: 'doc_presc2',
          patientId: 'pat2',
          patientName: 'Priyanka Patel',
          doctorId: user.id,
          prescribedDate: new Date(Date.now() - 86400000 * 5).toISOString(),
          status: 'active',
          consultationFee: '₹800',
          medicines: [
            { name: 'Metformin', dosage: '500mg', frequency: '2x daily', cost: '₹45' }
          ]
        },
        {
          id: 'doc_presc3',
          patientId: 'pat3',
          patientName: 'Suresh Gupta',
          doctorId: user.id,
          prescribedDate: new Date(Date.now() - 86400000 * 10).toISOString(),
          status: 'completed',
          consultationFee: '₹800',
          medicines: [
            { name: 'Azithromycin', dosage: '500mg', frequency: '1x daily', cost: '₹120' }
          ]
        }
      ];

      const sampleReports = [
        {
          id: 'doc_report1',
          patientId: 'pat1',
          patientName: 'Arjun Singh',
          doctorId: user.id,
          reportType: 'Blood Test',
          labName: 'SRL Diagnostics',
          uploadDate: new Date(Date.now() - 86400000 * 3).toISOString(),
          cost: '₹1,250',
          aiAnalysis: {
            summary: 'Blood parameters within normal range.',
            keyFindings: []
          }
        },
        {
          id: 'doc_report2',
          patientId: 'pat3',
          patientName: 'Suresh Gupta',
          doctorId: user.id,
          reportType: 'X-Ray Chest',
          labName: 'Apollo Diagnostics',
          uploadDate: new Date(Date.now() - 86400000 * 1).toISOString(),
          cost: '₹600',
          aiAnalysis: {
            summary: 'Chest X-ray shows clear lung fields.',
            keyFindings: []
          }
        }
      ];

      // Store sample data
      for (const apt of sampleAppointments) {
        await kv.set(`appointment:doctor:${user.id}:${apt.id}`, apt);
      }
      for (const activity of sampleActivity) {
        await kv.set(`activity:doctor:${user.id}:${activity.patientId}`, activity);
      }
      for (const presc of samplePrescriptions) {
        await kv.set(`prescription:doctor:${user.id}:${presc.id}`, presc);
      }
      for (const report of sampleReports) {
        await kv.set(`report:doctor:${user.id}:${report.id}`, report);
      }
    }

    return c.json({ success: true, message: 'Sample data initialized' });
  } catch (error) {
    console.error('Sample data initialization error:', error);
    return c.json({ error: 'Failed to initialize sample data' }, 500);
  }
});

// Patient dashboard data
app.get("/make-server-53ddc61c/patient/dashboard", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userProfile = await kv.get(`user:${user.id}`);
    
    if (!userProfile || userProfile.role !== 'patient') {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Get all appointments
    const appointmentsData = await kv.getByPrefix(`appointment:patient:${user.id}:`);
    
    // Get upcoming appointments
    const now = new Date();
    const upcomingAppointments = appointmentsData
      .filter(apt => new Date(apt.appointmentDate) >= now)
      .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime())
      .slice(0, 3);

    // Get recent prescriptions
    const prescriptionsData = await kv.getByPrefix(`prescription:patient:${user.id}:`);
    const recentPrescriptions = prescriptionsData
      .sort((a, b) => new Date(b.prescribedDate).getTime() - new Date(a.prescribedDate).getTime())
      .slice(0, 3);

    // Get recent reports
    const reportsData = await kv.getByPrefix(`report:patient:${user.id}:`);
    const recentReports = reportsData
      .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
      .slice(0, 1);

    // Calculate comprehensive statistics
    const totalAppointments = appointmentsData.length;
    const completedAppointments = appointmentsData.filter(apt => apt.status === 'completed').length;
    const upcomingAppointmentsCount = upcomingAppointments.length;
    const activePrescriptions = prescriptionsData.filter(p => p.status === 'active').length;
    const totalPrescriptions = prescriptionsData.length;
    const totalReports = reportsData.length;

    // Calculate health metrics
    const recentAppointments = appointmentsData.filter(apt => {
      const aptDate = new Date(apt.appointmentDate);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return aptDate >= threeMonthsAgo;
    });

    const recentReportsCount = reportsData.filter(report => {
      const reportDate = new Date(report.uploadDate);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return reportDate >= threeMonthsAgo;
    }).length;

    // Health score calculation (simple algorithm based on activity)
    let healthScore = 70; // Base score
    if (recentAppointments.length > 0) healthScore += 10; // Regular checkups
    if (recentReportsCount > 0) healthScore += 10; // Active monitoring
    if (activePrescriptions === 0) healthScore += 5; // No active medications needed
    if (upcomingAppointmentsCount > 0) healthScore += 5; // Planned care
    healthScore = Math.min(healthScore, 100); // Cap at 100

    return c.json({
      upcomingAppointments,
      recentPrescriptions,
      recentReports,
      totalAppointments,
      completedAppointments,
      upcomingAppointmentsCount,
      activePrescriptions,
      totalPrescriptions,
      totalReports,
      healthScore,
      recentActivity: {
        appointmentsLast3Months: recentAppointments.length,
        reportsLast3Months: recentReportsCount,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return c.json({ error: 'Failed to fetch dashboard data' }, 500);
  }
});

// Doctor dashboard data
app.get("/make-server-53ddc61c/doctor/dashboard", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userProfile = await kv.get(`user:${user.id}`);
    
    if (!userProfile || userProfile.role !== 'doctor') {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Get all appointments for this doctor
    const appointmentsData = await kv.getByPrefix(`appointment:doctor:${user.id}:`);
    
    // Get today's appointments
    const todayAppointments = appointmentsData
      .filter(apt => apt.appointmentDate === today)
      .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));

    // Get all prescriptions written by this doctor
    const prescriptionsData = await kv.getByPrefix(`prescription:doctor:${user.id}:`);
    
    // Get all reports for patients of this doctor
    const reportsData = await kv.getByPrefix(`report:doctor:${user.id}:`);

    // Get recent patient activity (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentActivity = await kv.getByPrefix(`activity:doctor:${user.id}:`);
    const filteredActivity = recentActivity.filter(activity => 
      new Date(activity.uploadDate) >= weekAgo
    ).sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());

    // Get upcoming appointments (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcoming = appointmentsData
      .filter(apt => {
        const aptDate = new Date(apt.appointmentDate);
        return aptDate > new Date() && aptDate <= nextWeek;
      })
      .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime())
      .slice(0, 5);

    // Calculate comprehensive statistics
    const totalPatients = [...new Set(appointmentsData.map(apt => apt.patientId))].length;
    const totalAppointmentsAllTime = appointmentsData.length;
    const totalPrescriptions = prescriptionsData.length;
    const totalReports = reportsData.length;

    // This week's statistics
    const thisWeekStart = new Date();
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay()); // Start of week
    const thisWeekAppointments = appointmentsData.filter(apt => 
      new Date(apt.appointmentDate) >= thisWeekStart
    );

    return c.json({
      todayAppointments,
      recentActivity: filteredActivity,
      upcomingAppointments: upcoming,
      totalAppointments: todayAppointments.length,
      completedToday: todayAppointments.filter(apt => apt.status === 'completed').length,
      pendingToday: todayAppointments.filter(apt => apt.status === 'pending').length,
      totalPatients,
      totalAppointmentsAllTime,
      totalPrescriptions,
      totalReports,
      thisWeekAppointments: thisWeekAppointments.length,
      thisWeekCompleted: thisWeekAppointments.filter(apt => apt.status === 'completed').length,
    });
  } catch (error) {
    console.error('Doctor dashboard error:', error);
    return c.json({ error: 'Failed to fetch dashboard data' }, 500);
  }
});

// Prescriptions endpoint
app.get("/make-server-53ddc61c/prescriptions", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userProfile = await kv.get(`user:${user.id}`);
    
    if (!userProfile) {
      return c.json({ error: 'User not found' }, 404);
    }

    let prescriptionsData = [];

    if (userProfile.role === 'patient') {
      prescriptionsData = await kv.getByPrefix(`prescription:patient:${user.id}:`);
    } else if (userProfile.role === 'doctor') {
      prescriptionsData = await kv.getByPrefix(`prescription:doctor:${user.id}:`);
    }

    return c.json({
      prescriptions: prescriptionsData,
      totalCount: prescriptionsData.length,
      activeCount: prescriptionsData.filter(p => p.status === 'active').length,
      completedCount: prescriptionsData.filter(p => p.status === 'completed').length,
    });
  } catch (error) {
    console.error('Prescriptions fetch error:', error);
    return c.json({ error: 'Failed to fetch prescriptions' }, 500);
  }
});

// Reports endpoint
app.get("/make-server-53ddc61c/reports", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userProfile = await kv.get(`user:${user.id}`);
    
    if (!userProfile) {
      return c.json({ error: 'User not found' }, 404);
    }

    let reportsData = [];

    if (userProfile.role === 'patient') {
      reportsData = await kv.getByPrefix(`report:patient:${user.id}:`);
    } else if (userProfile.role === 'doctor') {
      reportsData = await kv.getByPrefix(`report:doctor:${user.id}:`);
    }

    return c.json({
      reports: reportsData,
      totalCount: reportsData.length,
      analyzedCount: reportsData.filter(r => r.aiAnalysis).length,
      pendingCount: reportsData.filter(r => !r.aiAnalysis).length,
    });
  } catch (error) {
    console.error('Reports fetch error:', error);
    return c.json({ error: 'Failed to fetch reports' }, 500);
  }
});

// Appointments endpoint
app.get("/make-server-53ddc61c/appointments", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userProfile = await kv.get(`user:${user.id}`);
    
    if (!userProfile) {
      return c.json({ error: 'User not found' }, 404);
    }

    let appointmentsData = [];

    if (userProfile.role === 'patient') {
      appointmentsData = await kv.getByPrefix(`appointment:patient:${user.id}:`);
    } else if (userProfile.role === 'doctor') {
      appointmentsData = await kv.getByPrefix(`appointment:doctor:${user.id}:`);
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    return c.json({
      appointments: appointmentsData,
      totalCount: appointmentsData.length,
      upcomingCount: appointmentsData.filter(apt => new Date(apt.appointmentDate) >= now).length,
      todayCount: appointmentsData.filter(apt => apt.appointmentDate === today).length,
      completedCount: appointmentsData.filter(apt => apt.status === 'completed').length,
      pendingCount: appointmentsData.filter(apt => apt.status === 'pending').length,
    });
  } catch (error) {
    console.error('Appointments fetch error:', error);
    return c.json({ error: 'Failed to fetch appointments' }, 500);
  }
});

// Create prescription endpoint
app.post("/make-server-53ddc61c/prescriptions", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userProfile = await kv.get(`user:${user.id}`);
    
    if (!userProfile || userProfile.role !== 'doctor') {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const prescriptionData = await c.req.json();
    const prescriptionId = `presc_${Date.now()}`;
    
    const prescription = {
      id: prescriptionId,
      doctorId: user.id,
      doctorName: userProfile.fullName,
      prescribedDate: new Date().toISOString(),
      status: 'active',
      ...prescriptionData
    };

    // Store for both doctor and patient
    await kv.set(`prescription:doctor:${user.id}:${prescriptionId}`, prescription);
    if (prescriptionData.patientId) {
      await kv.set(`prescription:patient:${prescriptionData.patientId}:${prescriptionId}`, prescription);
    }

    return c.json({ success: true, prescription });
  } catch (error) {
    console.error('Create prescription error:', error);
    return c.json({ error: 'Failed to create prescription' }, 500);
  }
});

// Upload report endpoint
app.post("/make-server-53ddc61c/reports", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userProfile = await kv.get(`user:${user.id}`);
    
    if (!userProfile) {
      return c.json({ error: 'User not found' }, 404);
    }

    const reportData = await c.req.json();
    const reportId = `report_${Date.now()}`;
    
    const report = {
      id: reportId,
      patientId: user.id,
      uploadDate: new Date().toISOString(),
      ...reportData
    };

    // Store for patient
    await kv.set(`report:patient:${user.id}:${reportId}`, report);
    
    // Also store activity for the patient's doctors (if any)
    if (reportData.doctorId) {
      await kv.set(`activity:doctor:${reportData.doctorId}:${user.id}`, {
        patientId: user.id,
        patientName: userProfile.fullName,
        reportType: reportData.reportType,
        uploadDate: new Date().toISOString()
      });
    }

    return c.json({ success: true, report });
  } catch (error) {
    console.error('Upload report error:', error);
    return c.json({ error: 'Failed to upload report' }, 500);
  }
});

// Book appointment endpoint
app.post("/make-server-53ddc61c/appointments", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userProfile = await kv.get(`user:${user.id}`);
    
    if (!userProfile || userProfile.role !== 'patient') {
      return c.json({ error: 'Only patients can book appointments' }, 403);
    }

    const appointmentData = await c.req.json();
    const appointmentId = `apt_${Date.now()}`;
    
    // Get doctor information - try doctor profile first, then user profile
    let doctor = await kv.get(`doctor:${appointmentData.doctorId}`);
    
    if (!doctor) {
      // If no doctor profile, get from user profile
      const doctorUser = await kv.get(`user:${appointmentData.doctorId}`);
      
      if (!doctorUser || doctorUser.role !== 'doctor') {
        return c.json({ error: 'Doctor not found' }, 404);
      }
      
      // Create doctor object from user profile
      doctor = {
        name: doctorUser.fullName,
        specialization: doctorUser.specialization || 'General Physician',
        hospital: doctorUser.hospital || 'Available for Consultation',
        consultationFee: doctorUser.consultationFee || 500,
      };
    }
    
    const appointment = {
      id: appointmentId,
      patientId: user.id,
      patientName: userProfile.fullName,
      patientEmail: userProfile.email,
      patientPhone: userProfile.phone || '',
      doctorId: appointmentData.doctorId,
      doctorName: doctor.name,
      doctorSpecialization: doctor.specialization,
      hospitalName: doctor.hospital,
      appointmentDate: appointmentData.appointmentDate,
      appointmentTime: appointmentData.appointmentTime,
      appointmentType: appointmentData.appointmentType || 'in-person',
      reasonForVisit: appointmentData.reasonForVisit || '',
      status: 'pending',
      consultationFee: doctor.consultationFee,
      bookedAt: new Date().toISOString(),
      notes: '',
      isActive: true
    };

    // Store for both patient and doctor
    await kv.set(`appointment:patient:${user.id}:${appointmentId}`, appointment);
    await kv.set(`appointment:doctor:${appointmentData.doctorId}:${appointmentId}`, appointment);
    
    // Add to doctor's activity feed
    await kv.set(`activity:doctor:${appointmentData.doctorId}:${appointmentId}`, {
      patientId: user.id,
      patientName: userProfile.fullName,
      type: 'appointment_booked',
      appointmentDate: appointmentData.appointmentDate,
      appointmentTime: appointmentData.appointmentTime,
      createdAt: new Date().toISOString()
    });

    return c.json({ 
      success: true, 
      appointment,
      message: 'Appointment booked successfully'
    });
  } catch (error) {
    console.error('Book appointment error:', error);
    return c.json({ error: 'Failed to book appointment' }, 500);
  }
});

// Update appointment status (for doctors)
app.put("/make-server-53ddc61c/appointments/:id", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userProfile = await kv.get(`user:${user.id}`);
    
    if (!userProfile || userProfile.role !== 'doctor') {
      return c.json({ error: 'Only doctors can update appointment status' }, 403);
    }

    const appointmentId = c.req.param('id');
    const updateData = await c.req.json();
    
    // Get existing appointment
    const appointment = await kv.get(`appointment:doctor:${user.id}:${appointmentId}`);
    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }
    
    // Update appointment
    const updatedAppointment = {
      ...appointment,
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    // Update in both doctor and patient stores
    await kv.set(`appointment:doctor:${user.id}:${appointmentId}`, updatedAppointment);
    await kv.set(`appointment:patient:${appointment.patientId}:${appointmentId}`, updatedAppointment);

    return c.json({ 
      success: true, 
      appointment: updatedAppointment,
      message: 'Appointment updated successfully'
    });
  } catch (error) {
    console.error('Update appointment error:', error);
    return c.json({ error: 'Failed to update appointment' }, 500);
  }
});

// Cancel appointment endpoint (for patients)
app.delete("/make-server-53ddc61c/appointments/:id", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userProfile = await kv.get(`user:${user.id}`);
    
    if (!userProfile || userProfile.role !== 'patient') {
      return c.json({ error: 'Only patients can cancel appointments' }, 403);
    }

    const appointmentId = c.req.param('id');
    
    // Get existing appointment
    const appointment = await kv.get(`appointment:patient:${user.id}:${appointmentId}`);
    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }
    
    // Update status to cancelled instead of deleting
    const cancelledAppointment = {
      ...appointment,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledBy: 'patient'
    };

    // Update in both stores
    await kv.set(`appointment:patient:${user.id}:${appointmentId}`, cancelledAppointment);
    await kv.set(`appointment:doctor:${appointment.doctorId}:${appointmentId}`, cancelledAppointment);

    return c.json({ 
      success: true, 
      message: 'Appointment cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    return c.json({ error: 'Failed to cancel appointment' }, 500);
  }
});

// ========== DOCTOR - PATIENTS MANAGEMENT ==========

// Get all patients (for doctor)
app.get("/make-server-53ddc61c/doctor/patients", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userProfile = await kv.get(`user:${user.id}`);
    
    if (!userProfile || userProfile.role !== 'doctor') {
      return c.json({ error: 'Unauthorized - Doctor access only' }, 403);
    }

    // Get all appointments for this doctor
    const appointments = await kv.getByPrefix(`appointment:doctor:${user.id}:`);
    
    // Extract unique patient IDs
    const patientIds = [...new Set(appointments.map(apt => apt.patientId))];
    
    // Fetch patient details
    const patients = [];
    for (const patientId of patientIds) {
      const patient = await kv.get(`user:${patientId}`);
      if (patient && patient.role === 'patient') {
        // Get patient's last appointment with this doctor
        const patientAppointments = appointments.filter(apt => apt.patientId === patientId);
        const lastAppointment = patientAppointments.sort((a, b) => 
          new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime()
        )[0];
        
        // Get patient's prescription count
        const prescriptions = await kv.getByPrefix(`prescription:patient:${patientId}:`);
        const doctorPrescriptions = prescriptions.filter(p => p.doctorId === user.id);
        
        // Get patient's reports count
        const reports = await kv.getByPrefix(`report:patient:${patientId}:`);
        
        patients.push({
          id: patient.id,
          fullName: patient.fullName,
          email: patient.email,
          phone: patient.phone,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender,
          bloodGroup: patient.bloodGroup,
          lastVisit: lastAppointment?.appointmentDate || null,
          totalAppointments: patientAppointments.length,
          totalPrescriptions: doctorPrescriptions.length,
          totalReports: reports.length,
          createdAt: patient.createdAt,
        });
      }
    }
    
    // Sort by last visit (most recent first)
    patients.sort((a, b) => {
      if (!a.lastVisit) return 1;
      if (!b.lastVisit) return -1;
      return new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime();
    });

    return c.json({ patients });
  } catch (error) {
    console.error('Error fetching patients:', error);
    return c.json({ error: 'Failed to fetch patients' }, 500);
  }
});

// Get patient details by ID (for doctor)
app.get("/make-server-53ddc61c/doctor/patients/:patientId", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userProfile = await kv.get(`user:${user.id}`);
    
    if (!userProfile || userProfile.role !== 'doctor') {
      return c.json({ error: 'Unauthorized - Doctor access only' }, 403);
    }

    const patientId = c.req.param('patientId');
    
    // Get patient profile
    const patient = await kv.get(`user:${patientId}`);
    if (!patient || patient.role !== 'patient') {
      return c.json({ error: 'Patient not found' }, 404);
    }

    // Get patient's appointments with this doctor
    const allAppointments = await kv.getByPrefix(`appointment:patient:${patientId}:`);
    const appointments = allAppointments
      .filter(apt => apt.doctorId === user.id)
      .sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime());
    
    // Get patient's prescriptions from this doctor
    const allPrescriptions = await kv.getByPrefix(`prescription:patient:${patientId}:`);
    const prescriptions = allPrescriptions
      .filter(p => p.doctorId === user.id)
      .sort((a, b) => new Date(b.prescribedDate).getTime() - new Date(a.prescribedDate).getTime());
    
    // Get patient's medical reports
    const reports = await kv.getByPrefix(`report:patient:${patientId}:`);
    const sortedReports = reports.sort((a, b) => 
      new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
    );

    return c.json({ 
      patient: {
        id: patient.id,
        fullName: patient.fullName,
        email: patient.email,
        phone: patient.phone,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup,
        createdAt: patient.createdAt,
      },
      appointments,
      prescriptions,
      reports: sortedReports,
      stats: {
        totalAppointments: appointments.length,
        totalPrescriptions: prescriptions.length,
        totalReports: reports.length,
      }
    });
  } catch (error) {
    console.error('Error fetching patient details:', error);
    return c.json({ error: 'Failed to fetch patient details' }, 500);
  }
});

// Add prescription for a patient (doctor only)
app.post("/make-server-53ddc61c/doctor/patients/:patientId/prescriptions", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userProfile = await kv.get(`user:${user.id}`);
    
    if (!userProfile || userProfile.role !== 'doctor') {
      return c.json({ error: 'Unauthorized - Doctor access only' }, 403);
    }

    const patientId = c.req.param('patientId');
    const body = await c.req.json();
    
    // Validate patient exists
    const patient = await kv.get(`user:${patientId}`);
    if (!patient || patient.role !== 'patient') {
      return c.json({ error: 'Patient not found' }, 404);
    }

    // Create prescription
    const prescriptionId = `presc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const prescription = {
      id: prescriptionId,
      patientId: patientId,
      patientName: patient.fullName,
      doctorId: user.id,
      doctorName: userProfile.fullName,
      doctorSpecialization: userProfile.specialization || 'General Physician',
      diagnosis: body.diagnosis || '',
      medicines: body.medicines || [],
      labTests: body.labTests || [],
      instructions: body.instructions || '',
      followUpDate: body.followUpDate || null,
      prescribedDate: new Date().toISOString(),
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    // Store prescription for both patient and doctor
    await kv.set(`prescription:patient:${patientId}:${prescriptionId}`, prescription);
    await kv.set(`prescription:doctor:${user.id}:${prescriptionId}`, prescription);

    return c.json({ 
      success: true,
      message: 'Prescription added successfully',
      prescription 
    });
  } catch (error) {
    console.error('Error adding prescription:', error);
    return c.json({ error: 'Failed to add prescription' }, 500);
  }
});

Deno.serve(app.fetch);