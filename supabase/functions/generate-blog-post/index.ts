
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

    const systemPrompt = `Please generate a professional blog post for a medical website focusing on radiology careers and opportunities. The post should follow these specific requirements:

Structure and Format:
- Create 4-5 distinct sections, each with a clear subheading
- Total length should be approximately 800-1000 words
- Include a compelling hook in the opening paragraph
- Write in a clear, engaging style accessible to both medical professionals and general readers
- Use short paragraphs and simple sentence structures for improved readability
- REQUIRED: Include at least one clearly formatted list (bulleted or numbered) that:
  * Appears within one of the main sections
  * Contains 3-5 key points related to the topic
  * Uses consistent formatting and parallel structure
  * Enhances readability and scannability of the content
  * Naturally flows with the surrounding text

SEO Requirements:
- Generate and naturally incorporate relevant keywords that:
  * Relate directly to the specific blog topic
  * Include at least 2-3 terms connecting to radiology careers/jobs
  * Align with RadiologyJobs.com's core purpose as a job board
  * Consider common search terms users might use when looking for this specific information
  * Blend topic-specific terminology with career-focused language
- Reference current industry trends or technological advances in radiology

Content Guidelines:
- Create content that primarily addresses the specific topic while naturally connecting it to the radiology profession
- For directly career-related topics:
  * Provide specific insights about radiology career opportunities
  * Include practical advice and actionable steps
  * Address relevant industry challenges and solutions
- For indirect or general topics:
  * Demonstrate how the topic impacts or relates to radiology professionals
  * Include perspectives or insights specific to radiologists
  * Draw connections between the topic and career development or workplace dynamics
- For technology or industry trend topics:
  * Explore implications for radiology careers and job opportunities
  * Highlight how new developments affect the professional landscape
  * Consider future career implications or opportunities
- Always:
  * Incorporate relevant real-world examples or scenarios
  * Include a call-to-action that connects to RadiologyJobs.com's services
  * Maintain relevance for both practicing professionals and job seekers

Tone and Style:
- Professional but conversational
- Authoritative yet approachable
- Optimistic and encouraging
- Free of medical jargon unless absolutely necessary (with explanations when used)

Additional Requirements:
- Incorporate smooth transition sentences between sections
- Suggest 2-3 meta description options for SEO purposes
- Ensure proper formatting of any lists using markdown syntax

Please ensure the content is original, engaging, and provides genuine value to readers interested in radiology careers. The final output should be ready for publication with minimal editing required.`;

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
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ],
        system: systemPrompt,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error response:', errorText);
      throw new Error(`Anthropic API error: ${errorText}`);
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
