
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const perplexityApiKey = Deno.env.get("PERPLEXITY_API_KEY");
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Status constants
const STATUS = {
  FACT_CHECK_ISSUES_FOUND: "fact_check_issues_found",
  FACT_CHECK_FIXED: "fact_check_fixed",
  COMPLETED: "completed",
};

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// System prompt for content revision
const SYSTEM_PROMPT = `You are RevisionExpert, an AI specialized in revising blog post content to fix factual issues. 

You will be given:
1. The original blog post content
2. A specific issue that needs fixing, including:
   - The problematic claim (exact quote)
   - An explanation of the issue
   - A suggested correction

Your task is to:
1. Find the exact quote in the original content
2. Replace it with an improved version based on the suggested correction
3. Make minimal changes beyond the specific issue to maintain the original style and flow
4. Return the entire revised content (not just the fixed part)

Important guidelines:
- Be precise in your edits, only changing what's necessary
- Maintain the original formatting, including headings, paragraphs, lists, etc.
- Keep the same tone and voice as the original content
- Ensure your changes blend seamlessly with the surrounding text
- Return the complete revised blog post content`;

// Main request handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Received blog post revision request");
    
    // Validate Perplexity API key
    if (!perplexityApiKey) {
      console.error("Missing PERPLEXITY_API_KEY");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error: Missing Perplexity API key",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request
    const { postId, content, issue, claim, suggestion } = await req.json();
    
    // Validate required parameters
    if (!postId && !content) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Either postId or content is required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!issue || !claim) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Issue and claim are required for revision",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let contentToRevise = content;
    let blogPostData = null;
    
    // If postId is provided but content is not, fetch the content from the database
    if (postId && !contentToRevise) {
      console.log(`Fetching content for post ${postId}`);
      const { data: postData, error: postError } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("id", postId)
        .single();

      if (postError) {
        console.error(`Error fetching post ${postId}: ${postError.message}`);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to fetch post content: ${postError.message}`,
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!postData || !postData.content) {
        console.error(`No content found for post ${postId}`);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Post has no content to revise",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      contentToRevise = postData.content;
      blogPostData = postData;
    }

    // Validate content
    if (!contentToRevise) {
      console.error("No content provided for revision");
      return new Response(
        JSON.stringify({
          success: false,
          error: "No content provided for revision",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Starting revision for content with issue: ${issue.substring(0, 50)}...`);
    
    // Call Perplexity API for content revision
    const revisedContent = await reviseContent(contentToRevise, issue, claim, suggestion);
    
    // If revision failed
    if (!revisedContent) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to revise content",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // If postId is provided, update the blog post with revised content
    if (postId && blogPostData) {
      console.log(`Updating post ${postId} with revised content`);
      
      // Check if any fact check issues remain
      let newStatus = STATUS.FACT_CHECK_FIXED;
      
      try {
        const { data: factCheckData } = await supabase
          .from("fact_check_results")
          .select("issues")
          .eq("post_id", postId)
          .maybeSingle();
          
        if (factCheckData && Array.isArray(factCheckData.issues)) {
          // Count unfixed issues (assuming this is for a single issue fix)
          const remainingIssues = factCheckData.issues.length - 1;
          console.log(`Remaining issues after fix: ${remainingIssues}`);
          
          if (remainingIssues <= 0) {
            // If all issues are fixed, set status to completed
            newStatus = STATUS.COMPLETED;
          }
        }
      } catch (factCheckError) {
        console.error(`Error checking remaining issues: ${factCheckError.message}`);
        // Continue with update even if we can't check remaining issues
      }
      
      // Update the blog post with revised content
      const { error: updateError } = await supabase
        .from("blog_posts")
        .update({
          content: revisedContent,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId);
        
      if (updateError) {
        console.error(`Error updating blog post: ${updateError.message}`);
        // Return success with content but log the error
        console.log("Returning revised content despite update error");
        return new Response(
          JSON.stringify({
            success: true,
            revisedContent,
            updateSuccess: false,
            updateError: updateError.message,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Return the revised content
    return new Response(
      JSON.stringify({
        success: true,
        revisedContent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`Error in revise-blog-post: ${error.message}`);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Revise content using Perplexity API
async function reviseContent(content: string, issue: string, claim: string, suggestion: string) {
  try {
    console.log("Calling Perplexity API for content revision");
    
    const userPrompt = `Please revise the following blog post content to fix a factual issue:

ORIGINAL CONTENT:
${content}

ISSUE TO FIX:
${issue}

PROBLEMATIC CLAIM:
${claim}

SUGGESTED CORRECTION:
${suggestion || "No specific correction provided, please fix based on the issue description"}

Please provide the entire revised blog post with the issue fixed.`;

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${perplexityApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 4000,
        top_p: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    
    // Get the completion
    const completion = result.choices[0]?.message?.content;
    if (!completion) {
      console.error("Empty response from Perplexity API");
      return null;
    }
    
    console.log(`Received revised content (${completion.length} chars)`);
    return completion;
  } catch (error) {
    console.error(`Error in reviseContent: ${error.message}`);
    return null;
  }
}
