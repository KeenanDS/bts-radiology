
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, title } = await req.json();

    const prompt = `Based on the following blog post title and content, generate three distinct meta descriptions that are SEO-friendly and engaging. Each description should be between 150-160 characters long. Format the response as a JSON array of three strings.

Title: ${title}

Content: ${content}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an SEO expert that creates engaging meta descriptions.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    const data = await response.json();
    let descriptions: string[];
    
    try {
      // Try to parse the response as JSON first
      descriptions = JSON.parse(data.choices[0].message.content);
    } catch {
      // If parsing fails, split by newlines and clean up
      descriptions = data.choices[0].message.content
        .split('\n')
        .filter((line: string) => line.trim().length > 0)
        .slice(0, 3);
    }

    return new Response(JSON.stringify({ descriptions }), {
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
