import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
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
    
    setFixingIssues(prev => {
      const newSet = new Set(prev);
      newSet.add(index);
      return newSet;
    });

    try {
      const { data, error } = await supabase.functions.invoke('fact-check-post', {
        body: JSON.stringify({
          action: 'revise',
          postId,
          issueIndex: index,
          claim: issue.claim,
          issue: issue.issue,
          suggestion: issue.suggestion,
          content
        })
      });

      if (error) throw error;

      if (data.success && data.revisedContent) {
        // Update the content in the parent component
        if (onContentUpdated) {
          onContentUpdated(data.revisedContent);
        }
        
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
        throw new Error("Failed to revise content");
      }
    } catch (error) {
      console.error('Error revising content:', error);
      toast({
        title: "Error",
        description: "Failed to revise content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setFixingIssues(prev => {
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
          Fact Check Results
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {issues.map((issue, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className={`p-4 rounded-md ${
              fixedIssues.has(index)
                ? "bg-green-900/20 border border-green-500/30"
                : "bg-[#1a1f3d] border border-[#2a2f4d]"
            }`}
          >
            <div className="space-y-2">
              <p className="text-yellow-400 font-medium">Claim:</p>
              <p className="text-gray-300 text-sm">{issue.claim}</p>
              
              <p className="text-red-400 font-medium">Issue:</p>
              <p className="text-gray-300 text-sm">{issue.issue}</p>
              
              <p className="text-green-400 font-medium">Suggestion:</p>
              <p className="text-gray-300 text-sm">{issue.suggestion}</p>
              
              {issue.source && (
                <>
                  <p className="text-blue-400 font-medium">Source:</p>
                  <p className="text-gray-300 text-sm">
                    <a 
                      href={issue.source} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      {issue.source}
                    </a>
                  </p>
                </>
              )}
              
              <div className="flex justify-end mt-4">
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
      </CardContent>
    </Card>
  );
};

export default FactCheckResults;
