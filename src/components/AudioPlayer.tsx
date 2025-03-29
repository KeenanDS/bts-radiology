
import { useState, useRef, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Pause, Play, SkipBack, SkipForward, Volume2, Download, Music } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AudioPlayerProps {
  audioUrl?: string;
  backgroundMusicUrl?: string;
  title?: string;
  subtitle?: string;
  coverImage?: string;
  showDownload?: boolean;
}

const AudioPlayer = ({
  audioUrl = "",
  backgroundMusicUrl = "",
  title = "Latest Episode Title",
  subtitle = "Beyond the Scan Podcast by RadiologyJobs.com",
  coverImage = "/lovable-uploads/680415d4-8d9a-4b0a-ab9f-afac4617df38.png",
  showDownload = false
}: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  
  // Note: For processed podcasts, background music is already mixed in
  // This toggles the separate background music playback only for unprocessed audio
  const [backgroundMusicEnabled, setBackgroundMusicEnabled] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const backgroundMusicRef = useRef<HTMLAudioElement>(null);
  
  // We still allow manual music control when the user is previewing
  // an episode without processed audio (with intro/outro)
  const [musicVolume, setMusicVolume] = useState(15); // Background music at 15% by default
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const bgSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const bgGainNodeRef = useRef<GainNode | null>(null);

  // Check if we have a processed audio file (with intro/outro already mixed in)
  const isProcessedAudio = audioUrl?.includes("processed_dolby");

  // Set up audio context and nodes for mixing - only needed for manual background music
  useEffect(() => {
    if (!audioUrl || !backgroundMusicUrl || !backgroundMusicEnabled || isProcessedAudio) return;
    
    const setupAudioContext = () => {
      // Create audio context if it doesn't exist
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const audioContext = audioContextRef.current;
      
      // Create source nodes if they don't exist
      if (audioRef.current && !sourceNodeRef.current) {
        sourceNodeRef.current = audioContext.createMediaElementSource(audioRef.current);
      }
      
      if (backgroundMusicRef.current && !bgSourceNodeRef.current && backgroundMusicEnabled) {
        bgSourceNodeRef.current = audioContext.createMediaElementSource(backgroundMusicRef.current);
      }
      
      // Create gain nodes if they don't exist
      if (!gainNodeRef.current) {
        gainNodeRef.current = audioContext.createGain();
      }
      
      if (!bgGainNodeRef.current && backgroundMusicEnabled) {
        bgGainNodeRef.current = audioContext.createGain();
      }
      
      // Connect the nodes
      if (sourceNodeRef.current && gainNodeRef.current) {
        sourceNodeRef.current.connect(gainNodeRef.current);
        gainNodeRef.current.connect(audioContext.destination);
      }
      
      if (bgSourceNodeRef.current && bgGainNodeRef.current && backgroundMusicEnabled) {
        bgSourceNodeRef.current.connect(bgGainNodeRef.current);
        bgGainNodeRef.current.connect(audioContext.destination);
      }
      
      // Set initial gain values
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = volume / 100;
      }
      
      if (bgGainNodeRef.current && backgroundMusicEnabled) {
        bgGainNodeRef.current.gain.value = musicVolume / 100;
      }
    };
    
    setupAudioContext();
    
    return () => {
      // Clean up audio nodes
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
      
      if (bgSourceNodeRef.current) {
        bgSourceNodeRef.current.disconnect();
        bgSourceNodeRef.current = null;
      }
      
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }
      
      if (bgGainNodeRef.current) {
        bgGainNodeRef.current.disconnect();
        bgGainNodeRef.current = null;
      }
    };
  }, [audioUrl, backgroundMusicUrl, backgroundMusicEnabled, isProcessedAudio]);
  
  // Handle background music toggle (only for non-processed audio)
  useEffect(() => {
    if (!backgroundMusicRef.current || !backgroundMusicUrl || isProcessedAudio) return;
    
    if (backgroundMusicEnabled) {
      if (isPlaying) {
        backgroundMusicRef.current.play().catch(err => console.error("Error playing background music:", err));
      }
      if (bgGainNodeRef.current) {
        bgGainNodeRef.current.gain.value = musicVolume / 100;
      }
    } else {
      backgroundMusicRef.current.pause();
    }
  }, [backgroundMusicEnabled, isPlaying, backgroundMusicUrl, musicVolume, isProcessedAudio]);

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
      
      // Also pause background music when main audio ends
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.pause();
        backgroundMusicRef.current.currentTime = 0;
      }
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

  // Syncing playback between narration and background music (for non-processed audio)
  useEffect(() => {
    if (isProcessedAudio) return; // Skip for processed audio
    
    const syncBackgroundMusic = () => {
      if (!backgroundMusicRef.current || !audioRef.current || !backgroundMusicEnabled) return;
      
      // Start background music from the beginning when main audio plays
      if (isPlaying) {
        // Apply fade-in effect to background music
        if (bgGainNodeRef.current) {
          bgGainNodeRef.current.gain.setValueAtTime(0, audioContextRef.current?.currentTime || 0);
          bgGainNodeRef.current.gain.linearRampToValueAtTime(
            musicVolume / 100, 
            (audioContextRef.current?.currentTime || 0) + 3 // 3 second fade in
          );
        }
        
        backgroundMusicRef.current.play().catch(err => console.error("Error playing background music:", err));
      } else {
        // Apply fade-out effect to background music
        if (bgGainNodeRef.current && audioContextRef.current) {
          const currentTime = audioContextRef.current.currentTime;
          bgGainNodeRef.current.gain.setValueAtTime(bgGainNodeRef.current.gain.value, currentTime);
          bgGainNodeRef.current.gain.linearRampToValueAtTime(0, currentTime + 1); // 1 second fade out
          
          // Pause the background music after the fade out
          setTimeout(() => {
            if (backgroundMusicRef.current) {
              backgroundMusicRef.current.pause();
            }
          }, 1000);
        } else {
          backgroundMusicRef.current.pause();
        }
      }
    };
    
    syncBackgroundMusic();
  }, [isPlaying, backgroundMusicEnabled, musicVolume, isProcessedAudio]);

  // Update volume for main audio
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume / 100;
    } else if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);
  
  // Update volume for background music (only for non-processed audio)
  useEffect(() => {
    if (isProcessedAudio) return;
    
    if (bgGainNodeRef.current && backgroundMusicEnabled) {
      bgGainNodeRef.current.gain.value = musicVolume / 100;
    } else if (backgroundMusicRef.current) {
      backgroundMusicRef.current.volume = musicVolume / 100;
    }
  }, [musicVolume, backgroundMusicEnabled, isProcessedAudio]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      // Start audio context if it's suspended (needed for Safari)
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      
      audioRef.current.play().catch(err => console.error("Error playing audio:", err));
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
  
  const handleMusicVolumeChange = (value: number[]) => {
    setMusicVolume(value[0]);
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
      
      {backgroundMusicUrl && !isProcessedAudio && (
        <audio ref={backgroundMusicRef} src={backgroundMusicUrl} loop preload="metadata" />
      )}
      
      <div className="flex items-center gap-4">
        <img src={coverImage} alt="Episode Cover" className="w-16 h-16 rounded-lg object-cover" />
        <div className="flex-1">
          <h3 className="text-white font-medium text-sm truncate">{title}</h3>
          <p className="text-gray-400 text-xs">{subtitle}</p>
          {isProcessedAudio && (
            <span className="text-xs text-green-400 mt-1 inline-block">
              Enhanced with intro/outro music
            </span>
          )}
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
      
      {backgroundMusicUrl && !isProcessedAudio && (
        <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Music size={16} className="text-white/80" />
              <span className="text-white/80 text-xs">Background Music</span>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Switch 
                    checked={backgroundMusicEnabled} 
                    onCheckedChange={setBackgroundMusicEnabled}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Toggle background music</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {backgroundMusicEnabled && (
            <div className="flex items-center gap-2">
              <span className="text-white/80 text-xs">Volume</span>
              <Slider 
                value={[musicVolume]} 
                max={50} // Limit background music to 50% max
                step={1} 
                className="w-full" 
                onValueChange={handleMusicVolumeChange} 
                disabled={!backgroundMusicEnabled}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;
