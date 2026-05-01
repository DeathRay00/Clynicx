require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const doctorRoutes = require('./routes/doctors');
const appointmentRoutes = require('./routes/appointments');
const prescriptionRoutes = require('./routes/prescriptions');
const reportRoutes = require('./routes/reports');
const analyzeRoutes = require('./routes/analyze');
const patientDashboardRoutes = require('./routes/dashboard');  // patient-specific routes
const doctorRoutes2 = require('./routes/patients');            // doctor-specific routes

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true, limit: '70mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRoutes);
app.use('/doctors', doctorRoutes);
app.use('/appointments', appointmentRoutes);
app.use('/prescriptions', prescriptionRoutes);
app.use('/reports', reportRoutes);
app.use('/analyze', analyzeRoutes);
app.use('/patient', patientDashboardRoutes);  // /patient/dashboard, /patient/appointments, etc.
app.use('/doctor', doctorRoutes2);             // /doctor/dashboard, /doctor/patients, etc.

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.url}` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Clynicx backend running on http://localhost:${PORT}`);
  console.log(`📋 API Endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   POST /auth/signup`);
  console.log(`   POST /auth/login`);
  console.log(`   GET  /auth/profile`);
  console.log(`   GET  /doctors`);
  console.log(`   GET  /appointments`);
  console.log(`   POST /appointments`);
  console.log(`   GET  /prescriptions`);
  console.log(`   GET  /reports`);
  console.log(`   GET  /patient/dashboard`);
  console.log(`   GET  /doctor/dashboard\n`);
});

module.exports = app;
