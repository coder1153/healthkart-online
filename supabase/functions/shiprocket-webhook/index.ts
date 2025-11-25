import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    let orderId: string;
    let status: string;
    let paymentId: string;
    let isTestMode = false;

    // Check if this is a test mode callback (query params) or production webhook (POST body)
    const url = new URL(req.url);
    if (url.searchParams.has('order_id')) {
      // TEST MODE: Query parameters from test payment page
      orderId = url.searchParams.get('order_id')!;
      status = url.searchParams.get('status')!;
      paymentId = url.searchParams.get('payment_id') || 'test_payment';
      isTestMode = true;
      
      console.log('TEST MODE webhook received:', { orderId, status, paymentId });
    } else {
      // PRODUCTION MODE: Webhook POST request from Shiprocket
      const body = await req.json();
      
      // Verify webhook signature (production only)
      const shiprocketSecret = Deno.env.get('SHIPROCKET_WEBHOOK_SECRET');
      if (shiprocketSecret) {
        const signature = req.headers.get('x-shiprocket-signature');
        // TODO: Implement signature verification
        // For now, just log it
        console.log('Webhook signature:', signature);
      }

      orderId = body.order_id;
      status = body.payment_status; // 'success' or 'failed'
      paymentId = body.payment_id;
      
      console.log('PRODUCTION webhook received:', { orderId, status, paymentId });
    }

    // Update order in database
    const updateData: any = {
      payment_id: paymentId,
      payment_status: status === 'success' ? 'paid' : 'failed',
    };

    if (status === 'success') {
      updateData.status = 'paid';
    }

    const { error: updateError } = await supabaseClient
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order:', updateError);
      throw updateError;
    }

    if (status === 'success') {
      // Clear user's cart
      const { data: order } = await supabaseClient
        .from('orders')
        .select('user_id')
        .eq('id', orderId)
        .single();

      if (order) {
        await supabaseClient
          .from('cart_items')
          .delete()
          .eq('user_id', order.user_id);
        
        console.log('Cart cleared for user:', order.user_id);
      }
    }

    // If this is test mode, redirect to success/failure page
    if (isTestMode) {
      const redirectUrl = status === 'success' 
        ? `${url.origin}/order-history?payment=success`
        : `${url.origin}/checkout?payment=failed`;
      
      return new Response(null, {
        status: 302,
        headers: {
          'Location': redirectUrl,
        },
      });
    }

    // Production webhook response
    return new Response(
      JSON.stringify({ 
        success: true,
        order_id: orderId,
        status: status,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
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
