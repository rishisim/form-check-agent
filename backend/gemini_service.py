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
            # mp4v works reliably on Windows; avc1 can cause "no usable data" with some codecs
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
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
            # Use gemini-2.5-flash - has reliable video support (gemini-3-flash-preview has "no usable data" issues)
            model_name = "gemini-2.5-flash"
            
            exercise_prompts = {
                "squat": """
            The user is performing SQUATS. Focus ONLY on: knee bend depth, hip position, back angle, chest.
            NEVER mention pushups, elbows, or arms.
            """,
                "pushup": """
            The user is performing PUSH-UPS. Focus ONLY on: elbow bend angle, arm position, chest lowering, body line.
            NEVER mention squats, knees, or legs.
            """,
            }
            exercise_guidance = exercise_prompts.get(exercise_name, f"Focus on {exercise_name} form.")
            
            prompt = f"""
            You are an elite gym coach. {exercise_guidance}
            
            Analyze the video clip. Identify form issues. Give ONE concise coaching cue (max 12 words).
            If form is perfect, say "Perfect form! Great work!".
            Be specific and encouraging. Reference elbows/arms for pushups; knees/hips for squats.
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
            if os.path.exists(temp_video_path):
                os.remove(temp_video_path)
            
            self.is_analyzing = False
            
            try:
                text = response.text
                if text and text.strip():
                    return text.strip()
            except (AttributeError, IndexError, KeyError):
                pass
            return "Couldn't analyze video. Try again with clearer footage and good lighting."

        except Exception as e:
            self.is_analyzing = False
            import traceback
            traceback.print_exc()
            err_msg = str(e).lower()
            if "no usable data" in err_msg or "invalid" in err_msg or "blocked" in err_msg:
                return "Video couldn't be analyzed. Try better lighting and ensure you're fully in frame."
            print(f"Error during Gemini analysis: {e}")
            return f"Error: {str(e)}"
