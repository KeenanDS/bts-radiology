
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Save } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";

interface PostFormProps {
  topic: string;
  setTopic: (topic: string) => void;
  additionalInfo: string;
  setAdditionalInfo: (info: string) => void;
  isGenerating: boolean;
  isGeneratingPost: boolean;
  generateTopic: () => Promise<void>;
  handleGeneratePost: () => Promise<void>;
  topicInputRef: React.RefObject<HTMLInputElement>;
}

const PostForm = ({
  topic,
  setTopic,
  additionalInfo,
  setAdditionalInfo,
  isGenerating,
  isGeneratingPost,
  generateTopic,
  handleGeneratePost,
  topicInputRef
}: PostFormProps) => {
  return (
    <motion.div
      initial={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
        <CardHeader>
          <CardTitle className="text-white text-2xl">Generate Blog Post</CardTitle>
          <CardDescription className="text-gray-400">
            Generate a new blog post by providing a topic and optional additional information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="topic" className="text-gray-300">Topic</Label>
            <div className="flex gap-2 relative">
              <Input 
                id="topic" 
                ref={topicInputRef}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter the blog post topic" 
                className={`bg-[#1a1f3d] border-[#2a2f4d] focus:border-[#3a3f6d] focus:ring-[#3a3f6d] text-white placeholder:text-gray-500 ${isGenerating ? 'animate-pulse' : ''}`}
              />
              {isGenerating && (
                <div className="absolute inset-y-0 right-12 flex items-center pr-3 pointer-events-none">
                  <div className="h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 bg-[#1a1f3d] hover:bg-[#2a2f5d]"
                      onClick={generateTopic}
                      disabled={isGenerating}
                    >
                      <Sparkles className={`h-4 w-4 ${isGenerating ? 'text-blue-400' : 'text-gray-400'}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Generate a topic using AI</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="additionalInfo" className="text-gray-300">Additional Information (Optional)</Label>
            <Textarea 
              id="additionalInfo" 
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              placeholder="Enter any additional information or context for the blog post"
              className="min-h-40 bg-[#1a1f3d] border-[#2a2f4d] focus:border-[#3a3f6d] focus:ring-[#3a3f6d] text-white placeholder:text-gray-500"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="bg-[#2a2f5d] hover:bg-[#3a3f7d] text-white border-none"
            onClick={handleGeneratePost}
            disabled={isGeneratingPost}
          >
            {isGeneratingPost ? (
              <>
                <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Generating...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Generate Post
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default PostForm;
