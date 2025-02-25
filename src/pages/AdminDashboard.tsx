
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, FileText, User, Settings, LogOut, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

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

  // Effect to show toast after topic is updated
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
      // Simulate post generation with a delay
      // In a real app, you would call an API here
      setTimeout(async () => {
        // Example generated post content
        const postContent = `# ${topic}\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget aliquam ultricies, nunc nisl aliquet nunc, quis aliquam nisl nunc quis nisl.\n\n## Introduction\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget aliquam ultricies, nunc nisl aliquet nunc, quis aliquam nisl nunc quis nisl.\n\n## Main Content\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget aliquam ultricies, nunc nisl aliquet nunc, quis aliquam nisl nunc quis nisl.`;
        
        // Save the post to the database
        const { data, error } = await supabase
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

        if (error) {
          throw error;
        }

        setGeneratedPost(postContent);
        // Hide the form and show the generated content
        setShowPostForm(false);
        setIsGeneratingPost(false);
        
        toast({
          title: "Success",
          description: "Blog post generated and saved successfully!",
        });
      }, 2000);
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
      {/* Left Sidebar Navigation */}
      <div className="w-64 bg-white/5 backdrop-blur-sm border-r border-white/10 flex flex-col h-screen">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-md flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-sm"></div>
            </div>
            <span className="font-bold text-white">Admin Dashboard</span>
          </div>
        </div>
        
        <div className="flex-1 py-6 px-4 space-y-1">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/10"
            onClick={() => {
              setCurrentView("create");
              resetForm();
            }}
          >
            <FileText className="mr-2 h-5 w-5" />
            Generate Post
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/10"
          >
            <User className="mr-2 h-5 w-5" />
            Profile
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/10"
            onClick={() => setCurrentView("manage")}
          >
            <FileText className="mr-2 h-5 w-5" />
            Manage Posts
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/10"
          >
            <Settings className="mr-2 h-5 w-5" />
            Settings
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/10"
          >
            <LogOut className="mr-2 h-5 w-5" />
            Logout
          </Button>
        </div>
        
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-full overflow-hidden">
              <img src="https://i.pravatar.cc/100" alt="User" className="w-full h-full object-cover" />
            </div>
            <span className="text-white">Manu Arora</span>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
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
              <>
                <AnimatePresence>
                  {showPostForm ? (
                    <motion.div
                      initial={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
                        <CardHeader>
                          <CardTitle className="text-white text-2xl">Generate Blog Post</CardTitle>
                          <CardDescription className="text-gray-400">
                            Generate a new blog post by providing a topic and optional additional information.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                          <div className="space-y-2">
                            <Label htmlFor="topic" className="text-gray-300">Topic</Label>
                            <div className="flex gap-2 relative">
                              <Input 
                                id="topic" 
                                ref={topicInputRef}
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="Enter the blog post topic" 
                                className={`bg-[#1a1f3d] border-[#2a2f4d] focus:border-[#3a3f6d] focus:ring-[#3a3f6d] text-white placeholder:text-gray-500 ${isGenerating ? 'animate-pulse' : ''}`}
                              />
                              {isGenerating && (
                                <div className="absolute inset-y-0 right-12 flex items-center pr-3 pointer-events-none">
                                  <div className="h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                              )}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-10 w-10 bg-[#1a1f3d] hover:bg-[#2a2f5d]"
                                      onClick={generateTopic}
                                      disabled={isGenerating}
                                    >
                                      <Sparkles className={`h-4 w-4 ${isGenerating ? 'text-blue-400' : 'text-gray-400'}`} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Generate a topic using AI</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="additionalInfo" className="text-gray-300">Additional Information (Optional)</Label>
                            <Textarea 
                              id="additionalInfo" 
                              value={additionalInfo}
                              onChange={(e) => setAdditionalInfo(e.target.value)}
                              placeholder="Enter any additional information or context for the blog post"
                              className="min-h-40 bg-[#1a1f3d] border-[#2a2f4d] focus:border-[#3a3f6d] focus:ring-[#3a3f6d] text-white placeholder:text-gray-500"
                            />
                          </div>
                        </CardContent>
                        <CardFooter>
                          <Button 
                            className="bg-[#2a2f5d] hover:bg-[#3a3f7d] text-white border-none"
                            onClick={handleGeneratePost}
                            disabled={isGeneratingPost}
                          >
                            {isGeneratingPost ? (
                              <>
                                <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Generating...
                              </>
                            ) : (
                              <>
                                <Save className="mr-2 h-4 w-4" />
                                Generate Post
                              </>
                            )}
                          </Button>
                        </CardFooter>
                      </Card>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                      className="grid grid-cols-1 md:grid-cols-3 gap-4"
                    >
                      {/* Blog Post Content - Takes up 2/3 of the space */}
                      <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50 md:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between">
                          <div>
                            <CardTitle className="text-white text-2xl">Generated Blog Post</CardTitle>
                            <CardDescription className="text-gray-400">
                              Your AI-generated blog post based on the provided topic.
                            </CardDescription>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-gray-400 hover:text-white hover:bg-[#1a1f3d]"
                            onClick={resetForm}
                          >
                            Back to Form
                          </Button>
                        </CardHeader>
                        <CardContent>
                          <div className="prose prose-invert max-w-none">
                            <div className="whitespace-pre-wrap bg-[#1a1f3d] p-4 rounded-md text-gray-200 font-mono text-sm overflow-auto max-h-[600px]">
                              {generatedPost}
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter>
                          <Button className="bg-[#2a2f5d] hover:bg-[#3a3f7d] text-white border-none">
                            <Save className="mr-2 h-4 w-4" />
                            Save Post
                          </Button>
                        </CardFooter>
                      </Card>

                      {/* Meta Description - Takes up 1/3 of the space */}
                      <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
                        <CardHeader>
                          <CardTitle className="text-white text-xl">Meta Description</CardTitle>
                          <CardDescription className="text-gray-400">
                            SEO metadata for your blog post.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-gray-500">Meta description functionality will be added soon.</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
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
