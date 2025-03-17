
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { DEFAULT_BACKGROUND_MUSIC } from "../constants.ts";

// Environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Web Audio API isn't available in Deno runtime, so we'll use a simpler approach for audio mixing
async function mixAudio(narrationArrayBuffer: ArrayBuffer, backgroundMusicArrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    console.log("Starting audio mixing process");
    
    // Create a new Web Audio API context
    // Note: This is a basic implementation and in a real-world scenario,
    // we would use a more sophisticated approach for server-side audio mixing
    
    // For now, we'll implement a client-side approach by providing both audio sources
    // and let the frontend handle the mixing
    
    // In the future, we can implement server-side mixing with proper audio processing libraries
    
    // For the current implementation, we'll just pass through the narration audio
    // and provide the background music URL separately
    
    console.log("Finished audio mixing process");
    return narrationArrayBuffer;
  } catch (error) {
    console.error(`Error in mixAudio: ${error.message}`);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
          backgroundMusicUrl: episode.background_music_url,
          message: "Audio was already processed",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get background music URL from podcast_music bucket
    console.log(`Getting background music file: ${DEFAULT_BACKGROUND_MUSIC}`);
    const { data: backgroundMusicData } = await supabase
      .storage
      .from("podcast_music")
      .getPublicUrl(DEFAULT_BACKGROUND_MUSIC);

    if (!backgroundMusicData?.publicUrl) {
      const errorMsg = `Background music file '${DEFAULT_BACKGROUND_MUSIC}' not found`;
      console.error(errorMsg);
      await updateEpisodeWithError(episodeId, errorMsg);
      return errorResponse(errorMsg);
    }

    const backgroundMusicUrl = backgroundMusicData.publicUrl;
    console.log(`Using background music: ${backgroundMusicUrl}`);

    try {
      // Download the narration audio
      console.log(`Downloading narration audio from ${episode.audio_url}`);
      const narrationResponse = await fetch(episode.audio_url);
      if (!narrationResponse.ok) {
        throw new Error(`Failed to download narration audio: ${narrationResponse.status}`);
      }
      
      // Download the background music
      console.log(`Downloading background music from ${backgroundMusicUrl}`);
      const backgroundMusicResponse = await fetch(backgroundMusicUrl);
      if (!backgroundMusicResponse.ok) {
        throw new Error(`Failed to download background music: ${backgroundMusicResponse.status}`);
      }
      
      // Get narration and background music as array buffers
      const narrationArrayBuffer = await narrationResponse.arrayBuffer();
      const backgroundMusicArrayBuffer = await backgroundMusicResponse.arrayBuffer();
      
      // Since we can't use proper audio mixing in Deno Deploy (no Web Audio API or FFmpeg),
      // we'll provide both URLs and implement client-side mixing
      
      // Create a timestamp-based filename for the processed file
      const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
      const outputFileName = `podcast_${episodeId}_processed_${timestamp}.mp3`;
      const filePath = `podcast_audio/${outputFileName}`;
      
      // Create a File object from the narration array buffer
      const audioFile = new File(
        [narrationArrayBuffer], 
        outputFileName, 
        { type: "audio/mpeg" }
      );
      
      // Upload the processed (currently just the narration) audio file
      console.log(`Uploading narration file to ${filePath}`);
      const { error: uploadError } = await supabase
        .storage
        .from("podcast_audio")
        .upload(filePath, audioFile, {
          contentType: "audio/mpeg",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Failed to upload narration file: ${uploadError.message}`);
      }

      // Get public URL for the uploaded file
      const { data: publicUrlData } = await supabase
        .storage
        .from("podcast_audio")
        .getPublicUrl(filePath);

      const processedAudioUrl = publicUrlData.publicUrl;
      
      // Store both URLs in the database so the frontend can handle the mixing
      await supabase
        .from("podcast_episodes")
        .update({
          processed_audio_url: processedAudioUrl,
          background_music_url: backgroundMusicUrl,
          audio_processing_status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", episodeId);

      return new Response(
        JSON.stringify({
          success: true,
          episodeId,
          processedAudioUrl,
          backgroundMusicUrl,
          message: "Audio processed successfully. Client-side mixing will be used.",
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
