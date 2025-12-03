import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateShipmentRequest {
  order_id: string;
  courier_id: string;
  pickup_location?: string;
  package_weight: number;
  package_length?: number;
  package_breadth?: number;
  package_height?: number;
}

// Shiprocket API token cache
let shiprocketToken: string | null = null;
let tokenExpiry: number = 0;

async function getShiprocketToken(): Promise<string | null> {
  const apiKey = Deno.env.get('SHIPROCKET_API_KEY');
  const apiSecret = Deno.env.get('SHIPROCKET_API_SECRET');

  if (!apiKey || !apiSecret) {
    return null;
  }

  if (shiprocketToken && Date.now() < tokenExpiry) {
    return shiprocketToken;
  }

  try {
    const response = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: apiKey,
        password: apiSecret,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      shiprocketToken = data.token;
      tokenExpiry = Date.now() + (24 * 60 * 60 * 1000);
      return shiprocketToken;
    }
  } catch (error) {
    console.error('Error getting Shiprocket token:', error);
  }

  return null;
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

    const body: CreateShipmentRequest = await req.json();
    console.log('Creating shipment for order:', body.order_id);

    // Get order details
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', body.order_id)
      .eq('user_id', user.id)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    if (order.payment_status !== 'paid') {
      throw new Error('Order payment not confirmed');
    }

    const token = await getShiprocketToken();

    // Test mode
    if (!token) {
      console.log('TEST MODE: Returning mock shipment');
      
      return new Response(
        JSON.stringify({
          success: true,
          test_mode: true,
          shipment: {
            shipment_id: `test_ship_${Date.now()}`,
            awb_code: `TEST${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            courier_name: 'Test Courier',
            status: 'created',
            tracking_url: '#',
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Production mode: Create Shiprocket order
    const shiprocketOrderData = {
      order_id: order.id,
      order_date: new Date(order.created_at).toISOString().split('T')[0],
      pickup_location: body.pickup_location || 'Primary',
      billing_customer_name: order.delivery_name.split(' ')[0],
      billing_last_name: order.delivery_name.split(' ').slice(1).join(' ') || '',
      billing_address: order.delivery_address,
      billing_city: order.delivery_city,
      billing_pincode: order.delivery_pincode,
      billing_state: order.delivery_state,
      billing_country: 'India',
      billing_email: '', // Add email to order if needed
      billing_phone: order.delivery_phone,
      shipping_is_billing: true,
      order_items: order.order_items.map((item: any) => ({
        name: item.product_name,
        sku: item.product_id,
        units: item.quantity,
        selling_price: item.product_price,
      })),
      payment_method: 'Prepaid',
      sub_total: order.total_amount,
      length: body.package_length || 10,
      breadth: body.package_breadth || 10,
      height: body.package_height || 10,
      weight: body.package_weight || 0.5,
    };

    console.log('Creating Shiprocket order...');

    const createResponse = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shiprocketOrderData),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Shiprocket create order error:', errorText);
      throw new Error('Failed to create shipment');
    }

    const createData = await createResponse.json();
    console.log('Shiprocket order created:', createData);

    // Generate AWB
    if (createData.shipment_id && body.courier_id) {
      const awbResponse = await fetch('https://apiv2.shiprocket.in/v1/external/courier/assign/awb', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shipment_id: createData.shipment_id,
          courier_id: body.courier_id,
        }),
      });

      if (awbResponse.ok) {
        const awbData = await awbResponse.json();
        console.log('AWB assigned:', awbData);

        return new Response(
          JSON.stringify({
            success: true,
            test_mode: false,
            shipment: {
              shipment_id: createData.shipment_id,
              order_id: createData.order_id,
              awb_code: awbData.response?.data?.awb_code,
              courier_name: awbData.response?.data?.courier_name,
              status: 'created',
              tracking_url: awbData.response?.data?.tracking_url,
            },
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        test_mode: false,
        shipment: {
          shipment_id: createData.shipment_id,
          order_id: createData.order_id,
          status: 'pending_awb',
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Create shipment error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
