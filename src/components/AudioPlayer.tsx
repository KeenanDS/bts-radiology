
import { Slider } from "@/components/ui/slider";
import { Play, SkipBack, SkipForward, Volume2 } from "lucide-react";

const AudioPlayer = () => {
  return (
    <div className="w-full max-w-[600px] bg-black/80 backdrop-blur-xl rounded-xl p-4 shadow-2xl border border-white/10">
      <div className="flex items-center gap-4">
        <img src="/lovable-uploads/680415d4-8d9a-4b0a-ab9f-afac4617df38.png" alt="Episode Cover" className="w-16 h-16 rounded-lg object-cover" />
        <div className="flex-1">
          <h3 className="text-white font-medium text-sm truncate">Latest Episode Title</h3>
          <p className="text-gray-400 text-xs">Discover Daily by Perplexity</p>
        </div>
      </div>
      
      <div className="mt-4 space-y-2">
        <Slider defaultValue={[33]} max={100} step={1} className="w-full" />
        <div className="flex justify-between text-xs text-gray-400">
          <span>2:14</span>
          <span>7:30</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-4">
          <button className="text-white/80 hover:text-white transition-colors">
            <SkipBack size={20} />
          </button>
          <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-white/90 transition-colors">
            <Play size={20} className="text-black ml-1" />
          </button>
          <button className="text-white/80 hover:text-white transition-colors">
            <SkipForward size={20} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Volume2 size={18} className="text-white/80" />
          <Slider defaultValue={[80]} max={100} step={1} className="w-20" />
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
