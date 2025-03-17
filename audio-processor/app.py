
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Body
import uvicorn
from pydub import AudioSegment
import os
import requests
import tempfile
import shutil
import base64
import json
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from pydantic import BaseModel

# Define the input model for the mix-audio endpoint
class AudioMixRequest(BaseModel):
    audio_url: str
    background_music_url: str = "https://gbypnkiziennhzqbhqtr.supabase.co/storage/v1/object/public/podcast_music//default_background.mp3"
    intro_duration: int = 10000
    outro_duration: int = 10000
    background_volume: float = -10
    storage_bucket: str = "podcast_audio"
    filename_prefix: str = "processed_"

# Define the Supabase storage configuration model
class SupabaseConfig(BaseModel):
    supabase_url: Optional[str] = None
    supabase_key: Optional[str] = None
    episode_id: Optional[str] = None

app = FastAPI(title="Podcast Audio Mixer")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update with your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "Audio Processor API is running"}

@app.post("/mix-audio/")
async def mix_audio(
    request: AudioMixRequest,
    supabase_config: Optional[SupabaseConfig] = Body(None)
):
    """
    Mix podcast audio with background music
    - Adds intro music with fade out
    - Keeps middle section as voice only
    - Adds outro music with fade in
    - Uploads to Supabase storage if credentials provided
    """
    try:
        # Log the received request for debugging
        print(f"Received request: {request}")
        print(f"Received Supabase config: {supabase_config}")
        
        # Create temp directory
        temp_dir = tempfile.mkdtemp()
        
        # Download the podcast audio
        podcast_path = os.path.join(temp_dir, "podcast.mp3")
        download_file(request.audio_url, podcast_path)
        
        # Download background music
        music_path = os.path.join(temp_dir, "background.mp3")
        download_file(request.background_music_url, music_path)
        
        # Load audio files
        podcast = AudioSegment.from_mp3(podcast_path)
        background = AudioSegment.from_mp3(music_path)
        
        # Adjust background volume
        background = background + request.background_volume  # Reduce volume
        
        # Calculate durations
        podcast_duration = len(podcast)
        
        # Make sure background is long enough (loop if needed)
        while len(background) < podcast_duration + request.intro_duration:
            background = background + background  # Double it
            
        # Get intro segment with fade out
        intro = background[:request.intro_duration]
        intro = intro.fade_out(request.intro_duration)
        
        # Get outro segment with fade in
        outro_start = podcast_duration - request.outro_duration
        outro = background[request.intro_duration:request.intro_duration + request.outro_duration]
        outro = outro.fade_in(request.outro_duration)
        
        # Overlay intro at the beginning
        result = podcast.overlay(intro, position=0)
        
        # Overlay outro at the end
        result = result.overlay(outro, position=outro_start)
        
        # Export the mixed audio
        output_path = os.path.join(temp_dir, "mixed_podcast.mp3")
        result.export(output_path, format="mp3")
        
        # Generate a unique filename
        timestamp = requests.get("http://worldtimeapi.org/api/timezone/Etc/UTC").json()["datetime"].replace(":", "").replace("-", "").replace(".", "")[:14]
        episode_id_part = f"_{supabase_config.episode_id}" if supabase_config and supabase_config.episode_id else ""
        filename = f"{request.filename_prefix}{timestamp}{episode_id_part}.mp3"
        
        # Check if we have Supabase credentials to upload the file
        processed_audio_url = None
        if supabase_config and supabase_config.supabase_url and supabase_config.supabase_key:
            try:
                print(f"Uploading processed audio to Supabase storage bucket: {request.storage_bucket}")
                
                # Construct the file path in the storage bucket
                file_path = f"processed/{filename}"
                
                # Upload to Supabase Storage
                with open(output_path, "rb") as file:
                    file_content = file.read()
                    
                upload_url = f"{supabase_config.supabase_url}/storage/v1/object/{request.storage_bucket}/{file_path}"
                
                headers = {
                    "Authorization": f"Bearer {supabase_config.supabase_key}",
                    "apikey": supabase_config.supabase_key,
                    "Content-Type": "audio/mpeg"
                }
                
                upload_response = requests.post(
                    upload_url,
                    headers=headers,
                    data=file_content
                )
                
                if upload_response.status_code >= 400:
                    print(f"Supabase upload error: {upload_response.status_code} - {upload_response.text}")
                    raise Exception(f"Failed to upload to Supabase: {upload_response.text}")
                
                # Get the public URL
                processed_audio_url = f"{supabase_config.supabase_url}/storage/v1/object/public/{request.storage_bucket}/{file_path}"
                print(f"Uploaded successfully. Public URL: {processed_audio_url}")
            except Exception as upload_error:
                print(f"Error uploading to Supabase: {str(upload_error)}")
                # Continue execution even if upload fails, we'll return the processed file data
        
        # Clean up temp files
        shutil.rmtree(temp_dir)
        
        response_data = {
            "success": True,
            "message": "Audio successfully mixed with background music"
        }
        
        if processed_audio_url:
            response_data["processed_audio_url"] = processed_audio_url
        
        return response_data
        
    except Exception as e:
        print(f"Error in mix_audio: {str(e)}")
        return {"success": False, "error": str(e)}

def download_file(url, destination):
    """Helper function to download files"""
    response = requests.get(url, stream=True)
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail=f"Failed to download file from {url}")
    
    with open(destination, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
