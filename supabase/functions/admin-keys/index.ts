import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to verify admin token
async function verifyAdminToken(authHeader: string | null): Promise<any> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No admin token provided');
  }

  const token = authHeader.substring(7);
  const jwtSecret = Deno.env.get('JWT_SECRET') || 'default-secret-change-in-production';
  
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(jwtSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  return await verify(token, key);
}

// Generate a random admin key
function generateAdminKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const segments = 4;
  const segmentLength = 8;
  const key = [];
  
  for (let i = 0; i < segments; i++) {
    let segment = '';
    for (let j = 0; j < segmentLength; j++) {
      segment += chars[Math.floor(Math.random() * chars.length)];
    }
    key.push(segment);
  }
  
  return key.join('-');
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

    // Verify admin authentication
    const adminPayload = await verifyAdminToken(req.headers.get('Authorization'));
    console.log('Admin action by:', adminPayload.label);

    const url = new URL(req.url);
    const path = url.pathname;

    // GET /admin-keys - List all keys
    if (req.method === 'GET') {
      const { data: keys, error } = await supabaseClient
        .from('admin_keys')
        .select('id, label, created_by, created_at, expires_at, last_used_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ keys }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // POST /admin-keys - Create new key
    if (req.method === 'POST') {
      const body = await req.json();
      const { label, expires_in_days } = body;

      if (!label) {
        return new Response(
          JSON.stringify({ error: 'Label is required' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }

      // Generate new key
      const newKey = generateAdminKey();
      
      // Hash it
      const keyHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(newKey)
      );
      const keyHashHex = Array.from(new Uint8Array(keyHash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Calculate expiry date if provided
      let expiresAt = null;
      if (expires_in_days) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expires_in_days);
      }

      // Insert into database
      const { data: adminKey, error } = await supabaseClient
        .from('admin_keys')
        .insert({
          key_hash: keyHashHex,
          label,
          created_by: adminPayload.label,
          expires_at: expiresAt?.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Log the action
      await supabaseClient
        .from('admin_audit')
        .insert({
          admin_key_id: adminPayload.admin_key_id,
          action: 'create_admin_key',
          resource_type: 'admin_key',
          resource_id: adminKey.id,
          after: { label, expires_at: expiresAt },
        });

      console.log('Created new admin key:', label);

      return new Response(
        JSON.stringify({
          success: true,
          key: newKey, // ONLY TIME THIS IS SHOWN
          label: adminKey.label,
          id: adminKey.id,
          expires_at: adminKey.expires_at,
          warning: 'Store this key securely! It will not be shown again.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 201,
        }
      );
    }

    // DELETE /admin-keys/:id - Delete a key
    if (req.method === 'DELETE') {
      const keyId = path.split('/').pop();
      
      if (!keyId) {
        return new Response(
          JSON.stringify({ error: 'Key ID is required' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }

      // Get key info before deleting
      const { data: keyInfo } = await supabaseClient
        .from('admin_keys')
        .select('label')
        .eq('id', keyId)
        .single();

      // Delete the key
      const { error } = await supabaseClient
        .from('admin_keys')
        .delete()
        .eq('id', keyId);

      if (error) throw error;

      // Log the action
      await supabaseClient
        .from('admin_audit')
        .insert({
          admin_key_id: adminPayload.admin_key_id,
          action: 'delete_admin_key',
          resource_type: 'admin_key',
          resource_id: keyId,
          before: keyInfo,
        });

      console.log('Deleted admin key:', keyId);

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      }
    );
  } catch (error) {
    console.error('Error in admin-keys function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      }
    );
  }
});
