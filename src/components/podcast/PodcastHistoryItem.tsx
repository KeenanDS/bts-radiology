
import React, { useState } from "react";
import { AlertCircle, Check, Download, ExternalLink, Loader2, MoreVertical, Music, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PodcastEpisode } from "./PodcastHistory";

interface PodcastHistoryItemProps {
  episode: PodcastEpisode;
  onDelete: (id: string) => void;
  onSetFeatured: (id: string) => void;
  onRefresh: () => void;
}

const PodcastHistoryItem: React.FC<PodcastHistoryItemProps> = ({ 
  episode, 
  onDelete, 
  onSetFeatured,
  onRefresh
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFeaturingPodcast, setIsFeaturingPodcast] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast } = useToast();

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy");
    } catch (e) {
      return dateString;
    }
  };

  const handleDownload = () => {
    const audioUrl = episode.processed_audio_url || episode.audio_url;
    if (!audioUrl) return;
    
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `podcast_${episode.id}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      
      // Delete the episode from the database
      const { error } = await supabase
        .from("podcast_episodes")
        .delete()
        .eq("id", episode.id);

      if (error) throw error;
      
      toast({
        title: "Podcast deleted",
        description: "The podcast episode has been successfully deleted",
      });
      
      onDelete(episode.id);
      
    } catch (error) {
      console.error("Error deleting podcast:", error);
      toast({
        title: "Error",
        description: "Failed to delete podcast episode",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSetFeatured = async () => {
    try {
      setIsFeaturingPodcast(true);
      
      const { error } = await supabase
        .from("podcast_episodes")
        .update({ is_featured: true })
        .eq("id", episode.id);

      if (error) throw error;
      
      toast({
        title: "Featured podcast updated",
        description: "This podcast is now featured on the home page",
      });
      
      onSetFeatured(episode.id);
      
    } catch (error) {
      console.error("Error featuring podcast:", error);
      toast({
        title: "Error",
        description: "Failed to feature podcast episode",
        variant: "destructive",
      });
    } finally {
      setIsFeaturingPodcast(false);
    }
  };

  const statusColor = {
    pending: "bg-yellow-500/20 text-yellow-300",
    completed: "bg-green-500/20 text-green-300",
    error: "bg-red-500/20 text-red-300",
    generating_audio: "bg-blue-500/20 text-blue-300",
    processing_audio: "bg-purple-500/20 text-purple-300",
  };

  return (
    <>
      <Card className="bg-[#1a1f3d] border-[#2a2f4d] overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-medium truncate">
                  {episode.custom_title || `Podcast Episode - ${formatDate(episode.scheduled_for)}`}
                </h3>
                {episode.is_featured && (
                  <span className="flex items-center gap-1 text-xs bg-yellow-600/30 text-yellow-300 px-2 py-0.5 rounded-full">
                    <Star className="h-3 w-3" />
                    Featured
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                <span>Created: {formatDate(episode.created_at)}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor[episode.status as keyof typeof statusColor] || "bg-gray-500/20 text-gray-300"}`}>
                  {episode.status.replace('_', ' ')}
                </span>
              </div>
              
              {/* Audio Player or Status */}
              <div className="mt-3">
                {episode.audio_url ? (
                  <audio 
                    controls 
                    className="w-full h-8 text-white" 
                    src={episode.processed_audio_url || episode.audio_url}
                  >
                    Your browser does not support the audio element.
                  </audio>
                ) : episode.status === 'generating_audio' ? (
                  <div className="flex items-center gap-2 text-blue-300">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generating audio...</span>
                  </div>
                ) : episode.status === 'error' ? (
                  <div className="flex items-center gap-2 text-red-300">
                    <AlertCircle className="h-4 w-4" />
                    <span>Error generating podcast</span>
                  </div>
                ) : null}
              </div>
            </div>
            
            <div className="flex items-start gap-2 sm:justify-end">
              {(episode.processed_audio_url || episode.audio_url) && (
                <Button 
                  size="sm"
                  variant="outline"
                  className="border-[#2a2f4d] bg-[#111936] text-white hover:bg-[#2a2f5d]"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only sm:ml-2">Download</span>
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    size="sm"
                    variant="outline"
                    className="border-[#2a2f4d] bg-[#111936] text-white hover:bg-[#2a2f5d]"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-[#1a1f3d] border-[#2a2f4d] text-white w-56">
                  <DropdownMenuGroup>
                    {!episode.is_featured && (
                      <DropdownMenuItem 
                        onClick={handleSetFeatured}
                        disabled={isFeaturingPodcast}
                        className="text-white hover:bg-[#2a2f5d] cursor-pointer"
                      >
                        {isFeaturingPodcast ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Star className="mr-2 h-4 w-4" />
                        )}
                        <span>Set as Featured</span>
                      </DropdownMenuItem>
                    )}
                    
                    {episode.podcast_script && (
                      <DropdownMenuItem
                        onClick={() => {
                          const element = document.createElement("a");
                          const file = new Blob([episode.podcast_script!], {type: 'text/plain'});
                          element.href = URL.createObjectURL(file);
                          element.download = `podcast_script_${episode.id}.txt`;
                          document.body.appendChild(element);
                          element.click();
                          document.body.removeChild(element);
                        }}
                        className="text-white hover:bg-[#2a2f5d] cursor-pointer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        <span>Export Script</span>
                      </DropdownMenuItem>
                    )}
                    
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-red-400 hover:bg-red-950/30 hover:text-red-300 cursor-pointer"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Delete Podcast</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-[#111936] border-[#2a2f4d] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will permanently delete this podcast episode and any associated audio files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#2a2f4d] bg-[#1a1f3d] text-white hover:bg-[#2a2f5d]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PodcastHistoryItem;
