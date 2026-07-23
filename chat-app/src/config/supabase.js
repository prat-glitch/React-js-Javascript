// src/config/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─────────────────────────────────────────────────────────────
// Anon client — used BEFORE sign-in (unauthenticated queries)
// ─────────────────────────────────────────────────────────────
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─────────────────────────────────────────────────────────────
// Authenticated client — recreated every time we get a fresh
// Supabase JWT (which AppContext fetches via onIdTokenChanged,
// so it auto-refreshes every ~1 hour when Firebase rotates its
// token automatically).
// ─────────────────────────────────────────────────────────────
let authClient = null;

/**
 * Call this whenever you receive a new Supabase JWT.
 * Recreates the authenticated client so all subsequent queries
 * carry the correct Authorization header.
 */
export const setSupabaseToken = (token) => {
  authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  // Also authenticate the Realtime WebSocket connection
  authClient.realtime.setAuth(token);
};

/**
 * Returns the authenticated client when the user is signed in,
 * otherwise falls back to the anon client.
 */
export const getSupabase = () => authClient || supabase;
