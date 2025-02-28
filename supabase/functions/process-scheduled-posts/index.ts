
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Database } from "../_shared/database-types.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Process Scheduled Posts function started...");

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing environment variables SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

// Improved status constants to track every stage of the process
const STATUS = {
  PENDING: 'pending',
  GENERATING_TOPICS: 'generating_topics',
  TOPICS_GENERATED: 'topics_generated',
  GENERATING_CONTENT: 'generating_content',
  CONTENT_GENERATED: 'content_generated',
  FACT_CHECKING: 'fact_checking',
  COMPLETED: 'completed',
  FAILED_TOPIC_GENERATION: 'failed_topic_generation',
  FAILED_CONTENT_GENERATION: 'failed_content_generation',
  FAILED_FACT_CHECK: 'failed_fact_check',
  FAILED: 'failed' // General failure
};

serve(async (req) => {
  console.log(`Request received: ${req.method}`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Processing scheduled posts...");
  
  try {
    let requestBody = {};
    try {
      requestBody = await req.json();
      console.log("Request body:", JSON.stringify(requestBody));
    } catch (e) {
      console.log("No request body or invalid JSON");
    }
    
    // Get current time
    const now = new Date();
    console.log(`Current time: ${now.toISOString()}`);
    
    // Find all pending posts that are scheduled for now or earlier
    const { data: scheduledPosts, error: fetchError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('status', STATUS.PENDING)
      .lte('scheduled_for', now.toISOString())
      .order('scheduled_for', { ascending: true });
    
    if (fetchError) {
      console.error("Error fetching scheduled posts:", fetchError);
      throw fetchError;
    }
    
    console.log(`Found ${scheduledPosts?.length || 0} scheduled posts to process`);
    
    // Track processed posts
    const results = [];
    
    // Process each post
    if (scheduledPosts && scheduledPosts.length > 0) {
      for (const post of scheduledPosts) {
        console.log(`Processing scheduled post ${post.id} for ${post.scheduled_for}`);
        
        try {
          // Update status to generating_topics
          await updatePostStatus(post.id, STATUS.GENERATING_TOPICS, null);
          
          const topicsToProcess = [];
          
          // For each post to generate based on num_posts
          for (let i = 0; i < post.num_posts; i++) {
            console.log(`Generating topic ${i + 1} of ${post.num_posts}`);
            
            try {
              // Determine topic
              let topic: string;
              if (post.auto_generate_topics) {
                // Auto-generate topic using edge function
                console.log("Auto-generating topic...");
                const generateTopicResponse = await fetch(
                  `${supabaseUrl}/functions/v1/generate-topic`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseServiceKey}`
                    }
                  }
                );
                
                if (!generateTopicResponse.ok) {
                  const errorText = await generateTopicResponse.text();
                  console.error(`Failed to generate topic: ${generateTopicResponse.statusText}, ${errorText}`);
                  throw new Error(`Failed to generate topic: ${generateTopicResponse.statusText}`);
                }
                
                const topicData = await generateTopicResponse.json();
                if (!topicData || !topicData.topic) {
                  console.error("Invalid topic data received:", topicData);
                  throw new Error("Topic generation failed: Invalid response format");
                }
                
                topic = topicData.topic;
                console.log(`Generated topic: ${topic}`);
              } else {
                // Use provided topics if available
                const topics = post.topics as string[] || [];
                if (topics && topics[i]) {
                  topic = topics[i];
                  console.log(`Using provided topic: ${topic}`);
                } else {
                  // If we've used up all provided topics, generate a new one
                  console.log("No more provided topics, generating a new one...");
                  const generateTopicResponse = await fetch(
                    `${supabaseUrl}/functions/v1/generate-topic`,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseServiceKey}`
                      }
                    }
                  );
                  
                  if (!generateTopicResponse.ok) {
                    const errorText = await generateTopicResponse.text();
                    console.error(`Failed to generate topic: ${generateTopicResponse.statusText}, ${errorText}`);
                    throw new Error(`Failed to generate topic: ${generateTopicResponse.statusText}`);
                  }
                  
                  const topicData = await generateTopicResponse.json();
                  if (!topicData || !topicData.topic) {
                    console.error("Invalid topic data received:", topicData);
                    throw new Error("Topic generation failed: Invalid response format");
                  }
                  
                  topic = topicData.topic;
                  console.log(`Generated topic: ${topic}`);
                }
              }
              
              // Add to topics to process
              topicsToProcess.push(topic);
            } catch (topicError) {
              console.error(`Error generating topic for post ${i + 1}:`, topicError);
              results.push({
                scheduledPostId: post.id,
                postIndex: i,
                status: STATUS.FAILED_TOPIC_GENERATION,
                error: topicError instanceof Error ? topicError.message : String(topicError)
              });
            }
          }
          
          if (topicsToProcess.length === 0) {
            throw new Error("Failed to generate any topics");
          }
          
          // Update status to topics generated
          await updatePostStatus(post.id, STATUS.TOPICS_GENERATED, null);
          console.log(`Generated ${topicsToProcess.length} topics for post ${post.id}`);
          
          // Process each topic to generate content
          for (let i = 0; i < topicsToProcess.length; i++) {
            const topic = topicsToProcess[i];
            try {
              // Update status to generating content
              await updatePostStatus(post.id, STATUS.GENERATING_CONTENT, null);
              
              console.log(`Generating content for topic: ${topic}`);
              
              // Generate content using the generate-blog-post function
              const generateResponse = await fetch(
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
              
              if (!generateResponse.ok) {
                const errorText = await generateResponse.text();
                console.error(`Failed to generate blog post: ${generateResponse.statusText}, ${errorText}`);
                throw new Error(`Failed to generate blog post: ${generateResponse.statusText}`);
              }
              
              const generatedData = await generateResponse.json();
              console.log("Blog post generation response:", JSON.stringify(generatedData).substring(0, 200) + "...");
              
              // Validate response data
              if (!generatedData) {
                throw new Error("Blog post generation failed: Empty response");
              }
              
              // Extract title from response or use the topic as fallback
              const title = generatedData.title || topic;
              const content = generatedData.content;
              
              if (!content) {
                throw new Error("Blog post generation failed: No content returned");
              }
              
              // Update status to content generated
              await updatePostStatus(post.id, STATUS.CONTENT_GENERATED, null);
              
              // Insert the blog post
              console.log(`Inserting blog post with title: "${title}"`);
              const { data: blogPostData, error: blogPostError } = await supabase
                .from('blog_posts')
                .insert({
                  title: title,
                  content: content,
                  scheduled_post_id: post.id
                })
                .select()
                .single();
              
              if (blogPostError) {
                console.error("Database error when inserting blog post:", blogPostError);
                throw blogPostError;
              }
              
              console.log(`Created blog post with id: ${blogPostData.id}`);
              
              // Fact-check if enabled
              if (post.auto_fact_check) {
                // Update status to fact checking
                await updatePostStatus(post.id, STATUS.FACT_CHECKING, null);
                
                console.log(`Fact-checking post: ${blogPostData.id}`);
                
                try {
                  const factCheckResponse = await fetch(
                    `${supabaseUrl}/functions/v1/fact-check-post`,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseServiceKey}`
                      },
                      body: JSON.stringify({ postId: blogPostData.id })
                    }
                  );
                  
                  if (!factCheckResponse.ok) {
                    const errorText = await factCheckResponse.text();
                    console.warn(`Fact check warning: ${factCheckResponse.statusText}, ${errorText}`);
                    // We don't throw here, just log the warning
                  } else {
                    console.log(`Fact check completed for post: ${blogPostData.id}`);
                  }
                } catch (factCheckErr) {
                  console.warn("Fact check failed but continuing:", factCheckErr);
                  // Don't throw here, just log the warning
                }
              }
              
              results.push({
                postId: blogPostData.id,
                title: blogPostData.title,
                status: 'generated'
              });
            } catch (contentErr) {
              console.error(`Error generating content for topic "${topic}":`, contentErr);
              results.push({
                scheduledPostId: post.id,
                topic: topic,
                status: STATUS.FAILED_CONTENT_GENERATION,
                error: contentErr instanceof Error ? contentErr.message : String(contentErr)
              });
            }
          }
          
          // Mark scheduled post as completed
          await updatePostStatus(post.id, STATUS.COMPLETED, null);
          
          console.log(`Completed processing scheduled post ${post.id}`);
        } catch (err) {
          console.error(`Error processing scheduled post ${post.id}:`, err);
          
          // Determine failure type for more specific error reporting
          let failureStatus = STATUS.FAILED;
          if (err instanceof Error) {
            if (err.message.includes("topic")) {
              failureStatus = STATUS.FAILED_TOPIC_GENERATION;
            } else if (err.message.includes("content") || err.message.includes("blog post")) {
              failureStatus = STATUS.FAILED_CONTENT_GENERATION;
            } else if (err.message.includes("fact")) {
              failureStatus = STATUS.FAILED_FACT_CHECK;
            }
          }
          
          // Mark as failed with error message
          await updatePostStatus(
            post.id, 
            failureStatus, 
            err instanceof Error ? err.message : String(err)
          );
            
          results.push({
            scheduledPostId: post.id,
            status: failureStatus,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
    }
    
    return new Response(
      JSON.stringify({ 
        processed: scheduledPosts?.length || 0,
        results: results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (err) {
    console.error("Error in process-scheduled-posts function:", err);
    
    return new Response(
      JSON.stringify({ 
        error: err instanceof Error ? err.message : String(err),
        details: err instanceof Error ? (err.stack || null) : null 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

// Helper function to update post status
async function updatePostStatus(postId: string, status: string, errorMessage: string | null) {
  console.log(`Updating post ${postId} status to: ${status}`);
  
  const updateData: Record<string, unknown> = { status };
  
  if (status === STATUS.COMPLETED) {
    updateData.completed_at = new Date().toISOString();
  }
  
  if (errorMessage !== null) {
    updateData.error_message = errorMessage;
  }
  
  const { error } = await supabase
    .from('scheduled_posts')
    .update(updateData)
    .eq('id', postId);
    
  if (error) {
    console.error(`Error updating post ${postId} status:`, error);
  }
}
