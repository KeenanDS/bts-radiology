
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { 
  fetchAudioAsArrayBuffer, 
  processAudio 
} from "../_shared/audio-processor.ts";

// This is the JavaScript implementation of the audio processor 
// that was previously implemented in Python
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the request body
    const payload = await req.json();
    
    // Extract required parameters
    const episodeId = payload.episodeId;
    const audioUrl = payload.audioUrl;
    
    if (!episodeId || !audioUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required parameters: episodeId or audioUrl",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    console.log(`Processing audio for episode ID: ${episodeId}`);
    console.log(`Audio URL: ${audioUrl}`);
    
    // Update the episode status to processing
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    await updateEpisodeStatus(
      supabaseUrl, 
      supabaseServiceKey, 
      episodeId, 
      "processing"
    );
    
    // Try to get background music
    let backgroundMusicUrl = "";
    try {
      backgroundMusicUrl = await getDefaultBackgroundMusic(supabaseUrl);
      if (!backgroundMusicUrl) {
        throw new Error("No background music URL found");
      }
      console.log(`Using background music: ${backgroundMusicUrl}`);
    } catch (error) {
      console.error(`Error getting background music: ${error.message}`);
      
      // Update episode with error
      await updateEpisodeStatus(
        supabaseUrl, 
        supabaseServiceKey, 
        episodeId, 
        "error", 
        `Failed to load background music: ${error.message}`
      );
      
      // Return the original audio URL
      return new Response(
        JSON.stringify({
          success: true,
          episodeId: episodeId,
          processedAudioUrl: audioUrl,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    try {
      // Download the audio files
      console.log("Downloading podcast audio...");
      const narrationAudioBuffer = await fetchAudioAsArrayBuffer(audioUrl);
      
      console.log("Downloading background music...");
      const backgroundMusicBuffer = await fetchAudioAsArrayBuffer(backgroundMusicUrl);
      
      // Process the audio files
      console.log("Processing audio...");
      const processedAudioBuffer = await processAudio(
        narrationAudioBuffer,
        backgroundMusicBuffer
      );
      
      // Upload the processed audio to Supabase
      console.log("Uploading processed audio...");
      const timestamp = Math.floor(Date.now() / 1000);
      const processedFilePath = `processed_${episodeId}_${timestamp}.mp3`;
      
      const processedAudioUrl = await uploadToSupabase(
        supabaseUrl,
        supabaseServiceKey,
        "podcast_audio",
        processedFilePath,
        processedAudioBuffer,
        "audio/mpeg"
      );
      
      // Update the episode with the processed audio URL
      await updateEpisodeWithProcessedAudio(
        supabaseUrl,
        supabaseServiceKey,
        episodeId,
        processedAudioUrl
      );
      
      // Return success response
      return new Response(
        JSON.stringify({
          success: true,
          episodeId: episodeId,
          processedAudioUrl: processedAudioUrl,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
      
    } catch (error) {
      console.error(`Error processing audio: ${error.message}`);
      
      // Update episode with error
      await updateEpisodeStatus(
        supabaseUrl, 
        supabaseServiceKey, 
        episodeId, 
        "error", 
        error.message
      );
      
      // Return error response
      return new Response(
        JSON.stringify({
          success: false,
          episodeId: episodeId,
          error: `Error processing audio: ${error.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
  } catch (error) {
    console.error(`Error in process-podcast-audio-python: ${error.message}`);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Helper functions

async function getDefaultBackgroundMusic(supabaseUrl: string): Promise<string> {
  // Check if the background music exists in the podcast_music bucket
  const musicUrl = `${supabaseUrl}/storage/v1/object/public/podcast_music/default_background.mp3`;
  
  try {
    const response = await fetch(musicUrl, { method: 'HEAD' });
    if (response.ok) {
      return musicUrl;
    }
    
    throw new Error(`Default background music not found at ${musicUrl}. Status: ${response.status}`);
  } catch (error) {
    console.error("Error checking for background music:", error);
    throw new Error("Default background music not found. Please upload a file named 'default_background.mp3' to the podcast_music bucket.");
  }
}

async function updateEpisodeStatus(
  supabaseUrl: string,
  supabaseKey: string,
  episodeId: string,
  status: string,
  errorMessage?: string
): Promise<void> {
  const url = `${supabaseUrl}/rest/v1/podcast_episodes?id=eq.${episodeId}`;
  
  const updateData: Record<string, any> = {
    audio_processing_status: status
  };
  
  if (errorMessage) {
    updateData.audio_processing_error = errorMessage;
  }
  
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${supabaseKey}`,
      "apikey": supabaseKey,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
    body: JSON.stringify(updateData),
  });
  
  if (!response.ok) {
    console.error(`Failed to update podcast episode status: ${await response.text()}`);
    throw new Error(`Failed to update podcast episode status: ${response.status}`);
  }
}

async function updateEpisodeWithProcessedAudio(
  supabaseUrl: string,
  supabaseKey: string,
  episodeId: string,
  processedAudioUrl: string
): Promise<void> {
  const url = `${supabaseUrl}/rest/v1/podcast_episodes?id=eq.${episodeId}`;
  
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${supabaseKey}`,
      "apikey": supabaseKey,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({
      processed_audio_url: processedAudioUrl,
      audio_processing_status: "completed"
    }),
  });
  
  if (!response.ok) {
    console.error(`Failed to update podcast episode with processed audio: ${await response.text()}`);
    throw new Error(`Failed to update podcast episode with processed audio: ${response.status}`);
  }
}

async function uploadToSupabase(
  supabaseUrl: string,
  supabaseKey: string,
  bucket: string,
  path: string,
  fileContent: ArrayBuffer,
  contentType: string
): Promise<string> {
  // Ensure the bucket exists
  await ensureBucketExists(supabaseUrl, supabaseKey, bucket);
  
  // Upload the file
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;
  
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": contentType,
    },
    body: new Uint8Array(fileContent),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to upload file to Supabase: ${errorText}`);
    throw new Error(`Failed to upload file: ${response.status} - ${errorText}`);
  }
  
  // Return the public URL
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

async function ensureBucketExists(
  supabaseUrl: string,
  supabaseKey: string,
  bucket: string
): Promise<void> {
  try {
    // First, check if the bucket exists
    const getBucketUrl = `${supabaseUrl}/storage/v1/bucket/${bucket}`;
    const checkResponse = await fetch(getBucketUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${supabaseKey}`,
        "apikey": supabaseKey,
      },
    });
    
    if (checkResponse.ok) {
      return; // Bucket exists
    }
    
    // If bucket doesn't exist, create it
    if (checkResponse.status === 404) {
      const createBucketUrl = `${supabaseUrl}/storage/v1/bucket`;
      const createResponse = await fetch(createBucketUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "apikey": supabaseKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: bucket,
          name: bucket,
          public: true,
          file_size_limit: 52428800, // 50MB
        }),
      });
      
      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error(`Failed to create bucket: ${errorText}`);
        throw new Error(`Failed to create bucket: ${createResponse.status} - ${errorText}`);
      }
    } else {
      throw new Error(`Error checking bucket: ${checkResponse.status}`);
    }
  } catch (error) {
    console.error(`Error ensuring bucket exists: ${error.message}`);
    throw error;
  }
}
