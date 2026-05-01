const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /prescriptions
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    let result;

    if (user.role === 'patient') {
      result = await pool.query(
        `SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY prescribed_date DESC`,
        [user.id]
      );
    } else if (user.role === 'doctor') {
      result = await pool.query(
        `SELECT * FROM prescriptions WHERE doctor_id = $1 ORDER BY prescribed_date DESC`,
        [user.id]
      );
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const prescriptions = result.rows.map(mapPrescription);
    return res.json({
      prescriptions,
      totalCount: prescriptions.length,
      activeCount: prescriptions.filter(p => p.status === 'active').length,
      completedCount: prescriptions.filter(p => p.status === 'completed').length,
    });
  } catch (err) {
    console.error('Fetch prescriptions error:', err);
    return res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
});

// GET /prescriptions/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM prescriptions WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    const p = result.rows[0];
    // Only doctor or patient involved can view
    if (p.patient_id !== user.id && p.doctor_id !== user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    return res.json(mapPrescription(p));
  } catch (err) {
    console.error('Fetch prescription error:', err);
    return res.status(500).json({ error: 'Failed to fetch prescription' });
  }
});

// POST /prescriptions - create prescription (doctor only)
router.post('/', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'doctor') {
      return res.status(403).json({ error: 'Only doctors can create prescriptions' });
    }

    const { patientId, patientName, diagnosis, medicines, labTests, instructions, followUpDate, consultationFee } = req.body;
    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO prescriptions (
        id, patient_id, doctor_id, patient_name, doctor_name, doctor_specialization,
        diagnosis, medicines, lab_tests, instructions, follow_up_date, consultation_fee, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active')
      RETURNING *`,
      [
        id, patientId, user.id, patientName || null,
        user.full_name, user.specialization || 'General Physician',
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
      prescription: mapPrescription(result.rows[0]),
    });
  } catch (err) {
    console.error('Create prescription error:', err);
    return res.status(500).json({ error: 'Failed to create prescription' });
  }
});

function mapPrescription(row) {
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
    createdAt: row.created_at,
  };
}

module.exports = router;
