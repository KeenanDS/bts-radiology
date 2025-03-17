
# process-podcast-audio-python/index.py
import base64
import io
import json
import os
import tempfile
import time
import sys
from http.server import BaseHTTPRequestHandler
from typing import Any, Dict, Optional

import requests
from pydub import AudioSegment

# CORS headers
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
}

# Audio processing settings - Using the updated constants
INTRO_DURATION_MS = 50000  # 50 seconds intro
OUTRO_DURATION_MS = 30000  # 30 seconds outro
FADE_IN_DURATION_MS = 1000  # 1 second fade in
FADE_OUT_DURATION_MS = 3000  # 3 seconds fade out
MUSIC_VOLUME_REDUCTION_DB = -10  # Lower music volume under narration

# Supabase client helpers
def create_supabase_client():
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError("Missing Supabase credentials")
    
    return {"url": supabase_url, "key": supabase_key}

def download_file(url: str) -> bytes:
    """Download a file from a URL and return the binary content."""
    response = requests.get(url)
    response.raise_for_status()
    return response.content

def upload_to_supabase(bucket: str, path: str, file_content: bytes, content_type: str) -> str:
    """Upload a file to Supabase Storage and return its public URL."""
    supabase = create_supabase_client()
    
    upload_url = f"{supabase['url']}/storage/v1/object/{bucket}/{path}"
    
    headers = {
        "Authorization": f"Bearer {supabase['key']}",
        "Content-Type": content_type,
    }
    
    response = requests.post(upload_url, headers=headers, data=file_content)
    response.raise_for_status()
    
    # Get public URL
    public_url = f"{supabase['url']}/storage/v1/object/public/{bucket}/{path}"
    return public_url

def update_podcast_episode(episode_id: str, data: Dict[str, Any]) -> None:
    """Update a podcast episode record in the database."""
    supabase = create_supabase_client()
    
    url = f"{supabase['url']}/rest/v1/podcast_episodes?id=eq.{episode_id}"
    
    headers = {
        "Authorization": f"Bearer {supabase['key']}",
        "apikey": supabase['key'],
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    
    response = requests.patch(url, headers=headers, json=data)
    response.raise_for_status()

def get_background_music() -> bytes:
    """Get the default background music file from storage."""
    supabase = create_supabase_client()
    
    # For now, we use a fixed background music file
    # In the future, this could be configurable per podcast
    url = f"{supabase['url']}/storage/v1/object/public/podcast_music/default_background.mp3"
    
    try:
        return download_file(url)
    except requests.RequestException:
        # If default music is not found, use a fallback mechanism or raise an error
        raise ValueError("Default background music not found. Please upload a file named 'default_background.mp3' to the podcast_music bucket.")

def process_audio(podcast_audio_url: str, episode_id: str) -> str:
    """
    Process podcast audio by adding background music and fades.
    Returns the URL of the processed audio.
    """
    try:
        # Download the podcast narration audio
        narration_audio_bytes = download_file(podcast_audio_url)
        
        # Load the narration audio
        narration = AudioSegment.from_file(io.BytesIO(narration_audio_bytes), format="mp3")
        
        # Get and load the background music
        try:
            music_bytes = get_background_music()
            background_music = AudioSegment.from_file(io.BytesIO(music_bytes), format="mp3")
        except Exception as e:
            print(f"Error loading background music: {str(e)}")
            # If we can't load music, just return the original narration
            update_podcast_episode(
                episode_id, 
                {
                    "audio_processing_status": "error",
                    "audio_processing_error": f"Failed to load background music: {str(e)}"
                }
            )
            return podcast_audio_url
        
        # Process the audio
        # 1. Prepare the music segments
        intro_music = background_music[:INTRO_DURATION_MS]
        intro_music = intro_music.fade_out(FADE_OUT_DURATION_MS)
        
        # If the music is too short for outro, loop it
        if len(background_music) < OUTRO_DURATION_MS:
            music_loops = (OUTRO_DURATION_MS // len(background_music)) + 1
            outro_music = background_music * music_loops
        else:
            outro_music = background_music[-OUTRO_DURATION_MS:]
        
        outro_music = outro_music.fade_in(FADE_IN_DURATION_MS)
        
        # 2. Create the final composition
        # Intro music (full volume)
        final_audio = intro_music
        
        # Add narration
        final_audio = final_audio + narration
        
        # Add outro music
        final_audio = final_audio + outro_music
        
        # 3. Export to MP3
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp_file:
            final_audio.export(tmp_file.name, format="mp3", bitrate="128k")
            tmp_file_path = tmp_file.name
        
        # 4. Read the processed file
        with open(tmp_file_path, "rb") as f:
            processed_audio_bytes = f.read()
        
        # 5. Clean up
        os.unlink(tmp_file_path)
        
        # 6. Upload the processed audio to Supabase
        timestamp = int(time.time())
        processed_file_path = f"processed_{episode_id}_{timestamp}.mp3"
        processed_audio_url = upload_to_supabase(
            "podcast_audio", 
            processed_file_path, 
            processed_audio_bytes, 
            "audio/mpeg"
        )
        
        # 7. Update the podcast episode record
        update_podcast_episode(
            episode_id,
            {
                "processed_audio_url": processed_audio_url,
                "audio_processing_status": "completed"
            }
        )
        
        return processed_audio_url
    
    except Exception as e:
        # Handle errors
        error_message = str(e)
        print(f"Error processing audio: {error_message}")
        
        # Update the podcast episode with error information
        update_podcast_episode(
            episode_id,
            {
                "audio_processing_status": "error",
                "audio_processing_error": error_message
            }
        )
        
        # Return the original URL if processing fails
        return podcast_audio_url

class Handler(BaseHTTPRequestHandler):
    def __init__(self):
        self.response_data = None
        
    def do_OPTIONS(self):
        self.send_response(200)
        for key, value in CORS_HEADERS.items():
            self.send_header(key, value)
        self.end_headers()
    
    def do_POST(self):
        try:
            # Parse the request body
            if hasattr(self, 'body'):
                request_body = self.body
                payload = json.loads(request_body)
            else:
                payload = json.loads(sys.stdin.read())
            
            # Extract required parameters
            episode_id = payload.get("episodeId")
            audio_url = payload.get("audioUrl")
            
            if not episode_id or not audio_url:
                self.send_error_response(400, "Missing required parameters: episodeId or audioUrl")
                return
            
            # Update the episode status
            update_podcast_episode(
                episode_id,
                {"audio_processing_status": "processing"}
            )
            
            # Process the audio
            processed_url = process_audio(audio_url, episode_id)
            
            # Send response
            self.response_data = {
                "success": True,
                "episodeId": episode_id,
                "processedAudioUrl": processed_url
            }
            self.send_success_response(self.response_data)
            
        except Exception as e:
            self.send_error_response(500, f"Internal server error: {str(e)}")
    
    def send_success_response(self, data):
        self.send_response(200)
        for key, value in CORS_HEADERS.items():
            self.send_header(key, value)
        self.end_headers()
        self.response_data = data
        if hasattr(self, 'wfile'):
            self.wfile.write(json.dumps(data).encode())
    
    def send_error_response(self, status_code, message):
        self.send_response(status_code)
        for key, value in CORS_HEADERS.items():
            self.send_header(key, value)
        self.end_headers()
        error_data = {
            "success": False,
            "error": message
        }
        self.response_data = error_data
        if hasattr(self, 'wfile'):
            self.wfile.write(json.dumps(error_data).encode())

def serve(request):
    handler = Handler()
    handler.do_POST()
    return handler.response
