const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /doctors
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, full_name AS name, specialization, experience, rating,
              consultation_fee AS "consultationFee", hospital, phone, qualifications,
              available_slots AS "availableSlots", available_days AS "availableDays",
              created_at AS "createdAt", is_active AS "isActive"
       FROM users
       WHERE role = 'doctor' AND is_active = TRUE
       ORDER BY rating DESC NULLS LAST`
    );
    return res.json({ doctors: result.rows });
  } catch (err) {
    console.error('Error fetching doctors:', err);
    return res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

// GET /doctors/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, email, full_name AS name, specialization, experience, rating,
              consultation_fee AS "consultationFee", hospital, phone, qualifications,
              available_slots AS "availableSlots", available_days AS "availableDays",
              created_at AS "createdAt", is_active AS "isActive"
       FROM users
       WHERE id = $1 AND role = 'doctor'`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    return res.json({ doctor: result.rows[0] });
  } catch (err) {
    console.error('Error fetching doctor:', err);
    return res.status(500).json({ error: 'Failed to fetch doctor' });
  }
});

module.exports = router;
