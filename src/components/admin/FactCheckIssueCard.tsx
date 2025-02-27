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
  ExternalLink,
  XCircle
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
  ignored?: boolean;
}

interface FactCheckIssueCardProps {
  issue: FactCheckIssue;
  index: number;
  isRetrying: boolean;
  isFixing: boolean;
  isFixed: boolean;
  onRetry: () => void;
  onRevise: () => void;
  onIgnore: () => void;
}

const FactCheckIssueCard = ({
  issue,
  index,
  isRetrying,
  isFixing,
  isFixed,
  onRetry,
  onRevise,
  onIgnore
}: FactCheckIssueCardProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Determine severity level if not provided
  const severity = issue.severity || 
    (issue.issue.toLowerCase().includes("incorrect") || 
     issue.issue.toLowerCase().includes("false") ? 
      "critical" : "major");

  // Map severity to UI elements - Removing all badges as requested
  const getSeverityBadge = () => {
    return null;
  };

  // Confidence score UI element - Removing as requested
  const confidenceScore = null;

  // If the issue is ignored, display in a muted style
  if (issue.ignored) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
        transition={{ duration: 0.3 }}
        className="p-4 rounded-md mb-4 bg-[#1a1f3d]/50 border border-[#2a2f4d]/50 opacity-60"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <span className="text-gray-400 font-medium">Issue #{index + 1} (Ignored)</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white hover:bg-[#2a2f5d]"
            onClick={onIgnore}
          >
            Restore
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
      transition={{ duration: 0.3 }}
      className={`p-4 rounded-md mb-4 ${
        isFixed
          ? "bg-[#1a1f3d]/80 border border-emerald-500/30"
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
            <span className="text-white font-medium">Issue #{index + 1}</span>
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
            className="space-y-5 mt-3"
          >
            <div>
              <p className="text-white font-medium mb-2 text-sm uppercase tracking-wide">Claim:</p>
              <div className="bg-[#111936] p-4 rounded border border-[#2a2f4d]">
                <p className="text-gray-300 text-sm leading-relaxed">"{issue.claim}"</p>
              </div>
            </div>

            <div>
              <p className="text-white font-medium mb-2 text-sm uppercase tracking-wide">Issue:</p>
              <div className="bg-[#111936] p-4 rounded border border-[#2a2f4d]">
                <p className="text-gray-300 text-sm leading-relaxed">{issue.issue}</p>
              </div>
            </div>

            <div>
              <p className="text-white font-medium mb-2 text-sm uppercase tracking-wide">Suggestion:</p>
              <div className="bg-[#111936] p-4 rounded border border-[#2a2f4d]">
                <p className="text-gray-300 text-sm leading-relaxed">{issue.suggestion}</p>
              </div>
            </div>

            <div className="flex justify-end mt-5 space-x-2">
              {!isFixed && !issue.resolved && (
                <>
                  <Button
                    onClick={onIgnore}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white hover:bg-[#2a2f5d]"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Ignore
                  </Button>
                  
                  <Button
                    onClick={onRevise}
                    variant="outline"
                    size="sm"
                    disabled={isFixing}
                    className="bg-[#2a2f5d] hover:bg-[#3a3f7d] text-white border-none"
                  >
                    {isFixing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Revising...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Revise
                      </>
                    )}
                  </Button>
                </>
              )}

              {isFixed && (
                <div className="flex items-center text-emerald-500 text-sm">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Issue addressed
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default FactCheckIssueCard;
