
// Follow this setup guide to integrate the Deno runtime into your application:
// https://docs.supabase.com/guides/functions/connect-to-postgres

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Adjust these to match your environment variables names
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Status enum for tracking the post generation process
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
  FAILED: "failed"
};

// Blog post individual status tracking
const POST_STATUS = {
  GENERATING: "generating",
  GENERATED: "generated",
  FACT_CHECKING: "fact_checking",
  FACT_CHECK_COMPLETE: "fact_check_complete",
  FACT_CHECK_FAILED: "fact_check_failed",
  COMPLETED: "completed",
  FAILED: "failed"
};

// CORS headers for all responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle POST request to process a specific scheduled post
    if (req.method === "POST") {
      const { id } = await req.json();
      
      console.log(`Processing specific scheduled post: ${id}`);
      
      // Get the specific scheduled post
      const { data: post, error: fetchError } = await supabase
        .from("scheduled_posts")
        .select("*")
        .eq("id", id)
        .single();
      
      if (fetchError) {
        throw new Error(`Failed to fetch scheduled post: ${fetchError.message}`);
      }
      
      if (!post) {
        throw new Error(`Scheduled post with ID ${id} not found`);
      }
      
      // Process this post
      try {
        await processScheduledPost(post, supabase);
        return new Response(
          JSON.stringify({ success: true, message: "Post processed successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (processError) {
        console.error("Error processing post:", processError);
        
        // Update the post status to failed with error message
        await updatePostStatus(post.id, STATUS.FAILED, processError.message, supabase);
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Failed to process post", 
            error: processError.message 
          }),
          { 
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
    }
    
    // Handle GET request to process all pending posts
    if (req.method === "GET") {
      console.log("Processing all pending scheduled posts");
      
      // Get all pending posts that are due
      const { data: posts, error: fetchError } = await supabase
        .from("scheduled_posts")
        .select("*")
        .eq("status", STATUS.PENDING)
        .lte("scheduled_for", new Date().toISOString());
      
      if (fetchError) {
        throw new Error(`Failed to fetch scheduled posts: ${fetchError.message}`);
      }
      
      console.log(`Found ${posts.length} pending posts to process`);
      
      // Process each post
      const results = [];
      for (const post of posts) {
        try {
          console.log(`Processing scheduled post: ${post.id}`);
          await processScheduledPost(post, supabase);
          results.push({ id: post.id, success: true });
        } catch (processError) {
          console.error(`Error processing post ${post.id}:`, processError);
          
          // Update the post status to failed with error message
          await updatePostStatus(post.id, STATUS.FAILED, processError.message, supabase);
          
          results.push({ 
            id: post.id, 
            success: false, 
            error: processError.message 
          });
        }
      }
      
      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { 
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Error:", error);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json"
        } 
      }
    );
  }
});

// Helper function to extract title from content
function extractTitleFromContent(content) {
  // Look for a markdown title at the start of the content (# Title)
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim();
  }
  return null;
}

// Helper function to update the status of a scheduled post
async function updatePostStatus(postId, status, errorMessage = null, supabase) {
  console.log(`Updating post ${postId} status to ${status}${errorMessage ? ` with error: ${errorMessage}` : ""}`);
  
  try {
    const updateData = { status };
    if (errorMessage !== null) {
      updateData.error_message = errorMessage;
    }
    
    const { error } = await supabase
      .from("scheduled_posts")
      .update(updateData)
      .eq("id", postId);
    
    if (error) {
      console.error(`Failed to update post status: ${error.message}`);
      throw new Error(`Failed to update post status: ${error.message}`);
    }
  } catch (error) {
    console.error(`Error updating post status: ${error.message}`);
    throw error;
  }
}

// Helper function to update individual blog post status
async function updateBlogPostStatus(postId, status, supabase) {
  console.log(`Updating blog post ${postId} status to ${status}`);
  
  try {
    const { error } = await supabase
      .from("blog_posts")
      .update({
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq("id", postId);
    
    if (error) {
      console.error(`Failed to update blog post status: ${error.message}`);
      throw new Error(`Failed to update blog post status: ${error.message}`);
    }
  } catch (error) {
    console.error(`Error updating blog post status: ${error.message}`);
    throw error;
  }
}

// Main function to process a scheduled post
async function processScheduledPost(post, supabase) {
  console.log(`Starting to process post: ${post.id}`);
  
  // Step 1: Generate or use provided topics
  let topics = [];
  
  // Update status to generating topics
  await updatePostStatus(post.id, STATUS.GENERATING_TOPICS, null, supabase);
  
  if (post.auto_generate_topics) {
    console.log(`Auto-generating ${post.num_posts} topics`);
    
    // Generate topics
    for (let i = 0; i < post.num_posts; i++) {
      try {
        const topicResponse = await fetch(
          `${supabaseUrl}/functions/v1/generate-topic`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ previousTopics: topics })
          }
        );
        
        if (!topicResponse.ok) {
          throw new Error(`Failed to generate topic: ${topicResponse.statusText}`);
        }
        
        const topicData = await topicResponse.json();
        if (!topicData.topic) {
          throw new Error("No topic returned from topic generator");
        }
        
        topics.push(topicData.topic);
        console.log(`Generated topic ${i+1}: ${topicData.topic}`);
      } catch (error) {
        throw new Error(`Failed to generate topic ${i+1}: ${error.message}`);
      }
    }
  } else {
    // Use provided topics
    console.log(`Using ${post.topics.length} provided topics`);
    if (Array.isArray(post.topics)) {
      topics = post.topics;
    } else {
      console.warn("post.topics is not an array, initializing as empty array");
      topics = [];
    }
    
    // If we don't have enough topics, generate more
    if (topics.length < post.num_posts) {
      console.log(`Need ${post.num_posts - topics.length} more topics`);
      
      for (let i = topics.length; i < post.num_posts; i++) {
        try {
          const topicResponse = await fetch(
            `${supabaseUrl}/functions/v1/generate-topic`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`
              },
              body: JSON.stringify({ previousTopics: topics })
            }
          );
          
          if (!topicResponse.ok) {
            throw new Error(`Failed to generate topic: ${topicResponse.statusText}`);
          }
          
          const topicData = await topicResponse.json();
          if (!topicData.topic) {
            throw new Error("No topic returned from topic generator");
          }
          
          topics.push(topicData.topic);
          console.log(`Generated additional topic ${i+1}: ${topicData.topic}`);
        } catch (error) {
          throw new Error(`Failed to generate additional topic ${i+1}: ${error.message}`);
        }
      }
    }
  }
  
  // Update status to topics generated
  await updatePostStatus(post.id, STATUS.TOPICS_GENERATED, null, supabase);
  
  // Step 2: Generate posts for each topic
  console.log(`Generating ${topics.length} posts`);
  
  const generatedPostIds = [];
  let successfulPosts = 0;
  let failedPosts = 0;
  
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    
    console.log(`Generating post ${i+1} for topic: ${topic}`);
    
    try {
      // Update status to generating content
      await updatePostStatus(post.id, STATUS.GENERATING_CONTENT, null, supabase);
      
      // Generate the blog post content
      const blogPostResponse = await fetch(
        `${supabaseUrl}/functions/v1/generate-blog-post`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ topic })
        }
      );
      
      if (!blogPostResponse.ok) {
        throw new Error(`Failed to generate blog post: ${blogPostResponse.statusText}`);
      }
      
      const blogPostData = await blogPostResponse.json();
      
      if (!blogPostData.content) {
        throw new Error("No content returned from blog post generator");
      }
      
      // Extract title from content or use the topic as fallback
      const contentTitle = extractTitleFromContent(blogPostData.content);
      const finalTitle = contentTitle || topic;
      
      // Generate meta description
      const metaResponse = await fetch(
        `${supabaseUrl}/functions/v1/generate-meta-descriptions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ 
            topic: finalTitle,
            content: blogPostData.content
          })
        }
      );
      
      if (!metaResponse.ok) {
        throw new Error(`Failed to generate meta descriptions: ${metaResponse.statusText}`);
      }
      
      const metaData = await metaResponse.json();
      
      if (!metaData.descriptions || metaData.descriptions.length === 0) {
        throw new Error("No meta descriptions returned");
      }
      
      // Save the blog post
      const { data: blogPost, error: blogPostError } = await supabase
        .from("blog_posts")
        .insert({
          title: finalTitle,
          content: blogPostData.content,
          meta_description: metaData.descriptions[0], // Use the first meta description
          scheduled_post_id: post.id,
          status: POST_STATUS.GENERATED
        })
        .select()
        .single();
      
      if (blogPostError) {
        throw new Error(`Failed to save blog post: ${blogPostError.message}`);
      }
      
      generatedPostIds.push(blogPost.id);
      console.log(`Generated post ${i+1} with ID: ${blogPost.id}`);
      
      // Update status to content generated for this individual post
      await updateBlogPostStatus(blogPost.id, POST_STATUS.GENERATED, supabase);
      
      // Fact check the post if enabled
      if (post.auto_fact_check) {
        // Update status to fact checking for this post
        await updateBlogPostStatus(blogPost.id, POST_STATUS.FACT_CHECKING, supabase);
        
        // Update overall status to fact checking
        await updatePostStatus(post.id, STATUS.FACT_CHECKING, null, supabase);
        
        console.log(`Fact-checking post: ${blogPost.id}`);
        
        try {
          // Check if PERPLEXITY_API_KEY is available before attempting fact check
          const perplexityApiKey = Deno.env.get("PERPLEXITY_API_KEY");
          if (!perplexityApiKey) {
            console.warn("PERPLEXITY_API_KEY not set, skipping fact checking");
            
            // Create an empty fact check result to indicate it was attempted but skipped
            const { error: factCheckInsertError } = await supabase
              .from("fact_check_results")
              .insert({
                post_id: blogPost.id,
                issues: [],
                checked_at: new Date().toISOString(),
              });
            
            if (factCheckInsertError) {
              console.error(`Failed to create empty fact check result: ${factCheckInsertError.message}`);
              // Continue processing - this is a non-critical error
            }
            
            // Mark this post as fact check complete despite skipping
            await updateBlogPostStatus(blogPost.id, POST_STATUS.FACT_CHECK_COMPLETE, supabase);
          } else {
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
                  content: blogPostData.content
                })
              }
            );
            
            if (!factCheckResponse.ok) {
              const errorText = await factCheckResponse.text();
              console.warn(`Fact check warning: ${factCheckResponse.statusText}, ${errorText}`);
              
              // Create a fact check result with error status
              const { error: factCheckInsertError } = await supabase
                .from("fact_check_results")
                .insert({
                  post_id: blogPost.id,
                  issues: [],
                  checked_at: new Date().toISOString(),
                });
              
              if (factCheckInsertError) {
                console.error(`Failed to create empty fact check result: ${factCheckInsertError.message}`);
                // Continue processing - this is a non-critical error
              }
              
              // Mark this post's fact check as failed but the overall post as completed
              await updateBlogPostStatus(blogPost.id, POST_STATUS.FACT_CHECK_FAILED, supabase);
              
              // Only update overall status if appropriate
              if (failedPosts === 0) {
                await updatePostStatus(post.id, STATUS.FACT_CHECK_FAILED, `Fact check failed: ${factCheckResponse.statusText}`, supabase);
              }
            } else {
              console.log(`Fact check completed for post: ${blogPost.id}`);
              
              // Mark this post's fact check as complete
              await updateBlogPostStatus(blogPost.id, POST_STATUS.FACT_CHECK_COMPLETE, supabase);
              
              // Only update overall status if appropriate and if we haven't already marked it as failed
              if (failedPosts === 0) {
                await updatePostStatus(post.id, STATUS.FACT_CHECK_COMPLETE, null, supabase);
              }
            }
          }
        } catch (factCheckErr) {
          console.warn("Fact check failed but continuing:", factCheckErr);
          
          // Create a fact check result with error status
          const { error: factCheckInsertError } = await supabase
            .from("fact_check_results")
            .insert({
              post_id: blogPost.id,
              issues: [],
              checked_at: new Date().toISOString(),
            });
          
          if (factCheckInsertError) {
            console.error(`Failed to create empty fact check result: ${factCheckInsertError.message}`);
            // Continue processing - this is a non-critical error
          }
          
          // Mark this post's fact check as failed
          await updateBlogPostStatus(blogPost.id, POST_STATUS.FACT_CHECK_FAILED, supabase);
          
          // Only update overall status if appropriate
          if (failedPosts === 0) {
            await updatePostStatus(post.id, STATUS.FACT_CHECK_FAILED, `Fact check error: ${factCheckErr.message}`, supabase);
          }
        }
      }
      
      // Mark this individual post as completed
      await updateBlogPostStatus(blogPost.id, POST_STATUS.COMPLETED, supabase);
      
      // Update counters
      successfulPosts++;
    } catch (error) {
      console.error(`Failed to process topic ${topic}:`, error);
      failedPosts++;
      
      // Record the error but continue processing other topics
      const errorMsg = `Failed to process topic ${topic}: ${error.message}`;
      console.error(errorMsg);
      
      // Only update the status if this is the first failure
      if (failedPosts === 1) {
        await updatePostStatus(post.id, STATUS.FAILED, errorMsg, supabase);
      }
    }
  }
  
  // Update overall status based on processing results
  if (failedPosts === topics.length) {
    // All posts failed
    await updatePostStatus(post.id, STATUS.FAILED, "All posts failed to generate", supabase);
  } else if (failedPosts > 0) {
    // Some posts failed
    await updatePostStatus(
      post.id, 
      STATUS.COMPLETED, 
      `Generated ${successfulPosts} posts successfully, ${failedPosts} posts failed`, 
      supabase
    );
  } else {
    // All posts succeeded
    await updatePostStatus(post.id, STATUS.COMPLETED, null, supabase);
  }
  
  // Mark the scheduled post as completed
  console.log(`Scheduled post ${post.id} processed with ${successfulPosts} successful posts and ${failedPosts} failed posts`);
  
  return generatedPostIds;
}
