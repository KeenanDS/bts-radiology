import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Define the interfaces
interface Issue {
  claim: string;
  issue: string;
  suggestion: string;
  source?: string;
  resolved?: boolean;
}

interface RevisionRequest {
  postId: string;
  issueIndex: number;
  claim: string;
  issue: string;
  suggestion: string;
  content: string;
}

// Make sure these environment variables are set in your Supabase project
const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Log if API keys are missing
if (!perplexityApiKey) {
  console.error('PERPLEXITY_API_KEY environment variable is not set!');
}

if (!openaiApiKey) {
  console.error('OPENAI_API_KEY environment variable is not set!');
}

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  supabaseUrl || '',
  supabaseServiceKey || ''
);

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
    // Log headers for debugging
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    const requestData = await req.json();
    console.log('Received request data:', JSON.stringify(requestData, null, 2));

    // Debug environment variables
    console.log('Environment check:', {
      hasPerplexityKey: !!perplexityApiKey,
      hasOpenAIKey: !!openaiApiKey,
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseServiceKey
    });
    
    // Check if this is a fact-check request or a revision request
    if (requestData.action === 'revise') {
      return await handleRevision(requestData);
    } else {
      return await handleFactCheck(requestData);
    }
  } catch (error) {
    console.error('Error in fact-check-post function:', error);
    // Return more detailed error information
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack,
      type: error.constructor.name,
      issues: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleFactCheck(requestData: any) {
  try {
    console.log('Starting handleFactCheck...');
    const { content, postId } = requestData;
    
    // Debug log the input
    console.log('Input validation:', {
      hasContent: !!content,
      contentType: typeof content,
      contentLength: content?.length,
      postId
    });

    // Basic input validation
    if (!content || typeof content !== 'string' || content.trim() === '') {
      console.log('Input validation failed');
      return new Response(JSON.stringify({ 
        error: 'Invalid or empty content provided',
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for API key
    if (!perplexityApiKey) {
      console.log('Missing Perplexity API key');
      return new Response(JSON.stringify({ 
        error: 'Perplexity API key is not configured',
        success: false
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Attempting to connect to Perplexity API...');
    
    // Create fetch options with explicit types
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'user',
            content: 'Test message: ' + content.substring(0, 100)
          }
        ],
        max_tokens: 50
      })
    };
    
    console.log('Fetch options (excluding auth):', {
      method: fetchOptions.method,
      headers: Object.keys(fetchOptions.headers),
      bodyPreview: fetchOptions.body.substring(0, 100) + '...'
    });

    const response = await fetch('https://api.perplexity.ai/chat/completions', fetchOptions);
    
    console.log('API Response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      return new Response(JSON.stringify({ 
        error: `API connection failed: ${response.status}`,
        details: errorText,
        success: false
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try to get the raw response text first
    const rawResponseText = await response.text();
    console.log('Raw API Response:', rawResponseText);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Successfully connected to API',
      status: response.status,
      rawResponse: rawResponseText
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Detailed error:', {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name
    });
    return new Response(JSON.stringify({ 
      error: 'Connection error',
      details: error.message,
      stack: error.stack,
      type: error.constructor.name,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleRevision(requestData: RevisionRequest) {
  const { postId, issueIndex, claim, issue, suggestion, content } = requestData;
  
  // Validate input
  if (!content || !claim || !issue || !suggestion) {
    return new Response(JSON.stringify({ 
      error: 'Missing required fields for revision',
      success: false
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check for OpenAI API key
  if (!openaiApiKey) {
    return new Response(JSON.stringify({ 
      error: 'OpenAI API key is not configured',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Call OpenAI to revise the content
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an expert medical content editor. Your task is to revise a blog post to address a specific factual issue that has been identified. 
            Make minimal changes to the original text while addressing the issue completely.
            Maintain the same tone, style, and overall structure of the original content.
            Only modify the parts directly related to the factual issue.`
          },
          {
            role: 'user',
            content: `I need you to revise a blog post to address a factual issue.

Original content:
${content}

The issue is with this claim: "${claim}"

The problem: ${issue}

Suggested improvement: ${suggestion}

Please provide the revised version of the entire blog post with the issue fixed. Return ONLY the revised content, with no explanations or additional text.`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error (${response.status}):`, errorText);
      throw new Error(`OpenAI API returned status ${response.status}`);
    }

    const data = await response.json();
    const revisedContent = data.choices[0].message.content.trim();

    // Update the blog post in the database
    if (postId) {
      const { error } = await supabase
        .from('blog_posts')
        .update({ content: revisedContent, updated_at: new Date().toISOString() })
        .eq('id', postId);

      if (error) {
        console.error('Error updating blog post:', error);
        throw new Error('Failed to update blog post: ' + error.message);
      }

      // Update the fact check results to mark this issue as resolved
      try {
        const { data: factCheckData, error: fetchError } = await supabase
          .from('fact_check_results')
          .select('issues')
          .eq('post_id', postId)
          .single();

        if (fetchError) {
          console.error('Error fetching fact check results:', fetchError);
        } else if (factCheckData && factCheckData.issues) {
          const issues = factCheckData.issues as Issue[];
          if (issues[issueIndex]) {
            issues[issueIndex].resolved = true;
            
            const { error: updateError } = await supabase
              .from('fact_check_results')
              .update({ issues })
              .eq('post_id', postId);
              
            if (updateError) {
              console.error('Error updating fact check results:', updateError);
            }
          }
        }
      } catch (factCheckError) {
        console.error('Error updating fact check status:', factCheckError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      revisedContent,
      postId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in revision process:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
