import React, { useState, useEffect } from 'react';
import { Calendar, FileText, Pill, TrendingUp, Clock, User, Upload, Heart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabase/client';
import { API_ENDPOINTS, getAuthHeaders, HTTP_METHODS } from '../../config/api';

interface DashboardData {
  upcomingAppointments: any[];
  recentPrescriptions: any[];
  recentReports: any[];
  totalAppointments: number;
  completedAppointments: number;
  upcomingAppointmentsCount: number;
  activePrescriptions: number;
  totalPrescriptions: number;
  totalReports: number;
  healthScore: number;
  recentActivity: {
    appointmentsLast3Months: number;
    reportsLast3Months: number;
  };
}

interface PatientDashboardProps {
  onPageChange?: (page: string) => void;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({ onPageChange }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
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
        const response = await fetch(API_ENDPOINTS.DASHBOARD.PATIENT, {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'completed': return 'bg-blue-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
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
          <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.fullName}</h1>
          <p className="text-gray-600 mt-1">Here's an overview of your health journey</p>
        </div>
        <div className="flex items-center space-x-2 text-primary">
          <Heart className="w-6 h-6" />
          <span className="font-medium">Swasthya Portal</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card 
          className="glass-card slide-up cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => onPageChange?.('appointments')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Appointments</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData?.totalAppointments || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="glass-card slide-up cursor-pointer hover:shadow-lg transition-shadow" 
          style={{ animationDelay: '0.1s' }}
          onClick={() => onPageChange?.('prescriptions')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Prescriptions</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData?.activePrescriptions || 0}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Pill className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="glass-card slide-up cursor-pointer hover:shadow-lg transition-shadow" 
          style={{ animationDelay: '0.2s' }}
          onClick={() => onPageChange?.('reports')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Medical Reports</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData?.totalReports || 0}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="glass-card slide-up cursor-pointer hover:shadow-lg transition-shadow" 
          style={{ animationDelay: '0.3s' }}
          onClick={() => onPageChange?.('health-timeline')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Health Score</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData?.healthScore || 70}%</p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
            <div className="mt-3">
              <Progress value={dashboardData?.healthScore || 70} className="h-2" />
              <p className="text-xs text-gray-500 mt-1">
                Based on recent activity and checkups
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card p-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">Completed Visits</p>
            <p className="text-xl font-bold text-green-600">{dashboardData?.completedAppointments || 0}</p>
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">Upcoming Visits</p>
            <p className="text-xl font-bold text-blue-600">{dashboardData?.upcomingAppointmentsCount || 0}</p>
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">Total Prescriptions</p>
            <p className="text-xl font-bold text-purple-600">{dashboardData?.totalPrescriptions || 0}</p>
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">Recent Activity</p>
            <p className="text-xl font-bold text-orange-600">
              {(dashboardData?.recentActivity?.appointmentsLast3Months || 0) + 
               (dashboardData?.recentActivity?.reportsLast3Months || 0)}
            </p>
            <p className="text-xs text-gray-500">Last 3 months</p>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Upcoming Appointments */}
        <Card className="glass-card slide-up" style={{ animationDelay: '0.4s' }}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-primary" />
                <span>Upcoming Appointments</span>
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onPageChange?.('appointments')}
              >
                View All
              </Button>
            </div>
            <CardDescription>Next scheduled visits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardData?.upcomingAppointments?.length ? (
              dashboardData.upcomingAppointments.map((appointment, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 rounded-lg bg-white/50 cursor-pointer hover:bg-white/70 transition-colors"
                  onClick={() => onPageChange?.('appointments')}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Dr. {appointment.doctorName}</p>
                      <p className="text-sm text-gray-600">{appointment.specialization}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{formatDate(appointment.appointmentDate)}</p>
                    <p className="text-sm text-gray-600">{formatTime(appointment.appointmentTime)}</p>
                    <Badge variant="secondary" className={`mt-1 ${getStatusColor(appointment.status)} text-white`}>
                      {appointment.status}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No upcoming appointments</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => onPageChange?.('appointments')}
                >
                  Schedule Appointment
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Prescriptions */}
        <Card className="glass-card slide-up" style={{ animationDelay: '0.5s' }}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Pill className="w-5 h-5 text-green-600" />
                <span>Recent Prescriptions</span>
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onPageChange?.('prescriptions')}
              >
                View All
              </Button>
            </div>
            <CardDescription>Latest medications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardData?.recentPrescriptions?.length ? (
              dashboardData.recentPrescriptions.map((prescription, index) => (
                <div 
                  key={index} 
                  className="p-3 rounded-lg bg-white/50 cursor-pointer hover:bg-white/70 transition-colors"
                  onClick={() => onPageChange?.('prescriptions')}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">Dr. {prescription.doctorName}</p>
                    <p className="text-sm text-gray-600">{formatDate(prescription.prescribedDate)}</p>
                  </div>
                  <div className="space-y-1">
                    {prescription.medicines?.slice(0, 2).map((medicine: any, idx: number) => (
                      <p key={idx} className="text-sm text-gray-700">
                        {medicine.name} - {medicine.dosage}
                      </p>
                    ))}
                    {prescription.medicines?.length > 2 && (
                      <p className="text-sm text-gray-500">+{prescription.medicines.length - 2} more</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Pill className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No recent prescriptions</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Reports */}
        <Card className="glass-card slide-up" style={{ animationDelay: '0.6s' }}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-purple-600" />
                <span>Health Reports</span>
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onPageChange?.('reports')}
              >
                View All
              </Button>
            </div>
            <CardDescription>AI-powered health insights</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardData?.recentReports?.length ? (
              dashboardData.recentReports.map((report, index) => (
                <div 
                  key={index} 
                  className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 cursor-pointer hover:from-blue-100 hover:to-purple-100 transition-colors"
                  onClick={() => onPageChange?.('reports')}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-gray-900">{report.reportType}</p>
                      <p className="text-sm text-gray-600">{formatDate(report.uploadDate)}</p>
                    </div>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      AI Analyzed
                    </Badge>
                  </div>
                  {report.aiAnalysis && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-700">{report.aiAnalysis.summary}</p>
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <p className="text-sm text-green-700">Overall health improving</p>
                      </div>
                    </div>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3 w-full"
                    onClick={() => onPageChange?.('reports')}
                  >
                    View Analysis
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 mb-3">No reports uploaded yet</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onPageChange?.('reports')}
                >
                  Upload Report
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="glass-card slide-up" style={{ animationDelay: '0.7s' }}>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks you might want to perform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button 
              className="h-16 flex-col space-y-2" 
              variant="outline"
              onClick={() => onPageChange?.('appointments')}
            >
              <Calendar className="w-5 h-5" />
              <span className="text-sm">Book Appointment</span>
            </Button>
            <Button 
              className="h-16 flex-col space-y-2" 
              variant="outline"
              onClick={() => onPageChange?.('reports')}
            >
              <Upload className="w-5 h-5" />
              <span className="text-sm">Upload Report</span>
            </Button>
            <Button 
              className="h-16 flex-col space-y-2" 
              variant="outline"
              onClick={() => onPageChange?.('prescriptions')}
            >
              <Pill className="w-5 h-5" />
              <span className="text-sm">View Prescriptions</span>
            </Button>
            <Button 
              className="h-16 flex-col space-y-2" 
              variant="outline"
              onClick={() => onPageChange?.('health-timeline')}
            >
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm">Health Timeline</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};