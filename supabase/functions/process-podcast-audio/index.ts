
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
  DOLBY_API_AUTH_PREFIX,
  DOLBY_API_MEDIA_PREFIX
} from "../constants.ts";
import { fetchWithRetry } from "../generate-podcast/utils.ts";

// Environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const dolbyApiKey = Deno.env.get("DOLBY_API_KEY");
const dolbyApiSecret = Deno.env.get("DOLBY_API_SECRET");

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Process audio with Dolby.io using a direct upload approach
async function processPodcastWithDolby(narrationUrl: string, backgroundMusicUrl: string): Promise<ArrayBuffer> {
  try {
    console.log(`Starting Dolby.io audio processing with direct file upload approach`);
    console.log(`Using narration: ${narrationUrl}`);
    console.log(`Using background music: ${backgroundMusicUrl}`);
    
    // Step 1: Get access token from Dolby - Auth endpoints use /v1 prefix
    console.log("Requesting Dolby.io access token...");
    const tokenResponse = await fetch(`${DOLBY_API_URL}${DOLBY_API_AUTH_PREFIX}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${dolbyApiKey}:${dolbyApiSecret}`)}`
      },
      body: "grant_type=client_credentials&expires_in=1800"
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`Token response error: ${tokenResponse.status} - ${errorText}`);
      throw new Error(`Failed to get Dolby.io access token: ${tokenResponse.status} - ${errorText}`);
    }
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log("Successfully obtained Dolby.io access token");
    
    // Step 2: Download the narration audio from Supabase
    console.log("Downloading narration audio from Supabase URL");
    const narrationResponse = await fetch(narrationUrl);
    if (!narrationResponse.ok) {
      throw new Error(`Failed to download narration audio: ${narrationResponse.status}`);
    }
    const narrationBuffer = await narrationResponse.arrayBuffer();
    console.log(`Successfully downloaded narration audio: ${narrationBuffer.byteLength} bytes`);
    
    // Step 3: Download the background music from Supabase
    console.log("Downloading background music from Supabase URL");
    const musicResponse = await fetch(backgroundMusicUrl);
    if (!musicResponse.ok) {
      throw new Error(`Failed to download background music: ${musicResponse.status}`);
    }
    const musicBuffer = await musicResponse.arrayBuffer();
    console.log(`Successfully downloaded background music: ${musicBuffer.byteLength} bytes`);
    
    // Step 4: Upload narration to Dolby.io - Media endpoints don't use /v1 prefix
    console.log("Requesting Dolby.io input URL for narration");
    const narrationUploadResponse = await fetch(`${DOLBY_API_URL}${DOLBY_API_MEDIA_PREFIX}/input`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({}) // Empty body is fine for this endpoint
    });
    
    if (!narrationUploadResponse.ok) {
      const errorText = await narrationUploadResponse.text();
      console.error(`Narration upload request error: ${narrationUploadResponse.status} - ${errorText}`);
      throw new Error(`Failed to get Dolby.io input URL for narration: ${narrationUploadResponse.status} - ${errorText}`);
    }
    
    const narrationUploadData = await narrationUploadResponse.json();
    const narrationUploadUrl = narrationUploadData.url;
    const narrationDolbyUrl = narrationUploadUrl.split("?")[0]; // URL without query params for API calls
    console.log(`Got Dolby.io input URL for narration: ${narrationDolbyUrl}`);
    
    // Upload narration audio to Dolby.io
    console.log("Uploading narration audio to Dolby.io");
    const narrationPutResponse = await fetch(narrationUploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "audio/mpeg",
      },
      body: narrationBuffer
    });
    
    if (!narrationPutResponse.ok) {
      const errorText = await narrationPutResponse.text();
      console.error(`Narration PUT error: ${narrationPutResponse.status} - ${errorText}`);
      throw new Error(`Failed to upload narration audio to Dolby.io: ${narrationPutResponse.status} - ${errorText}`);
    }
    console.log("Successfully uploaded narration audio to Dolby.io");
    
    // Step 5: Upload background music to Dolby.io - Media endpoints don't use /v1 prefix
    console.log("Requesting Dolby.io input URL for background music");
    const musicUploadResponse = await fetch(`${DOLBY_API_URL}${DOLBY_API_MEDIA_PREFIX}/input`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({}) // Empty body is fine for this endpoint
    });
    
    if (!musicUploadResponse.ok) {
      const errorText = await musicUploadResponse.text();
      console.error(`Music upload request error: ${musicUploadResponse.status} - ${errorText}`);
      throw new Error(`Failed to get Dolby.io input URL for background music: ${musicUploadResponse.status} - ${errorText}`);
    }
    
    const musicUploadData = await musicUploadResponse.json();
    const musicUploadUrl = musicUploadData.url;
    const musicDolbyUrl = musicUploadUrl.split("?")[0]; // URL without query params for API calls
    console.log(`Got Dolby.io input URL for background music: ${musicDolbyUrl}`);
    
    // Upload background music to Dolby.io
    console.log("Uploading background music to Dolby.io");
    const musicPutResponse = await fetch(musicUploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "audio/mpeg",
      },
      body: musicBuffer
    });
    
    if (!musicPutResponse.ok) {
      const errorText = await musicPutResponse.text();
      console.error(`Music PUT error: ${musicPutResponse.status} - ${errorText}`);
      throw new Error(`Failed to upload background music to Dolby.io: ${musicPutResponse.status} - ${errorText}`);
    }
    console.log("Successfully uploaded background music to Dolby.io");
    
    // Step 6: Enhance the narration audio for better quality - Media endpoints don't use /v1 prefix
    console.log("Enhancing narration audio for better speech quality");
    const enhancedNarrationUrl = await enhanceNarrationAudio(narrationDolbyUrl, accessToken);
    
    // Step 7: Get audio durations - Media endpoints don't use /v1 prefix
    const narrationDuration = await getAudioDuration(enhancedNarrationUrl, accessToken);
    console.log(`Narration duration: ${narrationDuration} seconds`);
    
    // Step 8: Build the audio mix with intro/outro - Media endpoints don't use /v1 prefix
    console.log("Creating master mix with intro/outro music");
    const outputUrl = await createAudioMix(enhancedNarrationUrl, musicDolbyUrl, narrationDuration, accessToken);
    
    // Step 9: Download the processed file
    console.log(`Downloading final mixed audio from ${outputUrl}`);
    const processedAudioResponse = await fetchWithRetry(outputUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });
    
    if (!processedAudioResponse.ok) {
      const errorText = await processedAudioResponse.text();
      console.error(`Download error: ${processedAudioResponse.status} - ${errorText}`);
      throw new Error(`Failed to download processed audio: ${processedAudioResponse.status} - ${errorText}`);
    }
    
    const processedAudioBuffer = await processedAudioResponse.arrayBuffer();
    console.log(`Successfully downloaded processed audio: ${processedAudioBuffer.byteLength} bytes`);
    
    return processedAudioBuffer;
  } catch (error) {
    console.error(`Error in Dolby processing: ${error.message}`);
    throw error;
  }
}

// Function to enhance narration audio for better speech quality - Media endpoints don't use /v1 prefix
async function enhanceNarrationAudio(inputUrl: string, accessToken: string): Promise<string> {
  // Create output location
  console.log("Creating Dolby.io output location for enhanced narration");
  const outputResponse = await fetchWithRetry(`${DOLBY_API_URL}${DOLBY_API_MEDIA_PREFIX}/output`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    }
  });
  
  if (!outputResponse.ok) {
    const errorText = await outputResponse.text();
    console.error(`Enhance output error: ${outputResponse.status} - ${errorText}`);
    throw new Error(`Failed to create output location: ${outputResponse.status} - ${errorText}`);
  }
  
  const outputData = await outputResponse.json();
  const outputUrl = outputData.url;
  console.log(`Created output location: ${outputUrl}`);
  
  // Use Media Enhance to improve voice clarity - Media endpoints don't use /v1 prefix
  console.log("Submitting enhance job to Dolby.io");
  const enhanceJobResponse = await fetchWithRetry(`${DOLBY_API_URL}${DOLBY_API_MEDIA_PREFIX}/enhance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      input: inputUrl,
      output: outputUrl,
      content: {
        type: "podcast"
      },
      audio: {
        speech: {
          enhance: true,
          noise_reduction: true
        }
      }
    })
  });
  
  if (!enhanceJobResponse.ok) {
    const errorText = await enhanceJobResponse.text();
    console.error(`Enhance job error: ${enhanceJobResponse.status} - ${errorText}`);
    throw new Error(`Failed to create enhancement job: ${enhanceJobResponse.status} - ${errorText}`);
  }
  
  const enhanceJobData = await enhanceJobResponse.json();
  const jobId = enhanceJobData.job_id;
  console.log(`Created enhancement job: ${jobId}`);
  
  // Wait for job completion
  await waitForJobCompletion(jobId, accessToken);
  
  return outputUrl;
}

// Function to create the audio mix with intro/outro music - Media endpoints don't use /v1 prefix
async function createAudioMix(narrationUrl: string, musicUrl: string, narrationDuration: number, accessToken: string): Promise<string> {
  // Create output location
  console.log("Creating Dolby.io output location for final mix");
  const outputResponse = await fetchWithRetry(`${DOLBY_API_URL}${DOLBY_API_MEDIA_PREFIX}/output`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    }
  });
  
  if (!outputResponse.ok) {
    const errorText = await outputResponse.text();
    console.error(`Mix output error: ${outputResponse.status} - ${errorText}`);
    throw new Error(`Failed to create output location for mix: ${outputResponse.status} - ${errorText}`);
  }
  
  const outputData = await outputResponse.json();
  const outputUrl = outputData.url;
  console.log(`Created output location for mix: ${outputUrl}`);
  
  // Calculate the start time for the outro music (from the end of the narration)
  const outroStartTime = Math.max(0, narrationDuration - OUTRO_DURATION);
  
  // Create and process the audio mix job with intro/outro segments - Media endpoints don't use /v1 prefix
  console.log("Creating audio mix with intro and outro segments");
  
  const mixJobResponse = await fetchWithRetry(`${DOLBY_API_URL}${DOLBY_API_MEDIA_PREFIX}/mix`, {
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
      output: outputUrl
    })
  });
  
  if (!mixJobResponse.ok) {
    const errorText = await mixJobResponse.text();
    console.error(`Mix job error: ${mixJobResponse.status} - ${errorText}`);
    throw new Error(`Failed to create mix job: ${mixJobResponse.status} - ${errorText}`);
  }
  
  const mixJobData = await mixJobResponse.json();
  const jobId = mixJobData.job_id;
  console.log(`Created audio mix job: ${jobId}`);
  
  // Wait for job completion
  await waitForJobCompletion(jobId, accessToken);
  
  return outputUrl;
}

// Function to get audio duration using Dolby.io API - Media endpoints don't use /v1 prefix
async function getAudioDuration(audioUrl: string, accessToken: string): Promise<number> {
  console.log(`Getting audio duration for: ${audioUrl}`);
  const analysisResponse = await fetchWithRetry(`${DOLBY_API_URL}${DOLBY_API_MEDIA_PREFIX}/analyze?url=${encodeURIComponent(audioUrl)}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  });
  
  if (!analysisResponse.ok) {
    const errorText = await analysisResponse.text();
    console.error(`Analyze error: ${analysisResponse.status} - ${errorText}`);
    throw new Error(`Failed to analyze audio duration: ${analysisResponse.status} - ${errorText}`);
  }
  
  const analysisData = await analysisResponse.json();
  console.log(`Audio duration analysis result: ${JSON.stringify(analysisData)}`);
  return analysisData.duration;
}

// Function to wait for job completion - Media endpoints don't use /v1 prefix
async function waitForJobCompletion(jobId: string, accessToken: string): Promise<void> {
  let jobStatus = "Running";
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max (checking every 5 seconds)
  
  while (jobStatus !== "Success" && attempts < maxAttempts) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds between checks
    
    console.log(`Checking job status for job ${jobId} (attempt ${attempts}/${maxAttempts})`);
    const statusResponse = await fetchWithRetry(`${DOLBY_API_URL}${DOLBY_API_MEDIA_PREFIX}/jobs/${jobId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });
    
    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error(`Job status error: ${statusResponse.status} - ${errorText}`);
      throw new Error(`Failed to check job status: ${statusResponse.status} - ${errorText}`);
    }
    
    const statusData = await statusResponse.json();
    jobStatus = statusData.status;
    console.log(`Job ${jobId} status: ${jobStatus} (attempt ${attempts}/${maxAttempts})`);
    
    if (jobStatus === "Failed") {
      const errorDetails = statusData.error || {};
      console.error(`Job failed with details: ${JSON.stringify(errorDetails)}`);
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
    // Check if Dolby credentials are set
    if (!dolbyApiKey || !dolbyApiSecret) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Dolby.io API credentials are not configured"
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
      // Process the podcast audio with Dolby.io
      const processedAudioBuffer = await processPodcastWithDolby(
        episode.audio_url, 
        backgroundMusicUrl
      );
      
      // Create a timestamp-based filename for the processed file
      const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
      const outputFileName = `podcast_${episodeId}_processed_dolby_${timestamp}.mp3`;
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
