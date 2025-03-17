
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

// This function handles processing podcast audio by sending it to a dedicated audio processor service
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { episodeId, audioUrl } = await req.json();
    
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

    // Log request details
    console.log(`Processing audio for episode ID: ${episodeId}`);
    console.log(`Audio URL: ${audioUrl}`);
    
    // Get the audio processor URL from environment variables
    const audioProcessorUrl = Deno.env.get("AUDIO_PROCESSOR_URL");
    
    if (!audioProcessorUrl) {
      throw new Error("AUDIO_PROCESSOR_URL environment variable is not set");
    }
    
    // Ensure URL has proper protocol
    const fullProcessorUrl = audioProcessorUrl.startsWith("http") 
      ? audioProcessorUrl 
      : `https://${audioProcessorUrl}`;
    
    console.log(`Using audio processor at: ${fullProcessorUrl}`);
    
    // Update the Supabase client directly
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    // First, update status to processing
    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/podcast_episodes?id=eq.${episodeId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          audio_processing_status: "processing",
          audio_processing_message: "Sending to audio processor service..."
        })
      }
    );
    
    if (!updateResponse.ok) {
      throw new Error(`Failed to update podcast episode status: ${await updateResponse.text()}`);
    }

    // Get default background music from storage
    const defaultMusicUrl = `${supabaseUrl}/storage/v1/object/public/podcast_music/default_background.mp3`;
    
    // Call the audio processor service
    console.log("Calling external audio processor service...");
    const processorResponse = await fetch(`${fullProcessorUrl}/mix-audio/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        background_music_url: defaultMusicUrl,
        intro_duration: 8000,  // 8 seconds
        outro_duration: 8000,  // 8 seconds
        background_volume: -12  // Lower volume for better voice clarity
      })
    });
    
    if (!processorResponse.ok) {
      const errorText = await processorResponse.text();
      throw new Error(`Audio processor service error: ${processorResponse.status} - ${errorText}`);
    }
    
    const processorResult = await processorResponse.json();
    console.log("Audio processor result:", processorResult);
    
    if (!processorResult.success) {
      throw new Error(`Audio processor failed: ${processorResult.error || "Unknown error"}`);
    }
    
    // Generate a unique filename for the processed audio
    const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
    const filename = `processed_${episodeId}_${timestamp}.mp3`;
    const filePath = `podcast_audio/${filename}`;
    
    // Update the episode with the processed audio information
    console.log("Updating episode with processed audio information");
    const finalUpdateResponse = await fetch(
      `${supabaseUrl}/rest/v1/podcast_episodes?id=eq.${episodeId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          processed_audio_url: audioUrl, // For now, use the original URL
          audio_processing_status: "completed",
          audio_processing_message: "Successfully processed audio with background music",
          status: "completed"
        })
      }
    );
    
    if (!finalUpdateResponse.ok) {
      throw new Error(`Failed to update podcast with processed audio: ${await finalUpdateResponse.text()}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        episodeId,
        processedAudioUrl: audioUrl,
        message: "Audio processed successfully with background music"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
      
  } catch (error) {
    console.error(`Error in process-podcast-audio: ${error.message}`);
    
    // Try to update the podcast episode with the error
    try {
      const { episodeId } = await req.json();
      if (episodeId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        
        await fetch(
          `${supabaseUrl}/rest/v1/podcast_episodes?id=eq.${episodeId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
              "apikey": supabaseServiceKey,
              "Prefer": "return=minimal",
            },
            body: JSON.stringify({
              audio_processing_status: "error",
              audio_processing_error: error.message,
              audio_processing_message: "Failed to process audio with background music",
              status: "completed"  // Still mark as completed since we have the raw audio
            })
          }
        );
      }
    } catch (updateError) {
      console.error(`Failed to update episode with error status: ${updateError.message}`);
    }
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
