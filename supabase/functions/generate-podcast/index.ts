
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

// System prompt for Perplexity news search - Updated with clearer guidance on topic diversity
const NEWS_SEARCH_SYSTEM_PROMPT = `You are a specialized research assistant focused on medical imaging, healthcare tech, and advancements in medicine news. 
Search for the most significant news stories in healthcare, medical imaging/radiology, genomics, medicine, and healthcare technology published within the past 7 days from reputable medical news sources, academic journals, and mainstream publications with strong healthcare reporting.

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
- Only include articles published within the past 7 days
- Only source from reputable medical publications, academic journals, or mainstream outlets with established healthcare reporting
- Present up to 4 articles maximum, but do not fabricate or include older articles to reach this number
- If fewer than 4 articles are available from the past 7 days, only present those that meet the criteria
- If no qualifying articles exist from the past 7 days, clearly state "NO_RECENT_ARTICLES_FOUND"

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

// Standard intro and outro templates - Base templates that will be dynamically filled
const STANDARD_INTRO_BASE = `Welcome to "Beyond the Scan," the first AI podcast dedicated to the latest developments in radiology and medical imaging. I'm Jackie, your host, and today is {date}.

Beyond the Scan is proudly sponsored by RadiologyJobs.com, connecting imaging professionals with career opportunities nationwide.

{headlines_preview}`;

const STANDARD_OUTRO_BASE = `As we wrap up today's episode of "Beyond the Scan," I want to thank you for joining me on this exploration of the latest advancements in our field. 

{top_story_impact}

If you found today's discussion valuable, please subscribe to our podcast and share it with colleagues who might benefit. You can also visit our website at beyondthescan.com for additional resources related to today's topics.

I'll be back next week with another episode of "Beyond the Scan." Until then, this is Jackie, reminding you that what we do makes a difference in countless lives every day.`;

// Updated system prompt for podcast script generation with improved formatting guidance
const PODCAST_SCRIPT_SYSTEM_PROMPT = `You are a scriptwriter for "Beyond the Scan," a professional medical podcast about radiology and medical imaging.

Create an engaging podcast script based on the provided news stories, following this structure:

1. Start with the intro provided in the user prompt exactly as is.

2. For each news story:
   - Create a clear section header using a natural transition phrase like "Moving on to our next story..." or "Our next topic explores..."
   - Provide thorough coverage with clinical context
   - Explain relevance and implications for medical professionals
   - Add thoughtful commentary on how it might affect practice
   - Add a natural transition to the next news story

3. End with the outro provided in the user prompt exactly as is.

IMPORTANT FORMATTING INSTRUCTIONS:
- DO NOT include ANY section labels or formatting markers in the script (no "INTRO:", "STORY 1:", "OUTRO:" markers)
- The script should be written as natural spoken content without any structural labels
- Do not include asterisks, bullet points, or any other formatting characters
- Format the script as pure spoken content that will be read aloud without any non-verbal elements

The tone should be professional but conversational, suitable for medical professionals.
The script should be formatted as if it's being read by Dr. Jackie as the host.
Make the content sound natural and engaging. Aim for a 8-12 minute podcast (about 1500-2000 word script).`;

// Explicitly define Bennet's voice ID
const BENNET_VOICE_ID = "bmAn0TLASQN7ctGBMHgN";

// Maximum retry attempts for API calls
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

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
      // Step 1: Collect news stories with Perplexity (as plaintext)
      console.log("Collecting news stories from Perplexity...");
      const rawNewsData = await collectNewsStoriesRaw();
      console.log(`Received raw news data from Perplexity. Length: ${rawNewsData.length} characters`);
      console.log(`Preview of raw news data: ${rawNewsData.substring(0, 200)}...`);
      
      // Step 2: Convert the raw news data to structured JSON using OpenAI
      console.log("Converting raw news data to structured JSON using OpenAI...");
      const newsStories = await convertToStructuredJson(rawNewsData);
      console.log(`Converted to JSON. Found ${newsStories.length} news stories`);

      // Update the episode with news stories
      await supabase
        .from("podcast_episodes")
        .update({
          news_stories: newsStories,
          status: "generating_script",
          voice_id: BENNET_VOICE_ID, // Ensure voice_id is maintained during updates
        })
        .eq("id", episodeId);

      // Step 3: Generate podcast script with OpenAI
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

// Function to collect news stories in raw text format from Perplexity
async function collectNewsStoriesRaw() {
  try {
    console.log("Preparing Perplexity API request for news stories using sonar-reasoning-pro model");
    
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
            content: NEWS_SEARCH_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: "Find the most significant healthcare and medical imaging news stories from the past 7 days. Format the results as specified.",
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

    console.log(`Received response from Perplexity: ${completion.substring(0, 100)}...`);
    
    // Check for the NO_RECENT_ARTICLES_FOUND message
    if (completion.includes("NO_RECENT_ARTICLES_FOUND")) {
      console.log("No recent articles found according to Perplexity");
      return "NO_RECENT_ARTICLES_FOUND";
    }
    
    return completion;
  } catch (error) {
    console.error(`Error collecting news stories: ${error.message}`);
    throw new Error(`Failed to collect news stories: ${error.message}`);
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

// Function to generate podcast script using OpenAI API
async function generatePodcastScript(newsStories, scheduledDate) {
  try {
    const formattedDate = new Date(scheduledDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create headlines preview for the intro
    let headlinesPreview = "";
    if (newsStories.length > 0) {
      headlinesPreview = "In today's episode, we'll explore the following stories:\n\n";
      
      // Add each headline as a bullet point
      newsStories.forEach((story, index) => {
        headlinesPreview += `- ${story.title}\n`;
      });
      
      // If there's a top story (first story), highlight it
      if (newsStories.length > 0) {
        headlinesPreview += `\nOur main story today focuses on ${newsStories[0].title}, which we'll discuss in detail along with its implications for healthcare professionals.`;
      }
    } else {
      // Default text if no stories were found
      headlinesPreview = "In today's episode, we'll explore some of the most significant recent developments in medical imaging that are shaping the future of clinical practice. As your guide through the evolving landscape of radiology technology and research, I'm excited to break down what these advances mean for the field and the patients you serve.";
    }

    // Create top story impact for the outro
    let topStoryImpact = "";
    if (newsStories.length > 0) {
      topStoryImpact = `I'd like to emphasize the significance of our main story today about ${newsStories[0].title}. This development represents an important step forward in healthcare, with potential to meaningfully impact patient care and clinical practice. As medical professionals, staying informed about such advancements helps us provide the best possible care for our patients.`;
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

    const userPrompt = `Create a script for the "Beyond the Scan" podcast episode recorded on ${formattedDate}. 
Use these news stories as the content:

${newsStoriesText}

Please use the exact following intro for the podcast:
${introWithDynamicContent}

Please use the exact following outro for the podcast:
${outroWithDynamicContent}

Remember, this is for audio - DO NOT include any formatting labels or section markers (like "intro:" or "outro:"). The script should be pure spoken content as if Jackie is reading it naturally.`;

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
