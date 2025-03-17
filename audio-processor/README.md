# Podcast Audio Processor

This service adds background music to podcast audio files.

## Features

- Adds intro music with fade out
- Keeps the middle section as clean voice audio
- Adds outro music with fade in
- Configurable intro/outro durations and volume levels

## Setup Instructions

### Local Development

1. Install Python 3.9+ if not already installed
2. Install FFmpeg (required for audio processing):
   - Windows: Download from https://ffmpeg.org/download.html
   - Mac: `brew install ffmpeg`
   - Linux: `apt-get install ffmpeg`
3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
4. Run the service:
   ```
   uvicorn app:app --reload
   ```
5. The API will be available at http://localhost:8000

### Deployment

#### Railway, Render, or Fly.io (Recommended for Beginners)

1. Create an account on [Railway](https://railway.app/), [Render](https://render.com/), or [Fly.io](https://fly.io/)
2. Connect to this GitHub repository
3. The Dockerfile will handle everything else!
4. Set the `AUDIO_PROCESSOR_URL` environment variable in your Supabase project to point to the deployed URL

#### Docker (Advanced)

1. Build the Docker image:
   ```
   docker build -t podcast-audio-processor .
   ```
2. Run the container:
   ```
   docker run -p 8000:8000 podcast-audio-processor
   ```

## API Endpoints

### GET /

Health check endpoint.

### POST /mix-audio/

Mixes podcast audio with background music.

**Parameters:**
- `audio_url` (required): URL to the podcast audio file
- `background_music_url` (optional): URL to the background music file
- `intro_duration` (optional): Duration of intro in milliseconds (default: 10000)
- `outro_duration` (optional): Duration of outro in milliseconds (default: 10000)
- `background_volume` (optional): Background volume adjustment in dB (default: -10)

**Response:**
```json
{
  "success": true,
  "message": "Audio successfully mixed with background music"
}
``` 