import Crunker from 'crunker';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client using the public client
import { supabase } from '@/integrations/supabase/client';

// Logging utility
const log = {
  info: (message: string, data?: Record<string, unknown>) => {
    console.log(`[INFO] ${message}`, data ? data : '');
  },
  error: (message: string, error?: Error | Record<string, unknown>) => {
    console.error(`[ERROR] ${message}`, error ? error : '');
  },
  debug: (message: string, data?: Record<string, unknown>) => {
    console.debug(`[DEBUG] ${message}`, data ? data : '');
  }
};

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to get file size from URL
async function getFileSizeFromUrl(url: string): Promise<number> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const size = response.headers.get('content-length');
    return size ? parseInt(size, 10) : 0;
  } catch (error) {
    log.error(`Failed to get file size for URL: ${url}`, error);
    return 0;
  }
}

interface ProcessAudioResponse {
  success: boolean;
  processedAudioUrl?: string;
  error?: string;
}

export async function processEpisodeAudio(episodeId: string): Promise<ProcessAudioResponse> {
  log.info(`Starting audio processing for episode: ${episodeId}`);
  
  try {
    // 1. Call the Supabase function to get audio URLs
    log.info(`Fetching audio URLs for episode: ${episodeId}`);
    const { data, error } = await supabase.functions.invoke('process-podcast-audio', {
      body: { episodeId }
    });

    if (error) {
      log.error(`Failed to get audio URLs for episode: ${episodeId}`, error);
      throw new Error(`Failed to get audio URLs: ${error.message}`);
    }

    const { audioUrl, backgroundMusicUrl } = data;
    
    // Check input file sizes
    const [episodeSize, backgroundMusicSize] = await Promise.all([
      getFileSizeFromUrl(audioUrl),
      getFileSizeFromUrl(backgroundMusicUrl)
    ]);
    
    log.info('Input file sizes', {
      episode: formatFileSize(episodeSize),
      backgroundMusic: formatFileSize(backgroundMusicSize),
      totalInput: formatFileSize(episodeSize + backgroundMusicSize)
    });

    // 2. Initialize Crunker with lower sample rate
    log.info('Initializing audio processor');
    const crunker = new Crunker({
      sampleRate: 22050 // Lower sample rate for smaller file size (half of CD quality)
    });

    // 3. Load both audio files
    log.info('Loading audio files...', { audioUrl, backgroundMusicUrl });
    const [episodeAudio, backgroundMusic] = await crunker.fetchAudio(
      audioUrl,
      backgroundMusicUrl
    );

    // Reduce background music volume
    const backgroundGain = 0.3; // 30% volume
    for (let channel = 0; channel < backgroundMusic.numberOfChannels; channel++) {
      const channelData = backgroundMusic.getChannelData(channel);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] *= backgroundGain;
      }
    }

    log.debug('Audio buffers loaded', {
      episodeLength: episodeAudio.length,
      episodeDuration: episodeAudio.duration,
      backgroundLength: backgroundMusic.length,
      backgroundDuration: backgroundMusic.duration
    });

    // 4. Merge the audio files
    log.info('Merging audio files...');
    const merged = await crunker.mergeAudio([episodeAudio, backgroundMusic]);
    log.debug('Audio merge completed', {
      mergedLength: merged.length,
      mergedDuration: merged.duration
    });

    // 5. Export with compression
    log.info('Exporting merged audio...');
    const output = await crunker.export(merged, 'audio/mp3');
    const audioBlob = output.blob;
    
    log.info('Audio export completed', { 
      outputSize: formatFileSize(audioBlob.size),
      inputSize: formatFileSize(episodeSize + backgroundMusicSize),
      compressionRatio: ((episodeSize + backgroundMusicSize) / audioBlob.size).toFixed(2)
    });

    // Check if output size exceeds Supabase limit (50MB)
    const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB in bytes
    if (audioBlob.size > MAX_UPLOAD_SIZE) {
      throw new Error(`Output file size (${formatFileSize(audioBlob.size)}) exceeds maximum allowed size (${formatFileSize(MAX_UPLOAD_SIZE)})`);
    }

    // 6. Create a unique filename
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const filename = `podcast_${episodeId}_processed_${timestamp}.mp3`;
    const filePath = `podcast_audio/${filename}`;
    log.debug('Generated file path', { filePath });

    // 7. Upload to Supabase Storage
    log.info('Uploading processed audio...', { 
      filePath,
      fileSize: formatFileSize(audioBlob.size)
    });
    
    const { error: uploadError } = await supabase.storage
      .from('podcast_audio')
      .upload(filePath, audioBlob, {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (uploadError) {
      log.error(`Upload failed for episode: ${episodeId}`, uploadError);
      throw new Error(`Failed to upload processed audio: ${uploadError.message}`);
    }
    log.info('Upload completed successfully');

    // 8. Get the public URL
    log.info('Generating public URL');
    const { data: publicUrlData } = await supabase.storage
      .from('podcast_audio')
      .getPublicUrl(filePath);

    const processedAudioUrl = publicUrlData.publicUrl;
    log.debug('Public URL generated', { processedAudioUrl });

    // 9. Update the episode record
    log.info(`Updating episode record: ${episodeId}`);
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
      log.error(`Failed to update episode record: ${episodeId}`, updateError);
      throw new Error(`Failed to update episode record: ${updateError.message}`);
    }
    log.info(`Audio processing completed successfully for episode: ${episodeId}`);

    return {
      success: true,
      processedAudioUrl
    };

  } catch (error) {
    log.error(`Error processing audio for episode: ${episodeId}`, error);
    
    // Update episode with error status
    log.info(`Updating episode ${episodeId} with error status`);
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