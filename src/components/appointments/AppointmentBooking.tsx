import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Stethoscope, MapPin, Phone, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '../../utils/supabase/client';
import { API_ENDPOINTS, getAuthHeaders, getAnonHeaders, HTTP_METHODS } from '../../config/api';
import { isDemoMode, demoFetch } from '../../utils/demoMode';

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  experience: string;
  rating: number;
  consultationFee: number;
  hospital: string;
  availableSlots: string[];
  qualifications: string;
  phone: string;
  isActive: boolean;
}

interface AppointmentBookingProps {
  onAppointmentBooked?: () => void;
}

export const AppointmentBooking: React.FC<AppointmentBookingProps> = ({ onAppointmentBooked }) => {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState('');
  const [appointmentType, setAppointmentType] = useState('in-person');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [step, setStep] = useState(1); // 1: Doctor selection, 2: Date/Time, 3: Details, 4: Confirmation
  const [bookedAppointment, setBookedAppointment] = useState<any>(null);

  const selectedDoctorData = doctors.find(doc => doc.id === selectedDoctor);

  // Fetch doctors from backend
  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      // Check if demo mode
      if (isDemoMode()) {
        console.log('📱 Demo mode: Fetching doctors from local storage');
        const demoDoctors = await demoFetch.getDoctors();
        setDoctors(demoDoctors as Doctor[]);
        setLoading(false);
        return;
      }

      const response = await fetch(API_ENDPOINTS.DOCTORS.LIST, {
        method: HTTP_METHODS.GET,
        headers: getAnonHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.doctors && data.doctors.length > 0) {
          setDoctors(data.doctors);
        } else {
          // No doctors available
          setDoctors([]);
          console.log('No registered doctors found in the system');
        }
      } else {
        console.error('Failed to fetch doctors');
        setDoctors([]);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
      
      // Check localStorage for registered doctors
      try {
        const storedDoctors = localStorage.getItem('doctors');
        if (storedDoctors) {
          const localDoctors = JSON.parse(storedDoctors);
          if (Array.isArray(localDoctors) && localDoctors.length > 0) {
            setDoctors(localDoctors);
            toast.success(`Found ${localDoctors.length} registered doctors locally`);
            setLoading(false);
            return;
          }
        }
      } catch (localError) {
        console.warn('Error reading local doctors:', localError);
      }
      
      // No doctors found anywhere
      setDoctors([]);
      toast.info('No doctors available yet. Register as a doctor to appear in the booking system.');
    } finally {
      setLoading(false);
    }
  };



  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
  };

  const handleDoctorSelect = (doctorId: string) => {
    setSelectedDoctor(doctorId);
    setStep(2);
  };

  const handleDateTimeSelect = () => {
    if (selectedDate && selectedTime) {
      setStep(3);
    }
  };

  const handleBookAppointment = async () => {
    if (!selectedDoctorData || !selectedDate || !selectedTime || !user) {
      toast.error('Please fill in all required fields');
      return;
    }

    setBookingLoading(true);
    try {
      const appointmentData = {
        doctorId: selectedDoctor,
        doctorName: selectedDoctorData.name,
        doctorSpecialization: selectedDoctorData.specialization,
        hospitalName: selectedDoctorData.hospital,
        appointmentDate: selectedDate.toISOString().split('T')[0],
        appointmentTime: selectedTime,
        appointmentType,
        reasonForVisit,
        consultationFee: selectedDoctorData.consultationFee,
      };

      // Check if demo mode
      if (isDemoMode()) {
        console.log('📱 Demo mode: Booking appointment locally');
        const result = await demoFetch.bookAppointment(user.id, appointmentData);
        setBookedAppointment(result.appointment);
        setStep(4);
        toast.success('Appointment booked successfully! (Demo Mode)');
        
        if (onAppointmentBooked) {
          onAppointmentBooked();
        }
        setBookingLoading(false);
        return;
      }

      // Get the current session to get access token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Authentication required');
        setBookingLoading(false);
        return;
      }

      const response = await fetch(API_ENDPOINTS.APPOINTMENTS.BASE, {
        method: HTTP_METHODS.POST,
        headers: getAuthHeaders(session.access_token),
        body: JSON.stringify({
          doctorId: selectedDoctor,
          appointmentDate: selectedDate.toISOString().split('T')[0],
          appointmentTime: selectedTime,
          appointmentType,
          reasonForVisit,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setBookedAppointment(data.appointment);
        setStep(4);
        toast.success('Appointment booked successfully!');
        
        // Call the callback to notify parent component
        if (onAppointmentBooked) {
          onAppointmentBooked();
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to book appointment');
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      toast.error('Error booking appointment');
    } finally {
      setBookingLoading(false);
    }
  };

  const renderDoctorSelection = () => {
    if (loading) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Doctor</h2>
            <p className="text-gray-600">Loading available doctors...</p>
          </div>
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Doctor</h2>
          <p className="text-gray-600">Select a doctor based on your needs</p>
        </div>
        
        {doctors.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Stethoscope className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No Doctors Available</h3>
              <p className="text-gray-600 mb-4">
                There are currently no registered doctors in the system.
              </p>
              <p className="text-sm text-gray-500">
                Doctors can register through the signup page to appear here for patient bookings.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {doctors.map((doctor) => (
          <Card 
            key={doctor.id} 
            className="glass-card cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
            onClick={() => handleDoctorSelect(doctor.id)}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {getInitials(doctor.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{doctor.name}</h3>
                    <p className="text-primary font-medium">{doctor.specialization}</p>
                    <p className="text-sm text-gray-600 mt-1">{doctor.experience} experience</p>
                    <p className="text-sm text-gray-500 mt-1 flex items-center">
                      <MapPin className="w-3 h-3 mr-1" />
                      {doctor.hospital}
                    </p>
                    <div className="flex items-center space-x-4 mt-2">
                      <div className="flex items-center space-x-1">
                        <span className="text-yellow-500">★</span>
                        <span className="text-sm font-medium">{doctor.rating}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Available Today
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">₹{doctor.consultationFee}</p>
                  <p className="text-sm text-gray-600">Consultation</p>
                </div>
              </div>
            </CardContent>
          </Card>
          ))}
          </div>
        )}
      </div>
    );
  };

  const renderDateTimeSelection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Date & Time</h2>
          <p className="text-gray-600">Choose when you'd like to meet with {selectedDoctorData?.name}</p>
        </div>
        <Button variant="outline" onClick={() => setStep(1)}>
          Change Doctor
        </Button>
      </div>

      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4 mb-6">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-primary">
                {selectedDoctorData && getInitials(selectedDoctorData.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-bold text-gray-900">{selectedDoctorData?.name}</h3>
              <p className="text-primary">{selectedDoctorData?.specialization}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label className="text-base font-medium mb-3 block">Select Date</Label>
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date() || date.getDay() === 0} // Disable past dates and Sundays
                className="rounded-md border glass"
              />
            </div>

            <div>
              <Label className="text-base font-medium mb-3 block">Available Time Slots</Label>
              <div className="grid grid-cols-2 gap-3">
                {selectedDoctorData?.availableSlots.map((time) => (
                  <Button
                    key={time}
                    variant={selectedTime === time ? "default" : "outline"}
                    className="justify-center h-12"
                    onClick={() => setSelectedTime(time)}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    {time}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button 
              onClick={handleDateTimeSelect}
              disabled={!selectedDate || !selectedTime}
              className="min-w-32"
            >
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderDetailsForm = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Appointment Details</h2>
          <p className="text-gray-600">Provide additional information for your visit</p>
        </div>
        <Button variant="outline" onClick={() => setStep(2)}>
          Change Date/Time
        </Button>
      </div>

      <Card className="glass-card">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {selectedDoctorData && getInitials(selectedDoctorData.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-gray-900">{selectedDoctorData?.name}</p>
                <p className="text-sm text-gray-600">{selectedDoctorData?.specialization}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-medium text-gray-900">
                {selectedDate?.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
              <p className="text-sm text-gray-600">{selectedTime}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="appointmentType">Appointment Type</Label>
              <Select value={appointmentType} onValueChange={setAppointmentType}>
                <SelectTrigger className="glass">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in-person">
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4" />
                      <span>In-Person Visit</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="telemedicine">
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4" />
                      <span>Telemedicine</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="reason">Reason for Visit</Label>
              <Textarea
                id="reason"
                placeholder="Please describe your symptoms or reason for the appointment..."
                value={reasonForVisit}
                onChange={(e) => setReasonForVisit(e.target.value)}
                className="glass min-h-24"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button 
              onClick={handleBookAppointment} 
              className="min-w-32"
              disabled={bookingLoading}
            >
              {bookingLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Booking...
                </>
              ) : (
                'Book Appointment'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderConfirmation = () => (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <Calendar className="w-10 h-10 text-green-600" />
      </div>
      
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Appointment Booked!</h2>
        <p className="text-gray-600">Your appointment has been successfully scheduled</p>
      </div>

      <Card className="glass-card max-w-md mx-auto">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Doctor:</span>
              <span className="font-medium">{selectedDoctorData?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Date:</span>
              <span className="font-medium">
                {selectedDate?.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Time:</span>
              <span className="font-medium">{selectedTime}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Type:</span>
              <span className="font-medium capitalize">{appointmentType.replace('-', ' ')}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-gray-600">Fee:</span>
              <span className="font-bold text-lg">₹{selectedDoctorData?.consultationFee}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center space-x-4">
        <Button variant="outline" onClick={() => setStep(1)}>
          Book Another
        </Button>
        <Button>
          View Appointments
        </Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      {step === 1 && renderDoctorSelection()}
      {step === 2 && renderDateTimeSelection()}
      {step === 3 && renderDetailsForm()}
      {step === 4 && renderConfirmation()}
    </div>
  );
};