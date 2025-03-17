
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
        console.log(`Checking if bucket '${bucket}' exists...`);
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
          console.log(`Bucket '${bucket}' exists, ensuring it's public...`);
          // Ensure the bucket is public
          const updateBucketUrl = `${supabaseUrl}/storage/v1/bucket/${bucket}`;
          const updateResponse = await fetch(updateBucketUrl, {
            method: "PUT",
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
          
          if (updateResponse.ok) {
            console.log(`Successfully updated bucket '${bucket}' to public`);
            results.push({
              bucket,
              status: "exists",
              action: "updated to public"
            });
          } else {
            const errorText = await updateResponse.text();
            console.error(`Failed to update bucket '${bucket}' to public: ${updateResponse.status} - ${errorText}`);
            throw new Error(`Failed to update bucket to public: ${updateResponse.status} - ${errorText}`);
          }
          
          continue;
        }
        
        // If bucket doesn't exist, create it
        if (checkResponse.status === 404) {
          console.log(`Bucket '${bucket}' doesn't exist, creating it...`);
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
            console.error(`Failed to create bucket '${bucket}': ${createResponse.status} - ${errorText}`);
            throw new Error(`Failed to create bucket: ${createResponse.status} - ${errorText}`);
          }
          
          console.log(`Successfully created bucket '${bucket}'`);
          results.push({
            bucket,
            status: "created",
            action: "create as public"
          });
        } else {
          console.error(`Error checking bucket '${bucket}': ${checkResponse.status}`);
          throw new Error(`Error checking bucket: ${checkResponse.status}`);
        }
      } catch (error) {
        console.error(`Error with bucket ${bucket}:`, error);
        results.push({
          bucket,
          status: "error",
          error: error.message,
          action: "failed"
        });
      }
    }
    
    // Create RLS policies to make buckets accessible to anonymous users
    try {
      console.log("Ensuring RLS policies exist for public access...");
      
      // Note: In a real-world application, you would want more granular policies
      // This is just for testing and demonstration purposes
      const policyCheckUrl = `${supabaseUrl}/rest/v1/storage.policies?name=eq.Public%20Access%20to%20Podcast%20Files`;
      const policyCheckResponse = await fetch(policyCheckUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
        },
      });
      
      // For simplicity, we're not checking if policies exist - SQL scripts should create them
      console.log("RLS policies should be created via SQL scripts for reliability");
    } catch (policyError) {
      console.error("Error checking/creating policies:", policyError);
      // Non-critical error, continue
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
