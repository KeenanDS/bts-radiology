
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Download, Mic, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/admin/Sidebar";
import { supabase } from "@/integrations/supabase/client";

interface PodcastGenerationResult {
  success: boolean;
  episodeId?: string;
  newsStories?: Array<{
    title: string;
    summary: string;
    source: string;
    date: string;
  }>;
  scriptPreview?: string;
  error?: string;
}

const PodcastPage = () => {
  const [date, setDate] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PodcastGenerationResult | null>(null);
  const { toast } = useToast();

  // Function to handle podcast generation
  const handleGeneratePodcast = async () => {
    if (!date) {
      toast({
        title: "Error",
        description: "Please select a date and time for the podcast.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);
    
    try {
      // Call the generate-podcast edge function
      const { data, error } = await supabase.functions.invoke<PodcastGenerationResult>(
        "generate-podcast",
        {
          body: {
            scheduledFor: date.toISOString(),
          },
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.success) {
        throw new Error(data?.error || "Failed to generate podcast");
      }

      console.log("Podcast generation result:", data);
      setResult(data);

      toast({
        title: "Success",
        description: `Podcast generated successfully for ${format(date, "PPP")}`,
      });
    } catch (error) {
      console.error("Error generating podcast:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate podcast",
        variant: "destructive",
      });
      
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0a0b17]">
      <Sidebar />
      
      <div className="flex-1 p-6 bg-gradient-to-br from-[#0a0b17] via-[#111936] to-[#0a0b17] overflow-auto">
        <div className="max-w-5xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Podcast Generator</h1>
            <p className="text-gray-400">Generate "Beyond the Scan" podcast content with the latest radiology news</p>
          </div>

          <Separator className="bg-[#2a2f4d] opacity-50" />

          <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
            <CardHeader>
              <CardTitle className="text-white text-2xl">Generate a New Podcast Episode</CardTitle>
              <CardDescription className="text-gray-400">
                Set a date for your podcast and our AI will collect recent radiology news stories 
                and generate a podcast script
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Episode Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal border-[#2a2f4d] bg-[#1a1f3d] text-white hover:bg-[#2a2f5d]",
                        !date && "text-gray-500"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : <span>Select date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-[#2a2f4d] bg-[#1a1f3d]">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button 
                className="w-full bg-[#2a2f5d] hover:bg-[#3a3f7d] text-white"
                size="lg"
                onClick={handleGeneratePodcast}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating Podcast...
                  </>
                ) : (
                  <>
                    <Mic className="mr-2 h-5 w-5" />
                    Generate Podcast
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {result && (
            <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50 mt-8">
              <CardHeader>
                <CardTitle className="text-white text-xl">
                  {result.success ? "Generation Results" : "Generation Failed"}
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {result.success 
                    ? `Successfully collected ${result.newsStories?.length || 0} news stories and generated a podcast script.` 
                    : `Error: ${result.error}`}
                </CardDescription>
              </CardHeader>
              {result.success && result.newsStories && (
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-white text-lg font-medium mb-3">News Stories</h3>
                    <div className="space-y-4">
                      {result.newsStories.map((story, index) => (
                        <div key={index} className="p-4 bg-[#1a1f3d] rounded-lg">
                          <h4 className="text-white font-medium">{story.title}</h4>
                          <p className="text-gray-300 mt-2 text-sm">{story.summary}</p>
                          <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
                            <span>{story.source}</span>
                            <span>{story.date}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {result.scriptPreview && (
                    <div>
                      <h3 className="text-white text-lg font-medium mb-3">Script Preview</h3>
                      <div className="p-4 bg-[#1a1f3d] rounded-lg">
                        <p className="text-gray-300 whitespace-pre-line">{result.scriptPreview}</p>
                        <p className="text-gray-400 mt-2 text-sm italic">... (Full script saved in database)</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-end">
                    <Button 
                      variant="outline" 
                      className="border-[#2a2f4d] bg-[#1a1f3d] text-white hover:bg-[#2a2f5d]"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export Full Script
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default PodcastPage;
