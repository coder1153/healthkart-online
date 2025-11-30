import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate HMAC signature
async function generateHMAC(secretKey: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(data);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Verify user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { orderId } = await req.json();

    if (!orderId) {
      throw new Error('orderId is required');
    }

    console.log(`Fetching order details from Shiprocket: ${orderId}`);

    // Check if Shiprocket credentials are configured
    const apiKey = Deno.env.get('SHIPROCKET_API_KEY');
    const secretKey = Deno.env.get('SHIPROCKET_API_SECRET');

    if (!apiKey || !secretKey) {
      throw new Error('Shiprocket credentials not configured');
    }

    // Prepare request body
    const requestBody = {
      order_id: orderId,
      timestamp: new Date().toISOString()
    };

    const payload = JSON.stringify(requestBody);
    const hmac = await generateHMAC(secretKey, payload);

    // Fetch order details from Shiprocket
    const response = await fetch('https://checkout-api.shiprocket.com/api/v1/custom-platform-order/details', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Api-HMAC-SHA256': hmac,
      },
      body: payload,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch order details:', errorText);
      throw new Error(`Failed to fetch order details: ${response.status}`);
    }

    const orderDetails = await response.json();
    console.log(`Successfully fetched order details for ${orderId}`);

    return new Response(JSON.stringify(orderDetails), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error fetching order details:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
