import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckoutRequest {
  cartItems: Array<{
    variant_id: string;
    quantity: number;
  }>;
  redirectUrl: string;
}

// Generate HMAC-SHA256 signature in base64
async function generateHMAC(secretKey: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(data);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  return encodeBase64(new Uint8Array(signature));
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const body: CheckoutRequest = await req.json();

    console.log('Generating Shiprocket checkout token for user:', user.id);

    // Check if we're in test mode (no API key configured)
    const apiKey = Deno.env.get('SHIPROCKET_API_KEY');
    const secretKey = Deno.env.get('SHIPROCKET_API_SECRET');
    const isTestMode = !apiKey || !secretKey;

    let token: string;
    let orderId: string;

    if (isTestMode) {
      // TEST MODE: Generate mock token and session ID
      const sessionId = `test_session_${Date.now()}_${user.id}`;
      orderId = `test_order_${Date.now()}`;
      token = sessionId; // Token acts as session ID in test mode
      
      console.log('TEST MODE: Generated mock checkout session');
    } else {
      // PRODUCTION MODE: Call Shiprocket Access Token API
      const timestamp = new Date().toISOString();
      const requestBody = {
        cart_data: {
          items: body.cartItems
        },
        redirect_url: body.redirectUrl,
        timestamp
      };

      const bodyString = JSON.stringify(requestBody);
      const hmacSignature = await generateHMAC(secretKey, bodyString);

      console.log('Calling Shiprocket Access Token API');

      const response = await fetch('https://checkout-api.shiprocket.com/api/v1/access-token/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
          'X-Api-HMAC-SHA256': hmacSignature,
        },
        body: bodyString,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Shiprocket API error:', errorText);
        throw new Error(`Shiprocket API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.result?.token) {
        throw new Error('No token received from Shiprocket');
      }

      token = data.result.token;
      orderId = data.result.order_id || `order_${Date.now()}`;
      
      console.log('Successfully generated Shiprocket checkout token');
    }

    return new Response(
      JSON.stringify({
        success: true,
        token,
        order_id: orderId,
        test_mode: isTestMode,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error generating checkout token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
