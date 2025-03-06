
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
    const { episodeId, voiceId } = await req.json();
    
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
    
    // Get the podcast episode script
    const { data: episodeData, error: episodeError } = await supabase
      .from("podcast_episodes")
      .select("podcast_script, status")
      .eq("id", episodeId)
      .single();

    if (episodeError) {
      console.error(`Error fetching podcast episode: ${episodeError.message}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch podcast episode: ${episodeError.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!episodeData.podcast_script) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Podcast script not found",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update episode status to generating audio
    await supabase
      .from("podcast_episodes")
      .update({
        status: "generating_audio",
        updated_at: new Date().toISOString(),
      })
      .eq("id", episodeId);

    try {
      // Choose voice ID (default to Daniel if not specified)
      const selectedVoiceId = voiceId || "onwK4e9ZLuTAKqWW03F9"; // Daniel voice
      
      console.log(`Generating audio with voice ID: ${selectedVoiceId}`);
      
      // Generate audio using ElevenLabs API
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": elevenLabsApiKey,
        },
        body: JSON.stringify({
          text: episodeData.podcast_script,
          model_id: "eleven_turbo_v2", // Using Eleven Labs Flash v2.5 model for faster processing
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Get audio as arrayBuffer
      const audioArrayBuffer = await response.arrayBuffer();
      
      // Generate a unique filename
      const filename = `podcast_${episodeId}_${Date.now()}.mp3`;
      const filePath = `public/${filename}`;
      
      console.log(`Uploading audio file: ${filePath}`);
      
      // Upload the audio file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("podcast_audio")
        .upload(filePath, audioArrayBuffer, {
          contentType: "audio/mpeg",
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Error uploading audio file: ${uploadError.message}`);
      }
      
      // Get public URL for the uploaded file
      const { data: publicUrlData } = await supabase.storage
        .from("podcast_audio")
        .getPublicUrl(filePath);
      
      const audioUrl = publicUrlData.publicUrl;
      console.log(`Audio file uploaded successfully. Public URL: ${audioUrl}`);
      
      // Update the podcast episode with the audio URL
      await supabase
        .from("podcast_episodes")
        .update({
          audio_url: audioUrl,
          voice_id: selectedVoiceId,
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
    } catch (processingError) {
      console.error(`Error processing audio: ${processingError.message}`);
      
      // Update the episode with error status
      await supabase
        .from("podcast_episodes")
        .update({
          status: "error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", episodeId);

      return new Response(
        JSON.stringify({
          success: false,
          error: processingError.message,
          episodeId,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
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
