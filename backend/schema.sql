-- Clynicx PostgreSQL Schema
-- Run this SQL in your PostgreSQL database to create all required tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- USERS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'doctor')),
  -- Patient fields
  date_of_birth DATE,
  gender VARCHAR(20),
  blood_group VARCHAR(10),
  -- Doctor fields
  medical_license_number VARCHAR(100),
  specialization VARCHAR(100),
  experience VARCHAR(100),
  rating DECIMAL(3, 2) DEFAULT 4.5,
  consultation_fee INTEGER DEFAULT 500,
  hospital VARCHAR(255),
  qualifications VARCHAR(255),
  available_slots JSONB DEFAULT '["09:00","10:00","11:00","14:00","15:00","16:00"]',
  available_days JSONB DEFAULT '["Monday","Tuesday","Wednesday","Thursday","Friday"]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- APPOINTMENTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_name VARCHAR(255),
  patient_email VARCHAR(255),
  patient_phone VARCHAR(50),
  doctor_name VARCHAR(255),
  doctor_specialization VARCHAR(100),
  hospital_name VARCHAR(255),
  appointment_date DATE NOT NULL,
  appointment_time VARCHAR(10) NOT NULL,
  appointment_type VARCHAR(20) DEFAULT 'in-person' CHECK (appointment_type IN ('in-person', 'telemedicine')),
  reason_for_visit TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  consultation_fee INTEGER,
  notes TEXT,
  booked_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  cancelled_by VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE
);

-- =====================
-- PRESCRIPTIONS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_name VARCHAR(255),
  doctor_name VARCHAR(255),
  doctor_specialization VARCHAR(100),
  diagnosis TEXT,
  medicines JSONB DEFAULT '[]',
  lab_tests JSONB DEFAULT '[]',
  instructions TEXT,
  follow_up_date DATE,
  consultation_fee VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  prescribed_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- MEDICAL REPORTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS medical_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  patient_name VARCHAR(255),
  doctor_name VARCHAR(255),
  report_type VARCHAR(100),
  lab_name VARCHAR(255),
  cost VARCHAR(50),
  file_url TEXT,
  ai_analysis JSONB,
  upload_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- DOCTOR ACTIVITY TABLE (for doctor dashboard)
-- =====================
CREATE TABLE IF NOT EXISTS doctor_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL,
  patient_name VARCHAR(255),
  activity_type VARCHAR(50) DEFAULT 'report_upload',
  report_type VARCHAR(100),
  appointment_date DATE,
  appointment_time VARCHAR(10),
  upload_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- INDEXES
-- =====================
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_reports_patient ON medical_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_reports_doctor ON medical_reports(doctor_id);
CREATE INDEX IF NOT EXISTS idx_activity_doctor ON doctor_activity(doctor_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
