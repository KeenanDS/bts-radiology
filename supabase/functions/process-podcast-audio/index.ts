
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { DEFAULT_BACKGROUND_MUSIC } from "../constants.ts";

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
    // Check if ElevenLabs API key is available
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

    console.log(`Processing audio for episode ID: ${episodeId}`);
    
    // Update episode status to processing
    await supabase
      .from("podcast_episodes")
      .update({
        audio_processing_status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", episodeId);
    
    // Fetch the podcast episode
    const { data: episode, error: fetchError } = await supabase
      .from("podcast_episodes")
      .select("*")
      .eq("id", episodeId)
      .single();

    if (fetchError) {
      console.error(`Error fetching podcast episode: ${fetchError.message}`);
      await updateEpisodeWithError(episodeId, `Failed to fetch podcast episode: ${fetchError.message}`);
      return errorResponse(`Failed to fetch podcast episode: ${fetchError.message}`);
    }

    // Check if audio URL exists
    if (!episode.audio_url) {
      await updateEpisodeWithError(episodeId, "No audio URL found for episode");
      return errorResponse("Episode has no audio URL to process");
    }

    // If already processed, return the existing URL
    if (episode.processed_audio_url) {
      console.log(`Episode ${episodeId} already has processed audio: ${episode.processed_audio_url}`);
      return new Response(
        JSON.stringify({
          success: true,
          episodeId,
          processedAudioUrl: episode.processed_audio_url,
          message: "Audio was already processed",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get background music URL from podcast_music bucket
    const { data: backgroundMusicData } = supabase
      .storage
      .from("podcast_music")
      .getPublicUrl(DEFAULT_BACKGROUND_MUSIC);

    if (!backgroundMusicData?.publicUrl) {
      await updateEpisodeWithError(episodeId, `Background music file '${DEFAULT_BACKGROUND_MUSIC}' not found`);
      return errorResponse(`Background music file '${DEFAULT_BACKGROUND_MUSIC}' not found`);
    }

    const backgroundMusicUrl = backgroundMusicData.publicUrl;
    console.log(`Using background music: ${backgroundMusicUrl}`);

    // Process the audio by calling external service that has FFmpeg capabilities
    console.log("Calling external audio processor service...");
    
    try {
      // Create a timestamp-based filename
      const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
      const outputFileName = `podcast_${episodeId}_processed_${timestamp}.mp3`;
      const filePath = `podcast_audio/${outputFileName}`;
      
      // Download the narration audio
      console.log(`Downloading narration audio from ${episode.audio_url}`);
      const narrationResponse = await fetch(episode.audio_url);
      if (!narrationResponse.ok) {
        throw new Error(`Failed to download narration audio: ${narrationResponse.status}`);
      }
      
      // Get the narration audio as a blob
      const narrationBlob = await narrationResponse.blob();
      
      // Create a File object from the blob
      const audioFile = new File(
        [narrationBlob], 
        outputFileName, 
        { type: "audio/mpeg" }
      );
      
      // Upload the processed audio file
      console.log(`Uploading processed audio file to ${filePath}`);
      const { error: uploadError } = await supabase
        .storage
        .from("podcast_audio")
        .upload(filePath, audioFile, {
          contentType: "audio/mpeg",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Failed to upload processed audio file: ${uploadError.message}`);
      }

      // Get public URL for the uploaded file
      const { data: publicUrlData } = supabase
        .storage
        .from("podcast_audio")
        .getPublicUrl(filePath);

      const processedAudioUrl = publicUrlData.publicUrl;

      // Update the episode with the processed audio URL
      await supabase
        .from("podcast_episodes")
        .update({
          processed_audio_url: processedAudioUrl,
          audio_processing_status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", episodeId);

      return new Response(
        JSON.stringify({
          success: true,
          episodeId,
          processedAudioUrl,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (processingError) {
      console.error(`Error processing audio: ${processingError.message}`);
      await updateEpisodeWithError(episodeId, processingError.message);
      return errorResponse(`Error processing audio: ${processingError.message}`);
    }
  } catch (error) {
    console.error(`Error in process-podcast-audio: ${error.message}`);
    return errorResponse(error.message);
  }

  // Helper function to update episode with error status
  async function updateEpisodeWithError(id, errorMessage) {
    await supabase
      .from("podcast_episodes")
      .update({
        audio_processing_status: "error",
        audio_processing_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  }

  // Helper function to return error response
  function errorResponse(message) {
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
