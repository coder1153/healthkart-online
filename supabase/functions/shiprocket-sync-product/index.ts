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

    const { productId } = await req.json();

    if (!productId) {
      throw new Error('productId is required');
    }

    console.log(`Syncing product ${productId} to Shiprocket`);

    // Fetch the product
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*, categories(id, name)')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      throw new Error('Product not found');
    }

    // Check if Shiprocket credentials are configured
    const apiKey = Deno.env.get('SHIPROCKET_API_KEY');
    const secretKey = Deno.env.get('SHIPROCKET_API_SECRET');

    if (!apiKey || !secretKey) {
      console.log('Shiprocket credentials not configured, skipping sync');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Shiprocket not configured, sync skipped' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Transform to Shiprocket format
    const shiprocketProduct = {
      id: product.id,
      title: product.name,
      body_html: product.detailed_description || product.description || '',
      vendor: product.manufacturer || '',
      product_type: product.categories?.name || 'General',
      updated_at: product.updated_at,
      status: product.stock > 0 ? 'active' : 'draft',
      variants: [
        {
          id: product.id,
          title: 'Default',
          price: product.price.toString(),
          quantity: product.stock,
          sku: `SKU-${product.id.substring(0, 8)}`,
          updated_at: product.updated_at,
          image: {
            src: product.image_url || ''
          },
          weight: 0.5
        }
      ],
      image: {
        src: product.image_url || ''
      }
    };

    // Generate HMAC
    const payload = JSON.stringify(shiprocketProduct);
    const hmac = await generateHMAC(secretKey, payload);

    // Send to Shiprocket
    const response = await fetch('https://checkout-api.shiprocket.com/wh/v1/custom/product', {
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
      console.error('Shiprocket sync failed:', errorText);
      throw new Error(`Shiprocket sync failed: ${response.status}`);
    }

    console.log(`Successfully synced product ${productId} to Shiprocket`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error syncing product:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
