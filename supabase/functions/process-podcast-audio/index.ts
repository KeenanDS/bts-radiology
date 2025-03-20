import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { 
  DEFAULT_BACKGROUND_MUSIC, 
  INTRO_DURATION,
  INTRO_FADE_DURATION,
  OUTRO_DURATION,
  OUTRO_FADE_DURATION,
  MAX_RETRIES,
  RETRY_DELAY_MS
} from "../constants.ts";
import { fetchWithRetry } from "../generate-podcast/utils.ts";

// Environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Simple function to merge episode audio with background music
async function mergeAudioFiles(narrationUrl: string, backgroundMusicUrl: string): Promise<ArrayBuffer> {
  try {
    console.log(`Starting audio merge process`);
    console.log(`Using narration: ${narrationUrl}`);
    console.log(`Using background music: ${backgroundMusicUrl}`);
    
    // Download both audio files
    console.log("Downloading narration audio...");
    const narrationResponse = await fetchWithRetry(narrationUrl, {
      method: "GET",
      headers: { "Content-Type": "audio/mpeg" }
    });
    if (!narrationResponse.ok) {
      throw new Error(`Failed to download narration: ${narrationResponse.status}`);
    }
    const narrationBuffer = await narrationResponse.arrayBuffer();
    
    console.log("Downloading background music...");
    const musicResponse = await fetchWithRetry(backgroundMusicUrl, {
      method: "GET",
      headers: { "Content-Type": "audio/mpeg" }
    });
    if (!musicResponse.ok) {
      throw new Error(`Failed to download background music: ${musicResponse.status}`);
    }
    const musicBuffer = await musicResponse.arrayBuffer();
    
    // Create audio context
    const audioContext = new AudioContext();
    
    // Decode both audio files
    console.log("Decoding audio files...");
    const [narrationAudio, musicAudio] = await Promise.all([
      audioContext.decodeAudioData(narrationBuffer),
      audioContext.decodeAudioData(musicBuffer)
    ]);
    
    // Calculate durations
    const narrationDuration = narrationAudio.duration;
    const totalDuration = narrationDuration + INTRO_DURATION + OUTRO_DURATION;
    
    // Create offline context for rendering
    const offlineContext = new OfflineAudioContext({
      numberOfChannels: 2,
      length: Math.ceil(totalDuration * audioContext.sampleRate),
      sampleRate: audioContext.sampleRate
    });
    
    // Create audio sources
    const narrationSource = offlineContext.createBufferSource();
    narrationSource.buffer = narrationAudio;
    
    const musicSource = offlineContext.createBufferSource();
    musicSource.buffer = musicAudio;
    
    // Create gain nodes for volume control
    const narrationGain = offlineContext.createGain();
    const musicGain = offlineContext.createGain();
    
    // Set gains
    narrationGain.gain.value = 1.0; // Full volume for narration
    musicGain.gain.value = 0.3; // 30% volume for background music
    
    // Connect nodes
    narrationSource.connect(narrationGain);
    musicSource.connect(musicGain);
    narrationGain.connect(offlineContext.destination);
    musicGain.connect(offlineContext.destination);
    
    // Schedule playback
    narrationSource.start(INTRO_DURATION); // Start narration after intro
    
    // Loop background music if needed
    const musicLoops = Math.ceil(totalDuration / musicAudio.duration);
    for (let i = 0; i < musicLoops; i++) {
      const musicSourceLoop = offlineContext.createBufferSource();
      musicSourceLoop.buffer = musicAudio;
      musicSourceLoop.connect(musicGain);
      musicSourceLoop.start(i * musicAudio.duration);
    }
    
    // Fade in/out for background music
    musicGain.gain.setValueAtTime(0, 0);
    musicGain.gain.linearRampToValueAtTime(0.3, INTRO_FADE_DURATION);
    musicGain.gain.setValueAtTime(0.3, totalDuration - OUTRO_FADE_DURATION);
    musicGain.gain.linearRampToValueAtTime(0, totalDuration);
    
    // Render audio
    console.log("Rendering final audio...");
    const renderedBuffer = await offlineContext.startRendering();
    
    // Convert to WAV/MP3 format
    const finalBuffer = renderedBuffer.getChannelData(0).buffer;
    console.log(`Successfully rendered audio: ${finalBuffer.byteLength} bytes`);
    
    return finalBuffer;
  } catch (error) {
    console.error(`Error in audio merge process: ${error.message}`);
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
      // Process the podcast audio with simple merge
      const processedAudioBuffer = await mergeAudioFiles(
        episode.audio_url, 
        backgroundMusicUrl
      );
      
      // Create a timestamp-based filename for the processed file
      const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
      const outputFileName = `podcast_${episodeId}_processed_${timestamp}.mp3`;
      const filePath = `podcast_audio/${outputFileName}`;
      
      // Create a File object from the processed audio buffer
      const audioFile = new File(
        [processedAudioBuffer], 
        outputFileName, 
        { type: "audio/mpeg" }
      );
      
      // Upload the processed audio file
      console.log(`Uploading processed file to ${filePath}`);
      const { error: uploadError } = await supabase
        .storage
        .from("podcast_audio")
        .upload(filePath, audioFile, {
          contentType: "audio/mpeg",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Failed to upload processed file: ${uploadError.message}`);
      }

      // Get public URL for the uploaded file
      const { data: publicUrlData } = await supabase
        .storage
        .from("podcast_audio")
        .getPublicUrl(filePath);

      const processedAudioUrl = publicUrlData.publicUrl;
      
      // Store the URLs in the database
      await supabase
        .from("podcast_episodes")
        .update({
          processed_audio_url: processedAudioUrl,
          background_music_url: backgroundMusicUrl, // Store for reference
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
          message: "Audio processed successfully with intro/outro music",
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

