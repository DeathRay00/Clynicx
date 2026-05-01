/**
 * API Configuration
 * Central location for all API endpoints and configuration
 * Backend: Node.js + Express + PostgreSQL  (localhost:3001)
 */

// Base API URL - points to your local Node.js/Express + PostgreSQL backend
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// API Endpoints
export const API_ENDPOINTS = {
  // Health Check
  HEALTH: `${API_BASE_URL}/health`,

  // Authentication
  AUTH: {
    SIGNUP: `${API_BASE_URL}/auth/signup`,
    LOGIN: `${API_BASE_URL}/auth/login`,
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

  // AI Report Analysis (proxied through backend — Gemini key stays server-side)
  ANALYZE: `${API_BASE_URL}/analyze`,

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

// For unauthenticated requests (signup, etc.)
export const getAnonHeaders = () => ({
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

// AI Services Configuration — key is now on the backend only
// This object is kept for backward compatibility but the key is no longer used client-side.
export const AI_CONFIG = {
  GEMINI_MODEL: 'gemini-2.0-flash',
};

export default API_ENDPOINTS;
