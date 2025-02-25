
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

    return new Response(JSON.stringify({ topic: validatedTitle }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating topic:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
