# Clynicx

Clynicx is a modern healthcare management system built with React, TypeScript, and Vite. It provides a comprehensive platform for managing medical appointments, patient records, prescriptions, and medical reports.

## Features

- 🏥 **Appointment Management**
  - Book and manage appointments
  - Doctor's appointment dashboard
  - Patient appointment tracking

- 👨‍⚕️ **User Roles**
  - Doctor dashboard
  - Patient dashboard
  - Role-based access control

- 📊 **Health Timeline**
  - Track patient health history
  - Visualize medical progress
  - Timeline-based health records

- 📝 **Medical Records**
  - Prescription management
  - Medical reports storage
  - Digital health documentation

- ⚡ **Modern Tech Stack**
  - Built with React + TypeScript
  - Vite for fast development
  - Supabase backend integration
  - Shadcn UI components

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/DeathRay00/Clynicx.git
cd Clynicx
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Start the development server:
```bash
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:5173`

## Project Structure

```
src/
├── components/         # React components
│   ├── appointments/  # Appointment related components
│   ├── auth/         # Authentication components
│   ├── dashboard/    # Dashboard components
│   ├── health/       # Health timeline components
│   ├── layout/       # Layout components
│   ├── patients/     # Patient management
│   ├── prescriptions/# Prescription components
│   └── ui/          # Reusable UI components
├── config/           # Configuration files
├── contexts/         # React contexts
├── styles/          # Global styles
├── utils/           # Utility functions
└── supabase/        # Supabase integration
```

## Key Features

### Appointment Management
- Easy appointment scheduling
- Real-time availability checking
- Appointment history tracking
- Automated notifications

### Health Timeline
- Chronological health record tracking
- Important medical event markers
- Visual health progress representation

### Medical Reports
- Secure report storage
- Easy access to past reports
- Digital report management

### Prescriptions
- Digital prescription creation
- Prescription history
- Medication tracking

## Built With

- [React](https://reactjs.org/) - Frontend framework
- [TypeScript](https://www.typescriptlang.org/) - Programming language
- [Vite](https://vitejs.dev/) - Build tool
- [Supabase](https://supabase.io/) - Backend as a Service
- [Shadcn UI](https://ui.shadcn.com/) - UI Component library

## Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.