/**
 * API Configuration
 * Central location for all API endpoints and configuration
 */

import { projectId, publicAnonKey } from '../utils/supabase/info';

// Base URLs
export const SUPABASE_URL = `https://${projectId}.supabase.co`;
export const SUPABASE_ANON_KEY = publicAnonKey;

// Server base path
const SERVER_BASE = '/functions/v1/make-server-53ddc61c';

// Full API base URL
export const API_BASE_URL = `${SUPABASE_URL}${SERVER_BASE}`;

// API Endpoints
export const API_ENDPOINTS = {
  // Health Check
  HEALTH: `${API_BASE_URL}/health`,

  // Authentication
  AUTH: {
    SIGNUP: `${API_BASE_URL}/auth/signup`,
    PROFILE: `${API_BASE_URL}/auth/profile`,
  },

  // Doctors
  DOCTORS: {
    LIST: `${API_BASE_URL}/doctors`,
    BY_ID: (id: string) => `${API_BASE_URL}/doctors/${id}`,
  },

  // Dashboard
  DASHBOARD: {
    PATIENT: `${API_BASE_URL}/patient/dashboard`,
    DOCTOR: `${API_BASE_URL}/doctor/dashboard`,
  },

  // Appointments
  APPOINTMENTS: {
    BASE: `${API_BASE_URL}/appointments`,
    BY_ID: (id: string) => `${API_BASE_URL}/appointments/${id}`,
    PATIENT: `${API_BASE_URL}/patient/appointments`,
    DOCTOR: `${API_BASE_URL}/doctor/appointments`,
  },

  // Prescriptions
  PRESCRIPTIONS: {
    BASE: `${API_BASE_URL}/prescriptions`,
    BY_ID: (id: string) => `${API_BASE_URL}/prescriptions/${id}`,
    PATIENT: `${API_BASE_URL}/patient/prescriptions`,
    DOCTOR: `${API_BASE_URL}/doctor/prescriptions`,
    CREATE: `${API_BASE_URL}/prescriptions`,
  },

  // Medical Reports
  REPORTS: {
    BASE: `${API_BASE_URL}/reports`,
    BY_ID: (id: string) => `${API_BASE_URL}/reports/${id}`,
    PATIENT: `${API_BASE_URL}/patient/reports`,
    DOCTOR: `${API_BASE_URL}/doctor/reports`,
  },

  // Patients (Doctor-side)
  PATIENTS: {
    LIST: `${API_BASE_URL}/doctor/patients`,
    BY_ID: (id: string) => `${API_BASE_URL}/doctor/patients/${id}`,
    ADD_PRESCRIPTION: (id: string) => `${API_BASE_URL}/doctor/patients/${id}/prescriptions`,
  },

  // Initialization & Testing
  INIT: {
    TEST_PATIENT: `${API_BASE_URL}/create-test-patient`,
    DOCTORS: `${API_BASE_URL}/init-doctors`,
    SAMPLE_DATA: `${API_BASE_URL}/init-sample-data`,
  },
};

// Request Headers Helper
export const getAuthHeaders = (accessToken: string) => ({
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
});

export const getAnonHeaders = () => ({
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
});

// HTTP Methods
export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
} as const;

// Response Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// App Constants
export const APP_CONSTANTS = {
  STORAGE_KEYS: {
    AUTH_TOKEN: 'healthcare-portal-auth',
    USER_PREFERENCES: 'healthcare-portal-preferences',
  },
  DEBOUNCE_DELAY: 300,
  TOAST_DURATION: 3000,
  SESSION_TIMEOUT: 3600000, // 1 hour in ms
};

// Feature Flags (for enabling/disabling features)
export const FEATURES = {
  AI_REPORTS_ANALYSIS: true,
  TELEMEDICINE: true,
  PRESCRIPTION_REMINDERS: true,
  HEALTH_TIMELINE: true,
};

// AI Services Configuration
export const AI_CONFIG = {
  GEMINI_API_KEY: 'AIzaSyAhUfOHxm21jewDSGD1_34H0T77t7E-HAA',
  GEMINI_MODEL: 'gemini-2.0-flash',
  GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
};

export default API_ENDPOINTS;
