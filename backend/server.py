import logging
import sys
import os
import cv2
import numpy as np
import base64
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from pose_tracker import PoseTracker
from exercises.squat import SquatAnalyzer
from gemini_service import GeminiService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(os.path.dirname(__file__), "server_log.txt"), mode='a')
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Form Check Agent API")

# Allow CORS for Expo app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
tracker = PoseTracker()
squat_analyzer = SquatAnalyzer()
gemini_service = GeminiService()

@app.get("/")
async def root():
    return {"message": "Form Check Agent API is running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.websocket("/ws/video")
async def websocket_video_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time video streaming.
    Receives base64 encoded frames from the Expo app.
    Returns pose analysis and AI feedback.
    """
    await websocket.accept()
    logger.info("WebSocket connection established")
    
    try:
        while True:
            # Receive base64 encoded frame from client
            try:
                data = await websocket.receive_json()
            except Exception as e:
                if "disconnect" in str(e).lower():
                    logger.info("WebSocket disconnect message received in loop")
                    break
                logger.error(f"Error receiving/parsing JSON: {e}")
                continue
            
            if data.get("type") == "frame":
                # Decode base64 image
                frame_base64 = data.get("frame")
                if not frame_base64:
                    continue
                
                try:
                    # Decode base64 to numpy array
                    img_bytes = base64.b64decode(frame_base64)
                    nparr = np.frombuffer(img_bytes, np.uint8)
                    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                except Exception as e:
                    logger.error(f"Error decoding image: {e}")
                    continue
                
                if frame is None:
                    await websocket.send_json({"error": "Failed to decode frame"})
                    continue
                
                # Add frame to Gemini buffer
                gemini_service.add_frame(frame)
                
                # Process with MediaPipe
                processed_frame = tracker.find_pose(frame, draw=False)
                lm_list = tracker.get_position(processed_frame, draw=False)
                
                # Analyze squat form
                feedback = None
                if len(lm_list) != 0:
                    # Get angles and feedback from squat analyzer
                    analysis = squat_analyzer.get_analysis(lm_list)
                    feedback = {
                        "landmarks": lm_list,
                        "analysis": analysis
                    }
                
                await websocket.send_json({
                    "type": "analysis",
                    "feedback": feedback,
                    "buffered_frames": len(gemini_service.frame_buffer)
                })
            
            elif data.get("type") == "reset_reps":
                logger.info("Resetting rep counter")
                squat_analyzer.reset()
                await websocket.send_json({
                    "type": "reset_confirmation",
                    "status": "success"
                })
                
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        try:
            await websocket.close()
        except:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
