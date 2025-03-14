
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { processPodcastRequest } from "./podcast-processor.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API keys
    const perplexityApiKey = Deno.env.get("PERPLEXITY_API_KEY");
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!perplexityApiKey) {
      console.error("Missing PERPLEXITY_API_KEY");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error: Missing Perplexity API key",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!openAIApiKey) {
      console.error("Missing OPENAI_API_KEY");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error: Missing OpenAI API key",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request
    const { scheduledFor } = await req.json();
    
    if (!scheduledFor) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing scheduledFor parameter",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Processing podcast request scheduled for ${scheduledFor}`);
    
    // Process the podcast request
    const result = await processPodcastRequest(scheduledFor);
    
    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: result.success ? 200 : result.status || 500,
      }
    );
  } catch (error) {
    console.error(`Error in generate-podcast: ${error.message}`);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: `Error occurred at ${new Date().toISOString()}`
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
