
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Loader2, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import FactCheckResults from "./FactCheckResults";

interface GeneratedPostProps {
  topic: string;
  generatedPost: string;
  onSave?: () => Promise<void>;
  metaDescriptions: string[];
  selectedMetaDescription: string;
  setSelectedMetaDescription: (description: string) => void;
  isGeneratingMeta: boolean;
}

// Define the structure of raw issues returned from the API
interface RawFactCheckIssue {
  quote: string;
  explanation: string;
  correction: string;
  source?: string;
}

// Define the structure used by the FactCheckResults component
interface FactCheckIssue {
  claim: string;
  issue: string;
  suggestion: string;
  source?: string;
  resolved?: boolean;
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
  const [isFactChecking, setIsFactChecking] = useState(false);
  const [factCheckIssues, setFactCheckIssues] = useState<FactCheckIssue[]>([]);
  const [showFactCheck, setShowFactCheck] = useState(false);
  const [currentContent, setCurrentContent] = useState(generatedPost);
  const [postId, setPostId] = useState<string | null>(null);
  const { toast } = useToast();

  // Update currentContent when generatedPost changes
  useEffect(() => {
    setCurrentContent(generatedPost);
  }, [generatedPost]);

  const handleSave = async () => {
    if (!selectedMetaDescription) {
      toast({
        title: "Error",
        description: "Please select a meta description before saving.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Call the onSave prop if provided (for backward compatibility)
      if (onSave) {
        await onSave();
      } else {
        // Save the post to the database
        const { data, error } = await supabase
          .from('blog_posts')
          .insert([
            {
              title: topic,
              content: currentContent,
              meta_description: selectedMetaDescription
            }
          ])
          .select('id')
          .single();

        if (error) throw error;

        // Store the post ID for future operations
        if (data && data.id) {
          setPostId(data.id);
        }
      }

      setIsSaved(true);
      toast({
        title: "Success",
        description: "Post saved successfully!",
      });
    } catch (error) {
      console.error('Error saving post:', error);
      toast({
        title: "Error",
        description: "Failed to save the post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Transform raw API issues to the format expected by FactCheckResults
  const mapApiIssues = (rawIssues: RawFactCheckIssue[]): FactCheckIssue[] => {
    console.log('Mapping API issues:', rawIssues);
    
    if (!Array.isArray(rawIssues)) {
      console.error('Expected issues to be an array, got:', typeof rawIssues);
      return [];
    }

    return rawIssues.map(issue => ({
      claim: issue.quote,
      issue: issue.explanation,
      suggestion: issue.correction,
      source: issue.source,
      resolved: false
    }));
  };

  const handleFactCheck = async () => {
    setIsFactChecking(true);
    setShowFactCheck(true);
    
    try {
      // Log the content being sent for fact-checking
      console.log(`Sending content for fact-checking (${currentContent.length} characters)`);
      console.log('Content preview:', currentContent.substring(0, 100) + '...');
      
      const { data, error } = await supabase.functions.invoke('fact-check-post', {
        body: JSON.stringify({ 
          content: currentContent,
          postId
        })
      });

      if (error) throw error;
      
      console.log('Raw fact check response:', data);
      
      if (!data.success) {
        throw new Error(data.error || "Unknown error during fact check");
      }

      // Transform API response to the format expected by the FactCheckResults component
      const transformedIssues = mapApiIssues(data.issues);
      setFactCheckIssues(transformedIssues);
      
      toast({
        title: "Fact Check Complete",
        description: transformedIssues.length > 0 
          ? `Found ${transformedIssues.length} potential issues` 
          : "No issues found!",
      });
    } catch (error) {
      console.error('Error fact-checking post:', error);
      toast({
        title: "Error",
        description: "Failed to complete fact check. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsFactChecking(false);
    }
  };

  const handleContentUpdated = (newContent: string) => {
    setCurrentContent(newContent);
    
    // Update the post in the database if it's already saved
    if (postId) {
      updatePostInDatabase(newContent);
    }
  };

  const updatePostInDatabase = async (content: string) => {
    try {
      const { error } = await supabase
        .from('blog_posts')
        .update({ 
          content,
          updated_at: new Date().toISOString()
        })
        .eq('id', postId);

      if (error) {
        console.error('Error updating post in database:', error);
        toast({
          title: "Warning",
          description: "Content was revised but database update failed.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating post:', error);
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
                    onClick={handleFactCheck}
                    disabled={isFactChecking}
                  >
                    {isFactChecking ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Fact Check
                      </>
                    )}
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
              {currentContent}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="md:col-span-2">
        {showFactCheck ? (
          <FactCheckResults 
            issues={factCheckIssues}
            isLoading={isFactChecking}
            postId={postId}
            content={currentContent}
            onContentUpdated={handleContentUpdated}
          />
        ) : (
          <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
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
        )}
      </div>
    </motion.div>
  );
};

export default GeneratedPost;
