import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Filter, Search, Phone, Mail, CheckCircle, XCircle, Loader2, AlertCircle, MapPin, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '../../utils/supabase/client';
import { API_ENDPOINTS, getAuthHeaders, HTTP_METHODS } from '../../config/api';
import { isDemoMode, demoFetch } from '../../utils/demoMode';

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  patientAge?: number;
  doctorId: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  reasonForVisit: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  consultationFee: number;
  bookedAt: string;
  notes: string;
}

export const DoctorAppointmentsPage: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('today');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'complete'>('approve');
  const [actionNotes, setActionNotes] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

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

  const handleAppointmentAction = async () => {
    if (!selectedAppointment || !user) return;

    try {
      setProcessingAction(true);

      // Check if demo mode
      if (isDemoMode()) {
        // Update in local storage for demo mode
        const updated = appointments.map(apt => 
          apt.id === selectedAppointment.id 
            ? { 
                ...apt, 
                status: actionType === 'approve' ? 'confirmed' : actionType === 'reject' ? 'cancelled' : 'completed',
                notes: actionNotes || apt.notes
              }
            : apt
        );
        setAppointments(updated);
        localStorage.setItem(`appointments_${user.id}`, JSON.stringify(updated));
        
        toast.success(`Appointment ${actionType === 'approve' ? 'approved' : actionType === 'reject' ? 'rejected' : 'completed'} successfully`);
        setShowActionDialog(false);
        setSelectedAppointment(null);
        setActionNotes('');
        setProcessingAction(false);
        return;
      }

      // Get the current session to get access token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Authentication required');
        setProcessingAction(false);
        return;
      }

      const response = await fetch(API_ENDPOINTS.APPOINTMENTS.BY_ID(selectedAppointment.id), {
        method: HTTP_METHODS.PUT,
        headers: getAuthHeaders(session.access_token),
        body: JSON.stringify({
          status: actionType === 'approve' ? 'confirmed' : actionType === 'reject' ? 'cancelled' : 'completed',
          notes: actionNotes || selectedAppointment.notes
        }),
      });

      if (response.ok) {
        toast.success(`Appointment ${actionType === 'approve' ? 'approved' : actionType === 'reject' ? 'rejected' : 'completed'} successfully`);
        fetchAppointments(); // Refresh the list
        setShowActionDialog(false);
        setSelectedAppointment(null);
        setActionNotes('');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update appointment');
      }
    } catch (error) {
      console.error('Error updating appointment:', error);
      toast.error('Error updating appointment');
    } finally {
      setProcessingAction(false);
    }
  };

  const openActionDialog = (appointment: Appointment, type: 'approve' | 'reject' | 'complete') => {
    setSelectedAppointment(appointment);
    setActionType(type);
    setActionNotes(appointment.notes || '');
    setShowActionDialog(true);
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
    if (!name) return 'PT';
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
      (appointment.patientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (appointment.patientEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (appointment.reasonForVisit || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  // Get today's date string
  const today = new Date().toISOString().split('T')[0];
  
  // Filter appointments by tab
  const todayAppointments = filteredAppointments.filter(apt => 
    apt.appointmentDate === today && apt.status !== 'cancelled'
  );

  const upcomingAppointments = filteredAppointments.filter(apt => 
    new Date(apt.appointmentDate) > new Date() && apt.status !== 'cancelled'
  );

  const pendingAppointments = filteredAppointments.filter(apt => 
    apt.status === 'pending'
  );

  const completedAppointments = filteredAppointments.filter(apt => 
    apt.status === 'completed'
  );

  if (loading) {
    return (
      <div className="p-6 space-y-6 fade-in">
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const renderAppointmentCard = (appointment: Appointment) => (
    <Card key={appointment.id} className="glass-card hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4 flex-1">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-primary/10 text-primary text-lg">
                {getInitials(appointment.patientName)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">{appointment.patientName || 'Patient'}</h3>
                  {appointment.patientAge && (
                    <p className="text-sm text-gray-600">Age: {appointment.patientAge} years</p>
                  )}
                </div>
                <Badge className={`${getStatusColor(appointment.status)} text-white flex items-center space-x-1`}>
                  {getStatusIcon(appointment.status)}
                  <span className="capitalize">{appointment.status}</span>
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center text-gray-600">
                  <Mail className="w-4 h-4 mr-2 text-primary" />
                  <span>{appointment.patientEmail || 'No email'}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Phone className="w-4 h-4 mr-2 text-primary" />
                  <span>{appointment.patientPhone || 'No phone'}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Calendar className="w-4 h-4 mr-2 text-primary" />
                  <span>{formatDate(appointment.appointmentDate)}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Clock className="w-4 h-4 mr-2 text-primary" />
                  <span>{formatTime(appointment.appointmentTime)}</span>
                </div>
              </div>

              <div className="flex items-center space-x-4 text-sm">
                <Badge variant="outline" className="capitalize">
                  {appointment.appointmentType || 'in-person'}
                </Badge>
                <span className="text-gray-600">
                  Fee: ₹{appointment.consultationFee || 500}
                </span>
              </div>

              {appointment.reasonForVisit && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-700 flex items-start">
                    <FileText className="w-4 h-4 mr-2 mt-0.5 text-primary flex-shrink-0" />
                    <span><strong>Reason:</strong> {appointment.reasonForVisit}</span>
                  </p>
                </div>
              )}

              {appointment.notes && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Notes:</strong> {appointment.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col space-y-2 ml-4">
            {appointment.status === 'pending' && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => openActionDialog(appointment, 'approve')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => openActionDialog(appointment, 'reject')}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Reject
                </Button>
              </>
            )}
            {appointment.status === 'confirmed' && (
              <Button
                variant="default"
                size="sm"
                onClick={() => openActionDialog(appointment, 'complete')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Mark Complete
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Appointment Management</h1>
          <p className="text-gray-600 mt-1">Manage patient appointments and schedules</p>
        </div>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingAppointments.length}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today</p>
                <p className="text-2xl font-bold text-blue-600">{todayAppointments.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-l-4 border-l-green-500">
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

        <Card className="glass-card border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-purple-600">{completedAppointments.length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-purple-600" />
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
              placeholder="Search by patient name, email, or reason..."
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="today" className="flex items-center space-x-2">
            <Calendar className="w-4 h-4" />
            <span>Today ({todayAppointments.length})</span>
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4" />
            <span>Pending ({pendingAppointments.length})</span>
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>Upcoming ({upcomingAppointments.length})</span>
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4" />
            <span>Completed ({completedAppointments.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4 mt-6">
          {todayAppointments.length > 0 ? (
            <div className="space-y-4">
              {todayAppointments
                .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime))
                .map(renderAppointmentCard)}
            </div>
          ) : (
            <Card className="glass-card">
              <CardContent className="p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Appointments Today</h3>
                <p className="text-gray-600">You don't have any appointments scheduled for today.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4 mt-6">
          {pendingAppointments.length > 0 ? (
            <div className="space-y-4">
              {pendingAppointments
                .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime())
                .map(renderAppointmentCard)}
            </div>
          ) : (
            <Card className="glass-card">
              <CardContent className="p-12 text-center">
                <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Appointments</h3>
                <p className="text-gray-600">All appointments have been reviewed.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4 mt-6">
          {upcomingAppointments.length > 0 ? (
            <div className="space-y-4">
              {upcomingAppointments
                .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime())
                .map(renderAppointmentCard)}
            </div>
          ) : (
            <Card className="glass-card">
              <CardContent className="p-12 text-center">
                <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Upcoming Appointments</h3>
                <p className="text-gray-600">You don't have any future appointments scheduled.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4 mt-6">
          {completedAppointments.length > 0 ? (
            <div className="space-y-4">
              {completedAppointments
                .sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime())
                .map(renderAppointmentCard)}
            </div>
          ) : (
            <Card className="glass-card">
              <CardContent className="p-12 text-center">
                <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Completed Appointments</h3>
                <p className="text-gray-600">You haven't completed any appointments yet.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && 'Approve Appointment'}
              {actionType === 'reject' && 'Reject Appointment'}
              {actionType === 'complete' && 'Mark Appointment as Complete'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedAppointment && (
            <div className="space-y-2 text-sm text-gray-600">
              <div><span className="font-semibold text-gray-900">Patient:</span> {selectedAppointment.patientName}</div>
              <div><span className="font-semibold text-gray-900">Date:</span> {formatDate(selectedAppointment.appointmentDate)}</div>
              <div><span className="font-semibold text-gray-900">Time:</span> {formatTime(selectedAppointment.appointmentTime)}</div>
            </div>
          )}
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Textarea
                placeholder="Add any notes or comments..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                rows={4}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowActionDialog(false);
                setSelectedAppointment(null);
                setActionNotes('');
              }}
              disabled={processingAction}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAppointmentAction}
              disabled={processingAction}
              className={
                actionType === 'approve' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : actionType === 'reject'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }
            >
              {processingAction ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {actionType === 'approve' && 'Approve'}
              {actionType === 'reject' && 'Reject'}
              {actionType === 'complete' && 'Mark Complete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
