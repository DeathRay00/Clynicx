import React, { useState } from 'react';
import { Eye, EyeOff, Heart, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner@2.0.3';
import { API_ENDPOINTS, HTTP_METHODS } from '../../config/api';

interface LoginFormProps {
  onSwitchToSignup: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  const { login } = useAuth();

  // Temporary debug function to test server connectivity
  const testServerConnection = async () => {
    try {
      console.log('Testing server connection to:', API_ENDPOINTS.HEALTH);
      
      const response = await fetch(API_ENDPOINTS.HEALTH, {
        method: HTTP_METHODS.GET,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Health check response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Health check response:', data);
        toast.success('Server connection successful!');
      } else {
        console.error('Health check failed:', response.status, response.statusText);
        toast.error(`Server connection failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Health check error:', error);
      toast.error(`Connection error: ${error}`);
    }
  };

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
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
    setErrors({});

    try {
      const result = await login(email, password);
      
      if (result.success) {
        toast.success('Welcome back! Login successful.');
      } else {
        setErrors({ general: result.error || 'Login failed. Please check your credentials.' });
        toast.error(result.error || 'Login failed');
      }
    } catch (error) {
      const errorMessage = 'An unexpected error occurred. Please try again.';
      setErrors({ general: errorMessage });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="glass-card border-0 shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Heart className="w-8 h-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Welcome Back</CardTitle>
              <CardDescription className="text-base mt-2">
                Sign in to your clinic account
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`glass ${errors.email ? 'border-destructive' : ''}`}
                  disabled={loading}
                />
                {errors.email && (
                  <p className="text-destructive text-sm">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {errors.password && (
                  <p className="text-destructive text-sm">{errors.password}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    disabled={loading}
                  />
                  <Label htmlFor="remember" className="text-sm">
                    Remember me
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="link"
                  className="text-sm p-0 h-auto"
                  disabled={loading}
                >
                  Forgot password?
                </Button>
              </div>

              {errors.general && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-destructive text-sm">{errors.general}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto font-medium"
                  onClick={onSwitchToSignup}
                  disabled={loading}
                >
                  Sign up
                </Button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};