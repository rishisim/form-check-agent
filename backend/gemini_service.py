import os
import cv2
import google.generativeai as genai
import time
import tempfile
from collections import deque
from dotenv import load_dotenv

load_dotenv()


class GeminiService:
    def __init__(self, api_key=None, buffer_seconds=2, fps=30):
        if not api_key:
            api_key = os.environ.get("GEMINI_API_KEY")
        
        if not api_key:
            print("Warning: GEMINI_API_KEY not found in environment variables.")
        
        genai.configure(api_key=api_key)
        
        # Use Gemini 1.5 Flash as requested (optimized for speed/video)
        # Note: Model name might be 'gemini-1.5-flash-latest' or similar. 
        # Using 'gemini-1.5-flash' as a safe bet for now.
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        
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
        if self.is_analyzing:
            return "Analysis already in progress..."
        
        if len(self.frame_buffer) < 30: # Minimum 1 second
            return "Not enough data for analysis."

        self.is_analyzing = True
        print(f"Starting analysis for {exercise_name}...")
        
        try:
            # 1. Save frames to temp video
            with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_video:
                temp_video_path = temp_video.name
            
            height, width, layers = self.frame_buffer[0].shape
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(temp_video_path, fourcc, self.fps, (width, height))

            for frame in self.frame_buffer:
                out.write(frame)
            out.release()
            
            print(f"Video saved to {temp_video_path}")

            # 2. Upload using File API
            print("Uploading to Gemini...")
            video_file = genai.upload_file(temp_video_path)
            
            # Wait for processing? Usually fast for small clips.
            while video_file.state.name == "PROCESSING":
                print('.', end='', flush=True)
                time.sleep(1)
                video_file = genai.get_file(video_file.name)

            if video_file.state.name == "FAILED":
                raise ValueError(f"Video processing failed: {video_file.state.name}")
            
            print(f"\nVideo uploaded. URI: {video_file.uri}")

            # 3. Generate Content
            prompt = f"""
            You are an elite gym coach. The user is performing a {exercise_name}.
            Analyze the video clip. Focus on form, stability, and safety.
            
            Give a concise, actionable 5-word cue to fix their form instantly. 
            If form is perfect, say "Perfect form!".
            """
            
            print("Requesting analysis from Gemini...")
            response = self.model.generate_content([video_file, prompt])
            
            # Cleanup
            os.remove(temp_video_path)
            # Consider deleting the file from Gemini storage too if needed
            # genai.delete_file(video_file.name)
            
            self.is_analyzing = False
            return response.text

        except Exception as e:
            self.is_analyzing = False
            print(f"Error during Gemini analysis: {e}")
            return f"Error: {e}"
