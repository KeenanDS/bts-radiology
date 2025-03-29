
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get Supabase and Polar credentials from environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
const polarApiKey = Deno.env.get("POLAR_API_KEY") as string;
const polarApiUrl = "https://api.polar.sh/v1";

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === 'POST') {
      // Get the session to verify the user is authenticated
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }

      // Verify the token with Supabase
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }

      // Parse request body
      const { planId, successUrl, cancelUrl } = await req.json();

      if (!planId) {
        return new Response(JSON.stringify({ error: 'Plan ID is required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      console.log(`Creating checkout for plan ID: ${planId}`);

      // Create checkout session with Polar API
      const checkoutResponse = await fetch(`${polarApiUrl}/checkout/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${polarApiKey}`
        },
        body: JSON.stringify({
          plan_id: planId,
          success_url: successUrl || `${req.headers.get('Origin')}/admin/settings?checkout=success`,
          cancel_url: cancelUrl || `${req.headers.get('Origin')}/admin/settings?checkout=canceled`,
          customer_email: user.email,
          customer_metadata: {
            user_id: user.id
          }
        })
      });

      if (!checkoutResponse.ok) {
        const errorData = await checkoutResponse.json();
        console.error('Polar API error:', errorData);
        return new Response(JSON.stringify({ error: 'Failed to create checkout session', details: errorData }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: checkoutResponse.status,
        });
      }

      const checkoutData = await checkoutResponse.json();
      console.log('Checkout session created successfully');
      
      return new Response(JSON.stringify({ url: checkoutData.url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
