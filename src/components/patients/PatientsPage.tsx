import React, { useState, useEffect } from 'react';
import { Users, Search, Filter, User, Calendar, FileText, Pill, Activity, Phone, Mail, Heart, Loader2, Plus, X, Trash2, Brain, CheckCircle, TrendingUp, TrendingDown, AlertCircle, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabase/client';
import { API_ENDPOINTS, getAuthHeaders, HTTP_METHODS } from '../../config/api';
import { toast } from 'sonner@2.0.3';
import { isDemoMode, enableDemoMode, demoFetch } from '../../utils/demoMode';
import { 
  addPrescription, 
  updatePrescription, 
  deletePrescription, 
  getPrescriptionsForPatient,
  type Prescription as PrescriptionType 
} from '../../utils/prescriptionService';
import { 
  getReportsForPatient,
  type StoredReport 
} from '../../utils/reportStorageService';

interface Patient {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  lastVisit: string | null;
  totalAppointments: number;
  totalPrescriptions: number;
  totalReports: number;
  createdAt: string;
}

interface PatientDetails {
  patient: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    gender: string;
    bloodGroup: string;
    createdAt: string;
  };
  appointments: any[];
  prescriptions: any[];
  reports: any[];
  stats: {
    totalAppointments: number;
    totalPrescriptions: number;
    totalReports: number;
  };
}

interface MealTiming {
  breakfast: { before: boolean; after: boolean };
  lunch: { before: boolean; after: boolean };
  dinner: { before: boolean; after: boolean };
}

interface Medicine {
  name: string;
  dosage: string;
  frequency: MealTiming;
  duration: string;
  refills: number;
}

export function PatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientDetails | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showPrescriptionDialog, setShowPrescriptionDialog] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [submittingPrescription, setSubmittingPrescription] = useState(false);
  const [editingPrescriptionId, setEditingPrescriptionId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [prescriptionToDelete, setPrescriptionToDelete] = useState<{
    id: string;
    diagnosis: string;
  } | null>(null);
  const [deletingPrescription, setDeletingPrescription] = useState(false);
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());

  // Prescription form state
  const [diagnosis, setDiagnosis] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([
    { 
      name: '', 
      dosage: '', 
      frequency: {
        breakfast: { before: false, after: false },
        lunch: { before: false, after: false },
        dinner: { before: false, after: false }
      },
      duration: '', 
      refills: 0
    }
  ]);
  const [labTests, setLabTests] = useState('');
  const [instructions, setInstructions] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setLoading(true);

      // Check if demo mode
      if (isDemoMode()) {
        const demoPatients = await demoFetch.getPatients(user?.id || '');
        // Add stats to demo patients with real data from storage services
        const patientsWithStats = demoPatients.map((patient: any) => {
          const prescriptions = getPrescriptionsForPatient(patient.id);
          const reports = getReportsForPatient(patient.id);
          
          return {
            ...patient,
            lastVisit: null,
            totalAppointments: Math.floor(Math.random() * 10) + 1,
            totalPrescriptions: prescriptions.length,
            totalReports: reports.length,
            createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
          };
        });
        setPatients(patientsWithStats);
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast.error('Please login to continue');
        setLoading(false);
        return;
      }

      const response = await fetch(API_ENDPOINTS.PATIENTS.LIST, {
        method: HTTP_METHODS.GET,
        headers: getAuthHeaders(session.access_token),
      });

      if (response.ok) {
        const data = await response.json();
        setPatients(data.patients || []);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to load patients');
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
      
      // Fallback to demo mode on error
      if (!isDemoMode()) {
        console.log('Backend unavailable, enabling demo mode...');
        enableDemoMode();
        toast.info('Backend unavailable. Using demo mode.');
        
        const demoPatients = await demoFetch.getPatients(user?.id || 'demo-doctor-1');
        const patientsWithStats = demoPatients.map((patient: any) => {
          const prescriptions = getPrescriptionsForPatient(patient.id);
          const reports = getReportsForPatient(patient.id);
          
          return {
            ...patient,
            lastVisit: null,
            totalAppointments: Math.floor(Math.random() * 10) + 1,
            totalPrescriptions: prescriptions.length,
            totalReports: reports.length,
            createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
          };
        });
        setPatients(patientsWithStats);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientDetails = async (patientId: string) => {
    try {
      setLoadingDetails(true);

      // Check if demo mode
      if (isDemoMode()) {
        // Create mock patient details
        const patient = patients.find(p => p.id === patientId);
        if (patient) {
          // Get prescriptions and reports for this patient from storage services
          const patientPrescriptions = getPrescriptionsForPatient(patientId);
          const patientReports = getReportsForPatient(patientId);
          
          setSelectedPatient({
            patient: {
              id: patient.id,
              fullName: patient.fullName,
              email: patient.email,
              phone: patient.phone,
              dateOfBirth: patient.dateOfBirth,
              gender: patient.gender,
              bloodGroup: patient.bloodGroup,
              createdAt: patient.createdAt
            },
            appointments: [
              {
                id: 'demo-apt-1',
                appointmentDate: new Date().toISOString().split('T')[0],
                appointmentTime: '10:00',
                appointmentType: 'in-person',
                reasonForVisit: 'Regular checkup',
                status: 'confirmed',
                notes: ''
              }
            ],
            prescriptions: patientPrescriptions,
            reports: patientReports,
            stats: {
              totalAppointments: patient.totalAppointments,
              totalPrescriptions: patientPrescriptions.length,
              totalReports: patientReports.length
            }
          });
        }
        setLoadingDetails(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast.error('Please login to continue');
        return;
      }

      const response = await fetch(API_ENDPOINTS.PATIENTS.BY_ID(patientId), {
        method: HTTP_METHODS.GET,
        headers: getAuthHeaders(session.access_token),
      });

      if (response.ok) {
        const data = await response.json();
        // Always merge with latest data from local storage
        const latestPrescriptions = getPrescriptionsForPatient(patientId);
        const latestReports = getReportsForPatient(patientId);
        
        setSelectedPatient({
          ...data,
          prescriptions: latestPrescriptions,
          reports: latestReports,
          stats: {
            ...data.stats,
            totalPrescriptions: latestPrescriptions.length,
            totalReports: latestReports.length
          }
        });
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to load patient details');
      }
    } catch (error) {
      console.error('Error fetching patient details:', error);
      
      // Fallback to demo data
      const patient = patients.find(p => p.id === patientId);
      if (patient) {
        // Get prescriptions and reports for this patient from storage services
        const patientPrescriptions = getPrescriptionsForPatient(patientId);
        const patientReports = getReportsForPatient(patientId);
        
        setSelectedPatient({
          patient: {
            id: patient.id,
            fullName: patient.fullName,
            email: patient.email,
            phone: patient.phone,
            dateOfBirth: patient.dateOfBirth,
            gender: patient.gender,
            bloodGroup: patient.bloodGroup,
            createdAt: patient.createdAt
          },
          appointments: [],
          prescriptions: patientPrescriptions,
          reports: patientReports,
          stats: {
            totalAppointments: patient.totalAppointments,
            totalPrescriptions: patientPrescriptions.length,
            totalReports: patientReports.length
          }
        });
      }
    } finally {
      setLoadingDetails(false);
    }
  };

  const handlePatientClick = async (patientId: string) => {
    // Always refresh prescriptions from persistent storage before opening dialog
    setShowDetailsDialog(true);
    await fetchPatientDetails(patientId);
  };

  // Refresh patient details when prescriptions are updated
  useEffect(() => {
    if (showDetailsDialog && selectedPatient) {
      const handlePrescriptionUpdate = () => {
        // Reload prescriptions for the current patient
        const patientPrescriptions = getPrescriptionsForPatient(selectedPatient.patient.id);
        setSelectedPatient({
          ...selectedPatient,
          prescriptions: patientPrescriptions,
          stats: {
            ...selectedPatient.stats,
            totalPrescriptions: patientPrescriptions.length
          }
        });
      };

      window.addEventListener('prescriptionUpdated', handlePrescriptionUpdate);
      return () => {
        window.removeEventListener('prescriptionUpdated', handlePrescriptionUpdate);
      };
    }
  }, [showDetailsDialog, selectedPatient]);

  // Reload prescriptions when dialog opens (handles logout/login scenario)
  useEffect(() => {
    if (showDetailsDialog && selectedPatient) {
      const latestPrescriptions = getPrescriptionsForPatient(selectedPatient.patient.id);
      // Only update if the count changed (to avoid infinite loop)
      if (latestPrescriptions.length !== selectedPatient.prescriptions.length) {
        setSelectedPatient({
          ...selectedPatient,
          prescriptions: latestPrescriptions,
          stats: {
            ...selectedPatient.stats,
            totalPrescriptions: latestPrescriptions.length
          }
        });
      }
    }
  }, [showDetailsDialog]);

  const handleAddMedicine = () => {
    setMedicines([...medicines, { 
      name: '', 
      dosage: '', 
      frequency: {
        breakfast: { before: false, after: false },
        lunch: { before: false, after: false },
        dinner: { before: false, after: false }
      },
      duration: '', 
      refills: 0
    }]);
  };

  const handleRemoveMedicine = (index: number) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const handleMedicineChange = (index: number, field: keyof Medicine, value: any) => {
    const updatedMedicines = [...medicines];
    updatedMedicines[index] = { ...updatedMedicines[index], [field]: value };
    setMedicines(updatedMedicines);
  };

  const handleFrequencyChange = (index: number, meal: keyof MealTiming, timing: 'before' | 'after', checked: boolean) => {
    const updatedMedicines = [...medicines];
    updatedMedicines[index].frequency[meal][timing] = checked;
    setMedicines(updatedMedicines);
  };

  const handleSubmitPrescription = async () => {
    if (!selectedPatient) return;

    // Validate at least one medicine
    const validMedicines = medicines.filter(m => m.name.trim() && m.dosage.trim());
    if (validMedicines.length === 0) {
      toast.error('Please add at least one medicine');
      return;
    }

    // Validate diagnosis
    if (!diagnosis.trim()) {
      toast.error('Please enter a diagnosis');
      return;
    }

    try {
      setSubmittingPrescription(true);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      if (isEditMode && editingPrescriptionId) {
        // Update existing prescription in global store
        const updatedPrescription = updatePrescription(editingPrescriptionId, {
          diagnosis, 
          medicines: validMedicines, 
          labTests: labTests || '', 
          instructions: instructions || '', 
          followUpDate: followUpDate || null,
        });

        if (updatedPrescription) {
          // Update local state to reflect changes
          const updatedPrescriptions = selectedPatient.prescriptions.map((p: any) => 
            p.id === editingPrescriptionId ? updatedPrescription : p
          );
          setSelectedPatient({
            ...selectedPatient,
            prescriptions: updatedPrescriptions,
            stats: {
              ...selectedPatient.stats,
              totalPrescriptions: updatedPrescriptions.length
            }
          });
          
          // Also update the patient list to reflect new count
          setPatients(prevPatients => 
            prevPatients.map(p => 
              p.id === selectedPatient.patient.id 
                ? { ...p, totalPrescriptions: updatedPrescriptions.length }
                : p
            )
          );
          
          toast.success('Prescription updated successfully');
        }
      } else {
        // Add new prescription to global store
        const newPrescription: PrescriptionType = {
          id: `presc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          patientId: selectedPatient.patient.id,
          patientName: selectedPatient.patient.fullName,
          patientEmail: selectedPatient.patient.email,
          doctorId: user?.id || 'doctor1',
          doctorName: user?.fullName || 'Dr. Current User',
          diagnosis,
          medicines: validMedicines,
          labTests: labTests || '',
          instructions: instructions || '',
          followUpDate: followUpDate || null,
          prescribedDate: new Date().toISOString(),
          status: 'active',
          createdAt: new Date().toISOString()
        };

        // Save to global prescription store
        addPrescription(newPrescription);

        // Update local state to show the new prescription
        const updatedPrescriptions = [newPrescription, ...selectedPatient.prescriptions];
        setSelectedPatient({
          ...selectedPatient,
          prescriptions: updatedPrescriptions,
          stats: {
            ...selectedPatient.stats,
            totalPrescriptions: updatedPrescriptions.length
          }
        });
        
        // Also update the patient list to reflect new count
        setPatients(prevPatients => 
          prevPatients.map(p => 
            p.id === selectedPatient.patient.id 
              ? { ...p, totalPrescriptions: updatedPrescriptions.length }
              : p
          )
        );
        
        toast.success('Prescription added successfully and assigned to patient');
      }
      
      setShowPrescriptionDialog(false);
      resetPrescriptionForm();
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'adding'} prescription:`, error);
      toast.error(`Failed to ${isEditMode ? 'update' : 'add'} prescription`);
    } finally {
      setSubmittingPrescription(false);
    }
  };

  const resetPrescriptionForm = () => {
    setDiagnosis('');
    setMedicines([{ 
      name: '', 
      dosage: '', 
      frequency: {
        breakfast: { before: false, after: false },
        lunch: { before: false, after: false },
        dinner: { before: false, after: false }
      },
      duration: '', 
      refills: 0
    }]);
    setLabTests('');
    setInstructions('');
    setFollowUpDate('');
    setIsEditMode(false);
    setEditingPrescriptionId(null);
  };

  const handleOpenAddPrescription = () => {
    resetPrescriptionForm();
    setIsEditMode(false);
    setShowPrescriptionDialog(true);
  };

  const handleOpenEditPrescription = (prescription: any) => {
    setIsEditMode(true);
    setEditingPrescriptionId(prescription.id);
    
    // Pre-populate form with existing data
    setDiagnosis(prescription.diagnosis || '');
    setMedicines(prescription.medicines || [{
      name: '', 
      dosage: '', 
      frequency: {
        breakfast: { before: false, after: false },
        lunch: { before: false, after: false },
        dinner: { before: false, after: false }
      },
      duration: '', 
      refills: 0
    }]);
    setLabTests(prescription.labTests || '');
    setInstructions(prescription.instructions || '');
    setFollowUpDate(prescription.followUpDate ? prescription.followUpDate.split('T')[0] : '');
    
    setShowPrescriptionDialog(true);
  };

  const handleDeletePrescription = async () => {
    if (!prescriptionToDelete || !selectedPatient) return;

    try {
      setDeletingPrescription(true);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Delete from global prescription store
      const deleted = deletePrescription(prescriptionToDelete.id);
      
      if (deleted) {
        // Update local state
        const updatedPrescriptions = selectedPatient.prescriptions.filter(
          (p: any) => p.id !== prescriptionToDelete.id
        );

        setSelectedPatient({
          ...selectedPatient,
          prescriptions: updatedPrescriptions,
          stats: {
            ...selectedPatient.stats,
            totalPrescriptions: updatedPrescriptions.length
          }
        });
        
        // Also update the patient list to reflect new count
        setPatients(prevPatients => 
          prevPatients.map(p => 
            p.id === selectedPatient.patient.id 
              ? { ...p, totalPrescriptions: updatedPrescriptions.length }
              : p
          )
        );

        toast.success('Prescription deleted successfully');
      } else {
        toast.error('Prescription not found');
      }
      
      setPrescriptionToDelete(null);
    } catch (error) {
      console.error('Error deleting prescription:', error);
      toast.error('Failed to delete prescription');
    } finally {
      setDeletingPrescription(false);
    }
  };



  const filteredPatients = patients.filter(patient =>
    patient.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.phone.includes(searchTerm)
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const formatFrequency = (frequency: any): string => {
    // If frequency is already a string, return it
    if (typeof frequency === 'string') {
      return frequency;
    }
    
    // If frequency is an object with meal timings
    if (typeof frequency === 'object' && frequency !== null) {
      const parts: string[] = [];
      
      if (frequency.breakfast?.before || frequency.breakfast?.after) {
        const timing = [];
        if (frequency.breakfast.before) timing.push('Before');
        if (frequency.breakfast.after) timing.push('After');
        parts.push(`Breakfast (${timing.join(' & ')})`);
      }
      
      if (frequency.lunch?.before || frequency.lunch?.after) {
        const timing = [];
        if (frequency.lunch.before) timing.push('Before');
        if (frequency.lunch.after) timing.push('After');
        parts.push(`Lunch (${timing.join(' & ')})`);
      }
      
      if (frequency.dinner?.before || frequency.dinner?.after) {
        const timing = [];
        if (frequency.dinner.before) timing.push('Before');
        if (frequency.dinner.after) timing.push('After');
        parts.push(`Dinner (${timing.join(' & ')})`);
      }
      
      return parts.length > 0 ? parts.join(', ') : 'As directed';
    }
    
    return 'As directed';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading patients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl text-gray-900">My Patients</h1>
          <p className="text-gray-600 mt-1">Manage and view your patient records</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-lg px-4 py-2">
            <Users className="w-4 h-4 mr-2" />
            {patients.length} Patients
          </Badge>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="sm:w-auto">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Patients List */}
      {filteredPatients.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl text-gray-900 mb-2">
              {searchTerm ? 'No patients found' : 'No patients yet'}
            </h3>
            <p className="text-gray-600">
              {searchTerm 
                ? 'Try adjusting your search criteria' 
                : 'Patients will appear here once they book appointments with you'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPatients.map((patient) => (
            <Card 
              key={patient.id} 
              className="glass-card hover:shadow-lg transition-all cursor-pointer"
              onClick={() => handlePatientClick(patient.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Avatar className="w-14 h-14 bg-primary/10 text-primary">
                    <AvatarFallback>{getInitials(patient.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-gray-900 truncate">
                      {patient.fullName}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {patient.gender} • {calculateAge(patient.dateOfBirth)} years
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {patient.bloodGroup}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center text-sm text-gray-600">
                    <Phone className="w-4 h-4 mr-2 text-gray-400" />
                    {patient.phone}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="truncate">{patient.email}</span>
                  </div>
                  {patient.lastVisit && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                      Last visit: {formatDate(patient.lastVisit)}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between text-sm">
                  <div className="text-center">
                    <div className="text-primary">{patient.totalAppointments}</div>
                    <div className="text-gray-600 text-xs">Appointments</div>
                  </div>
                  <div className="text-center">
                    <div className="text-primary">{getPrescriptionsForPatient(patient.id).length}</div>
                    <div className="text-gray-600 text-xs">Prescriptions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-primary">{getReportsForPatient(patient.id).length}</div>
                    <div className="text-gray-600 text-xs">Reports</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Patient Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="!max-w-none w-[100vw] h-[100vh] sm:w-[95vw] sm:h-[95vh] lg:w-[90vw] lg:h-[90vh] xl:w-[85vw] 2xl:w-[1480px] max-h-[100vh] sm:max-h-[95vh] overflow-hidden p-0">
          <div className="flex flex-col md:flex-row h-full">
            {/* Left Sidebar - Patient Info & Stats */}
            <div className="w-full md:w-[240px] lg:w-[280px] xl:w-[320px] flex-shrink-0 md:border-r border-border bg-muted/30 flex flex-col overflow-hidden">
              <div className="p-3 sm:p-4 pb-2 sm:pb-3 border-b border-border flex-shrink-0">
                <DialogHeader>
                  <DialogTitle className="text-sm sm:text-base lg:text-lg">Patient Details</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    Complete medical history
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="flex-1 overflow-y-auto p-2 sm:p-3 min-h-0 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-400 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-500">

              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : selectedPatient ? (
                <div className="space-y-2 pb-2">
                  {/* Patient Avatar & Basic Info */}
                  <Card>
                    <CardContent className="p-2 sm:p-2.5 lg:p-3">
                      <div className="flex flex-col items-center text-center mb-2">
                        <Avatar className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-primary/10 text-primary mb-1.5">
                          <AvatarFallback className="text-sm sm:text-base lg:text-lg">
                            {getInitials(selectedPatient.patient.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <h3 className="text-xs sm:text-sm lg:text-base leading-tight">{selectedPatient.patient.fullName}</h3>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {calculateAge(selectedPatient.patient.dateOfBirth)} years • {selectedPatient.patient.gender}
                        </p>
                      </div>
                      
                      <div className="space-y-1.5 pt-2 border-t">
                        <div>
                          <Label className="text-xs text-gray-600">Blood Group</Label>
                          <p className="text-xs">{selectedPatient.patient.bloodGroup}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600">Date of Birth</Label>
                          <p className="text-xs">{formatDate(selectedPatient.patient.dateOfBirth)}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600">Phone</Label>
                          <p className="text-xs flex items-center gap-1.5">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{selectedPatient.patient.phone}</span>
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600">Email</Label>
                          <p className="text-xs flex items-start gap-1.5">
                            <Mail className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            <span className="break-all">{selectedPatient.patient.email}</span>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Stats Cards */}
                  <div className="space-y-1.5">
                    <Card>
                      <CardContent className="p-2 sm:p-2.5 lg:p-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-base sm:text-lg lg:text-xl text-primary">{selectedPatient.stats.totalAppointments}</div>
                            <div className="text-xs text-gray-600 truncate">Appointments</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-2 sm:p-2.5 lg:p-3">
                        <div className="flex items-center gap-2">
                          <Pill className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-green-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-base sm:text-lg lg:text-xl text-green-500">{selectedPatient.stats.totalPrescriptions}</div>
                            <div className="text-xs text-gray-600 truncate">Prescriptions</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-2 sm:p-2.5 lg:p-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-blue-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-base sm:text-lg lg:text-xl text-blue-500">{selectedPatient.stats.totalReports}</div>
                            <div className="text-xs text-gray-600 truncate">Medical Reports</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : null}
              </div>
            </div>

            {/* Right Content Area - Tabs */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {!loadingDetails && selectedPatient ? (
                <Tabs defaultValue="prescriptions" className="flex flex-col h-full">
                  <div className="border-b border-border px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4 lg:pt-6 pb-2 sm:pb-3 flex-shrink-0">
                    <TabsList className="grid w-full grid-cols-3 max-w-2xl h-9 sm:h-10">
                      <TabsTrigger value="prescriptions" className="text-xs sm:text-sm px-2 sm:px-4">
                        <Pill className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Prescriptions</span>
                        <span className="sm:hidden">Rx</span>
                      </TabsTrigger>
                      <TabsTrigger value="appointments" className="text-xs sm:text-sm px-2 sm:px-4">
                        <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Appointments</span>
                        <span className="sm:hidden">Appt</span>
                      </TabsTrigger>
                      <TabsTrigger value="reports" className="text-xs sm:text-sm px-2 sm:px-4">
                        <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        <span className="hidden lg:inline">Reports</span>
                        <span className="lg:hidden">Rep</span>
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6 min-h-0 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-400 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-500">
                    <TabsContent value="prescriptions" className="mt-0 space-y-3 sm:space-y-4">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <h3 className="text-sm sm:text-base lg:text-lg">Prescription History</h3>
                        <Button onClick={handleOpenAddPrescription} size="sm" className="text-xs sm:text-sm h-8 sm:h-9">
                          <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                          <span className="hidden sm:inline">Add Prescription</span>
                          <span className="sm:hidden">Add</span>
                        </Button>
                      </div>

                      {selectedPatient.prescriptions.length === 0 ? (
                        <div className="text-center py-8 sm:py-12 text-gray-500">
                          <Pill className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-3 text-gray-300" />
                          <p className="text-sm">No prescriptions yet</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                          {selectedPatient.prescriptions.map((prescription: any) => (
                            <Card key={prescription.id} className="h-fit">
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex-1">
                                    <p className="text-gray-900">{prescription.diagnosis}</p>
                                    <p className="text-sm text-gray-500">{formatDate(prescription.prescribedDate)}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={prescription.status === 'active' ? 'default' : 'secondary'}>
                                      {prescription.status}
                                    </Badge>
                                  </div>
                                </div>

                                {/* Medicines */}
                                {prescription.medicines && prescription.medicines.length > 0 && (
                                  <div className="space-y-2 mb-3">
                                    <Label className="text-xs text-gray-600">Medicines:</Label>
                                    {prescription.medicines.map((med: any, idx: number) => (
                                      <div key={idx} className="bg-gray-50 p-2 rounded">
                                        <p className="text-sm">
                                          <span className="text-gray-900">{med.name}</span> - {med.dosage}
                                        </p>
                                        <p className="text-xs text-gray-600">
                                          {formatFrequency(med.frequency)} • {med.duration}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2 pt-3 border-t">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => handleOpenEditPrescription(prescription)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setPrescriptionToDelete({
                                      id: prescription.id,
                                      diagnosis: prescription.diagnosis
                                    })}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="appointments" className="mt-0 space-y-3 sm:space-y-4">
                      {selectedPatient.appointments.length === 0 ? (
                        <div className="text-center py-8 sm:py-12 text-gray-500">
                          <Calendar className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-3 text-gray-300" />
                          <p className="text-sm">No appointments yet</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                          {selectedPatient.appointments.map((appointment: any) => (
                            <Card key={appointment.id}>
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex-1">
                                    <p className="text-gray-900">{appointment.reasonForVisit}</p>
                                    <p className="text-sm text-gray-500 mt-1">
                                      {formatDate(appointment.appointmentDate)}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      {appointment.appointmentTime}
                                    </p>
                                    <p className="text-sm text-gray-500 capitalize mt-1">{appointment.appointmentType}</p>
                                  </div>
                                  <Badge variant={appointment.status === 'confirmed' ? 'default' : 'secondary'}>
                                    {appointment.status}
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="reports" className="mt-0 space-y-3 sm:space-y-4">
                      {(() => {
                        // Get reports for this patient
                        const patientReports = selectedPatient ? getReportsForPatient(selectedPatient.patient.id) : [];
                        
                        if (patientReports.length === 0) {
                          return (
                            <div className="text-center py-8 sm:py-12 text-gray-500">
                              <FileText className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-3 text-gray-300" />
                              <p className="text-sm">No medical reports yet</p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3 sm:space-y-4">
                            {patientReports.map((report: StoredReport) => {
                              const isExpanded = expandedReports.has(report.id);
                              const toggleExpand = () => {
                                setExpandedReports(prev => {
                                  const next = new Set(prev);
                                  if (next.has(report.id)) {
                                    next.delete(report.id);
                                  } else {
                                    next.add(report.id);
                                  }
                                  return next;
                                });
                              };

                              return (
                                <Card key={report.id} className="overflow-hidden">
                                  <CardHeader 
                                    className="bg-gradient-to-r from-primary/5 to-primary/10 p-3 sm:p-4 lg:p-6 pb-3 sm:pb-4 cursor-pointer hover:from-primary/10 hover:to-primary/15 transition-colors"
                                    onClick={toggleExpand}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <CardTitle className="flex items-center gap-2 text-sm sm:text-base lg:text-lg">
                                          <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                                          <span className="truncate">{report.fileName}</span>
                                          {isExpanded ? (
                                            <ChevronUp className="w-4 h-4 text-gray-500 ml-auto flex-shrink-0" />
                                          ) : (
                                            <ChevronDown className="w-4 h-4 text-gray-500 ml-auto flex-shrink-0" />
                                          )}
                                        </CardTitle>
                                        <CardDescription className="mt-1.5 sm:mt-2 flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-1 text-xs">
                                          <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3 flex-shrink-0" />
                                            {new Date(report.reportDate).toLocaleDateString('en-IN')}
                                          </span>
                                          <span className="capitalize">{report.reportType.replace('-', ' ')}</span>
                                          {report.labName && <span className="hidden sm:inline">• {report.labName}</span>}
                                          {report.cost && <span className="hidden sm:inline">• {report.cost}</span>}
                                        </CardDescription>
                                      </div>
                                      <Badge 
                                        variant={report.status === 'analyzed' || report.status === 'reviewed' ? 'default' : 'secondary'}
                                        className="capitalize text-xs flex-shrink-0"
                                      >
                                        {report.status === 'analyzing' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                                        {report.status === 'analyzed' && <CheckCircle className="w-3 h-3 mr-1" />}
                                        <span className="hidden sm:inline">{report.status}</span>
                                      </Badge>
                                    </div>
                                  </CardHeader>

                                {isExpanded && report.aiAnalysis && (
                                  <CardContent className="pt-4 sm:pt-6 space-y-4 sm:space-y-6 max-h-[60vh] overflow-y-auto p-3 sm:p-4 lg:p-6 [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:bg-gray-200 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/60 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-primary">
                                    {/* AI Analysis Header */}
                                    <div className="flex items-center gap-2 pb-2 border-b flex-wrap">
                                      <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                                      <h4 className="text-sm sm:text-base font-semibold text-gray-900">AI Analysis Report</h4>
                                      <Badge variant="outline" className="ml-auto text-xs">
                                        {report.aiAnalysis.reportType || 'Medical Report'}
                                      </Badge>
                                    </div>

                                    {/* Summary */}
                                    <div className="space-y-2">
                                      <Label className="text-xs sm:text-sm font-semibold text-gray-700">Summary</Label>
                                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                                        <p className="text-xs sm:text-sm text-gray-800 leading-relaxed">
                                          {report.aiAnalysis.summary}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Health Parameters */}
                                    {report.aiAnalysis.parameters && report.aiAnalysis.parameters.length > 0 && (
                                      <div className="space-y-2 sm:space-y-3">
                                        <Label className="text-xs sm:text-sm font-semibold text-gray-700">Health Parameters</Label>
                                        <div className="border rounded-lg overflow-hidden">
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-xs sm:text-sm">
                                              <thead className="bg-gray-50 border-b">
                                                <tr>
                                                  <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-semibold text-gray-700">Parameter</th>
                                                  <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-semibold text-gray-700">Value</th>
                                                  <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-semibold text-gray-700 hidden sm:table-cell">Range</th>
                                                  <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-semibold text-gray-700 hidden lg:table-cell">Category</th>
                                                  <th className="text-center px-2 sm:px-4 py-2 sm:py-3 font-semibold text-gray-700">Status</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y">
                                                {report.aiAnalysis.parameters.map((param: any, idx: number) => (
                                                  <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-gray-900">{param.name}</td>
                                                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-800">
                                                      <span className="font-semibold">{param.value}</span> {param.unit}
                                                    </td>
                                                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-600 hidden sm:table-cell">{param.normalRange}</td>
                                                    <td className="px-2 sm:px-4 py-2 sm:py-3 hidden lg:table-cell">
                                                      <Badge variant="outline" className="text-xs">
                                                        {param.category}
                                                      </Badge>
                                                    </td>
                                                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                                                      {param.status === 'normal' && (
                                                        <Badge className="bg-green-100 text-green-800 border-green-200">
                                                          <CheckCircle className="w-3 h-3 mr-1" />
                                                          Normal
                                                        </Badge>
                                                      )}
                                                      {param.status === 'high' && (
                                                        <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                                                          <TrendingUp className="w-3 h-3 mr-1" />
                                                          High
                                                        </Badge>
                                                      )}
                                                      {param.status === 'low' && (
                                                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                                                          <TrendingDown className="w-3 h-3 mr-1" />
                                                          Low
                                                        </Badge>
                                                      )}
                                                      {param.status === 'critical' && (
                                                        <Badge className="bg-red-100 text-red-800 border-red-200">
                                                          <AlertCircle className="w-3 h-3 mr-1" />
                                                          Critical
                                                        </Badge>
                                                      )}
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Risk Factors */}
                                    {report.aiAnalysis.riskFactors && report.aiAnalysis.riskFactors.length > 0 && (
                                      <div className="space-y-3">
                                        <Label className="text-sm font-semibold text-gray-700">Risk Factors</Label>
                                        <div className="space-y-3">
                                          {report.aiAnalysis.riskFactors.map((risk: any, idx: number) => (
                                            <div 
                                              key={idx} 
                                              className={`border rounded-lg p-4 ${
                                                risk.severity === 'critical' ? 'bg-red-50 border-red-200' :
                                                risk.severity === 'high' ? 'bg-orange-50 border-orange-200' :
                                                risk.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                                                'bg-blue-50 border-blue-200'
                                              }`}
                                            >
                                              <div className="flex items-start gap-3">
                                                <div className="mt-0.5">
                                                  {risk.severity === 'critical' && <AlertCircle className="w-5 h-5 text-red-600" />}
                                                  {risk.severity === 'high' && <AlertCircle className="w-5 h-5 text-orange-600" />}
                                                  {risk.severity === 'medium' && <AlertCircle className="w-5 h-5 text-yellow-600" />}
                                                  {risk.severity === 'low' && <Activity className="w-5 h-5 text-blue-600" />}
                                                </div>
                                                <div className="flex-1">
                                                  <div className="flex items-center gap-2 mb-2">
                                                    <h5 className="font-semibold text-gray-900">{risk.title}</h5>
                                                    <Badge 
                                                      variant="outline" 
                                                      className={`text-xs capitalize ${
                                                        risk.severity === 'critical' ? 'bg-red-100 text-red-800 border-red-300' :
                                                        risk.severity === 'high' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                                                        risk.severity === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                                        'bg-blue-100 text-blue-800 border-blue-300'
                                                      }`}
                                                    >
                                                      {risk.severity} Risk
                                                    </Badge>
                                                  </div>
                                                  <p className="text-sm text-gray-700 mb-2">{risk.description}</p>
                                                  <div className="bg-white/50 rounded p-2 mt-2">
                                                    <p className="text-sm font-medium text-gray-700">
                                                      <span className="text-gray-600">Recommendation: </span>
                                                      {risk.recommendation}
                                                    </p>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Recommendations */}
                                    {report.aiAnalysis.recommendations && report.aiAnalysis.recommendations.length > 0 && (
                                      <div className="space-y-3">
                                        <Label className="text-sm font-semibold text-gray-700">AI Recommendations</Label>
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                          <ul className="space-y-2">
                                            {report.aiAnalysis.recommendations.map((rec: string, idx: number) => (
                                              <li key={idx} className="flex items-start gap-2 text-sm text-gray-800">
                                                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                                <span>{rec}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      </div>
                                    )}

                                    {/* Doctor Notes Section */}
                                    {report.doctorNotes && (
                                      <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-gray-700">Doctor's Notes</Label>
                                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                          <p className="text-gray-800">{report.doctorNotes}</p>
                                        </div>
                                      </div>
                                    )}

                                    {/* Analysis Date */}
                                    {report.aiAnalysis.analyzedAt && (
                                      <div className="pt-3 border-t text-xs text-gray-500 flex items-center gap-2">
                                        <Brain className="w-3 h-3" />
                                        Analysis performed on {new Date(report.aiAnalysis.analyzedAt).toLocaleString('en-IN')}
                                      </div>
                                    )}
                                  </CardContent>
                                )}

                                {isExpanded && !report.aiAnalysis && report.status !== 'analyzing' && (
                                  <CardContent className="pt-4">
                                    <div className="text-center py-8 text-gray-500">
                                      <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                      <p>AI analysis not available for this report</p>
                                    </div>
                                  </CardContent>
                                )}

                                {isExpanded && report.status === 'analyzing' && (
                                  <CardContent className="pt-4">
                                    <div className="text-center py-8 text-primary">
                                      <Brain className="w-12 h-12 mx-auto mb-2 animate-pulse" />
                                      <p>AI analysis in progress...</p>
                                    </div>
                                  </CardContent>
                                )}
                              </Card>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </TabsContent>
                  </div>
                </Tabs>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Prescription Dialog */}
      <Dialog open={showPrescriptionDialog} onOpenChange={(open) => {
        setShowPrescriptionDialog(open);
        if (!open) resetPrescriptionForm();
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Edit Prescription' : 'Add New Prescription'}</DialogTitle>
            <DialogDescription>
              {selectedPatient && `${isEditMode ? 'Update' : 'Create'} a prescription for ${selectedPatient.patient.fullName}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Diagnosis */}
            <div className="space-y-2">
              <Label htmlFor="diagnosis">Diagnosis *</Label>
              <Input
                id="diagnosis"
                placeholder="Enter diagnosis..."
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
              />
            </div>

            {/* Medicines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Medicines *</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddMedicine}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Medicine
                </Button>
              </div>

              {medicines.map((medicine, index) => (
                <Card key={index} className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <h4 className="text-sm">Medicine {index + 1}</h4>
                      {medicines.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMedicine(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`medicine-name-${index}`}>Medicine Name</Label>
                        <Input
                          id={`medicine-name-${index}`}
                          placeholder="e.g., Paracetamol"
                          value={medicine.name}
                          onChange={(e) => handleMedicineChange(index, 'name', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`medicine-dosage-${index}`}>Dosage</Label>
                        <Input
                          id={`medicine-dosage-${index}`}
                          placeholder="e.g., 500mg"
                          value={medicine.dosage}
                          onChange={(e) => handleMedicineChange(index, 'dosage', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Frequency */}
                    <div>
                      <Label className="mb-3 block">Frequency</Label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Breakfast */}
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600">Breakfast</p>
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`breakfast-before-${index}`}
                                checked={medicine.frequency.breakfast.before}
                                onCheckedChange={(checked) => 
                                  handleFrequencyChange(index, 'breakfast', 'before', checked as boolean)
                                }
                              />
                              <label htmlFor={`breakfast-before-${index}`} className="text-sm">
                                Before
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`breakfast-after-${index}`}
                                checked={medicine.frequency.breakfast.after}
                                onCheckedChange={(checked) => 
                                  handleFrequencyChange(index, 'breakfast', 'after', checked as boolean)
                                }
                              />
                              <label htmlFor={`breakfast-after-${index}`} className="text-sm">
                                After
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* Lunch */}
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600">Lunch</p>
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`lunch-before-${index}`}
                                checked={medicine.frequency.lunch.before}
                                onCheckedChange={(checked) => 
                                  handleFrequencyChange(index, 'lunch', 'before', checked as boolean)
                                }
                              />
                              <label htmlFor={`lunch-before-${index}`} className="text-sm">
                                Before
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`lunch-after-${index}`}
                                checked={medicine.frequency.lunch.after}
                                onCheckedChange={(checked) => 
                                  handleFrequencyChange(index, 'lunch', 'after', checked as boolean)
                                }
                              />
                              <label htmlFor={`lunch-after-${index}`} className="text-sm">
                                After
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* Dinner */}
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600">Dinner</p>
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`dinner-before-${index}`}
                                checked={medicine.frequency.dinner.before}
                                onCheckedChange={(checked) => 
                                  handleFrequencyChange(index, 'dinner', 'before', checked as boolean)
                                }
                              />
                              <label htmlFor={`dinner-before-${index}`} className="text-sm">
                                Before
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`dinner-after-${index}`}
                                checked={medicine.frequency.dinner.after}
                                onCheckedChange={(checked) => 
                                  handleFrequencyChange(index, 'dinner', 'after', checked as boolean)
                                }
                              />
                              <label htmlFor={`dinner-after-${index}`} className="text-sm">
                                After
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`medicine-duration-${index}`}>Duration</Label>
                        <Input
                          id={`medicine-duration-${index}`}
                          placeholder="e.g., 7 days"
                          value={medicine.duration}
                          onChange={(e) => handleMedicineChange(index, 'duration', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`medicine-refills-${index}`}>Refills</Label>
                        <Input
                          id={`medicine-refills-${index}`}
                          type="number"
                          min="0"
                          placeholder="0"
                          value={medicine.refills}
                          onChange={(e) => handleMedicineChange(index, 'refills', parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Lab Tests */}
            <div className="space-y-2">
              <Label htmlFor="labTests">Lab Tests (Optional)</Label>
              <Textarea
                id="labTests"
                placeholder="Enter recommended lab tests..."
                value={labTests}
                onChange={(e) => setLabTests(e.target.value)}
                rows={3}
              />
            </div>

            {/* Instructions */}
            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions (Optional)</Label>
              <Textarea
                id="instructions"
                placeholder="Enter special instructions for the patient..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
              />
            </div>

            {/* Follow-up Date */}
            <div className="space-y-2">
              <Label htmlFor="followUpDate">Follow-up Date (Optional)</Label>
              <Input
                id="followUpDate"
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPrescriptionDialog(false);
                  resetPrescriptionForm();
                }}
                disabled={submittingPrescription}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitPrescription}
                disabled={submittingPrescription}
              >
                {submittingPrescription ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isEditMode ? 'Updating...' : 'Adding...'}
                  </>
                ) : (
                  <>
                    {isEditMode ? (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        Update Prescription
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Prescription
                      </>
                    )}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Prescription Confirmation Dialog */}
      <AlertDialog open={prescriptionToDelete !== null} onOpenChange={(open) => !open && setPrescriptionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prescription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the prescription for <strong>{prescriptionToDelete?.diagnosis}</strong>? This will permanently remove all medicines, lab tests, and instructions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingPrescription}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePrescription}
              disabled={deletingPrescription}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingPrescription ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Prescription
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
