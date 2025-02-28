import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Database } from "../_shared/database-types.ts";

// Constants for status
const STATUS = {
  PENDING: "pending",
  GENERATING_TOPICS: "generating_topics",
  TOPICS_GENERATED: "topics_generated",
  GENERATING_CONTENT: "generating_content",
  CONTENT_GENERATED: "content_generated",
  FACT_CHECKING: "fact_checking",
  FACT_CHECK_COMPLETE: "fact_check_complete",
  FACT_CHECK_FAILED: "fact_check_failed",
  COMPLETED: "completed",
  FAILED: "failed",
};

// Constants for individual blog post status
const POST_STATUS = {
  GENERATING: "generating",
  GENERATED: "generated",
  FACT_CHECKING: "fact_checking",
  FACT_CHECK_COMPLETE: "fact_check_complete",
  FACT_CHECK_FAILED: "fact_check_failed",
  COMPLETED: "completed",
  FAILED: "failed",
};

// Environment variables from Supabase
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Create Supabase client
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS for browser requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { trigger_source } = await req.json();
    const now = new Date();
    
    console.log(`Processing scheduled posts, triggered by: ${trigger_source}`);

    // Get all pending posts that are scheduled for now or earlier
    const { data: scheduledPosts, error: fetchError } = await supabase
      .from("scheduled_posts")
      .select("*")
      .eq("status", STATUS.PENDING)
      .lte("scheduled_for", now.toISOString())
      .order("scheduled_for", { ascending: true });

    if (fetchError) {
      throw new Error(`Error fetching scheduled posts: ${fetchError.message}`);
    }

    if (!scheduledPosts || scheduledPosts.length === 0) {
      console.log("No pending scheduled posts found.");
      return new Response(
        JSON.stringify({ processed: 0, message: "No pending posts to process" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log(`Found ${scheduledPosts.length} scheduled posts to process.`);
    
    let totalProcessed = 0;
    
    // Process each scheduled post
    for (const post of scheduledPosts) {
      try {
        console.log(`Processing scheduled post ID: ${post.id}`);
        
        // Step 1: Update status to GENERATING_TOPICS
        await updatePostStatus(post.id, STATUS.GENERATING_TOPICS, null);
        
        // Generate or use provided topics
        const topics = await getTopics(post);
        
        // Step.2: Update topics and status to TOPICS_GENERATED
        await updateScheduledPost(post.id, {
          topics,
          status: STATUS.TOPICS_GENERATED
        });
        
        // Keep track of created blog posts and their statuses
        const blogPostIds = [];
        let hasFailures = false;
        
        // Step 3: Generate blog posts
        for (let i = 0; i < post.num_posts; i++) {
          try {
            // Update status to GENERATING_CONTENT
            await updatePostStatus(post.id, STATUS.GENERATING_CONTENT, null);
            
            // Select a topic from the list
            const topic = topics[i % topics.length];
            console.log(`Generating blog post ${i + 1}/${post.num_posts} on topic: ${topic}`);
            
            // Generate blog post
            const generatedPost = await generateBlogPost(topic);
            
            if (!generatedPost || !generatedPost.content) {
              throw new Error(`Failed to generate blog post for topic: ${topic}`);
            }
            
            // Extract title from content
            const title = extractTitleFromContent(generatedPost.content, topic);
            
            // Insert blog post into database with the status
            const { data: blogPost, error: insertError } = await supabase
              .from("blog_posts")
              .insert({
                title: title,
                content: generatedPost.content,
                meta_description: generatedPost.meta_description || null,
                scheduled_post_id: post.id,
                status: POST_STATUS.GENERATED,
              })
              .select()
              .single();
            
            if (insertError || !blogPost) {
              throw new Error(`Error inserting blog post: ${insertError?.message || "Unknown error"}`);
            }
            
            blogPostIds.push(blogPost.id);
            
            // Update status to CONTENT_GENERATED
            await updatePostStatus(post.id, STATUS.CONTENT_GENERATED, null);
            
            // Step 4: Fact check if enabled
            if (post.auto_fact_check) {
              try {
                // Update post to fact checking status
                await supabase
                  .from("blog_posts")
                  .update({ status: POST_STATUS.FACT_CHECKING })
                  .eq("id", blogPost.id);
                
                // Update scheduled post status
                await updatePostStatus(post.id, STATUS.FACT_CHECKING, null);
                
                // Perform fact check
                const factCheckResult = await factCheckPost(blogPost.id, blogPost.title, blogPost.content);
                
                if (factCheckResult.success) {
                  // Update blog post status
                  await supabase
                    .from("blog_posts")
                    .update({ status: POST_STATUS.FACT_CHECK_COMPLETE })
                    .eq("id", blogPost.id);
                } else {
                  // Mark as fact check failed but continue
                  await supabase
                    .from("blog_posts")
                    .update({ status: POST_STATUS.FACT_CHECK_FAILED })
                    .eq("id", blogPost.id);
                    
                  console.log(`Fact check failed for blog post ID: ${blogPost.id}`);
                  // We continue processing, not treating this as a total failure
                }
              } catch (factCheckError) {
                console.error(`Fact check error for post ${blogPost.id}: ${factCheckError.message}`);
                
                // Mark the post as failed fact check but continue
                await supabase
                  .from("blog_posts")
                  .update({ status: POST_STATUS.FACT_CHECK_FAILED })
                  .eq("id", blogPost.id);
                  
                // Create an empty fact check result to indicate the check was attempted
                await supabase
                  .from("fact_check_results")
                  .insert({
                    post_id: blogPost.id,
                    issues: [],
                    checked_at: new Date().toISOString(),
                  });
              }
            } else {
              // No fact check needed, mark as completed
              await supabase
                .from("blog_posts")
                .update({ status: POST_STATUS.COMPLETED })
                .eq("id", blogPost.id);
            }
            
          } catch (postError) {
            console.error(`Error generating post ${i + 1}: ${postError.message}`);
            hasFailures = true;
          }
        }
        
        // Step 5: Mark scheduled post as completed
        const finalStatus = hasFailures ? STATUS.FAILED : STATUS.COMPLETED;
        await updatePostStatus(post.id, finalStatus, null);
        
        totalProcessed++;
        
      } catch (processError) {
        console.error(`Error processing scheduled post ${post.id}: ${processError.message}`);
        
        // Mark the scheduled post as failed
        await updatePostStatus(
          post.id, 
          STATUS.FAILED, 
          `Processing error: ${processError.message}`
        );
      }
    }
    
    // Return response with processed count
    return new Response(
      JSON.stringify({ 
        processed: totalProcessed,
        message: `Processed ${totalProcessed} scheduled posts` 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
    
  } catch (error) {
    console.error(`Global error: ${error.message}`);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

// Helper function to update scheduled post status
async function updatePostStatus(id: string, status: string, errorMessage: string | null) {
  const updates: any = { status };
  
  if (errorMessage !== null) {
    updates.error_message = errorMessage;
  }
  
  const { error } = await supabase
    .from("scheduled_posts")
    .update(updates)
    .eq("id", id);
    
  if (error) {
    console.error(`Error updating post status: ${error.message}`);
    throw error;
  }
}

// Helper function to update multiple fields in a scheduled post
async function updateScheduledPost(id: string, updates: any) {
  const { error } = await supabase
    .from("scheduled_posts")
    .update(updates)
    .eq("id", id);
    
  if (error) {
    console.error(`Error updating scheduled post: ${error.message}`);
    throw error;
  }
}

// Function to generate or fetch topics
async function getTopics(post: any) {
  try {
    // If auto-generate is disabled, use provided topics
    if (!post.auto_generate_topics && post.topics && post.topics.length > 0) {
      console.log(`Using provided topics: ${post.topics.join(", ")}`);
      return post.topics;
    }
    
    // Otherwise, generate topics
    console.log("Auto-generating topics...");
    const numTopics = Math.max(post.num_posts, 3); // Get at least 3 topics
    const topics = [];
    
    for (let i = 0; i < numTopics; i++) {
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-topic`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({}),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate topic: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result && result.topic) {
        topics.push(result.topic);
      } else {
        throw new Error("Invalid topic generation response");
      }
    }
    
    if (topics.length === 0) {
      throw new Error("No topics could be generated");
    }
    
    console.log(`Generated topics: ${topics.join(", ")}`);
    return topics;
    
  } catch (error) {
    console.error(`Error generating topics: ${error.message}`);
    throw error;
  }
}

// Function to generate a blog post for a given topic
async function generateBlogPost(topic: string) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-blog-post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ topic }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to generate blog post: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result || !result.content) {
      throw new Error("Invalid blog post generation response");
    }
    
    console.log(`Successfully generated blog post content for topic: ${topic}`);
    return result;
    
  } catch (error) {
    console.error(`Error generating blog post: ${error.message}`);
    throw error;
  }
}

// Function to extract title from markdown content
function extractTitleFromContent(content: string, fallbackTopic: string): string {
  // Try to extract a title from the first # heading
  const titleMatch = content.match(/^#\s+(.+)$/m);
  
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim();
  }
  
  // If no title found, use the topic as the title
  return `Article about ${fallbackTopic}`;
}

// Function to fact check a blog post
async function factCheckPost(postId: string, title: string, content: string) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/fact-check-post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ title, content }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fact check post: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Create fact check record in database
    const { error: insertError } = await supabase
      .from("fact_check_results")
      .insert({
        post_id: postId,
        issues: result.issues || [],
        checked_at: new Date().toISOString(),
      });
      
    if (insertError) {
      throw new Error(`Error inserting fact check results: ${insertError.message}`);
    }
    
    return { 
      success: true,
      hasIssues: result.issues && result.issues.length > 0
    };
    
  } catch (error) {
    console.error(`Error fact checking post: ${error.message}`);
    return { success: false, error: error.message };
  }
}
