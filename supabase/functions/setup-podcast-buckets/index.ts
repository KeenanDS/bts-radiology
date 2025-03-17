
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Setting up podcast storage buckets...");
    
    // Create podcast_audio bucket if it doesn't exist
    const { data: podcastAudioBucket, error: podcastAudioError } = await supabase
      .storage
      .getBucket("podcast_audio");
      
    if (!podcastAudioBucket) {
      console.log("Creating podcast_audio storage bucket");
      const { error } = await supabase
        .storage
        .createBucket("podcast_audio", {
          public: true,
          allowedMimeTypes: ["audio/mpeg"],
          fileSizeLimit: 52428800, // 50MB
        });
      
      if (error) {
        throw new Error(`Failed to create podcast_audio bucket: ${error.message}`);
      }
    }
    
    // Create podcast_music bucket if it doesn't exist
    const { data: podcastMusicBucket, error: podcastMusicError } = await supabase
      .storage
      .getBucket("podcast_music");
      
    if (!podcastMusicBucket) {
      console.log("Creating podcast_music storage bucket");
      const { error } = await supabase
        .storage
        .createBucket("podcast_music", {
          public: true,
          allowedMimeTypes: ["audio/mpeg"],
          fileSizeLimit: 10485760, // 10MB
        });
      
      if (error) {
        throw new Error(`Failed to create podcast_music bucket: ${error.message}`);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Podcast buckets setup completed successfully",
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
