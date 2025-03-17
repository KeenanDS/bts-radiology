
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Function to ensure that storage buckets for podcast audio and music exist
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    // Create storage buckets if they don't exist
    const buckets = ["podcast_audio", "podcast_music"];
    const results = [];
    
    for (const bucket of buckets) {
      try {
        // Check if bucket exists
        const getBucketUrl = `${supabaseUrl}/storage/v1/bucket/${bucket}`;
        const checkResponse = await fetch(getBucketUrl, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "apikey": supabaseServiceKey,
          },
        });
        
        if (checkResponse.ok) {
          results.push({
            bucket,
            status: "exists",
            action: "none"
          });
          continue;
        }
        
        // If bucket doesn't exist, create it
        if (checkResponse.status === 404) {
          const createBucketUrl = `${supabaseUrl}/storage/v1/bucket`;
          const createResponse = await fetch(createBucketUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${supabaseServiceKey}`,
              "apikey": supabaseServiceKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: bucket,
              name: bucket,
              public: true,
              file_size_limit: 52428800, // 50MB
            }),
          });
          
          if (!createResponse.ok) {
            const errorText = await createResponse.text();
            throw new Error(`Failed to create bucket: ${createResponse.status} - ${errorText}`);
          }
          
          results.push({
            bucket,
            status: "created",
            action: "create"
          });
        } else {
          throw new Error(`Error checking bucket: ${checkResponse.status}`);
        }
      } catch (error) {
        results.push({
          bucket,
          status: "error",
          error: error.message,
          action: "failed"
        });
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        results
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`Error in setup-podcast-buckets: ${error.message}`);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
