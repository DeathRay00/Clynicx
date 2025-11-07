import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSupabaseClient, resetSupabaseClient } from '../utils/supabase/client';
import { API_ENDPOINTS, getAuthHeaders, getAnonHeaders, HTTP_METHODS } from '../config/api';
import { isDemoMode, getDemoUser, demoLogin, demoSignup, clearDemoUser, enableDemoMode, type DemoUser } from '../utils/demoMode';

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
    // Check if user is already logged in
    const checkUser = async () => {
      try {
        // Ensure we're in browser environment
        if (typeof window === 'undefined') {
          setLoading(false);
          return;
        }

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
        
        try {
          const supabase = getSupabaseClient();
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.warn('Session error:', sessionError);
            throw sessionError;
          }
          
          if (session?.user) {
            console.log('Session found, fetching user profile...');
            // Fetch user profile from server
            await fetchUserProfile(session.access_token);
          } else {
            console.log('No active session found');
          }
        } catch (supabaseError) {
          console.warn('Supabase unavailable:', supabaseError);
          // Enable demo mode and continue
          console.log('⚠️ Backend unavailable - Demo mode enabled');
          enableDemoMode();
        }
      } catch (error) {
        console.error('Error checking auth state:', error);
        // Enable demo mode on error
        console.log('⚠️ Server unavailable - Switching to demo mode');
        enableDemoMode();
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    // Listen for auth changes
    if (typeof window !== 'undefined') {
      try {
        const supabase = getSupabaseClient();
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            await fetchUserProfile(session.access_token);
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
          }
        });

        return () => subscription.unsubscribe();
      } catch (error) {
        console.warn('Could not set up auth state listener:', error);
      }
    }
  }, []);

  const fetchUserProfile = async (accessToken: string) => {
    try {
      // Try to fetch from API with a shorter timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      try {
        const response = await fetch(API_ENDPOINTS.AUTH.PROFILE, {
          method: HTTP_METHODS.GET,
          headers: getAuthHeaders(accessToken),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        
        if (response.ok) {
          const userData = await response.json();
          console.log('✅ User profile loaded successfully');
          setUser(userData);
          return;
        } else {
          // Backend returned an error (401, 404, etc.) - this is expected when backend is down
          console.log('ℹ️ Backend unavailable (HTTP ' + response.status + ') - Switching to demo mode');
          throw new Error(`Backend unavailable: HTTP ${response.status}`);
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        // Network error or timeout - try Supabase auth metadata as fallback
        try {
          const supabase = getSupabaseClient();
          const { data: { user: authUser }, error: userError } = await supabase.auth.getUser(accessToken);
          
          if (!userError && authUser?.user_metadata) {
            const fallbackUser: User = {
              id: authUser.id,
              email: authUser.email || '',
              role: authUser.user_metadata.role || 'patient',
              fullName: authUser.user_metadata.full_name || authUser.email?.split('@')[0] || 'User',
              phone: authUser.user_metadata.phone || '',
            };
            console.log('✅ Using Supabase auth data:', fallbackUser.email);
            setUser(fallbackUser);
            return;
          }
        } catch (supabaseError) {
          // Supabase also failed - silently continue to demo mode
          console.log('ℹ️ Supabase unavailable - Using demo mode');
        }
        
        // Check for existing demo mode user
        const demoUser = getDemoUser();
        if (demoUser) {
          console.log('📱 Demo mode active - Using stored user:', demoUser.email);
          setUser(demoUser);
          return;
        }
        
        // Enable demo mode and sign out from Supabase
        console.log('⚠️ Backend unavailable - Demo mode enabled');
        enableDemoMode();
        
        // Silently sign out from Supabase
        try {
          const supabase = getSupabaseClient();
          await supabase.auth.signOut();
        } catch (signOutError) {
          // Ignore sign out errors
        }
        
        // Clear user state - user will see login screen
        setUser(null);
        return;
      }
    } catch (error) {
      // Unexpected error - enable demo mode
      console.log('⚠️ Authentication error - Demo mode enabled');
      enableDemoMode();
      
      // Clear user state
      setUser(null);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      // Try real authentication first
      const supabase = getSupabaseClient();
      
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          // If auth fails, try demo mode
          console.log('⚠️ Auth failed, trying demo mode...');
          const demoResult = await demoLogin(email, password);
          if (demoResult.success && demoResult.user) {
            setUser(demoResult.user as User);
            return { success: true };
          }
          return { success: false, error: error.message };
        }

        if (data.session?.access_token) {
          await fetchUserProfile(data.session.access_token);
        }

        return { success: true };
      } catch (fetchError) {
        // Network error - use demo mode
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
      // Try real signup first
      try {
        const response = await fetch(API_ENDPOINTS.AUTH.SIGNUP, {
          method: HTTP_METHODS.POST,
          headers: getAnonHeaders(),
          body: JSON.stringify(userData),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Signup failed');
        }

        // Auto-login after successful signup
        if (result.success) {
          return await login(userData.email, userData.password);
        }

        return { success: true };
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
      // Clear demo mode
      if (isDemoMode()) {
        clearDemoUser();
        setUser(null);
        return;
      }

      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      setUser(null);
      // Don't reset the client instance as it might cause issues
      // resetSupabaseClient(); 
    } catch (error) {
      console.error('Error logging out:', error);
      // Clear user anyway
      setUser(null);
    }
  };

  const refreshUser = async () => {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      await fetchUserProfile(session.access_token);
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