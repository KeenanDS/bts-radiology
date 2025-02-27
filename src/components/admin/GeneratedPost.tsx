
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Save, Loader2, CheckCircle, ChevronLeft, RefreshCw, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import FactCheckResults from "./FactCheckResults";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

interface GeneratedPostProps {
  topic: string;
  generatedPost: string;
  onSave?: () => Promise<void>;
  metaDescriptions: string[];
  selectedMetaDescription: string;
  setSelectedMetaDescription: (description: string) => void;
  isGeneratingMeta: boolean;
  resetForm?: () => void;
}

// Define the structure of raw issues returned from the API
interface RawFactCheckIssue {
  quote: string;
  explanation: string;
  correction: string;
  source?: string;
}

// Define the structure used by the FactCheckResults component
interface FactCheckIssue {
  claim: string;
  issue: string;
  suggestion: string;
  source?: string;
  resolved?: boolean;
  severity?: "critical" | "major" | "minor";
  confidence?: number;
  ignored?: boolean;
}

const GeneratedPost = ({ 
  topic, 
  generatedPost,
  onSave,
  metaDescriptions,
  selectedMetaDescription,
  setSelectedMetaDescription,
  isGeneratingMeta,
  resetForm
}: GeneratedPostProps) => {
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFactChecking, setIsFactChecking] = useState(false);
  const [factCheckIssues, setFactCheckIssues] = useState<FactCheckIssue[]>([]);
  const [currentContent, setCurrentContent] = useState(generatedPost);
  const [postId, setPostId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const { toast } = useToast();

  // Update currentContent when generatedPost changes
  useEffect(() => {
    setCurrentContent(generatedPost);
  }, [generatedPost]);

  const handleSave = async () => {
    if (!selectedMetaDescription) {
      toast({
        title: "Error",
        description: "Please select a meta description before saving.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Call the onSave prop if provided (for backward compatibility)
      if (onSave) {
        await onSave();
      } else {
        // Save the post to the database
        const { data, error } = await supabase
          .from('blog_posts')
          .insert([
            {
              title: topic,
              content: currentContent,
              meta_description: selectedMetaDescription
            }
          ])
          .select('id')
          .single();

        if (error) throw error;

        // Store the post ID for future operations
        if (data && data.id) {
          setPostId(data.id);
        }
      }

      setIsSaved(true);
      setShowSidebar(true); // Show the sidebar after saving
      toast({
        title: "Success",
        description: "Post saved successfully!",
      });
    } catch (error) {
      console.error('Error saving post:', error);
      toast({
        title: "Error",
        description: "Failed to save the post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Transform raw API issues to the format expected by FactCheckResults
  const mapApiIssues = (rawIssues: RawFactCheckIssue[]): FactCheckIssue[] => {
    console.log('Mapping API issues:', rawIssues);
    
    if (!Array.isArray(rawIssues)) {
      console.error('Expected issues to be an array, got:', typeof rawIssues);
      return [];
    }

    return rawIssues.map(issue => {
      // Determine severity based on content of the explanation
      let severity: "critical" | "major" | "minor" = "major";
      
      const explanation = issue.explanation.toLowerCase();
      if (explanation.includes("incorrect") || 
          explanation.includes("false") || 
          explanation.includes("misleading")) {
        severity = "critical";
      } else if (explanation.includes("outdated") || 
                explanation.includes("needs context") ||
                explanation.includes("ambiguous")) {
        severity = "minor";
      }
      
      // Generate a random confidence score between 60-98 for demo purposes
      // In a real implementation, this would come from the API
      const confidence = Math.floor(Math.random() * 39) + 60;
      
      return {
        claim: issue.quote,
        issue: issue.explanation,
        suggestion: issue.correction,
        source: issue.source,
        resolved: false,
        severity,
        confidence,
        ignored: false
      };
    });
  };

  const handleFactCheck = async () => {
    setIsFactChecking(true);
    
    try {
      // Log the content being sent for fact-checking
      console.log(`Sending content for fact-checking (${currentContent.length} characters)`);
      console.log('Content preview:', currentContent.substring(0, 100) + '...');
      
      const { data, error } = await supabase.functions.invoke('fact-check-post', {
        body: JSON.stringify({ 
          content: currentContent,
          postId
        })
      });

      if (error) throw error;
      
      console.log('Raw fact check response:', data);
      
      if (!data.success) {
        throw new Error(data.error || "Unknown error during fact check");
      }

      // Transform API response to the format expected by the FactCheckResults component
      const transformedIssues = mapApiIssues(data.issues);
      setFactCheckIssues(transformedIssues);
      
      toast({
        title: "Fact Check Complete",
        description: transformedIssues.length > 0 
          ? `Found ${transformedIssues.length} potential issues` 
          : "No issues found!",
      });
    } catch (error) {
      console.error('Error fact-checking post:', error);
      toast({
        title: "Error",
        description: "Failed to complete fact check. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsFactChecking(false);
    }
  };

  const handleContentUpdated = (newContent: string) => {
    setCurrentContent(newContent);
    
    // Update the post in the database if it's already saved
    if (postId) {
      updatePostInDatabase(newContent);
    }
  };

  const updatePostInDatabase = async (content: string) => {
    try {
      const { error } = await supabase
        .from('blog_posts')
        .update({ 
          content,
          updated_at: new Date().toISOString()
        })
        .eq('id', postId);

      if (error) {
        console.error('Error updating post in database:', error);
        toast({
          title: "Warning",
          description: "Content was revised but database update failed.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating post:', error);
    }
  };

  const handleIgnoreIssue = (index: number) => {
    setFactCheckIssues(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ignored: !updated[index].ignored };
      return updated;
    });
    
    toast({
      title: factCheckIssues[index].ignored ? "Issue Restored" : "Issue Ignored",
      description: factCheckIssues[index].ignored 
        ? "The issue has been restored to your active list." 
        : "The issue has been moved to ignored status.",
    });
  };

  // Count active (non-ignored) issues
  const activeIssueCount = factCheckIssues.filter(issue => !issue.ignored).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full space-y-6"
    >
      {/* Header card with title and primary actions */}
      <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-white text-2xl">{topic}</CardTitle>
            <CardDescription className="text-gray-400">
              AI-generated blog post based on your topic
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            {resetForm && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      onClick={resetForm}
                      className="border-[#2a2f4d] hover:bg-[#2a2f5d] hover:text-white"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to New Post
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Return to create a new post</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {!isSaved ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      className="bg-[#2a2f5d] hover:bg-[#3a3f7d] text-white border-none"
                      onClick={handleSave}
                      disabled={isSaving || !selectedMetaDescription}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Post
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Save the post and proceed to fact checking</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      className="bg-[#2a2f5d] hover:bg-[#3a3f7d] text-white border-none"
                      onClick={handleFactCheck}
                      disabled={isFactChecking}
                    >
                      {isFactChecking ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          {factCheckIssues.length > 0 ? 'Re-check Facts' : 'Fact Check'}
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Verify the accuracy of the generated content</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pt-4">
          <div className={`grid ${showSidebar ? 'md:grid-cols-5 gap-6' : 'grid-cols-1'}`}>
            {/* Content Area */}
            <div className={`${showSidebar ? 'md:col-span-3' : 'w-full'} space-y-4`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white text-sm font-medium">Content</h3>
                {factCheckIssues.length > 0 && (
                  <Badge 
                    variant={activeIssueCount > 0 ? "default" : "success"} 
                    className={activeIssueCount > 0 ? "bg-yellow-600" : ""}
                  >
                    {activeIssueCount > 0 ? `${activeIssueCount} active issues` : "All issues addressed"}
                  </Badge>
                )}
              </div>
              <div className="prose prose-invert max-w-none">
                <div className="whitespace-pre-wrap bg-[#1a1f3d] p-4 rounded-md text-gray-200 font-mono text-sm overflow-auto max-h-[600px]">
                  {currentContent}
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            {showSidebar && (
              <div className="md:col-span-2 space-y-6">
                {/* Meta Description Section */}
                <Card className="bg-[#1a1f3d] border-[#2a2f4d]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-lg">Meta Description</CardTitle>
                    <CardDescription className="text-gray-400">
                      How your post will appear in search results
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isGeneratingMeta ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        <span className="ml-2 text-gray-400">Generating descriptions...</span>
                      </div>
                    ) : selectedMetaDescription ? (
                      <div className="p-3 border border-[#2a2f4d] rounded-md">
                        <h4 className="text-white text-sm font-medium mb-2">Search Result Preview</h4>
                        <div className="bg-white rounded-md p-3 text-black">
                          <div className="text-[#1a0dab] text-lg font-medium hover:underline cursor-pointer truncate">
                            {topic}
                          </div>
                          <div className="text-[#006621] text-xs mb-1">
                            www.beyondthescan.com
                          </div>
                          <div className="text-sm text-[#545454]">
                            {selectedMetaDescription}
                          </div>
                        </div>
                      </div>
                    ) : metaDescriptions.length > 0 ? (
                      <RadioGroup
                        value={selectedMetaDescription}
                        onValueChange={setSelectedMetaDescription}
                        className="space-y-3"
                      >
                        {metaDescriptions.map((description, index) => (
                          <div key={index} className="flex items-start space-x-2 bg-[#111936] p-3 rounded-md hover:bg-[#2a2f5d] transition-colors">
                            <RadioGroupItem
                              value={description}
                              id={`option-${index}`}
                              className="border-gray-600 text-white mt-1"
                            />
                            <Label
                              htmlFor={`option-${index}`}
                              className="text-sm text-gray-300 cursor-pointer leading-relaxed"
                            >
                              {description}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    ) : (
                      <p className="text-gray-500">No meta descriptions generated yet.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Fact Check Section */}
                {isSaved && (
                  <Card className="bg-[#1a1f3d] border-[#2a2f4d]">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-white text-lg">Fact Check Results</CardTitle>
                        {factCheckIssues.length > 0 && (
                          <Badge 
                            variant={activeIssueCount > 0 ? "default" : "success"}
                            className={activeIssueCount > 0 ? "bg-yellow-600" : ""}
                          >
                            {factCheckIssues.length} issues
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-gray-400">
                        {factCheckIssues.length === 0 
                          ? "Run a fact check to verify your content" 
                          : "Review and fix potential factual issues"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <AnimatePresence mode="wait">
                        {isFactChecking ? (
                          <div className="flex flex-col items-center justify-center py-8 space-y-3">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            <p className="text-gray-400">Checking facts and accuracy...</p>
                          </div>
                        ) : factCheckIssues.length > 0 ? (
                          <FactCheckResults 
                            issues={factCheckIssues}
                            isLoading={isFactChecking}
                            postId={postId}
                            content={currentContent}
                            onContentUpdated={handleContentUpdated}
                            onIgnoreIssue={handleIgnoreIssue}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center py-6 space-y-3 text-center">
                            {isSaved ? (
                              <>
                                <CheckCircle className="h-12 w-12 text-green-500" />
                                <p className="text-gray-300">No issues detected. Content ready to publish!</p>
                              </>
                            ) : (
                              <p className="text-gray-500">Save your post first to run a fact check.</p>
                            )}
                          </div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default GeneratedPost;
