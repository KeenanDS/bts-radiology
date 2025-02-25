
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

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
    const { topic, additionalInfo } = await req.json();
    
    console.log('Generating blog post for topic:', topic);
    console.log('Additional info:', additionalInfo);

    const systemPrompt = `You are a skilled content writer. Your task is to create an engaging and informative blog post about the given topic. 
    The blog post should be well-structured with sections and written in Markdown format.
    Include a compelling introduction and a clear conclusion.`;

    const userPrompt = `Write a comprehensive blog post about: ${topic}
    ${additionalInfo ? `\nAdditional context to consider: ${additionalInfo}` : ''}
    
    Please format the content in Markdown with appropriate headings, paragraphs, and sections.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4096,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic API error:', error);
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    console.log('Successfully generated blog post');
    
    const generatedContent = data.content[0].text;

    return new Response(JSON.stringify({ content: generatedContent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-blog-post function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
