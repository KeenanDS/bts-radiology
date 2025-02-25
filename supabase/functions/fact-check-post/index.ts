
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content } = await req.json();

    // Create a prompt that asks for fact-checking
    const prompt = `Please fact-check the following blog post content and identify any factual inaccuracies, unsubstantiated claims, or potential misinformation. For each issue identified, provide:
    1. The specific claim or statement
    2. Why it might be inaccurate or needs verification
    3. A suggested correction or clarification
    
    Format the response as a JSON array with each issue having 'claim', 'issue', and 'suggestion' fields. If no issues are found, return an empty array.
    
    Here's the content to check:
    
    ${content}`;

    console.log('Sending request to Perplexity API...');
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are a precise fact-checker. Focus on factual accuracy and provide clear, actionable feedback.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
        frequency_penalty: 0,
        presence_penalty: 0
      }),
    });

    const data = await response.json();
    console.log('Received response from Perplexity API:', data);

    // Parse the response from the model
    let issues = [];
    try {
      const content = data.choices[0].message.content;
      if (content) {
        // Check if the content is already a JSON array
        if (content.trim().startsWith('[')) {
          issues = JSON.parse(content);
        } else {
          // If it's not JSON, try to find and parse any JSON-like structure in the text
          const jsonMatch = content.match(/\[.*\]/s);
          if (jsonMatch) {
            issues = JSON.parse(jsonMatch[0]);
          }
        }
      }
    } catch (error) {
      console.error('Error parsing fact-check results:', error);
      issues = [];
    }

    return new Response(JSON.stringify({ issues }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fact-check-post function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
