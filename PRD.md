# Product Requirements Document (PRD)

<div align="center">

| 🏠 **[Home / README](README.md)** | 📄 **[Product Specs (PRD)](PRD.md)** |
| :---: | :---: |

</div>
<br />

**Project Name:** Form Check Agent  
**Version:** 1.1  
**Status:** In Development  
**Last Updated:** 2026-02-07  

---

## 1. Executive Summary

Form Check Agent is an AI-powered fitness application designed to provide real-time biomechanical feedback during workouts. By leveraging computer vision and Large Language Models (LLMs), the app analyzes user movements through a smartphone camera, identifying form errors and offering corrective guidance instantly. The goal is to democratize access to personal coaching, ensuring safety and maximizing workout efficacy for users training alone.

## 2. Problem Statement

- **Safety Concerns:** Exercising with poor form is a leading cause of injury, particularly in compound movements like squats and deadlifts.
- **Lack of Feedback:** Solo trainees lack immediate visual or verbal correction, often reinforcing bad habits.
- **Cost of Coaching:** Personal trainers are expensive, making professional form correction inaccessible to many.

## 3. Product Vision & Goals

**Vision:** To become the standard for automated, intelligent personal training, bridging the gap between professional coaching and solo workouts.

**Primary Goals:**
1.  **Safety:** Prevent injury by detecting dangerous form deviations (e.g., knee valgus, rounded back).
2.  **Accuracy:** Deliver precise skeletal tracking and biomechanical analysis comparable to human observation.
3.  **Real-Time Responsiveness:** Provide feedback with minimal latency to allow in-rep corrections.
4.  **Accessibility:** Run effectively on standard consumer hardware (smartphone + laptop/cloud backend).

## 4. User Personas

1.  **The Beginner Lifter (Alex)**
    - *Needs:* Basic safety cues, confidence building, and simple instructions ("keep your chest up").
    - *Pain Point:* Intimidated by complex movements; unsure if they are "doing it right."

2.  **The Intermediate Athlete (Sam)**
    - *Needs:* Performance optimization, depth checks, and consistency tracking.
    - *Pain Point:* Hitting plateaus due to minor form breakdown at high loads.

3.  **The Remote Coach (Jordan)**
    - *Needs:* Tools to assign homework and auto-verify client form during remote sessions.
    - *Pain Point:* Can't be with every client 24/7; relies on asynchronous video reviews.

## 5. Functional Requirements

### 5.1 Mobile Application (Frontend)

#### 5.1.1 Navigation & Screens
- **Home Screen:** Exercise selector with cards for each supported exercise (currently Squats; others show "Coming soon").
- **Workout Configuration Screen:** Lets the user configure:
  - **Sets** (1–20, stepper control)
  - **Reps per Set** (1–30, stepper control)
  - **Countdown Timer** (0–60 seconds in 5-second increments) before analysis begins.
- **Form Check Screen:** Full-screen live camera view with overlays (see below).
- **Routing:** Expo Router headerless stack with deep-link support via query parameters (`sets`, `reps`, `timerSeconds`).

#### 5.1.2 Live Camera Feed
- Captures frames via `expo-camera` (`CameraView`) using the front-facing camera.
- Automatically selects the smallest available picture size for efficient streaming.
- Streams frames at ~7 fps (150 ms interval) as Base64-encoded JPEG (quality 0.1) over WebSocket.

#### 5.1.3 Overlay Components
- **Skeleton Overlay (`SkeletonOverlay`):**
  - Full-screen SVG rendering of 13 MediaPipe pose connections and 12 key joints.
  - 60 fps frame-rate-independent lerp interpolation for smooth animation despite ~7 fps server updates.
  - Hip trajectory polyline showing the path the hips have traveled.
  - Visibility filtering (threshold 0.45) to hide low-confidence joints.
  - X-axis mirroring for front camera.
- **Depth Line (`DepthLine`):**
  - Dashed horizontal target line at knee height (left 30% of screen).
  - Moving circle indicator at current hip height.
  - Color change: grey when above target, green (#88B04B) when at/below target depth.
- **Feedback Toast (`FeedbackToast`):**
  - Floating pill near the bottom of the screen.
  - Three color-coded severity levels:
    - **Success:** Light blue (#DDEBF7 / #41719C)
    - **Warning:** Light yellow (#FFF2CC / #BF8F00)
    - **Error:** Light peach (#FCE4D6 / #C65911)
- **Rep Counter (`RepCounter`):**
  - Two-column card: valid reps (green) and invalid reps (orange).
  - Supports a "transparent" mode for inline embedding in the HUD bar.

#### 5.1.4 HUD Metrics Bar
- Displayed during active analysis with:
  - **Connection status** dot (green/orange) + detected side indicator (← / →).
  - **Knee angle** (degrees).
  - **Back (hip) angle** (degrees).
  - **Inline rep counter** (tappable to reset reps).

#### 5.1.5 Workout Flow Management
- **Countdown Timer:** Configurable delay before analysis begins, displaying a large countdown on screen.
- **Set Tracking:** Automatic set-complete detection when valid reps reach the target.
  - 3-second transition overlay between sets with automatic rep counter reset.
  - Server-side analyzer state is also reset via a `reset_reps` WebSocket message.
- **Workout Completion:** Full-screen overlay with trophy emoji, summary stats, and "Back to Home" button.
- **Progress Bar:** Visual pill showing `Set X/Y · Rep X/Y` with a linear progress fill.

#### 5.1.6 Connectivity
- WebSocket client with:
  - Exponential backoff reconnection (1s → 2s → 4s → max 10s).
  - Keepalive ping/pong protocol (server sends ping every 25s).
  - Session ID tracking and frame sequence numbers to discard stale data.
  - Intentional disconnect handling on screen exit.

### 5.2 Backend Processing

#### 5.2.1 Server Architecture
- **Framework:** FastAPI with a single WebSocket endpoint (`/ws/video`).
- **Per-Connection Isolation:** Each WebSocket connection gets its own `PoseTracker` and `SquatAnalyzer` instances (no shared mutable state).
- **Health Endpoint:** `GET /health` returns active connection count.
- **Logging:** Dual output to stdout and `server_log.txt`.

#### 5.2.2 Pose Estimation (`PoseTracker`)
- MediaPipe Pose (lite model, `model_complexity=0`) for fast inference.
- Tracks 33 3D body landmarks with configurable detection/tracking confidence (default 0.5).
- Returns landmark list as `[id, x, y, visibility]` tuples normalized by frame dimensions.

#### 5.2.3 Squat Analyzer (`SquatAnalyzer`)
- **4-Stage State Machine:**
  1. **Up** → knee angle above 155° (standing).
  2. **Descending** → knee angle drops below 145° (lockout threshold with hysteresis).
  3. **Bottom** → knee angle sustained below 100° for ≥ 2 consecutive frames.
  4. **Ascending** → knee angle rises above 115° from bottom, transitioning back to Up at 145°+.
- **Angle Computation:**
  - Knee angle: hip → knee → ankle.
  - Hip (back) angle: shoulder → hip → knee.
  - Exponential Moving Average smoothing (α = 0.4) for stable readings.
- **Automatic Side Detection:** Picks the side (left/right) with higher average landmark visibility.
- **Per-Rep Form Validation:**
  - Tracks form issues (e.g., "Keep chest up!" when back angle < 42°) across the entire rep cycle.
  - Checks depth: hips must reach or pass knee height.
  - A rep is **valid** only if it had good depth AND zero accumulated form issues.
- **Rep Gating:** Minimum 0.8-second interval between reps; visibility must be above 0.45.
- **Output per frame:**
  - `knee_angle`, `hip_angle`, `stage`, `rep_count`, `valid_reps`, `invalid_reps`
  - `feedback` (string), `feedback_level` (success/warning/error)
  - `target_depth_y`, `current_depth_y` (normalized)
  - `hip_trajectory` (normalized coordinate history, max 30 frames)
  - `side_detected` (left/right)

#### 5.2.4 AI Integration (`GeminiService`)
- Buffers incoming frames in a circular buffer (default 2s × 30fps = 60 frames).
- On-demand analysis: encodes buffer to a temporary H.264 MP4 video file.
- Uploads to Gemini via the File API and requests form analysis using **Gemini 1.5 Flash**.
- Generates contextual coaching feedback (e.g., "Your depth improved on the last 3 reps, but watch your knees").
- Guard-railed: won't run concurrently; requires a minimum of 30 frames.

#### 5.2.5 Angle Calculation (`geometry.py`)
- Utility function `calculate_angle(a, b, c)` computing the angle at vertex **b** using `numpy` and `arctan2`, returning 0–180°.

### 5.3 System Performance
- **Frame Streaming:** ~7 fps (150 ms capture interval) with JPEG quality 0.1 for low bandwidth.
- **Skeleton Rendering:** 60 fps interpolated client-side for smooth visual feedback.
- **Throttled UI Updates:** Analysis state updates throttled to ~15 fps (66 ms) to reduce React re-renders while landmarks update at full rate for smooth skeleton.
- **WebSocket Keepalive:** 25-second server pings prevent idle timeouts.

## 6. Technical Architecture

### 6.1 Technology Stack
| Layer | Technology |
|---|---|
| **Frontend** | React Native (Expo) · TypeScript · Expo Router · `react-native-svg` |
| **Backend** | Python · FastAPI · WebSockets · Uvicorn |
| **Computer Vision** | OpenCV · MediaPipe Pose (lite model) |
| **AI / LLM** | Google Gemini 1.5 Flash (via `google-genai` SDK) |
| **Communication** | WebSocket (JSON payloads with Base64-encoded JPEG frames) |

### 6.2 Data Flow
1.  **Capture:** Mobile app captures a JPEG frame at ~7 fps.
2.  **Encode:** Frame is compressed (quality 0.1) and Base64-encoded.
3.  **Transmit:** App sends `{ type: "frame", frame: "<base64>" }` over WebSocket.
4.  **Process (Backend):**
    a. Decode Base64 → OpenCV image.
    b. MediaPipe extracts 33 landmarks.
    c. `SquatAnalyzer` computes angles, runs state machine, classifies rep.
    d. Frame is added to Gemini circular buffer.
5.  **Response:** Backend sends `{ type: "analysis", feedback: { landmarks, analysis, session_id, frame_seq } }`.
6.  **Render (Frontend):**
    a. Landmarks update instantly → `SkeletonOverlay` interpolates smoothly at 60 fps.
    b. Analysis data updates throttled to ~15 fps → HUD, rep counter, depth line, feedback toast.

### 6.3 WebSocket Protocol
| Message | Direction | Payload |
|---|---|---|
| `frame` | Client → Server | `{ type, frame (base64) }` |
| `analysis` | Server → Client | `{ type, feedback: { landmarks, analysis, session_id, frame_seq } }` |
| `reset_reps` | Client → Server | `{ type }` |
| `reset_confirmation` | Server → Client | `{ type, status, new_session_id, frame_seq }` |
| `ping` | Server → Client | `{ type }` |
| `pong` | Client → Server | `{ type }` |

## 7. UX / User Flows

### 7.1 The Workout Flow
1.  **Launch:** User opens app → Home screen with exercise cards.
2.  **Select Exercise:** User taps **Squats** → navigates to Workout Config screen.
3.  **Configure:** User adjusts sets, reps per set, and countdown timer via stepper controls.
4.  **Start:** User taps **Start Workout** → navigates to Form Check screen.
5.  **Camera Permission:** If not yet granted, a dedicated permission screen is shown.
6.  **Countdown:** Large countdown number displayed over camera feed (e.g., "10… 9… 8…") with workout summary ("3 × 10 Squats"). WebSocket connects during this phase but frame streaming waits.
7.  **Exercise:**
    - Real-time skeleton overlay tracks the user's body.
    - Depth line guides the user to proper squat depth.
    - HUD bar shows knee angle, back angle, side detected, and rep counts.
    - Feedback toast displays coaching cues ("Squat deeper", "Good depth! Drive up!", "Keep chest up!").
    - Reps auto-count; each is classified as valid or invalid.
8.  **Set Complete:** When valid reps reach the target:
    - "✅ Set X Complete!" overlay appears for 3 seconds.
    - Rep counter resets (client + server) and next set begins.
9.  **Workout Complete:** After the final set:
    - Full-screen "🏆 Workout Complete!" overlay with summary stats.
    - "Back to Home" button returns to the Home screen.

## 8. Non-Functional Requirements

- **Privacy:** Video frames are processed in memory and not stored permanently.
- **Device Battery:** Low-resolution captures (smallest picture size, quality 0.1) and throttled streaming (~7 fps) to minimize battery drain.
- **Reliability:** Graceful handling of lost connections (exponential backoff), lost subjects (visibility thresholds), and stale data (session IDs + frame sequence numbers).
- **Isolation:** Each WebSocket connection is fully isolated with its own pose tracker and analyzer — no cross-user state contamination.

## 9. Roadmap

### Phase 1: MVP ✅
- [x] Real-time squat analysis with 4-stage state machine.
- [x] Smooth skeleton overlay (60 fps interpolated) with hip trajectory.
- [x] Depth line guide (target vs. current hip position).
- [x] Rep counting with valid/invalid classification.
- [x] Per-rep form validation (depth + back angle checks).
- [x] Workout configuration (sets, reps, countdown timer).
- [x] Set tracking with automatic transitions and reset.
- [x] Workout completion screen.
- [x] Live HUD metrics (knee angle, back angle, side detection).
- [x] Color-coded feedback toast (success / warning / error).
- [x] Robust WebSocket connection (reconnection, keepalive, session management).
- [x] Local network streaming from mobile to backend.

### Phase 2: Enhanced Intelligence
- [ ] Voice feedback (using ElevenLabs or native TTS).
- [ ] Gemini-powered post-set AI coaching summaries.
- [ ] "Good/Bad" rep classification history and per-session analytics.
- [ ] Workout history storage (local).

### Phase 3: Expansion
- [ ] Multi-exercise support (Deadlift, Overhead Press, Lunge, Push-ups).
- [ ] User accounts and cloud history storage.
- [ ] Social sharing of "Perfect Form" clips.
- [ ] Offline mode (on-device MediaPipe models for zero-latency).
- [ ] Remote coaching mode (share session with a trainer).
