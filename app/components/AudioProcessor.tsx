import React, { useState } from 'react';
import { processEpisodeAudio } from '../utils/audioProcessing';

// Logging utility
const log = {
  info: (message: string, data?: Record<string, unknown>) => {
    console.log(`[AudioProcessor][INFO] ${message}`, data ? data : '');
  },
  error: (message: string, error?: Error | Record<string, unknown>) => {
    console.error(`[AudioProcessor][ERROR] ${message}`, error ? error : '');
  },
  debug: (message: string, data?: Record<string, unknown>) => {
    console.debug(`[AudioProcessor][DEBUG] ${message}`, data ? data : '');
  }
};

interface AudioProcessorProps {
  episodeId: string;
  onComplete?: (processedUrl: string) => void;
  onError?: (error: string) => void;
}

export default function AudioProcessor({ 
  episodeId, 
  onComplete, 
  onError 
}: AudioProcessorProps) {
  log.debug('Rendering AudioProcessor component', { episodeId });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProcessAudio = async () => {
    log.info(`Starting audio processing for episode: ${episodeId}`);
    
    try {
      setIsProcessing(true);
      setError(null);
      log.debug('Updated component state', { isProcessing: true, error: null });

      const result = await processEpisodeAudio(episodeId);
      log.debug('Received processing result', { success: result.success, hasUrl: !!result.processedAudioUrl });

      if (result.success && result.processedAudioUrl) {
        log.info(`Audio processing completed successfully for episode: ${episodeId}`, {
          processedUrl: result.processedAudioUrl
        });
        onComplete?.(result.processedAudioUrl);
      } else {
        const errorMsg = result.error || 'Unknown error occurred';
        log.error(`Processing failed for episode: ${episodeId}`, { error: errorMsg });
        throw new Error(errorMsg);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process audio';
      log.error(`Error in audio processing for episode: ${episodeId}`, { error: errorMessage });
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
      log.debug('Reset processing state', { isProcessing: false });
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <button
        onClick={() => {
          log.debug('Process audio button clicked', { episodeId });
          handleProcessAudio();
        }}
        disabled={isProcessing}
        className={`px-4 py-2 rounded-lg font-medium ${
          isProcessing
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        {isProcessing ? 'Processing...' : 'Process Audio'}
      </button>

      {error && (
        <div className="text-red-500 text-sm mt-2">
          Error: {error}
        </div>
      )}
    </div>
  );
} 