
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

// This is a Deno wrapper around our Python function
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

    // Call the Python function
    console.log(`Processing audio for episode ID: ${episodeId}`);
    console.log(`Audio URL: ${audioUrl}`);
    
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
          audio_processing_status: "processing"
        })
      }
    );
    
    if (!updateResponse.ok) {
      throw new Error(`Failed to update podcast episode status: ${await updateResponse.text()}`);
    }

    // Forward the request to the Python processor endpoint - using the correct function name
    const pythonEndpoint = `${supabaseUrl}/functions/v1/process-podcast-audio-python`;
    console.log(`Calling Python function at: ${pythonEndpoint}`);
    
    const processorResponse = await fetch(pythonEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        episodeId,
        audioUrl
      })
    });
    
    if (!processorResponse.ok) {
      throw new Error(`Failed to process audio with Python function: ${await processorResponse.text()}`);
    }
    
    const processorResult = await processorResponse.json();
    
    // Update the episode with the processed URL
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
          processed_audio_url: processorResult.processedAudioUrl,
          audio_processing_status: "completed",
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
        processedAudioUrl: processorResult.processedAudioUrl,
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
