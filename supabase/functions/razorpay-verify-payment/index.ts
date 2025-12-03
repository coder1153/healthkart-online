import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  order_id: string;
  shipping: {
    courier_id?: string;
    courier_name?: string;
    shipping_cost: number;
    estimated_days?: number;
  };
}

// Verify HMAC-SHA256 signature
async function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = `${orderId}|${paymentId}`;
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return expectedSignature === signature;
}

serve(async (req: Request) => {
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
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const body: VerifyPaymentRequest = await req.json();
    console.log('Verifying Razorpay payment:', body.razorpay_payment_id);

    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!razorpayKeySecret) {
      throw new Error('Razorpay secret not configured');
    }

    // Verify signature
    const isValid = await verifySignature(
      body.razorpay_order_id,
      body.razorpay_payment_id,
      body.razorpay_signature,
      razorpayKeySecret
    );

    if (!isValid) {
      console.error('Invalid Razorpay signature');
      throw new Error('Payment verification failed - invalid signature');
    }

    console.log('Razorpay signature verified successfully');

    // Update order with payment confirmation
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({
        payment_status: 'paid',
        status: 'confirmed',
        payment_id: body.razorpay_payment_id,
      })
      .eq('id', body.order_id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating order:', updateError);
      throw new Error('Failed to update order status');
    }

    // Clear cart items
    const { error: cartError } = await supabaseClient
      .from('cart_items')
      .delete()
      .eq('user_id', user.id);

    if (cartError) {
      console.error('Error clearing cart:', cartError);
      // Continue anyway
    }

    // Now create Shiprocket shipment order
    let shipmentResult = null;
    const shiprocketApiKey = Deno.env.get('SHIPROCKET_API_KEY');
    const shiprocketApiSecret = Deno.env.get('SHIPROCKET_API_SECRET');

    if (shiprocketApiKey && shiprocketApiSecret) {
      try {
        // Get order details for Shiprocket
        const { data: orderData } = await supabaseClient
          .from('orders')
          .select('*, order_items(*)')
          .eq('id', body.order_id)
          .single();

        if (orderData) {
          // Create Shiprocket order (shipping only)
          console.log('Creating Shiprocket shipment order...');
          
          // This would call Shiprocket's create order API
          // For now, we'll store the shipping info
          shipmentResult = {
            courier_id: body.shipping.courier_id,
            courier_name: body.shipping.courier_name,
            shipping_cost: body.shipping.shipping_cost,
            estimated_days: body.shipping.estimated_days,
          };
        }
      } catch (shipError) {
        console.error('Error creating Shiprocket shipment:', shipError);
        // Payment succeeded, shipping creation can be retried
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Payment verified successfully',
        order_id: body.order_id,
        payment_id: body.razorpay_payment_id,
        shipment: shipmentResult,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error verifying payment:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
