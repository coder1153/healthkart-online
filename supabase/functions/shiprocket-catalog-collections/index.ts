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
    
    console.log(`Fetching collections: page=${page}, limit=${limit}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Fetch categories/collections
    const { data: collections, error, count } = await supabase
      .from('categories')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching collections:', error);
      throw error;
    }

    // Transform to Shiprocket format
    const shiprocketCollections = collections?.map(category => ({
      id: category.id,
      updated_at: category.created_at, // Using created_at as updated_at
      title: category.name,
      body_html: category.description || '',
      image: {
        src: category.image_url || ''
      }
    })) || [];

    const response = {
      collections: shiprocketCollections,
      pagination: {
        current_page: page,
        per_page: limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    };

    console.log(`Returning ${shiprocketCollections.length} collections`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in catalog collections:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
