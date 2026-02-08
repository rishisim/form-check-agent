import os
import cv2
import time
import tempfile
import base64
from collections import deque
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()


class GeminiService:
    def __init__(self, api_key=None, buffer_seconds=2, fps=30):
        if not api_key:
            api_key = os.environ.get("GEMINI_API_KEY")
        
        if not api_key:
            print("Warning: GEMINI_API_KEY not found in environment variables.")
            self.client = None
        else:
            self.client = genai.Client(api_key=api_key)
        
        self.buffer_size = buffer_seconds * fps
        self.frame_buffer = deque(maxlen=self.buffer_size)
        self.fps = fps
        self.is_analyzing = False

    def add_frame(self, frame):
        """Adds a frame to the circular buffer."""
        self.frame_buffer.append(frame)

    def analyze_current_buffer(self, exercise_name="squat"):
        """
        Saves the buffered frames to a temporary video file and sends it to Gemini.
        Returns the text response.
        """
        if not self.client:
            return "Error: Gemini API key not configured."
        
        if self.is_analyzing:
            return "Analysis already in progress..."
        
        if len(self.frame_buffer) < 30:  # Minimum 1 second
            return "Not enough data for analysis."

        self.is_analyzing = True
        print(f"Starting analysis for {exercise_name}...")
        
        try:
            # 1. Save frames to temp video
            with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_video:
                temp_video_path = temp_video.name
            
            height, width, layers = self.frame_buffer[0].shape
            # usage of avc1 (H.264) is generally more compatible
            fourcc = cv2.VideoWriter_fourcc(*'avc1')
            out = cv2.VideoWriter(temp_video_path, fourcc, self.fps, (width, height))

            for frame in self.frame_buffer:
                out.write(frame)
            out.release()
            
            print(f"Video saved to {temp_video_path}")

            # 2. Upload using File API
            print("Uploading to Gemini...")
            with open(temp_video_path, 'rb') as f:
                video_bytes = f.read()
            
            video_file = self.client.files.upload(
                file=temp_video_path,
                config=types.UploadFileConfig(mime_type="video/mp4")
            )
            
            # Wait for processing
            while video_file.state.name == "PROCESSING":
                print('.', end='', flush=True)
                time.sleep(1)
                video_file = self.client.files.get(name=video_file.name)

            if video_file.state.name == "FAILED":
                raise ValueError(f"Video processing failed: {video_file.state.name}")
            
            print(f"\nVideo uploaded. Name: {video_file.name}")

            # 3. Generate Content
            # Using stable Gemini 1.5 Flash
            model_name = "gemini-1.5-flash"
            
            prompt = f"""
            You are a supportive, professional physical therapist coaching a client.
            The user is performing a {exercise_name}.
            
            Analyze the video clip carefully:
            1. Observe the user's body positioning and movement
            2. Identify any form issues (depth, alignment, stability)
            3. Focus on safety and effectiveness
            
            Give a calm, encouraging coaching cue (max 10 words).
            Use inclusive language like "let's" or "try to" — never blunt commands.
            If form is perfect, say "Looking great, keep it up!".
            
            Be warm, brief, and specific.
            """
            
            print(f"Requesting analysis from {model_name}...")
            
            # Using generate_content directly with file API
            response = self.client.models.generate_content(
                model=model_name,
                contents=[
                    types.Content(
                        parts=[
                            types.Part.from_uri(file_uri=video_file.uri, mime_type="video/mp4"),
                            types.Part.from_text(text=prompt)
                        ]
                    )
                ]
            )
            
            # Cleanup
            os.remove(temp_video_path)
            # Consider deleting the file from Gemini storage too if needed
            # self.client.files.delete(name=video_file.name)
            
            self.is_analyzing = False
            if response.text:
                return response.text
            else:
                return "No feedback generated."

        except Exception as e:
            self.is_analyzing = False
            import traceback
            traceback.print_exc()
            print(f"Error during Gemini analysis: {e}")
            return f"Error: {str(e)}"
