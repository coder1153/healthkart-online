import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting map: IP -> { count, resetTime }
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

interface LoginRequest {
  admin_key: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    
    // Check rate limit
    const now = Date.now();
    const rateLimitInfo = rateLimitMap.get(clientIp);
    
    if (rateLimitInfo) {
      if (now < rateLimitInfo.resetTime) {
        if (rateLimitInfo.count >= MAX_ATTEMPTS) {
          return new Response(
            JSON.stringify({ 
              error: 'Too many attempts. Please try again in 15 minutes.' 
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 429,
            }
          );
        }
        rateLimitInfo.count++;
      } else {
        // Reset window
        rateLimitMap.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      }
    } else {
      rateLimitMap.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    }

    const body: LoginRequest = await req.json();
    
    if (!body.admin_key) {
      return new Response(
        JSON.stringify({ error: 'Admin key is required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log('Admin login attempt from IP:', clientIp);

    // Hash the provided key
    const keyHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(body.admin_key)
    );
    const keyHashHex = Array.from(new Uint8Array(keyHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Look up the key in database
    const { data: adminKey, error: keyError } = await supabaseClient
      .from('admin_keys')
      .select('*')
      .eq('key_hash', keyHashHex)
      .maybeSingle();

    if (keyError || !adminKey) {
      console.log('Invalid admin key attempt');
      return new Response(
        JSON.stringify({ error: 'Invalid admin key' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // Check if key is expired
    if (adminKey.expires_at && new Date(adminKey.expires_at) < new Date()) {
      console.log('Expired admin key used');
      return new Response(
        JSON.stringify({ error: 'Admin key has expired' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // Update last_used_at
    await supabaseClient
      .from('admin_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', adminKey.id);

    // Generate JWT token with 1 hour expiry
    const jwtSecret = Deno.env.get('JWT_SECRET') || 'default-secret-change-in-production';
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(jwtSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour
    const token = await create(
      { alg: 'HS256', typ: 'JWT' },
      { 
        admin_key_id: adminKey.id,
        label: adminKey.label,
        exp: Math.floor(expiresAt / 1000),
      },
      key
    );

    // Log successful login
    await supabaseClient
      .from('admin_audit')
      .insert({
        admin_key_id: adminKey.id,
        action: 'admin_login',
        resource_type: 'auth',
        after: { label: adminKey.label, ip: clientIp },
      });

    // Clear rate limit on successful login
    rateLimitMap.delete(clientIp);

    console.log('Admin login successful for key:', adminKey.label);

    return new Response(
      JSON.stringify({
        success: true,
        admin_token: token,
        expires_in: 3600,
        label: adminKey.label,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in admin login:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
