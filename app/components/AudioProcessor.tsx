import React, { useState } from 'react';
import { processEpisodeAudio } from '../utils/audioProcessing';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProcessAudio = async () => {
    try {
      setIsProcessing(true);
      setError(null);

      const result = await processEpisodeAudio(episodeId);

      if (result.success && result.processedAudioUrl) {
        onComplete?.(result.processedAudioUrl);
      } else {
        throw new Error(result.error || 'Unknown error occurred');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process audio';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <button
        onClick={handleProcessAudio}
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