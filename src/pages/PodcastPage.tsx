
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Download, Mic, Loader2, Zap, FileText, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/admin/Sidebar";
import { supabase } from "@/integrations/supabase/client";
import AudioPlayer from "@/components/AudioPlayer";

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

interface AudioGenerationResult {
  success: boolean;
  episodeId?: string;
  audioUrl?: string;
  error?: string;
}

interface PodcastEpisode {
  id: string;
  podcast_script: string;
  news_stories: Array<{
    title: string;
    summary: string;
    source: string;
    date: string;
  }>;
  status: string;
  audio_url: string | null;
  voice_id: string | null;
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
  const [episodeStatus, setEpisodeStatus] = useState<string>("pending");
  const { toast } = useToast();

  // Function to handle scheduled podcast generation
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
      
      if (data.episodeId) {
        setCurrentEpisodeId(data.episodeId);
        // Check episode status
        const { data: episodeData } = await supabase
          .from("podcast_episodes")
          .select("status")
          .eq("id", data.episodeId)
          .single();
          
        if (episodeData) {
          setEpisodeStatus(episodeData.status);
        }
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

  // Function to handle instant podcast generation
  const handleGenerateInstantPodcast = async () => {
    setIsGeneratingInstant(true);
    setResult(null);
    setFullScript(null);
    setCurrentEpisodeId(null);
    setAudioUrl(null);
    
    try {
      // Create current date for the instant podcast
      const currentDate = new Date();
      
      toast({
        title: "Generating Podcast",
        description: "Creating an instant podcast with the latest news...",
      });

      // Call the generate-podcast edge function with current date
      const { data, error } = await supabase.functions.invoke<PodcastGenerationResult>(
        "generate-podcast",
        {
          body: {
            scheduledFor: currentDate.toISOString(),
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
        // Check episode status
        const { data: episodeData } = await supabase
          .from("podcast_episodes")
          .select("status")
          .eq("id", data.episodeId)
          .single();
          
        if (episodeData) {
          setEpisodeStatus(episodeData.status);
        }
      }

      toast({
        title: "Success",
        description: "Instant podcast generated successfully with latest news",
      });
    } catch (error) {
      console.error("Error generating instant podcast:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate instant podcast",
        variant: "destructive",
      });
      
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsGeneratingInstant(false);
    }
  };

  // Function to generate audio for the podcast
  const handleGenerateAudio = async () => {
    if (!currentEpisodeId) {
      toast({
        title: "Error",
        description: "No podcast episode selected for audio generation.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingAudio(true);
    setEpisodeStatus("generating_audio");
    
    try {
      toast({
        title: "Generating Audio",
        description: "Creating audio narration for the podcast episode...",
      });

      // Call the generate-podcast-audio edge function
      const { data, error } = await supabase.functions.invoke<AudioGenerationResult>(
        "generate-podcast-audio",
        {
          body: {
            episodeId: currentEpisodeId,
            // Optional: specify a voice ID, defaults to "onwK4e9ZLuTAKqWW03F9" (Daniel voice)
            // voiceId: "specific-voice-id"
          },
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.success) {
        throw new Error(data?.error || "Failed to generate audio");
      }

      console.log("Audio generation result:", data);
      
      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
        setEpisodeStatus("completed");
        
        toast({
          title: "Success",
          description: "Podcast audio generated successfully",
        });
      }
    } catch (error) {
      console.error("Error generating audio:", error);
      setEpisodeStatus("error");
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate audio",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Function to fetch full podcast script
  const fetchFullScript = async () => {
    if (!currentEpisodeId) return;
    
    setIsFetchingFullScript(true);
    
    try {
      const { data, error } = await supabase
        .from("podcast_episodes")
        .select("podcast_script, audio_url, status")
        .eq("id", currentEpisodeId)
        .single();
        
      if (error) throw error;
      
      if (data) {
        if (data.podcast_script) {
          setFullScript(data.podcast_script);
        } else {
          toast({
            title: "Warning",
            description: "No full script available for this episode yet.",
            variant: "destructive",
          });
        }
        
        if (data.audio_url) {
          setAudioUrl(data.audio_url);
        }
        
        if (data.status) {
          setEpisodeStatus(data.status);
        }
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

  // Effect to auto-fetch full script when episode ID changes
  useEffect(() => {
    if (currentEpisodeId) {
      fetchFullScript();
    }
  }, [currentEpisodeId]);

  // Poll for status updates if in generating_audio state
  useEffect(() => {
    let intervalId: number;
    
    if (currentEpisodeId && episodeStatus === "generating_audio") {
      intervalId = window.setInterval(async () => {
        try {
          const { data } = await supabase
            .from("podcast_episodes")
            .select("status, audio_url")
            .eq("id", currentEpisodeId)
            .single();
            
          if (data) {
            setEpisodeStatus(data.status);
            
            if (data.status === "completed" && data.audio_url) {
              setAudioUrl(data.audio_url);
              clearInterval(intervalId);
              
              toast({
                title: "Success",
                description: "Podcast audio has been generated successfully.",
              });
            } else if (data.status === "error") {
              clearInterval(intervalId);
              
              toast({
                title: "Error",
                description: "There was an error generating the podcast audio.",
                variant: "destructive",
              });
            }
          }
        } catch (error) {
          console.error("Error polling episode status:", error);
        }
      }, 5000); // Poll every 5 seconds
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentEpisodeId, episodeStatus, toast]);

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
                  {/* Audio Player Section */}
                  {audioUrl ? (
                    <div className="flex flex-col items-center">
                      <h3 className="text-white text-lg font-medium mb-4 self-start">Podcast Audio</h3>
                      <AudioPlayer
                        src={audioUrl}
                        title={`Beyond the Scan - ${format(new Date(), 'PPP')}`}
                        subtitle="AI Generated Podcast"
                        autoPlay={false}
                      />
                    </div>
                  ) : episodeStatus === "generating_audio" ? (
                    <div className="p-4 bg-[#1a1f3d] rounded-lg flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-white/70 mr-3" />
                      <span className="text-white">Generating podcast audio...</span>
                    </div>
                  ) : episodeStatus === "completed" && !audioUrl ? (
                    <div className="p-4 bg-[#1a1f3d] rounded-lg text-center">
                      <p className="text-yellow-400 mb-2">Audio URL not found</p>
                      <p className="text-gray-400 text-sm">The episode is marked as completed but the audio URL was not found. Please try refreshing or regenerating the audio.</p>
                    </div>
                  ) : episodeStatus === "error" ? (
                    <div className="p-4 bg-[#1a1f3d] rounded-lg text-center">
                      <p className="text-red-400 mb-2">Error generating audio</p>
                      <p className="text-gray-400 text-sm">There was an error processing the audio for this podcast. Please try again.</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-3 border-[#2a2f4d] bg-[#1a1f3d] text-white hover:bg-[#2a2f5d]"
                        onClick={handleGenerateAudio}
                        disabled={isGeneratingAudio}
                      >
                        {isGeneratingAudio ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Volume2 className="mr-2 h-4 w-4" />
                            Retry Audio Generation
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-start">
                      <h3 className="text-white text-lg font-medium mb-3">Generate Audio Version</h3>
                      <p className="text-gray-400 mb-4">Convert the podcast script to spoken audio using ElevenLabs text-to-speech.</p>
                      <Button 
                        className="bg-[#2a2f5d] hover:bg-[#3a3f7d] text-white"
                        onClick={handleGenerateAudio}
                        disabled={isGeneratingAudio || !fullScript}
                      >
                        {isGeneratingAudio ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating Audio...
                          </>
                        ) : (
                          <>
                            <Volume2 className="mr-2 h-4 w-4" />
                            Generate Podcast Audio
                          </>
                        )}
                      </Button>
                    </div>
                  )}

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
                  
                  <div className="flex justify-end">
                    <Button 
                      variant="outline" 
                      className="border-[#2a2f4d] bg-[#1a1f3d] text-white hover:bg-[#2a2f5d]"
                      onClick={() => {
                        if (fullScript) {
                          const blob = new Blob([fullScript], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `podcast_script_${new Date().toISOString().split('T')[0]}.txt`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        } else {
                          toast({
                            title: "Error",
                            description: "You need to view the full script before exporting it.",
                            variant: "destructive",
                          });
                        }
                      }}
                      disabled={!fullScript}
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
