import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Calendar, 
  User, 
  Clock, 
  Pill,
  Download,
  Edit,
  Trash2,
  Eye,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useAuth } from '../../contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { getPrescriptionsForPatient, initializeDemoPrescriptions } from '../../utils/prescriptionService';
import { formatFrequency as formatFrequencyUtil } from '../../utils/formatters';
import jsPDF from 'jspdf';
import { toast } from 'sonner@2.0.3';

interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

interface Prescription {
  id: string;
  patientName: string;
  doctorName: string;
  doctorSpecialization: string;
  diagnosis: string;
  medicines: Medicine[];
  prescribedDate: string;
  status: 'active' | 'completed' | 'cancelled';
}

// Mock data
const mockPrescriptions: Prescription[] = [
  {
    id: '1',
    patientName: 'Arjun Sharma',
    doctorName: 'Dr. Priya Sharma',
    doctorSpecialization: 'Cardiologist',
    diagnosis: 'Hypertension',
    medicines: [
      {
        name: 'Telmisartan',
        dosage: '40mg',
        frequency: 'Once daily',
        duration: '30 days'
      },
      {
        name: 'Aspirin',
        dosage: '75mg',
        frequency: 'Once daily',
        duration: '30 days'
      }
    ],
    prescribedDate: '2025-01-05',
    status: 'active'
  },
  {
    id: '2',
    patientName: 'Kavya Iyer',
    doctorName: 'Dr. Rajesh Kumar',
    doctorSpecialization: 'General Physician',
    diagnosis: 'Common Cold',
    medicines: [
      {
        name: 'Paracetamol',
        dosage: '500mg',
        frequency: 'Three times daily',
        duration: '3 days'
      },
      {
        name: 'Cetirizine',
        dosage: '10mg',
        frequency: 'Once daily at bedtime',
        duration: '5 days'
      }
    ],
    prescribedDate: '2025-01-08',
    status: 'active'
  },
  {
    id: '3',
    patientName: 'Rohit Verma',
    doctorName: 'Dr. Priya Sharma',
    doctorSpecialization: 'Cardiologist',
    diagnosis: 'Vitamin D Deficiency',
    medicines: [
      {
        name: 'Vitamin D3',
        dosage: '60000 IU',
        frequency: 'Once weekly',
        duration: '8 weeks'
      }
    ],
    prescribedDate: '2024-12-20',
    status: 'completed'
  }
];

export const PrescriptionsPage: React.FC = () => {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Load prescriptions for the logged-in patient
  useEffect(() => {
    const loadPrescriptions = () => {
      if (user?.id && user?.role === 'patient') {
        // Initialize demo prescriptions if needed
        initializeDemoPrescriptions();
        
        // Fetch prescriptions for this patient
        const patientPrescriptions = getPrescriptionsForPatient(user.id);
        
        // Map to the Prescription interface expected by the UI
        const mappedPrescriptions: Prescription[] = patientPrescriptions.map(p => ({
          id: p.id,
          patientName: p.patientName,
          doctorName: p.doctorName,
          doctorSpecialization: 'General Physician', // You can add this to the prescription type later
          diagnosis: p.diagnosis,
          medicines: p.medicines.map((m: any) => ({
            name: m.name,
            dosage: m.dosage,
            frequency: formatFrequencyUtil(m.frequency),
            duration: m.duration
          })),
          prescribedDate: p.prescribedDate,
          status: p.status
        }));
        
        setPrescriptions(mappedPrescriptions);
      }
    };

    loadPrescriptions();

    // Listen for storage changes (when prescriptions are added/updated from another tab or component)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'clinic-prescriptions') {
        loadPrescriptions();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events within the same tab
    const handlePrescriptionUpdate = () => {
      loadPrescriptions();
    };
    
    window.addEventListener('prescriptionUpdated', handlePrescriptionUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('prescriptionUpdated', handlePrescriptionUpdate);
    };
  }, [user]);

  // Filter prescriptions based on user role and search
  const filteredPrescriptions = prescriptions.filter(p => {
    // Role-based filtering (in real app, would filter by user ID)
    const matchesRole = user?.role === 'patient' 
      ? p.patientName === user?.fullName 
      : true;
    
    // Search filter
    const matchesSearch = !searchTerm || 
      p.diagnosis.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.doctorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.medicines.some(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    
    return matchesRole && matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'completed':
        return <XCircle className="w-4 h-4 text-gray-500" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-success/10 text-success border-success/20';
      case 'completed':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'cancelled':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const handleViewDetails = (prescription: Prescription) => {
    setSelectedPrescription(prescription);
    setIsDetailsOpen(true);
  };

  const handleDownloadPrescription = (prescription: Prescription) => {
    try {
      // Create new PDF document
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Header - Clinic Name
      doc.setFillColor(59, 130, 246); // Primary blue color
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.text('Clyncix', pageWidth / 2, 15, { align: 'center' });
      
      doc.setFontSize(10);
      doc.text('Complete Healthcare Solutions', pageWidth / 2, 23, { align: 'center' });
      doc.text('Navi Mumbai, India | Phone: +91 98765 43210 | Email: contact@clyncix.com', pageWidth / 2, 29, { align: 'center' });

      yPosition = 45;

      // Title
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(18);
      doc.text('PRESCRIPTION', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      // Prescription metadata
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Prescription ID: ${prescription.id}`, 15, yPosition);
      doc.text(`Date: ${formatDate(prescription.prescribedDate)}`, pageWidth - 15, yPosition, { align: 'right' });
      yPosition += 10;

      // Divider line
      doc.setDrawColor(200, 200, 200);
      doc.line(15, yPosition, pageWidth - 15, yPosition);
      yPosition += 10;

      // Patient Details Section
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Patient Information', 15, yPosition);
      yPosition += 7;

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`Name: ${prescription.patientName}`, 20, yPosition);
      yPosition += 6;
      
      // Doctor Details Section
      yPosition += 5;
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Doctor Information', 15, yPosition);
      yPosition += 7;

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`Name: ${prescription.doctorName}`, 20, yPosition);
      yPosition += 6;
      if (prescription.doctorSpecialization) {
        doc.text(`Specialization: ${prescription.doctorSpecialization}`, 20, yPosition);
        yPosition += 6;
      }

      // Diagnosis Section
      yPosition += 5;
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Diagnosis', 15, yPosition);
      yPosition += 7;

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(prescription.diagnosis, 20, yPosition);
      yPosition += 10;

      // Medicines Table Header
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Prescribed Medications', 15, yPosition);
      yPosition += 7;

      // Draw table manually
      const tableStartY = yPosition;
      const margin = 15;
      const tableWidth = pageWidth - (margin * 2);
      const colWidths = [15, 60, 30, 50, 25]; // #, Medicine, Dosage, Frequency, Duration
      const rowHeight = 8;

      // Table header background
      doc.setFillColor(59, 130, 246);
      doc.rect(margin, yPosition, tableWidth, rowHeight, 'F');

      // Table header text
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      let xPos = margin + 2;
      doc.text('#', xPos + 5, yPosition + 5.5);
      xPos += colWidths[0];
      doc.text('Medicine Name', xPos + 2, yPosition + 5.5);
      xPos += colWidths[1];
      doc.text('Dosage', xPos + 2, yPosition + 5.5);
      xPos += colWidths[2];
      doc.text('Frequency', xPos + 2, yPosition + 5.5);
      xPos += colWidths[3];
      doc.text('Duration', xPos + 2, yPosition + 5.5);

      yPosition += rowHeight;

      // Table rows
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(9);
      prescription.medicines.forEach((med, index) => {
        // Alternate row colors
        if (index % 2 === 0) {
          doc.setFillColor(245, 245, 245);
          doc.rect(margin, yPosition, tableWidth, rowHeight, 'F');
        }

        xPos = margin + 2;
        doc.text((index + 1).toString(), xPos + 5, yPosition + 5.5);
        xPos += colWidths[0];
        
        // Truncate medicine name if too long
        const medName = med.name.length > 25 ? med.name.substring(0, 22) + '...' : med.name;
        doc.text(medName, xPos + 2, yPosition + 5.5);
        xPos += colWidths[1];
        
        doc.text(med.dosage, xPos + 2, yPosition + 5.5);
        xPos += colWidths[2];
        
        // Truncate frequency if too long
        const freq = med.frequency.length > 20 ? med.frequency.substring(0, 17) + '...' : med.frequency;
        doc.text(freq, xPos + 2, yPosition + 5.5);
        xPos += colWidths[3];
        
        doc.text(med.duration, xPos + 2, yPosition + 5.5);

        yPosition += rowHeight;
      });

      // Table border
      doc.setDrawColor(200, 200, 200);
      doc.rect(margin, tableStartY, tableWidth, yPosition - tableStartY);

      // Draw column separators
      xPos = margin;
      for (let i = 0; i < colWidths.length - 1; i++) {
        xPos += colWidths[i];
        doc.line(xPos, tableStartY, xPos, yPosition);
      }

      yPosition += 10;

      // Additional Instructions
      if (yPosition < pageHeight - 50) {
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text('General Instructions:', 15, yPosition);
        yPosition += 6;
        
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        doc.text('• Take medicines as prescribed', 20, yPosition);
        yPosition += 5;
        doc.text('• Complete the full course of medication', 20, yPosition);
        yPosition += 5;
        doc.text('• Consult doctor if symptoms persist or worsen', 20, yPosition);
        yPosition += 5;
        doc.text('• Store medicines in a cool, dry place', 20, yPosition);
        yPosition += 10;
      }

      // Footer with signature
      const footerY = pageHeight - 30;
      doc.setDrawColor(200, 200, 200);
      doc.line(15, footerY, pageWidth - 15, footerY);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('This is a digitally generated prescription', 15, footerY + 6);
      
      // Doctor's signature line
      doc.text('_____________________', pageWidth - 60, footerY + 15);
      doc.text("Doctor's Signature", pageWidth - 60, footerY + 20);

      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, footerY + 20, { align: 'center' });

      // Save the PDF
      const fileName = `Prescription_${prescription.patientName.replace(/\s+/g, '_')}_${prescription.prescribedDate}.pdf`;
      doc.save(fileName);
      
      toast.success('Prescription downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate prescription PDF. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const stats = {
    total: filteredPrescriptions.length,
    active: filteredPrescriptions.filter(p => p.status === 'active').length,
    completed: filteredPrescriptions.filter(p => p.status === 'completed').length,
    cancelled: filteredPrescriptions.filter(p => p.status === 'cancelled').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl text-gray-900">
            {user?.role === 'doctor' ? 'Patient Prescriptions' : 'My Prescriptions'}
          </h1>
          <p className="text-gray-600 mt-1">
            {user?.role === 'doctor' 
              ? 'Manage and track all patient prescriptions'
              : 'View and track your prescribed medications'}
          </p>
        </div>
        {user?.role === 'doctor' && (
          <Button className="glass">
            <Plus className="w-4 h-4 mr-2" />
            New Prescription
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl text-gray-900">{stats.total}</p>
            </div>
            <Pill className="w-8 h-8 text-primary" />
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl text-success">{stats.active}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl text-gray-500">{stats.completed}</p>
            </div>
            <XCircle className="w-8 h-8 text-gray-500" />
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Cancelled</p>
              <p className="text-2xl text-destructive">{stats.cancelled}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search prescriptions, medications, or diagnoses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Prescriptions List */}
      <div className="space-y-4">
        {filteredPrescriptions.length === 0 ? (
          <Card className="glass-card p-8 text-center">
            <Pill className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg text-gray-900 mb-2">No prescriptions found</h3>
            <p className="text-gray-600">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'You have no prescriptions at this time.'}
            </p>
          </Card>
        ) : (
          filteredPrescriptions.map((prescription) => (
            <Card key={prescription.id} className="glass-card p-6 hover:bg-white/20 transition-all duration-200">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg text-gray-900 flex items-center gap-2">
                        {prescription.diagnosis}
                        <Badge className={getStatusColor(prescription.status)}>
                          {getStatusIcon(prescription.status)}
                          <span className="ml-1 capitalize">{prescription.status}</span>
                        </Badge>
                      </h3>
                      <p className="text-gray-600 text-sm">
                        {user?.role === 'patient' ? `Dr. ${prescription.doctorName}` : prescription.patientName}
                        {prescription.doctorSpecialization && ` • ${prescription.doctorSpecialization}`}
                      </p>
                    </div>
                  </div>
                  
                  {/* Medicines */}
                  <div>
                    <Label className="text-xs text-gray-600">Medicines:</Label>
                    <div className="space-y-2 mt-1">
                      {prescription.medicines.map((med, idx) => (
                        <div key={idx} className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-sm">
                            <span className="text-gray-900">{med.name}</span> - {med.dosage}
                          </p>
                          <p className="text-xs text-gray-600">
                            {med.frequency} • {med.duration}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Date and Time */}
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>Prescribed: {formatDate(prescription.prescribedDate)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex lg:flex-col gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewDetails(prescription)}
                    className="flex-1 lg:flex-none"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadPrescription(prescription)}
                    className="flex-1 lg:flex-none"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  {user?.role === 'doctor' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 lg:flex-none"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 lg:flex-none text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Prescription Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prescription Details</DialogTitle>
            <DialogDescription>
              View complete prescription information and medicines
            </DialogDescription>
          </DialogHeader>
          
          {selectedPrescription && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">Patient</Label>
                  <p className="text-gray-900">{selectedPrescription.patientName}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Doctor</Label>
                  <p className="text-gray-900">{selectedPrescription.doctorName}</p>
                  <p className="text-sm text-gray-600">{selectedPrescription.doctorSpecialization}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Diagnosis</Label>
                  <p className="text-gray-900">{selectedPrescription.diagnosis}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Date</Label>
                  <p className="text-gray-900">{formatDate(selectedPrescription.prescribedDate)}</p>
                </div>
              </div>

              {/* Medicines */}
              <div>
                <Label>Prescribed Medicines</Label>
                <div className="space-y-3 mt-2">
                  {selectedPrescription.medicines.map((med, idx) => (
                    <Card key={idx} className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-gray-900">{med.name}</p>
                            <p className="text-sm text-gray-600">{med.dosage}</p>
                          </div>
                          <Badge variant="outline">{med.duration}</Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          <p className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {med.frequency}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <Label className="text-gray-600">Status</Label>
                <div className="mt-2">
                  <Badge className={getStatusColor(selectedPrescription.status)}>
                    {getStatusIcon(selectedPrescription.status)}
                    <span className="ml-2 capitalize">{selectedPrescription.status}</span>
                  </Badge>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  className="flex-1"
                  onClick={() => handleDownloadPrescription(selectedPrescription)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
