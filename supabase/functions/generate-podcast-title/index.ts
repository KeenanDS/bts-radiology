
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Environment variables
const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error("Missing OpenAI API key");
    }

    const { episodeId, newsStories } = await req.json();

    if (!episodeId || !newsStories || !Array.isArray(newsStories)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required parameters",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate a descriptive title based on the news stories
    const title = await generateDescriptiveTitle(newsStories);

    // Update the podcast episode with the custom title
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: updateError } = await supabase
      .from("podcast_episodes")
      .update({ custom_title: title })
      .eq("id", episodeId);

    if (updateError) {
      throw new Error(`Failed to update podcast title: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        custom_title: title,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`Error in generate-podcast-title: ${error.message}`);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Import the Supabase client
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

async function generateDescriptiveTitle(newsStories) {
  try {
    // Create a summary of the news stories for the prompt
    const storiesSummary = newsStories
      .map((story) => `- ${story.title}: ${story.summary.substring(0, 100)}...`)
      .join("\n");

    // Create the prompt for title generation
    const prompt = `Generate a concise, engaging title for a medical imaging podcast episode based on these topics:\n\n${storiesSummary}\n\nThe title should be in this format: "Beyond the Scan - [Brief descriptive phrase]". The descriptive phrase should be 3-6 words, creative but professional, and focused on medical imaging/healthcare. Do not include quotes in your response.`;

    // Call OpenAI API to generate the title
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Using a smaller model for cost efficiency
        messages: [
          {
            role: "system",
            content:
              "You are a creative title generator for a medical imaging podcast named 'Beyond the Scan'. Create concise, catchy titles.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 50,
      }),
    });

    const data = await response.json();
    
    if (!data.choices || !data.choices[0]) {
      throw new Error("Invalid response from OpenAI");
    }
    
    let title = data.choices[0].message.content.trim();
    
    // Ensure the title has the correct format
    if (!title.startsWith("Beyond the Scan - ")) {
      title = `Beyond the Scan - ${title}`;
    }
    
    return title;
  } catch (error) {
    console.error(`Error generating title: ${error.message}`);
    // Return a fallback title if generation fails
    return `Beyond the Scan - Medical Imaging Insights`;
  }
}
