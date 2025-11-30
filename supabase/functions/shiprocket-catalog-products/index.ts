import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-api-hmac-sha256',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    
    console.log(`Fetching products: page=${page}, limit=${limit}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Fetch products with category information
    const { data: products, error, count } = await supabase
      .from('products')
      .select('*, categories(id, name)', { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error);
      throw error;
    }

    // Transform to Shiprocket format
    const shiprocketProducts = products?.map(product => ({
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
          weight: 0.5 // Default weight in kg
        }
      ],
      image: {
        src: product.image_url || ''
      }
    })) || [];

    const response = {
      products: shiprocketProducts,
      pagination: {
        current_page: page,
        per_page: limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    };

    console.log(`Returning ${shiprocketProducts.length} products`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in catalog products:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
