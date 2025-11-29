import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShiprocketWebhookPayload {
  order_id: string;
  cart_data: {
    items: Array<{
      variant_id: string;
      quantity: number;
    }>;
  };
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  phone: string;
  email: string;
  payment_type: string;
  total_amount_payable: number;
  shipping_address?: {
    first_name: string;
    last_name: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    zip: string;
    country: string;
    phone: string;
  };
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

    // For test mode, check query parameters
    const url = new URL(req.url);
    const testOrderId = url.searchParams.get('order_id');
    const testStatus = url.searchParams.get('status');

    let orderId: string;
    let status: 'SUCCESS' | 'FAILED' | 'PENDING';
    let isTestMode = false;

    if (testOrderId && testStatus) {
      // TEST MODE: Webhook from query parameters
      console.log('Processing test mode webhook:', { testOrderId, testStatus });
      orderId = testOrderId;
      status = testStatus === 'success' ? 'SUCCESS' : 'FAILED';
      isTestMode = true;
    } else {
      // PRODUCTION MODE: Webhook from POST body
      const payload: ShiprocketWebhookPayload = await req.json();
      console.log('Processing Shiprocket webhook:', payload);
      
      orderId = payload.order_id;
      status = payload.status;
    }

    if (!orderId) {
      throw new Error('Order ID not provided in webhook');
    }

    // Map Shiprocket status to our payment status
    const paymentStatus = status === 'SUCCESS' ? 'paid' : status === 'FAILED' ? 'failed' : 'pending';

    console.log(`Updating order ${orderId} with payment status: ${paymentStatus}`);

    // Update the order payment status
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({
        payment_status: paymentStatus,
        status: paymentStatus === 'paid' ? 'paid' : 'pending',
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order:', updateError);
      throw updateError;
    }

    // If payment successful, clear the user's cart
    if (paymentStatus === 'paid') {
      const { data: order } = await supabaseClient
        .from('orders')
        .select('user_id')
        .eq('id', orderId)
        .single();

      if (order) {
        const { error: cartError } = await supabaseClient
          .from('cart_items')
          .delete()
          .eq('user_id', order.user_id);

        if (cartError) {
          console.error('Error clearing cart:', cartError);
        } else {
          console.log('Cart cleared for user:', order.user_id);
        }
      }
    }

    // For test mode, redirect to appropriate page
    if (isTestMode) {
      const redirectUrl = paymentStatus === 'paid' 
        ? `${url.origin}/order-history?payment=success`
        : `${url.origin}/checkout?payment=failed`;
      
      return new Response(null, {
        status: 302,
        headers: {
          'Location': redirectUrl,
        },
      });
    }

    // For production webhooks, return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processed successfully',
        order_id: orderId,
        payment_status: paymentStatus
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
