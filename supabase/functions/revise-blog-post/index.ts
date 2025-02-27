
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.6";

// Configuration and environment variables
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// CORS headers for browser requests
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
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRole);
    
    // Parse request body
    const { postId, content, issue, claim, suggestion } = await req.json();
    
    if (!postId || !content) {
      throw new Error('Missing required parameters: postId and content are required');
    }

    console.log(`Processing revision request for post ${postId}`);
    console.log(`Issue with claim: "${claim?.substring(0, 50)}..."`);

    // Retrieve the full post from the database to get context
    const { data: postData, error: postError } = await supabase
      .from('blog_posts')
      .select('title, content')
      .eq('id', postId)
      .single();

    if (postError) {
      console.error('Error fetching post:', postError);
      throw new Error(`Failed to fetch post: ${postError.message}`);
    }

    // Create system prompt that explains the task
    const systemPrompt = `
You are an expert blog post editor specializing in factual accuracy and maintaining the author's original style.

Your task is to revise a blog post to correct a factual error while preserving:
1. The original tone, voice, and writing style
2. The overall flow and organization of the content
3. The length and depth of the content

Please make ONLY the minimum necessary changes to fix the factual issue. Do not rewrite entire sections unless absolutely required.
`;

    // Create user prompt with the specific issue to fix
    const userPrompt = `
I need to revise this blog post because it contains a factual error.

ORIGINAL BLOG POST:
"""
${content}
"""

FACTUAL ERROR:
The following claim in the blog post is problematic: "${claim}"

ISSUE WITH THE CLAIM:
${issue}

SUGGESTED CORRECTION:
${suggestion}

Please provide a revised version of the ENTIRE blog post with just the factual error fixed.
The revised version should flow naturally and maintain the original style throughout.
`;

    console.log('Sending revision request to OpenAI');
    
    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for more factual, predictable output
        max_tokens: 4000, // Allow sufficient tokens for a full blog post revision
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const openaiData = await openaiResponse.json();
    const revisedContent = openaiData.choices[0].message.content;

    console.log('Successfully generated revised content');
    
    // Update the post in the database
    if (postId) {
      const { error: updateError } = await supabase
        .from('blog_posts')
        .update({
          content: revisedContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', postId);

      if (updateError) {
        console.error('Error updating post in database:', updateError);
        // Continue anyway to return the revised content to the client
      } else {
        console.log('Successfully updated post in database');
      }
    }

    // Return the revised content to the client
    return new Response(
      JSON.stringify({
        success: true,
        revisedContent,
        message: 'Content successfully revised'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in revise-blog-post function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
