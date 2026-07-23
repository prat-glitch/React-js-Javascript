// src/config/supabase.js
import { createClient } from '@supabase/supabase-js';
import { getAuth } from 'firebase/auth';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─────────────────────────────────────────────────────────────
// Global anon client — used BEFORE the user signs in (public
// bucket reads, unauthenticated queries, etc.)
// ─────────────────────────────────────────────────────────────
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─────────────────────────────────────────────────────────────
// Authenticated Supabase client — created once, with a dynamic
// accessToken factory. Every request automatically fetches a
// fresh Firebase JWT (Firebase caches & auto-refreshes it), so
// token expiry is handled transparently.
// ─────────────────────────────────────────────────────────────
const authClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    // `fetch` wrapper: injects Authorization before each request
    fetch: async (url, options = {}) => {
      const auth = getAuth();
      const firebaseUser = auth.currentUser;

      if (firebaseUser) {
        try {
          // `getIdToken(false)` returns cached token, refreshing only
          // when within 5 minutes of expiry — Firebase handles this.
          const token = await firebaseUser.getIdToken(false);

          // Exchange Firebase token for Supabase JWT via Edge Function
          const tokenResponse = await window.fetch(
            `${supabaseUrl}/functions/v1/auth-token`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ firebasetoken: token }),
            }
          );

          if (tokenResponse.ok) {
            const { supabasetoken } = await tokenResponse.json();
            options.headers = {
              ...options.headers,
              Authorization: `Bearer ${supabasetoken}`,
            };
          }
        } catch (err) {
          console.warn('[Supabase] Could not attach Firebase JWT:', err);
        }
      }

      return window.fetch(url, options);
    },
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// ─────────────────────────────────────────────────────────────
// Legacy helpers — kept for backward compatibility with existing
// code that calls setSupabaseToken() / getSupabase()
// ─────────────────────────────────────────────────────────────

/**
 * @deprecated Token is now fetched dynamically per-request.
 * This is a no-op kept only for backward compatibility.
 */
export const setSupabaseToken = (_token) => {
  // No-op: the dynamic fetch wrapper handles token injection
  // automatically. Realtime still needs the token though.
  if (_token && authClient?.realtime) {
    authClient.realtime.setAuth(_token);
  }
};

/**
 * Returns the authenticated Supabase client when the user is
 * signed in, or the anon client otherwise.
 */
export const getSupabase = () => {
  const auth = getAuth();
  return auth.currentUser ? authClient : supabase;
};
