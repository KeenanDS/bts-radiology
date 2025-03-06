import { useState, useRef, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Pause, Play, SkipBack, SkipForward, Volume2, Download } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AudioPlayerProps {
  audioUrl?: string;
  title?: string;
  subtitle?: string;
  coverImage?: string;
  showDownload?: boolean;
}

const AudioPlayer = ({
  audioUrl = "",
  title = "Latest Episode Title",
  subtitle = "Discover Daily by Perplexity",
  coverImage = "/lovable-uploads/680415d4-8d9a-4b0a-ab9f-afac4617df38.png",
  showDownload = false
}: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audioElement.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audioElement.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audioElement.addEventListener("timeupdate", handleTimeUpdate);
    audioElement.addEventListener("loadedmetadata", handleLoadedMetadata);
    audioElement.addEventListener("ended", handleEnded);

    return () => {
      audioElement.removeEventListener("timeupdate", handleTimeUpdate);
      audioElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audioElement.removeEventListener("ended", handleEnded);
    };
  }, [audioRef]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    
    const newTime = value[0];
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
  };

  const skipForward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime += 15;
  };

  const skipBackward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime -= 15;
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    
    const link = document.createElement('a');
    link.href = audioUrl;
    const fileName = audioUrl.split('/').pop() || 'podcast-episode.mp3';
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-[600px] bg-black/80 backdrop-blur-xl rounded-xl p-4 shadow-2xl border border-white/10">
      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
      )}
      
      <div className="flex items-center gap-4">
        <img src={coverImage} alt="Episode Cover" className="w-16 h-16 rounded-lg object-cover" />
        <div className="flex-1">
          <h3 className="text-white font-medium text-sm truncate">{title}</h3>
          <p className="text-gray-400 text-xs">{subtitle}</p>
        </div>
        {showDownload && audioUrl && (
          <Button
            variant="ghost"
            size="icon"
            className="text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            onClick={handleDownload}
            title="Download audio"
          >
            <Download size={18} />
          </Button>
        )}
      </div>
      
      <div className="mt-4 space-y-2">
        <Slider 
          value={[currentTime]} 
          max={duration || 100} 
          step={1} 
          className="w-full" 
          onValueChange={handleSeek}
          disabled={!audioUrl}
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-4">
          <button 
            className="text-white/80 hover:text-white transition-colors" 
            onClick={skipBackward}
            disabled={!audioUrl}
          >
            <SkipBack size={20} />
          </button>
          <button 
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-white/90 transition-colors"
            onClick={togglePlayPause}
            disabled={!audioUrl}
          >
            {isPlaying ? (
              <Pause size={20} className="text-black" />
            ) : (
              <Play size={20} className="text-black ml-1" />
            )}
          </button>
          <button 
            className="text-white/80 hover:text-white transition-colors"
            onClick={skipForward}
            disabled={!audioUrl}
          >
            <SkipForward size={20} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Volume2 size={18} className="text-white/80" />
          <Slider 
            value={[volume]} 
            max={100} 
            step={1} 
            className="w-20" 
            onValueChange={handleVolumeChange} 
          />
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
