
import { fetchWithRetry } from "./utils.ts";
import { createNewsSearchPrompt, JSON_CONVERSION_SYSTEM_PROMPT } from "./prompts.ts";

// Function to collect news stories in raw text format from Perplexity with dynamic time window
export async function collectNewsStoriesRaw(daysBack = 13) {
  try {
    const perplexityApiKey = Deno.env.get("PERPLEXITY_API_KEY");
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
export async function convertToStructuredJson(rawNewsData: string) {
  try {
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
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
