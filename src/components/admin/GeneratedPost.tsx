
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Save, Loader2, CheckCircle, ChevronLeft, RefreshCw, ArrowLeft, AlertTriangle } from "lucide-react";
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
  // Always show sidebar when a post is generated
  const [showSidebar, setShowSidebar] = useState(true);
  // Track if fact check has been run at least once
  const [factCheckRun, setFactCheckRun] = useState(false);
  // Track fixed issues
  const [fixedIssueIndices, setFixedIssueIndices] = useState<Set<number>>(new Set());
  // Track status of fact check
  const [factCheckStatus, setFactCheckStatus] = useState<string>("not_started");
  const { toast } = useToast();

  // Update currentContent when generatedPost changes
  useEffect(() => {
    setCurrentContent(generatedPost);
    // Ensure sidebar is shown whenever we have content
    if (generatedPost) {
      console.log("Post generated, showing sidebar");
      setShowSidebar(true);
    }
  }, [generatedPost]);

  // Log when meta descriptions are available
  useEffect(() => {
    console.log(`Meta descriptions available: ${metaDescriptions.length}`);
    if (metaDescriptions.length > 0) {
      console.log("First meta description:", metaDescriptions[0]);
    }
  }, [metaDescriptions]);

  // Check fact check status when postId changes
  useEffect(() => {
    if (postId) {
      checkFactCheckStatus();
    }
  }, [postId]);

  const checkFactCheckStatus = async () => {
    if (!postId) return;
    
    try {
      const { data, error } = await supabase
        .from("fact_check_results")
        .select("*")
        .eq("post_id", postId)
        .maybeSingle();
        
      if (error) {
        console.error("Error fetching fact check status:", error);
        setFactCheckStatus("error");
      } else if (data) {
        console.log("Fact check data:", data);
        setFactCheckStatus("completed");
        if (data.issues && Array.isArray(data.issues) && data.issues.length > 0) {
          // Transform API issues to the format expected by FactCheckResults
          const transformedIssues = mapApiIssues(data.issues);
          setFactCheckIssues(transformedIssues);
          setFactCheckRun(true);
        } else {
          setFactCheckIssues([]);
          setFactCheckRun(true);
        }
      } else {
        setFactCheckStatus("not_checked");
      }
    } catch (err) {
      console.error("Error in fact check status check:", err);
      setFactCheckStatus("error");
    }
  };

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
      console.log("Saving post with meta description:", selectedMetaDescription);
      
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

        if (error) {
          console.error("Database error when saving:", error);
          throw error;
        }

        console.log("Post saved successfully with data:", data);

        // Store the post ID for future operations
        if (data && data.id) {
          console.log("Setting post ID:", data.id);
          setPostId(data.id);
        }
      }

      setIsSaved(true);
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
      
      const explanation = (issue.explanation || "").toLowerCase();
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
    if (!postId) {
      toast({
        title: "Error",
        description: "Please save the post before fact checking.",
        variant: "destructive",
      });
      return;
    }

    setIsFactChecking(true);
    setFactCheckStatus("checking");
    
    try {
      // Log the content being sent for fact-checking
      console.log(`Sending content for fact-checking (${currentContent.length} characters)`);
      console.log('Content preview:', currentContent.substring(0, 100) + '...');
      
      const { data, error } = await supabase.functions.invoke('fact-check-post', {
        body: JSON.stringify({ 
          postId,
          content: currentContent
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
      // Mark that fact check has been run
      setFactCheckRun(true);
      setFactCheckStatus("completed");
      
      toast({
        title: "Fact Check Complete",
        description: transformedIssues.length > 0 
          ? `Found ${transformedIssues.length} potential issues` 
          : "No issues found!",
      });
    } catch (error) {
      console.error('Error fact-checking post:', error);
      setFactCheckStatus("error");
      toast({
        title: "Error",
        description: "Failed to complete fact check. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsFactChecking(false);
    }
  };

  const handleContentUpdated = (newContent: string, fixedIndices?: number[]) => {
    setCurrentContent(newContent);
    
    // If we have fixed indices, update our fixed issues state
    if (fixedIndices && fixedIndices.length > 0) {
      setFixedIssueIndices(prev => {
        const newSet = new Set(prev);
        fixedIndices.forEach(index => newSet.add(index));
        return newSet;
      });
      
      // Also update the resolved flag in the issues array
      setFactCheckIssues(prev => {
        const updated = [...prev];
        fixedIndices.forEach(index => {
          if (index >= 0 && index < updated.length) {
            updated[index] = { ...updated[index], resolved: true };
          }
        });
        return updated;
      });
    }
    
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

  // Count active (non-ignored, non-fixed) issues
  const activeIssueCount = factCheckIssues.filter(issue => 
    !issue.ignored && !issue.resolved && !fixedIssueIndices.has(factCheckIssues.indexOf(issue))
  ).length;

  // Get fact check status badge
  const getFactCheckStatusBadge = () => {
    switch (factCheckStatus) {
      case "not_started":
      case "not_checked":
        return (
          <Badge variant="outline" className="bg-yellow-900/20 text-yellow-400 border-yellow-800">
            Not Checked
          </Badge>
        );
      case "checking":
        return (
          <Badge variant="outline" className="bg-blue-900/20 text-blue-400 border-blue-800">
            Checking...
          </Badge>
        );
      case "completed":
        if (factCheckIssues.length === 0) {
          return (
            <Badge variant="outline" className="bg-green-900/20 text-green-400 border-green-800">
              Verified
            </Badge>
          );
        } else if (activeIssueCount === 0) {
          return (
            <Badge variant="outline" className="bg-green-900/20 text-green-400 border-green-800">
              Issues Fixed
            </Badge>
          );
        } else {
          return (
            <Badge variant="outline" className="bg-red-900/20 text-red-400 border-red-800">
              {activeIssueCount} {activeIssueCount === 1 ? 'Issue' : 'Issues'}
            </Badge>
          );
        }
      case "error":
        return (
          <Badge variant="outline" className="bg-red-900/20 text-red-400 border-red-800">
            Error
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      {/* Header with actions */}
      <div className="flex flex-col space-y-4 mb-6">
        {/* Back button and title */}
        <div className="flex items-center">
          {resetForm && (
            <Button 
              variant="ghost" 
              onClick={resetForm}
              className="text-gray-400 hover:text-white hover:bg-[#1a1f3d] mr-4"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to New Post
            </Button>
          )}
        </div>

        {/* Title and action buttons */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-3xl font-semibold mb-1">{topic}</h1>
            <p className="text-gray-400 text-sm">
              AI-generated blog post based on your topic
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {postId && getFactCheckStatusBadge()}
            
            {!isSaved ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="lg"
                      className="bg-[#2a2f5d] hover:bg-[#3a3f7d] text-white border-none px-8"
                      onClick={handleSave}
                      disabled={isSaving || !selectedMetaDescription}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-5 w-5" />
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
                      size="lg"
                      className="bg-[#2a2f5d] hover:bg-[#3a3f7d] text-white border-none px-8"
                      onClick={handleFactCheck}
                      disabled={isFactChecking}
                    >
                      {isFactChecking ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-5 w-5" />
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
        </div>
      </div>

      {/* Main content area */}
      <div className="flex gap-4">
        {/* Content Area */}
        <div className="flex-1">
          <Card className="bg-[#1a1f3d] border-[#2a2f4d]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg">Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-invert max-w-none">
                <div className="whitespace-pre-wrap bg-[#111936] p-6 rounded-md text-gray-200 font-mono text-sm overflow-auto max-h-[650px]">
                  {currentContent}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="w-[400px]">
          {/* Meta Description Section - Only show if not saved */}
          {!isSaved && (
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
                ) : metaDescriptions.length > 0 ? (
                  <div className="space-y-4">
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
                    
                    {selectedMetaDescription && (
                      <div className="p-3 border border-[#2a2f4d] rounded-md mt-4">
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
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">No meta descriptions generated yet.</p>
                )}
              </CardContent>
              {!isSaved && selectedMetaDescription && (
                <CardFooter className="pt-0">
                  <div className="w-full bg-yellow-900/30 text-yellow-400 text-xs p-2 rounded border border-yellow-900/50">
                    <div className="flex items-center">
                      <span className="mr-1">⚠️</span> Click 'Save Post' to proceed to fact checking
                    </div>
                  </div>
                </CardFooter>
              )}
            </Card>
          )}

          {/* Fact Check Section - Only show if saved */}
          {isSaved && (
            <Card className="bg-[#1a1f3d] border-[#2a2f4d]">
              <CardHeader className="pb-3 border-b border-[#2a2f4d]">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-white text-xl mb-1">Fact Check Results</CardTitle>
                    <CardDescription className="text-gray-400">
                      {factCheckStatus === "not_checked" || factCheckStatus === "not_started"
                        ? "Run a fact check to verify your content" 
                        : factCheckStatus === "checking"
                        ? "Checking your content for factual issues..."
                        : factCheckStatus === "error"
                        ? "Error during fact checking"
                        : factCheckIssues.length === 0
                        ? "No issues found in your content"
                        : activeIssueCount === 0
                        ? "All issues have been resolved"
                        : `${activeIssueCount} potential ${activeIssueCount === 1 ? 'issue' : 'issues'} found`}
                    </CardDescription>
                  </div>
                  {factCheckStatus === "completed" && factCheckIssues.length > 0 && (
                    <Badge 
                      variant={activeIssueCount > 0 ? "default" : "success"}
                      className={`${activeIssueCount > 0 ? 'bg-[#2a2f5d] hover:bg-[#3a3f7d]' : 'bg-emerald-600'} transition-colors px-3 py-1 text-sm`}
                    >
                      {activeIssueCount === 0 ? "All Clear" : `${activeIssueCount} Active`}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <AnimatePresence mode="wait">
                  {isFactChecking || factCheckStatus === "checking" ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center py-8 space-y-3"
                    >
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                      <p className="text-gray-400">Checking facts and accuracy...</p>
                    </motion.div>
                  ) : (
                    <FactCheckResults 
                      issues={factCheckIssues}
                      isLoading={isFactChecking}
                      postId={postId || undefined}
                      content={currentContent}
                      onContentUpdated={handleContentUpdated}
                      onIgnoreIssue={handleIgnoreIssue}
                    />
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default GeneratedPost;
