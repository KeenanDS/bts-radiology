
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// Environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fetch the featured podcast
    const { data, error } = await supabase
      .from("podcast_episodes")
      .select("*")
      .eq("is_featured", true)
      .eq("status", "completed")
      .maybeSingle();

    if (error) {
      console.error(`Error fetching featured podcast: ${error.message}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch featured podcast: ${error.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // If no featured podcast, get the latest completed one with audio
    if (!data) {
      const { data: latestData, error: latestError } = await supabase
        .from("podcast_episodes")
        .select("*")
        .eq("status", "completed")
        .not("audio_url", "is", null)
        .order("scheduled_for", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestError) {
        console.error(`Error fetching latest podcast: ${latestError.message}`);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to fetch latest podcast: ${latestError.message}`,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          podcast: latestData,
          isFeatured: false,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        podcast: data,
        isFeatured: true,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`Error in get-featured-podcast: ${error.message}`);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
