import React, { useState } from 'react';
import { 
  Home, 
  Calendar, 
  FileText, 
  Pill, 
  TrendingUp, 
  Users, 
  Settings,
  Stethoscope,
  UserCircle,
  LogOut
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner@2.0.3';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  isOpen: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange, isOpen }) => {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    const loadingToast = toast.loading('Signing out...');
    
    try {
      await logout();
      toast.dismiss(loadingToast);
      toast.success('Successfully signed out', { duration: 3000 });
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to sign out', { duration: 3000 });
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const patientMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
    { id: 'reports', label: 'Medical Reports', icon: FileText },
    { id: 'health-timeline', label: 'Health Timeline', icon: TrendingUp },
  ];

  const doctorMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
  ];

  const menuItems = user?.role === 'doctor' ? doctorMenuItems : patientMenuItems;

  return (
    <aside className={cn(
      "glass-sidebar border-r border-white/20 transition-all duration-300 ease-in-out",
      "fixed inset-y-0 left-0 z-40 w-64",
      "lg:relative lg:translate-x-0",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="flex flex-col h-full pt-4">
        {/* User Info */}
        <div className="px-4 pb-4 border-b border-white/20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
              {user?.role === 'doctor' ? (
                <Stethoscope className="w-5 h-5 text-primary" />
              ) : (
                <UserCircle className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{user?.fullName}</p>
              <p className="text-xs text-gray-600 capitalize">{user?.role}</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-6">
          <div className="space-y-2">
            {menuItems.map((item) => (
              <Button
                key={item.id}
                variant={currentPage === item.id ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start space-x-3 h-10",
                  currentPage === item.id 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-white/20 text-gray-700"
                )}
                onClick={() => onPageChange(item.id)}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Button>
            ))}
          </div>
        </nav>

        {/* Bottom Section */}
        <div className="px-4 py-4 border-t border-white/20 space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start space-x-3 h-10 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut className="w-5 h-5" />
            <span>{isLoggingOut ? 'Signing out...' : 'Sign out'}</span>
          </Button>
          <Button
            variant={currentPage === 'settings' ? "default" : "ghost"}
            className={cn(
              "w-full justify-start space-x-3 h-10",
              currentPage === 'settings' 
                ? "bg-primary text-primary-foreground" 
                : "hover:bg-white/20 text-gray-700"
            )}
            onClick={() => onPageChange('settings')}
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </Button>
        </div>
      </div>
    </aside>
  );
};