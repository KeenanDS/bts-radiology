
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import PodcastHistoryItem from "./PodcastHistoryItem";
import { useToast } from "@/hooks/use-toast";

export interface PodcastEpisode {
  id: string;
  scheduled_for: string;
  status: string;
  podcast_script: string | null;
  audio_url: string | null;
  created_at: string;
  updated_at: string;
  is_featured: boolean;
  custom_title?: string | null;
  audio_processing_status?: string;
  audio_processing_error?: string;
  processed_audio_url?: string;
  background_music_url?: string;
}

const PodcastHistory = () => {
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchPodcastEpisodes();
  }, []);

  const fetchPodcastEpisodes = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("podcast_episodes")
        .select("*")
        .order("scheduled_for", { ascending: false });

      if (error) throw error;
      
      if (data) {
        setEpisodes(data as PodcastEpisode[]);
      }
    } catch (error) {
      console.error("Error fetching podcast episodes:", error);
      toast({
        title: "Error",
        description: "Failed to load podcast history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEpisode = (id: string) => {
    setEpisodes((prevEpisodes) => 
      prevEpisodes.filter((episode) => episode.id !== id)
    );
  };

  const handleSetFeatured = (id: string) => {
    setEpisodes((prevEpisodes) => 
      prevEpisodes.map((episode) => ({
        ...episode,
        is_featured: episode.id === id
      }))
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  if (episodes.length === 0) {
    return (
      <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
        <CardHeader>
          <CardTitle className="text-white text-xl">Podcast History</CardTitle>
          <CardDescription className="text-gray-400">
            Your generated podcast episodes will appear here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10 text-gray-400">
            <p>No podcast episodes found. Generate your first podcast to see it here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
      <CardHeader>
        <CardTitle className="text-white text-xl">Podcast History</CardTitle>
        <CardDescription className="text-gray-400">
          Your generated podcast episodes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {episodes.map((episode) => (
          <PodcastHistoryItem 
            key={episode.id} 
            episode={episode} 
            onDelete={handleDeleteEpisode}
            onSetFeatured={handleSetFeatured}
            onRefresh={fetchPodcastEpisodes}
          />
        ))}
      </CardContent>
    </Card>
  );
};

export default PodcastHistory;
