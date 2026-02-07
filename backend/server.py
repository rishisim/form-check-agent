import logging
import sys
import os
import cv2
import numpy as np
import base64
import asyncio
import uuid
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

# Initialize services (Gemini is stateless/buffered, safe to share)
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
    
    # Initialize tracker AND analyzer per session (no shared state)
    session_tracker = PoseTracker()
    session_analyzer = SquatAnalyzer()
    current_session_id = str(uuid.uuid4())
    frame_seq = 0
    
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
                
                # Process with per-session MediaPipe tracker
                processed_frame = session_tracker.find_pose(frame, draw=False)
                lm_list = session_tracker.get_position(processed_frame, draw=False)
                
                # Increment frame sequence
                frame_seq += 1
                
                # Analyze squat form
                feedback = None
                if len(lm_list) != 0:
                    # Get angles and feedback from squat analyzer
                    analysis = session_analyzer.get_analysis(lm_list)
                    
                    # Normalize data for frontend rendering
                    h, w, _ = frame.shape
                    normalized_landmarks = [[id, x/w, y/h, v] for id, x, y, v in lm_list]
                    
                    if analysis:
                        analysis["target_depth_y"] = analysis["target_depth_y"] / h
                        analysis["current_depth_y"] = analysis["current_depth_y"] / h
                        analysis["hip_trajectory"] = [[x/w, y/h] for x, y in analysis["hip_trajectory"]]

                    feedback = {
                        "landmarks": normalized_landmarks,
                        "analysis": analysis,
                        "session_id": current_session_id,
                        "frame_seq": frame_seq
                    }
                
                await websocket.send_json({
                    "type": "analysis",
                    "feedback": feedback,
                    "buffered_frames": len(gemini_service.frame_buffer)
                })
            
            elif data.get("type") == "reset_reps":
                logger.info("Resetting rep counter")
                session_analyzer.reset()
                # Generate a guaranteed-unique session ID
                current_session_id = str(uuid.uuid4())
                frame_seq = 0
                await websocket.send_json({
                    "type": "reset_confirmation",
                    "status": "success",
                    "new_session_id": current_session_id,
                    "frame_seq": 0
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
