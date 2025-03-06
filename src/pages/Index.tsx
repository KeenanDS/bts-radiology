
import AudioPlayer from "@/components/AudioPlayer";
import { Link } from "react-router-dom";
import { useFeaturedPodcast } from "@/hooks/useFeaturedPodcast";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { podcast, isLoading, error } = useFeaturedPodcast();

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full text-center space-y-20">
        <div className="space-y-4">
          <h1 className="text-7xl font-bold text-white tracking-tight">
            RadiologyJobs
          </h1>
          <p className="text-2xl text-gray-400">
            Beyond the Scan Podcast
          </p>
          <div className="text-sm uppercase tracking-widest text-gray-500 mt-8">
            Listen to the latest episode
          </div>
        </div>

        <div className="flex justify-center w-full px-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-[220px] w-full">
              <Loader2 className="h-8 w-8 animate-spin text-white/50" />
            </div>
          ) : error ? (
            <div className="p-4 bg-red-900/20 text-red-400 rounded-lg">
              {error}
            </div>
          ) : (
            <AudioPlayer 
              audioUrl={podcast?.audio_url || ""}
              title={podcast?.title || "No episodes available"}
              subtitle="Beyond the Scan Podcast by RadiologyJobs.com"
              coverImage="/lovable-uploads/680415d4-8d9a-4b0a-ab9f-afac4617df38.png"
            />
          )}
        </div>

        <div className="max-w-2xl mx-auto text-center px-4">
          <h2 className="text-lg font-medium text-white mb-4">ABOUT</h2>
          <p className="text-gray-400 leading-relaxed">
            For daily dives into tech, science, and culture. Our episodes, drawn from our Discover feed and brought to life with ElevenLabs' voices. Discover Daily is designed to fit seamlessly into your day—whether you're on the move or making the most of the in-between moments. Where will your curiosity take you?
          </p>
        </div>
        
        <div className="mt-16 text-center">
          <Link to="/admin" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Admin Access
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
