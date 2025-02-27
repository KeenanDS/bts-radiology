
import { useState } from "react";
import { motion } from "framer-motion";
import { 
  AlertTriangle, 
  CheckCircle, 
  BookOpen, 
  Loader2, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp,
  AlertCircle,
  AlertOctagon,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface FactCheckIssue {
  claim: string;
  issue: string;
  suggestion: string;
  source?: string;
  resolved?: boolean;
  severity?: "critical" | "major" | "minor";
  confidence?: number;
}

interface FactCheckIssueCardProps {
  issue: FactCheckIssue;
  index: number;
  isRetrying: boolean;
  isFixing: boolean;
  isFixed: boolean;
  onRetry: () => void;
  onRevise: () => void;
}

const FactCheckIssueCard = ({
  issue,
  index,
  isRetrying,
  isFixing,
  isFixed,
  onRetry,
  onRevise
}: FactCheckIssueCardProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Determine severity level if not provided
  const severity = issue.severity || 
    (issue.issue.toLowerCase().includes("incorrect") || 
     issue.issue.toLowerCase().includes("false") ? 
      "critical" : "major");

  // Map severity to UI elements
  const getSeverityBadge = () => {
    switch (severity) {
      case "critical":
        return (
          <Badge variant="destructive" className="ml-2 font-medium">
            <AlertCircle className="h-3 w-3 mr-1" />
            Critical
          </Badge>
        );
      case "major":
        return (
          <Badge variant="default" className="ml-2 bg-yellow-600 hover:bg-yellow-700 font-medium">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Major
          </Badge>
        );
      case "minor":
        return (
          <Badge variant="outline" className="ml-2 text-blue-400 border-blue-400 font-medium">
            <AlertOctagon className="h-3 w-3 mr-1" />
            Minor
          </Badge>
        );
      default:
        return null;
    }
  };

  // Confidence score UI element (if provided)
  const confidenceScore = issue.confidence ? (
    <Badge 
      variant="outline" 
      className={`ml-auto ${
        issue.confidence > 80 ? "border-green-500 text-green-500" : 
        issue.confidence > 50 ? "border-yellow-500 text-yellow-500" : 
        "border-red-500 text-red-500"
      }`}
    >
      {issue.confidence}% confidence
    </Badge>
  ) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
      transition={{ duration: 0.3 }}
      className={`p-4 rounded-md mb-4 ${
        isFixed
          ? "bg-green-900/20 border border-green-500/30"
          : "bg-[#1a1f3d] border border-[#2a2f4d]"
      }`}
    >
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-auto w-auto mr-2 text-gray-400 hover:text-white hover:bg-[#2a2f5d]"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </Button>
            <span className="text-yellow-400 font-medium">Issue #{index + 1}</span>
            {getSeverityBadge()}
            {confidenceScore}
          </div>
          {issue.source && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={issue.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-xs text-blue-400 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Source
                  </a>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View the source for this fact-check</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div>
              <p className="text-yellow-400 font-medium mb-1">Claim:</p>
              <p className="text-gray-300 text-sm bg-[#111936] p-3 rounded border border-[#2a2f4d]">
                "{issue.claim}"
              </p>
            </div>

            <div>
              <p className="text-red-400 font-medium mb-1">Issue:</p>
              <p className="text-gray-300 text-sm">{issue.issue}</p>
            </div>

            <div>
              <p className="text-green-400 font-medium mb-1">Suggestion:</p>
              <p className="text-gray-300 text-sm">{issue.suggestion}</p>
            </div>

            <div className="flex justify-end mt-4 space-x-2">
              {!isFixed && !issue.resolved && (
                <Button
                  onClick={onRetry}
                  disabled={isRetrying || isFixing}
                  variant="outline"
                  className="bg-transparent border-[#2a2f4d] text-gray-300 hover:bg-[#2a2f5d] hover:text-white"
                >
                  {isRetrying ? (
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
                onClick={onRevise}
                disabled={isFixing || isFixed || issue.resolved}
                className={
                  isFixed || issue.resolved
                    ? "bg-green-600 hover:bg-green-600 cursor-not-allowed"
                    : "bg-[#2a2f5d] hover:bg-[#3a3f7d]"
                }
              >
                {isFixing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Revising...
                  </>
                ) : isFixed || issue.resolved ? (
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
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default FactCheckIssueCard;
