import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentSessionRequest {
  orderId: string;
  amount: number;
  currency: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  items: Array<{
    sku: string;
    name: string;
    qty: number;
    price: number;
  }>;
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

    const body: PaymentSessionRequest = await req.json();
    
    console.log('Creating Shiprocket payment session for order:', body.orderId);

    // TEST MODE: In production, you would call actual Shiprocket API here
    // For now, we'll generate a mock session URL
    const shiprocketApiKey = Deno.env.get('SHIPROCKET_API_KEY');
    const isTestMode = !shiprocketApiKey || shiprocketApiKey === 'test_mode';

    let sessionUrl: string;
    let sessionId: string;

    if (isTestMode) {
      // TEST MODE: Generate mock session
      sessionId = `test_session_${Date.now()}`;
      const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('/v1', '') || '';
      // Create a test payment page URL that will redirect back with success
      sessionUrl = `${baseUrl}/functions/v1/shiprocket-test-payment?session_id=${sessionId}&order_id=${body.orderId}&amount=${body.amount}`;
      
      console.log('TEST MODE: Generated mock session URL');
    } else {
      // PRODUCTION MODE: Call actual Shiprocket API
      const shiprocketResponse = await fetch('https://apiv2.shiprocket.in/v1/external/payment/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${shiprocketApiKey}`,
        },
        body: JSON.stringify({
          order_id: body.orderId,
          amount: body.amount,
          currency: body.currency,
          customer: body.customer,
          items: body.items,
          callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/shiprocket-webhook`,
        }),
      });

      if (!shiprocketResponse.ok) {
        throw new Error(`Shiprocket API error: ${shiprocketResponse.statusText}`);
      }

      const shiprocketData = await shiprocketResponse.json();
      sessionUrl = shiprocketData.payment_url;
      sessionId = shiprocketData.session_id;
      
      console.log('PRODUCTION MODE: Created Shiprocket session');
    }

    // Store session info in order for tracking
    await supabaseClient
      .from('orders')
      .update({
        payment_id: sessionId,
      })
      .eq('id', body.orderId);

    return new Response(
      JSON.stringify({
        success: true,
        session_url: sessionUrl,
        session_id: sessionId,
        order_id: body.orderId,
        test_mode: isTestMode,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating Shiprocket session:', error);
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
