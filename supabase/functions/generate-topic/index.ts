
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
    const systemPrompt = `You are a specialized content strategist for the radiology and medical imaging industry. Your task is to generate ${count} blog post title${count > 1 ? 's' : ''}. Each title should be:

1. Attention-grabbing with compelling words
2. SEO-optimized for radiology job searches
3. Relevant to current trends in radiology
4. Include a number or year when appropriate
5. No descriptions or additional text

Additional requirements for diverse title structures:
- Vary the numbers used in listicles (use a variety of numbers 1-7)
- Mix different title formats, such as:
  * How-to guides (e.g., "How to Advance Your Radiology Career in 2024")
  * Question-based titles (e.g., "What Makes a Successful Radiologist in Today's Healthcare?")
  * Insight articles (e.g., "The Future of AI in Radiology: Key Insights for Job Seekers")
  * Career guidance (e.g., "5 Essential Skills Modern Radiologists Need to Master")
  * Industry trends (e.g., "7 Emerging Specializations in Diagnostic Imaging")
  * Professional development (e.g., "3 Career-Changing Certifications for Radiology Professionals")
- Occasionally use different title structures that don't include numbers

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
