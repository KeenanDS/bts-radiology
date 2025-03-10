
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

// Local Storage Keys
const STORAGE_KEYS = {
  CURRENT_POST: "beyondthescan_current_post",
  POST_TOPIC: "beyondthescan_post_topic",
  SELECTED_META: "beyondthescan_selected_meta",
  META_DESCRIPTIONS: "beyondthescan_meta_descriptions"
};

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

  // Check for existing post in localStorage on component mount
  useEffect(() => {
    const savedPost = localStorage.getItem(STORAGE_KEYS.CURRENT_POST);
    const savedTopic = localStorage.getItem(STORAGE_KEYS.POST_TOPIC);
    const savedMetaDescription = localStorage.getItem(STORAGE_KEYS.SELECTED_META);
    const savedMetaDescriptions = localStorage.getItem(STORAGE_KEYS.META_DESCRIPTIONS);
    
    // If we have both a saved post and topic, restore the state
    if (savedPost && savedTopic) {
      setTopic(savedTopic);
      setGeneratedPost(savedPost);
      setShowPostForm(false);
      
      // If we have meta descriptions, restore those too
      if (savedMetaDescriptions) {
        try {
          const parsedMetaDescriptions = JSON.parse(savedMetaDescriptions);
          if (Array.isArray(parsedMetaDescriptions)) {
            setMetaDescriptions(parsedMetaDescriptions);
          }
        } catch (error) {
          console.error("Error parsing saved meta descriptions:", error);
        }
      }
      
      // If we have a selected meta description, restore that too
      if (savedMetaDescription) {
        setSelectedMetaDescription(savedMetaDescription);
      }
      
      console.log("Restored post state from localStorage");
    }
  }, []);

  // Save meta descriptions to localStorage whenever they change
  useEffect(() => {
    if (metaDescriptions.length > 0) {
      localStorage.setItem(STORAGE_KEYS.META_DESCRIPTIONS, JSON.stringify(metaDescriptions));
    }
  }, [metaDescriptions]);

  // Log when post generation completes
  useEffect(() => {
    if (generatedPost) {
      console.log("Post generation complete. Content length:", generatedPost.length);
    }
  }, [generatedPost]);

  const generateTopic = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-topic', {
        // Add an empty body to avoid the "Unexpected end of JSON input" error
        body: JSON.stringify({})
      });
      
      if (error) {
        throw error;
      }

      // Check for both the new 'topics' array and legacy 'topic' string format
      if (data?.topics?.[0] || data?.topic) {
        const newTopic = data?.topics?.[0] || data?.topic;
        // Update topic state and ensure the input field is updated
        setTopic(newTopic);
        if (topicInputRef.current) {
          topicInputRef.current.value = newTopic;
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
    console.log("Generating meta descriptions for:", topic);
    console.log("Post content length:", generatedPost.length);

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
        console.error("Meta generation error:", metaError);
        throw metaError;
      }

      console.log("Meta descriptions received:", metaData.descriptions);
      setMetaDescriptions(metaData.descriptions);
      // Set the first description as selected by default
      if (metaData.descriptions && metaData.descriptions.length > 0) {
        setSelectedMetaDescription(metaData.descriptions[0]);
      }
      
      // Save to localStorage
      localStorage.setItem(STORAGE_KEYS.META_DESCRIPTIONS, JSON.stringify(metaData.descriptions));
      
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
        console.log("Blog post generated with length:", generationData.content.length);
        setGeneratedPost(generationData.content);
        setShowPostForm(false);
        
        // Save to localStorage
        localStorage.setItem(STORAGE_KEYS.CURRENT_POST, generationData.content);
        localStorage.setItem(STORAGE_KEYS.POST_TOPIC, topic);
        
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
    // Clear localStorage
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Reset state
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
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {currentView === "create" ? "Create New Post" : "Manage Posts"}
              </h1>
            </div>
            <Link to="/">
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-[#1a1f3d]">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
          </div>

          <Separator className="bg-[#2a2f4d] opacity-50" />

          <div className="mt-6">
            {currentView === "create" && (
              <AnimatePresence mode="wait">
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
