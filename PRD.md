# Product Requirements Document (PRD)

<div align="center">

| 🏠 **[Home / README](README.md)** | 📄 **[Product Specs (PRD)](PRD.md)** |
| :---: | :---: |

</div>
<br />

**Project Name:** Form Check Agent  
**Version:** 2.0  
**Status:** In Development  
**Last Updated:** 2026-02-08  

---

## 1. Executive Summary

Form Check Agent is an AI-powered fitness application designed to provide real-time biomechanical feedback during workouts. By leveraging computer vision and Large Language Models (LLMs), the app analyzes user movements through a smartphone camera, identifying form errors and offering corrective guidance instantly — both visually and through **voice coaching**. The goal is to democratize access to personal coaching, ensuring safety and maximizing workout efficacy for users training alone.

## 2. Problem Statement

- **Safety Concerns:** Exercising with poor form is a leading cause of injury, particularly in compound movements like squats and push-ups.
- **Lack of Feedback:** Solo trainees lack immediate visual or verbal correction, often reinforcing bad habits.
- **Cost of Coaching:** Personal trainers are expensive, making professional form correction inaccessible to many.

## 3. Product Vision & Goals

**Vision:** To become the standard for automated, intelligent personal training, bridging the gap between professional coaching and solo workouts.

**Primary Goals:**
1.  **Safety:** Prevent injury by detecting dangerous form deviations (e.g., knee valgus, rounded back, hip sag).
2.  **Accuracy:** Deliver precise skeletal tracking and biomechanical analysis comparable to human observation.
3.  **Real-Time Responsiveness:** Provide feedback with minimal latency to allow in-rep corrections.
4.  **Multi-Modal Feedback:** Combine visual overlays with voice coaching for comprehensive guidance.
5.  **Accessibility:** Run effectively on standard consumer hardware (smartphone + laptop/cloud backend).

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
- **Home Screen:** Exercise selector with cards for each supported exercise (Squats, Push-ups; others show "Coming soon"). Features particle background animation and workout streak display.
- **Workout Configuration Screen:** Lets the user configure:
  - **Sets** (1–20, stepper control)
  - **Reps per Set** (1–30, stepper control)
  - **Countdown Timer** (0–60 seconds in 5-second increments) before analysis begins.
- **Form Check Screen:** Full-screen live camera view with overlays (see below).
- **Analysis Screen:** Post-workout analysis with AI-powered insights, form scoring, angle assessments, and interactive AI chat.
- **Routing:** Expo Router headerless stack with deep-link support via query parameters (`sets`, `reps`, `timerSeconds`, `exercise`).

#### 5.1.2 Theme System
- **Dark/Light Mode:** Full theming with `ThemeProvider` context.
- **Animated Toggle:** Circle-reveal transition animation when switching themes.
- **Persistence:** Theme preference saved via AsyncStorage.

#### 5.1.3 Live Camera Feed
- Captures frames via `expo-camera` (`CameraView`) using the front-facing camera.
- Automatically selects the smallest available picture size for efficient streaming.
- Streams frames at ~7 fps (150 ms interval) as Base64-encoded JPEG (quality 0.1) over WebSocket.

#### 5.1.4 Overlay Components
- **Skeleton Overlay (`SkeletonOverlay`):**
  - Full-screen SVG rendering of 13 MediaPipe pose connections and 12 key joints.
  - 60 fps frame-rate-independent lerp interpolation for smooth animation despite ~7 fps server updates.
  - Hip/shoulder trajectory polyline showing the movement path.
  - Visibility filtering (threshold 0.45) to hide low-confidence joints.
  - X-axis mirroring for front camera.
- **Depth Line (`DepthLine`):**
  - Dashed horizontal target line at knee/elbow height (left 30% of screen).
  - Moving circle indicator at current hip/chest height.
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

#### 5.1.5 HUD Metrics Bar
- Displayed during active analysis with:
  - **Connection status** dot (green/orange) + detected side indicator (← / →).
  - **Joint angle** (knee for squats, elbow for push-ups) in degrees.
  - **Body angle** (back/hip for squats, body alignment for push-ups) in degrees.
  - **Inline rep counter** (tappable to reset reps).

#### 5.1.6 Voice Coaching (`useTTS` Hook)
- Real-time text-to-speech via ElevenLabs backend endpoint.
- **Rate-limiting:** Minimum 3-second gap between spoken cues.
- **De-duplication:** Won't repeat the same phrase back-to-back.
- **Skip list:** Filters out generic messages (e.g., "Position yourself in frame").
- Uses `expo-audio` AudioPlayer for reliable playback.

#### 5.1.7 Workout Flow Management
- **Countdown Timer:** Configurable delay before analysis begins, displaying a large countdown on screen.
- **Set Tracking:** Automatic set-complete detection when valid reps reach the target.
  - Rest period overlay between sets with "Skip Rest" option.
  - Rep counter resets (client + server) via a `reset_reps` WebSocket message.
- **Workout Completion:** Full-screen overlay with trophy emoji, summary stats, and navigation to Analysis screen.
- **Progress Bar:** Visual pill showing `Set X/Y · Rep X/Y` with a linear progress fill.

#### 5.1.8 Workout Streak Tracking
- Tracks consecutive workout days.
- Persisted via AsyncStorage.
- Displayed on home screen.

#### 5.1.9 Post-Workout Analysis Screen
- **Form Score:** Overall workout quality percentage with letter grade.
- **Angle Analysis:** Min/max/average for key joints with visual range bars.
- **Set Breakdown:** Per-set valid/invalid rep counts.
- **AI Summary:** Gemini-powered coaching insights with structured formatting.
- **AI Chat:** Interactive chat modal for asking follow-up questions about form.

#### 5.1.10 Connectivity
- WebSocket client with:
  - Exponential backoff reconnection (1s → 2s → 4s → max 10s).
  - Keepalive ping/pong protocol (server sends ping every 25s).
  - Session ID tracking and frame sequence numbers to discard stale data.
  - Intentional disconnect handling on screen exit.

### 5.2 Backend Processing

#### 5.2.1 Server Architecture
- **Framework:** FastAPI with a single WebSocket endpoint (`/ws/video`).
- **Per-Connection Isolation:** Each WebSocket connection gets its own `PoseTracker` and exercise analyzer instances (no shared mutable state).
- **Health Endpoint:** `GET /health` returns active connection count.
- **TTS Endpoint:** `GET /tts?text=...` returns MP3 audio for voice coaching.
- **Gemini Endpoint:** `POST /analyze` for post-workout AI analysis.
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
  - Tracks form issues (e.g., "Keep chest up!" when back angle < 45°) across the entire rep cycle.
  - Checks depth: hips must reach or pass knee height.
  - A rep is **valid** only if it had good depth AND zero accumulated form issues.
- **Rep Gating:** Minimum 0.8-second interval between reps; visibility must be above 0.45.
- **Priority-Based Feedback:** Stabilized, debounced feedback with issue prioritization.

#### 5.2.4 Push-up Analyzer (`PushupAnalyzer`)
- **4-Stage State Machine:**
  1. **Up** → elbow angle above 155° (arms extended).
  2. **Descending** → elbow angle drops below 145°.
  3. **Bottom** → elbow angle sustained below 100° for ≥ 2 consecutive frames.
  4. **Ascending** → elbow angle rises above 115° from bottom.
- **Form Checks:**
  - **Body Alignment:** Two-tier sag detection (mild warning / severe error).
  - **Hip Pike:** Detects if hips are too high.
  - **Head Position:** Neck alignment check.
  - **Depth + Lockout:** Full range of motion validation per rep.
- **Shared Infrastructure:** Uses same `AngleSmoother` and `FeedbackStabilizer` as squat analyzer.

#### 5.2.5 AI Integration (`GeminiService`)
- Buffers incoming frames in a circular buffer (default 2s × 30fps = 60 frames).
- On-demand analysis: encodes buffer to a temporary H.264 MP4 video file.
- Uploads to Gemini via the File API and requests form analysis using **Gemini 1.5 Flash**.
- Generates contextual coaching feedback (e.g., "Your depth improved on the last 3 reps, but watch your knees").
- Guard-railed: won't run concurrently; requires a minimum of 30 frames.

#### 5.2.6 Text-to-Speech Service (`TTSService`)
- Uses **ElevenLabs Turbo v2.5** model for low-latency speech.
- **In-Memory Caching:** MD5-keyed cache for repeated phrases.
- **Default Voice:** "Rachel" for clear coaching tone.
- **Async Processing:** Non-blocking synthesis via thread pool.

#### 5.2.7 Angle Calculation (`geometry.py`)
- Utility function `calculate_angle(a, b, c)` computing the angle at vertex **b** using `numpy` and `arctan2`, returning 0–180°.

### 5.3 System Performance
- **Frame Streaming:** ~7 fps (150 ms capture interval) with JPEG quality 0.1 for low bandwidth.
- **Skeleton Rendering:** 60 fps interpolated client-side for smooth visual feedback.
- **Throttled UI Updates:** Analysis state updates throttled to ~15 fps (66 ms) to reduce React re-renders while landmarks update at full rate for smooth skeleton.
- **WebSocket Keepalive:** 25-second server pings prevent idle timeouts.
- **TTS Latency:** Sub-500ms with ElevenLabs Turbo model + caching.

## 6. Technical Architecture

### 6.1 Technology Stack
| Layer | Technology |
|---|---|
| **Frontend** | React Native (Expo) · TypeScript · Expo Router · `react-native-svg` · `expo-audio` |
| **Backend** | Python · FastAPI · WebSockets · Uvicorn |
| **Computer Vision** | OpenCV · MediaPipe Pose (lite model) |
| **AI / LLM** | Google Gemini 1.5 Flash (via `google-genai` SDK) |
| **Voice** | ElevenLabs Text-to-Speech (Turbo v2.5) |
| **Communication** | WebSocket (JSON payloads with Base64-encoded JPEG frames) |

### 6.2 Data Flow
1.  **Capture:** Mobile app captures a JPEG frame at ~7 fps.
2.  **Encode:** Frame is compressed (quality 0.1) and Base64-encoded.
3.  **Transmit:** App sends `{ type: "frame", frame: "<base64>", exercise: "squat|pushup" }` over WebSocket.
4.  **Process (Backend):**
    a. Decode Base64 → OpenCV image.
    b. MediaPipe extracts 33 landmarks.
    c. Exercise analyzer computes angles, runs state machine, classifies rep.
    d. Frame is added to Gemini circular buffer.
5.  **Response:** Backend sends `{ type: "analysis", feedback: { landmarks, analysis, session_id, frame_seq } }`.
6.  **Render (Frontend):**
    a. Landmarks update instantly → `SkeletonOverlay` interpolates smoothly at 60 fps.
    b. Analysis data updates throttled to ~15 fps → HUD, rep counter, depth line, feedback toast.
7.  **Voice (Optional):** Feedback text sent to `/tts` endpoint → audio played via `useTTS` hook.

### 6.3 WebSocket Protocol
| Message | Direction | Payload |
|---|---|---|
| `frame` | Client → Server | `{ type, frame (base64), exercise }` |
| `analysis` | Server → Client | `{ type, feedback: { landmarks, analysis, session_id, frame_seq } }` |
| `reset_reps` | Client → Server | `{ type }` |
| `reset_confirmation` | Server → Client | `{ type, status, new_session_id, frame_seq }` |
| `ping` | Server → Client | `{ type }` |
| `pong` | Client → Server | `{ type }` |

## 7. UX / User Flows

### 7.1 The Workout Flow
1.  **Launch:** User opens app → Home screen with exercise cards and workout streak.
2.  **Select Exercise:** User taps **Squats** or **Push-ups** → navigates to Workout Config screen.
3.  **Configure:** User adjusts sets, reps per set, and countdown timer via stepper controls.
4.  **Start:** User taps **Start Workout** → navigates to Form Check screen.
5.  **Camera Permission:** If not yet granted, a dedicated permission screen is shown.
6.  **Countdown:** Large countdown number displayed over camera feed (e.g., "10… 9… 8…") with workout summary. WebSocket connects during this phase but frame streaming waits.
7.  **Exercise:**
    - Real-time skeleton overlay tracks the user's body.
    - Depth line guides the user to proper depth.
    - HUD bar shows joint angles, body alignment, side detected, and rep counts.
    - Feedback toast displays coaching cues (visual).
    - Voice coaching speaks important cues aloud (audio).
    - Reps auto-count; each is classified as valid or invalid.
8.  **Set Complete:** When valid reps reach the target:
    - "✅ Set X Complete!" overlay appears.
    - Rest period with "Skip Rest" button.
    - Rep counter resets (client + server) and next set begins.
9.  **Workout Complete:** After the final set:
    - Full-screen "🏆 Workout Complete!" overlay with summary stats.
    - "View Analysis" button navigates to detailed Analysis screen.
10. **Analysis:** Review form score, angle ranges, per-set breakdown, and AI coaching insights.

### 7.2 Theme Toggle Flow
1. User taps sun/moon icon in top-right corner.
2. Circle-reveal animation expands from toggle button.
3. Theme flips while screen is covered.
4. Circle fades out, revealing new theme.
5. Preference is saved for future sessions.

## 8. Non-Functional Requirements

- **Privacy:** Video frames are processed in memory and not stored permanently.
- **Device Battery:** Low-resolution captures (smallest picture size, quality 0.1) and throttled streaming (~7 fps) to minimize battery drain.
- **Reliability:** Graceful handling of lost connections (exponential backoff), lost subjects (visibility thresholds), and stale data (session IDs + frame sequence numbers).
- **Isolation:** Each WebSocket connection is fully isolated with its own pose tracker and analyzer — no cross-user state contamination.
- **Accessibility:** Voice coaching provides feedback without requiring visual attention.

## 9. Roadmap

### Phase 1: MVP ✅
- [x] Real-time squat analysis with 4-stage state machine.
- [x] Smooth skeleton overlay (60 fps interpolated) with hip trajectory.
- [x] Depth line guide (target vs. current position).
- [x] Rep counting with valid/invalid classification.
- [x] Per-rep form validation (depth + angle checks).
- [x] Workout configuration (sets, reps, countdown timer).
- [x] Set tracking with automatic transitions and reset.
- [x] Workout completion screen.
- [x] Live HUD metrics (angles, side detection).
- [x] Color-coded feedback toast (success / warning / error).
- [x] Robust WebSocket connection (reconnection, keepalive, session management).
- [x] Local network streaming from mobile to backend.

### Phase 2: Enhanced Intelligence ✅
- [x] Push-up exercise support with full form validation.
- [x] Voice feedback via ElevenLabs TTS.
- [x] Dark/Light theme with animated transitions.
- [x] Gemini-powered post-workout AI coaching summaries.
- [x] Interactive AI chat for follow-up questions.
- [x] Post-workout analysis screen with form scoring.
- [x] Workout streak tracking.
- [x] Particle background animation.

### Phase 3: Expansion (Planned)
- [ ] Additional exercises (Deadlift, Overhead Press, Lunge, Plank).
- [ ] "Good/Bad" rep classification history and per-session analytics.
- [ ] Workout history storage (local).
- [ ] User accounts and cloud history storage.
- [ ] Social sharing of "Perfect Form" clips.
- [ ] Offline mode (on-device MediaPipe models for zero-latency).
- [ ] Remote coaching mode (share session with a trainer).
