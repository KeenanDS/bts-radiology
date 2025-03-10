
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FeaturedPodcast {
  id: string;
  title?: string;
  audio_url?: string;
  scheduled_for: string;
  status: string;
  is_featured: boolean;
}

export const useFeaturedPodcast = () => {
  const [podcast, setPodcast] = useState<FeaturedPodcast | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeaturedPodcast = async () => {
      try {
        setIsLoading(true);
        
        const { data, error } = await supabase.functions.invoke('get-featured-podcast');
        
        if (error) {
          throw new Error(error.message);
        }
        
        if (data.success && data.podcast) {
          setPodcast({
            id: data.podcast.id,
            title: `Episode ${new Date(data.podcast.scheduled_for).toLocaleDateString()}`,
            audio_url: data.podcast.audio_url,
            scheduled_for: data.podcast.scheduled_for,
            status: data.podcast.status,
            is_featured: !!data.isFeatured
          });
        } else {
          setPodcast(null);
        }
      } catch (err) {
        console.error("Error fetching featured podcast:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch podcast");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeaturedPodcast();
  }, []);

  return { podcast, isLoading, error };
};
