import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import FactCheckIssueCard, { FactCheckIssue } from "./FactCheckIssueCard";
import { Button } from "@/components/ui/button";

interface FactCheckResultsProps {
  issues: FactCheckIssue[];
  isLoading: boolean;
  postId?: string;
  onContentUpdated?: (newContent: string, fixedIndices?: number[]) => void;
  content?: string;
  onIgnoreIssue?: (index: number) => void;
}

const FactCheckResults = ({ 
  issues, 
  isLoading, 
  postId, 
  onContentUpdated, 
  content,
  onIgnoreIssue
}: FactCheckResultsProps) => {
  const [fixingIssues, setFixingIssues] = useState<Set<number>>(new Set());
  const [fixedIssues, setFixedIssues] = useState<Set<number>>(new Set());
  const [retryingIssues, setRetryingIssues] = useState<Set<number>>(new Set());
  const [isFixingAll, setIsFixingAll] = useState(false);
  const { toast } = useToast();

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

  if (isLoading) {
    return (
      <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
        <CardContent className="flex flex-col items-center justify-center p-8 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <span className="text-gray-400 text-center">
            AI is checking facts in your content<br/>
            <span className="text-xs opacity-70">This may take a minute...</span>
          </span>
        </CardContent>
      </Card>
    );
  }

  if (issues.length === 0) {
    return (
      <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
        <CardContent className="flex flex-col items-center justify-center p-8 text-green-400 space-y-3">
          <CheckCircle className="h-10 w-10" />
          <span className="text-center">All facts verified!</span>
          <p className="text-gray-400 text-sm text-center max-w-md">
            The AI fact-checker has analyzed your content and found no factual issues.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Filter out ignored issues
  const activeIssues = issues.filter(issue => !issue.ignored);
  // Count unfixed active issues - consider both fixedIssues state and resolved flag
  const unfixedActiveIssues = activeIssues.filter(issue => 
    !fixedIssues.has(issues.indexOf(issue)) && !issue.resolved
  );
  
  // Determine if all issues have been addressed
  const allIssuesAddressed = activeIssues.length > 0 && unfixedActiveIssues.length === 0;

  return (
    <div className="space-y-4">
      {/* Issues list */}
      <div className="space-y-2">
        <AnimatePresence>
          {activeIssues.length === 0 || allIssuesAddressed ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-6 text-center"
            >
              <CheckCircle className="h-12 w-12 text-emerald-500 mb-2" />
              <p className="text-gray-300">All issues have been addressed!</p>
            </motion.div>
          ) : (
            activeIssues.map((issue, index) => (
              <FactCheckIssueCard
                key={`issue-${index}`}
                issue={issue}
                index={issues.indexOf(issue)}
                isRetrying={retryingIssues.has(issues.indexOf(issue))}
                isFixing={fixingIssues.has(issues.indexOf(issue))}
                isFixed={fixedIssues.has(issues.indexOf(issue)) || issue.resolved}
                onRetry={() => handleRetryFactCheck(issues.indexOf(issue))}
                onRevise={() => handleReviseIssue(issues.indexOf(issue))}
                onIgnore={() => handleIgnoreIssue(issues.indexOf(issue))}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Revise All button - only show if there are unfixed active issues */}
      {unfixedActiveIssues.length > 0 && (
        <div className="flex justify-center mt-6 border-t border-[#2a2f4d] pt-6">
          <Button
            onClick={handleReviseAll}
            disabled={isFixingAll}
            className="bg-[#2a2f5d] hover:bg-[#3a3f7d] text-white border-none px-6"
          >
            {isFixingAll ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Revising All Issues...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-5 w-5" />
                Revise All Issues ({unfixedActiveIssues.length})
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default FactCheckResults;
