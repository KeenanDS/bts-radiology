
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

    const prompt = `As a specialized fact-checker for medical and healthcare content, carefully analyze this text. 
    
Your primary objectives are to:

1. Review Factual Claims:
   - Identify ANY numerical statistics, percentages, or quantitative data
   - Check for specific dates, timeframes, or temporal claims
   - Verify claims about research studies or scientific findings
   - Analyze historical statements or industry developments

2. Scrutinize Healthcare Claims:
   - Examine statements about medical procedures or treatments
   - Verify claims about healthcare technology capabilities
   - Check assertions about industry standards or practices
   - Review statements about patient outcomes or success rates

3. Evaluate AI-Related Content:
   - Validate claims about AI capabilities in healthcare
   - Check statements about AI adoption rates or implementation statistics
   - Verify predictions about AI's impact on healthcare roles
   - Review technical specifications or performance metrics

IMPORTANT: For EACH potential issue you find, you MUST provide:
1. The exact claim or statement from the text (quoted verbatim)
2. A detailed explanation of why this claim requires verification
3. A specific suggestion for improvement, such as:
   - Adding source citations
   - Including specific timeframes
   - Qualifying statements with "may," "could," or similar terms
   - Providing context for statistics
   - Noting if something is a projection or estimate

Format your response as a JSON array of objects, each with 'claim', 'issue', and 'suggestion' fields.
If no issues are found, return an empty array but only after thorough verification.

Here's the content to analyze:

${content}`;

    console.log('Sending request to Perplexity API with enhanced prompt...');
    
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
            content: `You are an expert fact-checker with specialized knowledge in:
- Medical research methodology and statistics
- Healthcare industry trends and standards
- AI/ML implementation in healthcare settings
- Evidence-based medicine principles
- Scientific literature evaluation
- Regulatory compliance in healthcare

Your primary directives are to:
1. Be EXTREMELY skeptical of any unsourced statistics or absolute claims
2. Flag ALL predictive statements about future developments
3. Question any technological claims lacking specific implementation details
4. Challenge generalizations about healthcare practices
5. Identify potential conflicts with established medical evidence

Maintain high standards for verification by:
- Requiring specific sources for statistical claims
- Ensuring temporal context for all trend statements
- Demanding clear qualification of predictive claims
- Insisting on precise technical specifications
- Checking for logical consistency throughout`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Lowered temperature for more consistent, conservative fact-checking
        max_tokens: 2000,
        frequency_penalty: 0,
        presence_penalty: 0
      }),
    });

    const data = await response.json();
    console.log('Received response from Perplexity API:', JSON.stringify(data, null, 2));

    let issues = [];
    try {
      const content = data.choices[0].message.content;
      if (content) {
        // First try to parse as direct JSON
        try {
          issues = JSON.parse(content);
          console.log(`Successfully parsed ${issues.length} issues from response`);
        } catch (parseError) {
          console.error('Direct JSON parsing failed, attempting to extract JSON structure:', parseError);
          // If direct parsing fails, try to find and parse any JSON-like structure
          const jsonMatch = content.match(/\[.*\]/s);
          if (jsonMatch) {
            try {
              issues = JSON.parse(jsonMatch[0]);
              console.log(`Successfully extracted and parsed ${issues.length} issues from matched content`);
            } catch (matchError) {
              console.error('Error parsing JSON from matched content:', matchError);
              throw new Error('Failed to parse fact-check results');
            }
          } else {
            console.error('No JSON-like structure found in response');
            throw new Error('Invalid response format from fact-checker');
          }
        }
      }

      // Validate the structure of each issue
      issues = issues.filter(issue => {
        const isValid = 
          issue && 
          typeof issue === 'object' && 
          typeof issue.claim === 'string' && 
          typeof issue.issue === 'string' && 
          typeof issue.suggestion === 'string';
        
        if (!isValid) {
          console.warn('Filtered out invalid issue:', issue);
        }
        return isValid;
      });

      console.log(`Final validated issues count: ${issues.length}`);
    } catch (error) {
      console.error('Error processing fact-check results:', error);
      throw new Error('Failed to process fact-check results');
    }

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
