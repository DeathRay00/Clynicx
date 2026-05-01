# Clynicx Backend (Node.js + Express + PostgreSQL)

This backend replaces the former Supabase Edge Functions with a standalone
Node.js + Express server backed by PostgreSQL.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ (running locally or on a server)

## Setup

### 1. Create the PostgreSQL database

```sql
CREATE DATABASE clynicx;
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your database credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=clynicx
DB_USER=postgres
DB_PASSWORD=your_postgres_password

JWT_SECRET=your_secret_key_change_this
JWT_EXPIRES_IN=7d

PORT=3001
FRONTEND_URL=http://localhost:5173
```

### 3. Run the database schema

```bash
npm run db:setup
```

This creates all required tables: `users`, `appointments`, `prescriptions`,
`medical_reports`, and `doctor_activity`.

### 4. Install dependencies

```bash
npm install
```

### 5. Start the server

**Development (with auto-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

The server runs on **http://localhost:3001** by default.

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /health | No | Health check |
| POST | /auth/signup | No | Register a new user |
| POST | /auth/login | No | Login, returns JWT |
| GET | /auth/profile | JWT | Get current user profile |
| GET | /doctors | No | List all doctors |
| GET | /doctors/:id | No | Get doctor by ID |
| GET | /appointments | JWT | List appointments |
| POST | /appointments | JWT | Book appointment (patient) |
| PUT | /appointments/:id | JWT | Update appointment (doctor) |
| DELETE | /appointments/:id | JWT | Cancel appointment (patient) |
| GET | /prescriptions | JWT | List prescriptions |
| POST | /prescriptions | JWT | Create prescription (doctor) |
| GET | /reports | JWT | List reports |
| POST | /reports | JWT | Upload report (patient) |
| GET | /patient/dashboard | JWT | Patient dashboard data |
| GET | /doctor/dashboard | JWT | Doctor dashboard data |
| GET | /doctor/patients | JWT | Doctor's patient list |
| GET | /doctor/patients/:id | JWT | Patient details (doctor) |
| POST | /doctor/patients/:id/prescriptions | JWT | Add prescription for patient |

## Authentication

Uses **JWT (JSON Web Tokens)**:
- Login → receive a JWT token
- Include in all authenticated requests as: `Authorization: Bearer <token>`
- Tokens expire after 7 days (configurable via `JWT_EXPIRES_IN`)
