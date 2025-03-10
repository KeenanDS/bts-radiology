
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
  Star
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
}

const PodcastHistoryItem = ({ episode, onDelete, onSetFeatured }: PodcastHistoryItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingFeatured, setIsSettingFeatured] = useState(false);
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

  const handleDeleteEpisode = async () => {
    try {
      setIsDeleting(true);
      
      // Delete from database
      const { error } = await supabase
        .from("podcast_episodes")
        .delete()
        .eq("id", episode.id);
        
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Episode deleted successfully",
      });
      
      // Call parent onDelete callback to update UI
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
      
      // Update database to set this episode as featured
      const { error } = await supabase
        .from("podcast_episodes")
        .update({ is_featured: true })
        .eq("id", episode.id);
        
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Episode set as featured on homepage",
      });
      
      // Call parent callback to update UI
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
    if (!episode.audio_url) return;
    
    const link = document.createElement('a');
    link.href = episode.audio_url;
    link.download = `podcast_episode_${episode.id}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Extract a small preview of the script
  const scriptPreview = episode.podcast_script 
    ? episode.podcast_script.slice(0, 150) + (episode.podcast_script.length > 150 ? "..." : "")
    : "No script available";

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
            </div>
          </div>
          <div className="flex items-center gap-2">
            {episode.audio_url && (
              <Button 
                variant="outline" 
                size="sm" 
                className="border-[#2a2f4d] bg-[#1a1f3d] text-white hover:bg-[#2a2f5d]"
                onClick={handleDownloadAudio}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            
            {episode.status === "completed" && episode.audio_url && (
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
          {episode.audio_url && (
            <div className="mt-4">
              <div className="flex items-center text-gray-300 text-sm mb-2">
                <Music className="h-4 w-4 mr-2" />
                Audio Playback
              </div>
              <AudioPlayer 
                audioUrl={episode.audio_url} 
                title={`Episode ${formatDate(episode.scheduled_for)}`}
                subtitle="Beyond the Scan"
                showDownload={true}
              />
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
