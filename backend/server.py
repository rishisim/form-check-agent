import logging
import sys
import os
import cv2
import numpy as np
import base64
import asyncio
import uuid
import traceback
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocketState

from pose_tracker import PoseTracker
from exercises.squat import SquatAnalyzer
from exercises.pushup import PushupAnalyzer
from gemini_service import GeminiService
from tts_service import TTSService

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
tts_service = TTSService()

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
        "tts_available": tts_service.is_available,
    }


@app.get("/tts")
async def text_to_speech(text: str = Query(..., description="Text to convert to speech")):
    """Convert feedback text to speech using Eleven Labs."""
    if not text.strip():
        return Response(status_code=400, content="Text is required")

    audio = await tts_service.synthesize(text)
    if audio is None:
        return Response(status_code=503, content="TTS unavailable")

    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "public, max-age=86400",  # Cache for 24h
        },
    )


async def _safe_send(websocket: WebSocket, data: dict) -> bool:
    """Send JSON, return False if the socket is already gone."""
    try:
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.send_json(data)
            return True
    except Exception:
        pass
    return False


# ---------------------------------------------------------------------------
# Target resolution for MediaPipe processing (width).  Smaller = faster.
# MediaPipe Pose Lite works well down to ~192 px wide.
# ---------------------------------------------------------------------------
MEDIAPIPE_MAX_WIDTH = 240


def _downscale(frame: np.ndarray, max_width: int = MEDIAPIPE_MAX_WIDTH) -> tuple[np.ndarray, float]:
    """Downscale *frame* so its width ≤ max_width.  Returns (resized, scale)."""
    h, w = frame.shape[:2]
    if w <= max_width:
        return frame, 1.0
    scale = max_width / w
    new_w = max_width
    new_h = int(h * scale)
    return cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA), scale


def _process_frame_sync(
    frame: np.ndarray,
    tracker: PoseTracker,
) -> list:
    """Run downscale + pose detection + landmark extraction in ONE thread call.

    Returns the landmark list with coordinates in original-frame space.
    """
    small, scale = _downscale(frame)
    tracker.find_pose(small, draw=False)
    lm_list = tracker.get_position(small, draw=False)
    if scale != 1.0 and lm_list:
        lm_list = [
            [lid, int(x / scale), int(y / scale), v]
            for lid, x, y, v in lm_list
        ]
    return lm_list


@app.websocket("/ws/video")
async def websocket_video_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time video streaming.

    Query params: ?exercise=squat|pushup

    Uses a **latest-frame-wins** pattern: incoming frames are dropped into a
    slot; a background worker always processes only the most recent frame.
    This prevents frame queueing and keeps the skeleton as close to real-time
    as the processing budget allows.
    """
    await websocket.accept()
    conn_id = str(uuid.uuid4())[:8]
    active_connections.add(conn_id)
    ex = (websocket.query_params.get("exercise") or "squat").lower().strip()
    logger.info(f"[{conn_id}] WebSocket connection established ({len(active_connections)} active, exercise={ex})")

    # Per-session state
    session_tracker = PoseTracker()
    session_analyzer = PushupAnalyzer() if ex == "pushup" else SquatAnalyzer()
    current_session_id = str(uuid.uuid4())
    frame_seq = 0

    # Latest-frame slot – written by the reader, consumed by the processor
    latest_frame: dict = {"frame": None, "seq": 0}
    frame_event = asyncio.Event()
    connection_alive = True

    # --- Keepalive: send a ping every 25 s so the connection doesn't idle-timeout ---
    async def _keepalive():
        try:
            while connection_alive:
                await asyncio.sleep(25)
                if websocket.client_state != WebSocketState.CONNECTED:
                    break
                await websocket.send_json({"type": "ping"})
        except Exception:
            pass

    # --- Background worker: processes latest frame and sends result ----------
    async def _process_loop():
        nonlocal frame_seq
        last_processed_seq = 0

        while connection_alive:
            # Wait until a new frame arrives
            await frame_event.wait()
            frame_event.clear()

            if not connection_alive:
                break

            # Grab the latest frame (drop any older ones implicitly)
            slot = latest_frame.copy()
            if slot["frame"] is None or slot["seq"] <= last_processed_seq:
                continue
            last_processed_seq = slot["seq"]

            frame = slot["frame"]
            seq = slot["seq"]

            # Add frame to Gemini buffer (non-critical)
            try:
                gemini_service.add_frame(frame)
            except Exception:
                pass

            # Run downscale + MediaPipe in a SINGLE thread call
            try:
                lm_list = await asyncio.to_thread(
                    _process_frame_sync, frame, session_tracker
                )
            except Exception as e:
                logger.error(f"[{conn_id}] Pose tracking error: {e}")
                lm_list = []

            # Build response
            feedback = None
            if lm_list:
                try:

                    analysis = session_analyzer.get_analysis(lm_list)

                    h, w = frame.shape[:2]
                    normalized_landmarks = [[lid, x / w, y / h, v]
                                           for lid, x, y, v in lm_list]

                    if analysis:
                        analysis["target_depth_y"] = analysis["target_depth_y"] / h
                        analysis["current_depth_y"] = analysis["current_depth_y"] / h
                        analysis["hip_trajectory"] = [
                            [x / w, y / h] for x, y in analysis["hip_trajectory"]
                        ]

                    feedback = {
                        "landmarks": normalized_landmarks,
                        "analysis": analysis,
                        "session_id": current_session_id,
                        "frame_seq": seq,
                        "server_ts": asyncio.get_event_loop().time(),
                    }
                except Exception as e:
                    logger.error(f"[{conn_id}] Analysis error: {e}")

            if not await _safe_send(websocket, {
                "type": "analysis",
                "feedback": feedback,
                "buffered_frames": len(gemini_service.frame_buffer),
            }):
                break  # socket gone

    keepalive_task = asyncio.create_task(_keepalive())
    process_task = asyncio.create_task(_process_loop())

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
                if "1000" in err_str or "1001" in err_str or "disconnect" in err_str:
                    logger.info(f"[{conn_id}] Client closed connection")
                    break
                if "1006" in err_str or "abnormal" in err_str:
                    logger.warning(f"[{conn_id}] Client connection lost (1006)")
                    break
                logger.error(f"[{conn_id}] Error receiving JSON: {e}")
                continue

            msg_type = data.get("type")

            if msg_type == "pong":
                continue

            if msg_type == "frame":
                frame_base64 = data.get("frame")
                if not frame_base64:
                    continue

                try:
                    img_bytes = base64.b64decode(frame_base64)
                    nparr = np.frombuffer(img_bytes, np.uint8)
                    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                except Exception as e:
                    logger.error(f"[{conn_id}] Error decoding image: {e}")
                    continue

                if frame is None:
                    continue

                # Drop into the latest-frame slot (overwrites any unprocessed frame)
                frame_seq += 1
                latest_frame["frame"] = frame
                latest_frame["seq"] = frame_seq
                frame_event.set()  # wake the processor

            elif msg_type == "reset_reps":
                logger.info(f"[{conn_id}] Resetting rep counter")
                session_analyzer.reset()
                current_session_id = str(uuid.uuid4())
                frame_seq = 0
                latest_frame["frame"] = None
                latest_frame["seq"] = 0
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
        connection_alive = False
        frame_event.set()  # unblock processor so it can exit
        keepalive_task.cancel()
        process_task.cancel()
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
