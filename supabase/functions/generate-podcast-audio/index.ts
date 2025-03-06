
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// Environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const elevenLabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const { episodeId, voiceId } = await req.json();
    
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

    console.log(`Generating audio for podcast episode ID: ${episodeId}`);
    
    // Update episode status to indicate audio generation is in progress
    await supabase
      .from("podcast_episodes")
      .update({
        status: "generating_audio",
        updated_at: new Date().toISOString(),
      })
      .eq("id", episodeId);

    // Fetch the podcast script
    const { data: episodeData, error: fetchError } = await supabase
      .from("podcast_episodes")
      .select("podcast_script, voice_id")
      .eq("id", episodeId)
      .single();

    if (fetchError || !episodeData) {
      console.error(`Error fetching podcast episode: ${fetchError?.message || "No data found"}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch podcast episode: ${fetchError?.message || "No data found"}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const podcastScript = episodeData.podcast_script;
    // Use provided voice ID or the one stored in the database
    const finalVoiceId = voiceId || episodeData.voice_id || "onwK4e9ZLuTAKqWW03F9"; // Default to Daniel voice
    
    if (!podcastScript) {
      console.error("Podcast script is empty");
      await updateEpisodeWithError(episodeId, "Podcast script is empty");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Podcast script is empty",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    try {
      // Generate audio using ElevenLabs API
      console.log(`Generating audio with ElevenLabs using voice ID: ${finalVoiceId}`);
      const audioBuffer = await generateAudio(podcastScript, finalVoiceId);
      
      // Generate a unique filename
      const filename = `podcast_${episodeId}_${Date.now()}.mp3`;
      
      // Upload audio to Supabase Storage
      const { data: storageData, error: storageError } = await supabase
        .storage
        .from("podcast_audio")
        .upload(filename, audioBuffer, {
          contentType: "audio/mpeg",
          cacheControl: "3600",
        });

      if (storageError) {
        console.error(`Error uploading audio to storage: ${storageError.message}`);
        await updateEpisodeWithError(episodeId, `Audio upload failed: ${storageError.message}`);
        throw storageError;
      }

      // Get public URL for the audio file
      const { data: publicUrlData } = await supabase
        .storage
        .from("podcast_audio")
        .getPublicUrl(filename);

      const audioUrl = publicUrlData.publicUrl;

      // Update the episode with the audio URL
      await supabase
        .from("podcast_episodes")
        .update({
          audio_url: audioUrl,
          voice_id: finalVoiceId,
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", episodeId);

      return new Response(
        JSON.stringify({
          success: true,
          episodeId,
          audioUrl,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (processingError) {
      console.error(`Error processing audio: ${processingError.message}`);
      await updateEpisodeWithError(episodeId, processingError.message);
      throw processingError;
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

  // Helper function to update episode with error status
  async function updateEpisodeWithError(episodeId: string, errorMessage: string) {
    await supabase
      .from("podcast_episodes")
      .update({
        status: "error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", episodeId);
  }
});

// Function to generate audio using ElevenLabs API
async function generateAudio(text: string, voiceId: string): Promise<ArrayBuffer> {
  try {
    // Call ElevenLabs API to generate audio
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": elevenLabsApiKey as string,
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_turbo_v2_5", // Use ElevenLabs 11 Flash v2.5 model
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Get audio as buffer
    return await response.arrayBuffer();
  } catch (error) {
    console.error(`Error calling ElevenLabs API: ${error.message}`);
    throw error;
  }
}
