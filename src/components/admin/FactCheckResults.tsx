
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCircle, RefreshCw, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface FactCheckIssue {
  claim: string;
  issue: string;
  suggestion: string;
  source?: string;
  resolved?: boolean;
}

interface FactCheckResultsProps {
  issues: FactCheckIssue[];
  isLoading: boolean;
  postId?: string;
  onContentUpdated?: (newContent: string) => void;
  content?: string;
}

const FactCheckResults = ({ issues, isLoading, postId, onContentUpdated, content }: FactCheckResultsProps) => {
  const [fixingIssues, setFixingIssues] = useState<Set<number>>(new Set());
  const [fixedIssues, setFixedIssues] = useState<Set<number>>(new Set());
  const [retryingIssues, setRetryingIssues] = useState<Set<number>>(new Set());
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
      
      // Call the new revise-blog-post edge function
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
          onContentUpdated(data.revisedContent);
        }
        
        // Mark this issue as fixed
        setFixedIssues(prev => {
          const newSet = new Set(prev);
          newSet.add(index);
          return newSet;
        });
        
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

  if (isLoading) {
    return (
      <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
          <span className="text-gray-400">Checking facts...</span>
        </CardContent>
      </Card>
    );
  }

  if (issues.length === 0) {
    return (
      <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
        <CardContent className="flex items-center justify-center p-8 text-green-400">
          <CheckCircle className="h-6 w-6 mr-2" />
          <span>No factual issues found!</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
      <CardHeader>
        <CardTitle className="text-white text-xl flex items-center">
          <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
          Fact Check Results ({issues.length} issues found)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <AnimatePresence>
          {issues.map((issue, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className={`p-4 rounded-md ${
                fixedIssues.has(index)
                  ? "bg-green-900/20 border border-green-500/30"
                  : "bg-[#1a1f3d] border border-[#2a2f4d]"
              }`}
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <p className="text-yellow-400 font-medium">Claim:</p>
                  {issue.source && (
                    <a 
                      href={issue.source} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center text-xs text-blue-400 hover:underline"
                    >
                      <BookOpen className="h-3 w-3 mr-1" />
                      Source
                    </a>
                  )}
                </div>
                <p className="text-gray-300 text-sm bg-[#111936] p-2 rounded border border-[#2a2f4d]">
                  "{issue.claim}"
                </p>
                
                <p className="text-red-400 font-medium">Issue:</p>
                <p className="text-gray-300 text-sm">{issue.issue}</p>
                
                <p className="text-green-400 font-medium">Suggestion:</p>
                <p className="text-gray-300 text-sm">{issue.suggestion}</p>
                
                <div className="flex justify-end mt-4 space-x-2">
                  {!fixedIssues.has(index) && !issue.resolved && (
                    <Button
                      onClick={() => handleRetryFactCheck(index)}
                      disabled={retryingIssues.has(index) || fixingIssues.has(index)}
                      variant="outline"
                      className="bg-transparent border-[#2a2f4d] text-gray-300 hover:bg-[#2a2f5d] hover:text-white"
                    >
                      {retryingIssues.has(index) ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Verify
                        </>
                      )}
                    </Button>
                  )}
                  
                  <Button
                    onClick={() => handleReviseIssue(index)}
                    disabled={fixingIssues.has(index) || fixedIssues.has(index) || issue.resolved}
                    className={
                      fixedIssues.has(index) || issue.resolved
                        ? "bg-green-600 hover:bg-green-600 cursor-not-allowed"
                        : "bg-[#2a2f5d] hover:bg-[#3a3f7d]"
                    }
                  >
                    {fixingIssues.has(index) ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Revising...
                      </>
                    ) : fixedIssues.has(index) || issue.resolved ? (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Revised
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Revise
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};

export default FactCheckResults;
