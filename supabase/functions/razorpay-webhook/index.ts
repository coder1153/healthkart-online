import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
};

// Verify webhook signature
async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const razorpayWebhookSecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const signature = req.headers.get('x-razorpay-signature');
    const payload = await req.text();

    console.log('Received Razorpay webhook');

    // Verify signature if secret is configured
    if (razorpayWebhookSecret && signature) {
      const isValid = await verifyWebhookSignature(payload, signature, razorpayWebhookSecret);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }
      console.log('Webhook signature verified');
    }

    const event = JSON.parse(payload);
    console.log('Webhook event:', event.event);

    // Handle different webhook events
    switch (event.event) {
      case 'payment.captured': {
        const payment = event.payload.payment.entity;
        const orderId = payment.notes?.order_id;

        if (orderId) {
          console.log('Payment captured for order:', orderId);
          
          await supabaseAdmin
            .from('orders')
            .update({
              payment_status: 'paid',
              status: 'confirmed',
              payment_id: payment.id,
            })
            .eq('id', orderId);
        }
        break;
      }

      case 'payment.failed': {
        const payment = event.payload.payment.entity;
        const orderId = payment.notes?.order_id;

        if (orderId) {
          console.log('Payment failed for order:', orderId);
          
          await supabaseAdmin
            .from('orders')
            .update({
              payment_status: 'failed',
              status: 'payment_failed',
            })
            .eq('id', orderId);
        }
        break;
      }

      case 'order.paid': {
        const order = event.payload.order.entity;
        const orderId = order.notes?.order_id;

        if (orderId) {
          console.log('Order paid:', orderId);
          
          await supabaseAdmin
            .from('orders')
            .update({
              payment_status: 'paid',
              status: 'confirmed',
            })
            .eq('id', orderId);
        }
        break;
      }

      case 'refund.created':
      case 'refund.processed': {
        const refund = event.payload.refund.entity;
        const paymentId = refund.payment_id;

        console.log('Refund processed for payment:', paymentId);
        
        // Find order by payment_id and update status
        await supabaseAdmin
          .from('orders')
          .update({
            payment_status: 'refunded',
            status: 'refunded',
          })
          .eq('payment_id', paymentId);
        break;
      }

      default:
        console.log('Unhandled webhook event:', event.event);
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
