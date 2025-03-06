import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, RefreshCw, AlertTriangle, ClipboardCheck, Telescope } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import FactCheckIssueCard, { FactCheckIssue } from "./FactCheckIssueCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FactCheckResultsProps {
  issues: FactCheckIssue[];
  isLoading: boolean;
  postId?: string;
  onContentUpdated?: (newContent: string, fixedIndices?: number[]) => void;
  content?: string;
  onIgnoreIssue?: (index: number) => void;
  onFactCheckStatusChange?: (isChecking: boolean) => void;
}

const FactCheckResults = ({ 
  issues, 
  isLoading, 
  postId, 
  onContentUpdated, 
  content,
  onIgnoreIssue,
  onFactCheckStatusChange
}: FactCheckResultsProps) => {
  const [fixingIssues, setFixingIssues] = useState<Set<number>>(new Set());
  const [fixedIssues, setFixedIssues] = useState<Set<number>>(new Set());
  const [retryingIssues, setRetryingIssues] = useState<Set<number>>(new Set());
  const [isFixingAll, setIsFixingAll] = useState(false);
  const [factCheckStatus, setFactCheckStatus] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch fact check status if we have a postId
  useEffect(() => {
    if (postId) {
      const fetchFactCheckStatus = async () => {
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
            setFactCheckStatus("completed");
          } else {
            setFactCheckStatus("not_checked");
          }
        } catch (err) {
          console.error("Error in fact check status fetch:", err);
          setFactCheckStatus("error");
        }
      };
      
      fetchFactCheckStatus();
    }
  }, [postId]);

  const handleReviseIssue = async (index: number) => {
    if (!postId || !content) {
      toast({
        title: "Error",
        description: "Missing post ID or content for revision.",
        variant: "destructive",
      });
      return;
    }

    const issue = issues[index];
    
    // Update fixing state
    setFixingIssues(prev => {
      const newSet = new Set(prev);
      newSet.add(index);
      return newSet;
    });

    try {
      console.log(`Revising issue ${index}: ${issue.claim.substring(0, 30)}...`);
      
      // Call the revise-blog-post edge function
      const { data, error } = await supabase.functions.invoke('revise-blog-post', {
        body: JSON.stringify({
          postId,
          content,
          issue: issue.issue,
          claim: issue.claim,
          suggestion: issue.suggestion
        })
      });

      if (error) {
        console.error('Error invoking revise-blog-post function:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to revise content');
      }

      if (data.revisedContent) {
        console.log('Content revised successfully');
        
        // Update the content in the parent component
        if (onContentUpdated) {
          onContentUpdated(data.revisedContent, [index]);
        }
        
        // Mark this issue as fixed
        setFixedIssues(prev => {
          const newSet = new Set(prev);
          newSet.add(index);
          return newSet;
        });
        
        // Also mark the issue as resolved in the issues array
        issues[index] = {
          ...issues[index],
          resolved: true
        };
        
        // Force a re-render after the state updates have been applied
        setTimeout(() => {
          setFixedIssues(prev => new Set(prev));
        }, 100);
        
        toast({
          title: "Success",
          description: "Content has been revised successfully!",
        });
      } else {
        throw new Error("No revised content returned");
      }
    } catch (error) {
      console.error('Error revising content:', error);
      
      toast({
        title: "Error",
        description: "Failed to revise content. Please try again.",
        variant: "destructive",
      });
    } finally {
      // Clear the fixing state
      setFixingIssues(prev => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }
  };

  const handleRetryFactCheck = async (index: number) => {
    if (!content) {
      toast({
        title: "Error",
        description: "Missing content for fact checking.",
        variant: "destructive",
      });
      return;
    }

    const issue = issues[index];
    
    // Update retrying state
    setRetryingIssues(prev => {
      const newSet = new Set(prev);
      newSet.add(index);
      return newSet;
    });

    try {
      // We perform a targeted fact check on just this claim
      const claimContext = content.substring(
        Math.max(0, content.indexOf(issue.claim) - 200),
        Math.min(content.length, content.indexOf(issue.claim) + issue.claim.length + 200)
      );
      
      const { data, error } = await supabase.functions.invoke('fact-check-post', {
        body: JSON.stringify({
          content: claimContext,
          postId,
        })
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Fact check failed");
      }

      // If no issues were found in the re-check, we can mark this as resolved
      if (data.issues.length === 0) {
        setFixedIssues(prev => {
          const newSet = new Set(prev);
          newSet.add(index);
          return newSet;
        });
        
        toast({
          title: "Verified",
          description: "This claim has been verified as correct!",
        });
      } else {
        toast({
          title: "Issue Confirmed",
          description: "The issue with this claim still exists.",
        });
      }
    } catch (error) {
      console.error('Error fact-checking claim:', error);
      toast({
        title: "Error",
        description: "Failed to verify claim. Please try again.",
        variant: "destructive",
      });
    } finally {
      // Clear the retrying state
      setRetryingIssues(prev => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }
  };

  const handleManualFactCheck = async () => {
    if (!postId || !content) {
      toast({
        title: "Error",
        description: "Missing post ID or content for fact checking.",
        variant: "destructive",
      });
      return;
    }

    // Notify parent component we're checking facts
    if (onFactCheckStatusChange) {
      onFactCheckStatusChange(true);
    }
    
    setFactCheckStatus("checking");
    
    try {
      const { data, error } = await supabase.functions.invoke('fact-check-post', {
        body: JSON.stringify({
          postId,
          content
        })
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Fact check failed");
      }

      // Refresh the issues list
      window.location.reload();
      
      toast({
        title: "Success",
        description: "Fact check completed successfully!",
      });
      
      setFactCheckStatus("completed");
    } catch (error) {
      console.error('Error fact-checking post:', error);
      toast({
        title: "Error",
        description: "Failed to complete fact check. Please try again.",
        variant: "destructive",
      });
      setFactCheckStatus("error");
    } finally {
      // Notify parent component we're done checking facts
      if (onFactCheckStatusChange) {
        onFactCheckStatusChange(false);
      }
    }
  };

  // Handle ignore issue internally if no external handler is provided
  const handleIgnoreIssue = (index: number) => {
    if (onIgnoreIssue) {
      onIgnoreIssue(index);
    } else {
      toast({
        title: "Action not supported",
        description: "Cannot ignore issues in this context.",
        variant: "destructive",
      });
    }
  };

  // Handle revising all issues at once
  const handleReviseAll = async () => {
    if (!postId || !content) {
      toast({
        title: "Error",
        description: "Missing post ID or content for revision.",
        variant: "destructive",
      });
      return;
    }

    // Get only active (non-ignored, non-fixed) issues
    const activeIssues = issues.filter(issue => 
      !issue.ignored && 
      !fixedIssues.has(issues.indexOf(issue)) && 
      !issue.resolved
    );

    if (activeIssues.length === 0) {
      toast({
        title: "No issues to fix",
        description: "All issues have already been addressed.",
      });
      return;
    }

    setIsFixingAll(true);

    try {
      // Process each issue sequentially using the existing revise-blog-post function
      let currentContent = content;
      let successCount = 0;
      
      // Track which issues were successfully fixed
      const newlyFixedIssues = new Set<number>();
      
      for (const issue of activeIssues) {
        const issueIndex = issues.indexOf(issue);
        
        try {
          console.log(`Revising issue ${issueIndex}: ${issue.claim.substring(0, 30)}...`);
          
          // Call the revise-blog-post edge function for each issue
          const { data, error } = await supabase.functions.invoke('revise-blog-post', {
            body: JSON.stringify({
              postId,
              content: currentContent, // Use the most up-to-date content
              issue: issue.issue,
              claim: issue.claim,
              suggestion: issue.suggestion
            })
          });

          if (error) {
            console.error('Error invoking revise-blog-post function:', error);
            continue; // Try the next issue
          }

          if (!data.success || !data.revisedContent) {
            console.error('Failed to revise content for issue:', issueIndex);
            continue; // Try the next issue
          }

          // Update the current content for the next iteration
          currentContent = data.revisedContent;
          
          // Mark this issue as fixed
          newlyFixedIssues.add(issueIndex);
          
          successCount++;
        } catch (err) {
          console.error(`Error processing issue ${issueIndex}:`, err);
          // Continue with the next issue
        }
      }
      
      // Update all fixed issues at once
      if (newlyFixedIssues.size > 0) {
        setFixedIssues(prev => {
          const newSet = new Set(prev);
          newlyFixedIssues.forEach(index => newSet.add(index));
          return newSet;
        });
      }

      // Update the content in the parent component with the final version
      if (successCount > 0 && onContentUpdated) {
        // Convert the Set to an Array for passing to the parent
        const fixedIndicesArray = Array.from(newlyFixedIssues);
        onContentUpdated(currentContent, fixedIndicesArray);
        
        // Update the issues array to mark fixed issues as resolved
        const updatedIssues = [...issues];
        newlyFixedIssues.forEach(index => {
          updatedIssues[index] = {
            ...updatedIssues[index],
            resolved: true
          };
        });
        
        // Force a re-render of the component by updating the parent's issues array
        if (onContentUpdated) {
          // We're using onContentUpdated as a proxy to communicate with the parent
          // This is a bit of a hack, but it works for now
          setTimeout(() => {
            // Force a re-render after the state updates have been applied
            setFixedIssues(prev => new Set(prev));
          }, 100);
        }
        
        toast({
          title: "Success",
          description: `${successCount} ${successCount === 1 ? 'issue has' : 'issues have'} been revised successfully!`,
        });
      } else {
        throw new Error("No issues were successfully revised");
      }
    } catch (error) {
      console.error('Error revising all content:', error);
      
      toast({
        title: "Error",
        description: "Failed to revise all content. Please try addressing issues individually.",
        variant: "destructive",
      });
    } finally {
      setIsFixingAll(false);
    }
  };

  return (
    <>
      {isLoading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="space-y-6 py-4"
        >
          <div className="flex flex-col items-center justify-center py-8 space-y-6">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-900/30 text-blue-400">
              <Telescope className="h-8 w-8 animate-pulse" />
            </div>
            
            <div className="text-center space-y-2 max-w-xs mx-auto">
              <h3 className="text-lg font-medium text-blue-400">Analyzing Content</h3>
              <p className="text-sm text-gray-400">
                Our AI is verifying the accuracy of your content and checking for potential issues.
              </p>
            </div>
            
            <div className="flex items-center justify-center space-x-1.5 text-gray-500">
              <span className="h-2 w-2 bg-blue-400 rounded-full animate-ping"></span>
              <span className="h-2 w-2 bg-blue-400 rounded-full animate-ping [animation-delay:0.2s]"></span>
              <span className="h-2 w-2 bg-blue-400 rounded-full animate-ping [animation-delay:0.4s]"></span>
            </div>
          </div>
        </motion.div>
      ) : issues.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-900/30 text-green-400">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-green-400">Fact Check Complete</h3>
            <p className="text-sm text-gray-400 mt-1">
              No issues found. Your content is verified and ready to publish.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active Issues */}
          {issues.filter(issue => !issue.ignored).length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-400">Active Issues</h3>
              {issues.map((issue, index) => {
                if (issue.ignored) return null;
                
                return (
                  <FactCheckIssueCard
                    key={`issue-${index}`}
                    issue={issue}
                    index={index}
                    isFixing={fixingIssues.has(index)}
                    isFixed={fixedIssues.has(index)}
                    isRetrying={retryingIssues.has(index)}
                    onRevise={() => handleReviseIssue(index)}
                    onRetry={() => handleRetryFactCheck(index)}
                    onIgnore={() => onIgnoreIssue && onIgnoreIssue(index)}
                  />
                );
              })}
            </div>
          )}
          
          {/* Ignored Issues */}
          {issues.filter(issue => issue.ignored).length > 0 && (
            <div className="space-y-3 mt-6">
              <h3 className="text-sm font-medium text-gray-500">Ignored Issues</h3>
              {issues.map((issue, index) => {
                if (!issue.ignored) return null;
                
                return (
                  <FactCheckIssueCard
                    key={`ignored-${index}`}
                    issue={issue}
                    index={index}
                    isFixing={fixingIssues.has(index)}
                    isFixed={fixedIssues.has(index)}
                    isRetrying={retryingIssues.has(index)}
                    onRevise={() => handleReviseIssue(index)}
                    onRetry={() => handleRetryFactCheck(index)}
                    onIgnore={() => onIgnoreIssue && onIgnoreIssue(index)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default FactCheckResults;
