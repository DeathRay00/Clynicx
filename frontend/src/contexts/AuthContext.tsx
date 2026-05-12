import React, { createContext, useContext, useState, useEffect } from 'react';
import { saveToken, getToken, clearToken } from '../utils/supabase/client';
import { API_ENDPOINTS, getAuthHeaders, getAnonHeaders, HTTP_METHODS } from '../config/api';
import { isDemoMode, getDemoUser, demoLogin, demoSignup, clearDemoUser, enableDemoMode, disableDemoMode, type DemoUser } from '../utils/demoMode';

interface User {
  id: string;
  email: string;
  role: 'patient' | 'doctor';
  fullName: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (userData: SignupData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface SignupData {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: 'patient' | 'doctor';
  // Patient specific
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  // Doctor specific
  medicalLicenseNumber?: string;
  specialization?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in using stored JWT token
    const checkUser = async () => {
      try {
        // Check demo mode first
        if (isDemoMode()) {
          const demoUser = getDemoUser();
          if (demoUser) {
            console.log('📱 Demo mode active - Using local storage');
            setUser(demoUser as User);
            setLoading(false);
            return;
          }
        }

        // Check for stored JWT token
        const token = getToken();
        if (token) {
          console.log('🔑 JWT token found, fetching user profile...');
          await fetchUserProfile(token);
        } else {
          console.log('No stored token found');
        }
      } catch (error) {
        console.error('Error checking auth state:', error);
        console.log('⚠️ Auth check failed - Switching to demo mode');
        enableDemoMode();
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, []);

  const fetchUserProfile = async (accessToken: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(API_ENDPOINTS.AUTH.PROFILE, {
        method: HTTP_METHODS.GET,
        headers: getAuthHeaders(accessToken),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const userData = await response.json();
        console.log('✅ User profile loaded from PostgreSQL backend');
        disableDemoMode();
        setUser(userData);
        return;
      }

      if (response.status === 401) {
        // Token is invalid or expired - clear it
        console.warn('JWT token invalid/expired, clearing...');
        clearToken();
        setUser(null);
        return;
      }

      console.log(`ℹ️ Backend returned HTTP ${response.status} - Switching to demo mode`);
      throw new Error(`Backend unavailable: HTTP ${response.status}`);
    } catch (error) {
      // Network error or backend down - try demo mode
      const demoUser = getDemoUser();
      if (demoUser) {
        console.log('📱 Using demo mode user:', demoUser.email);
        setUser(demoUser);
        return;
      }
      console.log('⚠️ Backend unavailable - Demo mode enabled');
      enableDemoMode();
      setUser(null);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      // Try real JWT login against PostgreSQL backend
      try {
        const response = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
          method: HTTP_METHODS.POST,
          headers: getAnonHeaders(),
          body: JSON.stringify({ email, password }),
        });

        const result = await response.json();

        if (!response.ok) {
          // Real backend auth failure (wrong password, etc.) — return error directly
          return { success: false, error: result.error || 'Invalid email or password' };
        }

        // Save JWT token and set user
        if (result.token) {
          saveToken(result.token);
        }
        if (result.user) {
          console.log('✅ Logged in via PostgreSQL backend');
          disableDemoMode();
          setUser(result.user);
        } else {
          await fetchUserProfile(result.token);
        }

        return { success: true };
      } catch (fetchError) {
        // Network error - fall back to demo mode
        console.log('⚠️ Network error, switching to demo mode...');
        const demoResult = await demoLogin(email, password);
        if (demoResult.success && demoResult.user) {
          setUser(demoResult.user as User);
          return { success: true };
        }
        return { success: false, error: demoResult.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  const signup = async (userData: SignupData) => {
    try {
      try {
        const response = await fetch(API_ENDPOINTS.AUTH.SIGNUP, {
          method: HTTP_METHODS.POST,
          headers: getAnonHeaders(),
          body: JSON.stringify(userData),
        });

        const result = await response.json();

        if (!response.ok) {
          // Return the real server error (e.g. "email already exists")
          return { success: false, error: result.error || 'Signup failed' };
        }

        // Save JWT and set user if returned
        if (result.token) {
          saveToken(result.token);
        }
        if (result.user) {
          disableDemoMode();
          setUser(result.user);
          return { success: true };
        }

        // Auto-login after successful signup
        return await login(userData.email, userData.password);
      } catch (fetchError) {
        // Network error or server unavailable - use demo mode
        console.log('⚠️ Server unavailable, creating demo account...');
        const demoResult = await demoSignup(userData);
        if (demoResult.success && demoResult.user) {
          setUser(demoResult.user as User);
          return { success: true };
        }
        return { success: false, error: 'Signup failed' };
      }
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  const logout = async () => {
    try {
      if (isDemoMode()) {
        clearDemoUser();
      }
      disableDemoMode();
      clearToken();
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    const token = getToken();
    if (token) {
      await fetchUserProfile(token);
    }
  };

  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};