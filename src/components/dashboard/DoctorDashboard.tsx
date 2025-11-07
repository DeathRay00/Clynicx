import React, { useState, useEffect } from 'react';
import { Calendar, Users, FileText, Clock, User, Activity, Stethoscope, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabase/client';
import { API_ENDPOINTS, getAuthHeaders, HTTP_METHODS } from '../../config/api';

interface DoctorDashboardData {
  todayAppointments: any[];
  recentActivity: any[];
  upcomingAppointments: any[];
  totalAppointments: number;
  completedToday: number;
  pendingToday: number;
  totalPatients: number;
  totalAppointmentsAllTime: number;
  totalPrescriptions: number;
  totalReports: number;
  thisWeekAppointments: number;
  thisWeekCompleted: number;
}

interface DoctorDashboardProps {
  onPageChange?: (page: string) => void;
}

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ onPageChange }) => {
  const [dashboardData, setDashboardData] = useState<DoctorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    initSampleData();
  }, []);

  const initSampleData = async () => {
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.access_token) {
        // Initialize sample data first
        await fetch(API_ENDPOINTS.INIT.SAMPLE_DATA, {
          method: HTTP_METHODS.POST,
          headers: getAuthHeaders(session.access_token),
        });
      }
      
      // Then fetch dashboard data
      await fetchDashboardData();
    } catch (error) {
      console.error('Error initializing sample data:', error);
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.access_token) {
        const response = await fetch(API_ENDPOINTS.DASHBOARD.DOCTOR, {
          method: HTTP_METHODS.GET,
          headers: getAuthHeaders(session.access_token),
        });

        if (response.ok) {
          const data = await response.json();
          setDashboardData(data);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-500';
      case 'pending': return 'bg-yellow-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="glass-card">
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 fade-in">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Good day, Dr. {user?.fullName}</h1>
          <p className="text-gray-600 mt-1">Here's your practice overview for today</p>
        </div>
        <div className="flex items-center space-x-2 text-primary">
          <Stethoscope className="w-6 h-6" />
          <span className="font-medium">Swasthya Medical Practice</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="glass-card slide-up">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Appointments</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData?.totalAppointments || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card slide-up" style={{ animationDelay: '0.1s' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed Today</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData?.completedToday || 0}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card slide-up" style={{ animationDelay: '0.2s' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Today</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData?.pendingToday || 0}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card slide-up" style={{ animationDelay: '0.3s' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Patients</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData?.totalPatients || 0}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="glass-card p-3">
          <div className="text-center">
            <p className="text-xs text-gray-600">All-Time Appointments</p>
            <p className="text-lg font-bold text-blue-600">{dashboardData?.totalAppointmentsAllTime || 0}</p>
          </div>
        </Card>
        <Card className="glass-card p-3">
          <div className="text-center">
            <p className="text-xs text-gray-600">Total Prescriptions</p>
            <p className="text-lg font-bold text-green-600">{dashboardData?.totalPrescriptions || 0}</p>
          </div>
        </Card>
        <Card className="glass-card p-3">
          <div className="text-center">
            <p className="text-xs text-gray-600">Patient Reports</p>
            <p className="text-lg font-bold text-purple-600">{dashboardData?.totalReports || 0}</p>
          </div>
        </Card>
        <Card className="glass-card p-3">
          <div className="text-center">
            <p className="text-xs text-gray-600">This Week</p>
            <p className="text-lg font-bold text-orange-600">{dashboardData?.thisWeekAppointments || 0}</p>
          </div>
        </Card>
        <Card className="glass-card p-3">
          <div className="text-center">
            <p className="text-xs text-gray-600">Week Completed</p>
            <p className="text-lg font-bold text-emerald-600">{dashboardData?.thisWeekCompleted || 0}</p>
          </div>
        </Card>
        <Card className="glass-card p-3">
          <div className="text-center">
            <p className="text-xs text-gray-600">Success Rate</p>
            <p className="text-lg font-bold text-indigo-600">
              {dashboardData?.thisWeekAppointments ? 
                Math.round((dashboardData.thisWeekCompleted / dashboardData.thisWeekAppointments) * 100) : 0}%
            </p>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Today's Schedule */}
        <Card className="glass-card slide-up lg:col-span-1 xl:col-span-2" style={{ animationDelay: '0.4s' }}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-primary" />
                <span>Today's Schedule</span>
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => onPageChange?.('appointments')}>View Calendar</Button>
            </div>
            <CardDescription>Your appointments for today</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-h-96 overflow-y-auto">
            {dashboardData?.todayAppointments?.length ? (
              dashboardData.todayAppointments.map((appointment, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-white/50 hover:bg-white/70 transition-colors">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(appointment.patientName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-gray-900">{appointment.patientName}</p>
                      <p className="text-sm text-gray-600">{appointment.reasonForVisit || 'General consultation'}</p>
                      <p className="text-xs text-gray-500">Age: {appointment.patientAge || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{formatTime(appointment.appointmentTime)}</p>
                    <Badge variant="secondary" className={`mt-1 ${getStatusColor(appointment.status)} text-white`}>
                      {appointment.status}
                    </Badge>
                    <div className="mt-2 flex space-x-1">
                      <Button size="sm" variant="outline" className="h-7">
                        Start
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7">
                        Profile
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No appointments today</p>
                <p className="text-gray-400 text-sm">Enjoy your free time!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Patient Activity */}
        <Card className="glass-card slide-up" style={{ animationDelay: '0.5s' }}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-green-600" />
                <span>Recent Activity</span>
              </CardTitle>
              <Button variant="outline" size="sm">View All</Button>
            </div>
            <CardDescription>New reports and updates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardData?.recentActivity?.length ? (
              dashboardData.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-white/50">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{activity.patientName}</p>
                    <p className="text-sm text-gray-600">Uploaded {activity.reportType}</p>
                    <p className="text-xs text-gray-500">{formatDate(activity.uploadDate)}</p>
                  </div>
                  <Button size="sm" variant="ghost">
                    View
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card className="glass-card slide-up" style={{ animationDelay: '0.6s' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-orange-600" />
              <span>Upcoming This Week</span>
            </CardTitle>
            <CardDescription>Next few appointments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardData?.upcomingAppointments?.length ? (
              dashboardData.upcomingAppointments.slice(0, 5).map((appointment, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-white/50">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getInitials(appointment.patientName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{appointment.patientName}</p>
                      <p className="text-xs text-gray-600">{formatDate(appointment.appointmentDate)}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-900">{formatTime(appointment.appointmentTime)}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No upcoming appointments</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Patient Search */}
        <Card className="glass-card slide-up" style={{ animationDelay: '0.7s' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <span>Quick Patient Lookup</span>
            </CardTitle>
            <CardDescription>Find patient information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Users className="w-4 h-4 mr-2" />
                View All Patients
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <FileText className="w-4 h-4 mr-2" />
                Recent Reports
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Calendar className="w-4 h-4 mr-2" />
                Manage Schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}

    </div>
  );
};