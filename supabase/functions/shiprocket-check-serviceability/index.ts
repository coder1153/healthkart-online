import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ServiceabilityRequest {
  pickup_pincode: string;
  delivery_pincode: string;
  weight: number; // in kg
  cod: boolean;
}

interface CourierOption {
  courier_id: string;
  courier_name: string;
  rate: number;
  estimated_days: number;
  cod_available: boolean;
  rating: number;
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

  // Check if token is still valid
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
      // Token valid for 10 days, but we refresh earlier
      tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
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

    const body: ServiceabilityRequest = await req.json();
    console.log('Checking serviceability for pincode:', body.delivery_pincode);

    const token = await getShiprocketToken();

    // If no Shiprocket credentials, return mock data for testing
    if (!token) {
      console.log('TEST MODE: Returning mock courier options');
      
      const mockCouriers: CourierOption[] = [
        {
          courier_id: 'mock_standard',
          courier_name: 'Standard Delivery',
          rate: 50,
          estimated_days: 5,
          cod_available: true,
          rating: 4.2,
        },
        {
          courier_id: 'mock_express',
          courier_name: 'Express Delivery',
          rate: 100,
          estimated_days: 2,
          cod_available: true,
          rating: 4.5,
        },
        {
          courier_id: 'mock_overnight',
          courier_name: 'Overnight Delivery',
          rate: 200,
          estimated_days: 1,
          cod_available: false,
          rating: 4.8,
        },
      ];

      return new Response(
        JSON.stringify({
          success: true,
          serviceable: true,
          test_mode: true,
          couriers: mockCouriers,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Production mode: Call Shiprocket API
    const serviceabilityUrl = new URL('https://apiv2.shiprocket.in/v1/external/courier/serviceability/');
    serviceabilityUrl.searchParams.append('pickup_postcode', body.pickup_pincode || '110001');
    serviceabilityUrl.searchParams.append('delivery_postcode', body.delivery_pincode);
    serviceabilityUrl.searchParams.append('weight', body.weight.toString());
    serviceabilityUrl.searchParams.append('cod', body.cod ? '1' : '0');

    const response = await fetch(serviceabilityUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shiprocket serviceability error:', errorText);
      throw new Error('Unable to check serviceability');
    }

    const data = await response.json();
    console.log('Shiprocket serviceability response:', JSON.stringify(data).slice(0, 500));

    // Transform Shiprocket response to our format
    const couriers: CourierOption[] = (data.data?.available_courier_companies || []).map((c: any) => ({
      courier_id: c.courier_company_id?.toString(),
      courier_name: c.courier_name,
      rate: c.rate || c.freight_charge,
      estimated_days: c.estimated_delivery_days || c.etd_days || 5,
      cod_available: c.cod === 1,
      rating: c.rating || 4.0,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        serviceable: couriers.length > 0,
        test_mode: false,
        couriers: couriers.slice(0, 5), // Return top 5 options
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Serviceability check error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        serviceable: false,
        couriers: [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
