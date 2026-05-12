-- ============================================================
-- Clynicx Main Database Schema
-- Creates all core application tables
-- ============================================================

-- ── users ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                 TEXT UNIQUE NOT NULL,
    password_hash         TEXT NOT NULL,
    role                  TEXT NOT NULL CHECK (role IN ('patient', 'doctor')),
    full_name             TEXT NOT NULL,
    phone                 TEXT,
    date_of_birth         DATE,
    gender                TEXT,
    blood_group           TEXT,
    -- Doctor-specific fields
    specialization        TEXT,
    medical_license_number TEXT,
    hospital_name         TEXT,
    years_of_experience   INT,
    consultation_fee      NUMERIC(10,2),
    bio                   TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

-- ── appointments ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_name           TEXT,
    patient_email          TEXT,
    patient_phone          TEXT,
    doctor_name            TEXT,
    doctor_specialization  TEXT,
    hospital_name          TEXT,
    appointment_date       DATE NOT NULL,
    appointment_time       TEXT,
    appointment_type       TEXT DEFAULT 'consultation',
    reason_for_visit       TEXT,
    status                 TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled')),
    consultation_fee       NUMERIC(10,2),
    notes                  TEXT,
    booked_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor  ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date    ON appointments(appointment_date);

-- ── prescriptions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescriptions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_name          TEXT,
    doctor_name           TEXT,
    doctor_specialization TEXT,
    diagnosis             TEXT,
    medicines             JSONB DEFAULT '[]',
    lab_tests             JSONB DEFAULT '[]',
    instructions          TEXT,
    follow_up_date        DATE,
    consultation_fee      NUMERIC(10,2),
    status                TEXT DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
    prescribed_date       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor  ON prescriptions(doctor_id);

-- ── medical_reports ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_reports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    patient_name TEXT,
    doctor_name  TEXT,
    report_type  TEXT,
    lab_name     TEXT,
    cost         TEXT,
    file_url     TEXT,
    ai_analysis  JSONB,
    upload_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_patient ON medical_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_reports_doctor  ON medical_reports(doctor_id);

-- ── doctor_activity ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctor_activity (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    patient_name TEXT,
    activity_type TEXT,
    report_type   TEXT,
    upload_date   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_activity_doctor ON doctor_activity(doctor_id);
