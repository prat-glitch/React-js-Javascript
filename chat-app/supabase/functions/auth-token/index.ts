import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { firebasetoken } = await req.json();

    if (!firebasetoken) {
      return new Response(JSON.stringify({ error: "Missing firebasetoken" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID");
    if (!FIREBASE_PROJECT_ID) {
      throw new Error("FIREBASE_PROJECT_ID is not set in Edge Function secrets");
    }

    // Use Supabase's built-in JWT secret (auto-injected in production) or fallback
    const JWT_SECRET = Deno.env.get("SUPABASE_AUTH_JWT_SECRET") || Deno.env.get("CUSTOM_JWT_SECRET");
    if (!JWT_SECRET) {
      throw new Error("JWT Secret is not set in Edge Function secrets");
    }

    // 1. Verify Firebase Token using Google's public keys
    const JWKS = jose.createRemoteJWKSet(
      new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
    );

    const { payload } = await jose.jwtVerify(firebasetoken, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });

    const uid = payload.sub;
    const email = payload.email;

    // 2. Generate Supabase Token
    const secret = new TextEncoder().encode(JWT_SECRET);
    
    const supabasePayload = {
      aud: 'authenticated',
      sub: uid,
      email: email,
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour expiry
      role: 'authenticated'
    };

    const supabasetoken = await new jose.SignJWT(supabasePayload)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .sign(secret);

    return new Response(JSON.stringify({ supabasetoken }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
