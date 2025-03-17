
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { DEFAULT_BACKGROUND_MUSIC } from "../constants.ts";
import { fetchWithRetry } from "../generate-podcast/utils.ts";

// Environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const dolbyApiKey = Deno.env.get("DOLBY_API_KEY");
const dolbyApiSecret = Deno.env.get("DOLBY_API_SECRET");

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Process audio with Dolby.io to mix narration with background music
async function processPodcastWithDolby(narrationUrl: string, backgroundMusicUrl: string): Promise<ArrayBuffer> {
  try {
    console.log(`Starting Dolby.io audio processing`);
    console.log(`Using narration: ${narrationUrl}`);
    console.log(`Using background music: ${backgroundMusicUrl}`);
    
    // Step 1: Get access token from Dolby
    const tokenResponse = await fetch("https://api.dolby.io/v1/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${dolbyApiKey}:${dolbyApiSecret}`)}`
      },
      body: "grant_type=client_credentials&expires_in=1800"
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Failed to get Dolby.io access token: ${tokenResponse.status} - ${errorText}`);
    }
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log("Successfully obtained Dolby.io access token");
    
    // Step 2: Create a new Dolby Media Input for the narration
    const narrationInputResponse = await fetch("https://api.dolby.io/media/input", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        url: narrationUrl,
        name: "podcast_narration.mp3"
      })
    });
    
    if (!narrationInputResponse.ok) {
      const errorText = await narrationInputResponse.text();
      throw new Error(`Failed to create narration input: ${narrationInputResponse.status} - ${errorText}`);
    }
    
    const narrationInputData = await narrationInputResponse.json();
    const narrationInputUrl = narrationInputData.url;
    console.log(`Created Dolby Media Input for narration: ${narrationInputUrl}`);
    
    // Step 3: Create a new Dolby Media Input for the background music
    const bgMusicInputResponse = await fetch("https://api.dolby.io/media/input", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        url: backgroundMusicUrl,
        name: "background_music.mp3"
      })
    });
    
    if (!bgMusicInputResponse.ok) {
      const errorText = await bgMusicInputResponse.text();
      throw new Error(`Failed to create background music input: ${bgMusicInputResponse.status} - ${errorText}`);
    }
    
    const bgMusicInputData = await bgMusicInputResponse.json();
    const bgMusicInputUrl = bgMusicInputData.url;
    console.log(`Created Dolby Media Input for background music: ${bgMusicInputUrl}`);
    
    // Step 4: Create an output location for the processed audio
    const outputResponse = await fetch("https://api.dolby.io/media/output", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      }
    });
    
    if (!outputResponse.ok) {
      const errorText = await outputResponse.text();
      throw new Error(`Failed to create output location: ${outputResponse.status} - ${errorText}`);
    }
    
    const outputData = await outputResponse.json();
    const outputUrl = outputData.url;
    console.log(`Created Dolby Media Output location: ${outputUrl}`);
    
    // Step 5: Create and process the audio mix job
    const mixJobResponse = await fetch("https://api.dolby.io/media/enhance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        input: narrationInputUrl,
        output: outputUrl,
        content: {
          type: "podcast"
        },
        audio: {
          speech: {
            enhance: true,
            noise_reduction: true
          },
          music: {
            background: bgMusicInputUrl,
            relative_level: -14 // Background music is 14dB lower than speech
          }
        }
      })
    });
    
    if (!mixJobResponse.ok) {
      const errorText = await mixJobResponse.text();
      throw new Error(`Failed to create mix job: ${mixJobResponse.status} - ${errorText}`);
    }
    
    const mixJobData = await mixJobResponse.json();
    const jobId = mixJobData.job_id;
    console.log(`Created Dolby Media Enhance job: ${jobId}`);
    
    // Step 6: Poll for job completion
    let jobStatus = "Running";
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (checking every 5 seconds)
    
    while (jobStatus !== "Success" && attempts < maxAttempts) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds between checks
      
      const statusResponse = await fetch(`https://api.dolby.io/media/enhance?job_id=${jobId}`, {
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
        throw new Error(`Dolby job failed: ${JSON.stringify(statusData.error || {})}`);
      }
    }
    
    if (jobStatus !== "Success") {
      throw new Error(`Job did not complete successfully within the time limit`);
    }
    
    // Step 7: Download the processed file
    console.log(`Downloading processed audio from ${outputUrl}`);
    const processedAudioResponse = await fetch(outputUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });
    
    if (!processedAudioResponse.ok) {
      const errorText = await processedAudioResponse.text();
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
          message: "Audio processed successfully with Dolby.io",
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
