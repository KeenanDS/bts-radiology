
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.4.0";

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    console.log(`Processing scheduled posts for date: ${currentDate}`);

    // Fetch all pending scheduled posts for today or earlier
    const { data: scheduledPosts, error: fetchError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .lte('scheduled_for', currentDate)
      .eq('status', 'pending')
      .order('scheduled_for', { ascending: true });

    if (fetchError) {
      throw new Error(`Error fetching scheduled posts: ${fetchError.message}`);
    }

    console.log(`Found ${scheduledPosts?.length || 0} pending scheduled posts to process`);

    if (!scheduledPosts || scheduledPosts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No scheduled posts to process" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each scheduled post
    const results = [];
    
    for (const post of scheduledPosts) {
      console.log(`Processing scheduled post ID: ${post.id}`);
      
      try {
        // Update status to processing
        await supabase
          .from('scheduled_posts')
          .update({ status: 'processing' })
          .eq('id', post.id);
        
        // Generate topics if needed
        let topics = post.topics || [];
        
        if (post.auto_generate_topics || topics.length < post.num_posts) {
          const topicsToGenerate = post.num_posts - topics.length;
          
          if (topicsToGenerate > 0) {
            console.log(`Auto-generating ${topicsToGenerate} topics`);
            const generatedTopics = await generateTopics(topicsToGenerate);
            topics = [...topics, ...generatedTopics];
            
            // Update the topics in the scheduled post
            await supabase
              .from('scheduled_posts')
              .update({ topics })
              .eq('id', post.id);
          }
        }
        
        // Generate blog posts for each topic
        const generatedPosts = [];
        
        for (let i = 0; i < Math.min(post.num_posts, topics.length); i++) {
          const topic = topics[i];
          console.log(`Generating blog post for topic: ${topic}`);
          
          // Generate the blog post
          const content = await generateBlogPost(topic);
          
          // Generate meta descriptions
          const metaDescriptions = await generateMetaDescriptions(topic, content);
          
          // Save the blog post
          const { data: blogPost, error: insertError } = await supabase
            .from('blog_posts')
            .insert({
              title: topic,
              content: content,
              meta_description: metaDescriptions[0], // Use the first meta description
              scheduled_post_id: post.id
            })
            .select('id')
            .single();
            
          if (insertError) {
            throw new Error(`Error saving blog post: ${insertError.message}`);
          }
          
          generatedPosts.push(blogPost.id);
          
          // Run fact check if enabled
          if (post.auto_fact_check) {
            console.log(`Running fact check for post: ${blogPost.id}`);
            await runFactCheck(blogPost.id, content);
          }
        }
        
        // Update scheduled post status to completed
        await supabase
          .from('scheduled_posts')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', post.id);
        
        results.push({
          scheduled_post_id: post.id,
          status: 'completed',
          generated_posts: generatedPosts
        });
        
      } catch (error) {
        console.error(`Error processing scheduled post ${post.id}:`, error);
        
        // Update scheduled post status to failed
        await supabase
          .from('scheduled_posts')
          .update({ 
            status: 'failed',
            error_message: `Processing failed: ${error.message}`
          })
          .eq('id', post.id);
        
        results.push({
          scheduled_post_id: post.id,
          status: 'failed',
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        message: "Processed scheduled posts", 
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-scheduled-posts function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Helper function to generate topics
async function generateTopics(count: number): Promise<string[]> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-topic`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`Error generating topics: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Generated topic:', data.topic);
    
    // Repeat the process to get multiple topics
    const topics: string[] = [data.topic];
    
    // Generate additional topics if needed
    for (let i = 1; i < count; i++) {
      const additionalResponse = await fetch(`${supabaseUrl}/functions/v1/generate-topic`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      if (additionalResponse.ok) {
        const additionalData = await additionalResponse.json();
        console.log('Generated additional topic:', additionalData.topic);
        topics.push(additionalData.topic);
      }
    }
    
    return topics;
  } catch (error) {
    console.error('Error generating topics:', error);
    // Return some default topics in case of error
    return ['Latest Trends in Radiology', 'Medical Imaging Careers', 'Radiology Job Market'];
  }
}

// Helper function to generate blog post
async function generateBlogPost(topic: string): Promise<string> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-blog-post`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ topic }),
    });

    if (!response.ok) {
      throw new Error(`Error generating blog post: ${response.statusText}`);
    }

    const data = await response.json();
    return data.content;
  } catch (error) {
    console.error('Error generating blog post:', error);
    throw error;
  }
}

// Helper function to generate meta descriptions
async function generateMetaDescriptions(topic: string, content: string): Promise<string[]> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-meta-descriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ topic, content }),
    });

    if (!response.ok) {
      throw new Error(`Error generating meta descriptions: ${response.statusText}`);
    }

    const data = await response.json();
    return data.metaDescriptions || ['A blog post about ' + topic];
  } catch (error) {
    console.error('Error generating meta descriptions:', error);
    return ['A blog post about ' + topic];
  }
}

// Helper function to run fact check
async function runFactCheck(postId: string, content: string): Promise<void> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/fact-check-post`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        content,
        postId 
      }),
    });

    if (!response.ok) {
      throw new Error(`Error running fact check: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error running fact check:', error);
    // We don't throw here to prevent the entire process from failing if fact checking fails
  }
}
