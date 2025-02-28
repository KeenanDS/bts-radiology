
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Generate a set of topics
async function generateTopics(count: number = 1): Promise<string[]> {
  try {
    console.log(`Generating ${count} topic(s)...`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-topic`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ count }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error from generate-topic: ${response.status} ${errorText}`);
      throw new Error(`Failed to generate topics: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Topic generation response:', data);
    
    // IMPROVED: Better validation of the response format
    if (!data || !data.topics || !Array.isArray(data.topics)) {
      console.error('Unexpected response format from generate-topic:', data);
      throw new Error('Invalid response format from topic generator');
    }
    
    const validTopics = data.topics.filter(topic => topic && typeof topic === 'string');
    
    if (validTopics.length === 0) {
      console.error('No valid topics received from generator');
      throw new Error('No valid topics received from generator');
    }
    
    console.log(`Successfully generated ${validTopics.length} topic(s):`, validTopics);
    return validTopics;
  } catch (error) {
    console.error('Error in generateTopics:', error);
    throw error;
  }
}

// Generate a blog post for a given topic
async function generateBlogPost(topic: string, scheduledPostId: string): Promise<{ id: string; title: string }> {
  try {
    console.log(`Generating blog post for topic: "${topic}"`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-blog-post`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ topic, scheduledPostId }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error from generate-blog-post: ${response.status} ${errorText}`);
      throw new Error(`Failed to generate blog post: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`Successfully generated blog post with ID: ${data.id} for topic: "${topic}"`);
    
    return { id: data.id, title: topic };
  } catch (error) {
    console.error(`Error generating blog post for topic "${topic}":`, error);
    throw error;
  }
}

// Handle a single scheduled post
async function processScheduledPost(post: any): Promise<void> {
  console.log(`Processing scheduled post with ID: ${post.id}`);
  
  try {
    // Update the post status to "processing"
    await supabase
      .from('scheduled_posts')
      .update({ status: 'processing' })
      .eq('id', post.id);
    
    // Generate topics if needed
    let generatedTopics: string[] = [];
    
    // IMPROVED: Better handling of existing topics
    if (post.topics && Array.isArray(post.topics) && post.topics.length > 0) {
      console.log(`Using ${post.topics.length} existing topics from scheduled post`);
      generatedTopics = post.topics;
    } else if (post.auto_generate_topics) {
      console.log('No existing topics found, generating new topics');
      try {
        // Try up to 3 times to generate topics
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            console.log(`Topic generation attempt ${attempt}/3`);
            generatedTopics = await generateTopics(post.num_posts * 2); // Generate extra topics in case some fail
            break; // If successful, exit the retry loop
          } catch (error) {
            if (attempt === 3) throw error; // On the last attempt, rethrow
            console.error(`Attempt ${attempt} failed, retrying...`);
          }
        }
        
        // Save the generated topics back to the post
        await supabase
          .from('scheduled_posts')
          .update({ topics: generatedTopics })
          .eq('id', post.id);
          
        console.log(`Saved ${generatedTopics.length} topics to scheduled post`);
      } catch (error) {
        console.error('All topic generation attempts failed:', error);
        throw new Error(`Failed to generate topics after multiple attempts: ${error.message}`);
      }
    } else {
      console.error('No topics provided and auto-generation disabled');
      throw new Error('No topics provided and auto-generation disabled');
    }
    
    if (generatedTopics.length === 0) {
      throw new Error('No topics available for post generation');
    }
    
    // Generate blog posts for each topic
    const blogPosts = [];
    const topicsToUse = generatedTopics.slice(0, post.num_posts);
    
    console.log(`Attempting to generate ${topicsToUse.length} blog posts`);
    
    for (const topic of topicsToUse) {
      try {
        const blogPost = await generateBlogPost(topic, post.id);
        blogPosts.push(blogPost);
        console.log(`Successfully generated post for topic "${topic}"`);
      } catch (error) {
        console.error(`Error generating post for topic "${topic}": ${error.message}`);
      }
    }
    
    if (blogPosts.length === 0) {
      throw new Error("Failed to generate any blog posts");
    }
    
    // Update the post status to "completed"
    await supabase
      .from('scheduled_posts')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', post.id);
      
    console.log(`Successfully completed scheduled post with ID: ${post.id}`);
    console.log(`Generated ${blogPosts.length} out of ${post.num_posts} requested posts`);
    
    // If auto fact check is enabled, queue up fact check jobs
    if (post.auto_fact_check) {
      console.log(`Auto fact-checking enabled for post ID: ${post.id}, will be performed separately`);
    }
  } catch (error) {
    console.error(`Error processing scheduled post ${post.id}:`, error);
    
    // Update the post status to "failed"
    await supabase
      .from('scheduled_posts')
      .update({ 
        status: 'failed',
        error_message: error.message || 'Unknown error'
      })
      .eq('id', post.id);
  }
}

// Main function handler
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  console.log('Processing scheduled posts function triggered');
  
  try {
    // Get scheduled posts that need to be processed
    const now = new Date().toISOString();
    
    const { data: posts, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now);
      
    if (error) {
      throw error;
    }
    
    console.log(`Found ${posts.length} scheduled posts to process`);
    
    // Process each post
    if (posts.length > 0) {
      for (const post of posts) {
        await processScheduledPost(post);
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: `Processed ${posts.length} scheduled posts` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No scheduled posts to process' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in process-scheduled-posts function:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
