import React, { useState, useEffect, useCallback } from 'react';
import { 
  Upload, 
  FileText, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Download,
  Eye,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  Brain,
  Activity,
  Heart,
  Stethoscope,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useAuth } from '../../contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { toast } from 'sonner';
import { analyzeMedicalReport, extractHealthTimelineData, type AnalysisResult } from '../../utils/reportAnalysisService';
import { addMultipleTimelineEntries } from '../../utils/healthTimelineService';
import { 
  getReportsForPatient, 
  getAllPatientReports, 
  addReport, 
  updateReport, 
  deleteReport,
  initializeDemoReports,
  type StoredReport 
} from '../../utils/reportStorageService';
import jsPDF from 'jspdf';

interface MedicalReport {
  id: string;
  patientId: string;
  patientName: string;
  doctorId?: string;
  doctorName?: string;
  fileName: string;
  fileSize: string;
  reportType: 'blood-test' | 'x-ray' | 'mri' | 'ct-scan' | 'ultrasound' | 'pathology' | 'cardiology' | 'other';
  dateUploaded: string;
  reportDate: string;
  status: 'uploaded' | 'analyzing' | 'analyzed' | 'reviewed';
  labName?: string;
  cost?: string;
  aiAnalysis?: AnalysisResult;
  doctorNotes?: string;
}

// Mock data for demonstration
const mockReports: MedicalReport[] = [
  {
    id: '1',
    patientId: 'p1',
    patientName: 'Arjun Singh',
    doctorId: 'd1',
    doctorName: 'Dr. Priya Sharma',
    fileName: 'blood_test_results_jan2024.pdf',
    fileSize: '2.3 MB',
    reportType: 'blood-test',
    dateUploaded: '2024-01-15',
    reportDate: '2024-01-14',
    status: 'analyzed',
    labName: 'SRL Diagnostics',
    cost: '₹1,250',
    aiAnalysis: {
      summary: 'Complete blood count shows normal values across all parameters. Cholesterol levels are within healthy range.',
      keyFindings: [
        'Hemoglobin: 14.2 g/dL (Normal)',
        'White Blood Cell Count: 6,800/μL (Normal)',
        'Total Cholesterol: 185 mg/dL (Good)',
        'Blood Glucose: 92 mg/dL (Normal)'
      ],
      recommendations: [
        'Continue current healthy lifestyle',
        'Regular exercise and balanced diet',
        'Next blood test in 6 months'
      ],
      riskLevel: 'low',
      confidence: 94
    },
    doctorNotes: 'Excellent results. Patient maintaining good health through diet and exercise.'
  },
  {
    id: '2',
    patientId: 'p1',
    patientName: 'Arjun Singh',
    doctorId: 'd2',
    doctorName: 'Dr. Rajesh Kumar',
    fileName: 'chest_xray_december2023.pdf',
    fileSize: '5.7 MB',
    reportType: 'x-ray',
    dateUploaded: '2023-12-20',
    reportDate: '2023-12-18',
    status: 'reviewed',
    labName: 'Apollo Diagnostics',
    cost: '₹600',
    aiAnalysis: {
      summary: 'Chest X-ray shows clear lung fields with no signs of infection or abnormalities.',
      keyFindings: [
        'Clear lung fields bilaterally',
        'Normal heart size and position',
        'No pleural effusion detected',
        'Diaphragm appears normal'
      ],
      recommendations: [
        'No immediate follow-up required',
        'Maintain respiratory health',
        'Annual chest X-ray for monitoring'
      ],
      riskLevel: 'low',
      confidence: 96
    },
    doctorNotes: 'Normal chest X-ray. No concerns at this time.'
  },
  {
    id: '3',
    patientId: 'p2',
    patientName: 'Kavya Iyer',
    doctorId: 'd1',
    doctorName: 'Dr. Priya Sharma',
    fileName: 'mri_brain_scan_jan2024.pdf',
    fileSize: '12.1 MB',
    reportType: 'mri',
    dateUploaded: '2024-01-10',
    reportDate: '2024-01-08',
    status: 'analyzed',
    labName: 'Max Healthcare Diagnostics',
    cost: '₹8,500',
    aiAnalysis: {
      summary: 'Brain MRI shows normal brain structure with no signs of lesions or abnormalities.',
      keyFindings: [
        'Normal brain parenchyma',
        'No mass lesions detected',
        'Ventricular system normal',
        'No signs of hemorrhage or infarction'
      ],
      recommendations: [
        'Symptoms likely non-neurological',
        'Consider stress management',
        'Follow-up if symptoms persist'
      ],
      riskLevel: 'low',
      confidence: 98
    }
  },
  {
    id: '4',
    patientId: 'p1',
    patientName: 'Arjun Singh',
    fileName: 'ecg_report_jan2024.pdf',
    fileSize: '1.8 MB',
    reportType: 'cardiology',
    dateUploaded: '2024-01-12',
    reportDate: '2024-01-12',
    status: 'analyzing',
    labName: 'Fortis Diagnostics',
    cost: '₹800',
    aiAnalysis: {
      summary: 'ECG analysis in progress. Preliminary findings suggest normal sinus rhythm.',
      keyFindings: [
        'Regular rhythm detected',
        'Heart rate: 72 BPM',
        'Analysis 85% complete'
      ],
      recommendations: [],
      riskLevel: 'low',
      confidence: 85
    }
  }
];

export const MedicalReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<MedicalReport[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<MedicalReport | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Load reports from localStorage on mount
  useEffect(() => {
    const loadReports = () => {
      // Initialize demo reports if needed
      initializeDemoReports();
      
      // Load reports based on user role
      let loadedReports: StoredReport[] = [];
      if (user?.role === 'patient' && user?.id) {
        loadedReports = getReportsForPatient(user.id);
      } else if (user?.role === 'doctor') {
        loadedReports = getAllPatientReports();
      }
      
      setReports(loadedReports as MedicalReport[]);
    };

    loadReports();

    // Listen for storage changes (when reports are added/updated from another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'clinic-medical-reports') {
        loadReports();
      }
    };

    // Listen for custom events within the same tab
    const handleReportUpdate = () => {
      loadReports();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('medicalReportUpdated', handleReportUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('medicalReportUpdated', handleReportUpdate);
    };
  }, [user]);

  // Filter reports based on user role and filters
  useEffect(() => {
    let filtered = reports;
    
    // Role-based filtering (already done in load, but keeping for safety)
    if (user?.role === 'patient' && user?.id) {
      filtered = filtered.filter(r => r.patientId === user.id);
    }
    
    // Search filtering
    if (searchTerm) {
      filtered = filtered.filter(r => 
        r.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.doctorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.reportType.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Type filtering
    if (typeFilter !== 'all') {
      filtered = filtered.filter(r => r.reportType === typeFilter);
    }
    
    // Status filtering
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }
    
    setFilteredReports(filtered);
  }, [reports, searchTerm, typeFilter, statusFilter, user]);

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'blood-test':
        return <Activity className="w-4 h-4 text-red-500" />;
      case 'x-ray':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'mri':
        return <Brain className="w-4 h-4 text-purple-500" />;
      case 'ct-scan':
        return <Eye className="w-4 h-4 text-green-500" />;
      case 'cardiology':
        return <Heart className="w-4 h-4 text-red-500" />;
      case 'ultrasound':
        return <Stethoscope className="w-4 h-4 text-blue-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploaded':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'analyzing':
        return <Brain className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'analyzed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'reviewed':
        return <CheckCircle className="w-4 h-4 text-primary" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploaded':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'analyzing':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'analyzed':
        return 'bg-success/10 text-success border-success/20';
      case 'reviewed':
        return 'bg-primary/10 text-primary border-primary/20';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low':
        return 'text-success';
      case 'medium':
        return 'text-warning';
      case 'high':
        return 'text-destructive';
      default:
        return 'text-gray-500';
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Please upload only PDF files');
      return;
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      toast.error('File size too large. Please upload files under 50MB');
      return;
    }

    // Generate unique report ID with timestamp and random string
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const reportDate = new Date().toISOString().split('T')[0];

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    // Wait for upload simulation
    await new Promise(resolve => setTimeout(resolve, 1500));
    clearInterval(interval);
    setUploadProgress(100);
    
    // Create new report object
    const newReport: StoredReport = {
      id: reportId,
      patientId: user?.id || 'demo-patient-1',
      patientName: user?.fullName || 'Current User',
      fileName: file.name,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      reportType: 'other',
      dateUploaded: new Date().toISOString().split('T')[0],
      reportDate: reportDate,
      status: 'analyzing',
      createdAt: new Date().toISOString()
    };
    
    // Save to localStorage and update local state
    addReport(newReport);
    setReports(prev => {
      // Check if report already exists to prevent duplicates
      const exists = prev.some(r => r.id === reportId);
      if (exists) return prev;
      return [newReport as MedicalReport, ...prev];
    });
    setIsUploading(false);
    toast.success('Report uploaded successfully!', {
      description: '🤖 Gemini AI is now analyzing your medical report...'
    });
    
    // Start AI analysis
    try {
      const analysis = await analyzeMedicalReport(file);
      
      const detectedReportType = analysis.reportType.toLowerCase().includes('blood') ? 'blood-test' :
                                 analysis.reportType.toLowerCase().includes('lipid') ? 'cardiology' :
                                 analysis.reportType.toLowerCase().includes('checkup') ? 'other' : 'other';
      
      // Update report in localStorage with analysis results
      updateReport(reportId, {
        status: 'analyzed',
        reportType: detectedReportType,
        aiAnalysis: analysis
      });
      
      // Update local state
      setReports(prev => prev.map(r => 
        r.id === reportId 
          ? {
              ...r, 
              status: 'analyzed' as const,
              reportType: detectedReportType,
              aiAnalysis: analysis
            }
          : r
      ));
      
      // Extract and save to health timeline if applicable
      const timelineData = extractHealthTimelineData(analysis, reportId, reportDate);
      if (timelineData.length > 0 && user?.id) {
        addMultipleTimelineEntries(user.id, timelineData);
        toast.success(`🎉 Gemini AI analysis complete!`, {
          description: `${timelineData.length} health parameters extracted and added to your timeline.`
        });
      } else {
        toast.success('🎉 Gemini AI analysis completed!', {
          description: 'Your medical report has been analyzed successfully.'
        });
      }
      
      // Show warnings for high-risk factors
      const criticalRisks = analysis.riskFactors.filter(r => r.severity === 'critical' || r.severity === 'high');
      if (criticalRisks.length > 0) {
        criticalRisks.forEach(risk => {
          toast.warning(`⚠️ ${risk.title}`, {
            description: risk.description,
            duration: 8000
          });
        });
      }
    } catch (error) {
      console.error('Error analyzing report:', error);
      
      // Update report status in localStorage
      updateReport(reportId, {
        status: 'uploaded'
      });
      
      // Update local state
      setReports(prev => prev.map(r => 
        r.id === reportId 
          ? { ...r, status: 'uploaded' as const }
          : r
      ));
      toast.error('AI analysis failed. You can retry later.');
    }
  };

  const handleViewDetails = (report: MedicalReport) => {
    setSelectedReport(report);
    setIsDetailsOpen(true);
  };

  const handleDownloadReport = (report: MedicalReport) => {
    // Check if AI analysis is available
    if (!report.aiAnalysis) {
      toast.error('AI analysis not available for this report');
      return;
    }

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
      doc.text('AI-Powered Medical Report Analysis', pageWidth / 2, 23, { align: 'center' });
      doc.text('Navi Mumbai, India | Phone: +91-98765-43210 | Email: contact@clyncix.com', pageWidth / 2, 29, { align: 'center' });

      yPosition = 45;

      // Title
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(18);
      doc.text('AI ANALYSIS REPORT', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      // Report metadata
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Report ID: ${report.id}`, 15, yPosition);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, pageWidth - 15, yPosition, { align: 'right' });
      yPosition += 8;

      // Divider line
      doc.setDrawColor(200, 200, 200);
      doc.line(15, yPosition, pageWidth - 15, yPosition);
      yPosition += 10;

      // Patient & Report Details Section
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Patient & Report Information', 15, yPosition);
      yPosition += 7;

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`Patient: ${report.patientName}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Report Type: ${report.aiAnalysis.reportType}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Report Date: ${new Date(report.reportDate).toLocaleDateString('en-IN')}`, 20, yPosition);
      yPosition += 6;
      doc.text(`File: ${report.fileName}`, 20, yPosition);
      yPosition += 10;

      // AI Summary Section
      doc.setFillColor(240, 248, 255);
      doc.rect(15, yPosition, pageWidth - 30, 30, 'F');
      
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('AI Analysis Summary', 20, yPosition + 7);
      yPosition += 13;

      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const summaryLines = doc.splitTextToSize(report.aiAnalysis.summary, pageWidth - 50);
      summaryLines.forEach((line: string) => {
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, 20, yPosition);
        yPosition += 5;
      });
      yPosition += 10;

      // Health Parameters Section
      if (report.aiAnalysis.parameters && report.aiAnalysis.parameters.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('Health Parameters', 15, yPosition);
        yPosition += 7;

        // Parameters table
        const tableStartY = yPosition;
        const margin = 15;
        const tableWidth = pageWidth - (margin * 2);
        const colWidths = [60, 30, 30, 45, 25]; // Name, Value, Unit, Normal Range, Status
        const rowHeight = 8;

        // Table header
        doc.setFillColor(59, 130, 246);
        doc.rect(margin, yPosition, tableWidth, rowHeight, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        let xPos = margin + 2;
        doc.text('Parameter', xPos + 2, yPosition + 5.5);
        xPos += colWidths[0];
        doc.text('Value', xPos + 2, yPosition + 5.5);
        xPos += colWidths[1];
        doc.text('Unit', xPos + 2, yPosition + 5.5);
        xPos += colWidths[2];
        doc.text('Normal Range', xPos + 2, yPosition + 5.5);
        xPos += colWidths[3];
        doc.text('Status', xPos + 2, yPosition + 5.5);

        yPosition += rowHeight;

        // Table rows
        doc.setFontSize(8);
        report.aiAnalysis.parameters.forEach((param, index) => {
          // Check for page break
          if (yPosition > pageHeight - 30) {
            doc.addPage();
            yPosition = 20;
          }

          // Alternate row colors
          if (index % 2 === 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(margin, yPosition, tableWidth, rowHeight, 'F');
          }

          // Set status color
          let statusColor: [number, number, number] = [60, 60, 60];
          if (param.status === 'high' || param.status === 'critical') {
            statusColor = [220, 38, 38];
          } else if (param.status === 'low') {
            statusColor = [234, 179, 8];
          } else if (param.status === 'normal') {
            statusColor = [34, 197, 94];
          }

          xPos = margin + 2;
          doc.setTextColor(60, 60, 60);
          
          const paramName = param.name.length > 25 ? param.name.substring(0, 22) + '...' : param.name;
          doc.text(paramName, xPos + 2, yPosition + 5.5);
          xPos += colWidths[0];
          
          doc.text(param.value, xPos + 2, yPosition + 5.5);
          xPos += colWidths[1];
          
          doc.text(param.unit, xPos + 2, yPosition + 5.5);
          xPos += colWidths[2];
          
          const normalRange = param.normalRange.length > 18 ? param.normalRange.substring(0, 15) + '...' : param.normalRange;
          doc.text(normalRange, xPos + 2, yPosition + 5.5);
          xPos += colWidths[3];
          
          doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
          doc.text(param.status.toUpperCase(), xPos + 2, yPosition + 5.5);

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
      }

      // Risk Factors Section
      if (report.aiAnalysis.riskFactors && report.aiAnalysis.riskFactors.length > 0) {
        // Check for page break
        if (yPosition > pageHeight - 60) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('Risk Factors', 15, yPosition);
        yPosition += 7;

        report.aiAnalysis.riskFactors.forEach((risk) => {
          // Check for page break
          if (yPosition > pageHeight - 40) {
            doc.addPage();
            yPosition = 20;
          }

          // Risk severity badge
          const severityColors = {
            low: [34, 197, 94],
            medium: [234, 179, 8],
            high: [234, 88, 12],
            critical: [220, 38, 38]
          };
          const color = severityColors[risk.severity];
          
          doc.setFillColor(color[0], color[1], color[2]);
          doc.rect(20, yPosition - 3, 20, 6, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(8);
          doc.text(risk.severity.toUpperCase(), 30, yPosition + 1, { align: 'center' });

          doc.setTextColor(0, 0, 0);
          doc.setFontSize(10);
          doc.text(risk.title, 45, yPosition + 1);
          yPosition += 7;

          doc.setFontSize(9);
          doc.setTextColor(60, 60, 60);
          const descLines = doc.splitTextToSize(risk.description, pageWidth - 50);
          descLines.forEach((line: string) => {
            doc.text(line, 25, yPosition);
            yPosition += 5;
          });
          
          doc.setTextColor(0, 100, 200);
          const recLines = doc.splitTextToSize(`> ${risk.recommendation}`, pageWidth - 50);
          recLines.forEach((line: string) => {
            doc.text(line, 25, yPosition);
            yPosition += 5;
          });
          
          yPosition += 5;
        });
      }

      // Recommendations Section
      if (report.aiAnalysis.recommendations && report.aiAnalysis.recommendations.length > 0) {
        // Check for page break
        if (yPosition > pageHeight - 50) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('AI Recommendations', 15, yPosition);
        yPosition += 7;

        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        report.aiAnalysis.recommendations.forEach((rec, index) => {
          if (yPosition > pageHeight - 30) {
            doc.addPage();
            yPosition = 20;
          }
          
          doc.text(`${index + 1}. ${rec}`, 20, yPosition);
          yPosition += 6;
        });
        yPosition += 5;
      }

      // Footer with disclaimer
      const footerY = pageHeight - 25;
      doc.setDrawColor(200, 200, 200);
      doc.line(15, footerY, pageWidth - 15, footerY);
      
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('This AI analysis is for informational purposes only. Please consult with a healthcare professional for medical advice.', pageWidth / 2, footerY + 6, { align: 'center' });
      doc.text(`AI Analysis performed on ${new Date(report.aiAnalysis.analyzedAt).toLocaleString('en-IN')}`, pageWidth / 2, footerY + 11, { align: 'center' });
      doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, footerY + 16, { align: 'center' });

      // Save the PDF
      const fileName = `AI_Analysis_${report.patientName.replace(/\s+/g, '_')}_${report.reportDate}.pdf`;
      doc.save(fileName);
      
      toast.success('AI Analysis report downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate AI analysis PDF. Please try again.');
    }
  };

  const handleDeleteReport = (reportId: string, fileName: string) => {
    if (confirm(`Are you sure you want to delete ${fileName}? This action cannot be undone.`)) {
      const success = deleteReport(reportId);
      if (success) {
        setReports(prev => prev.filter(r => r.id !== reportId));
        toast.success('Report deleted successfully');
        
        // Close details dialog if it's the deleted report
        if (selectedReport?.id === reportId) {
          setIsDetailsOpen(false);
          setSelectedReport(null);
        }
      } else {
        toast.error('Failed to delete report');
      }
    }
  };

  const stats = {
    total: filteredReports.length,
    analyzed: filteredReports.filter(r => r.status === 'analyzed' || r.status === 'reviewed').length,
    analyzing: filteredReports.filter(r => r.status === 'analyzing').length,
    uploaded: filteredReports.filter(r => r.status === 'uploaded').length
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {user?.role === 'doctor' ? 'Patient Medical Reports' : 'My Medical Reports'}
          </h1>
          <p className="text-gray-600 mt-1">
            {user?.role === 'doctor' 
              ? 'Review patient reports and AI analysis results'
              : 'Upload and view your medical reports with AI-powered insights'
            }
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <Card className="glass-card p-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Medical Report</h3>
          <p className="text-gray-600 mb-4">Upload PDF files for AI-powered analysis and insights</p>
          
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 transition-colors ${
              dragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-gray-300 hover:border-primary/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isUploading}
            />
            
            {isUploading ? (
              <div className="space-y-4">
                <Brain className="w-12 h-12 text-primary mx-auto animate-pulse" />
                <div>
                  <p className="text-primary font-medium">Uploading and analyzing...</p>
                  <Progress value={uploadProgress} className="w-64 mx-auto mt-2" />
                  <p className="text-sm text-gray-600 mt-1">{Math.round(uploadProgress)}% complete</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                <div>
                  <p className="text-gray-900 font-medium">Drop your PDF here or click to browse</p>
                  <p className="text-sm text-gray-600">Maximum file size: 50MB</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Reports</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <FileText className="w-8 h-8 text-primary" />
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Analyzed</p>
              <p className="text-2xl font-bold text-success">{stats.analyzed}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Analyzing</p>
              <p className="text-2xl font-bold text-blue-600">{stats.analyzing}</p>
            </div>
            <Brain className="w-8 h-8 text-blue-600" />
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.uploaded}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
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
                placeholder="Search reports, patients, or doctors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="blood-test">Blood Test</SelectItem>
              <SelectItem value="x-ray">X-Ray</SelectItem>
              <SelectItem value="mri">MRI</SelectItem>
              <SelectItem value="ct-scan">CT Scan</SelectItem>
              <SelectItem value="ultrasound">Ultrasound</SelectItem>
              <SelectItem value="cardiology">Cardiology</SelectItem>
              <SelectItem value="pathology">Pathology</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="uploaded">Uploaded</SelectItem>
              <SelectItem value="analyzing">Analyzing</SelectItem>
              <SelectItem value="analyzed">Analyzed</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Reports List */}
      <div className="space-y-4">
        {filteredReports.length === 0 ? (
          <Card className="glass-card p-8 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No reports found</h3>
            <p className="text-gray-600">
              {searchTerm || typeFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Upload your first medical report to get started.'
              }
            </p>
          </Card>
        ) : (
          filteredReports.map((report) => (
            <Card key={report.id} className="glass-card p-6 hover:bg-white/20 transition-all duration-200">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {getReportTypeIcon(report.reportType)}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{report.fileName}</h3>
                        <p className="text-gray-600 capitalize">{report.reportType.replace('-', ' ')}</p>
                      </div>
                      <Badge className={getStatusColor(report.status)}>
                        {getStatusIcon(report.status)}
                        <span className="ml-1 capitalize">{report.status}</span>
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="text-gray-600">Report Date:</span>
                      <span className="font-medium">{new Date(report.reportDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 px-[30px] py-[0px]">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="text-gray-600">Size:</span>
                      <span className="font-medium">{report.fileSize}</span>
                    </div>
                    {user?.role === 'doctor' && (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-primary" />
                        <span className="text-gray-600">Patient:</span>
                        <span className="font-medium">{report.patientName}</span>
                      </div>
                    )}
                    {user?.role === 'patient' && report.doctorName && (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-primary" />
                        <span className="text-gray-600">Doctor:</span>
                        <span className="font-medium">{report.doctorName}</span>
                      </div>
                    )}
                    {report.aiAnalysis && (
                      <div className="flex items-center gap-2 px-[20px] py-[0px]">
                        <Brain className="w-4 h-4 text-primary" />
                        <span className="text-gray-600">AI Confidence:</span>
                        <span className="font-medium">{report.aiAnalysis.confidence}%</span>
                      </div>
                    )}
                  </div>
                  
                  {report.aiAnalysis && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="w-4 h-4 text-primary" />
                        <span className="font-medium text-gray-900">AI Analysis Summary</span>
                        <Badge className="ml-auto bg-blue-100 text-[rgb(0,0,0)] border-blue-200">
                          Risk: {report.aiAnalysis.riskLevel}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700">{report.aiAnalysis.summary}</p>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      Uploaded: {new Date(report.dateUploaded).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetails(report)}
                    className="glass"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadReport(report)}
                    className="glass"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="glass text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteReport(report.id, report.fileName)}
                    title="Delete report"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Report Details Dialog */}
      {selectedReport && (
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="glass-card max-w-6xl sm:max-w-6xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {getReportTypeIcon(selectedReport.reportType)}
                Report Details - {selectedReport.fileName}
              </DialogTitle>
              <DialogDescription>
                View detailed information about this medical report
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Report Type</Label>
                  <p className="capitalize">{selectedReport.reportType.replace('-', ' ')}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Status</Label>
                  <Badge className={`${getStatusColor(selectedReport.status)} mt-1`}>
                    {getStatusIcon(selectedReport.status)}
                    <span className="ml-1 capitalize">{selectedReport.status}</span>
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Report Date</Label>
                  <p>{new Date(selectedReport.reportDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Upload Date</Label>
                  <p>{new Date(selectedReport.dateUploaded).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">File Size</Label>
                  <p>{selectedReport.fileSize}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Patient</Label>
                  <p>{selectedReport.patientName}</p>
                </div>
              </div>

              {/* AI Analysis */}
              {selectedReport.aiAnalysis && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">AI Analysis Results</h3>
                  </div>
                  
                  {/* Summary */}
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Summary</Label>
                    <p className="mt-1 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">{selectedReport.aiAnalysis.summary}</p>
                  </div>

                  {/* Health Parameters */}
                  {selectedReport.aiAnalysis.parameters && selectedReport.aiAnalysis.parameters.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600 mb-3 block">Health Parameters</Label>
                      <div className="space-y-2">
                        {selectedReport.aiAnalysis.parameters
                          .sort((a, b) => {
                            // Define priority order: critical > high/low > normal
                            const getPriority = (status: string) => {
                              if (status === 'critical') return 0;
                              if (status === 'high' || status === 'low') return 1;
                              return 2; // normal
                            };
                            return getPriority(a.status) - getPriority(b.status);
                          })
                          .map((param, index) => (
                          <div key={index} className={`p-3 rounded-lg border ${
                            param.status === 'critical' ? 'bg-red-50 border-red-200' :
                            param.status === 'high' || param.status === 'low' ? 'bg-yellow-50 border-yellow-200' :
                            'bg-green-50 border-green-200'
                          }`}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{param.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {param.category}
                                  </Badge>
                                  {param.status === 'high' && <TrendingUp className="w-4 h-4 text-orange-500" />}
                                  {param.status === 'low' && <TrendingDown className="w-4 h-4 text-orange-500" />}
                                  {param.status === 'critical' && <AlertCircle className="w-4 h-4 text-red-500" />}
                                  {param.status === 'normal' && <CheckCircle className="w-4 h-4 text-green-500" />}
                                </div>
                                <div className="mt-1 text-sm space-y-0.5">
                                  <p><span className="text-gray-600">Value:</span> <span className="font-semibold">{param.value} {param.unit}</span></p>
                                  <p><span className="text-gray-600">Normal Range:</span> {param.normalRange}</p>
                                </div>
                              </div>
                              <Badge className={`${
                                param.status === 'critical' ? 'bg-red-100 text-red-700' :
                                param.status === 'high' || param.status === 'low' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-green-100 text-green-700'
                              } border-0`}>
                                {param.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Risk Factors */}
                  {selectedReport.aiAnalysis.riskFactors && selectedReport.aiAnalysis.riskFactors.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600 mb-3 block">⚠️ Risk Factors & Warnings</Label>
                      <div className="space-y-3">
                        {selectedReport.aiAnalysis.riskFactors.map((risk, index) => (
                          <div key={index} className={`p-4 rounded-lg border ${
                            risk.severity === 'critical' ? 'bg-red-50 border-red-300' :
                            risk.severity === 'high' ? 'bg-orange-50 border-orange-300' :
                            risk.severity === 'medium' ? 'bg-yellow-50 border-yellow-300' :
                            'bg-blue-50 border-blue-300'
                          }`}>
                            <div className="flex items-start gap-3">
                              <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                                risk.severity === 'critical' ? 'text-red-500' :
                                risk.severity === 'high' ? 'text-orange-500' :
                                risk.severity === 'medium' ? 'text-yellow-600' :
                                'text-blue-500'
                              }`} />
                              <div className="flex-1 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="font-semibold text-sm">{risk.title}</h4>
                                  <Badge className={`${
                                    risk.severity === 'critical' ? 'bg-red-600' :
                                    risk.severity === 'high' ? 'bg-orange-500' :
                                    risk.severity === 'medium' ? 'bg-yellow-500' :
                                    'bg-blue-500'
                                  } text-white border-0 text-xs`}>
                                    {risk.severity}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-700">{risk.description}</p>
                                <div className="bg-white/50 p-2 rounded border border-gray-200">
                                  <p className="text-xs font-medium text-gray-600 mb-1">Recommendation:</p>
                                  <p className="text-sm">{risk.recommendation}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {selectedReport.aiAnalysis.recommendations && selectedReport.aiAnalysis.recommendations.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600 mb-2 block">General Recommendations</Label>
                      <ul className="space-y-2">
                        {selectedReport.aiAnalysis.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm p-2 bg-gray-50 rounded">
                            <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Doctor Notes */}
              {selectedReport.doctorNotes && (
                <div>
                  <Label className="text-sm font-medium text-gray-600">Doctor's Notes</Label>
                  <p className="mt-1 p-3 bg-blue-50 rounded-lg text-sm">{selectedReport.doctorNotes}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};