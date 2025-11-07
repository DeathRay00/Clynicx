# API Configuration Guide

This directory contains centralized configuration for all API endpoints and constants used throughout the Clinic Management System.

## File Structure

```
/config
├── api.ts          # Central API configuration
└── README.md       # This file
```

## Overview

The `/config/api.ts` file provides:

1. **Centralized API Endpoints** - All backend routes in one place
2. **Helper Functions** - Standardized headers and request utilities
3. **Constants** - App-wide configuration values
4. **Feature Flags** - Easy enable/disable of features

## Usage

### Basic Import

```typescript
import { API_ENDPOINTS, getAuthHeaders, getAnonHeaders } from '../config/api';
```

### Making API Calls

#### Authenticated Requests

```typescript
// Example: Fetch patient dashboard
const { data: { session } } = await supabase.auth.getSession();

if (session?.access_token) {
  const response = await fetch(API_ENDPOINTS.DASHBOARD.PATIENT, {
    method: 'GET',
    headers: getAuthHeaders(session.access_token),
  });
  
  const data = await response.json();
}
```

#### Anonymous Requests

```typescript
// Example: Fetch doctors list (no auth required)
const response = await fetch(API_ENDPOINTS.DOCTORS.LIST, {
  method: 'GET',
  headers: getAnonHeaders(),
});

const data = await response.json();
```

#### POST Requests

```typescript
// Example: Create appointment
const response = await fetch(API_ENDPOINTS.APPOINTMENTS.BASE, {
  method: HTTP_METHODS.POST,
  headers: getAuthHeaders(accessToken),
  body: JSON.stringify({
    doctorId,
    appointmentDate,
    appointmentTime,
    reasonForVisit,
  }),
});
```

#### Dynamic Endpoints

```typescript
// Example: Get specific appointment by ID
const appointmentId = '123';
const response = await fetch(API_ENDPOINTS.APPOINTMENTS.BY_ID(appointmentId), {
  method: HTTP_METHODS.GET,
  headers: getAuthHeaders(accessToken),
});
```

## Available Endpoints

### Authentication
- `API_ENDPOINTS.AUTH.SIGNUP` - User registration
- `API_ENDPOINTS.AUTH.PROFILE` - Get user profile

### Doctors
- `API_ENDPOINTS.DOCTORS.LIST` - Get all doctors
- `API_ENDPOINTS.DOCTORS.BY_ID(id)` - Get specific doctor

### Dashboard
- `API_ENDPOINTS.DASHBOARD.PATIENT` - Patient dashboard data
- `API_ENDPOINTS.DASHBOARD.DOCTOR` - Doctor dashboard data

### Appointments
- `API_ENDPOINTS.APPOINTMENTS.BASE` - List/Create appointments
- `API_ENDPOINTS.APPOINTMENTS.BY_ID(id)` - Get/Update/Delete appointment
- `API_ENDPOINTS.APPOINTMENTS.PATIENT` - Patient appointments
- `API_ENDPOINTS.APPOINTMENTS.DOCTOR` - Doctor appointments

### Prescriptions
- `API_ENDPOINTS.PRESCRIPTIONS.BASE` - List/Create prescriptions
- `API_ENDPOINTS.PRESCRIPTIONS.BY_ID(id)` - Get/Update/Delete prescription
- `API_ENDPOINTS.PRESCRIPTIONS.PATIENT` - Patient prescriptions
- `API_ENDPOINTS.PRESCRIPTIONS.DOCTOR` - Doctor prescriptions

### Medical Reports
- `API_ENDPOINTS.REPORTS.BASE` - List/Create reports
- `API_ENDPOINTS.REPORTS.BY_ID(id)` - Get/Update/Delete report
- `API_ENDPOINTS.REPORTS.PATIENT` - Patient reports
- `API_ENDPOINTS.REPORTS.DOCTOR` - Doctor reports

### Initialization
- `API_ENDPOINTS.INIT.DOCTORS` - Initialize doctors data
- `API_ENDPOINTS.INIT.SAMPLE_DATA` - Initialize sample data
- `API_ENDPOINTS.INIT.TEST_PATIENT` - Create test patient

## Helper Functions

### getAuthHeaders(accessToken: string)
Returns headers with Bearer token authentication and JSON content type.

```typescript
{
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
}
```

### getAnonHeaders()
Returns headers with anonymous key and JSON content type (for public endpoints).

```typescript
{
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
}
```

## Constants

### HTTP Methods
```typescript
HTTP_METHODS.GET
HTTP_METHODS.POST
HTTP_METHODS.PUT
HTTP_METHODS.DELETE
HTTP_METHODS.PATCH
```

### HTTP Status Codes
```typescript
HTTP_STATUS.OK                      // 200
HTTP_STATUS.CREATED                 // 201
HTTP_STATUS.NO_CONTENT              // 204
HTTP_STATUS.BAD_REQUEST             // 400
HTTP_STATUS.UNAUTHORIZED            // 401
HTTP_STATUS.FORBIDDEN               // 403
HTTP_STATUS.NOT_FOUND               // 404
HTTP_STATUS.INTERNAL_SERVER_ERROR   // 500
```

### App Constants
```typescript
APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN
APP_CONSTANTS.STORAGE_KEYS.USER_PREFERENCES
APP_CONSTANTS.DEBOUNCE_DELAY         // 300ms
APP_CONSTANTS.TOAST_DURATION         // 3000ms
APP_CONSTANTS.SESSION_TIMEOUT        // 3600000ms (1 hour)
```

## Feature Flags

Control which features are enabled/disabled:

```typescript
FEATURES.AI_REPORTS_ANALYSIS        // true
FEATURES.TELEMEDICINE               // true
FEATURES.PRESCRIPTION_REMINDERS     // true
FEATURES.HEALTH_TIMELINE            // true
```

Use in components:
```typescript
import { FEATURES } from '../config/api';

{FEATURES.AI_REPORTS_ANALYSIS && (
  <AIAnalysisButton />
)}
```

## Files Updated

The following files have been updated to use the centralized API configuration:

### Components
- ✅ `/components/auth/LoginForm.tsx`
- ✅ `/components/dashboard/PatientDashboard.tsx`
- ✅ `/components/dashboard/DoctorDashboard.tsx`
- ✅ `/components/appointments/AppointmentBooking.tsx`
- ✅ `/components/appointments/AppointmentsPage.tsx`

### Contexts
- ✅ `/contexts/AuthContext.tsx`

## Benefits

### 1. **Single Source of Truth**
All API endpoints defined in one location, making updates easier.

### 2. **Type Safety**
TypeScript support for endpoint URLs and parameters.

### 3. **Consistency**
Standardized header creation across the application.

### 4. **Easy Maintenance**
Change base URL or add new endpoints in one place.

### 5. **Better Developer Experience**
Autocomplete and inline documentation for all endpoints.

### 6. **Feature Toggling**
Quickly enable/disable features without code changes.

## Adding New Endpoints

To add a new endpoint:

1. Open `/config/api.ts`
2. Add to the `API_ENDPOINTS` object:

```typescript
export const API_ENDPOINTS = {
  // ... existing endpoints
  
  // New feature
  MY_FEATURE: {
    BASE: `${API_BASE_URL}/my-feature`,
    BY_ID: (id: string) => `${API_BASE_URL}/my-feature/${id}`,
    CUSTOM_ACTION: `${API_BASE_URL}/my-feature/custom`,
  },
};
```

3. Import and use in your component:

```typescript
import { API_ENDPOINTS } from '../config/api';

const response = await fetch(API_ENDPOINTS.MY_FEATURE.BASE);
```

## Environment Variables

The configuration automatically reads from Supabase info:

- **Project ID**: Imported from `utils/supabase/info`
- **Anon Key**: Imported from `utils/supabase/info`
- **Base URL**: Constructed automatically

## Best Practices

1. **Always use the centralized endpoints** - Don't hardcode URLs in components
2. **Use helper functions for headers** - Don't manually create header objects
3. **Check authentication** - Ensure user has valid session before making authenticated requests
4. **Handle errors** - Always wrap API calls in try-catch blocks
5. **Use HTTP_METHODS constants** - Avoid string literals for methods
6. **Log errors properly** - Include context in error messages

## Example: Complete API Call

```typescript
import { API_ENDPOINTS, getAuthHeaders, HTTP_METHODS, HTTP_STATUS } from '../config/api';
import { supabase } from '../utils/supabase/client';
import { toast } from 'sonner@2.0.3';

const fetchData = async () => {
  try {
    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      toast.error('Authentication required');
      return;
    }

    // Make API call
    const response = await fetch(API_ENDPOINTS.DASHBOARD.PATIENT, {
      method: HTTP_METHODS.GET,
      headers: getAuthHeaders(session.access_token),
    });

    // Handle response
    if (response.status === HTTP_STATUS.OK) {
      const data = await response.json();
      console.log('Data fetched successfully:', data);
      return data;
    } else {
      const error = await response.json();
      console.error('API error:', error);
      toast.error(error.message || 'Failed to fetch data');
    }
  } catch (error) {
    console.error('Network error while fetching data:', error);
    toast.error('Network error occurred');
  }
};
```

## Troubleshooting

### "Failed to fetch" errors
- Check if the server is running
- Verify authentication token is valid
- Check network connectivity
- Ensure CORS is configured properly

### "Unauthorized" errors
- Verify access token is being passed correctly
- Check if session has expired
- Ensure user has necessary permissions

### Endpoint not found (404)
- Verify endpoint path is correct
- Check if server route is implemented
- Ensure base path includes `/make-server-53ddc61c`

## Related Documentation

- Backend Server: `/supabase/functions/server/index.tsx`
- Authentication: `/contexts/AuthContext.tsx`
- Supabase Client: `/utils/supabase/client.ts`

---

**Last Updated**: January 2025  
**Maintainer**: Clinic Management System Team
