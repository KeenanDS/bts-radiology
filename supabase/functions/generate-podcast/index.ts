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

// Create a dynamic news search system prompt with a configurable time window
const createNewsSearchPrompt = (daysBack) => `You are a specialized research assistant focused on medical imaging, healthcare tech, and advancements in medicine news. 
Search for the most significant news stories in healthcare, medical imaging/radiology, genomics, medicine, and healthcare technology published within the past ${daysBack} days from reputable medical news sources, academic journals, and mainstream publications with strong healthcare reporting.

Return your findings as a structured text in the following format for EACH article:

TITLE: Complete article title
SUMMARY: A two-paragraph summary of the key findings, implications, and relevance to healthcare professionals
SOURCE: Source name
DATE: Publication date (YYYY-MM-DD format)
---

IMPORTANT REQUIREMENTS FOR TOPIC DIVERSITY:
- Focus primarily on technological advancements, scientific breakthroughs, and research findings
- Aim for a diverse mix of stories with this recommended distribution:
  * At least 2 stories about technological innovations, new devices, or software in healthcare
  * At least 1 story about research findings, clinical studies, or scientific breakthroughs
  * No more than 1 story about healthcare policy, regulation, or industry business news (if relevant)
- AVOID political news sources or politically charged topics when possible
- If covering policy/regulatory news, focus ONLY on direct healthcare implications, not political angles

Topic areas to include:
- Medical imaging and radiology advancements (priority)
- Healthcare technology innovations and new devices (priority)
- Genomics research and breakthroughs
- Research studies with significant clinical implications
- Healthcare startups with new technologies (focus on the technology, not funding)

Other important requirements:
- Only include articles published within the past ${daysBack} days
- Only source from reputable medical publications, academic journals, or mainstream outlets with established healthcare reporting
- Present up to 4 articles maximum, but do not fabricate or include older articles to reach this number
- If fewer than 4 articles are available from the past ${daysBack} days, only present those that meet the criteria
- If no qualifying articles exist from the past ${daysBack} days, clearly state "NO_RECENT_ARTICLES_FOUND"

These summaries will be used to create an AI-generated podcast on recent healthcare news and innovations.`;

// System prompt for OpenAI to convert Perplexity response to structured JSON
const JSON_CONVERSION_SYSTEM_PROMPT = `You are a data conversion tool that transforms structured text about news articles into valid JSON format.

The input will be a series of articles with TITLE, SUMMARY, SOURCE, and DATE fields.
If the input contains "NO_RECENT_ARTICLES_FOUND", return an empty array [].

Your output MUST be a valid JSON array containing objects with these fields:
[
  {
    "title": "Complete article title from TITLE field",
    "summary": "The content from SUMMARY field",
    "source": "The content from SOURCE field",
    "date": "The content from DATE field in YYYY-MM-DD format"
  }
]

Rules:
1. ALWAYS return only valid JSON, no explanations or additional text
2. Ensure proper escaping of quotes and special characters in the JSON
3. Keep the exact wording from the input for each field
4. If a field is missing in the input, use appropriate defaults:
   - For missing title: "Untitled Article"
   - For missing summary: "No summary provided"
   - For missing source: "Unknown Source"
   - For missing date: Use today's date in YYYY-MM-DD format

DO NOT add any commentary, explanation, or text outside the JSON array.`;

// Updated intro template with improved conversational style and better transitions
const STANDARD_INTRO_BASE = `Hey there, welcome to "Beyond the Scan"! I'm Jackie, your host, and I'm so glad you're joining me today, {date}.

Quick shoutout to our sponsor RadiologyJobs.com—they're doing amazing work connecting imaging professionals with great opportunities nationwide.

{headlines_preview}`;

// Updated outro template with a more personal touch
const STANDARD_OUTRO_BASE = `Well, that's all we have for today's episode of "Beyond the Scan." I've really enjoyed sharing these developments with you.

{top_story_impact}

If you found today's discussion helpful, I'd love it if you'd subscribe and share with your colleagues. And hey, swing by our website at beyondthescan.com where we've got some great additional resources on these topics.

I'll be back next week with more exciting updates. This is Jackie signing off, and remember—what we do really does make a difference in people's lives every day. Take care!`;

// Updated system prompt for podcast script generation with improved transition instructions
const PODCAST_SCRIPT_SYSTEM_PROMPT = `You are a scriptwriter for "Beyond the Scan," a friendly, conversational podcast about radiology and medical imaging.

Write a script that sounds natural and engaging—like Jackie is having a casual conversation with the listener. This should feel like a friendly chat between colleagues, not a formal presentation.

Create a podcast script based on the provided news stories, following this structure:

1. Start with the intro provided in the user prompt exactly as is.

2. For each news story:
   - Introduce the topic conversationally, as if you're telling a friend about something exciting
   - Use casual transitions like "You know what's really interesting?" or "I was so fascinated to learn about..."
   - Include occasional rhetorical questions like "Have you ever wondered...?" or "Isn't that amazing?"
   - Express personal reactions: "I was really blown away by this next study..."
   - Explain complex concepts in plain, accessible language
   - Relate information to practical clinical scenarios when possible
   - Add natural-sounding transitions between stories like:
     * "Now, let's shift gears and talk about..."
     * "Moving on to our next story..."
     * "Another fascinating development I came across..."
     * "Speaking of innovations, I also wanted to tell you about..."
   - Make it absolutely clear when you're transitioning from one story to another

3. End with the outro provided in the user prompt exactly as is.

IMPORTANT FORMATTING AND STYLE INSTRUCTIONS:
- DO NOT include ANY section labels or formatting markers in the script
- Make it sound like a real person talking, with contractions (it's, we're, that's)
- Use varied sentence lengths and patterns for natural speech rhythm
- Include occasional verbal fillers like "you know," "actually," "I mean," but use sparingly
- Jackie should express genuine enthusiasm and curiosity about the topics
- Avoid sounding like a news anchor—be warmer, more casual, and personal
- When mentioning headlines in the script, keep them simplified and conversational

The script should sound natural when read aloud, as if Jackie is speaking spontaneously rather than reading. 
Make the content sound warm and engaging. Aim for a 8-12 minute podcast (about 1500-2000 word script).`;

// Explicitly define Bennet's voice ID
const BENNET_VOICE_ID = "bmAn0TLASQN7ctGBMHgN";

// Maximum retry attempts for API calls
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// Time windows for progressive search (in days)
const TIME_WINDOWS = [7, 14, 30];

// Helper function to implement retries with exponential backoff
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = MAX_RETRIES): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`API request attempt ${attempt}/${maxRetries}`);
      const response = await fetch(url, options);
      
      // Check if response is successful
      if (response.ok) {
        return response;
      }
      
      // If not successful, get the error message
      const errorText = await response.text();
      lastError = new Error(`Request failed with status ${response.status}: ${errorText}`);
      
      // If this is a server error (5xx), we should retry
      if (response.status >= 500) {
        console.warn(`Server error (${response.status}), retrying in ${RETRY_DELAY_MS * attempt}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt)); // Exponential backoff
        continue;
      }
      
      // For 4xx errors, don't retry as these are client errors
      throw lastError;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      console.warn(`Request failed (attempt ${attempt}/${maxRetries}): ${lastError.message}`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt)); // Exponential backoff
    }
  }
  
  // This should never happen due to the throw in the loop, but TypeScript needs it
  throw lastError || new Error('Unknown error during fetch with retry');
}

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

      // Update episode with search results
      await supabase
        .from("podcast_episodes")
        .update({
          news_stories: newsStories,
          status: newsStories.length > 0 ? "generating_script" : "error",
          error_message: newsStories.length === 0 ? `No news stories found within the last ${searchedTimeWindow} days. Search attempts: ${JSON.stringify(searchAttempts)}` : null,
          voice_id: BENNET_VOICE_ID, // Ensure voice_id is maintained during updates
        })
        .eq("id", episodeId);

      // If no news stories found after all attempts, return error
      if (newsStories.length === 0) {
        console.error(`No news stories found after searching up to ${searchedTimeWindow} days back`);
        return new Response(
          JSON.stringify({
            success: false,
            error: `No relevant healthcare or medical imaging news stories found within the last ${searchedTimeWindow} days. Please try again later or consider expanding your search criteria.`,
            searchAttempts,
            episodeId,
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
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

      return new Response(
        JSON.stringify({
          success: true,
          episodeId,
          newsStories,
          scriptPreview: podcastScript.substring(0, 500) + "...",
          searchedTimeWindow,
          searchAttempts,
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
          error_message: processingError.message, // Save error message
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
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: `Error occurred at ${new Date().toISOString()}`
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Function to collect news stories in raw text format from Perplexity with dynamic time window
async function collectNewsStoriesRaw(daysBack = 7) {
  try {
    console.log(`Preparing Perplexity API request for news stories from past ${daysBack} days using sonar-reasoning-pro model`);
    
    // Use the dynamic news search prompt with the specified time window
    const dynamicPrompt = createNewsSearchPrompt(daysBack);
    
    // Use the sonar-reasoning-pro model for better reasoning and structured output
    const response = await fetchWithRetry("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${perplexityApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-reasoning-pro",
        messages: [
          {
            role: "system",
            content: dynamicPrompt,
          },
          {
            role: "user",
            content: `Find the most significant healthcare and medical imaging news stories from the past ${daysBack} days. Format the results as specified.`,
          },
        ],
        temperature: 0.1,
        max_tokens: 4000,
        top_p: 0.9,
      }),
    });

    const result = await response.json();
    
    const completion = result.choices?.[0]?.message?.content;
    if (!completion) {
      console.error("No content received from Perplexity API");
      throw new Error("No content received from Perplexity API");
    }

    console.log(`Received response from Perplexity (${daysBack} days): ${completion.substring(0, 100)}...`);
    
    // Check for the NO_RECENT_ARTICLES_FOUND message
    if (completion.includes("NO_RECENT_ARTICLES_FOUND")) {
      console.log(`No recent articles found within ${daysBack} days according to Perplexity`);
      return "NO_RECENT_ARTICLES_FOUND";
    }
    
    return completion;
  } catch (error) {
    console.error(`Error collecting news stories (${daysBack} days): ${error.message}`);
    throw new Error(`Failed to collect news stories for ${daysBack} days: ${error.message}`);
  }
}

// Function to convert raw news data to structured JSON using OpenAI
async function convertToStructuredJson(rawNewsData: string) {
  try {
    console.log("Converting raw news data to structured JSON with OpenAI");
    
    // If no recent articles were found, return an empty array
    if (rawNewsData === "NO_RECENT_ARTICLES_FOUND") {
      console.log("No recent articles found, returning empty array");
      return [];
    }
    
    const response = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
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
            content: JSON_CONVERSION_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: rawNewsData,
          },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    const data = await response.json();
    const jsonContent = data.choices?.[0]?.message?.content;
    
    if (!jsonContent) {
      console.error("No JSON content received from OpenAI");
      throw new Error("Failed to convert news stories to JSON");
    }
    
    console.log(`Received JSON from OpenAI: ${jsonContent.substring(0, 100)}...`);
    
    try {
      // Parse the JSON content
      const parsedContent = JSON.parse(jsonContent);
      
      // Check if the content has the expected structure
      if (Array.isArray(parsedContent)) {
        return parsedContent;
      } else if (parsedContent && Array.isArray(parsedContent.articles)) {
        // Sometimes OpenAI might wrap the array in an object
        return parsedContent.articles;
      } else {
        // The content doesn't have the expected structure
        console.error("JSON content doesn't have the expected structure:", parsedContent);
        throw new Error("JSON content doesn't have the expected structure");
      }
    } catch (parseError) {
      console.error(`Error parsing JSON from OpenAI: ${parseError.message}`);
      console.error(`JSON content: ${jsonContent}`);
      throw new Error(`Failed to parse JSON from OpenAI: ${parseError.message}`);
    }
  } catch (error) {
    console.error(`Error converting to structured JSON: ${error.message}`);
    throw error;
  }
}

// Function to generate podcast script using OpenAI API with improved headline transitions
async function generatePodcastScript(newsStories, scheduledDate) {
  try {
    const formattedDate = new Date(scheduledDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create a more conversational headlines preview for the intro with clear transitions
    let headlinesPreview = "";
    if (newsStories.length > 0) {
      headlinesPreview = "I've got some really exciting stories to share with you today! ";
      
      if (newsStories.length === 1) {
        headlinesPreview += `We're going to talk about ${simplifyHeadline(newsStories[0].title)}, which has some fascinating implications for our field.`;
      } else {
        // Create a more conversational list with clear transitions
        newsStories.forEach((story, index) => {
          const simplifiedTitle = simplifyHeadline(story.title);
          
          if (index === 0) {
            headlinesPreview += `First, we'll be discussing ${simplifiedTitle}. `;
          } else if (index === newsStories.length - 1) {
            headlinesPreview += `And finally, we'll wrap up with ${simplifiedTitle}. `;
          } else {
            const transitionWords = ["Then", "Next", "After that"];
            const transition = transitionWords[index - 1 % transitionWords.length];
            headlinesPreview += `${transition}, we'll explore ${simplifiedTitle}. `;
          }
        });
        
        headlinesPreview += "I'm really excited to dive into these stories with you because they're all showing us where healthcare is headed.";
      }
      
      // Add a personal touch for the main story
      if (newsStories.length > 0) {
        headlinesPreview += ` I think you'll be particularly interested in our main story about ${simplifyHeadline(newsStories[0].title)}, which I found absolutely fascinating when I was researching for today's episode.`;
      }
    } else {
      // Default text if no stories were found
      headlinesPreview = "Today I've got some really interesting developments in medical imaging to share with you. These are the kinds of advances that are changing how we practice and improving outcomes for our patients. I'm really excited to walk through these with you today.";
    }

    // Create conversational top story impact for the outro
    let topStoryImpact = "";
    if (newsStories.length > 0) {
      topStoryImpact = `You know, I was thinking about our main story today on ${simplifyHeadline(newsStories[0].title)}. It really shows how quickly our field is evolving, and I think it's the kind of development that could make a real difference in patient care. That's what I love about doing this podcast - we get to explore these advances together and think about how they'll shape our work.`;
    }

    // Fill in the dynamic parts of the intro and outro templates
    const introWithDynamicContent = STANDARD_INTRO_BASE
      .replace("{date}", formattedDate)
      .replace("{headlines_preview}", headlinesPreview);
    
    const outroWithDynamicContent = STANDARD_OUTRO_BASE
      .replace("{top_story_impact}", topStoryImpact);

    const newsStoriesText = newsStories.map((story, index) => 
      `Story ${index + 1}: "${story.title}"
${story.summary}
Source: ${story.source}, Date: ${story.date}
`).join("\n\n");

    const userPrompt = `Create a conversational, friendly script for the "Beyond the Scan" podcast episode recorded on ${formattedDate}. 
Use these news stories as the content:

${newsStoriesText}

Please use the exact following intro for the podcast:
${introWithDynamicContent}

Please use the exact following outro for the podcast:
${outroWithDynamicContent}

Remember, this is for audio - DO NOT include any formatting labels or section markers (like "intro:" or "outro:"). The script should be pure spoken content as if Jackie is having a casual conversation with the listener.`;

    const response = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
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

    const data = await response.json();
    return data.choices[0]?.message?.content || "Failed to generate podcast script";
  } catch (error) {
    console.error(`Error in generatePodcastScript: ${error.message}`);
    throw error;
  }
}

// Helper function to simplify headlines to be more conversational
function simplifyHeadline(title) {
  // Remove specific patterns commonly found in formal headlines
  let simplifiedTitle = title
    // Convert to lowercase for more casual tone
    .toLowerCase()
    // Remove words like "new", "novel", "latest", "recent" from the beginning
    .replace(/^(new|novel|latest|recent)\s+/i, '')
    // Remove ending phrases like "study finds", "researchers say", etc.
    .replace(/,?\s+(study|research|report|analysis)\s+(finds|says|shows|reveals|suggests|indicates|concludes)\.?$/i, '')
    // Extract main concept from "Title: Subtitle" format
    .replace(/^(.+?):\s+(.+)$/, (_, main, _subtitle) => main);
  
  // Trim the title to keep it concise (around 8-10 words max)
  const words = simplifiedTitle.split(' ');
  if (words.length > 10) {
    simplifiedTitle = words.slice(0, 8).join(' ') + '...';
  }
  
  return simplifiedTitle.trim();
}

