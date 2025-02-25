import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { supabase } from "@/integrations/supabase/client";
import { AnimatePresence } from "framer-motion";

import Sidebar from "@/components/admin/Sidebar";
import PostForm from "@/components/admin/PostForm";
import GeneratedPost from "@/components/admin/GeneratedPost";

const AdminDashboard = () => {
  const [currentView, setCurrentView] = useState<"create" | "manage">("create");
  const [topic, setTopic] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [topicUpdated, setTopicUpdated] = useState(false);
  const [showPostForm, setShowPostForm] = useState(true);
  const [generatedPost, setGeneratedPost] = useState("");
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);
  const topicInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (topicUpdated) {
      toast({
        title: "Topic Generated",
        description: "A new topic has been generated successfully.",
      });
      setTopicUpdated(false);
    }
  }, [topicUpdated, toast]);

  const generateTopic = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-topic');
      
      if (error) {
        throw error;
      }

      setTopic(data.topic);
      setTopicUpdated(true);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to generate topic. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePost = async () => {
    if (!topic.trim()) {
      toast({
        title: "Error",
        description: "Please enter a topic for the blog post.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPost(true);
    
    try {
      const { data: generationData, error: generationError } = await supabase.functions
        .invoke('generate-blog-post', {
          body: JSON.stringify({
            topic,
            additionalInfo
          })
        });

      if (generationError) {
        throw generationError;
      }

      const postContent = generationData.content;

      const { data: savedData, error: saveError } = await supabase
        .from('blog_posts')
        .insert([
          {
            title: topic,
            content: postContent,
            meta_description: additionalInfo || null
          }
        ])
        .select()
        .single();

      if (saveError) {
        throw saveError;
      }

      setGeneratedPost(postContent);
      setShowPostForm(false);
      setIsGeneratingPost(false);
      
      toast({
        title: "Success",
        description: "Blog post generated and saved successfully!",
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to generate and save blog post. Please try again.",
        variant: "destructive",
      });
      setIsGeneratingPost(false);
    }
  };

  const resetForm = () => {
    setShowPostForm(true);
    setGeneratedPost("");
    setTopic("");
    setAdditionalInfo("");
  };

  return (
    <div className="min-h-screen flex bg-[#0a0b17]">
      <Sidebar />
      
      <div className="flex-1 p-6 bg-gradient-to-br from-[#0a0b17] via-[#111936] to-[#0a0b17]">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {currentView === "create" ? "Create New Post" : "Manage Posts"}
            </h1>
            <Link to="/">
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-[#1a1f3d]">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
          </div>

          <Separator className="bg-[#2a2f4d] opacity-50" />

          <div className="mt-6">
            {currentView === "create" && (
              <AnimatePresence>
                {showPostForm ? (
                  <PostForm
                    topic={topic}
                    setTopic={setTopic}
                    additionalInfo={additionalInfo}
                    setAdditionalInfo={setAdditionalInfo}
                    isGenerating={isGenerating}
                    isGeneratingPost={isGeneratingPost}
                    generateTopic={generateTopic}
                    handleGeneratePost={handleGeneratePost}
                    topicInputRef={topicInputRef}
                  />
                ) : (
                  <GeneratedPost
                    topic={topic}
                    generatedPost={generatedPost}
                    resetForm={resetForm}
                  />
                )}
              </AnimatePresence>
            )}
            
            {currentView === "manage" && (
              <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
                <CardHeader>
                  <CardTitle className="text-white text-2xl">Manage Posts</CardTitle>
                  <CardDescription className="text-gray-400">
                    View and manage your existing blog posts.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-500">No posts available yet. Create your first post.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
};

export default AdminDashboard;
