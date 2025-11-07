# Patients Page - Doctor Portal

## 📱 Component Overview

The **PatientsPage** component provides comprehensive patient management functionality for doctors.

## 🎯 Features

### 1. Patient List View
- **Grid Layout**: Responsive grid showing patient cards
- **Search**: Real-time search by name, email, or phone
- **Patient Cards** display:
  - Avatar with initials
  - Name, age, gender
  - Blood group badge
  - Contact information (phone, email)
  - Last visit date
  - Statistics (appointments, prescriptions, reports)

### 2. Patient Details Dialog
Opens when clicking any patient card, showing:

#### **Patient Information Card**
- Full name, age, gender
- Blood group
- Date of birth
- Phone and email

#### **Statistics Cards (3 cards)**
- Total appointments with this doctor
- Total prescriptions from this doctor
- Total medical reports

#### **Tabbed Content**

**Tab 1: Prescriptions**
- List of all prescriptions from this doctor
- "Add Prescription" button
- Each prescription shows:
  - Diagnosis
  - Date prescribed
  - Status badge (active/completed)
  - Medicines with dosage, frequency, duration, timing
  - Lab tests (if any)
  - General instructions
  - Follow-up date (if set)

**Tab 2: Reports**
- List of all medical reports
- Each report shows:
  - Report type (Blood Test, X-Ray, MRI, etc.)
  - Lab name
  - Upload date
  - Cost
  - AI Analysis (if available)
    - Summary
    - Key findings

**Tab 3: Appointments**
- List of all appointments with this doctor
- Each appointment shows:
  - Date and time
  - Appointment type (In-Person, Video, Phone)
  - Reason for visit
  - Status badge (completed, confirmed, cancelled)

### 3. Add Prescription Dialog

Comprehensive form for creating prescriptions:

#### **Diagnosis Section**
- Textarea for diagnosis (required)

#### **Medicines Section**
- Dynamic form - can add/remove multiple medicines
- Each medicine has:
  - **Name**: Text input (e.g., "Paracetamol")
  - **Dosage**: Text input (e.g., "500mg")
  - **Frequency**: Dropdown
    - 1x daily
    - 2x daily
    - 3x daily
    - 4x daily
    - As needed
  - **Duration**: Text input (e.g., "7 days")
  - **Timing**: Dropdown
    - Before food
    - After food
    - With food
    - Empty stomach
    - Anytime
  - **Instructions**: Text input (optional, e.g., "Take with water")
- **Add Medicine** button to add more medicines
- **Remove** (X) button on each medicine card

#### **Lab Tests Section**
- Textarea for lab tests (optional)
- One test per line
- Example:
  ```
  Complete Blood Count (CBC)
  Lipid Profile
  Liver Function Test
  ```

#### **General Instructions Section**
- Textarea for general instructions (optional)
- Example: "Avoid spicy food. Drink plenty of water."

#### **Follow-up Date Section**
- Date picker (optional)
- Minimum date: Today

#### **Action Buttons**
- **Cancel**: Close dialog without saving
- **Add Prescription**: Submit form
  - Shows loading spinner during submission
  - Validates required fields
  - Shows success/error toast

## 🎨 UI/UX Details

### **Color Coding**
- **Primary Blue** (#3B82F6): Appointments, primary buttons
- **Green** (#10B981): Prescriptions, success states
- **Blue** (#3B82F6): Reports
- **Red** (#EF4444): Cancelled status, errors

### **Status Badges**
- **Active**: Blue background (prescriptions)
- **Completed**: Green background (appointments/prescriptions)
- **Confirmed**: Gray background (appointments)
- **Cancelled**: Red background (appointments)

### **Empty States**
When data is not available, friendly empty states are shown:
- "No patients yet" with helpful message
- "No prescriptions yet" in prescriptions tab
- "No medical reports" in reports tab
- "No appointments" in appointments tab

### **Loading States**
- Full page loader when fetching patients list
- Dialog loader when fetching patient details
- Button spinner when submitting prescription
- Disabled buttons during loading

### **Responsive Design**

**Mobile (< 768px)**
```
┌─────────────────┐
│   Patient 1     │
├─────────────────┤
│   Patient 2     │
├─────────────────┤
│   Patient 3     │
└─────────────────┘
Single column
```

**Tablet (768px - 1024px)**
```
┌──────────┬──────────┐
│Patient 1 │Patient 2 │
├──────────┼──────────┤
│Patient 3 │Patient 4 │
└──────────┴──────────┘
Two columns
```

**Desktop (> 1024px)**
```
┌────────┬────────┬────────┐
│Patient1│Patient2│Patient3│
├────────┼────────┼────────┤
│Patient4│Patient5│Patient6│
└────────┴────────┴────────┘
Three columns
```

## 🔄 User Flow Examples

### **Scenario 1: Doctor Views Patient List**
```
1. Doctor logs in
2. Clicks "Patients" in sidebar
3. Sees grid of patient cards
4. Can search for specific patient
5. Clicks filter button (future feature)
```

### **Scenario 2: Doctor Views Patient Details**
```
1. Doctor clicks patient card
2. Dialog opens with patient info
3. Views statistics at top
4. Switches to Prescriptions tab
5. Sees all prescriptions given to this patient
6. Switches to Reports tab
7. Reviews medical reports with AI analysis
8. Switches to Appointments tab
9. Checks appointment history
```

### **Scenario 3: Doctor Adds Prescription**
```
1. Doctor opens patient details
2. Goes to Prescriptions tab
3. Clicks "Add Prescription"
4. Enters diagnosis: "Hypertension"
5. Adds first medicine:
   - Name: Amlodipine
   - Dosage: 5mg
   - Frequency: 1x daily
   - Duration: 30 days
   - Timing: After food
6. Clicks "Add Medicine"
7. Adds second medicine:
   - Name: Aspirin
   - Dosage: 75mg
   - Frequency: 1x daily
   - Duration: 30 days
   - Timing: After food
8. Adds lab tests (one per line):
   - Blood Pressure Monitoring
   - Lipid Profile
9. Adds instructions:
   - "Monitor blood pressure daily"
   - "Reduce salt intake"
   - "Exercise 30 mins daily"
10. Sets follow-up date: 30 days from now
11. Clicks "Add Prescription"
12. Sees success message
13. Dialog closes
14. Patient details refresh
15. New prescription appears in list
```

## 📊 Data Display Examples

### **Patient Card Example**
```
┌─────────────────────────────────┐
│ 👤 AS                           │
│                                 │
│ Arjun Sharma                    │
│ Male • 35 years                 │
│ [O+ Blood Group]                │
│                                 │
│ 📞 +91 98765 43210              │
│ 📧 arjun@example.com            │
│ 📅 Last visit: 10 Jan, 2025     │
│                                 │
│ ──────────────────────────────  │
│  5            3           2     │
│ Appts      Prescrip   Reports   │
└─────────────────────────────────┘
```

### **Prescription Display Example**
```
┌─────────────────────────────────┐
│ Hypertension          [Active]  │
│ 10 Jan, 2025                    │
│                                 │
│ Medicines:                      │
│ ┌─────────────────────────────┐ │
│ │ Amlodipine - 5mg            │ │
│ │ 1x daily • 30 days          │ ���
│ │ After food                  │ │
│ └─────────────────────────────┘ │
│                                 │
│ Lab Tests:                      │
│ • Blood Pressure Monitoring     │
│ • Lipid Profile                 │
│                                 │
│ Instructions:                   │
│ Monitor blood pressure daily.   │
│ Reduce salt intake.             │
│                                 │
│ Follow-up: 10 Feb, 2025         │
└─────────────────────────────────┘
```

## 🔧 Technical Details

### **Component Props**
```typescript
// None - uses useAuth hook for user context
```

### **State Variables**
```typescript
patients: Patient[]                    // List of patients
loading: boolean                       // Page loading state
searchTerm: string                     // Search input
selectedPatient: PatientDetails | null // Currently viewed patient
showDetailsDialog: boolean             // Patient details dialog
showAddPrescriptionDialog: boolean     // Add prescription dialog
loadingDetails: boolean                // Patient details loading
submittingPrescription: boolean        // Prescription submission
diagnosis: string                      // Prescription form field
medicines: Medicine[]                  // Prescription form field
labTests: string                       // Prescription form field
instructions: string                   // Prescription form field
followUpDate: string                   // Prescription form field
```

### **API Calls**
```typescript
// 1. Fetch patients list
GET /doctor/patients

// 2. Fetch patient details
GET /doctor/patients/:patientId

// 3. Add prescription
POST /doctor/patients/:patientId/prescriptions
```

### **Utility Functions**
```typescript
getInitials(name: string)              // Get initials from name
formatDate(dateString: string)         // Format date to "DD MMM, YYYY"
calculateAge(dateOfBirth: string)      // Calculate age from DOB
```

## 🎨 Styling

### **Glass Morphism Cards**
```css
.glass-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
}
```

### **Hover Effects**
- Cards: `hover:shadow-lg transition-all`
- Patient cards are clickable with cursor-pointer
- Smooth transitions on all interactive elements

## 🔐 Access Control

- **Route Protection**: Only accessible to doctors
- **Data Filtering**: Doctors only see their own patients
- **Patient Relationship**: Established through appointments
- **Authentication**: Required for all API calls

## 📝 Validation Rules

### **Add Prescription Form**
- **Diagnosis**: Required, minimum 1 character
- **Medicines**: At least 1 medicine required
  - Name: Required
  - Dosage: Required
  - Other fields: Optional but recommended
- **Lab Tests**: Optional
- **Instructions**: Optional
- **Follow-up Date**: Optional, must be today or future

### **Search**
- Case-insensitive
- Searches in: name, email, phone
- Real-time filtering (no submit button)

## 🐛 Error Handling

All errors are handled gracefully:
- Network errors: Toast notification
- API errors: Toast with error message
- Validation errors: Inline messages
- Loading failures: Retry option
- Empty states: Helpful messages

## 📱 Accessibility

- Semantic HTML elements
- Proper ARIA labels (via ShadCN components)
- Keyboard navigation support
- Focus management in dialogs
- Clear visual feedback for actions
- Readable font sizes
- Sufficient color contrast

## 🚀 Performance

- Lazy loading: Patient details fetched only when needed
- Efficient filtering: Client-side search on pre-fetched data
- Optimistic updates: UI updates immediately
- Minimal re-renders: Proper React hooks usage
- Debounced search: Can be added if needed

---

**Component Location:** `/components/patients/PatientsPage.tsx`  
**Lines of Code:** ~890 lines  
**Dependencies:** React, Supabase, ShadCN UI, Lucide Icons, Sonner
