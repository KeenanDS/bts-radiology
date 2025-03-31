
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
const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

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
      const signature = req.headers.get('stripe-signature');
      
      if (!signature) {
        return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // Get the request body
      const body = await req.text();
      
      let event;
      
      // Verify webhook signature
      try {
        event = stripeWebhookSecret 
          ? stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret)
          : JSON.parse(body);
      } catch (err) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return new Response(JSON.stringify({ error: `Webhook signature verification failed` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      console.log(`Processing Stripe event: ${event.type}`);

      // Handle different event types
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const userId = session.metadata?.user_id;
          
          if (userId) {
            await handleSuccessfulSubscription(session, userId);
          } else {
            console.log('No user_id found in session metadata');
          }
          break;
        }
        
        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          await updateSubscription(subscription);
          break;
        }
        
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          await updateSubscription(subscription, 'canceled');
          break;
        }
        
        case 'payment_method.attached': {
          const paymentMethod = event.data.object;
          await savePaymentMethod(paymentMethod);
          break;
        }
        
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Helper function to handle successful subscription
async function handleSuccessfulSubscription(session, userId) {
  // Get subscription details
  const subscriptionId = session.subscription;
  if (!subscriptionId) {
    console.log('No subscription ID found in session');
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['default_payment_method'],
  });

  // Insert or update subscription in DB
  const { error: subscriptionError } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      subscription_id: subscription.id,
      status: subscription.status,
      plan_id: subscription.items.data[0].price.id,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end
    });

  if (subscriptionError) {
    console.error('Error saving subscription:', subscriptionError);
    return;
  }

  // Save payment method if available
  if (subscription.default_payment_method) {
    await savePaymentMethod(subscription.default_payment_method, userId);
  }
}

// Helper function to update a subscription
async function updateSubscription(subscription, status = null) {
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('subscription_id', subscription.id)
    .maybeSingle();

  if (!existingSub) {
    console.log(`No subscription found in DB for Stripe subscription ${subscription.id}`);
    return;
  }

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: status || subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end
    })
    .eq('subscription_id', subscription.id);

  if (error) {
    console.error('Error updating subscription:', error);
  }
}

// Helper function to save a payment method
async function savePaymentMethod(paymentMethod, userId = null) {
  if (!paymentMethod || paymentMethod.type !== 'card' || !paymentMethod.card) {
    return;
  }

  // If we don't have a user ID, try to find it from the customer
  if (!userId) {
    const customerId = paymentMethod.customer;
    if (!customerId) return;

    // Get customer to find user_id
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('subscription_id', paymentMethod.metadata?.subscription_id)
      .maybeSingle();

    if (!subs) {
      const customer = await stripe.customers.retrieve(customerId);
      const { data: users } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', customer.email)
        .maybeSingle();

      if (!users) return;
      userId = users.id;
    } else {
      userId = subs.user_id;
    }
  }

  const { error } = await supabase
    .from('payment_methods')
    .upsert({
      user_id: userId,
      provider_id: paymentMethod.id,
      card_brand: paymentMethod.card.brand,
      card_last4: paymentMethod.card.last4,
      card_exp_month: paymentMethod.card.exp_month,
      card_exp_year: paymentMethod.card.exp_year,
      is_default: true
    });

  if (error) {
    console.error('Error saving payment method:', error);
  }
}
