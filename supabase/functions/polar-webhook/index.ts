
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get Supabase credentials from environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === 'POST') {
      // Parse the webhook payload
      const payload = await req.json();
      console.log("Received webhook from Polar:", JSON.stringify(payload));

      // Extract information based on event type
      const eventType = payload.type;

      // Handle different event types (subscription.created, subscription.updated, etc.)
      switch (eventType) {
        case 'subscription.created':
        case 'subscription.updated':
          await handleSubscriptionUpdate(payload);
          break;
        case 'subscription.deleted':
          await handleSubscriptionDeletion(payload);
          break;
        default:
          console.log(`Unhandled event type: ${eventType}`);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function handleSubscriptionUpdate(payload: any) {
  const { subscription, customer } = payload;
  
  // Extract user ID from customer metadata
  const userId = customer.metadata?.user_id;
  if (!userId) {
    console.error('No user_id found in customer metadata');
    return;
  }

  // Update subscription record
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      subscription_id: subscription.id,
      status: subscription.status,
      plan_id: subscription.plan.id,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    }, {
      onConflict: 'user_id',
    });

  if (error) {
    console.error('Error updating subscription:', error);
  }
}

async function handleSubscriptionDeletion(payload: any) {
  const { subscription, customer } = payload;
  
  // Extract user ID from customer metadata
  const userId = customer.metadata?.user_id;
  if (!userId) {
    console.error('No user_id found in customer metadata');
    return;
  }
  
  // Update subscription status to cancelled
  const { error } = await supabase
    .from('subscriptions')
    .update({ 
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating subscription status:', error);
  }
}
