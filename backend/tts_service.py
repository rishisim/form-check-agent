import os
import requests
import base64
from typing import Optional

class TTSService:
    def __init__(self):
        self.api_key = os.environ.get("ELEVENLABS_API_KEY")
        # Rachel voice ID (default reliable US female voice)
        self.voice_id = "21m00Tcm4TlvDq8ikWAM" 
        self.model_id = "eleven_turbo_v2" # optimized for latency

    def generate_audio(self, text: str) -> Optional[bytes]:
        """
        Generates audio from text using ElevenLabs API.
        Returns raw audio bytes.
        """
        if not self.api_key:
            print("Warning: ELEVENLABS_API_KEY not set")
            return None
            
        print(f"Generating TTS for: '{text}'")
        
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}"
        
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": self.api_key
        }
        
        data = {
            "text": text,
            "model_id": self.model_id,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.5
            }
        }
        
        try:
            response = requests.post(url, json=data, headers=headers, timeout=5)
            if response.status_code == 200:
                print(f"TTS generated successfully ({len(response.content)} bytes)")
                return response.content
            else:
                print(f"ElevenLabs API Error: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"Error generating TTS: {e}")
            return None
