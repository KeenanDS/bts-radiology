
// Time windows for progressive search (in days)
export const TIME_WINDOWS = [7, 14, 30];

// Voice IDs for podcast generation
export const DEFAULT_VOICE_ID = "bmAn0TLASQN7ctGBMHgN"; // Bennet's voice ID

// Background music file paths in the podcast_music bucket
export const DEFAULT_BACKGROUND_MUSIC = "default_background.mp3";
export const INTRO_MUSIC = "intro_music.mp3";
export const OUTRO_MUSIC = "outro_music.mp3";

// Audio timing settings (in seconds)
export const INTRO_DURATION = 50;
export const INTRO_FADE_DURATION = 5;
export const OUTRO_DURATION = 30;
export const OUTRO_FADE_DURATION = 5;

// Retry settings
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 2000;

// Dolby.io API Settings
export const DOLBY_API_URL = "https://api.dolby.com";  // Base URL
export const DOLBY_AUTH_PATH = "/v1/auth/token";       // Auth endpoint
export const DOLBY_MEDIA_PATH = "/media";              // Media endpoints base path
export const DOLBY_INPUT_PATH = "dlb://in/";           // Standard path for input files
export const DOLBY_OUTPUT_PATH = "dlb://out/";         // Standard path for output files

