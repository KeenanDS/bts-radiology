import { useState } from "react";
import { format } from "date-fns";
import { 
  Download, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Calendar, 
  Music,
  Check,
  Clock,
  Trash2,
  Star,
  Loader2,
  AlertCircle,
  RefreshCw,
  Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PodcastEpisode } from "./PodcastHistory";
import AudioPlayer from "@/components/AudioPlayer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface PodcastHistoryItemProps {
  episode: PodcastEpisode;
  onDelete: (id: string) => void;
  onSetFeatured: (id: string) => void;
  onRefresh?: () => void;
}

const PodcastHistoryItem = ({ episode, onDelete, onSetFeatured, onRefresh }: PodcastHistoryItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingFeatured, setIsSettingFeatured] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const { toast } = useToast();
  
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "PPP");
    } catch (e) {
      return "Invalid date";
    }
  };
  
  const audioToUse = episode.processed_audio_url || episode.audio_url;
  
  const getStatusBadge = () => {
    switch (episode.status) {
      case "completed":
        return (
          <div className="flex items-center text-green-400 text-xs font-medium">
            <Check className="h-3 w-3 mr-1" />
            Completed
          </div>
        );
      case "generating_audio":
        return (
          <div className="flex items-center text-yellow-400 text-xs font-medium">
            <Clock className="h-3 w-3 mr-1 animate-pulse" />
            Generating Audio
          </div>
        );
      case "processing_audio":
        return (
          <div className="flex items-center text-blue-400 text-xs font-medium">
            <Clock className="h-3 w-3 mr-1 animate-pulse" />
            Adding Background Music
          </div>
        );
      default:
        return (
          <div className="flex items-center text-blue-400 text-xs font-medium">
            <Clock className="h-3 w-3 mr-1" />
            {episode.status || "Pending"}
          </div>
        );
    }
  };
  
  const getProcessingStatusBadge = () => {
    if (!episode.audio_processing_status) return null;
    
    switch (episode.audio_processing_status) {
      case "completed":
        return (
          <div className="flex items-center text-green-400 text-xs font-medium ml-2" title="Background music has been added to this podcast">
            <Check className="h-3 w-3 mr-1" />
            Music Added
          </div>
        );
      case "processing":
        return (
          <div className="flex items-center text-blue-400 text-xs font-medium ml-2" title="Currently adding background music">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Adding Music
          </div>
        );
      case "pending":
        return (
          <div className="flex items-center text-yellow-400 text-xs font-medium ml-2" title="Background music will be added soon">
            <Clock className="h-3 w-3 mr-1" />
            Music Pending
          </div>
        );
      case "error":
        return (
          <div className="flex items-center text-red-400 text-xs font-medium ml-2" title={episode.audio_processing_error || "Error adding background music"}>
            <AlertCircle className="h-3 w-3 mr-1" />
            Music Error
          </div>
        );
      default:
        return null;
    }
  };

  const handleDeleteEpisode = async () => {
    try {
      setIsDeleting(true);
      
      const { error } = await supabase
        .from("podcast_episodes")
        .delete()
        .eq("id", episode.id);
        
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Episode deleted successfully",
      });
      
      onDelete(episode.id);
    } catch (error) {
      console.error("Error deleting podcast episode:", error);
      toast({
        title: "Error",
        description: "Failed to delete episode",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetFeatured = async () => {
    if (episode.status !== "completed" || !audioToUse) {
      toast({
        title: "Cannot set as featured",
        description: "Only completed episodes with audio can be featured",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSettingFeatured(true);
      
      const { error } = await supabase
        .from("podcast_episodes")
        .update({ is_featured: true })
        .eq("id", episode.id);
        
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Episode set as featured on homepage",
      });
      
      onSetFeatured(episode.id);
    } catch (error) {
      console.error("Error setting episode as featured:", error);
      toast({
        title: "Error",
        description: "Failed to set episode as featured",
        variant: "destructive",
      });
    } finally {
      setIsSettingFeatured(false);
    }
  };

  const handleDownloadAudio = () => {
    if (!audioToUse) return;
    
    const link = document.createElement('a');
    link.href = audioToUse;
    link.download = `podcast_episode_${episode.id}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateAudio = async () => {
    if (!episode.id) {
      toast({
        title: "Error",
        description: "Episode ID is missing",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingAudio(true);
    
    try {
      toast({
        title: "Generating Audio",
        description: "Converting podcast script to audio with background music. This may take a few minutes...",
      });

      const { data, error } = await supabase.functions.invoke(
        "generate-podcast-audio",
        {
          body: { episodeId: episode.id },
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.success) {
        throw new Error(data?.error || "Failed to generate podcast audio");
      }

      toast({
        title: "Success",
        description: "Podcast audio generation initiated successfully!",
      });
      
      pollForAudioProcessingStatus(episode.id);
      
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

  const handleProcessAudio = async () => {
    if (!episode.id || !episode.audio_url) {
      toast({
        title: "Error",
        description: "Episode ID or audio URL is missing",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingAudio(true);
    
    try {
      // First ensure buckets exist
      console.log("Setting up storage buckets...");
      const setupResponse = await supabase.functions.invoke(
        "setup-podcast-buckets",
        {}
      );
      
      console.log("Setup buckets response:", setupResponse);
      
      if (!setupResponse.data?.success) {
        throw new Error("Failed to set up storage buckets for podcast processing");
      }
      
      toast({
        title: "Processing Audio",
        description: "Adding background music to podcast audio. This may take a few minutes...",
      });

      // Process the audio
      console.log("Calling process-podcast-audio function...");
      const { data, error } = await supabase.functions.invoke(
        "process-podcast-audio",
        {
          body: { 
            episodeId: episode.id,
            audioUrl: episode.audio_url
          },
        }
      );

      console.log("Process audio response:", data, error);

      if (error) {
        throw error;
      }

      if (!data || !data.success) {
        throw new Error(data?.error || "Failed to process podcast audio");
      }

      toast({
        title: "Success",
        description: data.message || "Background music processing initiated successfully!",
      });
      
      pollForAudioProcessingStatus(episode.id);
      
    } catch (error) {
      console.error("Error processing podcast audio:", error);
      
      let errorMessage = error instanceof Error ? error.message : "Failed to process podcast audio";
      
      // Handle specific cases
      if (errorMessage.includes("background music")) {
        errorMessage = "No background music file found. Please upload a background music file first.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const handleUploadBackgroundMusic = async () => {
    try {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'audio/mpeg,audio/mp3';
      
      fileInput.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        // Validate file type
        if (!file.type.match('audio/(mpeg|mp3)')) {
          toast({
            title: "Invalid File Type",
            description: "Please upload an MP3 audio file.",
            variant: "destructive",
          });
          return;
        }
        
        // Validate file size (50MB limit)
        if (file.size > 50 * 1024 * 1024) {
          toast({
            title: "File Too Large",
            description: "Maximum file size is 50MB.",
            variant: "destructive",
          });
          return;
        }
        
        toast({
          title: "Uploading Music",
          description: "Uploading background music file...",
        });
        
        // Setup buckets first
        console.log("Setting up storage buckets...");
        const setupResponse = await supabase.functions.invoke(
          "setup-podcast-buckets",
          {}
        );
        
        console.log("Setup buckets response:", setupResponse);
        
        if (!setupResponse.data?.success) {
          throw new Error("Failed to set up storage buckets");
        }
        
        // Upload the file
        console.log("Uploading background music file...");
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from("podcast_music")
          .upload("default_background.mp3", file, {
            contentType: "audio/mpeg",
            upsert: true,
          });
          
        if (uploadError) {
          console.error("Upload error:", uploadError);
          throw uploadError;
        }
        
        // Get public URL for verification
        const { data: publicUrlData } = supabase
          .storage
          .from("podcast_music")
          .getPublicUrl("default_background.mp3");
          
        console.log("Music uploaded to:", publicUrlData.publicUrl);
        
        toast({
          title: "Success",
          description: "Background music uploaded successfully! You can now add it to podcasts.",
        });
      };
      
      fileInput.click();
    } catch (error) {
      console.error("Error uploading background music:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload background music",
        variant: "destructive",
      });
    }
  };

  const pollForAudioProcessingStatus = async (episodeId: string) => {
    const maxAttempts = 30;
    let attempts = 0;
    
    const pollInterval = setInterval(async () => {
      attempts++;
      
      try {
        const { data, error } = await supabase
          .from("podcast_episodes")
          .select("*")
          .eq("id", episodeId)
          .single();
          
        if (error) {
          console.error("Error polling episode status:", error);
          clearInterval(pollInterval);
          return;
        }
        
        if (data.audio_processing_status === 'completed' || 
            data.audio_processing_status === 'error' || 
            attempts >= maxAttempts) {
          
          clearInterval(pollInterval);
          
          if (onRefresh) {
            onRefresh();
          }
          
          if (data.audio_processing_status === 'completed') {
            toast({
              title: "Processing Complete",
              description: "Podcast audio with background music is now available!",
            });
          } else if (data.audio_processing_status === 'error') {
            toast({
              title: "Processing Error",
              description: data.audio_processing_error || "An error occurred while processing the audio",
              variant: "destructive",
            });
          } else if (attempts >= maxAttempts) {
            toast({
              title: "Processing Timeout",
              description: "The audio processing is taking longer than expected. Check back later.",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error("Error in polling:", error);
        clearInterval(pollInterval);
      }
    }, 10000);
    
    return () => clearInterval(pollInterval);
  };

  const scriptPreview = episode.podcast_script 
    ? episode.podcast_script.slice(0, 150) + (episode.podcast_script.length > 150 ? "..." : "")
    : "No script available";

  const canGenerateAudio = episode.podcast_script && 
                          !episode.audio_url && 
                          episode.status === "completed";
                          
  const canProcessAudio = episode.audio_url && 
                         !episode.processed_audio_url && 
                         episode.status === "completed" &&
                         episode.audio_processing_status !== "processing";

  return (
    <Collapsible 
      open={isOpen} 
      onOpenChange={setIsOpen} 
      className="border border-[#2a2f4d] rounded-lg overflow-hidden bg-[#1a1f3d]"
    >
      <div className="p-4">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <div className="text-white font-medium">
              Episode {formatDate(episode.scheduled_for)}
              {episode.is_featured && (
                <span className="ml-2 text-yellow-400 text-xs font-medium">
                  ★ Featured
                </span>
              )}
            </div>
            <div className="flex items-center text-gray-400 text-xs mt-1">
              <Calendar className="h-3 w-3 mr-1" />
              {formatDate(episode.created_at)}
              <span className="mx-2">•</span>
              {getStatusBadge()}
              {getProcessingStatusBadge()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {audioToUse && (
              <Button 
                variant="outline" 
                size="sm" 
                className="border-[#2a2f4d] bg-[#1a1f3d] text-white hover:bg-[#2a2f5d]"
                onClick={handleDownloadAudio}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            
            {episode.status === "completed" && audioToUse && (
              <Button 
                variant="outline" 
                size="sm"
                className={`border-[#2a2f4d] ${episode.is_featured ? 'bg-yellow-900/30 text-yellow-400' : 'bg-[#1a1f3d] text-white'} hover:bg-[#2a2f5d]`}
                onClick={handleSetFeatured}
                disabled={isSettingFeatured}
                title="Set as featured on homepage"
              >
                <Star className="h-4 w-4" />
              </Button>
            )}
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-[#2a2f4d] bg-[#1a1f3d] text-white hover:bg-red-900/30 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#1a1f3d] border-[#2a2f4d] text-white">
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-400">
                    This will permanently delete this podcast episode and cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-[#111936] text-white border-[#2a2f4d] hover:bg-[#2a2f5d] hover:text-white">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteEpisode}
                    className="bg-red-900/30 text-red-400 hover:bg-red-800/50"
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-[#2a2f4d] bg-[#1a1f3d] text-white hover:bg-[#2a2f5d]"
              >
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
        
        {!isOpen && (
          <div className="mt-2 text-gray-300 text-sm">
            {scriptPreview}
          </div>
        )}
      </div>
      
      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-4">
          {audioToUse ? (
            <div className="mt-4">
              <div className="flex items-center text-gray-300 text-sm mb-2">
                <Music className="h-4 w-4 mr-2" />
                Audio Playback
                {episode.processed_audio_url && (
                  <span className="ml-2 text-xs text-green-400">(With Background Music)</span>
                )}
              </div>
              <AudioPlayer 
                audioUrl={audioToUse} 
                title={`Episode ${formatDate(episode.scheduled_for)}`}
                subtitle="Beyond the Scan"
                showDownload={true}
              />
              
              <div className="flex flex-col gap-2 mt-2">
                {canProcessAudio && (
                  <Button 
                    onClick={handleProcessAudio}
                    className="w-full bg-blue-600/30 hover:bg-blue-700/40 text-white"
                    disabled={isProcessingAudio}
                  >
                    {isProcessingAudio ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding Background Music...
                      </>
                    ) : (
                      <>
                        <Music className="mr-2 h-4 w-4" />
                        Add Background Music
                      </>
                    )}
                  </Button>
                )}
                
                <Button
                  onClick={handleUploadBackgroundMusic}
                  variant="outline"
                  className="w-full border-[#2a2f4d] bg-[#1a1f3d] text-white hover:bg-[#2a2f5d]"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Custom Background Music
                </Button>
              </div>
              
              {episode.audio_processing_error && (
                <div className="mt-2 p-3 bg-red-900/20 border border-red-900/30 rounded-md">
                  <div className="flex items-center text-red-400 text-xs font-medium">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Error adding background music
                  </div>
                  <p className="text-gray-300 text-xs mt-1">{episode.audio_processing_error}</p>
                  
                  <div className="flex flex-col gap-2 mt-2">
                    {episode.audio_url && episode.audio_processing_status === "error" && (
                      <Button 
                        onClick={handleProcessAudio}
                        className="w-full bg-red-900/30 hover:bg-red-800/40 text-white text-xs py-1 h-7"
                        disabled={isProcessingAudio}
                        size="sm"
                      >
                        {isProcessingAudio ? (
                          <>
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            Retrying...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-1 h-3 w-3" />
                            Retry Adding Music
                          </>
                        )}
                      </Button>
                    )}
                    
                    <Button
                      onClick={handleUploadBackgroundMusic}
                      variant="outline"
                      size="sm"
                      className="w-full border-[#2a2f4d] bg-[#1a1f3d] text-white hover:bg-[#2a2f5d] text-xs py-1 h-7"
                    >
                      <Upload className="mr-1 h-3 w-3" />
                      Upload Background Music File
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <div className="flex items-center text-gray-300 text-sm mb-2">
                <Music className="h-4 w-4 mr-2" />
                Generate Podcast Audio
              </div>
              <Button 
                onClick={handleGenerateAudio}
                className="w-full bg-gradient-to-r from-[#3a3f7d] to-[#6366f1] hover:from-[#4a4f8d] hover:to-[#7376ff] text-white"
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
                    Generate Podcast Audio with Music
                  </>
                )}
              </Button>
            </div>
          )}
          
          {episode.podcast_script && (
            <div className="mt-4">
              <div className="flex justify-between items-center text-gray-300 text-sm mb-2">
                <div className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Podcast Script
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-[#2a2f4d] bg-[#1a1f3d] text-white hover:bg-[#2a2f5d]"
                  onClick={() => {
                    if (!episode.podcast_script) return;
                    
                    const element = document.createElement("a");
                    const file = new Blob([episode.podcast_script], {type: 'text/plain'});
                    element.href = URL.createObjectURL(file);
                    element.download = `podcast_script_${episode.id}.txt`;
                    document.body.appendChild(element);
                    element.click();
                    document.body.removeChild(element);
                  }}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Script
                </Button>
              </div>
              <div className="p-4 bg-[#111936] rounded-lg max-h-[400px] overflow-y-auto text-gray-300 text-sm whitespace-pre-line">
                {episode.podcast_script}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default PodcastHistoryItem;
