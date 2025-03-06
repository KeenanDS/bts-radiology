
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// Environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const elevenLabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API key
    if (!elevenLabsApiKey) {
      console.error("Missing ELEVENLABS_API_KEY");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error: Missing ElevenLabs API key",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request
    const { episodeId } = await req.json();
    
    if (!episodeId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing episodeId parameter",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Processing audio generation for episode ID: ${episodeId}`);
    
    // Fetch the podcast episode
    const { data: episode, error: fetchError } = await supabase
      .from("podcast_episodes")
      .select("*")
      .eq("id", episodeId)
      .single();

    if (fetchError) {
      console.error(`Error fetching podcast episode: ${fetchError.message}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch podcast episode: ${fetchError.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!episode.podcast_script) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Podcast script is missing",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update episode status
    await supabase
      .from("podcast_episodes")
      .update({
        status: "generating_audio",
        updated_at: new Date().toISOString(),
      })
      .eq("id", episodeId);

    // Generate audio using ElevenLabs API
    console.log("Generating audio with ElevenLabs...");
    const voiceId = episode.voice_id || "onwK4e9ZLuTAKqWW03F9"; // Default to Daniel voice if not specified
    
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": elevenLabsApiKey,
        },
        body: JSON.stringify({
          text: episode.podcast_script,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status} - ${errorText}`);
    }

    // Get audio as array buffer
    const audioArrayBuffer = await elevenLabsResponse.arrayBuffer();
    
    // Generate a filename for the audio file
    const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
    const filename = `podcast_${episodeId}_${timestamp}.mp3`;
    const filePath = `podcast_audio/${filename}`;
    
    // Create a File object from the array buffer
    const audioFile = new File(
      [audioArrayBuffer], 
      filename, 
      { type: "audio/mpeg" }
    );

    // Create storage bucket if it doesn't exist
    const { data: bucketExists } = await supabase
      .storage
      .getBucket("podcast_audio");

    if (!bucketExists) {
      console.log("Creating podcast_audio storage bucket");
      const { error: bucketError } = await supabase
        .storage
        .createBucket("podcast_audio", {
          public: true,
          allowedMimeTypes: ["audio/mpeg"],
          fileSizeLimit: 52428800, // 50MB
        });
      
      if (bucketError) {
        throw new Error(`Failed to create storage bucket: ${bucketError.message}`);
      }
    }

    // Upload audio file to Supabase Storage
    console.log(`Uploading audio file: ${filePath}`);
    const { error: uploadError } = await supabase
      .storage
      .from("podcast_audio")
      .upload(filePath, audioFile, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload audio file: ${uploadError.message}`);
    }

    // Get public URL for the uploaded file
    const { data: publicUrlData } = supabase
      .storage
      .from("podcast_audio")
      .getPublicUrl(filePath);

    const audioUrl = publicUrlData.publicUrl;

    // Update the episode with the audio URL
    await supabase
      .from("podcast_episodes")
      .update({
        audio_url: audioUrl,
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", episodeId);

    return new Response(
      JSON.stringify({
        success: true,
        episodeId,
        audioUrl,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`Error in generate-podcast-audio: ${error.message}`);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
