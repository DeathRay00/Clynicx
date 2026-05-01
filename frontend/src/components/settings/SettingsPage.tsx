import React, { useState, useEffect } from 'react';
import { 
  User, 
  Lock, 
  Bell, 
  Shield, 
  Palette, 
  Globe, 
  Heart,
  Stethoscope,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Camera,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Settings,
  UserCircle,
  Smartphone,
  Monitor,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Download
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { useAuth } from '../../contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: 'patient' | 'doctor';
  avatar?: string;
  // Patient specific
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  // Doctor specific
  medicalLicenseNumber?: string;
  specialization?: string;
  hospitalAffiliation?: string;
  experienceYears?: number;
  // Address
  address?: string;
  city?: string;
  country?: string;
  // Preferences
  language?: string;
  timezone?: string;
  theme?: 'light' | 'dark' | 'system';
}

interface NotificationSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  appointmentReminders: boolean;
  medicationReminders: boolean;
  healthTips: boolean;
  systemUpdates: boolean;
  marketingEmails: boolean;
  reminderTiming: string; // '15min', '1hour', '1day'
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'contacts';
  shareHealthData: boolean;
  allowDataAnalytics: boolean;
  twoFactorAuth: boolean;
  sessionTimeout: string; // '15min', '30min', '1hour', '4hours'
  loginAlerts: boolean;
}

export const SettingsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();

  // Safety check for user data
  if (!user) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Card className="glass-card p-8 text-center max-w-md">
          <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">
            You need to be logged in to access settings.
          </p>
        </Card>
      </div>
    );
  }
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Profile state
  const [profile, setProfile] = useState<UserProfile>(() => ({
    id: user?.id || '',
    email: user?.email || '',
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    role: user?.role || 'patient',
    language: 'en',
    timezone: 'UTC',
    theme: 'light'
  }));

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Notification settings
  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailNotifications: true,
    smsNotifications: true,
    pushNotifications: true,
    appointmentReminders: true,
    medicationReminders: true,
    healthTips: false,
    systemUpdates: true,
    marketingEmails: false,
    reminderTiming: '1hour',
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00'
    }
  });

  // Privacy settings
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    profileVisibility: 'private',
    shareHealthData: false,
    allowDataAnalytics: true,
    twoFactorAuth: false,
    sessionTimeout: '1hour',
    loginAlerts: true
  });

  useEffect(() => {
    // In a real app, fetch user profile and settings from the server
    if (user?.id) {
      loadUserSettings();
    }
  }, [user?.id]);

  const loadUserSettings = async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    
    try {
      // Mock data loading - in real app, fetch from server
      setIsLoading(true);
      setTimeout(() => {
        setProfile(prev => ({
          ...prev,
          id: user.id || '',
          email: user.email || '',
          fullName: user.fullName || '',
          phone: user.phone || '',
          role: user.role || 'patient',
          dateOfBirth: user?.role === 'patient' ? '1990-01-01' : undefined,
          gender: user?.role === 'patient' ? 'male' : undefined,
          specialization: user?.role === 'doctor' ? 'Internal Medicine' : undefined,
          city: 'New York',
          country: 'United States'
        }));
        setIsLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
      setIsLoading(false);
    }
  };

  const handleProfileUpdate = async () => {
    setIsLoading(true);
    try {
      // Mock API call - in real app, send to server
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update local user context
      await refreshUser();
      
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      toast.success('Password changed successfully');
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationUpdate = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success('Notification settings updated');
    } catch (error) {
      toast.error('Failed to update notification settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrivacyUpdate = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success('Privacy settings updated');
    } catch (error) {
      toast.error('Failed to update privacy settings');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while initializing
  if (!user || isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Settings className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-lg">
          <Settings className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your account settings and preferences</p>
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 glass-card">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Privacy
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="glass-card p-6">
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="w-20 h-20">
                <AvatarImage src={profile.avatar} />
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  {profile.fullName.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{profile.fullName}</h3>
                <p className="text-gray-600 capitalize">{profile.role}</p>
                <Button variant="outline" size="sm" className="mt-2 glass">
                  <Camera className="w-4 h-4 mr-2" />
                  Change Photo
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={profile.fullName}
                    onChange={(e) => setProfile(prev => ({...prev, fullName: e.target.value}))}
                    className="glass"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile(prev => ({...prev, email: e.target.value}))}
                    className="glass"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={profile.phone}
                    onChange={(e) => setProfile(prev => ({...prev, phone: e.target.value}))}
                    className="glass"
                  />
                </div>

                {profile.role === 'patient' && (
                  <>
                    <div>
                      <Label htmlFor="dateOfBirth">Date of Birth</Label>
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={profile.dateOfBirth}
                        onChange={(e) => setProfile(prev => ({...prev, dateOfBirth: e.target.value}))}
                        className="glass"
                      />
                    </div>

                    <div>
                      <Label htmlFor="gender">Gender</Label>
                      <Select value={profile.gender} onValueChange={(value) => setProfile(prev => ({...prev, gender: value}))}>
                        <SelectTrigger className="glass">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                          <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="bloodGroup">Blood Group</Label>
                      <Select value={profile.bloodGroup} onValueChange={(value) => setProfile(prev => ({...prev, bloodGroup: value}))}>
                        <SelectTrigger className="glass">
                          <SelectValue placeholder="Select blood group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A+">A+</SelectItem>
                          <SelectItem value="A-">A-</SelectItem>
                          <SelectItem value="B+">B+</SelectItem>
                          <SelectItem value="B-">B-</SelectItem>
                          <SelectItem value="AB+">AB+</SelectItem>
                          <SelectItem value="AB-">AB-</SelectItem>
                          <SelectItem value="O+">O+</SelectItem>
                          <SelectItem value="O-">O-</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {profile.role === 'doctor' && (
                  <>
                    <div>
                      <Label htmlFor="medicalLicenseNumber">Medical License Number</Label>
                      <Input
                        id="medicalLicenseNumber"
                        value={profile.medicalLicenseNumber}
                        onChange={(e) => setProfile(prev => ({...prev, medicalLicenseNumber: e.target.value}))}
                        className="glass"
                      />
                    </div>

                    <div>
                      <Label htmlFor="specialization">Specialization</Label>
                      <Select value={profile.specialization} onValueChange={(value) => setProfile(prev => ({...prev, specialization: value}))}>
                        <SelectTrigger className="glass">
                          <SelectValue placeholder="Select specialization" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Internal Medicine">Internal Medicine</SelectItem>
                          <SelectItem value="Cardiology">Cardiology</SelectItem>
                          <SelectItem value="Dermatology">Dermatology</SelectItem>
                          <SelectItem value="Neurology">Neurology</SelectItem>
                          <SelectItem value="Orthopedics">Orthopedics</SelectItem>
                          <SelectItem value="Pediatrics">Pediatrics</SelectItem>
                          <SelectItem value="Psychiatry">Psychiatry</SelectItem>
                          <SelectItem value="General Practice">General Practice</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="hospitalAffiliation">Hospital Affiliation</Label>
                      <Input
                        id="hospitalAffiliation"
                        value={profile.hospitalAffiliation}
                        onChange={(e) => setProfile(prev => ({...prev, hospitalAffiliation: e.target.value}))}
                        className="glass"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={profile.address}
                    onChange={(e) => setProfile(prev => ({...prev, address: e.target.value}))}
                    className="glass"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={profile.city || 'Navi Mumbai'}
                    onChange={(e) => setProfile(prev => ({...prev, city: e.target.value}))}
                    className="glass"
                  />
                </div>

                <div>
                  <Label htmlFor="country">Country</Label>
                  <Select value={profile.country || 'India'} onValueChange={(value) => setProfile(prev => ({...prev, country: value}))}>
                    <SelectTrigger className="glass">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="India">India</SelectItem>
                      <SelectItem value="United States">United States</SelectItem>
                      <SelectItem value="Canada">Canada</SelectItem>
                      <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                      <SelectItem value="Australia">Australia</SelectItem>
                      <SelectItem value="Germany">Germany</SelectItem>
                      <SelectItem value="France">France</SelectItem>
                      <SelectItem value="Japan">Japan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="language">Language</Label>
                  <Select value={profile.language} onValueChange={(value) => setProfile(prev => ({...prev, language: value}))}>
                    <SelectTrigger className="glass">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                      <SelectItem value="ja">Japanese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={profile.timezone} onValueChange={(value) => setProfile(prev => ({...prev, timezone: value}))}>
                    <SelectTrigger className="glass">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Chicago">Central Time</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      <SelectItem value="Europe/London">GMT</SelectItem>
                      <SelectItem value="Europe/Paris">CET</SelectItem>
                      <SelectItem value="Asia/Tokyo">JST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {profile.role === 'patient' && (
                  <>
                    <div>
                      <Label htmlFor="emergencyContact">Emergency Contact</Label>
                      <Input
                        id="emergencyContact"
                        value={profile.emergencyContact}
                        onChange={(e) => setProfile(prev => ({...prev, emergencyContact: e.target.value}))}
                        className="glass"
                        placeholder="Contact name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="emergencyPhone">Emergency Phone</Label>
                      <Input
                        id="emergencyPhone"
                        value={profile.emergencyPhone}
                        onChange={(e) => setProfile(prev => ({...prev, emergencyPhone: e.target.value}))}
                        className="glass"
                        placeholder="Contact phone"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <Button onClick={handleProfileUpdate} disabled={isLoading} className="glass">
                <Save className="w-4 h-4 mr-2" />
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card className="glass-card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h3>
            <div className="space-y-4 max-w-md">
              <div>
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({...prev, currentPassword: e.target.value}))}
                    className="glass pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({...prev, newPassword: e.target.value}))}
                    className="glass pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({...prev, confirmPassword: e.target.value}))}
                    className="glass pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <Button onClick={handlePasswordChange} disabled={isLoading} className="glass">
                <Lock className="w-4 h-4 mr-2" />
                {isLoading ? 'Changing...' : 'Change Password'}
              </Button>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
                </div>
                <Switch
                  checked={privacy.twoFactorAuth}
                  onCheckedChange={(checked) => setPrivacy(prev => ({...prev, twoFactorAuth: checked}))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Login Alerts</Label>
                  <p className="text-sm text-gray-600">Get notified when someone logs into your account</p>
                </div>
                <Switch
                  checked={privacy.loginAlerts}
                  onCheckedChange={(checked) => setPrivacy(prev => ({...prev, loginAlerts: checked}))}
                />
              </div>

              <Separator />

              <div>
                <Label>Session Timeout</Label>
                <p className="text-sm text-gray-600 mb-2">Automatically log out after period of inactivity</p>
                <Select value={privacy.sessionTimeout} onValueChange={(value) => setPrivacy(prev => ({...prev, sessionTimeout: value}))}>
                  <SelectTrigger className="glass w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15min">15 minutes</SelectItem>
                    <SelectItem value="30min">30 minutes</SelectItem>
                    <SelectItem value="1hour">1 hour</SelectItem>
                    <SelectItem value="4hours">4 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="glass-card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-gray-600">Receive notifications via email</p>
                </div>
                <Switch
                  checked={notifications.emailNotifications}
                  onCheckedChange={(checked) => setNotifications(prev => ({...prev, emailNotifications: checked}))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>SMS Notifications</Label>
                  <p className="text-sm text-gray-600">Receive notifications via text message</p>
                </div>
                <Switch
                  checked={notifications.smsNotifications}
                  onCheckedChange={(checked) => setNotifications(prev => ({...prev, smsNotifications: checked}))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Push Notifications</Label>
                  <p className="text-sm text-gray-600">Receive push notifications in browser</p>
                </div>
                <Switch
                  checked={notifications.pushNotifications}
                  onCheckedChange={(checked) => setNotifications(prev => ({...prev, pushNotifications: checked}))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Appointment Reminders</Label>
                  <p className="text-sm text-gray-600">Get reminded about upcoming appointments</p>
                </div>
                <Switch
                  checked={notifications.appointmentReminders}
                  onCheckedChange={(checked) => setNotifications(prev => ({...prev, appointmentReminders: checked}))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Medication Reminders</Label>
                  <p className="text-sm text-gray-600">Get reminded to take your medications</p>
                </div>
                <Switch
                  checked={notifications.medicationReminders}
                  onCheckedChange={(checked) => setNotifications(prev => ({...prev, medicationReminders: checked}))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Health Tips</Label>
                  <p className="text-sm text-gray-600">Receive personalized health tips and advice</p>
                </div>
                <Switch
                  checked={notifications.healthTips}
                  onCheckedChange={(checked) => setNotifications(prev => ({...prev, healthTips: checked}))}
                />
              </div>

              <Separator />

              <div>
                <Label>Reminder Timing</Label>
                <p className="text-sm text-gray-600 mb-2">How far in advance to send reminders</p>
                <Select value={notifications.reminderTiming} onValueChange={(value) => setNotifications(prev => ({...prev, reminderTiming: value}))}>
                  <SelectTrigger className="glass w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15min">15 minutes</SelectItem>
                    <SelectItem value="1hour">1 hour</SelectItem>
                    <SelectItem value="1day">1 day</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label>Quiet Hours</Label>
                    <p className="text-sm text-gray-600">Don't send notifications during these hours</p>
                  </div>
                  <Switch
                    checked={notifications.quietHours.enabled}
                    onCheckedChange={(checked) => setNotifications(prev => ({
                      ...prev,
                      quietHours: { ...prev.quietHours, enabled: checked }
                    }))}
                  />
                </div>
                {notifications.quietHours.enabled && (
                  <div className="flex gap-4 mt-2">
                    <div>
                      <Label htmlFor="quietStart">From</Label>
                      <Input
                        id="quietStart"
                        type="time"
                        value={notifications.quietHours.start}
                        onChange={(e) => setNotifications(prev => ({
                          ...prev,
                          quietHours: { ...prev.quietHours, start: e.target.value }
                        }))}
                        className="glass w-32"
                      />
                    </div>
                    <div>
                      <Label htmlFor="quietEnd">To</Label>
                      <Input
                        id="quietEnd"
                        type="time"
                        value={notifications.quietHours.end}
                        onChange={(e) => setNotifications(prev => ({
                          ...prev,
                          quietHours: { ...prev.quietHours, end: e.target.value }
                        }))}
                        className="glass w-32"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <Button onClick={handleNotificationUpdate} disabled={isLoading} className="glass">
                <Save className="w-4 h-4 mr-2" />
                {isLoading ? 'Saving...' : 'Save Preferences'}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy" className="space-y-6">
          <Card className="glass-card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Privacy Settings</h3>
            <div className="space-y-4">
              <div>
                <Label>Profile Visibility</Label>
                <p className="text-sm text-gray-600 mb-2">Who can see your profile information</p>
                <Select value={privacy.profileVisibility} onValueChange={(value: any) => setPrivacy(prev => ({...prev, profileVisibility: value}))}>
                  <SelectTrigger className="glass w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="contacts">Contacts only</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Share Health Data</Label>
                  <p className="text-sm text-gray-600">Allow sharing anonymized health data for research</p>
                </div>
                <Switch
                  checked={privacy.shareHealthData}
                  onCheckedChange={(checked) => setPrivacy(prev => ({...prev, shareHealthData: checked}))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Data Analytics</Label>
                  <p className="text-sm text-gray-600">Help improve our services with usage analytics</p>
                </div>
                <Switch
                  checked={privacy.allowDataAnalytics}
                  onCheckedChange={(checked) => setPrivacy(prev => ({...prev, allowDataAnalytics: checked}))}
                />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <Button onClick={handlePrivacyUpdate} disabled={isLoading} className="glass">
                <Save className="w-4 h-4 mr-2" />
                {isLoading ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Management</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Download Your Data</h4>
                  <p className="text-sm text-gray-600">Get a copy of all your health data</p>
                </div>
                <Button variant="outline" className="glass">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Delete Account</h4>
                  <p className="text-sm text-gray-600">Permanently delete your account and all data</p>
                </div>
                <Button variant="destructive">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};