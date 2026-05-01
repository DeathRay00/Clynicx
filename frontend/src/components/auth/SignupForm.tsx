import React, { useState } from 'react';
import { Eye, EyeOff, Heart, Loader2, Check, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner@2.0.3';

interface SignupFormProps {
  onSwitchToLogin: () => void;
}

export const SignupForm: React.FC<SignupFormProps> = ({ onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    role: 'patient' as 'patient' | 'doctor',
    // Patient fields
    dateOfBirth: '',
    gender: '',
    bloodGroup: '',
    // Doctor fields
    medicalLicenseNumber: '',
    specialization: '',
    hospital: '',
    experience: '',
    consultationFee: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordStrength, setPasswordStrength] = useState<{
    hasLength: boolean;
    hasUpper: boolean;
    hasLower: boolean;
    hasNumber: boolean;
  }>({
    hasLength: false,
    hasUpper: false,
    hasLower: false,
    hasNumber: false,
  });

  const { signup } = useAuth();

  const specializations = [
    'General Practitioner',
    'Cardiologist',
    'Dermatologist',
    'Neurologist',
    'Orthopedist',
    'Pediatrician',
    'Psychiatrist',
    'Radiologist',
    'Surgeon',
    'Gynecologist',
    'Other'
  ];

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const checkPasswordStrength = (password: string) => {
    setPasswordStrength({
      hasLength: password.length >= 8,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (field === 'password') {
      checkPasswordStrength(value);
    }
    
    // Clear specific field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Basic validation
    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!formData.phone) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\+?[\d\s-()]{10,}$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    // Password validation
    const isStrongPassword = Object.values(passwordStrength).every(Boolean);
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!isStrongPassword) {
      newErrors.password = 'Password must meet all requirements';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Role-specific validation
    if (formData.role === 'doctor') {
      if (!formData.medicalLicenseNumber) {
        newErrors.medicalLicenseNumber = 'Medical license number is required';
      }
      if (!formData.specialization) {
        newErrors.specialization = 'Specialization is required';
      }
    } else {
      if (!formData.dateOfBirth) {
        newErrors.dateOfBirth = 'Date of birth is required';
      }
      if (!formData.gender) {
        newErrors.gender = 'Gender is required';
      }
    }

    if (!agreeToTerms) {
      newErrors.terms = 'You must agree to the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const result = await signup(formData);
      
      if (result.success) {
        toast.success('Account created successfully! Welcome to the clinic.');
      } else {
        setErrors({ general: result.error || 'Signup failed. Please try again.' });
        toast.error(result.error || 'Signup failed');
      }
    } catch (error) {
      const errorMessage = 'An unexpected error occurred. Please try again.';
      setErrors({ general: errorMessage });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const PasswordRequirement = ({ met, text }: { met: boolean; text: string }) => (
    <div className={`flex items-center space-x-2 text-sm ${met ? 'text-green-600' : 'text-gray-500'}`}>
      {met ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      <span>{text}</span>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="glass-card border-0 shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Heart className="w-8 h-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Create Account</CardTitle>
              <CardDescription className="text-base mt-2">
                Join our clinic management system
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Role Selection */}
              <div className="space-y-3">
                <Label>I am a:</Label>
                <RadioGroup
                  value={formData.role}
                  onValueChange={(value) => handleInputChange('role', value)}
                  className="flex space-x-6"
                  disabled={loading}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="patient" id="patient" />
                    <Label htmlFor="patient">Patient</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="doctor" id="doctor" />
                    <Label htmlFor="doctor">Doctor</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    className={`glass ${errors.fullName ? 'border-destructive' : ''}`}
                    disabled={loading}
                  />
                  {errors.fullName && <p className="text-destructive text-sm">{errors.fullName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    placeholder="Enter your phone number"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className={`glass ${errors.phone ? 'border-destructive' : ''}`}
                    disabled={loading}
                  />
                  {errors.phone && <p className="text-destructive text-sm">{errors.phone}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`glass ${errors.email ? 'border-destructive' : ''}`}
                  disabled={loading}
                />
                {errors.email && <p className="text-destructive text-sm">{errors.email}</p>}
              </div>

              {/* Password Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create password"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className={`glass pr-12 ${errors.password ? 'border-destructive' : ''}`}
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  {formData.password && (
                    <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                      <PasswordRequirement met={passwordStrength.hasLength} text="At least 8 characters" />
                      <PasswordRequirement met={passwordStrength.hasUpper} text="One uppercase letter" />
                      <PasswordRequirement met={passwordStrength.hasLower} text="One lowercase letter" />
                      <PasswordRequirement met={passwordStrength.hasNumber} text="One number" />
                    </div>
                  )}
                  {errors.password && <p className="text-destructive text-sm">{errors.password}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      className={`glass pr-12 ${errors.confirmPassword ? 'border-destructive' : ''}`}
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={loading}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  {errors.confirmPassword && <p className="text-destructive text-sm">{errors.confirmPassword}</p>}
                </div>
              </div>

              {/* Role-specific fields */}
              {formData.role === 'patient' ? (
                <div className="space-y-4">
                  <h3 className="font-medium">Patient Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                        className={`glass ${errors.dateOfBirth ? 'border-destructive' : ''}`}
                        disabled={loading}
                      />
                      {errors.dateOfBirth && <p className="text-destructive text-sm">{errors.dateOfBirth}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Gender *</Label>
                      <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)} disabled={loading}>
                        <SelectTrigger className={`glass ${errors.gender ? 'border-destructive' : ''}`}>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.gender && <p className="text-destructive text-sm">{errors.gender}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Blood Group</Label>
                      <Select value={formData.bloodGroup} onValueChange={(value) => handleInputChange('bloodGroup', value)} disabled={loading}>
                        <SelectTrigger className="glass">
                          <SelectValue placeholder="Select blood group" />
                        </SelectTrigger>
                        <SelectContent>
                          {bloodGroups.map(group => (
                            <SelectItem key={group} value={group}>{group}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-medium">Doctor Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="medicalLicenseNumber">Medical License Number *</Label>
                      <Input
                        id="medicalLicenseNumber"
                        placeholder="Enter license number"
                        value={formData.medicalLicenseNumber}
                        onChange={(e) => handleInputChange('medicalLicenseNumber', e.target.value)}
                        className={`glass ${errors.medicalLicenseNumber ? 'border-destructive' : ''}`}
                        disabled={loading}
                      />
                      {errors.medicalLicenseNumber && <p className="text-destructive text-sm">{errors.medicalLicenseNumber}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Specialization *</Label>
                      <Select value={formData.specialization} onValueChange={(value) => handleInputChange('specialization', value)} disabled={loading}>
                        <SelectTrigger className={`glass ${errors.specialization ? 'border-destructive' : ''}`}>
                          <SelectValue placeholder="Select specialization" />
                        </SelectTrigger>
                        <SelectContent>
                          {specializations.map(spec => (
                            <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.specialization && <p className="text-destructive text-sm">{errors.specialization}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="hospital">Hospital / Clinic Name</Label>
                      <Input
                        id="hospital"
                        placeholder="e.g., Apollo Hospital, Mumbai"
                        value={formData.hospital}
                        onChange={(e) => handleInputChange('hospital', e.target.value)}
                        className="glass"
                        disabled={loading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="experience">Years of Experience</Label>
                      <Input
                        id="experience"
                        placeholder="e.g., 5 years"
                        value={formData.experience}
                        onChange={(e) => handleInputChange('experience', e.target.value)}
                        className="glass"
                        disabled={loading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="consultationFee">Consultation Fee (₹)</Label>
                      <Input
                        id="consultationFee"
                        type="number"
                        placeholder="e.g., 500"
                        value={formData.consultationFee}
                        onChange={(e) => handleInputChange('consultationFee', e.target.value)}
                        className="glass"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Terms and Conditions */}
              <div className="space-y-2">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="terms"
                    checked={agreeToTerms}
                    onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)}
                    disabled={loading}
                    className="mt-1"
                  />
                  <Label htmlFor="terms" className="text-sm leading-relaxed">
                    I agree to the{' '}
                    <Button type="button" variant="link" className="p-0 h-auto text-sm">
                      Terms and Conditions
                    </Button>{' '}
                    and{' '}
                    <Button type="button" variant="link" className="p-0 h-auto text-sm">
                      Privacy Policy
                    </Button>
                  </Label>
                </div>
                {errors.terms && <p className="text-destructive text-sm">{errors.terms}</p>}
              </div>

              {errors.general && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-destructive text-sm">{errors.general}</p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto font-medium"
                  onClick={onSwitchToLogin}
                  disabled={loading}
                >
                  Sign in
                </Button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};