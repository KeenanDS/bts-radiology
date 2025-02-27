
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
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
  const [showPostForm, setShowPostForm] = useState(true);
  const [generatedPost, setGeneratedPost] = useState("");
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);
  const [metaDescriptions, setMetaDescriptions] = useState<string[]>([]);
  const [selectedMetaDescription, setSelectedMetaDescription] = useState("");
  const [isGeneratingMeta, setIsGeneratingMeta] = useState(false);
  const topicInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const generateTopic = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-topic');
      
      if (error) {
        throw error;
      }

      if (data?.topic) {
        // Update topic state and ensure the input field is updated
        setTopic(data.topic);
        if (topicInputRef.current) {
          topicInputRef.current.value = data.topic;
        }

        toast({
          title: "Topic Generated",
          description: "A new topic has been generated successfully.",
        });
      } else {
        throw new Error('No topic was generated');
      }
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

  const generateMetaDescriptions = async () => {
    setIsGeneratingMeta(true);
    try {
      const { data: metaData, error: metaError } = await supabase.functions
        .invoke('generate-meta-descriptions', {
          body: JSON.stringify({
            title: topic,
            content: generatedPost
          })
        });

      if (metaError) {
        throw metaError;
      }

      setMetaDescriptions(metaData.descriptions);
      // Removed automatic selection of first description
      
      toast({
        title: "Success",
        description: "Meta descriptions generated successfully!",
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to generate meta descriptions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingMeta(false);
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

      if (generationData?.content) {
        setGeneratedPost(generationData.content);
        setShowPostForm(false);
        
        // Generate meta descriptions after post is generated
        await generateMetaDescriptions();
        
        toast({
          title: "Success",
          description: "Blog post generated successfully!",
        });
      } else {
        throw new Error('No content was generated');
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to generate blog post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPost(false);
    }
  };

  const resetForm = () => {
    setShowPostForm(true);
    setGeneratedPost("");
    setTopic("");
    setAdditionalInfo("");
    setMetaDescriptions([]);
    setSelectedMetaDescription("");
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
                    metaDescriptions={metaDescriptions}
                    selectedMetaDescription={selectedMetaDescription}
                    setSelectedMetaDescription={setSelectedMetaDescription}
                    isGeneratingMeta={isGeneratingMeta}
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
