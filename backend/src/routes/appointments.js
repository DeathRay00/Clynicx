const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /appointments - list appointments for current user
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const now = new Date().toISOString().split('T')[0];

    let result;
    if (user.role === 'patient') {
      result = await pool.query(
        `SELECT * FROM appointments WHERE patient_id = $1 ORDER BY appointment_date DESC, appointment_time DESC`,
        [user.id]
      );
    } else if (user.role === 'doctor') {
      result = await pool.query(
        `SELECT * FROM appointments WHERE doctor_id = $1 ORDER BY appointment_date DESC, appointment_time DESC`,
        [user.id]
      );
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const appointments = result.rows.map(mapAppointment);
    return res.json({
      appointments,
      totalCount: appointments.length,
      upcomingCount: appointments.filter(a => a.appointmentDate >= now).length,
      todayCount: appointments.filter(a => a.appointmentDate === now).length,
      completedCount: appointments.filter(a => a.status === 'completed').length,
      pendingCount: appointments.filter(a => a.status === 'pending').length,
    });
  } catch (err) {
    console.error('Fetch appointments error:', err);
    return res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// GET /patient/appointments (same as above for patients)
router.get('/patient', requireAuth, async (req, res) => {
  req.url = '/';
  return router.handle(req, res);
});

// POST /appointments - book an appointment (patient only)
router.post('/', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'patient') {
      return res.status(403).json({ error: 'Only patients can book appointments' });
    }

    const { doctorId, appointmentDate, appointmentTime, appointmentType, reasonForVisit } = req.body;
    if (!doctorId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ error: 'doctorId, appointmentDate, and appointmentTime are required' });
    }

    // Get doctor info
    const doctorResult = await pool.query(
      `SELECT id, full_name, specialization, hospital, consultation_fee FROM users WHERE id = $1 AND role = 'doctor'`,
      [doctorId]
    );
    if (doctorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    const doctor = doctorResult.rows[0];

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO appointments (
        id, patient_id, doctor_id,
        patient_name, patient_email, patient_phone,
        doctor_name, doctor_specialization, hospital_name,
        appointment_date, appointment_time, appointment_type,
        reason_for_visit, status, consultation_fee
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',$14)
      RETURNING *`,
      [
        id, user.id, doctorId,
        user.full_name, user.email, user.phone || '',
        doctor.full_name, doctor.specialization, doctor.hospital,
        appointmentDate, appointmentTime, appointmentType || 'in-person',
        reasonForVisit || '', doctor.consultation_fee,
      ]
    );

    return res.status(201).json({
      success: true,
      appointment: mapAppointment(result.rows[0]),
      message: 'Appointment booked successfully',
    });
  } catch (err) {
    console.error('Book appointment error:', err);
    return res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// PUT /appointments/:id - update appointment status (doctor only)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'doctor') {
      return res.status(403).json({ error: 'Only doctors can update appointment status' });
    }

    const { id } = req.params;
    const { status, notes } = req.body;

    const result = await pool.query(
      `UPDATE appointments
       SET status = COALESCE($1, status), notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $3 AND doctor_id = $4
       RETURNING *`,
      [status, notes, id, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    return res.json({
      success: true,
      appointment: mapAppointment(result.rows[0]),
      message: 'Appointment updated successfully',
    });
  } catch (err) {
    console.error('Update appointment error:', err);
    return res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// DELETE /appointments/:id - cancel appointment (patient only)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'patient') {
      return res.status(403).json({ error: 'Only patients can cancel appointments' });
    }

    const { id } = req.params;
    const result = await pool.query(
      `UPDATE appointments
       SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = 'patient', updated_at = NOW()
       WHERE id = $1 AND patient_id = $2
       RETURNING *`,
      [id, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    return res.json({ success: true, message: 'Appointment cancelled successfully' });
  } catch (err) {
    console.error('Cancel appointment error:', err);
    return res.status(500).json({ error: 'Failed to cancel appointment' });
  }
});

function mapAppointment(row) {
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
      : row.appointment_date,
    appointmentTime: row.appointment_time,
    appointmentType: row.appointment_type,
    reasonForVisit: row.reason_for_visit,
    status: row.status,
    consultationFee: row.consultation_fee,
    notes: row.notes,
    bookedAt: row.booked_at,
    updatedAt: row.updated_at,
    isActive: row.is_active,
  };
}

module.exports = router;
