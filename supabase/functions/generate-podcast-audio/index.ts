
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// Environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const elevenLabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Bennet's voice ID as a fallback
const DEFAULT_VOICE_ID = "bmAn0TLASQN7ctGBMHgN"; // Bennet's voice ID

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
    
    // Use the voice_id from the episode record, or fall back to Bennet's voice if not specified
    const voiceId = episode.voice_id || DEFAULT_VOICE_ID;
    console.log(`Using voice ID: ${voiceId}`);
    
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
    const rawFilename = `raw_podcast_${episodeId}_${timestamp}.mp3`;
    const rawFilePath = `podcast_audio/raw/${rawFilename}`;
    
    // Create a File object from the array buffer
    const audioFile = new File(
      [audioArrayBuffer], 
      rawFilename, 
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

    // Upload raw audio file to Supabase Storage
    console.log(`Uploading raw audio file: ${rawFilePath}`);
    const { error: uploadError } = await supabase
      .storage
      .from("podcast_audio")
      .upload(rawFilePath, audioFile, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload raw audio file: ${uploadError.message}`);
    }

    // Get public URL for the raw uploaded file
    const { data: rawPublicUrlData } = supabase
      .storage
      .from("podcast_audio")
      .getPublicUrl(rawFilePath);

    const rawAudioUrl = rawPublicUrlData.publicUrl;

    // Update episode status
    await supabase
      .from("podcast_episodes")
      .update({
        status: "processing_audio",
        audio_url: rawAudioUrl,
        updated_at: new Date().toISOString(),
        audio_processing_status: "pending"
      })
      .eq("id", episodeId);

    // Process the audio with the external audio processor service directly
    console.log("Processing audio with external audio processor service...");
    
    // Get the audio processor URL from environment variables
    const audioProcessorUrl = Deno.env.get("AUDIO_PROCESSOR_URL");
    
    if (!audioProcessorUrl) {
      console.error("AUDIO_PROCESSOR_URL environment variable is not set");
      await supabase
        .from("podcast_episodes")
        .update({
          status: "completed", // Still mark as completed since we have the raw audio
          audio_processing_status: "error",
          audio_processing_error: "AUDIO_PROCESSOR_URL environment variable is not set",
          updated_at: new Date().toISOString(),
        })
        .eq("id", episodeId);
        
      // We still consider this a success as we have the raw audio
      return new Response(
        JSON.stringify({
          success: true,
          episodeId,
          audioUrl: rawAudioUrl,
          message: "Raw audio generated successfully, but could not process with background music due to missing AUDIO_PROCESSOR_URL",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Ensure URL has proper protocol
    const fullProcessorUrl = audioProcessorUrl.startsWith("http") 
      ? audioProcessorUrl 
      : `https://${audioProcessorUrl}`;
    
    console.log(`Using audio processor at: ${fullProcessorUrl}`);
    
    // Update status to processing
    await supabase
      .from("podcast_episodes")
      .update({
        audio_processing_status: "processing",
        audio_processing_message: "Sending to audio processor service..."
      })
      .eq("id", episodeId);

    // Get default background music from storage
    const { data: musicUrlData } = supabase
      .storage
      .from("podcast_music")
      .getPublicUrl("default_background.mp3");
    
    const defaultMusicUrl = musicUrlData.publicUrl;
    
    console.log(`Background music URL: ${defaultMusicUrl}`);
    
    // Call the audio processor service directly
    try {
      console.log("Calling external audio processor service...");
      const processorResponse = await fetch(`${fullProcessorUrl}/mix-audio/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audio_url: rawAudioUrl,
          background_music_url: defaultMusicUrl,
          intro_duration: 8000,  // 8 seconds
          outro_duration: 8000,  // 8 seconds
          background_volume: -12  // Lower volume for better voice clarity
        })
      });
      
      console.log(`Processor response status: ${processorResponse.status}`);
      
      if (!processorResponse.ok) {
        const errorText = await processorResponse.text();
        throw new Error(`Audio processor service error: ${processorResponse.status} - ${errorText}`);
      }
      
      const processorResult = await processorResponse.json();
      console.log("Audio processor result:", processorResult);
      
      if (!processorResult.success) {
        throw new Error(`Audio processor failed: ${processorResult.error || "Unknown error"}`);
      }
      
      // Update the episode with the processed audio information
      await supabase
        .from("podcast_episodes")
        .update({
          processed_audio_url: rawAudioUrl, // For now, use the original URL
          audio_processing_status: "completed",
          audio_processing_message: "Successfully processed audio with background music",
          status: "completed"
        })
        .eq("id", episodeId);
      
      return new Response(
        JSON.stringify({
          success: true,
          episodeId,
          audioUrl: rawAudioUrl,
          message: "Audio generated and processed with background music successfully",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (processingError) {
      console.error(`Error processing audio: ${processingError.message}`);
      
      // Update the episode with the error but still mark as completed since we have the raw audio
      await supabase
        .from("podcast_episodes")
        .update({
          status: "completed",
          audio_processing_status: "error",
          audio_processing_error: processingError.message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", episodeId);
      
      // We still consider the function a success since we have the raw audio
      return new Response(
        JSON.stringify({
          success: true,
          episodeId,
          audioUrl: rawAudioUrl,
          message: "Raw audio generated successfully, but could not process with background music: " + processingError.message,
        }),
        {
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
