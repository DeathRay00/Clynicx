const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /auth/signup
router.post('/signup', async (req, res) => {
  try {
    const {
      email, password, fullName, phone, role,
      // Patient
      dateOfBirth, gender, bloodGroup,
      // Doctor
      medicalLicenseNumber, specialization,
      experience, consultationFee, hospital, qualifications,
    } = req.body;

    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ error: 'email, password, fullName and role are required' });
    }

    // Check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (
        email, password_hash, full_name, phone, role,
        date_of_birth, gender, blood_group,
        medical_license_number, specialization, experience,
        consultation_fee, hospital, qualifications
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING id, email, full_name, phone, role, specialization, created_at`,
      [
        email.toLowerCase(), passwordHash, fullName, phone || null, role,
        dateOfBirth || null, gender || null, bloodGroup || null,
        medicalLicenseNumber || null, specialization || null, experience || null,
        consultationFee || 500, hospital || null, qualifications || null,
      ]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'changeme',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(201).json({
      success: true,
      userId: user.id,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'changeme',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const u = req.user;
    return res.json({
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      phone: u.phone,
      role: u.role,
      dateOfBirth: u.date_of_birth,
      gender: u.gender,
      bloodGroup: u.blood_group,
      specialization: u.specialization,
      medicalLicenseNumber: u.medical_license_number,
      experience: u.experience,
      consultationFee: u.consultation_fee,
      hospital: u.hospital,
      qualifications: u.qualifications,
      availableSlots: u.available_slots,
      availableDays: u.available_days,
      createdAt: u.created_at,
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;
