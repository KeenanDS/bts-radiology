
import { supabase } from "@/integrations/supabase/client";

export const ensurePodcastAudioBucket = async (): Promise<void> => {
  try {
    // Check if bucket exists
    const { data: bucket, error } = await supabase
      .storage
      .getBucket('podcast_audio');
    
    if (error || !bucket) {
      console.log("Creating podcast_audio bucket...");
      const { error: createError } = await supabase
        .storage
        .createBucket('podcast_audio', {
          public: true,
          allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/x-m4a'],
          fileSizeLimit: 52428800, // 50MB
        });
      
      if (createError) {
        console.error("Error creating bucket:", createError);
      }
    }
  } catch (error) {
    console.error("Error checking/creating podcast_audio bucket:", error);
  }
};
