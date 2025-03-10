
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// Environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const perplexityApiKey = Deno.env.get("PERPLEXITY_API_KEY");
const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// System prompt for Perplexity news search
const NEWS_SEARCH_SYSTEM_PROMPT = `You are a specialized research assistant focused on medical imaging and radiology news. 
Your task is to find 4 to 5 recent news stories (from the past week) about radiology, medical imaging, or related healthcare technology.

Return ONLY a JSON array of objects with these fields:
[
  {
    "title": "Title of the news story",
    "summary": "A 5-6 sentence summary of the key points",
    "source": "Source of the news (publication, website)",
    "date": "Publication date (YYYY-MM-DD format)"
  }
]`;

// Standard intro and outro templates
const STANDARD_INTRO = `Welcome to "Beyond the Scan," the first AI podcast dedicated to the latest developments in radiology and medical imaging. I'm Jackie, your host, and today is {date}.

Beyond the Scan is proudly sponsored by RadiologyJobs.com, connecting imaging professionals with career opportunities nationwide.

In today's episode, we'll explore some of the most significant recent developments in medical imaging that are shaping the future of clinical practice. As your guide through the evolving landscape of radiology technology and research, I'm excited to break down what these advances mean for the field and the patients you serve.`;

const STANDARD_OUTRO = `As we wrap up today's episode of "Beyond the Scan," I want to thank you for joining me on this exploration of the latest advancements in our field. If you found today's discussion valuable, please subscribe to our podcast and share it with colleagues who might benefit. You can also visit our website at beyondthescan.com for additional resources related to today's topics.

 I'll be back next week with another episode of "Beyond the Scan." Until then, this is Jackie, reminding you that what we do makes a difference in countless lives every day.`;

// System prompt for podcast script generation with consistent structure
const PODCAST_SCRIPT_SYSTEM_PROMPT = `You are a scriptwriter for "Beyond the Scan," a professional medical podcast about radiology and medical imaging.

Create an engaging podcast script based on the provided news stories, following this EXACT structure:

1. Start with the EXACT standard intro (do not modify it):
${STANDARD_INTRO}

2. For each news story:
   - Create a clear section header/transition
   - Provide thorough coverage with clinical context
   - Explain relevance and implications for medical professionals
   - Add thoughtful commentary on how it might affect practice
   - Add a natural transition to the next news story

3. End with the EXACT standard outro (do not modify it):
${STANDARD_OUTRO}

The tone should be professional but conversational, suitable for medical professionals.
The script should be formatted as if it's being read by Dr.Jackie as the host.
Make the content between intro and outro sound natural and engaging. Aim for a 8-12 minute podcast (about 1500-2000 word script).`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API keys
    if (!perplexityApiKey) {
      console.error("Missing PERPLEXITY_API_KEY");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error: Missing Perplexity API key",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!openAIApiKey) {
      console.error("Missing OPENAI_API_KEY");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error: Missing OpenAI API key",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request
    const { scheduledFor } = await req.json();
    
    if (!scheduledFor) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing scheduledFor parameter",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Processing podcast request scheduled for ${scheduledFor}`);
    
    // Create a podcast episode record
    const { data: episodeData, error: episodeError } = await supabase
      .from("podcast_episodes")
      .insert({
        scheduled_for: scheduledFor,
        status: "processing",
      })
      .select()
      .single();

    if (episodeError) {
      console.error(`Error creating podcast episode: ${episodeError.message}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to create podcast episode: ${episodeError.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const episodeId = episodeData.id;
    console.log(`Created podcast episode with ID: ${episodeId}`);

    try {
      // Step 1: Collect news stories with Perplexity
      console.log("Collecting news stories from Perplexity...");
      const newsStories = await collectNewsStories();
      console.log(`Collected ${newsStories.length} news stories`);

      // Update the episode with news stories
      await supabase
        .from("podcast_episodes")
        .update({
          news_stories: newsStories,
          status: "generating_script",
        })
        .eq("id", episodeId);

      // Step 2: Generate podcast script with OpenAI
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
        })
        .eq("id", episodeId);

      return new Response(
        JSON.stringify({
          success: true,
          episodeId,
          newsStories,
          scriptPreview: podcastScript.substring(0, 500) + "...",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (processingError) {
      console.error(`Error processing podcast: ${processingError.message}`);
      
      // Update the episode with error
      await supabase
        .from("podcast_episodes")
        .update({
          status: "error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", episodeId);

      return new Response(
        JSON.stringify({
          success: false,
          error: processingError.message,
          episodeId,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error(`Error in generate-podcast: ${error.message}`);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Function to collect news stories using Perplexity API
async function collectNewsStories() {
  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${perplexityApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-large-128k-online",
        messages: [
          {
            role: "system",
            content: NEWS_SEARCH_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: "Find 3-5 recent and notable news stories in radiology and medical imaging from the past week. Format the results as specified JSON.",
          },
        ],
        temperature: 0.1,
        max_tokens: 4000,
        top_p: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    
    try {
      const completion = result.choices[0]?.message?.content;
      if (completion) {
        console.log(`Received response from Perplexity: ${completion.substring(0, 100)}...`);
        
        // Parse JSON array from the text response
        let newsStories;
        
        // Check if response is already JSON
        if (completion.trim().startsWith("[") && completion.trim().endsWith("]")) {
          newsStories = JSON.parse(completion);
        } else {
          // Try to extract JSON array from the text response
          const jsonMatch = completion.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            newsStories = JSON.parse(jsonMatch[0]);
          } else {
            console.warn("Could not parse JSON from Perplexity response");
            throw new Error("Failed to extract news stories from the response");
          }
        }
        
        // Validate the structure
        if (!Array.isArray(newsStories) || newsStories.length === 0) {
          throw new Error("No news stories found or invalid format");
        }
        
        // Make sure each story has the required fields
        return newsStories.map(story => ({
          title: story.title || "Untitled",
          summary: story.summary || "No summary available",
          source: story.source || "Unknown source",
          date: story.date || new Date().toISOString().split("T")[0]
        }));
      }
    } catch (parseError) {
      console.error(`Error parsing Perplexity response: ${parseError.message}`);
      throw new Error(`Failed to parse news stories: ${parseError.message}`);
    }

    throw new Error("No content received from Perplexity");
  } catch (error) {
    console.error(`Error in collectNewsStories: ${error.message}`);
    throw error;
  }
}

// Function to generate podcast script using OpenAI API
async function generatePodcastScript(newsStories, scheduledDate) {
  try {
    const formattedDate = new Date(scheduledDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const newsStoriesText = newsStories.map((story, index) => 
      `Story ${index + 1}: "${story.title}"
${story.summary}
Source: ${story.source}, Date: ${story.date}
`).join("\n\n");

    // Create intro with the proper date
    const introWithDate = STANDARD_INTRO.replace("{date}", formattedDate);

    const userPrompt = `Create a script for the "Beyond the Scan" podcast episode recorded on ${formattedDate}. 
Use these news stories as the content:

${newsStoriesText}

Format the script following our exact structure with the specified intro and outro. Be sure to provide insightful analysis of each story.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: PODCAST_SCRIPT_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "Failed to generate podcast script";
  } catch (error) {
    console.error(`Error in generatePodcastScript: ${error.message}`);
    throw error;
  }
}
