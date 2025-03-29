
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { collectNewsStoriesRaw, convertToStructuredJson } from "./news-service.ts";
import { generatePodcastScript } from "./script-generator.ts";
import { TIME_WINDOWS } from "./constants.ts";

// Environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Explicitly define Bennet's voice ID
const BENNET_VOICE_ID = "bmAn0TLASQN7ctGBMHgN";

// Generate a descriptive title based on news stories
async function generateDescriptiveTitle(newsStories) {
  try {
    // Call the dedicated title generation function
    const response = await supabase.functions.invoke('generate-podcast-title', {
      body: { newsStories }
    });

    if (response.error) {
      throw new Error(`Error calling title generation function: ${response.error.message}`);
    }

    if (response.data && response.data.custom_title) {
      return response.data.custom_title;
    }

    // Fallback title if generation fails
    return "Beyond the Scan - Medical Imaging Insights";
  } catch (error) {
    console.error(`Error in generateDescriptiveTitle: ${error.message}`);
    return "Beyond the Scan - Medical Imaging Insights";
  }
}

export async function processPodcastRequest(scheduledFor: string) {
  try {
    // Create a podcast episode record with Bennet's voice ID explicitly set
    const { data: episodeData, error: episodeError } = await supabase
      .from("podcast_episodes")
      .insert({
        scheduled_for: scheduledFor,
        status: "processing",
        voice_id: BENNET_VOICE_ID, // Explicitly set Bennet's voice ID
      })
      .select()
      .single();

    if (episodeError) {
      console.error(`Error creating podcast episode: ${episodeError.message}`);
      return {
        success: false,
        error: `Failed to create podcast episode: ${episodeError.message}`,
        status: 500
      };
    }

    const episodeId = episodeData.id;
    console.log(`Created podcast episode with ID: ${episodeId}`);

    try {
      // Progressive search for news stories with expanding time windows
      let newsStories = [];
      let searchedTimeWindow = 0;
      let searchAttempts = [];
      
      for (const daysBack of TIME_WINDOWS) {
        searchedTimeWindow = daysBack;
        console.log(`Attempting to collect news stories from past ${daysBack} days...`);
        
        // Collect news stories with current time window
        const rawNewsData = await collectNewsStoriesRaw(daysBack);
        console.log(`Received raw news data for ${daysBack}-day window. Length: ${rawNewsData.length} characters`);
        
        // Keep track of search attempts
        searchAttempts.push({ daysBack, result: rawNewsData.includes("NO_RECENT_ARTICLES_FOUND") ? "No articles found" : "Search completed" });
        
        // Convert the raw news data to structured JSON
        if (!rawNewsData.includes("NO_RECENT_ARTICLES_FOUND")) {
          newsStories = await convertToStructuredJson(rawNewsData);
          console.log(`Found ${newsStories.length} news stories within ${daysBack} days`);
          
          // If we found at least one story, break the loop
          if (newsStories.length > 0) {
            break;
          }
        }
      }

      // Generate a descriptive title if we have news stories
      let customTitle = "Beyond the Scan - Medical Imaging Insights";
      if (newsStories.length > 0) {
        customTitle = await generateDescriptiveTitle(newsStories);
        console.log(`Generated custom title: ${customTitle}`);
      }

      // Update episode with search results and custom title
      await supabase
        .from("podcast_episodes")
        .update({
          news_stories: newsStories,
          custom_title: customTitle,
          status: newsStories.length > 0 ? "generating_script" : "error",
          error_message: newsStories.length === 0 ? `No news stories found within the last ${searchedTimeWindow} days. Search attempts: ${JSON.stringify(searchAttempts)}` : null,
          voice_id: BENNET_VOICE_ID, // Ensure voice_id is maintained during updates
        })
        .eq("id", episodeId);

      // If no news stories found after all attempts, return error
      if (newsStories.length === 0) {
        console.error(`No news stories found after searching up to ${searchedTimeWindow} days back`);
        return {
          success: false,
          error: `No relevant healthcare or medical imaging news stories found within the last ${searchedTimeWindow} days. Please try again later or consider expanding your search criteria.`,
          searchAttempts,
          episodeId,
          status: 404
        };
      }

      // Generate podcast script with found news stories
      console.log("Generating podcast script...");
      const podcastScript = await generatePodcastScript(newsStories, scheduledFor);
      console.log("Podcast script generated successfully");

      // Update the episode with the podcast script
      await supabase
        .from("podcast_episodes")
        .update({
          podcast_script: podcastScript,
          status: "completed",
          updated_at: new Date().toISOString(),
          voice_id: BENNET_VOICE_ID, // Ensure voice_id is maintained during updates
        })
        .eq("id", episodeId);

      return {
        success: true,
        episodeId,
        newsStories,
        scriptPreview: podcastScript.substring(0, 500) + "...",
        customTitle,
        searchedTimeWindow,
        searchAttempts,
      };
    } catch (processingError) {
      console.error(`Error processing podcast: ${processingError.message}`);
      
      // Update the episode with error
      await supabase
        .from("podcast_episodes")
        .update({
          status: "error",
          updated_at: new Date().toISOString(),
          error_message: processingError.message, // Save error message
        })
        .eq("id", episodeId);

      return {
        success: false,
        error: processingError.message,
        episodeId,
        status: 500
      };
    }
  } catch (error) {
    console.error(`Error in processPodcastRequest: ${error.message}`);
    throw error;
  }
}
