
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCircle, RefreshCw, Filter } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import FactCheckIssueCard, { FactCheckIssue } from "./FactCheckIssueCard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface FactCheckResultsProps {
  issues: FactCheckIssue[];
  isLoading: boolean;
  postId?: string;
  onContentUpdated?: (newContent: string) => void;
  content?: string;
}

type SortOption = "newest" | "severity" | "confidence";
type FilterOption = "all" | "fixed" | "unfixed" | "critical" | "major" | "minor";

const FactCheckResults = ({ 
  issues, 
  isLoading, 
  postId, 
  onContentUpdated, 
  content 
}: FactCheckResultsProps) => {
  const [fixingIssues, setFixingIssues] = useState<Set<number>>(new Set());
  const [fixedIssues, setFixedIssues] = useState<Set<number>>(new Set());
  const [retryingIssues, setRetryingIssues] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
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

  // Filter and sort issues
  const processedIssues = [...issues]
    .filter(issue => {
      if (filterBy === "all") return true;
      if (filterBy === "fixed") return fixedIssues.has(issues.indexOf(issue)) || issue.resolved;
      if (filterBy === "unfixed") return !fixedIssues.has(issues.indexOf(issue)) && !issue.resolved;
      if (filterBy === "critical" || filterBy === "major" || filterBy === "minor") {
        return issue.severity === filterBy || 
          (filterBy === "critical" && 
           !issue.severity && 
           (issue.issue.toLowerCase().includes("incorrect") || 
            issue.issue.toLowerCase().includes("false")));
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "severity") {
        const severityOrder = { critical: 0, major: 1, minor: 2, undefined: 3 };
        const aSeverity = a.severity || 
          (a.issue.toLowerCase().includes("incorrect") || 
           a.issue.toLowerCase().includes("false") ? 
            "critical" : "major");
        const bSeverity = b.severity || 
          (b.issue.toLowerCase().includes("incorrect") || 
           b.issue.toLowerCase().includes("false") ? 
            "critical" : "major");
        return severityOrder[aSeverity as keyof typeof severityOrder] - 
               severityOrder[bSeverity as keyof typeof severityOrder];
      }
      if (sortBy === "confidence" && a.confidence && b.confidence) {
        return b.confidence - a.confidence;
      }
      // Default to newest
      return 0;
    });

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

  return (
    <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
      <CardHeader className="pb-0">
        <CardTitle className="text-white text-xl flex items-center">
          <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
          Fact Check Results
          <span className="ml-2 text-sm bg-[#2a2f4d] px-2 py-0.5 rounded-full text-gray-300">
            {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
          </span>
        </CardTitle>

        <div className="flex items-center justify-between mt-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="bg-transparent border-[#2a2f4d] text-gray-300 hover:bg-[#2a2f5d]">
                <Filter className="mr-2 h-4 w-4" />
                {filterBy === "all" ? "All issues" : 
                 filterBy === "fixed" ? "Fixed issues" :
                 filterBy === "unfixed" ? "Unfixed issues" :
                 `${filterBy.charAt(0).toUpperCase() + filterBy.slice(1)} severity`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#1a1f3d] border-[#2a2f4d] text-gray-200">
              <DropdownMenuLabel>Filter By</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#2a2f4d]" />
              <DropdownMenuItem 
                className={filterBy === "all" ? "bg-[#2a2f5d]" : "hover:bg-[#2a2f5d]"}
                onClick={() => setFilterBy("all")}
              >
                All issues
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={filterBy === "unfixed" ? "bg-[#2a2f5d]" : "hover:bg-[#2a2f5d]"}
                onClick={() => setFilterBy("unfixed")}
              >
                Unfixed issues
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={filterBy === "fixed" ? "bg-[#2a2f5d]" : "hover:bg-[#2a2f5d]"}
                onClick={() => setFilterBy("fixed")}
              >
                Fixed issues
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#2a2f4d]" />
              <DropdownMenuItem 
                className={filterBy === "critical" ? "bg-[#2a2f5d]" : "hover:bg-[#2a2f5d]"}
                onClick={() => setFilterBy("critical")}
              >
                Critical severity
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={filterBy === "major" ? "bg-[#2a2f5d]" : "hover:bg-[#2a2f5d]"}
                onClick={() => setFilterBy("major")}
              >
                Major severity
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={filterBy === "minor" ? "bg-[#2a2f5d]" : "hover:bg-[#2a2f5d]"}
                onClick={() => setFilterBy("minor")}
              >
                Minor severity
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="bg-transparent border-[#2a2f4d] text-gray-300 hover:bg-[#2a2f5d]">
                <RefreshCw className="mr-2 h-4 w-4" />
                Sort: {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#1a1f3d] border-[#2a2f4d] text-gray-200">
              <DropdownMenuLabel>Sort By</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#2a2f4d]" />
              <DropdownMenuItem 
                className={sortBy === "newest" ? "bg-[#2a2f5d]" : "hover:bg-[#2a2f5d]"}
                onClick={() => setSortBy("newest")}
              >
                Newest
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={sortBy === "severity" ? "bg-[#2a2f5d]" : "hover:bg-[#2a2f5d]"}
                onClick={() => setSortBy("severity")}
              >
                Severity
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={sortBy === "confidence" ? "bg-[#2a2f5d]" : "hover:bg-[#2a2f5d]"}
                onClick={() => setSortBy("confidence")}
              >
                Confidence
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="pt-4">
        <AnimatePresence>
          {processedIssues.map((issue, index) => {
            const originalIndex = issues.indexOf(issue);
            return (
              <FactCheckIssueCard
                key={originalIndex}
                issue={issue}
                index={originalIndex}
                isRetrying={retryingIssues.has(originalIndex)}
                isFixing={fixingIssues.has(originalIndex)}
                isFixed={fixedIssues.has(originalIndex)}
                onRetry={() => handleRetryFactCheck(originalIndex)}
                onRevise={() => handleReviseIssue(originalIndex)}
              />
            );
          })}
        </AnimatePresence>

        {processedIssues.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            No issues match your current filter settings
          </div>
        )}
      </CardContent>

      {processedIssues.length > 0 && (
        <CardFooter className="flex justify-between border-t border-[#2a2f4d] pt-4">
          <div className="text-sm text-gray-400">
            Showing {processedIssues.length} of {issues.length} issues
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterBy("all")}
            className="bg-transparent border-[#2a2f4d] text-gray-300 hover:bg-[#2a2f5d]"
            disabled={filterBy === "all"}
          >
            Show all
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default FactCheckResults;
