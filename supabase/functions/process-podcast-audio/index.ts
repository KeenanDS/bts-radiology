import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { 
  DEFAULT_BACKGROUND_MUSIC, 
  INTRO_MUSIC, 
  OUTRO_MUSIC,
  INTRO_DURATION,
  INTRO_FADE_DURATION,
  OUTRO_DURATION,
  OUTRO_FADE_DURATION
} from "../constants.ts";
import { fetchWithRetry } from "../generate-podcast/utils.ts";

// Environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const dolbyApiKey = Deno.env.get("DOLBY_API_KEY");
const dolbyApiSecret = Deno.env.get("DOLBY_API_SECRET");

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Process audio with Dolby.io to add intro/outro music with fade effects
async function processPodcastWithDolby(narrationUrl: string, introMusicUrl: string, outroMusicUrl: string): Promise<ArrayBuffer> {
  try {
    console.log(`Starting Dolby.io audio processing with intro/outro music`);
    console.log(`Using narration: ${narrationUrl}`);
    console.log(`Using intro music: ${introMusicUrl}`);
    console.log(`Using outro music: ${outroMusicUrl}`);
    
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
    
    // Step 2: Create Dolby Media Input for narration
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
    
    // Step 3: Create Dolby Media Input for intro music
    const introMusicInputResponse = await fetch("https://api.dolby.io/media/input", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        url: introMusicUrl,
        name: "intro_music.mp3"
      })
    });
    
    if (!introMusicInputResponse.ok) {
      const errorText = await introMusicInputResponse.text();
      throw new Error(`Failed to create intro music input: ${introMusicInputResponse.status} - ${errorText}`);
    }
    
    const introMusicInputData = await introMusicInputResponse.json();
    const introMusicInputUrl = introMusicInputData.url;
    console.log(`Created Dolby Media Input for intro music: ${introMusicInputUrl}`);
    
    // Step 4: Create Dolby Media Input for outro music
    const outroMusicInputResponse = await fetch("https://api.dolby.io/media/input", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        url: outroMusicUrl,
        name: "outro_music.mp3"
      })
    });
    
    if (!outroMusicInputResponse.ok) {
      const errorText = await outroMusicInputResponse.text();
      throw new Error(`Failed to create outro music input: ${outroMusicInputResponse.status} - ${errorText}`);
    }
    
    const outroMusicInputData = await outroMusicInputResponse.json();
    const outroMusicInputUrl = outroMusicInputData.url;
    console.log(`Created Dolby Media Input for outro music: ${outroMusicInputUrl}`);
    
    // Step 5: Create an output location for the processed audio
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
    
    // Step 6: Get audio duration using Dolby.io API
    const analysisResponse = await fetch(`https://api.dolby.io/media/analyze?url=${encodeURIComponent(narrationInputUrl)}`, {
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
    const narrationDuration = analysisData.duration;
    console.log(`Narration duration: ${narrationDuration} seconds`);
    
    // Ensure we have enough content for our intro/outro
    if (narrationDuration < INTRO_DURATION + OUTRO_DURATION + 10) {
      console.log("Audio is too short for full intro/outro, adjusting durations");
      // Simplify to just enhance the audio if it's very short
      if (narrationDuration < 60) {
        // For very short clips, just enhance the audio without intro/outro
        return await enhanceAudioOnly(narrationInputUrl, outputUrl, accessToken);
      }
    }
    
    // Step 7: Create and process the advanced audio mix job with intro/outro segments
    // Calculate the start time for the outro music (from the end of the narration)
    const outroStartTime = Math.max(0, narrationDuration - OUTRO_DURATION);
    
    // Create timeline segments for our audio mix
    const timelineSegments = [
      // Intro music segment (0 to INTRO_DURATION seconds)
      {
        source: introMusicInputUrl,
        segment: {
          start: 0,
          duration: INTRO_DURATION
        },
        destination: {
          start: 0
        },
        gain: {
          // Start at -12dB
          points: [
            { time: 0, gain: -12 },
            // Maintain volume until fade out point
            { time: INTRO_DURATION - INTRO_FADE_DURATION, gain: -12 },
            // Fade out to silent
            { time: INTRO_DURATION, gain: -60 }
          ]
        }
      },
      
      // Main narration (entire duration)
      {
        source: narrationInputUrl,
        gain: {
          // Keep narration at 0dB (default level)
          points: [
            { time: 0, gain: 0 }
          ]
        }
      },
      
      // Outro music segment
      {
        source: outroMusicInputUrl,
        segment: {
          start: 0,
          duration: OUTRO_DURATION
        },
        destination: {
          start: outroStartTime
        },
        gain: {
          // Start silent and fade in
          points: [
            { time: outroStartTime, gain: -60 },
            // Fade in to full volume
            { time: outroStartTime + OUTRO_FADE_DURATION, gain: -12 },
            // Maintain until the end
            { time: narrationDuration, gain: -12 }
          ]
        }
      }
    ];
    
    console.log("Creating audio mix with timeline segments:", JSON.stringify(timelineSegments));
    
    const mixJobResponse = await fetch("https://api.dolby.io/media/enhance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        inputs: timelineSegments,
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
    
    if (!mixJobResponse.ok) {
      const errorText = await mixJobResponse.text();
      console.error(`Error in mix job response: ${errorText}`);
      
      // Fallback to simpler enhancement if the advanced mix fails
      console.log("Advanced mix failed, falling back to basic enhancement");
      return await enhanceAudioOnly(narrationInputUrl, outputUrl, accessToken);
    }
    
    const mixJobData = await mixJobResponse.json();
    const jobId = mixJobData.job_id;
    console.log(`Created Dolby Media Enhance job: ${jobId}`);
    
    // Step 8: Poll for job completion
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
        const errorDetails = statusData.error || {};
        console.error(`Dolby job failed with details:`, errorDetails);
        
        // Fallback to simpler enhancement if the advanced mix fails
        console.log("Mix job failed, falling back to basic enhancement");
        return await enhanceAudioOnly(narrationInputUrl, outputUrl, accessToken);
      }
    }
    
    if (jobStatus !== "Success") {
      console.log("Job timed out, falling back to basic enhancement");
      return await enhanceAudioOnly(narrationInputUrl, outputUrl, accessToken);
    }
    
    // Step 9: Download the processed file
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

// Fallback function for simple audio enhancement if complex mixing fails
async function enhanceAudioOnly(narrationInputUrl: string, outputUrl: string, accessToken: string): Promise<ArrayBuffer> {
  console.log("Performing basic audio enhancement without intro/outro music");
  
  try {
    // Create a basic enhancement job
    const enhanceJobResponse = await fetch("https://api.dolby.io/media/enhance", {
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
          }
        }
      })
    });
    
    if (!enhanceJobResponse.ok) {
      const errorText = await enhanceJobResponse.text();
      throw new Error(`Failed to create enhancement job: ${enhanceJobResponse.status} - ${errorText}`);
    }
    
    const enhanceJobData = await enhanceJobResponse.json();
    const jobId = enhanceJobData.job_id;
    console.log(`Created basic enhancement job: ${jobId}`);
    
    // Poll for job completion
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
        throw new Error(`Basic enhancement job failed: ${JSON.stringify(statusData.error || {})}`);
      }
    }
    
    if (jobStatus !== "Success") {
      throw new Error(`Job did not complete successfully within the time limit`);
    }
    
    // Download the processed file
    console.log(`Downloading enhanced audio from ${outputUrl}`);
    const processedAudioResponse = await fetch(outputUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });
    
    if (!processedAudioResponse.ok) {
      const errorText = await processedAudioResponse.text();
      throw new Error(`Failed to download enhanced audio: ${processedAudioResponse.status} - ${errorText}`);
    }
    
    const processedAudioBuffer = await processedAudioResponse.arrayBuffer();
    console.log(`Successfully downloaded enhanced audio: ${processedAudioBuffer.byteLength} bytes`);
    
    return processedAudioBuffer;
  } catch (error) {
    console.error(`Error in basic enhancement: ${error.message}`);
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

    // Get intro music URL from podcast_music bucket
    console.log(`Getting intro music file: ${INTRO_MUSIC}`);
    const { data: introMusicData } = await supabase
      .storage
      .from("podcast_music")
      .getPublicUrl(INTRO_MUSIC);

    // Get outro music URL from podcast_music bucket  
    console.log(`Getting outro music file: ${OUTRO_MUSIC}`);
    const { data: outroMusicData } = await supabase
      .storage
      .from("podcast_music")
      .getPublicUrl(OUTRO_MUSIC);

    // Fallback to default background music if intro or outro music is missing
    if (!introMusicData?.publicUrl || !outroMusicData?.publicUrl) {
      console.log("Intro or outro music not found, falling back to default background music");
      
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
      
      // If missing intro or outro, use the default for both
      const introMusicUrl = introMusicData?.publicUrl || backgroundMusicData.publicUrl;
      const outroMusicUrl = outroMusicData?.publicUrl || backgroundMusicData.publicUrl;
      
      console.log(`Using intro music: ${introMusicUrl}`);
      console.log(`Using outro music: ${outroMusicUrl}`);
      console.log(`Using default background music: ${backgroundMusicData.publicUrl}`);

      try {
        // Process the podcast audio with Dolby.io
        const processedAudioBuffer = await processPodcastWithDolby(
          episode.audio_url, 
          introMusicUrl,
          outroMusicUrl
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
            background_music_url: backgroundMusicData.publicUrl, // Store for reference
            audio_processing_status: "completed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", episodeId);

        return new Response(
          JSON.stringify({
            success: true,
            episodeId,
            processedAudioUrl,
            backgroundMusicUrl: backgroundMusicData.publicUrl,
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
    } else {
      // We have both intro and outro music
      const introMusicUrl = introMusicData.publicUrl;
      const outroMusicUrl = outroMusicData.publicUrl;
      
      console.log(`Using intro music: ${introMusicUrl}`);
      console.log(`Using outro music: ${outroMusicUrl}`);

      try {
        // Process the podcast audio with Dolby.io
        const processedAudioBuffer = await processPodcastWithDolby(
          episode.audio_url, 
          introMusicUrl,
          outroMusicUrl
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
        
        // For UI reference, store one of the music URLs
        const backgroundMusicUrl = introMusicUrl;
        
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
