import Crunker from 'crunker';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ProcessAudioResponse {
  success: boolean;
  processedAudioUrl?: string;
  error?: string;
}

export async function processEpisodeAudio(episodeId: string): Promise<ProcessAudioResponse> {
  try {
    // 1. Call the Supabase function to get audio URLs
    const { data, error } = await supabase.functions.invoke('process-podcast-audio', {
      body: { episodeId }
    });

    if (error) {
      throw new Error(`Failed to get audio URLs: ${error.message}`);
    }

    const { audioUrl, backgroundMusicUrl } = data;

    // 2. Initialize Crunker
    const crunker = new Crunker();

    // 3. Load both audio files
    console.log('Loading audio files...');
    const [episodeAudio, backgroundMusic] = await crunker.fetchAudio(
      audioUrl,
      backgroundMusicUrl
    );

    // 4. Merge the audio files
    console.log('Merging audio files...');
    const merged = await crunker.mergeAudio([episodeAudio, backgroundMusic]);

    // 5. Export as blob
    console.log('Exporting merged audio...');
    const output = await crunker.export(merged, 'audio/mp3');
    const audioBlob = output.blob;

    // 6. Create a unique filename
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const filename = `podcast_${episodeId}_processed_${timestamp}.mp3`;
    const filePath = `podcast_audio/${filename}`;

    // 7. Upload to Supabase Storage
    console.log('Uploading processed audio...');
    const { error: uploadError } = await supabase.storage
      .from('podcast_audio')
      .upload(filePath, audioBlob, {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload processed audio: ${uploadError.message}`);
    }

    // 8. Get the public URL
    const { data: publicUrlData } = await supabase.storage
      .from('podcast_audio')
      .getPublicUrl(filePath);

    const processedAudioUrl = publicUrlData.publicUrl;

    // 9. Update the episode record
    const { error: updateError } = await supabase
      .from('podcast_episodes')
      .update({
        processed_audio_url: processedAudioUrl,
        background_music_url: backgroundMusicUrl,
        audio_processing_status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', episodeId);

    if (updateError) {
      throw new Error(`Failed to update episode record: ${updateError.message}`);
    }

    return {
      success: true,
      processedAudioUrl
    };

  } catch (error) {
    console.error('Error processing audio:', error);
    
    // Update episode with error status
    await supabase
      .from('podcast_episodes')
      .update({
        audio_processing_status: 'error',
        audio_processing_error: error.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', episodeId);

    return {
      success: false,
      error: error.message
    };
  }
} 