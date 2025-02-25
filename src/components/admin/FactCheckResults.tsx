
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

interface FactCheckIssue {
  claim: string;
  issue: string;
  suggestion: string;
}

interface FactCheckResultsProps {
  issues: FactCheckIssue[];
  isLoading: boolean;
}

const FactCheckResults = ({ issues, isLoading }: FactCheckResultsProps) => {
  const [fixedIssues, setFixedIssues] = useState<Set<number>>(new Set());

  const handleFixIssue = (index: number) => {
    setFixedIssues(prev => {
      const newSet = new Set(prev);
      newSet.add(index);
      return newSet;
    });
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
              
              <div className="flex justify-end mt-4">
                <Button
                  onClick={() => handleFixIssue(index)}
                  disabled={fixedIssues.has(index)}
                  className={
                    fixedIssues.has(index)
                      ? "bg-green-600 hover:bg-green-600 cursor-not-allowed"
                      : "bg-[#2a2f5d] hover:bg-[#3a3f7d]"
                  }
                >
                  {fixedIssues.has(index) ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Fixed
                    </>
                  ) : (
                    "Mark as Fixed"
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
