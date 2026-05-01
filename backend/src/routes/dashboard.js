const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /patient/dashboard
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'patient') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const [aptsRes, prescsRes, reportsRes] = await Promise.all([
      pool.query(`SELECT * FROM appointments WHERE patient_id = $1 ORDER BY appointment_date`, [user.id]),
      pool.query(`SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY prescribed_date DESC`, [user.id]),
      pool.query(`SELECT * FROM medical_reports WHERE patient_id = $1 ORDER BY upload_date DESC`, [user.id]),
    ]);

    const apts = aptsRes.rows;
    const prescs = prescsRes.rows;
    const reports = reportsRes.rows;

    const upcomingAppointments = apts
      .filter(a => a.appointment_date >= today)
      .slice(0, 3)
      .map(mapApt);

    const recentPrescriptions = prescs.slice(0, 3).map(mapPresc);
    const recentReports = reports.slice(0, 1).map(mapReport);

    const totalAppointments = apts.length;
    const completedAppointments = apts.filter(a => a.status === 'completed').length;
    const activePrescriptions = prescs.filter(p => p.status === 'active').length;
    const totalReports = reports.length;

    const recentAptsCount = apts.filter(a => new Date(a.appointment_date) >= threeMonthsAgo).length;
    const recentReportsCount = reports.filter(r => new Date(r.upload_date) >= threeMonthsAgo).length;

    let healthScore = 70;
    if (recentAptsCount > 0) healthScore += 10;
    if (recentReportsCount > 0) healthScore += 10;
    if (activePrescriptions === 0) healthScore += 5;
    if (upcomingAppointments.length > 0) healthScore += 5;
    healthScore = Math.min(healthScore, 100);

    return res.json({
      upcomingAppointments,
      recentPrescriptions,
      recentReports,
      totalAppointments,
      completedAppointments,
      upcomingAppointmentsCount: upcomingAppointments.length,
      activePrescriptions,
      totalPrescriptions: prescs.length,
      totalReports,
      healthScore,
      recentActivity: {
        appointmentsLast3Months: recentAptsCount,
        reportsLast3Months: recentReportsCount,
      },
    });
  } catch (err) {
    console.error('Patient dashboard error:', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// GET /patient/appointments
router.get('/appointments', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'patient') return res.status(403).json({ error: 'Unauthorized' });
    const now = new Date().toISOString().split('T')[0];
    const result = await pool.query(`SELECT * FROM appointments WHERE patient_id = $1 ORDER BY appointment_date DESC`, [user.id]);
    const appointments = result.rows.map(mapApt);
    return res.json({ appointments, totalCount: appointments.length, upcomingCount: appointments.filter(a => a.appointmentDate >= now).length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// GET /patient/prescriptions
router.get('/prescriptions', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'patient') return res.status(403).json({ error: 'Unauthorized' });
    const result = await pool.query(`SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY prescribed_date DESC`, [user.id]);
    const prescriptions = result.rows.map(mapPresc);
    return res.json({ prescriptions, totalCount: prescriptions.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
});

// GET /patient/reports
router.get('/reports', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'patient') return res.status(403).json({ error: 'Unauthorized' });
    const result = await pool.query(`SELECT * FROM medical_reports WHERE patient_id = $1 ORDER BY upload_date DESC`, [user.id]);
    const reports = result.rows.map(mapReport);
    return res.json({ reports, totalCount: reports.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

function mapApt(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    patientName: row.patient_name,
    patientEmail: row.patient_email,
    patientPhone: row.patient_phone,
    doctorName: row.doctor_name,
    specialization: row.doctor_specialization,
    hospitalName: row.hospital_name,
    doctorSpecialization: row.doctor_specialization,
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
    consultationFee: row.consultation_fee,
    status: row.status,
    prescribedDate: row.prescribed_date,
  };
}

function mapReport(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    patientName: row.patient_name,
    reportType: row.report_type,
    labName: row.lab_name,
    cost: row.cost,
    aiAnalysis: row.ai_analysis,
    uploadDate: row.upload_date,
  };
}

module.exports = router;
