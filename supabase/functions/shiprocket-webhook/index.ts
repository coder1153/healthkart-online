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

    const url = new URL(req.url);
    let orderId: string;
    let status: 'SUCCESS' | 'FAILED' | 'PENDING';
    let isTestMode = false;

    // Check for query parameter test mode first
    const testOrderId = url.searchParams.get('order_id');
    const testStatus = url.searchParams.get('status');

    if (testOrderId && testStatus) {
      // TEST MODE via query params
      console.log('Processing test mode webhook (query params):', { testOrderId, testStatus });
      orderId = testOrderId;
      status = testStatus === 'success' ? 'SUCCESS' : 'FAILED';
      isTestMode = true;
    } else {
      // POST body (test or production)
      const payload: ShiprocketWebhookPayload & { test_mode?: boolean } = await req.json();
      console.log('Processing webhook (POST):', payload);
      
      orderId = payload.order_id;
      status = payload.status;
      isTestMode = payload.test_mode || false;
      
      if (isTestMode) {
        console.log('TEST MODE: Processing test payment webhook');
      }
    }

    if (!orderId) {
      throw new Error('Order ID not provided in webhook');
    }

    // Map Shiprocket status to our payment status
    const paymentStatus = status === 'SUCCESS' ? 'paid' : status === 'FAILED' ? 'failed' : 'pending';

    console.log(`Updating order ${orderId} with payment status: ${paymentStatus}`);

    // Find order by payment_id (which stores the Shiprocket order_id)
    const { data: existingOrder } = await supabaseClient
      .from('orders')
      .select('id, user_id')
      .eq('payment_id', orderId)
      .single();

    if (!existingOrder) {
      console.error('Order not found for payment_id:', orderId);
      throw new Error('Order not found');
    }

    // Update the order payment status
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({
        payment_status: paymentStatus,
        status: paymentStatus === 'paid' ? 'paid' : 'pending',
      })
      .eq('id', existingOrder.id);

    if (updateError) {
      console.error('Error updating order:', updateError);
      throw updateError;
    }

    // If payment successful, clear the user's cart
    if (paymentStatus === 'paid' && existingOrder) {
      const { error: cartError } = await supabaseClient
        .from('cart_items')
        .delete()
        .eq('user_id', existingOrder.user_id);

      if (cartError) {
        console.error('Error clearing cart:', cartError);
      } else {
        console.log('Cart cleared for user:', existingOrder.user_id);
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
