
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Status constants
const STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  GENERATING: "generating",
  FACT_CHECKING: "fact_checking",
  FACT_CHECK_ISSUES_FOUND: "fact_check_issues_found",
  FACT_CHECK_FIXED: "fact_check_fixed",
  COMPLETED: "completed",
  FAILED: "failed",
};

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Main request handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Processing scheduled posts...");
  
  try {
    // Get pending posts scheduled for now or earlier
    const now = new Date().toISOString();
    const { data: pendingPosts, error: queryError } = await supabase
      .from("scheduled_posts")
      .select("*")
      .eq("status", STATUS.PENDING)
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true });

    if (queryError) {
      throw new Error(`Failed to query pending posts: ${queryError.message}`);
    }

    if (!pendingPosts || pendingPosts.length === 0) {
      console.log("No pending posts to process");
      return new Response(JSON.stringify({ success: true, message: "No pending posts to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${pendingPosts.length} pending posts to process`);

    // Process each post
    for (const post of pendingPosts) {
      console.log(`Processing post ${post.id} scheduled for ${post.scheduled_for}`);

      // Update status to PROCESSING
      await updatePostStatus(post.id, STATUS.PROCESSING, null);

      try {
        // Generate the posts based on topics
        const generatedTopics = post.auto_generate_topics 
          ? await generateTopics(post.num_posts)
          : (post.topics as string[]) || [];
        
        // Ensure we have enough topics
        if (generatedTopics.length < post.num_posts) {
          const additionalTopics = await generateTopics(post.num_posts - generatedTopics.length);
          generatedTopics.push(...additionalTopics);
        }

        console.log(`Generated topics: ${generatedTopics.join(", ")}`);

        // Generate blog posts for each topic
        const blogPosts = [];
        for (const topic of generatedTopics.slice(0, post.num_posts)) {
          try {
            const blogPost = await generateBlogPost(topic, post.id);
            blogPosts.push(blogPost);
          } catch (error) {
            console.error(`Error generating post for topic "${topic}": ${error.message}`);
          }
        }

        if (blogPosts.length === 0) {
          throw new Error("Failed to generate any blog posts");
        }

        // If auto fact check is enabled, process each post
        if (post.auto_fact_check) {
          console.log(`Auto fact check enabled for post ${post.id}`);
          
          // Process fact checking for each blog post
          for (const blogPost of blogPosts) {
            try {
              await processFactCheck(blogPost, post.id);
            } catch (factCheckError) {
              console.error(`Fact check error for post ${blogPost.id}: ${factCheckError.message}`);
              // Continue with other posts even if one fact check fails
            }
          }
        }

        // Mark scheduled post as completed
        await updatePostStatus(post.id, STATUS.COMPLETED, null);
        console.log(`Completed processing post ${post.id}`);
      } catch (error) {
        console.error(`Error processing post ${post.id}: ${error.message}`);
        await updatePostStatus(post.id, STATUS.FAILED, error.message);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${pendingPosts.length} posts` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`Error in process-scheduled-posts: ${error.message}`);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

// Helper function to update post status
async function updatePostStatus(postId: string, status: string, errorMessage: string | null) {
  const { error } = await supabase
    .from("scheduled_posts")
    .update({ 
      status, 
      error_message: errorMessage,
      ...(status === STATUS.COMPLETED ? { completed_at: new Date().toISOString() } : {})
    })
    .eq("id", postId);

  if (error) {
    console.error(`Failed to update post status: ${error.message}`);
  }
}

// Generate topics using the generate-topic function
async function generateTopics(count: number): Promise<string[]> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-topic`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ count })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate topics: ${response.statusText}`);
    }

    const { topics } = await response.json();
    return topics || [];
  } catch (error) {
    console.error(`Error generating topics: ${error.message}`);
    return [];
  }
}

// Generate a blog post using the generate-blog-post function
async function generateBlogPost(topic: string, scheduledPostId: string) {
  console.log(`Generating blog post for topic: ${topic}`);
  
  try {
    // Call the generate-blog-post function
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-blog-post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ topic })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate blog post: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Blog post generation response: ${JSON.stringify(data.content).substring(0, 100)}...`);

    // Insert the blog post into the database
    const { data: blogPostData, error: insertError } = await supabase
      .from("blog_posts")
      .insert({
        title: topic,
        content: data.content,
        scheduled_post_id: scheduledPostId,
        status: STATUS.GENERATING,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to insert blog post: ${insertError.message}`);
    }

    console.log(`Blog post inserted with ID: ${blogPostData.id}`);
    return blogPostData;
  } catch (error) {
    console.error(`Error in generateBlogPost: ${error.message}`);
    throw error;
  }
}

// Process fact check for a blog post
async function processFactCheck(blogPost: any, scheduledPostId: string) {
  try {
    console.log(`Starting fact check for blog post: ${blogPost.id}`);
    
    // Update blog post status to fact checking
    const { error: updateError } = await supabase
      .from("blog_posts")
      .update({ status: STATUS.FACT_CHECKING })
      .eq("id", blogPost.id);
      
    if (updateError) {
      throw new Error(`Failed to update blog post status to fact checking: ${updateError.message}`);
    }

    // Call the fact-check-post function
    console.log(`Calling fact-check-post function for post ${blogPost.id}`);
    const factCheckResponse = await fetch(
      `${supabaseUrl}/functions/v1/fact-check-post`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ 
          postId: blogPost.id,
          content: blogPost.content 
        })
      }
    );

    // Check for HTTP errors
    if (!factCheckResponse.ok) {
      throw new Error(`Fact check request failed with status: ${factCheckResponse.status} - ${factCheckResponse.statusText}`);
    }

    // Parse the response
    const factCheckResult = await factCheckResponse.json();
    console.log(`Fact check response received for post ${blogPost.id}`);

    // Check for API-level errors
    if (!factCheckResult.success) {
      throw new Error(`Fact check API error: ${factCheckResult.error || 'Unknown error'}`);
    }

    // Handle the fact check issues
    const issues = factCheckResult.issues || [];
    const hasCriticalIssues = issues.some((issue: any) => {
      const explanation = (issue.explanation || "").toLowerCase();
      return explanation.includes("incorrect") || 
             explanation.includes("false") || 
             explanation.includes("misleading");
    });

    // Update blog post status based on fact check results
    let newStatus = STATUS.COMPLETED;
    if (hasCriticalIssues) {
      console.log(`Critical issues found in post ${blogPost.id}`);
      newStatus = STATUS.FACT_CHECK_ISSUES_FOUND;
    } else if (issues.length > 0) {
      console.log(`Minor issues found in post ${blogPost.id}`);
      newStatus = STATUS.FACT_CHECK_ISSUES_FOUND;
    } else {
      console.log(`No issues found in post ${blogPost.id}`);
    }

    // Update the blog post status
    const { error: finalUpdateError } = await supabase
      .from("blog_posts")
      .update({ status: newStatus })
      .eq("id", blogPost.id);
      
    if (finalUpdateError) {
      throw new Error(`Failed to update blog post final status: ${finalUpdateError.message}`);
    }

    console.log(`Fact check completed for blog post: ${blogPost.id}`);
    return { success: true, issues };
  } catch (error) {
    console.error(`Error in processFactCheck: ${error.message}`);
    
    // Update blog post status to completed even if fact check failed
    try {
      const { error: updateError } = await supabase
        .from("blog_posts")
        .update({ status: STATUS.COMPLETED })
        .eq("id", blogPost.id);
        
      if (updateError) {
        console.error(`Failed to update blog post status after fact check failure: ${updateError.message}`);
      }
      
      // Create an empty fact check result to indicate it was attempted
      const { error: insertError } = await supabase
        .from("fact_check_results")
        .insert({
          post_id: blogPost.id,
          issues: [],
          checked_at: new Date().toISOString(),
        });
        
      if (insertError) {
        console.error(`Failed to insert empty fact check result: ${insertError.message}`);
      }
    } catch (cleanupError) {
      console.error(`Error during cleanup after fact check failure: ${cleanupError.message}`);
    }
    
    throw error;
  }
}
