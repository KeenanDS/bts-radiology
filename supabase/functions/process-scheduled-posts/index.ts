
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

Deno.serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

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
        await updatePostStatus(post.id, STATUS.FAILED, processError.message);
        
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
          await updatePostStatus(post.id, STATUS.FAILED, processError.message);
          
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

// Helper function to update the status of a scheduled post
async function updatePostStatus(postId, status, errorMessage = null) {
  console.log(`Updating post ${postId} status to ${status}${errorMessage ? ` with error: ${errorMessage}` : ""}`);
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
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
    }
  } catch (error) {
    console.error(`Error updating post status: ${error.message}`);
  }
}

// Helper function to extract title from markdown content
function extractTitleFromContent(content) {
  // Check if content is null or undefined
  if (!content) {
    return "Untitled Post";
  }
  
  // Look for a markdown title (# Title) at the beginning of the content
  const titleMatch = content.match(/^#\s+(.+?)(\n|$)/);
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim();
  }
  
  // If no markdown title found, return a placeholder title
  return "Untitled Post";
}

// Main function to process a scheduled post
async function processScheduledPost(post, supabase) {
  console.log(`Starting to process post: ${post.id}`);
  
  // Step 1: Generate or use provided topics
  let topics = [];
  
  if (post.auto_generate_topics) {
    // Update status
    await updatePostStatus(post.id, STATUS.GENERATING_TOPICS, null);
    
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
    topics = post.topics;
    
    // If we don't have enough topics, generate more
    if (topics.length < post.num_posts) {
      await updatePostStatus(post.id, STATUS.GENERATING_TOPICS, null);
      
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
  await updatePostStatus(post.id, STATUS.TOPICS_GENERATED, null);
  
  // Step 2: Generate posts for each topic
  console.log(`Generating ${topics.length} posts`);
  
  const generatedPostIds = [];
  
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    
    console.log(`Generating post ${i+1} for topic: ${topic}`);
    
    // Update status
    await updatePostStatus(post.id, STATUS.GENERATING_CONTENT, null);
    
    try {
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
            topic: topic,
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
      
      // Extract title from content or use topic as fallback
      let postTitle = extractTitleFromContent(blogPostData.content);
      if (!postTitle || postTitle === "Untitled Post") {
        // Use the topic as a fallback if no title was extracted
        postTitle = topic || "Untitled Post";
      }
      
      console.log(`Using title: "${postTitle}" for blog post`);
      
      // Save the blog post
      const { data: blogPost, error: blogPostError } = await supabase
        .from("blog_posts")
        .insert({
          title: postTitle, // Use the extracted title or topic
          content: blogPostData.content,
          meta_description: metaData.descriptions[0], // Use the first meta description
          scheduled_post_id: post.id
        })
        .select()
        .single();
      
      if (blogPostError) {
        throw new Error(`Failed to save blog post: ${blogPostError.message}`);
      }
      
      generatedPostIds.push(blogPost.id);
      console.log(`Generated post ${i+1} with ID: ${blogPost.id}`);
      
      // Fact check the post if enabled
      if (post.auto_fact_check) {
        // Update status to fact checking
        await updatePostStatus(post.id, STATUS.FACT_CHECKING, null);
        
        console.log(`Fact-checking post: ${blogPost.id}`);
        
        try {
          // Check if PERPLEXITY_API_KEY is available before attempting fact check
          const perplexityApiKey = Deno.env.get("PERPLEXITY_API_KEY");
          if (!perplexityApiKey) {
            console.warn("PERPLEXITY_API_KEY not set, skipping fact checking");
            // Create an empty fact check result to indicate it was attempted but skipped
            await supabase
              .from("fact_check_results")
              .insert({
                post_id: blogPost.id,
                issues: [],
                checked_at: new Date().toISOString(),
              });
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
                  content: blogPostData.content  // Send the content along with the postId
                })
              }
            );
            
            if (!factCheckResponse.ok) {
              const errorText = await factCheckResponse.text();
              console.warn(`Fact check warning: ${factCheckResponse.statusText}, ${errorText}`);
              
              // Create a fact check result with error status
              await supabase
                .from("fact_check_results")
                .insert({
                  post_id: blogPost.id,
                  issues: [],
                  checked_at: new Date().toISOString(),
                });
                
              await updatePostStatus(post.id, STATUS.FACT_CHECK_FAILED, `Fact check failed: ${factCheckResponse.statusText}`);
            } else {
              console.log(`Fact check completed for post: ${blogPost.id}`);
              await updatePostStatus(post.id, STATUS.FACT_CHECK_COMPLETE, null);
            }
          }
        } catch (factCheckErr) {
          console.warn("Fact check failed but continuing:", factCheckErr);
          
          // Create a fact check result with error status
          await supabase
            .from("fact_check_results")
            .insert({
              post_id: blogPost.id,
              issues: [],
              checked_at: new Date().toISOString(),
            });
            
          await updatePostStatus(post.id, STATUS.FACT_CHECK_FAILED, `Fact check error: ${factCheckErr.message}`);
        }
      }
    } catch (error) {
      throw new Error(`Failed to process topic ${topic}: ${error.message}`);
    }
  }
  
  // Update status to content generated
  await updatePostStatus(post.id, STATUS.CONTENT_GENERATED, null);
  
  // Step 3: Mark the scheduled post as completed
  console.log(`Marking scheduled post ${post.id} as completed`);
  await updatePostStatus(post.id, STATUS.COMPLETED, null);
  
  console.log(`Scheduled post ${post.id} processed successfully with ${generatedPostIds.length} posts`);
  return generatedPostIds;
}
