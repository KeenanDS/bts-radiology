
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface RequestBody {
  content: string;
  postId?: string;
  action?: string;
  issueIndex?: number;
  claim?: string;
  issue?: string;
  suggestion?: string;
}

// This function handles fact-checking via the Perplexity API
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { content, postId, action, issueIndex, claim, issue, suggestion } = await req.json() as RequestBody;
    
    if (!content) {
      return new Response(
        JSON.stringify({ error: "Content is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log(`Received content for fact checking (${content.length} characters)`);
    console.log(`Post ID: ${postId || 'Not provided'}`);
    console.log(`Action: ${action || 'fact-check'}`);

    // Handle revision action
    if (action === 'revise') {
      if (issueIndex === undefined || !claim || !issue || !suggestion) {
        return new Response(
          JSON.stringify({ 
            error: "Missing required parameters for revision", 
            success: false 
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        );
      }

      const revisedContent = await reviseContent(content, claim, issue, suggestion);
      
      // Store the revised content in the database if postId is provided
      if (postId) {
        await updatePostContent(postId, revisedContent);
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          revisedContent,
          revisedAt: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }
    
    // Default action: fact-checking
    const issues = await factCheckContent(content);
    
    // Store results in the database if postId is provided
    if (postId) {
      await storeFactCheckResults(postId, issues);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        issues,
        checkedAt: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in fact-check-post function:", error);
    
    // Handle specific API errors
    if (error.message && error.message.includes('API')) {
      return new Response(
        JSON.stringify({ 
          error: "Error calling Perplexity API", 
          details: error.message,
          success: false
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        details: error.message,
        success: false
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

// Function to call Perplexity API for revising content
async function reviseContent(content: string, claim: string, issue: string, suggestion: string) {
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  
  if (!PERPLEXITY_API_KEY) {
    throw new Error("PERPLEXITY_API_KEY environment variable is not set");
  }
  
  const prompt = `
You are a highly skilled content editor who specializes in fixing factual errors in blog posts while maintaining the style and voice of the original content.

I'll provide you with a blog post and a specific factual issue that needs to be fixed. Please update ONLY the problematic part while preserving the overall context, style, and structure of the content.

Original content: 
"""
${content}
"""

Problematic claim: "${claim}"

Issue with the claim: "${issue}"

Suggested correction: "${suggestion}"

Please return the entire revised content with the factual error fixed. Make sure your changes are seamless and maintain the flow of the original text. Only change what's necessary to correct the factual error.
`;

  try {
    console.log("Calling Perplexity API for content revision...");
    
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: "You are a content revision assistant that fixes factual inaccuracies in blog posts.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2, // Low temperature for more accurate revisions
        max_tokens: 4000,
        top_p: 1,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Perplexity API error:", errorData);
      throw new Error(`API returned ${response.status}: ${errorData}`);
    }

    const data = await response.json();
    console.log("Perplexity API revision response received");
    
    // Extract the response content
    const revisedContent = data.choices[0]?.message?.content;
    
    if (!revisedContent) {
      console.error("No content in API response:", data);
      throw new Error("No revised content received from API");
    }
    
    return revisedContent;
  } catch (error) {
    console.error("Error calling Perplexity API for revision:", error);
    throw error;
  }
}

// Function to call Perplexity API for fact checking
async function factCheckContent(content: string) {
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  
  if (!PERPLEXITY_API_KEY) {
    throw new Error("PERPLEXITY_API_KEY environment variable is not set");
  }
  
  const prompt = `
You are a highly skilled fact-checker with expertise in identifying factual inaccuracies in written content.

I'll provide you with a blog post. Please analyze it carefully and identify any factual claims that:
1. Contain false information
2. Present misleading statistics or data
3. Make unsubstantiated claims without evidence
4. Contain historical inaccuracies
5. Misrepresent scientific consensus or research findings

For each issue you find, please provide:
- The exact quote or claim from the text that contains the inaccuracy
- A detailed explanation of why it's inaccurate or misleading
- The correct information or context that should be presented instead

If you don't find any factual issues, respond with an empty array.

Format your response as a JSON array of objects with the following structure:
\`\`\`
[
  {
    "quote": "The exact text containing the inaccuracy",
    "explanation": "Why this is inaccurate",
    "correction": "The corrected information"
  }
]
\`\`\`

If no issues are found, return an empty array: []

Here's the content to fact-check:

${content}
`;

  try {
    console.log("Calling Perplexity API for fact checking...");
    
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: "You are a fact-checking assistant that identifies factual inaccuracies in content.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1, // Low temperature for more factual responses
        max_tokens: 4000,
        top_p: 1,
        frequency_penalty: 0.1,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Perplexity API error:", errorData);
      throw new Error(`API returned ${response.status}: ${errorData}`);
    }

    const data = await response.json();
    console.log("Perplexity API response received");
    
    // Extract the response content
    const responseContent = data.choices[0]?.message?.content;
    
    if (!responseContent) {
      console.error("No content in API response:", data);
      return [];
    }
    
    // Extract JSON array from the response
    try {
      // First try to parse the whole response as JSON
      const parsedIssues = JSON.parse(responseContent);
      if (Array.isArray(parsedIssues)) {
        return parsedIssues;
      }
      
      // If that fails, try to extract JSON from text
      const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const extractedJson = jsonMatch[0];
        return JSON.parse(extractedJson);
      }
      
      console.log("Could not extract JSON array from response, returning empty array");
      return [];
    } catch (error) {
      console.error("Error parsing fact check results:", error);
      console.log("Response content:", responseContent);
      return [];
    }
  } catch (error) {
    console.error("Error calling Perplexity API:", error);
    throw error;
  }
}

// Function to store fact check results in the database
async function storeFactCheckResults(postId: string, issues: any[]) {
  try {
    // Create PostgreSQL client
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Store results in the fact_check_results table
    const { data, error } = await supabase
      .from("fact_check_results")
      .upsert(
        {
          post_id: postId,
          issues: issues,
          checked_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        { onConflict: "post_id" }
      );
      
    if (error) {
      console.error("Error storing fact check results:", error);
    } else {
      console.log("Fact check results saved successfully");
    }
    
    return data;
  } catch (error) {
    console.error("Error in storeFactCheckResults:", error);
    throw error;
  }
}

// Function to update post content in the database
async function updatePostContent(postId: string, content: string) {
  try {
    // Create PostgreSQL client
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Update the blog post content
    const { data, error } = await supabase
      .from("blog_posts")
      .update({
        content: content,
        updated_at: new Date().toISOString()
      })
      .eq("id", postId);
      
    if (error) {
      console.error("Error updating post content:", error);
    } else {
      console.log("Post content updated successfully");
    }
    
    return data;
  } catch (error) {
    console.error("Error in updatePostContent:", error);
    throw error;
  }
}
