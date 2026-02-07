import logging
import sys
import os
import cv2
import numpy as np
import base64
import asyncio
import uuid
import traceback
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocketState

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

# Track active connections for diagnostics
active_connections: set[str] = set()


@app.get("/")
async def root():
    return {"message": "Form Check Agent API is running"}

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "active_connections": len(active_connections),
    }


async def _safe_send(websocket: WebSocket, data: dict) -> bool:
    """Send JSON, return False if the socket is already gone."""
    try:
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.send_json(data)
            return True
    except Exception:
        pass
    return False


@app.websocket("/ws/video")
async def websocket_video_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time video streaming.
    Receives base64 encoded frames from the Expo app.
    Returns pose analysis and AI feedback.
    """
    await websocket.accept()
    conn_id = str(uuid.uuid4())[:8]
    active_connections.add(conn_id)
    logger.info(f"[{conn_id}] WebSocket connection established ({len(active_connections)} active)")

    # Initialize tracker AND analyzer per session (no shared state)
    session_tracker = PoseTracker()
    session_analyzer = SquatAnalyzer()
    current_session_id = str(uuid.uuid4())
    frame_seq = 0

    # --- Keepalive: send a ping every 25 s so the connection doesn't idle-timeout ---
    async def _keepalive():
        try:
            while True:
                await asyncio.sleep(25)
                if websocket.client_state != WebSocketState.CONNECTED:
                    break
                await websocket.send_json({"type": "ping"})
        except Exception:
            pass  # connection closed – exit silently

    keepalive_task = asyncio.create_task(_keepalive())

    try:
        while True:
            # Receive message from client
            try:
                data = await websocket.receive_json()
            except WebSocketDisconnect:
                logger.info(f"[{conn_id}] Client disconnected normally")
                break
            except Exception as e:
                err_str = str(e).lower()
                # Normal close codes (1000=normal, 1001=going away) are NOT errors
                if "1000" in err_str or "1001" in err_str or "disconnect" in err_str:
                    logger.info(f"[{conn_id}] Client closed connection")
                    break
                # 1006 = abnormal closure (client vanished, network drop)
                if "1006" in err_str or "abnormal" in err_str:
                    logger.warning(f"[{conn_id}] Client connection lost (1006)")
                    break
                # Anything else is unexpected
                logger.error(f"[{conn_id}] Error receiving JSON: {e}")
                continue

            msg_type = data.get("type")

            if msg_type == "pong":
                # Client responded to our keepalive – all good
                continue

            if msg_type == "frame":
                frame_base64 = data.get("frame")
                if not frame_base64:
                    continue

                try:
                    # Decode base64 to numpy array
                    img_bytes = base64.b64decode(frame_base64)
                    nparr = np.frombuffer(img_bytes, np.uint8)
                    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                except Exception as e:
                    logger.error(f"[{conn_id}] Error decoding image: {e}")
                    continue

                if frame is None:
                    await _safe_send(websocket, {"error": "Failed to decode frame"})
                    continue

                # Add frame to Gemini buffer
                try:
                    gemini_service.add_frame(frame)
                except Exception:
                    pass  # non-critical

                # Process with per-session MediaPipe tracker
                try:
                    processed_frame = session_tracker.find_pose(frame, draw=False)
                    lm_list = session_tracker.get_position(processed_frame, draw=False)
                except Exception as e:
                    logger.error(f"[{conn_id}] Pose tracking error: {e}")
                    lm_list = []

                # Increment frame sequence
                frame_seq += 1

                # Analyze squat form
                feedback = None
                if len(lm_list) != 0:
                    try:
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
                            "frame_seq": frame_seq,
                        }
                    except Exception as e:
                        logger.error(f"[{conn_id}] Analysis error: {e}")

                if not await _safe_send(websocket, {
                    "type": "analysis",
                    "feedback": feedback,
                    "buffered_frames": len(gemini_service.frame_buffer),
                }):
                    break  # socket gone

            elif msg_type == "reset_reps":
                logger.info(f"[{conn_id}] Resetting rep counter")
                session_analyzer.reset()
                current_session_id = str(uuid.uuid4())
                frame_seq = 0
                if not await _safe_send(websocket, {
                    "type": "reset_confirmation",
                    "status": "success",
                    "new_session_id": current_session_id,
                    "frame_seq": 0,
                }):
                    break

    except WebSocketDisconnect:
        logger.info(f"[{conn_id}] WebSocket disconnected")
    except Exception as e:
        logger.error(f"[{conn_id}] Unexpected error: {e}")
        logger.debug(traceback.format_exc())
    finally:
        keepalive_task.cancel()
        active_connections.discard(conn_id)
        logger.info(f"[{conn_id}] Connection cleaned up ({len(active_connections)} active)")
        try:
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.close()
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
