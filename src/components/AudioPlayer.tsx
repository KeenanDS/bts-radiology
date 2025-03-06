
import { useState, useEffect, useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, SkipBack, SkipForward, Volume2, Download } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  title: string;
  subtitle?: string;
  onEnded?: () => void;
  autoPlay?: boolean;
}

const AudioPlayer = ({ src, title, subtitle = "Beyond the Scan", onEnded, autoPlay = false }: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isLoaded, setIsLoaded] = useState(false);

  // Format time in mm:ss
  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Toggle play/pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error("Error playing audio:", err);
      });
    }
  };

  // Skip forward/backward by 10 seconds
  const skip = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.currentTime + seconds, duration));
  };

  // Set current time when slider is changed
  const handleSliderChange = (value: number[]) => {
    if (!audioRef.current || !duration) return;
    const newTime = (value[0] / 100) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Set volume when volume slider is changed
  const handleVolumeChange = (value: number[]) => {
    if (!audioRef.current) return;
    const newVolume = value[0] / 100;
    audioRef.current.volume = newVolume;
    setVolume(value[0]);
  };

  // Handle download
  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = `${title.replace(/\s+/g, '_')}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Setup audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
      if (autoPlay) audio.play().catch(err => console.error("Error auto-playing:", err));
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (onEnded) onEnded();
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    // Set initial volume
    audio.volume = volume / 100;

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onEnded, autoPlay, volume]);

  // Calculate percentage for progress
  const currentPercentage = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full max-w-[600px] bg-black/80 backdrop-blur-xl rounded-xl p-4 shadow-2xl border border-white/10">
      {/* Hidden audio element */}
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <div className="flex items-center gap-4">
        <img src="/lovable-uploads/680415d4-8d9a-4b0a-ab9f-afac4617df38.png" alt="Episode Cover" className="w-16 h-16 rounded-lg object-cover" />
        <div className="flex-1">
          <h3 className="text-white font-medium text-sm truncate">{title}</h3>
          <p className="text-gray-400 text-xs">{subtitle}</p>
        </div>
        {isLoaded ? (
          <Button 
            variant="outline" 
            size="sm" 
            className="border-white/20 bg-transparent hover:bg-white/10 text-white" 
            onClick={handleDownload}
          >
            <Download size={16} className="mr-1" /> Save
          </Button>
        ) : (
          <div className="text-xs text-gray-400">Loading...</div>
        )}
      </div>
      
      <div className="mt-4 space-y-2">
        <Progress value={currentPercentage} className="h-1 bg-white/10" />
        
        <div className="flex justify-between text-xs text-gray-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-4">
          <button 
            className="text-white/80 hover:text-white transition-colors" 
            onClick={() => skip(-10)}
            disabled={!isLoaded}
          >
            <SkipBack size={20} />
          </button>
          <button 
            className={`w-10 h-10 rounded-full ${isPlaying ? 'bg-white/90' : 'bg-white'} flex items-center justify-center hover:bg-white/90 transition-colors`}
            onClick={togglePlay}
            disabled={!isLoaded}
          >
            {isPlaying ? (
              <Pause size={20} className="text-black" />
            ) : (
              <Play size={20} className="text-black ml-1" />
            )}
          </button>
          <button 
            className="text-white/80 hover:text-white transition-colors"
            onClick={() => skip(10)}
            disabled={!isLoaded}
          >
            <SkipForward size={20} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Volume2 size={18} className="text-white/80" />
          <Slider 
            defaultValue={[volume]} 
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
