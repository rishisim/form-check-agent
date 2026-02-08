import os
import cv2
import logging
import tempfile
import traceback
from collections import deque
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

logger = logging.getLogger(__name__)


class GeminiService:
    def __init__(self, api_key=None, buffer_seconds=2, fps=30):
        if not api_key:
            api_key = os.environ.get("GEMINI_API_KEY")
        
        if not api_key:
            logger.warning("GEMINI_API_KEY not found in environment variables.")
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
        logger.info(f"Starting analysis for {exercise_name}...")
        
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
            
            logger.info(f"Video saved to {temp_video_path}")

            # 2. Upload using File API
            logger.info("Uploading to Gemini...")
            video_file = self.client.files.upload(
                file=temp_video_path,
                config=types.UploadFileConfig(mime_type="video/mp4")
            )
            
            # Wait for processing
            while video_file.state.name == "PROCESSING":
                logger.debug("Video still processing...")
                import time
                time.sleep(1)
                video_file = self.client.files.get(name=video_file.name)

            if video_file.state.name == "FAILED":
                raise ValueError(f"Video processing failed: {video_file.state.name}")
            
            logger.info(f"Video uploaded. Name: {video_file.name}")

            # 3. Generate Content
            # Using stable Gemini 1.5 Flash
            model_name = "gemini-3-flash-preview"
            
            prompt = f"""
            You are an elite gym coach with computer vision expertise. 
            The user is performing a {exercise_name}.
            
            Analyze the video clip carefully:
            1. Observe the user's body positioning and movement
            2. Identify any form issues (depth, alignment, stability)
            3. Focus on safety and effectiveness
            
            Give a concise, actionable coaching cue (max 10 words) to fix their form instantly.
            If form is perfect, say "Perfect form! Great work!".
            
            Be specific and encouraging.
            """
            
            logger.info(f"Requesting analysis from {model_name}...")
            
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
            
            self.is_analyzing = False
            if response.text:
                return response.text
            else:
                return "No feedback generated."

        except Exception as e:
            self.is_analyzing = False
            logger.error(f"Error during Gemini analysis: {e}")
            logger.debug(traceback.format_exc())
            return f"Error: {str(e)}"
