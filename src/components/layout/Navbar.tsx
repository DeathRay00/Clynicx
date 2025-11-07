import React, { useState } from 'react';
import { Bell, Settings, LogOut, User, Heart, Menu, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Badge } from '../ui/badge';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner@2.0.3';

interface NavbarProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onPageChange?: (page: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, sidebarOpen, onPageChange }) => {
  const { user, logout } = useAuth();
  const [notifications] = useState(3); // Mock notification count
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  };

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

  const handleSettingsClick = () => {
    if (onPageChange) {
      onPageChange('settings');
    }
  };

  return (
    <nav className="glass-sidebar border-b border-white/20 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
      {/* Left section */}
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="lg:hidden hover:bg-white/20"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
        
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
            <Heart className="w-5 h-5 text-primary" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-bold text-gray-900">Swasthya Portal</h1>
            <p className="text-xs text-gray-600">{user?.role === 'doctor' ? 'Medical Practice' : 'Patient Portal'}</p>
          </div>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center space-x-4">
        {/* Notifications */}


        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center space-x-2 hover:bg-white/20 transition-all duration-200 hover:scale-105">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {getInitials(user?.fullName || '')}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
                <p className="text-xs text-gray-600 capitalize">{user?.role}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-64 glass-card border-white/30 shadow-xl">
            <div className="px-3 py-3 bg-gradient-to-r from-primary/5 to-primary/10 rounded-t-lg">
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/20 text-primary font-medium">
                    {getInitials(user?.fullName || '')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{user?.fullName}</p>
                  <p className="text-xs text-gray-600 truncate">{user?.email}</p>
                  <Badge variant="secondary" className="mt-1 text-xs capitalize bg-primary/10 text-primary">
                    {user?.role}
                  </Badge>
                </div>
              </div>
            </div>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem className="flex items-center space-x-3 cursor-pointer py-2 px-3 hover:bg-primary/5">
              <User className="w-4 h-4 text-gray-600" />
              <span className="text-sm">View Profile</span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem 
              className="flex items-center space-x-3 text-red-600 focus:text-red-600 cursor-pointer py-2 px-3 hover:bg-red-50 focus:bg-red-50"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">{isLoggingOut ? 'Signing out...' : 'Sign out'}</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              className="flex items-center space-x-3 cursor-pointer py-2 px-3 hover:bg-primary/5"
              onClick={handleSettingsClick}
            >
              <Settings className="w-4 h-4 text-gray-600" />
              <span className="text-sm">Settings</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
};