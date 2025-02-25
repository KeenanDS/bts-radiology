
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, FileText, User, Settings, LogOut, Sparkles, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

const AdminDashboard = () => {
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<"create" | "manage">("create");
  const [topic, setTopic] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const generateTopic = () => {
    const topics = [
      "The Future of Artificial Intelligence",
      "Sustainable Living in Modern Cities",
      "Digital Privacy in the Age of Social Media",
      "Remote Work Revolution",
      "Mindfulness and Mental Health",
      "Innovation in Education",
      "Climate Change Solutions",
      "Emerging Technologies in Healthcare",
      "The Impact of Blockchain Technology",
      "Cybersecurity Best Practices"
    ];
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    setTopic(randomTopic);
  };

  const generatePost = async () => {
    if (!topic) {
      toast({
        title: "Error",
        description: "Please provide a topic for the blog post",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-blog-post', {
        body: { topic, additionalInfo }
      });

      if (error) throw error;

      const { title, content } = data;

      const { error: insertError } = await supabase
        .from('blog_posts')
        .insert([{ title, content }]);

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: "Blog post generated and saved successfully!",
      });

      // Clear the form
      setTopic("");
      setAdditionalInfo("");
    } catch (error) {
      console.error('Error generating post:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate blog post",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
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
            onClick={() => setCurrentView("create")}
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
                    <div className="flex gap-2">
                      <Input 
                        id="topic" 
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="Enter the blog post topic" 
                        className="bg-[#1a1f3d] border-[#2a2f4d] focus:border-[#3a3f6d] focus:ring-[#3a3f6d] text-white placeholder:text-gray-500"
                      />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 bg-[#1a1f3d] hover:bg-[#2a2f5d]"
                              onClick={generateTopic}
                            >
                              <Sparkles className="h-4 w-4 text-gray-400" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Generate a random topic</p>
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
                    onClick={generatePost}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
    </div>
  );
};

export default AdminDashboard;
