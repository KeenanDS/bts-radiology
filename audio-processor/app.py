from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
import uvicorn
from pydub import AudioSegment
import os
import requests
import tempfile
import shutil
from fastapi.middleware.cors import CORSMiddleware

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
    audio_url: str,
    background_music_url: str = "https://example.com/default-background.mp3",  # Default music URL
    intro_duration: int = 10000,  # 10 seconds in milliseconds
    outro_duration: int = 10000,  # 10 seconds in milliseconds
    background_volume: float = -10  # Reduce background volume by 10dB
):
    """
    Mix podcast audio with background music
    - Adds intro music with fade out
    - Keeps middle section as voice only
    - Adds outro music with fade in
    """
    try:
        # Create temp directory
        temp_dir = tempfile.mkdtemp()
        
        # Download the podcast audio
        podcast_path = os.path.join(temp_dir, "podcast.mp3")
        download_file(audio_url, podcast_path)
        
        # Download background music
        music_path = os.path.join(temp_dir, "background.mp3")
        download_file(background_music_url, music_path)
        
        # Load audio files
        podcast = AudioSegment.from_mp3(podcast_path)
        background = AudioSegment.from_mp3(music_path)
        
        # Adjust background volume
        background = background + background_volume  # Reduce volume
        
        # Calculate durations
        podcast_duration = len(podcast)
        
        # Make sure background is long enough (loop if needed)
        while len(background) < podcast_duration + intro_duration:
            background = background + background  # Double it
            
        # Get intro segment with fade out
        intro = background[:intro_duration]
        intro = intro.fade_out(intro_duration)
        
        # Get outro segment with fade in
        outro_start = podcast_duration - outro_duration
        outro = background[intro_duration:intro_duration + outro_duration]
        outro = outro.fade_in(outro_duration)
        
        # Overlay intro at the beginning
        result = podcast.overlay(intro, position=0)
        
        # Overlay outro at the end
        result = result.overlay(outro, position=outro_start)
        
        # Export the mixed audio
        output_path = os.path.join(temp_dir, "mixed_podcast.mp3")
        result.export(output_path, format="mp3")
        
        # Now the file is ready at output_path
        # In a real-world scenario, you'd either:
        # 1. Upload to cloud storage and return the URL, or
        # 2. Return the file directly in the response
        
        # For this example, we'll just return a success message
        # In reality, you'd implement file uploading to Supabase storage here
        
        # Clean up temp files
        shutil.rmtree(temp_dir)
        
        return {
            "success": True,
            "message": "Audio successfully mixed with background music"
            # In actual implementation, return URL to the processed file
        }
        
    except Exception as e:
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