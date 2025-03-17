
// Audio processing utility for podcast episodes
// Handles merging audio streams, adding intro/outro music, and fading effects
// Compatible with Supabase Edge Functions (no subprocess)

// Audio processing settings - matching the previous Python implementation
export const AUDIO_SETTINGS = {
  INTRO_DURATION_MS: 50000,  // 50 seconds intro
  OUTRO_DURATION_MS: 30000,  // 30 seconds outro
  FADE_IN_DURATION_MS: 1000,  // 1 second fade in
  FADE_OUT_DURATION_MS: 3000,  // 3 seconds fade out
  MUSIC_VOLUME_REDUCTION_DB: -10  // Lower music volume under narration (in dB)
};

// Convert dB to amplitude multiplier (0-1 range)
export function dbToAmplitude(db: number): number {
  return Math.pow(10, db / 20);
}

// Helper to fetch audio as ArrayBuffer
export async function fetchAudioAsArrayBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio from ${url}: ${response.status} ${response.statusText}`);
  }
  return await response.arrayBuffer();
}

// Helper to create a Web Audio API AudioContext
// This is used for decoding audio files
export async function decodeAudio(audioData: ArrayBuffer): Promise<Float32Array[]> {
  // Use the newer AudioContext API available in Deno
  const decoder = new AudioDecoder({
    output: (frame) => {
      // Store the decoded frame data
      const channelData: Float32Array[] = [];
      for (let i = 0; i < frame.numberOfChannels; i++) {
        channelData.push(new Float32Array(frame.allocationSize({ planeIndex: i }) / 4));
        frame.copyTo(channelData[i], { planeIndex: i });
      }
      return channelData;
    },
    error: (e) => {
      throw new Error(`Error decoding audio: ${e}`);
    }
  });

  // Configure and decode
  decoder.configure({
    codec: 'mp3',
    sampleRate: 44100,
    numberOfChannels: 2
  });

  decoder.decode(new EncodedAudioChunk({
    type: 'key',
    timestamp: 0,
    duration: 0,
    data: audioData
  }));

  // Wait for decoding to complete
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      decoder.close();
      // Return the decoded audio data
      resolve(decoder.output);
    }, 1000);
  });
}

// Process and mix audio files
export async function processAudio(
  narrationBuffer: ArrayBuffer,
  musicBuffer: ArrayBuffer
): Promise<ArrayBuffer> {
  try {
    console.log("Starting audio processing...");
    
    // Decode audio files
    const narrationChannels = await decodeAudio(narrationBuffer);
    const musicChannels = await decodeAudio(musicBuffer);
    
    // Process the audio:
    // 1. Extract the intro part of the music
    const introMusic = extractAudioSegment(
      musicChannels, 
      0, 
      AUDIO_SETTINGS.INTRO_DURATION_MS
    );
    
    // Apply fade-out to intro music
    applyFadeOut(introMusic, AUDIO_SETTINGS.FADE_OUT_DURATION_MS);
    
    // 2. Extract the outro part of the music
    let outroMusic;
    const musicDuration = getMusicDuration(musicChannels);
    
    if (musicDuration < AUDIO_SETTINGS.OUTRO_DURATION_MS) {
      // If the music is too short for outro, loop it
      outroMusic = loopAudioToLength(
        musicChannels, 
        AUDIO_SETTINGS.OUTRO_DURATION_MS
      );
    } else {
      // Use the end of the music for outro
      const outroStartTime = Math.max(0, musicDuration - AUDIO_SETTINGS.OUTRO_DURATION_MS);
      outroMusic = extractAudioSegment(
        musicChannels, 
        outroStartTime, 
        AUDIO_SETTINGS.OUTRO_DURATION_MS
      );
    }
    
    // Apply fade-in to outro music
    applyFadeIn(outroMusic, AUDIO_SETTINGS.FADE_IN_DURATION_MS);
    
    // 3. Create the final composition
    const finalAudio = mergeAudioSegments([
      introMusic,
      narrationChannels,
      outroMusic
    ]);
    
    // 4. Encode the final audio as MP3
    const encodedAudio = await encodeAudioToMP3(finalAudio);
    
    console.log("Audio processing completed successfully");
    return encodedAudio;
    
  } catch (error) {
    console.error("Error processing audio:", error);
    throw error;
  }
}

// Helper functions for audio manipulation

function extractAudioSegment(
  audioChannels: Float32Array[], 
  startTimeMs: number, 
  durationMs: number
): Float32Array[] {
  // Convert ms to samples
  const sampleRate = 44100;
  const startSample = Math.floor(startTimeMs * sampleRate / 1000);
  const numSamples = Math.floor(durationMs * sampleRate / 1000);
  
  // Create new arrays for the extracted segment
  const extractedChannels: Float32Array[] = [];
  
  for (const channel of audioChannels) {
    const extractedChannel = new Float32Array(numSamples);
    
    // Copy the samples
    for (let i = 0; i < numSamples; i++) {
      if (startSample + i < channel.length) {
        extractedChannel[i] = channel[startSample + i];
      }
    }
    
    extractedChannels.push(extractedChannel);
  }
  
  return extractedChannels;
}

function applyFadeIn(audioChannels: Float32Array[], fadeDurationMs: number): void {
  const sampleRate = 44100;
  const fadeSamples = Math.floor(fadeDurationMs * sampleRate / 1000);
  
  for (const channel of audioChannels) {
    for (let i = 0; i < fadeSamples; i++) {
      const factor = i / fadeSamples;
      channel[i] *= factor;
    }
  }
}

function applyFadeOut(audioChannels: Float32Array[], fadeDurationMs: number): void {
  const sampleRate = 44100;
  const fadeSamples = Math.floor(fadeDurationMs * sampleRate / 1000);
  
  for (const channel of audioChannels) {
    for (let i = 0; i < fadeSamples; i++) {
      const factor = (fadeSamples - i) / fadeSamples;
      const index = channel.length - fadeSamples + i;
      if (index >= 0 && index < channel.length) {
        channel[index] *= factor;
      }
    }
  }
}

function getMusicDuration(audioChannels: Float32Array[]): number {
  if (!audioChannels || audioChannels.length === 0) {
    return 0;
  }
  
  const sampleRate = 44100;
  return (audioChannels[0].length / sampleRate) * 1000; // Duration in ms
}

function loopAudioToLength(
  audioChannels: Float32Array[], 
  targetDurationMs: number
): Float32Array[] {
  const sampleRate = 44100;
  const targetSamples = Math.floor(targetDurationMs * sampleRate / 1000);
  
  // Create new arrays for the looped audio
  const loopedChannels: Float32Array[] = [];
  
  for (const channel of audioChannels) {
    const loopedChannel = new Float32Array(targetSamples);
    
    // Fill the new array by looping the original
    for (let i = 0; i < targetSamples; i++) {
      loopedChannel[i] = channel[i % channel.length];
    }
    
    loopedChannels.push(loopedChannel);
  }
  
  return loopedChannels;
}

function mergeAudioSegments(segments: Float32Array[][]): Float32Array[] {
  if (segments.length === 0) {
    return [];
  }
  
  // Calculate total length
  let totalLength = 0;
  for (const segment of segments) {
    if (segment && segment[0]) {
      totalLength += segment[0].length;
    }
  }
  
  // Create output channels
  const numChannels = Math.max(...segments.map(s => s.length));
  const output: Float32Array[] = [];
  
  for (let c = 0; c < numChannels; c++) {
    output.push(new Float32Array(totalLength));
  }
  
  // Merge segments
  let currentPosition = 0;
  
  for (const segment of segments) {
    if (!segment || segment.length === 0 || !segment[0]) {
      continue;
    }
    
    const segmentLength = segment[0].length;
    
    for (let c = 0; c < numChannels; c++) {
      const sourceChannel = c < segment.length ? segment[c] : segment[0];
      
      for (let i = 0; i < segmentLength; i++) {
        output[c][currentPosition + i] = sourceChannel[i];
      }
    }
    
    currentPosition += segmentLength;
  }
  
  return output;
}

async function encodeAudioToMP3(audioChannels: Float32Array[]): Promise<ArrayBuffer> {
  // For now, we'll use a simple WAV encoding since MP3 encoding is complex
  // In a production environment, you'd want to use a proper MP3 encoder library
  
  const sampleRate = 44100;
  const numChannels = audioChannels.length;
  const bitsPerSample = 16;
  
  // Calculate sizes
  const dataSize = audioChannels[0].length * numChannels * (bitsPerSample / 8);
  const fileSize = 44 + dataSize;
  
  // Create buffer for WAV file
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  
  // Write WAV header
  // RIFF chunk descriptor
  writeString(view, 0, "RIFF");
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, "WAVE");
  
  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); // byte rate
  view.setUint16(32, numChannels * (bitsPerSample / 8), true); // block align
  view.setUint16(34, bitsPerSample, true);
  
  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);
  
  // Write audio data
  const offset = 44;
  const volume = 1;
  const numSamples = audioChannels[0].length;
  
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, audioChannels[c][i])) * volume;
      const int16Sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset + ((i * numChannels) + c) * 2, int16Sample, true);
    }
  }
  
  return buffer;
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
