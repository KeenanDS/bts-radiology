
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// Define interfaces for our requests and responses
interface FactCheckRequest {
  content: string;
  postId?: string;
}

interface RevisionRequest {
  content: string;
  postId?: string;
  issueIndex: number;
  claim: string;
  issue: string;
  suggestion: string;
}

interface FactCheckIssue {
  claim: string;
  issue: string;
  suggestion: string;
  source?: string;
  resolved?: boolean;
}

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    console.log('Received request data:', JSON.stringify(requestData));

    // Check if this is a revision request or a fact-check request
    if (requestData.action === 'revise') {
      return await handleRevision(requestData as RevisionRequest);
    } else {
      return await handleFactCheck(requestData as FactCheckRequest);
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process request', 
        details: error.message,
        success: false,
        issues: []
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function handleFactCheck(request: FactCheckRequest) {
  // Input validation
  if (!request.content || typeof request.content !== 'string' || request.content.trim() === '') {
    console.log('Invalid or empty content provided');
    return new Response(
      JSON.stringify({ 
        error: 'Invalid or empty content provided',
        success: false,
        issues: []
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!perplexityApiKey) {
    console.error('Perplexity API key is not configured');
    return new Response(
      JSON.stringify({ 
        error: 'Perplexity API key is not configured',
        success: false,
        issues: []
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    console.log('Sending fact-check request to Perplexity API');

    const prompt = `You are a fact-checking expert tasked with analyzing the following blog post for factual accuracy.
    
    ${request.content}
    
    Identify any claims that are factually incorrect, misleading, or need verification. For each issue found:
    1. Quote the specific claim that has an issue
    2. Explain what the factual issue is
    3. Suggest how to correct or improve the claim
    4. Provide a credible source if applicable
    
    Format your response as a JSON array with objects containing:
    - "claim": the problematic statement (quoted directly)
    - "issue": clear explanation of what's incorrect
    - "suggestion": specific recommendation for correction
    - "source": (optional) URL or citation to a credible source
    
    If no factual issues are found, return an empty array. Only focus on factual accuracy, not grammar, style, or opinions.
    
    Respond ONLY with valid JSON in this format:
    [
      {
        "claim": "Example claim from the text",
        "issue": "The issue with this claim",
        "suggestion": "How to correct it",
        "source": "https://example.com/source" (optional)
      }
    ]`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Perplexity API error (${response.status}):`, errorText);
      return new Response(
        JSON.stringify({ 
          error: `Perplexity API returned error: ${response.status}`,
          details: errorText,
          success: false,
          issues: []
        }),
        { 
          status: 502, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('Perplexity API response:', JSON.stringify(data));

    // Extract the content from the response
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('Unexpected response format from Perplexity API');
    }

    const content = data.choices[0].message.content;
    
    // Parse the JSON content (which should be an array of issues)
    let issues: FactCheckIssue[] = [];
    try {
      // The content might be a JSON string, try to parse it
      issues = JSON.parse(content);
      
      // Validate that issues is an array
      if (!Array.isArray(issues)) {
        console.error('Invalid response format - not an array:', content);
        issues = [];
      }
    } catch (error) {
      console.error('Error parsing JSON from API response:', error);
      console.log('Raw content:', content);
      
      // Try to extract JSON from the text (in case it's wrapped in explanatory text)
      const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
      if (jsonMatch) {
        try {
          issues = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('Failed to extract JSON from response:', e);
          issues = [];
        }
      } else {
        issues = [];
      }
    }

    // If we have a postId, store the fact check results in the database
    if (request.postId && issues.length > 0) {
      try {
        const { error } = await supabase
          .from('fact_check_results')
          .upsert({ 
            post_id: request.postId,
            issues,
            checked_at: new Date().toISOString()
          }, { 
            onConflict: 'post_id'
          });

        if (error) {
          console.error('Error storing fact check results:', error);
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        issues,
        postId: request.postId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in fact-checking process:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to complete fact check',
        details: error.message,
        success: false,
        issues: []
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function handleRevision(request: RevisionRequest) {
  // Input validation
  if (!request.content || !request.claim || !request.issue || !request.suggestion) {
    return new Response(
      JSON.stringify({ 
        error: 'Missing required fields for revision',
        success: false
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!perplexityApiKey) {
    return new Response(
      JSON.stringify({ 
        error: 'Perplexity API key is not configured',
        success: false
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    console.log('Sending revision request to Perplexity API');
    
    const prompt = `You are an expert medical content editor. Your task is to revise a blog post to address a specific factual issue that has been identified.
    
    Here is the original content:
    ${request.content}
    
    The issue is with this claim: "${request.claim}"
    
    The problem: ${request.issue}
    
    Suggested improvement: ${request.suggestion}
    
    Please provide the revised version of the entire blog post with the issue fixed. Make minimal changes to the original text while addressing the issue completely. Maintain the same tone, style, and overall structure. Only modify the parts directly related to the factual issue.
    
    Return ONLY the revised content, with no explanations or additional text.`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Perplexity API error (${response.status}):`, errorText);
      return new Response(
        JSON.stringify({ 
          error: `Perplexity API returned error: ${response.status}`,
          details: errorText,
          success: false
        }),
        { 
          status: 502, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('Perplexity API revision response received');

    // Extract the revised content
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('Unexpected response format from Perplexity API');
    }

    const revisedContent = data.choices[0].message.content.trim();

    // Update the blog post in the database if postId is provided
    if (request.postId) {
      try {
        const { error } = await supabase
          .from('blog_posts')
          .update({ 
            content: revisedContent,
            updated_at: new Date().toISOString()
          })
          .eq('id', request.postId);

        if (error) {
          console.error('Error updating blog post:', error);
          throw new Error('Failed to update blog post: ' + error.message);
        }

        // Update the fact check results to mark this issue as resolved
        try {
          const { data: factCheckData, error: fetchError } = await supabase
            .from('fact_check_results')
            .select('issues')
            .eq('post_id', request.postId)
            .single();

          if (fetchError) {
            console.error('Error fetching fact check results:', fetchError);
          } else if (factCheckData && factCheckData.issues) {
            const issues = factCheckData.issues as FactCheckIssue[];
            if (issues[request.issueIndex]) {
              issues[request.issueIndex].resolved = true;
              
              const { error: updateError } = await supabase
                .from('fact_check_results')
                .update({ issues })
                .eq('post_id', request.postId);
                
              if (updateError) {
                console.error('Error updating fact check results:', updateError);
              }
            }
          }
        } catch (factCheckError) {
          console.error('Error updating fact check status:', factCheckError);
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to update blog post',
            details: dbError.message,
            success: false
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        revisedContent,
        postId: request.postId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in revision process:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}
