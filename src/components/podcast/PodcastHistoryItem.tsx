
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
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PodcastEpisode } from "./PodcastHistory";
import AudioPlayer from "@/components/AudioPlayer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface PodcastHistoryItemProps {
  episode: PodcastEpisode;
}

const PodcastHistoryItem = ({ episode }: PodcastHistoryItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
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
