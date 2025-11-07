import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Plus, Filter, Search, Stethoscope, MapPin, Phone, CheckCircle, AlertCircle, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { AppointmentBooking } from './AppointmentBooking';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '../../utils/supabase/client';
import { API_ENDPOINTS, getAuthHeaders, getAnonHeaders, HTTP_METHODS } from '../../config/api';
import { isDemoMode, demoFetch } from '../../utils/demoMode';

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialization: string;
  hospitalName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  reasonForVisit: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  consultationFee: number;
  bookedAt: string;
  notes: string;
}

export const AppointmentsPage: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('my-appointments');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    if (!user) return;
    
    try {
      setRefreshing(true);

      // Check if demo mode
      if (isDemoMode()) {
        console.log('📱 Demo mode: Fetching appointments from local storage');
        const demoAppointments = await demoFetch.getAppointments(user.id);
        setAppointments(demoAppointments);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      // Get the current session to get access token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(API_ENDPOINTS.APPOINTMENTS.BASE, {
        method: HTTP_METHODS.GET,
        headers: getAuthHeaders(session.access_token),
      });

      if (response.ok) {
        const data = await response.json();
        setAppointments(data.appointments || []);
      } else {
        console.error('Failed to fetch appointments');
        toast.error('Failed to load appointments');
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast.warning('Using offline mode');
      
      // Fallback to demo mode
      const demoAppointments = await demoFetch.getAppointments(user.id);
      setAppointments(demoAppointments);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!user) return;

    try {
      // Get the current session to get access token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(API_ENDPOINTS.APPOINTMENTS.BY_ID(appointmentId), {
        method: HTTP_METHODS.DELETE,
        headers: getAuthHeaders(session.access_token),
      });

      if (response.ok) {
        toast.success('Appointment cancelled successfully');
        fetchAppointments(); // Refresh the list
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to cancel appointment');
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      toast.error('Error cancelling appointment');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-500';
      case 'completed':
        return 'bg-blue-500';
      case 'cancelled':
        return 'bg-red-500';
      case 'pending':
      default:
        return 'bg-yellow-500';
    }
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return 'DR';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      case 'pending':
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const filteredAppointments = appointments.filter(appointment => {
    const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter;
    const matchesSearch = searchTerm === '' || 
      (appointment.doctorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (appointment.doctorSpecialization || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (appointment.hospitalName || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  const upcomingAppointments = filteredAppointments.filter(apt => 
    new Date(apt.appointmentDate) >= new Date() && apt.status !== 'cancelled'
  );

  const pastAppointments = filteredAppointments.filter(apt => 
    new Date(apt.appointmentDate) < new Date() || apt.status === 'completed'
  );

  const onAppointmentBooked = () => {
    fetchAppointments(); // Refresh appointments after booking
    setActiveTab('my-appointments'); // Switch back to appointments view
    toast.success('Appointment booked successfully! Check your appointments below.');
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 fade-in">
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-600 mt-1">Manage your medical appointments</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                // Initialize doctors first
                await fetch(API_ENDPOINTS.INIT.DOCTORS, {
                  method: HTTP_METHODS.POST,
                  headers: getAnonHeaders(),
                });

                // Then initialize sample data if user is logged in
                if (user) {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (session?.access_token) {
                    await fetch(API_ENDPOINTS.INIT.SAMPLE_DATA, {
                      method: HTTP_METHODS.POST,
                      headers: getAuthHeaders(session.access_token),
                    });
                  }
                }

                toast.success('System initialized successfully');
                fetchAppointments(); // Refresh appointments after initialization
              } catch (error) {
                console.error('Initialization error:', error);
                toast.error('Failed to initialize system');
              }
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Initialize System
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAppointments}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Clock className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="my-appointments" className="flex items-center space-x-2">
            <Calendar className="w-4 h-4" />
            <span>My Appointments</span>
          </TabsTrigger>
          <TabsTrigger value="book-new" className="flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Book New Appointment</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-appointments" className="space-y-6 mt-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total</p>
                    <p className="text-2xl font-bold text-gray-900">{appointments.length}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Upcoming</p>
                    <p className="text-2xl font-bold text-green-600">{upcomingAppointments.length}</p>
                  </div>
                  <Clock className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Completed</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {appointments.filter(apt => apt.status === 'completed').length}
                    </p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Cancelled</p>
                    <p className="text-2xl font-bold text-red-600">
                      {appointments.filter(apt => apt.status === 'cancelled').length}
                    </p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by doctor, specialization, or hospital..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Appointments List */}
          {filteredAppointments.length > 0 ? (
            <div className="space-y-6">
              {/* Upcoming Appointments */}
              {upcomingAppointments.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Upcoming Appointments</h2>
                  <div className="grid gap-4">
                    {upcomingAppointments.map((appointment) => (
                      <Card key={appointment.id} className="glass-card hover:shadow-lg transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-4 flex-1">
                              <Avatar className="h-12 w-12">
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {getInitials(appointment.doctorName)}
                                </AvatarFallback>
                              </Avatar>
                              
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h3 className="font-semibold text-gray-900">{appointment.doctorName || 'Doctor'}</h3>
                                    <p className="text-sm text-gray-600 flex items-center">
                                      <Stethoscope className="w-3 h-3 mr-1" />
                                      {appointment.doctorSpecialization || 'General Physician'}
                                    </p>
                                  </div>
                                  <Badge className={`${getStatusColor(appointment.status)} text-white flex items-center space-x-1`}>
                                    {getStatusIcon(appointment.status)}
                                    <span className="capitalize">{appointment.status}</span>
                                  </Badge>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                                  <p className="flex items-center">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {formatDate(appointment.appointmentDate)}
                                  </p>
                                  <p className="flex items-center">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {formatTime(appointment.appointmentTime)}
                                  </p>
                                  <p className="flex items-center">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    {appointment.hospitalName || 'Clinic'}
                                  </p>
                                  <p className="flex items-center">
                                    <span className="w-3 h-3 mr-1">₹</span>
                                    {appointment.consultationFee || 500}
                                  </p>
                                </div>

                                {appointment.reasonForVisit && (
                                  <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                                    <strong>Reason:</strong> {appointment.reasonForVisit}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col space-y-2 ml-4">
                              {appointment.status === 'pending' && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleCancelAppointment(appointment.id)}
                                >
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Past Appointments */}
              {pastAppointments.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Past Appointments</h2>
                  <div className="grid gap-4">
                    {pastAppointments.map((appointment) => (
                      <Card key={appointment.id} className="glass-card opacity-80">
                        <CardContent className="p-6">
                          <div className="flex items-start space-x-4">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback className="bg-gray-100 text-gray-600">
                                {getInitials(appointment.doctorName)}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h3 className="font-semibold text-gray-700">{appointment.doctorName || 'Doctor'}</h3>
                                  <p className="text-sm text-gray-500 flex items-center">
                                    <Stethoscope className="w-3 h-3 mr-1" />
                                    {appointment.doctorSpecialization || 'General Physician'}
                                  </p>
                                </div>
                                <Badge className={`${getStatusColor(appointment.status)} text-white flex items-center space-x-1`}>
                                  {getStatusIcon(appointment.status)}
                                  <span className="capitalize">{appointment.status}</span>
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-500">
                                <p className="flex items-center">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {formatDate(appointment.appointmentDate)}
                                </p>
                                <p className="flex items-center">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {formatTime(appointment.appointmentTime)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Card className="glass-card">
              <CardContent className="p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Appointments Found</h3>
                <p className="text-gray-600 mb-6">You don't have any appointments yet. Book your first appointment!</p>
                <Button onClick={() => setActiveTab('book-new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Book Appointment
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="book-new" className="mt-6">
          <AppointmentBooking onAppointmentBooked={onAppointmentBooked} />
        </TabsContent>
      </Tabs>
    </div>
  );
};