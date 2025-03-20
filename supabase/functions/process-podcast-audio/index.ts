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
  RETRY_DELAY_MS,
  DOLBY_API_URL,
  DOLBY_AUTH_PATH,
  DOLBY_MEDIA_PATH
} from "../constants.ts";
import { fetchWithRetry } from "../generate-podcast/utils.ts";
// @deno-types="npm:@types/crunker"
import { Crunker } from "npm:crunker@2.4.0";

// Environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const dolbyApiKey = Deno.env.get("DOLBY_API_KEY");
const dolbyApiSecret = Deno.env.get("DOLBY_API_SECRET");

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Process audio with Crunker using a simplified approach
async function processPodcastWithCrunker(narrationUrl: string, backgroundMusicUrl: string): Promise<ArrayBuffer> {
  try {
    console.log(`Starting Crunker audio processing with music`);
    console.log(`Using narration: ${narrationUrl}`);
    console.log(`Using background music: ${backgroundMusicUrl}`);
    
    // Initialize Crunker
    const crunker = new Crunker();
    
    // Fetch both audio files
    console.log("Fetching audio files...");
    const audioBuffers = await crunker.fetchAudio(narrationUrl, backgroundMusicUrl);
    console.log("Successfully fetched audio files");
    
    // Get the narration and background music buffers
    const [narrationBuffer, musicBuffer] = audioBuffers;
    
    // Create the final mix by merging the audio
    console.log("Creating audio mix...");
    const mergedAudio = await crunker.mergeAudio([
      narrationBuffer,  // Original volume for narration
      {
        buffer: musicBuffer,
        volume: 0.3     // Reduce background music volume to 30%
      }
    ]);
    
    // Export as MP3
    console.log("Exporting audio as MP3...");
    const output = await crunker.export(mergedAudio, "audio/mp3");
    
    // Convert blob to ArrayBuffer
    const arrayBuffer = await output.blob.arrayBuffer();
    console.log(`Successfully processed audio: ${arrayBuffer.byteLength} bytes`);
    
    return arrayBuffer;
  } catch (error) {
    console.error(`Error in Crunker processing: ${error.message}`);
    throw error;
  }
}

// Function to get a Dolby input URL for uploading files
// We'll keep this but it's not used directly anymore since we need to access the dlb:// URL
async function getDolbyInputUrl(accessToken: string): Promise<string> {
  // ... keep existing code
}

// Function to download file from Supabase and upload to Dolby
// This function is replaced by direct upload in the main function
async function downloadAndUploadToDolby(sourceUrl: string, dolbyUrl: string, accessToken: string): Promise<void> {
  // ... keep existing code
}

// Function to create the audio mix with intro/outro music
async function createAudioMix(narrationUrl: string, musicUrl: string, narrationDuration: number, accessToken: string): Promise<string> {
  // Create output location with explicit dlb:// path
  const timestamp = Date.now().toString();
  const outputDlbPath = `dlb://out/final_mix_${timestamp}.mp3`;
  console.log(`Requesting output URL for mix path: ${outputDlbPath}`);
  
  const outputResponse = await fetchWithRetry(`${DOLBY_API_URL}${DOLBY_MEDIA_PATH}/output`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      url: outputDlbPath // Specify the output path
    })
  });
  
  if (!outputResponse.ok) {
    const errorText = await outputResponse.text();
    throw new Error(`Failed to create output location: ${outputResponse.status} - ${errorText}`);
  }
  
  const outputData = await outputResponse.json();
  const outputUrl = outputData.url;
  console.log(`Got Dolby output URL for mix: ${outputUrl}`);
  console.log(`Using output dlb:// path for mix: ${outputDlbPath}`);
  
  // Calculate the start time for the outro music (from the end of the narration)
  const outroStartTime = Math.max(0, narrationDuration - OUTRO_DURATION);
  
  // Create and process the audio mix job with intro/outro segments
  console.log("Creating audio mix with intro and outro segments");
  
  const mixJobResponse = await fetchWithRetry(`${DOLBY_API_URL}${DOLBY_MEDIA_PATH}/mix`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      inputs: [
        // Main narration track
        {
          source: narrationUrl,
          gain: 0 // 0dB (default level)
        },
        // Intro music segment
        {
          source: musicUrl,
          segment: {
            start: 0,
            duration: INTRO_DURATION
          },
          destination: {
            start: 0
          },
          gain: -12, // -12dB (background level)
          fade: {
            out: {
              duration: INTRO_FADE_DURATION
            }
          }
        },
        // Outro music segment
        {
          source: musicUrl,
          segment: {
            start: 0,
            duration: OUTRO_DURATION
          },
          destination: {
            start: outroStartTime
          },
          gain: -12, // -12dB (background level)
          fade: {
            in: {
              duration: OUTRO_FADE_DURATION
            }
          }
        }
      ],
      output: outputDlbPath // Use the explicit dlb:// path
    })
  });
  
  if (!mixJobResponse.ok) {
    const errorText = await mixJobResponse.text();
    throw new Error(`Failed to create mix job: ${mixJobResponse.status} - ${errorText}`);
  }
  
  const mixJobData = await mixJobResponse.json();
  const jobId = mixJobData.job_id;
  console.log(`Created audio mix job: ${jobId}`);
  
  // Wait for job completion
  await waitForJobCompletion(jobId, accessToken);
  
  return outputUrl;
}

// Function to get audio duration using Dolby.io API
async function getAudioDuration(audioUrl: string, accessToken: string): Promise<number> {
  // For analyze endpoint, we need to use the URL parameter
  const analysisResponse = await fetchWithRetry(`${DOLBY_API_URL}${DOLBY_MEDIA_PATH}/analyze?url=${encodeURIComponent(audioUrl)}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  });
  
  if (!analysisResponse.ok) {
    const errorText = await analysisResponse.text();
    throw new Error(`Failed to analyze audio duration: ${analysisResponse.status} - ${errorText}`);
  }
  
  const analysisData = await analysisResponse.json();
  return analysisData.duration;
}

// Function to wait for job completion
async function waitForJobCompletion(jobId: string, accessToken: string): Promise<void> {
  let jobStatus = "Running";
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max (checking every 5 seconds)
  
  while (jobStatus !== "Success" && attempts < maxAttempts) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds between checks
    
    const statusResponse = await fetchWithRetry(`${DOLBY_API_URL}${DOLBY_MEDIA_PATH}/jobs/${jobId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });
    
    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      throw new Error(`Failed to check job status: ${statusResponse.status} - ${errorText}`);
    }
    
    const statusData = await statusResponse.json();
    jobStatus = statusData.status;
    console.log(`Job ${jobId} status: ${jobStatus} (attempt ${attempts}/${maxAttempts})`);
    
    if (jobStatus === "Failed") {
      const errorDetails = statusData.error || {};
      throw new Error(`Dolby job failed with details: ${JSON.stringify(errorDetails)}`);
    }
  }
  
  if (jobStatus !== "Success") {
    throw new Error(`Job did not complete successfully within the time limit`);
  }
  
  console.log(`Job ${jobId} completed successfully!`);
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
      // Process the podcast audio with Crunker
      const processedAudioBuffer = await processPodcastWithCrunker(
        episode.audio_url, 
        backgroundMusicUrl
      );
      
      // Create a timestamp-based filename for the processed file
      const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
      const outputFileName = `podcast_${episodeId}_processed_crunker_${timestamp}.mp3`;
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

