// src/config/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Global anon client (used for public buckets, etc)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

let authClient = null;
let currentToken = null;

export const setSupabaseToken = (token) => {
  currentToken = token;
  authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
  
  // Crucial: Authenticate the Realtime WebSocket connection with our custom token!
  authClient.realtime.setAuth(token);
};

export const getSupabase = () => {
  return authClient || supabase;
};
