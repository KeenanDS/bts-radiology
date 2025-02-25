
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
    console.log('Received content for fact-checking:', content.substring(0, 100) + '...');

    // Create a more specific prompt focusing on statistical claims and healthcare/AI predictions
    const prompt = `As a specialized fact-checker for medical and healthcare content, carefully analyze this blog post for:

1. Statistical claims: Check any percentages, numbers, or quantitative statements
2. Future predictions: Identify claims about future developments, especially regarding AI in healthcare
3. Technology impact statements: Verify claims about AI/technology effects on healthcare professions
4. Healthcare industry trends: Validate statements about medical practice changes
5. Source verification: Note claims that lack proper attribution or scientific backing

For each potential issue found, provide:
1. The exact claim made
2. Why it needs verification (unsupported statistics, unverified predictions, etc.)
3. A specific suggestion for improvement (e.g., adding source attribution, clarifying time frames, etc.)

Format your response as a JSON array of issues, each with 'claim', 'issue', and 'suggestion' fields.
If no issues are found, return an empty array.

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
            content: `You are an expert fact-checker specializing in healthcare and medical technology content. Your expertise includes:
- Medical research methodology
- Healthcare industry statistics
- AI/ML implementation in healthcare
- Evidence-based medicine principles
- Scientific literature evaluation

Focus on verifying:
1. Statistical claims require recent, credible sources
2. Future predictions must be clearly labeled as projections
3. Technology impact claims need supporting evidence
4. Industry trend statements require data backing
5. Professional practice claims need verification

Be particularly vigilant about unsupported statistics and predictions about AI's impact on healthcare professions.`
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
    console.log('Received response from Perplexity API:', JSON.stringify(data, null, 2));

    // Parse the response from the model with enhanced error handling
    let issues = [];
    try {
      const content = data.choices[0].message.content;
      if (content) {
        // First try to parse as direct JSON
        try {
          issues = JSON.parse(content);
        } catch {
          // If direct parsing fails, try to find and parse any JSON-like structure
          const jsonMatch = content.match(/\[.*\]/s);
          if (jsonMatch) {
            try {
              issues = JSON.parse(jsonMatch[0]);
            } catch (innerError) {
              console.error('Error parsing JSON from matched content:', innerError);
              throw new Error('Failed to parse fact-check results');
            }
          } else {
            console.error('No JSON-like structure found in response');
            throw new Error('Invalid response format from fact-checker');
          }
        }
      }
    } catch (error) {
      console.error('Error parsing fact-check results:', error);
      throw new Error('Failed to process fact-check results');
    }

    console.log(`Identified ${issues.length} potential issues`);

    return new Response(JSON.stringify({ issues }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fact-check-post function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      issues: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
