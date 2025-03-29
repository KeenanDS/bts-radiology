
import AudioPlayer from "@/components/AudioPlayer";
import { Link } from "react-router-dom";
import { useFeaturedPodcast } from "@/hooks/useFeaturedPodcast";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { podcast, isLoading, error } = useFeaturedPodcast();
  const { user } = useAuth();

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-6 relative" 
      style={{
        backgroundImage: "url('/bg-image/mri.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      }}
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-black bg-opacity-70"></div>
      
      <div className="max-w-4xl w-full text-center space-y-20 relative z-10">
        <div className="space-y-4">
          <h1 className="text-7xl font-bold text-white tracking-tight">Beyond The Scan</h1>
          <p className="text-2xl text-gray-400">Listen To The Latest Episode</p>
          <div className="text-sm uppercase tracking-widest text-gray-500 mt-8">PRESENTED BY RADIOLOGYJOBS.COM</div>
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

        <div className="max-w-2xl mx-auto text-center px-4 mt-16">
          <p className="text-sm text-gray-400 leading-relaxed">
            Beyond the Scan – a bi-weekly podcast where our AI host JACKIE dives into breakthrough medical technologies and healthcare innovations. Perfect for busy professionals looking to stay informed on the latest advancements reshaping patient care and medical practice. Tune in every two weeks for concise, engaging episodes that fit seamlessly into your schedule. Where will healthcare innovation take us next? Join JACKIE to find out.
          </p>
        </div>
        
        <div className="mt-16 text-center space-y-4">
          {user ? (
            <Link to="/admin" className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors">
              Go to Admin Dashboard
            </Link>
          ) : (
            <div className="space-x-4">
              <Link to="/login" className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors">
                Admin Access
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
