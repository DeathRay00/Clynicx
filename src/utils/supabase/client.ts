import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

export const supabaseUrl = `https://${projectId}.supabase.co`;
export const supabaseAnonKey = publicAnonKey;

// Create a singleton Supabase client
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export const getSupabaseClient = () => {
  if (!supabaseInstance) {
    // Ensure we're in a browser environment
    if (typeof window === 'undefined') {
      throw new Error('Supabase client should only be created in browser environment');
    }
    
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        storageKey: 'healthcare-portal-auth',
        storage: window.localStorage,
        detectSessionInUrl: true,
        flowType: 'pkce'
      },
      global: {
        headers: {
          'X-Client-Info': 'healthcare-portal-client'
        }
      }
    });
    
    // Log creation for debugging (can be removed in production)
    console.log('Supabase client created with URL:', supabaseUrl);
    console.log('Supabase client created with storage key: healthcare-portal-auth');
  }
  return supabaseInstance;
};

// Lazy export that only creates the client when needed
export const supabase = typeof window !== 'undefined' ? getSupabaseClient() : null as any;

// Function to reset the client (useful for testing or logout)
export const resetSupabaseClient = () => {
  if (supabaseInstance) {
    console.log('Resetting Supabase client instance');
    supabaseInstance = null;
  }
};