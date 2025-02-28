
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const perplexityApiKey = Deno.env.get("PERPLEXITY_API_KEY");

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fact checking system prompt
const SYSTEM_PROMPT = `You are FactChecker, an AI assistant specialized in verifying the factual accuracy of blog posts about medical imaging and radiology.

Your task:
1. Analyze the given content for factual errors, inaccuracies, or misleading information.
2. For each issue you find, extract:
   - The exact quote containing the problematic claim
   - An explanation of why it's incorrect or problematic
   - A suggested correction
   - If applicable, a reliable source to verify the correct information

Focus on these types of issues:
- Incorrect technical information about imaging modalities (CT, MRI, X-ray, ultrasound, etc.)
- Outdated clinical practices or guidelines
- Misrepresented statistics or research findings
- Incorrect anatomical or physiological information
- Misleading claims about technology capabilities
- Factual errors about healthcare regulations or standards

Format your response as a JSON array of objects with these fields:
[
  {
    "quote": "The exact text containing the issue",
    "explanation": "Why this is problematic",
    "correction": "Suggested revision",
    "source": "Optional reference source"
  }
]

If no issues are found, return an empty array: []

Important: Focus only on factual accuracy, not on grammar, style, or subjective opinions.`;

// Main request handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Received fact check request");
    
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
    const { postId, content } = await req.json();
    console.log(`Fact check request for postId: ${postId ? postId : 'Not provided'}`);
    
    let contentToCheck = content;
    
    // If postId is provided but content is not, fetch the content from the database
    if (postId && !contentToCheck) {
      console.log(`Fetching content for post ${postId}`);
      const { data: postData, error: postError } = await supabase
        .from("blog_posts")
        .select("content, title")
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
            error: "Post has no content to fact check",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      contentToCheck = postData.content;
    }

    // Validate content
    if (!contentToCheck) {
      console.error("No content provided for fact checking");
      return new Response(
        JSON.stringify({
          success: false,
          error: "No content provided for fact checking",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Truncate content if too long (Perplexity API limits)
    const maxContentLength = 50000; // Adjust based on API limits
    if (contentToCheck.length > maxContentLength) {
      console.log(`Content too long (${contentToCheck.length} chars), truncating to ${maxContentLength} chars`);
      contentToCheck = contentToCheck.substring(0, maxContentLength);
    }

    console.log(`Starting fact check for content (${contentToCheck.length} chars)`);
    
    // Call Perplexity API for fact checking
    const factCheckResults = await performFactCheck(contentToCheck);
    
    // Log the results
    const issueCount = factCheckResults.length;
    console.log(`Fact check complete. Found ${issueCount} issues.`);
    
    // If postId is provided, store the fact check results
    if (postId) {
      console.log(`Storing fact check results for post ${postId}`);
      
      // Check if a fact check result already exists
      const { data: existingCheck } = await supabase
        .from("fact_check_results")
        .select("id")
        .eq("post_id", postId)
        .maybeSingle();
        
      if (existingCheck) {
        // Update existing fact check result
        const { error: updateError } = await supabase
          .from("fact_check_results")
          .update({
            issues: factCheckResults,
            checked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingCheck.id);
          
        if (updateError) {
          console.error(`Error updating fact check results: ${updateError.message}`);
        }
      } else {
        // Insert new fact check result
        const { error: insertError } = await supabase
          .from("fact_check_results")
          .insert({
            post_id: postId,
            issues: factCheckResults,
            checked_at: new Date().toISOString(),
          });
          
        if (insertError) {
          console.error(`Error inserting fact check results: ${insertError.message}`);
        }
      }
    }

    // Return the fact check results
    return new Response(
      JSON.stringify({
        success: true,
        issues: factCheckResults,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`Error in fact-check-post: ${error.message}`);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Perform fact check using Perplexity API
async function performFactCheck(content: string) {
  try {
    console.log("Calling Perplexity API for fact checking");
    
    const userPrompt = `Please fact check the following content and identify any factual errors or inaccuracies:

${content}`;

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
    
    // Parse the completion - expect JSON array
    let issues = [];
    try {
      const completion = result.choices[0]?.message?.content;
      if (completion) {
        console.log(`Received response from Perplexity: ${completion.substring(0, 100)}...`);
        
        // Check if response is already JSON
        if (completion.trim().startsWith("[") && completion.trim().endsWith("]")) {
          issues = JSON.parse(completion);
        } else {
          // Try to extract JSON array from the text response
          const jsonMatch = completion.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            issues = JSON.parse(jsonMatch[0]);
          } else {
            console.warn("Could not parse JSON from Perplexity response");
            issues = [];
          }
        }
      }
    } catch (parseError) {
      console.error(`Error parsing Perplexity response: ${parseError.message}`);
      issues = [];
    }

    return Array.isArray(issues) ? issues : [];
  } catch (error) {
    console.error(`Error in performFactCheck: ${error.message}`);
    return [];
  }
}
