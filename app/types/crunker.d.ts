declare module 'crunker' {
  export default class Crunker {
    constructor(options?: {
      sampleRate?: number;
      bitDepth?: number;
    });

    fetchAudio(...audioUrls: string[]): Promise<AudioBuffer[]>;
    mergeAudio(buffers: AudioBuffer[]): Promise<AudioBuffer>;
    export(buffer: AudioBuffer, type: string): Promise<{
      blob: Blob;
      url: string;
      element: HTMLAudioElement;
    }>;
    download(blob: Blob, filename?: string): Promise<void>;
    close(): Promise<void>;
    notSupported(callback: () => void): Promise<void>;
  }
} 