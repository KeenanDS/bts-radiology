
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Database } from "../_shared/database-types.ts";

console.log("Process Scheduled Posts function started...");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Processing scheduled posts...");
  
  try {
    // Get current time
    const now = new Date();
    
    // Find all pending posts that are scheduled for now or earlier
    const { data: scheduledPosts, error: fetchError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now.toISOString())
      .order('scheduled_for', { ascending: true });
    
    if (fetchError) {
      throw fetchError;
    }
    
    console.log(`Found ${scheduledPosts?.length || 0} scheduled posts to process`);
    
    // Process each post
    if (scheduledPosts && scheduledPosts.length > 0) {
      for (const post of scheduledPosts) {
        console.log(`Processing scheduled post ${post.id} for ${post.scheduled_for}`);
        
        try {
          // Update status to processing
          await supabase
            .from('scheduled_posts')
            .update({ status: 'processing' })
            .eq('id', post.id);
          
          // For each post to generate based on num_posts
          for (let i = 0; i < post.num_posts; i++) {
            console.log(`Generating post ${i + 1} of ${post.num_posts}`);
            
            // Determine topic
            let topic: string;
            if (post.auto_generate_topics) {
              // Auto-generate topic using edge function
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
                throw new Error(`Failed to generate topic: ${generateTopicResponse.statusText}`);
              }
              
              const topicData = await generateTopicResponse.json();
              topic = topicData.topic;
            } else {
              // Use provided topics if available, otherwise generate
              const topics = post.topics as string[] || [];
              if (topics && topics[i]) {
                topic = topics[i];
              } else {
                // If we've used up all provided topics, generate a new one
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
                  throw new Error(`Failed to generate topic: ${generateTopicResponse.statusText}`);
                }
                
                const topicData = await generateTopicResponse.json();
                topic = topicData.topic;
              }
            }
            
            console.log(`Using topic: ${topic}`);
            
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
              throw new Error(`Failed to generate blog post: ${generateResponse.statusText}`);
            }
            
            const generatedData = await generateResponse.json();
            
            // Insert the blog post
            const { data: blogPostData, error: blogPostError } = await supabase
              .from('blog_posts')
              .insert({
                title: generatedData.title,
                content: generatedData.content,
                scheduled_post_id: post.id
              })
              .select()
              .single();
            
            if (blogPostError) {
              throw blogPostError;
            }
            
            console.log(`Created blog post with id: ${blogPostData.id}`);
            
            // Fact-check if enabled
            if (post.auto_fact_check) {
              console.log(`Fact-checking post: ${blogPostData.id}`);
              
              await fetch(
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
            }
          }
          
          // Mark scheduled post as completed
          await supabase
            .from('scheduled_posts')
            .update({ 
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', post.id);
          
          console.log(`Completed processing scheduled post ${post.id}`);
        } catch (err) {
          console.error(`Error processing scheduled post ${post.id}:`, err);
          
          // Mark as failed with error message
          await supabase
            .from('scheduled_posts')
            .update({ 
              status: 'failed',
              error_message: err instanceof Error ? err.message : String(err)
            })
            .eq('id', post.id);
        }
      }
    }
    
    return new Response(
      JSON.stringify({ 
        processed: scheduledPosts?.length || 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (err) {
    console.error("Error in process-scheduled-posts function:", err);
    
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
