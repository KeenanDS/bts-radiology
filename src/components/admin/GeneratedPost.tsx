import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Save, Loader2, CheckCircle, ChevronLeft, RefreshCw, ArrowLeft, AlertTriangle, Wand2 } from "lucide-react";
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
import { Json } from "@/integrations/supabase/types";
import { Progress } from "@/components/ui/progress";

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

// Define possible blog post statuses
const POST_STATUS = {
  GENERATING: "generating",
  GENERATED: "generated",
  FACT_CHECKING: "fact_checking",
  FACT_CHECK_ISSUES_FOUND: "fact_check_issues_found",
  FACT_CHECK_FIXED: "fact_check_fixed",
  COMPLETED: "completed",
};

// Local Storage Keys
const STORAGE_KEYS = {
  CURRENT_POST: "beyondthescan_current_post",
  POST_ID: "beyondthescan_post_id",
  POST_STATUS: "beyondthescan_post_status",
  FACT_CHECK_ISSUES: "beyondthescan_fact_check_issues",
  FIXED_ISSUES: "beyondthescan_fixed_issues",
  POST_TOPIC: "beyondthescan_post_topic",
  SELECTED_META: "beyondthescan_selected_meta",
  FACT_CHECK_STATUS: "beyondthescan_fact_check_status"
};

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
  const [postStatus, setPostStatus] = useState<string>(""); 
  // Always show sidebar when a post is generated
  const [showSidebar, setShowSidebar] = useState(true);
  // Track if fact check has been run at least once
  const [factCheckRun, setFactCheckRun] = useState(false);
  // Track fixed issues
  const [fixedIssueIndices, setFixedIssueIndices] = useState<Set<number>>(new Set());
  // Track status of fact check
  const [factCheckStatus, setFactCheckStatus] = useState<string>("not_started");
  // Track if auto fix is in progress
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  // Progress for auto-fixing
  const [autoFixProgress, setAutoFixProgress] = useState(0);
  const { toast } = useToast();

  // Restore state from localStorage on component mount
  useEffect(() => {
    const restoreStateFromStorage = () => {
      try {
        // Only restore if we have a saved post content
        const savedContent = localStorage.getItem(STORAGE_KEYS.CURRENT_POST);
        if (!savedContent) return;

        // Restore all state
        setCurrentContent(savedContent || generatedPost);
        
        const savedPostId = localStorage.getItem(STORAGE_KEYS.POST_ID);
        if (savedPostId) setPostId(savedPostId);
        
        const savedStatus = localStorage.getItem(STORAGE_KEYS.POST_STATUS);
        if (savedStatus) setPostStatus(savedStatus);
        
        const savedFactCheckStatus = localStorage.getItem(STORAGE_KEYS.FACT_CHECK_STATUS);
        if (savedFactCheckStatus) setFactCheckStatus(savedFactCheckStatus);
        
        const savedIssuesJson = localStorage.getItem(STORAGE_KEYS.FACT_CHECK_ISSUES);
        if (savedIssuesJson) {
          const savedIssues = JSON.parse(savedIssuesJson);
          if (Array.isArray(savedIssues)) setFactCheckIssues(savedIssues);
        }
        
        const savedFixedIndicesJson = localStorage.getItem(STORAGE_KEYS.FIXED_ISSUES);
        if (savedFixedIndicesJson) {
          const indices = JSON.parse(savedFixedIndicesJson);
          if (Array.isArray(indices)) setFixedIssueIndices(new Set(indices));
        }
        
        // If we have a post ID, we've saved the post before
        if (savedPostId) setIsSaved(true);
        
        // Set fact check as run if we have issues
        if (savedIssuesJson) setFactCheckRun(true);
        
        console.log("State restored from localStorage");
      } catch (error) {
        console.error("Error restoring state from localStorage:", error);
      }
    };
    
    // Only restore if we don't already have content
    if (!currentContent || currentContent === generatedPost) {
      restoreStateFromStorage();
    }
  }, []);

  // Update currentContent when generatedPost changes (only if no existing content)
  useEffect(() => {
    if (!currentContent && generatedPost) {
      setCurrentContent(generatedPost);
      // Ensure sidebar is shown whenever we have content
      console.log("Post generated, showing sidebar");
      setShowSidebar(true);
    }
  }, [generatedPost]);

  // Save state to localStorage whenever important state changes
  useEffect(() => {
    if (currentContent) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_POST, currentContent);
    }
    
    if (postId) {
      localStorage.setItem(STORAGE_KEYS.POST_ID, postId);
    }
    
    if (postStatus) {
      localStorage.setItem(STORAGE_KEYS.POST_STATUS, postStatus);
    }
    
    if (factCheckStatus) {
      localStorage.setItem(STORAGE_KEYS.FACT_CHECK_STATUS, factCheckStatus);
    }
    
    if (topic) {
      localStorage.setItem(STORAGE_KEYS.POST_TOPIC, topic);
    }
    
    if (selectedMetaDescription) {
      localStorage.setItem(STORAGE_KEYS.SELECTED_META, selectedMetaDescription);
    }
    
    if (factCheckIssues.length > 0) {
      localStorage.setItem(STORAGE_KEYS.FACT_CHECK_ISSUES, JSON.stringify(factCheckIssues));
    }
    
    if (fixedIssueIndices.size > 0) {
      localStorage.setItem(STORAGE_KEYS.FIXED_ISSUES, JSON.stringify([...fixedIssueIndices]));
    }
  }, [currentContent, postId, postStatus, factCheckStatus, topic, selectedMetaDescription, factCheckIssues, fixedIssueIndices]);

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
      checkPostStatus();
      checkFactCheckStatus();
    }
  }, [postId]);

  // Poll for status updates if in fact checking or auto fixing
  useEffect(() => {
    let intervalId: number | null = null;
    
    if (postId && (postStatus === POST_STATUS.FACT_CHECKING || isAutoFixing)) {
      // Poll every 5 seconds for status updates
      intervalId = setInterval(() => {
        checkPostStatus();
        checkFactCheckStatus();
      }, 5000) as unknown as number;
    }
    
    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [postId, postStatus, isAutoFixing]);

  const checkPostStatus = async () => {
    if (!postId) return;
    
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("status")
        .eq("id", postId)
        .maybeSingle();
        
      if (error) {
        console.error("Error fetching post status:", error);
      } else if (data) {
        console.log("Post status:", data.status);
        setPostStatus(data.status);
        
        // If post was in fact checking and now has issues or is fixed
        if (isFactChecking && 
            (data.status === POST_STATUS.FACT_CHECK_ISSUES_FOUND || 
             data.status === POST_STATUS.FACT_CHECK_FIXED || 
             data.status === POST_STATUS.COMPLETED)) {
          setIsFactChecking(false);
          
          // Reload the fact check results
          await checkFactCheckStatus();
          
          // If we were auto-fixing and now complete
          if (isAutoFixing && 
              (data.status === POST_STATUS.COMPLETED || 
               data.status === POST_STATUS.FACT_CHECK_FIXED)) {
            setIsAutoFixing(false);
            setAutoFixProgress(100);
            
            // Refresh the content
            const { data: updatedPost } = await supabase
              .from("blog_posts")
              .select("content")
              .eq("id", postId)
              .maybeSingle();
              
            if (updatedPost && updatedPost.content) {
              setCurrentContent(updatedPost.content);
            }
            
            toast({
              title: "Auto-fix Complete",
              description: "All issues have been automatically fixed!",
            });
          }
        }
      }
    } catch (err) {
      console.error("Error in post status check:", err);
    }
  };

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
  const mapApiIssues = (rawIssues: Json): FactCheckIssue[] => {
    console.log('Mapping API issues:', rawIssues);
    
    if (!Array.isArray(rawIssues)) {
      console.error('Expected issues to be an array, got:', typeof rawIssues);
      return [];
    }

    return rawIssues.map((issue: any) => {
      if (!issue || typeof issue !== 'object') {
        console.error('Invalid issue object:', issue);
        return {
          claim: "Unknown claim",
          issue: "Error processing this issue",
          suggestion: "Please refresh and try again",
          severity: "minor" as "minor",
          confidence: 60,
          resolved: false,
          ignored: false
        };
      }

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
        claim: issue.quote || "",
        issue: issue.explanation || "",
        suggestion: issue.correction || "",
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
      // Update post status to fact checking
      const { error: updateError } = await supabase
        .from("blog_posts")
        .update({ status: POST_STATUS.FACT_CHECKING })
        .eq("id", postId);
        
      if (updateError) {
        console.error("Error updating post status:", updateError);
      }
      
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

      // Refresh post status and fact check results
      await checkPostStatus();
      await checkFactCheckStatus();
      
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

  // Handle fact check status change from FactCheckResults component
  const handleFactCheckStatusChange = (isChecking: boolean) => {
    setIsFactChecking(isChecking);
  };

  // Auto-fix all issues
  const handleAutoFixAll = async () => {
    if (!postId) {
      toast({
        title: "Error",
        description: "Post must be saved before auto-fixing issues.",
        variant: "destructive",
      });
      return;
    }
    
    // Get active issues that aren't ignored or already fixed
    const activeIssues = factCheckIssues.filter(issue => 
      !issue.ignored && !issue.resolved
    );
    
    if (activeIssues.length === 0) {
      toast({
        title: "No Issues to Fix",
        description: "There are no active issues that need fixing.",
      });
      return;
    }
    
    setIsAutoFixing(true);
    setAutoFixProgress(0);
    
    try {
      toast({
        title: "Auto-Fix Started",
        description: `AI is fixing ${activeIssues.length} issues. This may take a minute.`,
      });
      
      // Update post status to indicate fixing in progress
      await supabase
        .from("blog_posts")
        .update({ status: POST_STATUS.FACT_CHECKING })
        .eq("id", postId);
      
      // Process each issue sequentially
      let currentVersion = currentContent;
      let totalFixed = 0;
      
      for (let i = 0; i < activeIssues.length; i++) {
        const issue = activeIssues[i];
        const issueIndex = factCheckIssues.indexOf(issue);
        
        try {
          // Update progress
          const progress = Math.round(((i + 0.5) / activeIssues.length) * 100);
          setAutoFixProgress(progress);
          
          console.log(`Auto-fixing issue ${i+1}/${activeIssues.length}: ${issue.claim.substring(0, 30)}...`);
          
          // Call the revise-blog-post function for this issue
          const { data, error } = await supabase.functions.invoke('revise-blog-post', {
            body: JSON.stringify({
              postId,
              content: currentVersion,
              issue: issue.issue,
              claim: issue.claim,
              suggestion: issue.suggestion
            })
          });
          
          if (error) throw error;
          
          if (!data.success || !data.revisedContent) {
            console.error(`Failed to revise issue ${i+1}`);
            continue;
          }
          
          // Update the current content version for the next iteration
          currentVersion = data.revisedContent;
          totalFixed++;
          
          // Mark this issue as fixed
          const fixedIndices = [...fixedIssueIndices, issueIndex];
          setFixedIssueIndices(new Set(fixedIndices));
          
          // Update progress bar
          const updatedProgress = Math.round(((i + 1) / activeIssues.length) * 100);
          setAutoFixProgress(updatedProgress);
        } catch (reviseError) {
          console.error(`Error auto-fixing issue ${i+1}:`, reviseError);
          // Continue with next issue
        }
      }
      
      // Update the UI with the final version
      setCurrentContent(currentVersion);
      
      // Refresh the post status
      await checkPostStatus();
      await checkFactCheckStatus();
      
      toast({
        title: "Auto-Fix Complete",
        description: totalFixed > 0 
          ? `Successfully fixed ${totalFixed} out of ${activeIssues.length} issues.` 
          : "Could not automatically fix any issues. Please try manual fixes.",
      });
    } catch (error) {
      console.error('Error during auto-fix:', error);
      toast({
        title: "Auto-Fix Error",
        description: "There was a problem automatically fixing issues. Please try manual fixes.",
        variant: "destructive",
      });
    } finally {
      setIsAutoFixing(false);
      setAutoFixProgress(100); // Ensure progress bar shows complete
    }
  };

  // Function to clear local storage when resetting form
  const handleResetForm = () => {
    // Clear local storage
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Call the parent resetForm function
    if (resetForm) {
      resetForm();
    }
  };

  // Count active (non-ignored, non-fixed) issues
  const activeIssueCount = factCheckIssues.filter(issue => 
    !issue.ignored && !issue.resolved && !fixedIssueIndices.has(factCheckIssues.indexOf(issue))
  ).length;

  // Get fact check status badge
  const getFactCheckStatusBadge = () => {
    if (postStatus === POST_STATUS.FACT_CHECKING || isFactChecking) {
      return (
        <Badge variant="outline" className="bg-blue-900/20 text-blue-400 border-blue-800 flex items-center">
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
          Checking Facts
        </Badge>
      );
    }
    
    if (postStatus === POST_STATUS.FACT_CHECK_ISSUES_FOUND) {
      return (
        <Badge variant="outline" className="bg-red-900/20 text-red-400 border-red-800">
          {activeIssueCount} {activeIssueCount === 1 ? 'Issue' : 'Issues'}
        </Badge>
      );
    }
    
    if (postStatus === POST_STATUS.FACT_CHECK_FIXED) {
      return (
        <Badge variant="outline" className="bg-yellow-900/20 text-yellow-400 border-yellow-800">
          Issues Fixed
        </Badge>
      );
    }
    
    if (postStatus === POST_STATUS.COMPLETED) {
      return (
        <Badge variant="outline" className="bg-green-900/20 text-green-400 border-green-800">
          Verified
        </Badge>
      );
    }
    
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
          <Badge variant="outline" className="bg-blue-900/20 text-blue-400 border-blue-800 flex items-center">
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            Checking Facts
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

  // Show warning if navigating away during fact checking
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isFactChecking || isAutoFixing) {
        const message = "Fact check in progress. Are you sure you want to leave?";
        event.preventDefault();
        event.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isFactChecking, isAutoFixing]);

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
              onClick={handleResetForm}
              className="text-gray-400 hover:text-white hover:bg-[#1a1f3d] mr-4"
              disabled={isFactChecking || isAutoFixing}
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
              <div className="flex space-x-2">
                {/* Auto-fix button - only show when there are active issues */}
                {activeIssueCount > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          size="lg"
                          className="bg-gradient-to-r from-[#2a2f5d] to-[#3a3f8d] text-white border-none"
                          onClick={handleAutoFixAll}
                          disabled={isAutoFixing || isFactChecking}
                        >
                          {isAutoFixing ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Auto-fixing...
                            </>
                          ) : (
                            <>
                              <Wand2 className="mr-2 h-5 w-5" />
                              Auto-fix All
                            </>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Let AI fix all issues automatically</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="lg"
                        className="bg-[#2a2f5d] hover:bg-[#3a3f7d] text-white border-none px-8"
                        onClick={handleFactCheck}
                        disabled={isFactChecking || isAutoFixing}
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress indicator for auto-fixing */}
      {isAutoFixing && (
        <div className="mb-6 space-y-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-400">Auto-fixing issues...</span>
            <span className="text-sm text-gray-400">{autoFixProgress}%</span>
          </div>
          <Progress value={autoFixProgress} className="h-2" />
        </div>
      )}

      {/* Main content area */}
      <div className="flex gap-4">
        {/* Content Area */}
