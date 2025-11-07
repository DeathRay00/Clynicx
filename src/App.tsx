import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/auth/LoginForm';
import { SignupForm } from './components/auth/SignupForm';
import { PatientDashboard } from './components/dashboard/PatientDashboard';
import { DoctorDashboard } from './components/dashboard/DoctorDashboard';
import { AppointmentsPage } from './components/appointments/AppointmentsPage';
import { DoctorAppointmentsPage } from './components/appointments/DoctorAppointmentsPage';
import { PrescriptionsPage } from './components/prescriptions/PrescriptionsPage';
import { MedicalReportsPage } from './components/reports/MedicalReportsPage';
import { HealthTimelinePage } from './components/health/HealthTimelinePage';
import { PatientsPage } from './components/patients/PatientsPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { Toaster } from './components/ui/sonner';
import { DemoModeBanner } from './components/DemoModeBanner';

function AuthenticatedApp() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handlePageChange = (page: string) => {
    setCurrentPage(page);
    setSidebarOpen(false); // Close sidebar on mobile when navigating
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <div className="w-8 h-8 bg-primary/30 rounded-full"></div>
          </div>
          <p className="text-gray-600">Loading your health portal...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthFlow />;
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return user.role === 'doctor' ? <DoctorDashboard onPageChange={handlePageChange} /> : <PatientDashboard onPageChange={handlePageChange} />;
      case 'appointments':
        return user.role === 'doctor' ? <DoctorAppointmentsPage /> : <AppointmentsPage />;
      case 'prescriptions':
        return <PrescriptionsPage />;
      case 'reports':
        return <MedicalReportsPage />;
      case 'health-timeline':
        return <HealthTimelinePage />;
      case 'patients':
        return <PatientsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        // Placeholder for other pages
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {currentPage.charAt(0).toUpperCase() + currentPage.slice(1).replace('-', ' ')}
            </h2>
            <p className="text-gray-600 mb-6">This feature is coming soon!</p>
            <div className="w-32 h-32 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 bg-primary/30 rounded-full"></div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <Sidebar 
        currentPage={currentPage} 
        onPageChange={handlePageChange}
        isOpen={sidebarOpen}
      />
      
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar 
          onToggleSidebar={toggleSidebar} 
          sidebarOpen={sidebarOpen} 
          onPageChange={handlePageChange}
        />
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <DemoModeBanner />
            {renderCurrentPage()}
          </div>
        </main>
      </div>
    </div>
  );
}

function AuthFlow() {
  const [isLogin, setIsLogin] = useState(true);

  if (isLogin) {
    return <LoginForm 
      onSwitchToSignup={() => setIsLogin(false)} 
    />;
  } else {
    return <SignupForm 
      onSwitchToLogin={() => setIsLogin(true)} 
    />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
      <Toaster position="top-right" />
    </AuthProvider>
  );
}