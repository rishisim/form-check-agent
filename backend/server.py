import cv2
import numpy as np
import base64
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from pose_tracker import PoseTracker
from exercises.squat import SquatAnalyzer
from gemini_service import GeminiService

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
    print("WebSocket connection established")
    
    try:
        while True:
            # Receive base64 encoded frame from client
            data = await websocket.receive_json()
            
            if data.get("type") == "frame":
                # Decode base64 image
                frame_base64 = data.get("frame")
                if not frame_base64:
                    continue
                
                # Decode base64 to numpy array
                img_bytes = base64.b64decode(frame_base64)
                nparr = np.frombuffer(img_bytes, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
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
            
            elif data.get("type") == "request_ai_feedback":
                # Trigger Gemini analysis
                exercise = data.get("exercise", "squat")
                print(f"AI feedback requested for {exercise}")
                
                # Run in background to not block
                response = gemini_service.analyze_current_buffer(exercise)
                
                await websocket.send_json({
                    "type": "ai_feedback",
                    "response": response
                })
                
    except WebSocketDisconnect:
        print("WebSocket disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
