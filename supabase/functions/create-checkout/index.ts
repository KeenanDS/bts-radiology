
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.1";
import Stripe from "https://esm.sh/stripe@12.0.0?dts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get Supabase and Stripe credentials from environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") as string;

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize Stripe
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
});

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
      const { priceId = 'price_1R8VpILNqUBmFOXgw0XXjXWh', successUrl, cancelUrl } = await req.json();

      console.log(`Creating checkout session for user ${user.id} with price ${priceId}`);

      // Find or create customer
      const { data: customers } = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });

      let customerId;
      if (customers && customers.length > 0) {
        customerId = customers[0].id;
        console.log(`Found existing Stripe customer: ${customerId}`);
      } else {
        const newCustomer = await stripe.customers.create({
          email: user.email,
          metadata: {
            supabase_uid: user.id,
          },
        });
        customerId = newCustomer.id;
        console.log(`Created new Stripe customer: ${customerId}`);
      }

      // Build URLs with origin and handle potential missing origin
      const origin = req.headers.get('Origin') || '';
      
      // Default URLs with better fallbacks
      const defaultSuccessUrl = `${origin}/admin/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
      const defaultCancelUrl = `${origin}/admin/settings?checkout=canceled`;

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl || defaultSuccessUrl,
        cancel_url: cancelUrl || defaultCancelUrl,
        metadata: {
          user_id: user.id,
        },
      });

      return new Response(JSON.stringify({ sessionId: session.id, url: session.url }), {
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
