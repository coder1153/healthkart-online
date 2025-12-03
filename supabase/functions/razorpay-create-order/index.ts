import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateOrderRequest {
  amount: number; // Amount in INR (will be converted to paise)
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  shipping: {
    address: string;
    city: string;
    state: string;
    pincode: string;
    courier_id?: string;
    shipping_cost: number;
  };
  cart_items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    price: number;
  }>;
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

    const body: CreateOrderRequest = await req.json();
    console.log('Creating Razorpay order for user:', user.id);

    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials not configured');
    }

    // Calculate total amount in paise (INR × 100)
    const totalAmountPaise = Math.round(body.amount * 100);

    // Create order in database first
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        user_id: user.id,
        total_amount: body.amount,
        status: 'pending',
        payment_status: 'pending',
        delivery_name: body.customer.name,
        delivery_phone: body.customer.phone,
        delivery_address: body.shipping.address,
        delivery_city: body.shipping.city,
        delivery_state: body.shipping.state,
        delivery_pincode: body.shipping.pincode,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      throw new Error('Failed to create order in database');
    }

    // Insert order items
    const orderItems = body.cart_items.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      product_price: item.price,
    }));

    const { error: itemsError } = await supabaseClient
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      // Continue anyway, order is created
    }

    // Create Razorpay order
    const razorpayOrderData = {
      amount: totalAmountPaise,
      currency: body.currency || 'INR',
      receipt: order.id,
      notes: {
        order_id: order.id,
        user_id: user.id,
        customer_email: body.customer.email,
        shipping_address: body.shipping.address,
        ...body.notes,
      },
    };

    console.log('Creating Razorpay order:', razorpayOrderData);

    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${razorpayKeyId}:${razorpayKeySecret}`),
      },
      body: JSON.stringify(razorpayOrderData),
    });

    if (!razorpayResponse.ok) {
      const errorText = await razorpayResponse.text();
      console.error('Razorpay API error:', errorText);
      throw new Error(`Razorpay API error: ${razorpayResponse.statusText}`);
    }

    const razorpayOrder = await razorpayResponse.json();
    console.log('Razorpay order created:', razorpayOrder.id);

    // Update order with Razorpay order ID
    await supabaseClient
      .from('orders')
      .update({ payment_id: razorpayOrder.id })
      .eq('id', order.id);

    return new Response(
      JSON.stringify({
        success: true,
        razorpay_order_id: razorpayOrder.id,
        razorpay_key_id: razorpayKeyId,
        amount: totalAmountPaise,
        currency: razorpayOrder.currency,
        order_id: order.id,
        customer: body.customer,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
