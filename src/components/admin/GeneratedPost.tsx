
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Loader2, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface GeneratedPostProps {
  topic: string;
  generatedPost: string;
  onSave: () => Promise<void>;
  metaDescriptions: string[];
  selectedMetaDescription: string;
  setSelectedMetaDescription: (description: string) => void;
  isGeneratingMeta: boolean;
}

const GeneratedPost = ({ 
  topic, 
  generatedPost,
  onSave,
  metaDescriptions,
  selectedMetaDescription,
  setSelectedMetaDescription,
  isGeneratingMeta
}: GeneratedPostProps) => {
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave();
      setIsSaved(true);
    } catch (error) {
      console.error('Error saving post:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="grid grid-cols-1 md:grid-cols-5 gap-6"
    >
      <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50 md:col-span-3">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white text-2xl">Generated Blog Post</CardTitle>
            <CardDescription className="text-gray-400">
              Your AI-generated blog post based on the provided topic.
            </CardDescription>
          </div>
          {!isSaved ? (
            <Button 
              className="bg-[#2a2f5d] hover:bg-[#3a3f7d] text-white border-none"
              onClick={handleSave}
              disabled={isSaving || !selectedMetaDescription}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Post
                </>
              )}
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    className="bg-[#2a2f5d] hover:bg-[#3a3f7d] text-white border-none"
                    onClick={() => {/* Fact check functionality will be implemented later */}}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Fact Check
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Verify the accuracy of the generated content</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </CardHeader>
        <CardContent>
          <div className="prose prose-invert max-w-none">
            <div className="whitespace-pre-wrap bg-[#1a1f3d] p-4 rounded-md text-gray-200 font-mono text-sm overflow-auto max-h-[600px]">
              {generatedPost}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50 md:col-span-2">
        <CardHeader>
          <CardTitle className="text-white text-xl">Meta Description</CardTitle>
          <CardDescription className="text-gray-400">
            Select the best meta description for SEO.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isGeneratingMeta ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-400">Generating descriptions...</span>
            </div>
          ) : metaDescriptions.length > 0 ? (
            <RadioGroup
              value={selectedMetaDescription}
              onValueChange={setSelectedMetaDescription}
              className="space-y-4"
            >
              {metaDescriptions.map((description, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <RadioGroupItem
                    value={description}
                    id={`option-${index}`}
                    className="border-gray-600 text-white"
                  />
                  <Label
                    htmlFor={`option-${index}`}
                    className="text-sm text-gray-300 cursor-pointer leading-relaxed"
                  >
                    {description}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          ) : (
            <p className="text-gray-500">No meta descriptions generated yet.</p>
          )}
          
          {selectedMetaDescription && (
            <>
              <Separator className="my-4 bg-[#2a2f4d] opacity-50" />
              
              <div className="mt-4">
                <h4 className="text-white text-sm font-medium mb-2">Search Result Preview</h4>
                <div className="bg-white rounded-md p-3 text-black">
                  <div className="text-[#1a0dab] text-lg font-medium hover:underline cursor-pointer truncate">
                    {topic}
                  </div>
                  <div className="text-[#006621] text-xs mb-1">
                    www.beyondthescan.com
                  </div>
                  <div className="text-sm text-[#545454] min-h-[60px]">
                    {selectedMetaDescription}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  This is how your meta description will appear in search results.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default GeneratedPost;
