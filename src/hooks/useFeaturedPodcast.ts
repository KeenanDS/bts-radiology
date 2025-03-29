
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FeaturedPodcast {
  id: string;
  title?: string;
  custom_title?: string;
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
        
        // First try to get from the public function
        const { data, error } = await supabase.functions.invoke('get-featured-podcast');
        
        if (error) {
          // If function call fails, fall back to direct query
          const { data: podcastData, error: podcastError } = await supabase
            .from('podcast_episodes')
            .select('*')
            .eq('is_featured', true)
            .single();
          
          if (podcastError) {
            throw new Error(podcastError.message);
          }
          
          if (podcastData) {
            setPodcast({
              id: podcastData.id,
              title: podcastData.custom_title || `Episode ${new Date(podcastData.scheduled_for).toLocaleDateString()}`,
              custom_title: podcastData.custom_title,
              audio_url: podcastData.audio_url,
              scheduled_for: podcastData.scheduled_for,
              status: podcastData.status,
              is_featured: true
            });
          } else {
            setPodcast(null);
          }
        } else if (data.success && data.podcast) {
          setPodcast({
            id: data.podcast.id,
            title: data.podcast.custom_title || `Episode ${new Date(data.podcast.scheduled_for).toLocaleDateString()}`,
            custom_title: data.podcast.custom_title,
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
