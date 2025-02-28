
// Follow this setup guide to integrate the Deno runtime into your application:
// https://docs.supabase.com/guides/functions/connect-to-postgres

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Adjust these to match your environment variables names
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const perplexityApiKey = Deno.env.get("PERPLEXITY_API_KEY");

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Check if this is a POST request
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { 
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  try {
    // Parse request body
    const { postId, content } = await req.json();

    // Validate required parameters
    if (!postId && !content) {
      return new Response(
        JSON.stringify({ error: "Either postId or content is required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If we have a postId but no content, fetch the content from the database
    let postContent = content;
    let blogPostId = postId;

    if (postId && !content) {
      console.log(`Fetching content for post ID: ${postId}`);
      
      const { data: post, error: fetchError } = await supabase
        .from("blog_posts")
        .select("id, content")
        .eq("id", postId)
        .single();
      
      if (fetchError) {
        throw new Error(`Failed to fetch blog post: ${fetchError.message}`);
      }
      
      if (!post) {
        throw new Error(`Blog post with ID ${postId} not found`);
      }
      
      postContent = post.content;
    } else if (content && !postId) {
      // If we have content but no postId, we'll fact check without saving results
      console.log("Fact checking content without saving results to database");
    }

    // Check if Perplexity API key is available
    if (!perplexityApiKey) {
      return new Response(
        JSON.stringify({ 
          error: "PERPLEXITY_API_KEY environment variable is not set",
          success: false
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log("Starting fact check process");

    // Perform fact checking with Perplexity API
    const factCheckIssues = await performFactCheck(postContent);

    // If we have a postId, save the fact check results to the database
    if (blogPostId) {
      console.log(`Saving fact check results for post ID: ${blogPostId}`);
      
      // Check if a fact check result already exists for this post
      const { data: existingCheck } = await supabase
        .from("fact_check_results")
        .select("id")
        .eq("post_id", blogPostId)
        .maybeSingle();
      
      if (existingCheck) {
        // Update existing fact check result
        const { error: updateError } = await supabase
          .from("fact_check_results")
          .update({
            issues: factCheckIssues,
            checked_at: new Date().toISOString()
          })
          .eq("id", existingCheck.id);
        
        if (updateError) {
          throw new Error(`Failed to update fact check results: ${updateError.message}`);
        }
      } else {
        // Insert new fact check result
        const { error: insertError } = await supabase
          .from("fact_check_results")
          .insert({
            post_id: blogPostId,
            issues: factCheckIssues,
            checked_at: new Date().toISOString()
          });
        
        if (insertError) {
          throw new Error(`Failed to insert fact check results: ${insertError.message}`);
        }
      }
    }

    // Return successful response
    return new Response(
      JSON.stringify({
        success: true,
        issues: factCheckIssues,
        message: "Fact check completed successfully"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

async function performFactCheck(content) {
  console.log("Performing fact check with Perplexity API");
  
  try {
    // Prepare prompt for fact checking
    const prompt = `
You are a critical fact-checker evaluating the accuracy of the following blog post. 
Identify and list any factual errors, misleading statements, or claims that need verification.
For each issue, provide:
1. The exact quote from the text
2. An explanation of why it's problematic
3. A suggested correction
4. Source information when applicable

ONLY identify factual issues, not style, grammar or opinion issues. 
If there are no factual issues, return an empty array.

Format your response as a valid JSON array of objects with these keys: quote, explanation, correction, source.
BLOG POST CONTENT:
${content}
`;

    // Call Perplexity API
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${perplexityApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          {
            role: "system",
            content: "You are a professional fact-checker who evaluates the accuracy of content."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 3000,
        top_p: 0.9,
        frequency_penalty: 0.0,
        presence_penalty: 0.0
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const responseData = await response.json();
    console.log("Received response from Perplexity API");

    // Extract the AI's response text
    const aiResponse = responseData.choices && 
                       responseData.choices[0] && 
                       responseData.choices[0].message && 
                       responseData.choices[0].message.content;

    if (!aiResponse) {
      throw new Error("Invalid response from Perplexity API");
    }

    // Try to parse the JSON from the AI's response
    try {
      // First attempt to extract a JSON array if it's embedded in markdown or text
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        const issues = JSON.parse(jsonMatch[0]);
        console.log(`Found ${issues.length} fact check issues`);
        return issues;
      } else {
        // If no JSON array is found and the response indicates no issues
        if (aiResponse.toLowerCase().includes("no factual issues") || 
            aiResponse.toLowerCase().includes("no issues found") || 
            aiResponse.toLowerCase().includes("empty array")) {
          console.log("No fact check issues found");
          return [];
        }
        
        // If we get here, try to parse the entire response as JSON
        try {
          const issues = JSON.parse(aiResponse);
          if (Array.isArray(issues)) {
            console.log(`Found ${issues.length} fact check issues`);
            return issues;
          } else {
            console.warn("Response is valid JSON but not an array, returning empty array");
            return [];
          }
        } catch (e) {
          console.warn("Failed to parse AI response as JSON, returning empty array");
          return [];
        }
      }
    } catch (parseError) {
      console.error("Error parsing fact check results:", parseError);
      throw new Error(`Failed to parse fact check results: ${parseError.message}`);
    }
  } catch (error) {
    console.error("Error during fact checking:", error);
    throw new Error(`Fact check failed: ${error.message}`);
  }
}
