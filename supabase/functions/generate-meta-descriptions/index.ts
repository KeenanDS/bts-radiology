
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const cleanDescription = (description: string): string => {
  // Remove quotes, newlines, and excessive spaces
  return description
    .replace(/['"]/g, '')
    .replace(/\n/g, ' ')
    .trim();
};

const validateDescriptions = (descriptions: string[]): string[] => {
  // Filter out empty strings and ensure proper length
  const validDescriptions = descriptions
    .map(cleanDescription)
    .filter(desc => desc.length > 0)
    .slice(0, 3);

  // If we don't have exactly 3 descriptions, pad with placeholder
  while (validDescriptions.length < 3) {
    validDescriptions.push(`SEO-optimized description for the blog post about ${title}. Generated meta description ${validDescriptions.length + 1}.`);
  }

  return validDescriptions;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, title } = await req.json();

    const prompt = `Generate three distinct meta descriptions for this blog post. Each description should be SEO-friendly, engaging, and between 150-160 characters. Separate each description with a newline.

Title: ${title}

Content: ${content}`;

    console.log('Sending request to OpenAI with prompt:', prompt);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an SEO expert that creates engaging meta descriptions. Return exactly three descriptions, each on a new line.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    const data = await response.json();
    console.log('Raw OpenAI response:', data);

    // Split the content by newlines and clean up
    const descriptions = data.choices[0].message.content
      .split('\n')
      .filter((line: string) => line.trim().length > 0);

    console.log('Parsed descriptions:', descriptions);

    // Validate and ensure we have exactly 3 descriptions
    const validatedDescriptions = validateDescriptions(descriptions);

    console.log('Validated descriptions:', validatedDescriptions);

    return new Response(JSON.stringify({ descriptions: validatedDescriptions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-meta-descriptions function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
