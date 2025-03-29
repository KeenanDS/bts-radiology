import { useState, useRef, useEffect } from "react";
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
  Loader2
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
            Processing Audio
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

  const getAudioProcessingStatus = () => {
    if (!episode.audio_processing_status) return null;
    
    switch (episode.audio_processing_status) {
      case "processing":
        return (
          <div className="flex items-center text-yellow-400 text-xs font-medium">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing with Dolby.io
          </div>
        );
      case "completed":
        return (
          <div className="flex items-center text-green-400 text-xs font-medium">
            <Check className="h-3 w-3 mr-1" />
            Enhanced with Dolby.io
          </div>
        );
      case "error":
        return (
          <div className="flex items-center text-red-400 text-xs font-medium" title={episode.audio_processing_error || "Error processing audio"}>
            <Clock className="h-3 w-3 mr-1" />
            Error processing audio
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
    if (episode.status !== "completed" || !episode.audio_url) {
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

  const handleProcessAudio = async () => {
    if (!episode.id) {
      toast({
        title: "Error",
        description: "Episode ID is missing",
        variant: "destructive",
      });
      return;
    }

    if (!episode.audio_url) {
      toast({
        title: "Error",
        description: "Episode needs to have audio generated first",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingAudio(true);
    
    try {
      toast({
        title: "Processing Audio",
        description: "Enhancing podcast audio with Dolby.io. This may take a few minutes...",
      });

      const { data, error } = await supabase.functions.invoke(
        "process-podcast-audio",
        {
          body: { episodeId: episode.id },
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.success) {
        throw new Error(data?.error || "Failed to process podcast audio");
      }

      toast({
        title: "Success",
        description: "Podcast audio enhanced with Dolby.io!",
      });
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error("Error processing podcast audio:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process podcast audio",
        variant: "destructive",
      });
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const handleDownloadAudio = () => {
    if (!episode.audio_url) return;
    
    const link = document.createElement('a');
    link.href = episode.audio_url;
    link.download = `podcast_episode_${episode.id}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadProcessedAudio = () => {
    if (!episode.processed_audio_url) return;
    
    const link = document.createElement('a');
    link.href = episode.processed_audio_url;
    link.download = `podcast_episode_${episode.id}_with_music.mp3`;
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
        description: "Converting podcast script to audio. This may take a few minutes...",
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
        description: "Podcast audio generated successfully!",
      });
      
      if (onRefresh) {
        onRefresh();
      }
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

  const scriptPreview = episode.podcast_script 
    ? episode.podcast_script.slice(0, 150) + (episode.podcast_script.length > 150 ? "..." : "")
    : "No script available";

  const canGenerateAudio = episode.podcast_script && 
                          !episode.audio_url && 
                          episode.status === "completed";
                          
  const canProcessAudio = episode.audio_url && 
                         (!episode.processed_audio_url && !episode.audio_processing_status || 
                          episode.audio_processing_status === "error");
                          
  const episodeTitle = episode.custom_title || `Episode ${formatDate(episode.scheduled_for)}`;

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
              {episodeTitle}
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
              {getAudioProcessingStatus() && (
                <>
                  <span className="mx-2">•</span>
                  {getAudioProcessingStatus()}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {episode.processed_audio_url ? (
              <Button 
                variant="outline" 
                size="sm" 
                className="border-[#2a2f4d] bg-[#1a1f3d] text-white hover:bg-[#2a2f5d]"
                onClick={handleDownloadProcessedAudio}
                title="Download podcast with background music"
              >
                <Download className="h-4 w-4" />
              </Button>
            ) : episode.audio_url && (
              <Button 
                variant="outline" 
                size="sm" 
                className="border-[#2a2f4d] bg-[#1a1f3d] text-white hover:bg-[#2a2f5d]"
                onClick={handleDownloadAudio}
                title="Download raw podcast audio"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            
            {episode.status === "completed" && episode.processed_audio_url && (
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
          {episode.processed_audio_url ? (
            <div className="mt-4">
              <div className="flex items-center text-gray-300 text-sm mb-2">
                <Music className="h-4 w-4 mr-2" />
                Enhanced Audio with Dolby.io
              </div>
              <AudioPlayer 
                audioUrl={episode.processed_audio_url} 
                title={episodeTitle + " (Enhanced)"}
                subtitle="Beyond the Scan"
                showDownload={true}
              />
            </div>
          ) : episode.audio_url ? (
            <div className="mt-4">
              <div className="flex items-center text-gray-300 text-sm mb-2">
                <Music className="h-4 w-4 mr-2" />
                Raw Audio Playback
              </div>
              <AudioPlayer 
                audioUrl={episode.audio_url} 
                title={episodeTitle}
                subtitle="Beyond the Scan"
                showDownload={true}
              />
              
              {canProcessAudio && (
                <Button 
                  onClick={handleProcessAudio}
                  className="w-full mt-3 bg-gradient-to-r from-[#3a3f7d] to-[#6366f1] hover:from-[#4a4f8d] hover:to-[#7376ff] text-white"
                  disabled={isProcessingAudio}
                >
                  {isProcessingAudio ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enhancing Audio with Dolby.io...
                    </>
                  ) : (
                    <>
                      <Music className="mr-2 h-4 w-4" />
                      Enhance with Dolby.io
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : canGenerateAudio && (
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
                    Generate Podcast Audio
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
