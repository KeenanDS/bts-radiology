import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { 
  CalendarIcon, 
  Download, 
  Mic, 
  Loader2, 
  Zap, 
  FileText, 
  Music, 
  History,
  AlertCircle,
  RefreshCw,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/admin/Sidebar";
import { supabase } from "@/integrations/supabase/client";
import AudioPlayer from "@/components/AudioPlayer";
import PodcastHistory from "@/components/podcast/PodcastHistory";

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
  details?: string;
  searchedTimeWindow?: number;
  searchAttempts?: Array<{
    daysBack: number;
    result: string;
  }>;
}

interface PodcastEpisode {
  id: string;
  podcast_script: string | null;
  news_stories: Array<{
    title: string;
    summary: string;
    source: string;
    date: string;
  }> | null;
  status: string;
  audio_url: string | null;
  error_message: string | null;
}

// Type guard to check if data is a valid podcast episode
function isPodcastEpisode(data: any): data is PodcastEpisode {
  return (
    data !== null &&
    typeof data === 'object' &&
    'id' in data
  );
}

const PodcastPage = () => {
  const [date, setDate] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingInstant, setIsGeneratingInstant] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [result, setResult] = useState<PodcastGenerationResult | null>(null);
  const [isFetchingFullScript, setIsFetchingFullScript] = useState(false);
  const [fullScript, setFullScript] = useState<string | null>(null);
  const [currentEpisodeId, setCurrentEpisodeId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [expandedTimeWindow, setExpandedTimeWindow] = useState(false);
  const { toast } = useToast();

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
    setFullScript(null);
    setCurrentEpisodeId(null);
    setAudioUrl(null);
    
    try {
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
      
      if (data.episodeId) {
        setCurrentEpisodeId(data.episodeId);
      }

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

  const handleGenerateInstantPodcast = async () => {
    setIsGeneratingInstant(true);
    setResult(null);
    setFullScript(null);
    setCurrentEpisodeId(null);
    setAudioUrl(null);
    setExpandedTimeWindow(false);
    
    try {
      const currentDate = new Date();
      
      toast({
        title: "Generating Podcast",
        description: "Creating an instant podcast with the latest news...",
      });

      setRetryCount(prev => prev + 1);
      
      const { data, error } = await supabase.functions.invoke<PodcastGenerationResult>(
        "generate-podcast",
        {
          body: {
            scheduledFor: currentDate.toISOString(),
            retry: retryCount,
          },
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.success) {
        throw new Error(data?.error || "Failed to generate instant podcast");
      }

      console.log("Instant podcast generation result:", data);
      setResult(data);
      
      if (data.episodeId) {
        setCurrentEpisodeId(data.episodeId);
      }

      const timeWindowMessage = data.searchedTimeWindow 
        ? ` (searched past ${data.searchedTimeWindow} days)`
        : "";

      toast({
        title: "Success",
        description: `Instant podcast generated successfully with latest news${timeWindowMessage}`,
      });
    } catch (error) {
      console.error("Error generating instant podcast:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Failed to generate instant podcast";
      const detailedMessage = errorMessage.includes("No relevant healthcare") 
        ? "No relevant healthcare news found in the recent timeframe. Try expanding the search window." 
        : errorMessage.includes("Perplexity") 
          ? "News service is temporarily unavailable. Please try again in a few minutes."
          : errorMessage;
      
      toast({
        title: "Error",
        description: detailedMessage,
        variant: "destructive",
      });
      
      setResult({
        success: false,
        error: errorMessage,
        details: "The podcast generation service is experiencing issues. This might be due to a lack of recent news stories or temporary problems with our news data provider."
      });
    } finally {
      setIsGeneratingInstant(false);
    }
  };

  const handleRetryGenerateInstant = (expandWindow = false) => {
    if (expandWindow) {
      setExpandedTimeWindow(true);
    }
    handleGenerateInstantPodcast();
  };

  const fetchFullScript = async () => {
    if (!currentEpisodeId) return;
    
    setIsFetchingFullScript(true);
    
    try {
      const { data, error } = await supabase
        .from("podcast_episodes")
        .select("podcast_script, audio_url, status, error_message")
        .eq("id", currentEpisodeId)
        .maybeSingle();
        
      if (error) throw error;
      
      console.log("Fetched episode data:", data);
      
      if (data) {
        if (data.podcast_script) {
          setFullScript(data.podcast_script);
        }
        
        if (data.audio_url) {
          setAudioUrl(data.audio_url);
        } else {
          setAudioUrl(null);
        }
      } else {
        toast({
          title: "Warning",
          description: "No data found for this episode.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching full script:", error);
      toast({
        title: "Error",
        description: "Failed to fetch the full podcast script",
        variant: "destructive",
      });
    } finally {
      setIsFetchingFullScript(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!currentEpisodeId) {
      toast({
        title: "Error",
        description: "No episode selected for audio generation.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingAudio(true);
    
    try {
      toast({
        title: "Generating Audio",
        description: "Converting podcast script to audio. This may take a few minutes...",
      });

      const { data, error } = await supabase.functions.invoke(
        "generate-podcast-audio",
        {
          body: { episodeId: currentEpisodeId },
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.success) {
        throw new Error(data?.error || "Failed to generate podcast audio");
      }

      console.log("Audio generation result:", data);
      
      setAudioUrl(data.audioUrl);

      toast({
        title: "Success",
        description: "Podcast audio generated successfully!",
      });
    } catch (error) {
      console.error("Error generating podcast audio:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate podcast audio",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleDownloadAudio = () => {
    if (!audioUrl) return;
    
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `podcast_episode_${currentEpisodeId}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (currentEpisodeId) {
      fetchFullScript();
    }
  }, [currentEpisodeId]);

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

          <Tabs defaultValue="generate" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-6 bg-[#1a1f3d] text-gray-400">
              <TabsTrigger value="generate" className="data-[state=active]:bg-[#2a2f5d] data-[state=active]:text-white">
                <Mic className="mr-2 h-4 w-4" />
                Generate Podcast
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-[#2a2f5d] data-[state=active]:text-white">
                <History className="mr-2 h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="generate" className="space-y-8">
              {audioUrl && (
                <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
                  <CardHeader>
                    <CardTitle className="text-white text-xl">Generated Podcast</CardTitle>
                    <CardDescription className="text-gray-400">
                      Listen to your generated podcast
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <AudioPlayer 
                      audioUrl={audioUrl} 
                      title="Beyond the Scan"
                      subtitle="Latest Radiology News"
                    />
                  </CardContent>
                </Card>
              )}

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
                    disabled={isLoading || isGeneratingInstant}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Generating Podcast...
                      </>
                    ) : (
                      <>
                        <Mic className="mr-2 h-5 w-5" />
                        Generate Scheduled Podcast
                      </>
                    )}
                  </Button>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-[#2a2f4d]" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-[#111936] px-2 text-gray-400">or</span>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full bg-gradient-to-r from-[#3a3f7d] to-[#6366f1] hover:from-[#4a4f8d] hover:to-[#7376ff] text-white"
                    size="lg"
                    onClick={handleGenerateInstantPodcast}
                    disabled={isLoading || isGeneratingInstant}
                  >
                    {isGeneratingInstant ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Generating Instant Podcast...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-5 w-5" />
                        Generate Instant Podcast
                      </>
                    )}
                  </Button>
                  
                  {expandedTimeWindow && (
                    <div className="flex items-center justify-center gap-2 text-sm text-amber-300">
                      <Clock className="h-4 w-4" />
                      <span>Searching with expanded time window (up to 30 days)</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {result && (
                <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50 mt-8">
                  <CardHeader>
                    <CardTitle className="text-white text-xl flex items-center gap-2">
                      {result.success ? (
                        "Generation Results"
                      ) : (
                        <>
                          <AlertCircle className="h-5 w-5 text-red-500" /> 
                          Generation Failed
                        </>
                      )}
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      {result.success 
                        ? `Successfully collected ${result.newsStories?.length || 0} news stories${result.searchedTimeWindow ? ` from the past ${result.searchedTimeWindow} days` : ''} and generated a podcast script.` 
                        : `Error: ${result.error}`}
                    </CardDescription>
                  </CardHeader>
                  
                  {!result.success && (
                    <CardContent className="space-y-6">
                      <div className="p-4 bg-[#1a1f3d] rounded-lg border border-red-900/30">
                        <h4 className="text-white font-medium mb-2">Error Details</h4>
                        <p className="text-gray-300 mb-4">{result.details || "An error occurred during podcast generation. This might be due to temporary issues with our services."}</p>
                        
                        <div className="flex flex-wrap gap-3">
                          <Button 
                            onClick={() => handleRetryGenerateInstant(false)}
                            className="bg-[#2a2f5d] hover:bg-[#3a3f7d] text-white"
                            disabled={isGeneratingInstant}
                          >
                            {isGeneratingInstant ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            Retry Generation
                          </Button>
                          
                          {result.error?.includes("No relevant healthcare") && (
                            <Button 
                              onClick={() => handleRetryGenerateInstant(true)}
                              className="bg-amber-700 hover:bg-amber-800 text-white"
                              disabled={isGeneratingInstant || expandedTimeWindow}
                            >
                              {isGeneratingInstant ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Clock className="mr-2 h-4 w-4" />
                              )}
                              Try with Expanded Time Window
                            </Button>
                          )}
                        </div>
                        
                        {result.searchAttempts && result.searchAttempts.length > 0 && (
                          <div className="mt-4">
                            <h5 className="text-sm font-medium text-gray-300 mb-2">Search Attempts</h5>
                            <div className="space-y-1 text-xs text-gray-400">
                              {result.searchAttempts.map((attempt, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span>• Past {attempt.daysBack} days:</span>
                                  <span className={attempt.result.includes("No") ? "text-red-400" : "text-green-400"}>
                                    {attempt.result}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                  
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
                      
                      {(result.scriptPreview || fullScript) && (
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <h3 className="text-white text-lg font-medium">Podcast Script</h3>
                            <div className="flex gap-2">
                              {currentEpisodeId && !fullScript && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={fetchFullScript}
                                  disabled={isFetchingFullScript}
                                  className="border-[#2a2f4d] bg-[#1a1f3d] text-white hover:bg-[#2a2f5d]"
                                >
                                  {isFetchingFullScript ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <FileText className="mr-2 h-4 w-4" />
                                      View Full Script
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="p-4 bg-[#1a1f3d] rounded-lg max-h-[600px] overflow-y-auto">
                            {fullScript ? (
                              <p className="text-gray-300 whitespace-pre-line">{fullScript}</p>
                            ) : (
                              <>
                                <p className="text-gray-300 whitespace-pre-line">{result.scriptPreview}</p>
                                <p className="text-gray-400 mt-2 text-sm italic">
                                  ... (Click "View Full Script" to see the complete podcast content)
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap justify-end gap-3">
                        <Button 
                          variant="outline" 
                          className="border-[#2a2f4d] bg-[#1a1f3d] text-white hover:bg-[#2a2f5d]"
                          onClick={() => {
                            if (!fullScript) return;
                            
                            const element = document.createElement("a");
                            const file = new Blob([fullScript], {type: 'text/plain'});
                            element.href = URL.createObjectURL(file);
                            element.download = "podcast_script.txt";
                            document.body.appendChild(element);
                            element.click();
                            document.body.removeChild(element);
                          }}
                          disabled={!fullScript}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Export Script
                        </Button>
                        
                        {currentEpisodeId && fullScript && !audioUrl && (
                          <Button 
                            className="bg-gradient-to-r from-[#3a3f7d] to-[#6366f1] hover:from-[#4a4f8d] hover:to-[#7376ff] text-white"
                            onClick={handleGenerateAudio}
                            disabled={isGeneratingAudio}
                          >
                            {isGeneratingAudio ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating Audio...
                              </>
                            ) : (
                              <>
                                <Music className="mr-2 h-4 w-4" />
                                Generate Podcast Audio
                              </>
                            )}
                          </Button>
                        )}
                        
                        {audioUrl && (
                          <Button 
                            variant="outline" 
                            className="border-[#2a2f4d] bg-[#1a1f3d] text-white hover:bg-[#2a2f5d]"
                            onClick={handleDownloadAudio}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download Audio
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="history">
              <PodcastHistory />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default PodcastPage;
