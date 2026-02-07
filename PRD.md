# Product Requirements Document (PRD)

**Project Name:** Form Check Agent  
**Version:** 1.0  
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
2.  **Accuracy:** deliver precise skeletal tracking and biomechanical analysis comparable to human observation.
3.  **Real-Time Responsiveness:** Provide feedback with minimal latency (< 200ms) to allow in-rep corrections.
4.  **Accessibility:** Run effectively on standard consumer hardware (smartphone + laptop/cloud backend).

## 4. User Personas

1.  **The Beginner Lifter (Alex)**
    - *Needs:* Basic safety cues, confidence building, and simple instructions ("keep your chest up").
    - *Pain Point:* Intimidated by complex movements; unsure if they are "doing it right."

2.  **The Intermediate Athlete (Sam)**
    - *Needs:* Performance optimization, depth checks, and consistency tracking.
    - *Pain Point:* hitting plateaus due to minor form breakdown at high loads.

3.  **The Remote Coach (Jordan)**
    - *Needs:* Tools to assign homework and auto-verify client form during remote sessions.
    - *Pain Point:* Can't be with every client 24/7; relies on asynchronous video reviews.

## 5. Functional Requirements

### 5.1 Mobile Application (Frontend)
- **Live Camera Feed:**
    - Must capture video at a minimum of 30fps.
    - Support for front and back cameras.
    - Overlay skeletal visualization on top of the user's video feed.
- **Feedback UI:**
    - **Visual:** Color-coded skeleton (Green = Good, Red = Bad correction needed).
    - **Text:** Large, readable instructions displayed on-screen (e.g., "Go Deeper").
    - **Audio:** (Future) Voice feedback for hands-free operation.
- **Connectivity:**
    - WebSocket client to stream frames to the backend.
    - Automatic reconnection logic for network stability.

### 5.2 Backend Processing
- **Pose Estimation:**
    - Utilize MediaPipe Pose solution to track 33 3D body landmarks.
    - Perform detection on every frame or every *n*-th frame to maintain performance.
- **Biomechanical Engine (Squat Analyzer):**
    - Calculate key angles:
        - **Hip Angle:** Torso relative to thigh.
        - **Knee Angle:** Thigh relative to shin (depth analysis).
        - **Ankle Angle:** Shin relative to foot.
    - Heuristics for common errors:
        - **Knee Valgus:** Knees collapsing inward.
        - **Butt Wink:** Lumbar flexion at the bottom of the squat.
        - **Insufficient Depth:** Thighs not parallel to the ground.
- **AI Integration (Gemini):**
    - **Contextual Analysis:** Send aggregated rep data (not just raw frames) to LLM.
    - **Personalized Coaching:** Generate summary feedback after a set (e.g., "Your depth improved on the last 3 reps, but watch your knees").

### 5.3 System Performance
- **Latency:** End-to-end latency (Camera -> Screen) should be under 200ms to feel "real-time."
- **Throughput:** Backend must handle concurrent users (scalability consideration for future cloud deployment).

## 6. Technical Architecture

### 6.1 Technology Stack
- **Frontend:** React Native (Expo) + TypeScript
- **Backend:** Python + FastAPI
- **Communication:** WebSocket (JSON payloads with Base64 encoded images)
- **Computer Vision:** OpenCV + MediaPipe
- **AI/LLM:** Google Gemini Flash 1.5 (via Google Generative AI SDK)

### 6.2 Data Flow
1.  **Capture:** Mobile app captures frame `F` at time `t`.
2.  **Encode:** App resizes and compresses `F` to JPEG/Base64.
3.  **Transmit:** App sends `F` to Backend via WebSocket.
4.  **Process:**
    - Backend decodes `F`.
    - MediaPipe extracts landmarks `L`.
    - `SquatAnalyzer` computes metrics `M` from `L`.
    - `GeminiService` (async) periodically reviews `M` for high-level patterns.
5.  **Response:** Backend sends `L` + `M` (feedback) back to App.
6.  **Render:** App draws `L` overlay and displays feedback.

## 7. UX / User Flows

### 7.1 The Workout Flow
1.  **Launch:** User opens app.
2.  **Setup:**
    - User selects "Squat" mode.
    - User places phone on floor/tripod.
    - App shows "Stand in frame" guide.
3.  **Calibration:**
    - App detects full body visibility.
    - "Ready" indicator turns green.
4.  **Exercise:**
    - User performs reps.
    - Real-time overlays update instantly.
    - Feedback ("Lower", "Good!") appears dynamically.
5.  **Rest/Finish:**
    - User steps away or presses "Finsih".
    - App displays summary stats (Max depth, Rep count).
    - (Optional) AI Coach provides a text summary of the session.

## 8. Non-Functional Requirements

- **Privacy:** Video frames are processed in memory and ideally not stored permanently unless user opts-in for debugging/training.
- **Device Battery:** Efficient frame processing to prevent rapid battery drain on mobile.
- **Reliability:** The app should handle "loss of subject" (user walking out of frame) gracefully without crashing.

## 9. Roadmap

### Phase 1: MVP (Current)
- [x] Basic Squat Analysis.
- [x] Real-time skeleton overlay.
- [x] Simple depth feedback.
- [x] Local network WebSocket connection.

### Phase 2: Enhanced Intelligence
- [ ] Voice feedback (using ElevenLabs or native TTS).
- [ ] Rep counting logic.
- [ ] "Good/Bad" rep classification history.

### Phase 3: Expansion
- [ ] Multi-exercise support (Deadlift, Overhead Press, Lunge).
- [ ] User accounts and cloud history storage.
- [ ] Social sharing of "Perfect Form" clips.
- [ ] Offline mode (On-device MediaPipe models for zero-latency).
