import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const cleanTitle = (title: string): string => {
  // Remove markdown symbols, quotes, and extra spaces
  return title
    .replace(/[*_`#]/g, '') // Remove markdown formatting
    .replace(/['"]/g, '') // Remove quotes
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .split('.')[0] // Take only the first sentence (the title)
    .trim();
};

const validateTitle = (title: string): string => {
  if (!title) {
    return 'Latest Trends in Radiology: Your Guide to Career Success';
  }
  return title;
};

/**
 * Edge Function: Generate Blog Post Topics
 * 
 * Generates one or more blog post topics using OpenAI
 * 
 * Request format:
 * {
 *   count: number // Number of topics to generate (default: 1)
 * }
 * 
 * Response format:
 * {
 *   topics: string[] // Array of generated topics
 *   topic: string // For backward compatibility (the first topic)
 *   error?: string // Error message if present
 * }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body and get count parameter
    let count = 1;
    let requestBody = null;
    
    // Only try to parse the body if the content length is greater than 0
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 0) {
      try {
        requestBody = await req.json();
        if (requestBody && requestBody.count && 
            Number.isInteger(requestBody.count) && 
            requestBody.count > 0) {
          count = requestBody.count;
        }
        
        // Cap to a reasonable number to prevent abuse
        count = Math.min(count, 10);
        
        console.log(`Requested to generate ${count} topics with body:`, requestBody);
      } catch (e) {
        console.warn("Could not parse request body or it's empty, using default count of 1:", e);
      }
    } else {
      console.log("Request has no body or empty body, using default count of 1");
    }

    // Check if OpenAI API key is configured
    if (!openAIApiKey) {
      throw new Error('OpenAI API key is not configured. Please add OPENAI_API_KEY to your function secrets.');
    }

    console.log(`Generating ${count} topics with OpenAI...`);
    
    // Adjust the system prompt based on the number of topics requested
    const systemPrompt = `You are a specialized content strategist for the radiology and medical imaging industry. Your task is to generate ${count} blog post title${count > 1 ? 's' : ''}. Your task is to first decide between generating High Engagement or SEO-focused titles. Before generating titles, choose one of two distinct paths:

    1. **High Engagement (Buzzfeed-style)**:
       - Use emotional, intriguing, or provocative language to encourage clicks.
       - Incorporate listicles, surprising facts, intriguing questions, or career tips.
       - Limit list numbers between 3 and 7.
       - Include timely references or trending topics when possible.
       - EXAMPLES:Mix various compelling title formats including (but not limited to):
         * Intriguing questions (e.g., \"Is Your Radiology Career Future-Proof?\")
         * \"Secrets\" or \"things you didn't know\" (e.g., \"5 Surprising Facts About Radiology Jobs in 2025\")
         * Actionable \"How-to\" guides (e.g., \"How to Land Your Dream Radiology Job in 2025\")
         * Timely insights (e.g., \"4 Ways AI is Revolutionizing Radiology Careers This Year\")
         * Career hacks or quick tips (e.g., \"6 Quick Tips to Stand Out in Radiology Interviews\")
         * Bold statements or controversial viewpoints (e.g., \"Why Traditional Radiology Jobs Might Disappear by 2030\")
         * Current trends or emerging specializations (e.g., \"3 Hot Radiology Specialties Everyone's Talking About in 2025\")
    
    2. **SEO Focused (Search Engine Optimization)**:
       - Emphasize clear, relevant keywords like \"radiology,\" \"medical imaging,\" and related terms.
       - Include years (e.g., 2025) or clear industry-specific keywords.
       - Use straightforward language for improved search engine visibility.
       - Prefer how-to guides, insight articles, or direct informative titles.
       - EXAMPLES: Mix various SEO-friendly title formats including (but not limited to):
         * How-to guides (e.g., \"How to Find the Best Radiology Jobs in 2025\")
         * Career paths (e.g., \"Top Radiology Career Paths for Medical Imaging Professionals in 2025\")
         * Market outlooks (e.g., \"Radiology Job Market Outlook: Trends and Opportunities in 2025\")
         * Salary guides (e.g., \"The Ultimate Guide to Radiology Salaries and Job Benefits in 2025\")
         * Certification and qualifications (e.g., \"Radiology Certification: Requirements and Career Advantages in 2025\")
         * Step-by-step application processes (e.g., \"Step-by-Step Guide to Applying for Radiology Jobs Online in 2025\")
         * Location-specific insights (e.g., \"Radiology Jobs by State: Highest-Paying Locations for Radiologists in 2025\")
    
    If more than one title is requested, provide a mix of both High Engagement and SEO-focused titles.
    The titles should not follow the examples exactly, but should be similar. Use your creativity to generate unique titles that accomplish the goal of the prompt.
    
    IMPORTANT: Format your response as a numbered list of ONLY the titles, nothing else. Do not add any descriptions or explanations.`;

    // Make the OpenAI API request with retry logic
    let response = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              {
                role: 'user',
                content: `Generate ${count} blog post title${count > 1 ? 's' : ''} for a radiology job board.`
              }
            ],
            temperature: 0.7,
            max_tokens: count * 30 // Scale token limit based on the number of topics
          }),
        });
        
        if (response.ok) {
          break;
        } else {
          const error = await response.json();
          console.error(`OpenAI API error (attempt ${retryCount + 1}):`, error);
          retryCount++;
          
          if (retryCount >= maxRetries) {
            throw new Error(`Failed to generate topics after ${maxRetries} attempts: ${error.error?.message || 'Unknown API error'}`);
          }
          
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        }
      } catch (error) {
        console.error(`Network error during attempt ${retryCount + 1}:`, error);
        retryCount++;
        
        if (retryCount >= maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
      }
    }

    if (!response) {
      throw new Error('Failed to connect to OpenAI API');
    }

    const data = await response.json();
    console.log('Raw OpenAI response:', data);

    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('Invalid response format from OpenAI');
    }

    // Process the raw response to extract individual titles
    const rawContent = data.choices[0].message.content;
    console.log('Raw content from OpenAI:', rawContent);
    
    // Parse the numbered list or newline separated titles
    let rawTitles: string[] = [];
    
    // Try to match numbered list format (1. Title)
    const numberedListRegex = /^\d+\.\s+(.+)$/gm;
    let match;
    let foundNumberedTitles = false;
    
    while ((match = numberedListRegex.exec(rawContent)) !== null) {
      foundNumberedTitles = true;
      rawTitles.push(match[1]);
    }
    
    // If no numbered list found, split by newlines
    if (!foundNumberedTitles) {
      rawTitles = rawContent.split(/\n+/).filter(line => line.trim().length > 0);
    }
    
    console.log('Extracted raw titles:', rawTitles);

    // Clean and validate each title
    const processedTopics = rawTitles
      .map(title => cleanTitle(title))
      .map(title => validateTitle(title))
      .filter(title => title.length > 0);
    
    console.log('Final processed topics:', processedTopics);

    // Ensure we have at least one topic, provide a fallback if needed
    if (processedTopics.length === 0) {
      console.warn("No valid topics found in OpenAI response, using fallback topic");
      processedTopics.push('Latest Trends in Radiology: Your Guide to Career Success');
    }

    // Return the processed topics
    // Include both 'topics' array and 'topic' string for backward compatibility
    const result = { 
      topics: processedTopics,
      topic: processedTopics[0] // Include first topic as 'topic' for backward compatibility
    };
    console.log('Sending response with format:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating topics:', error);
    
    return new Response(JSON.stringify({ 
      topics: ['Latest Trends in Radiology: Your Guide to Career Success'],
      topic: 'Latest Trends in Radiology: Your Guide to Career Success', // For backward compatibility
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
