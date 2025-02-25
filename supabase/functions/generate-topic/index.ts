import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
            content: 'You are a specialized content strategist for the radiology and medical imaging industry. Your expertise is generating high-engagement blog topics that appeal to radiologists, imaging technicians, and other medical professionals in diagnostic imaging fields. Your topics should be:\n\n    1. Attention-grabbing with compelling headlines using numbers, questions, or emotional triggers (similar to Buzzfeed-style content)\n    2. SEO-optimized for radiology job searches and career advancement\n    3. Relevant to current trends, challenges, or innovations in the radiology field\n    4. Formatted to drive high click-through rates on LinkedIn and professional networks\n    5. Designed to position a radiology job board as an industry authority'
          },
          {
            role: 'user',
            content: 'Generate a blog post topic for my radiology job board'
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
    const generatedTopic = data.choices[0].message.content;
    console.log('Successfully generated topic:', generatedTopic);

    return new Response(JSON.stringify({ topic: generatedTopic }), {
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
