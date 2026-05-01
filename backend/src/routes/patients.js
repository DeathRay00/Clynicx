const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ─── DOCTOR DASHBOARD ──────────────────────────────────────────
// GET /doctor/dashboard
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'doctor') return res.status(403).json({ error: 'Unauthorized' });

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
    const thisWeekStart = new Date(); thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());

    const [aptsRes, prescsRes, reportsRes, activityRes] = await Promise.all([
      pool.query(`SELECT * FROM appointments WHERE doctor_id = $1 ORDER BY appointment_date, appointment_time`, [user.id]),
      pool.query(`SELECT * FROM prescriptions WHERE doctor_id = $1`, [user.id]),
      pool.query(`SELECT * FROM medical_reports WHERE doctor_id = $1`, [user.id]),
      pool.query(`SELECT * FROM doctor_activity WHERE doctor_id = $1 AND upload_date >= $2 ORDER BY upload_date DESC`, [user.id, weekAgo]),
    ]);

    const apts = aptsRes.rows;
    const todayAppointments = apts.filter(a => {
      const d = a.appointment_date instanceof Date ? a.appointment_date.toISOString().split('T')[0] : String(a.appointment_date);
      return d === today;
    }).map(mapApt);

    const upcoming = apts.filter(a => { const d = new Date(a.appointment_date); return d > new Date() && d <= nextWeek; }).slice(0, 5).map(mapApt);
    const totalPatients = [...new Set(apts.map(a => a.patient_id))].length;
    const thisWeekApts = apts.filter(a => new Date(a.appointment_date) >= thisWeekStart);

    return res.json({
      todayAppointments, recentActivity: activityRes.rows, upcomingAppointments: upcoming,
      totalAppointments: todayAppointments.length,
      completedToday: todayAppointments.filter(a => a.status === 'completed').length,
      pendingToday: todayAppointments.filter(a => a.status === 'pending').length,
      totalPatients, totalAppointmentsAllTime: apts.length,
      totalPrescriptions: prescsRes.rows.length, totalReports: reportsRes.rows.length,
      thisWeekAppointments: thisWeekApts.length,
      thisWeekCompleted: thisWeekApts.filter(a => a.status === 'completed').length,
    });
  } catch (err) {
    console.error('Doctor dashboard error:', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// GET /doctor/appointments
router.get('/appointments', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'doctor') return res.status(403).json({ error: 'Unauthorized' });
    const result = await pool.query(`SELECT * FROM appointments WHERE doctor_id = $1 ORDER BY appointment_date DESC`, [user.id]);
    const appointments = result.rows.map(mapApt);
    return res.json({ appointments, totalCount: appointments.length });
  } catch (err) { return res.status(500).json({ error: 'Failed to fetch appointments' }); }
});

// ─── DOCTOR → PATIENTS MANAGEMENT ─────────────────────────────
// GET /doctor/patients - all patients for this doctor
router.get('/patients', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'doctor') {
      return res.status(403).json({ error: 'Unauthorized - Doctor access only' });
    }

    // Get unique patients from appointments
    const result = await pool.query(
      `SELECT DISTINCT u.id, u.full_name, u.email, u.phone,
              u.date_of_birth, u.gender, u.blood_group, u.created_at,
              MAX(a.appointment_date) AS last_visit,
              COUNT(a.id) AS total_appointments
       FROM users u
       JOIN appointments a ON a.patient_id = u.id
       WHERE a.doctor_id = $1 AND u.role = 'patient'
       GROUP BY u.id
       ORDER BY last_visit DESC NULLS LAST`,
      [user.id]
    );

    const patients = result.rows.map(row => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      dateOfBirth: row.date_of_birth,
      gender: row.gender,
      bloodGroup: row.blood_group,
      lastVisit: row.last_visit instanceof Date
        ? row.last_visit.toISOString().split('T')[0]
        : row.last_visit,
      totalAppointments: parseInt(row.total_appointments),
      createdAt: row.created_at,
    }));

    return res.json({ patients });
  } catch (err) {
    console.error('Fetch patients error:', err);
    return res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// GET /doctor/patients/:patientId - patient detail
router.get('/patients/:patientId', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'doctor') {
      return res.status(403).json({ error: 'Unauthorized - Doctor access only' });
    }

    const { patientId } = req.params;

    const [patientRes, aptsRes, prescsRes, reportsRes] = await Promise.all([
      pool.query(`SELECT * FROM users WHERE id = $1 AND role = 'patient'`, [patientId]),
      pool.query(`SELECT * FROM appointments WHERE patient_id = $1 AND doctor_id = $2 ORDER BY appointment_date DESC`, [patientId, user.id]),
      pool.query(`SELECT * FROM prescriptions WHERE patient_id = $1 AND doctor_id = $2 ORDER BY prescribed_date DESC`, [patientId, user.id]),
      pool.query(`SELECT * FROM medical_reports WHERE patient_id = $1 ORDER BY upload_date DESC`, [patientId]),
    ]);

    if (patientRes.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const p = patientRes.rows[0];
    return res.json({
      patient: {
        id: p.id, fullName: p.full_name, email: p.email, phone: p.phone,
        dateOfBirth: p.date_of_birth, gender: p.gender, bloodGroup: p.blood_group, createdAt: p.created_at,
      },
      appointments: aptsRes.rows.map(mapApt),
      prescriptions: prescsRes.rows.map(mapPresc),
      reports: reportsRes.rows.map(mapReport),
      stats: {
        totalAppointments: aptsRes.rows.length,
        totalPrescriptions: prescsRes.rows.length,
        totalReports: reportsRes.rows.length,
      },
    });
  } catch (err) {
    console.error('Fetch patient detail error:', err);
    return res.status(500).json({ error: 'Failed to fetch patient details' });
  }
});

// POST /doctor/patients/:patientId/prescriptions
router.post('/patients/:patientId/prescriptions', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'doctor') {
      return res.status(403).json({ error: 'Unauthorized - Doctor access only' });
    }

    const { patientId } = req.params;
    const { diagnosis, medicines, labTests, instructions, followUpDate, consultationFee } = req.body;

    const patientRes = await pool.query(`SELECT * FROM users WHERE id = $1 AND role = 'patient'`, [patientId]);
    if (patientRes.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    const patient = patientRes.rows[0];

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO prescriptions (
        id, patient_id, doctor_id, patient_name, doctor_name, doctor_specialization,
        diagnosis, medicines, lab_tests, instructions, follow_up_date, consultation_fee, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active')
      RETURNING *`,
      [
        id, patientId, user.id,
        patient.full_name, user.full_name, user.specialization || 'General Physician',
        diagnosis || null,
        JSON.stringify(medicines || []),
        JSON.stringify(labTests || []),
        instructions || null,
        followUpDate || null,
        consultationFee || null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Prescription added successfully',
      prescription: mapPresc(result.rows[0]),
    });
  } catch (err) {
    console.error('Add prescription error:', err);
    return res.status(500).json({ error: 'Failed to add prescription' });
  }
});

function mapPresc(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    patientName: row.patient_name,
    doctorName: row.doctor_name,
    doctorSpecialization: row.doctor_specialization,
    diagnosis: row.diagnosis,
    medicines: row.medicines || [],
    labTests: row.lab_tests || [],
    instructions: row.instructions,
    followUpDate: row.follow_up_date,
    consultationFee: row.consultation_fee,
    status: row.status,
    prescribedDate: row.prescribed_date,
  };
}

function mapReport(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    fileName: row.file_url || 'report.pdf',
    fileSize: '-',
    reportType: row.report_type || 'other',
    dateUploaded: row.upload_date instanceof Date
      ? row.upload_date.toISOString().split('T')[0]
      : String(row.upload_date || row.created_at || '').split('T')[0],
    reportDate: row.upload_date instanceof Date
      ? row.upload_date.toISOString().split('T')[0]
      : String(row.upload_date || row.created_at || '').split('T')[0],
    status: row.ai_analysis ? 'analyzed' : 'uploaded',
    labName: row.lab_name,
    cost: row.cost,
    aiAnalysis: row.ai_analysis,
    createdAt: row.created_at,
  };
}

function mapApt(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    patientName: row.patient_name,
    patientEmail: row.patient_email,
    patientPhone: row.patient_phone,
    doctorName: row.doctor_name,
    doctorSpecialization: row.doctor_specialization,
    hospitalName: row.hospital_name,
    appointmentDate: row.appointment_date instanceof Date
      ? row.appointment_date.toISOString().split('T')[0]
      : String(row.appointment_date),
    appointmentTime: row.appointment_time,
    appointmentType: row.appointment_type,
    reasonForVisit: row.reason_for_visit,
    status: row.status,
    consultationFee: row.consultation_fee,
    notes: row.notes,
    bookedAt: row.booked_at,
  };
}

module.exports = router;
