
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

    console.log(`Getting subscription data for user ${user.id}`);

    // Get subscription from database
    const { data: dbSubscription, error: dbError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (dbError && dbError.code !== 'PGRST116') { // No rows found is not an error
      console.error('Error fetching subscription from DB:', dbError);
      return new Response(JSON.stringify({ error: 'Error fetching subscription' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // If no subscription in DB, check Stripe directly
    if (!dbSubscription) {
      const { data: customers } = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });

      if (customers && customers.length > 0) {
        const customerId = customers[0].id;
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: 'active',
          limit: 1,
          expand: ['data.default_payment_method'],
        });

        if (subscriptions.data.length > 0) {
          const subscription = subscriptions.data[0];
          
          // Store subscription in database
          const { error: insertError } = await supabase
            .from('subscriptions')
            .insert({
              user_id: user.id,
              subscription_id: subscription.id,
              status: subscription.status,
              plan_id: subscription.items.data[0].price.id,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end
            });

          if (insertError) {
            console.error('Error saving subscription to DB:', insertError);
          }

          // If payment method is expanded, store it
          if (subscription.default_payment_method) {
            const paymentMethod = subscription.default_payment_method;
            if (paymentMethod.type === 'card' && paymentMethod.card) {
              const { error: pmError } = await supabase
                .from('payment_methods')
                .insert({
                  user_id: user.id,
                  provider_id: paymentMethod.id,
                  card_brand: paymentMethod.card.brand,
                  card_last4: paymentMethod.card.last4,
                  card_exp_month: paymentMethod.card.exp_month,
                  card_exp_year: paymentMethod.card.exp_year,
                  is_default: true
                });

              if (pmError) {
                console.error('Error saving payment method to DB:', pmError);
              }
            }
          }
        }
      }

      // Fetch updated subscription data from database
      const { data: updatedSubscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // Get payment methods from database
      const { data: paymentMethods, error: pmError } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });

      if (pmError) {
        console.error('Error fetching payment methods:', pmError);
      }

      return new Response(JSON.stringify({ 
        subscription: updatedSubscription || null,
        paymentMethods: paymentMethods || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Get payment methods
    const { data: paymentMethods, error: pmError } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false });

    if (pmError) {
      console.error('Error fetching payment methods:', pmError);
    }

    return new Response(JSON.stringify({ 
      subscription: dbSubscription,
      paymentMethods: paymentMethods || []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error fetching subscription data:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
