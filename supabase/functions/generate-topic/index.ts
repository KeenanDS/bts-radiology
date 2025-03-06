
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Generating topic with OpenAI...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are a specialized content strategist for the radiology and medical imaging industry. Your task is to generate ONLY a single blog post title. The title should be:

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

IMPORTANT: Return ONLY the title, nothing else. Do not add any descriptions, markdown, or formatting.`
          },
          {
            role: 'user',
            content: 'Generate a blog post title for a radiology job board'
          }
        ],
        temperature: 0.7,
        max_tokens: 50
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      throw new Error('Failed to generate topic');
    }

    const data = await response.json();
    console.log('Raw OpenAI response:', data);

    const rawTitle = data.choices[0].message.content;
    console.log('Raw title:', rawTitle);

    const cleanedTitle = cleanTitle(rawTitle);
    console.log('Cleaned title:', cleanedTitle);

    const validatedTitle = validateTitle(cleanedTitle);
    console.log('Validated title:', validatedTitle);

    // CHANGED: Return an array of topics under the "topics" key to match what process-scheduled-posts expects
    const result = { topics: [validatedTitle] };
    console.log('Sending response with format:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating topic:', error);
    // CHANGED: Even in error case, return an empty array in the expected format
    return new Response(JSON.stringify({ topics: [], error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
