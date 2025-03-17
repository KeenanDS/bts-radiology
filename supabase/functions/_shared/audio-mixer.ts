
// Simple audio mixer for combining podcast narration with background music
// Uses basic buffer operations without requiring browser APIs

/**
 * Adjusts volume of an audio buffer by multiplying samples by a factor
 */
export function adjustVolume(audioBuffer: Uint8Array, volumeFactor: number): Uint8Array {
  // Create a new buffer to avoid modifying the original
  const adjustedBuffer = new Uint8Array(audioBuffer.length);
  
  // Apply volume adjustment
  for (let i = 0; i < audioBuffer.length; i++) {
    // Get the sample value (centered at 128 for 8-bit audio)
    const sample = audioBuffer[i] - 128;
    // Apply volume factor and re-center
    const adjusted = Math.round(sample * volumeFactor) + 128;
    // Clamp the value to valid range (0-255)
    adjustedBuffer[i] = Math.max(0, Math.min(255, adjusted));
  }
  
  return adjustedBuffer;
}

/**
 * Mixes two audio buffers together with specified volume factors
 * Assumes both buffers have the same sample rate and format
 */
export function mixAudioBuffers(
  primaryBuffer: Uint8Array, 
  secondaryBuffer: Uint8Array,
  primaryVolume: number = 1.0,
  secondaryVolume: number = 0.3
): Uint8Array {
  // Use the longer buffer length
  const resultLength = Math.max(primaryBuffer.length, secondaryBuffer.length);
  const mixedBuffer = new Uint8Array(resultLength);
  
  // Fill with silence first (middle value for 8-bit audio)
  mixedBuffer.fill(128);
  
  // Simple mixing algorithm
  for (let i = 0; i < resultLength; i++) {
    // Get primary sample (or silence if beyond buffer)
    const primarySample = i < primaryBuffer.length ? (primaryBuffer[i] - 128) * primaryVolume : 0;
    
    // Get secondary sample (or silence if beyond buffer)
    const secondarySample = i < secondaryBuffer.length ? (secondaryBuffer[i] - 128) * secondaryVolume : 0;
    
    // Mix samples and re-center
    const mixedSample = primarySample + secondarySample + 128;
    
    // Clamp the value to valid range (0-255)
    mixedBuffer[i] = Math.max(0, Math.min(255, Math.round(mixedSample)));
  }
  
  return mixedBuffer;
}

/**
 * Adds background music to podcast audio
 * Creates a composition with intro music, narration with quieter background music, and outro music
 */
export function createPodcastWithMusic(
  narrationBuffer: Uint8Array,
  musicBuffer: Uint8Array,
  options: {
    introLengthSec: number;
    outroLengthSec: number;
    fadeInSec: number;
    fadeOutSec: number;
    musicVolume: number;
    sampleRate: number;
  }
): Uint8Array {
  const { introLengthSec, outroLengthSec, fadeInSec, fadeOutSec, musicVolume, sampleRate } = options;
  
  // Convert seconds to samples
  const samplesPerSecond = sampleRate;
  const introLength = introLengthSec * samplesPerSecond;
  const outroLength = outroLengthSec * samplesPerSecond;
  const fadeInSamples = fadeInSec * samplesPerSecond;
  const fadeOutSamples = fadeOutSec * samplesPerSecond;
  
  // Calculate total output length
  const totalLength = introLength + narrationBuffer.length + outroLength;
  const result = new Uint8Array(totalLength);
  result.fill(128); // Fill with silence (middle value for 8-bit audio)
  
  // 1. Add intro music (loop music if needed)
  for (let i = 0; i < introLength; i++) {
    const musicIndex = i % musicBuffer.length;
    result[i] = musicBuffer[musicIndex];
  }
  
  // 2. Apply fade out to end of intro
  for (let i = 0; i < fadeOutSamples; i++) {
    const index = introLength - fadeOutSamples + i;
    const factor = 1 - (i / fadeOutSamples);
    const sample = result[index] - 128;
    result[index] = Math.round(sample * factor) + 128;
  }
  
  // 3. Add narration with background music at reduced volume
  for (let i = 0; i < narrationBuffer.length; i++) {
    const outputIndex = introLength + i;
    const musicIndex = (introLength + i) % musicBuffer.length;
    
    // Get narration sample
    const narrationSample = narrationBuffer[i] - 128;
    
    // Get music sample at reduced volume
    const musicSample = (musicBuffer[musicIndex] - 128) * musicVolume;
    
    // Mix the samples
    const mixedSample = narrationSample + musicSample + 128;
    
    // Clamp the value
    result[outputIndex] = Math.max(0, Math.min(255, Math.round(mixedSample)));
  }
  
  // 4. Add outro music with fade in
  for (let i = 0; i < outroLength; i++) {
    const outputIndex = introLength + narrationBuffer.length + i;
    const musicIndex = (introLength + narrationBuffer.length + i) % musicBuffer.length;
    
    // Apply fade-in at the beginning of outro
    let volume = 1.0;
    if (i < fadeInSamples) {
      volume = i / fadeInSamples;
    }
    
    // Get music sample and apply volume
    const musicSample = (musicBuffer[musicIndex] - 128) * volume;
    
    // Add to result
    result[outputIndex] = Math.round(musicSample) + 128;
  }
  
  return result;
}

/**
 * Simple utility to convert MP3 to raw PCM audio
 * This is a placeholder - in a real implementation you would need a dedicated MP3 decoder
 * For this example, we're simulating the conversion
 */
export function convertMP3toRawPCM(mp3Buffer: Uint8Array): Uint8Array {
  // In a real implementation, you would use a proper MP3 decoder library
  // For now, we'll just return the buffer (this won't work in production)
  // This is just to demonstrate the concept
  return mp3Buffer;
}

/**
 * Converts raw PCM audio back to MP3
 * This is a placeholder - in a real implementation you would need a dedicated MP3 encoder
 */
export function convertRawPCMtoMP3(pcmBuffer: Uint8Array): Uint8Array {
  // In a real implementation, you would use a proper MP3 encoder library
  // For now, we'll just return the buffer (this won't work in production)
  return pcmBuffer;
}
