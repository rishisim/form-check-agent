# Form Check Agent

<div align="center">

| 🏠 **[Home / README](README.md)** | 📄 **[Product Specs (PRD)](PRD.md)** |
| :---: | :---: |

</div>
<br />

Form Check Agent is a real-time AI coaching application that helps users improve their exercise form using their phone's camera. By leveraging computer vision and generative AI, it provides instant biomechanical feedback — including a live skeleton overlay, depth tracking, rep counting, per-rep form validation, and **voice coaching** — to ensure safe and effective workouts.

## 🚀 Features

### Exercise Analysis
- **Real-Time Pose Detection**: Uses MediaPipe to track 33 body landmarks at ~7 fps with automatic side detection (left/right).
- **Multi-Exercise Support**: Full analysis for **Squats** and **Push-ups** with exercise-specific form validation.
- **Smooth Skeleton Overlay**: 60 fps interpolated skeleton drawn on the camera feed with hip trajectory visualization.
- **Depth Guide Line**: Visual target-depth indicator showing where your hips/chest need to reach.
- **Rep Counting with Form Validation**: 4-stage state machine counts reps and classifies each as **valid** or **invalid** based on depth and posture.

### Workout Management
- **Workout Configuration**: Configurable sets, reps-per-set, and countdown timer from a dedicated setup screen.
- **Set & Workout Tracking**: Automatic set transitions with rest periods (skippable) and a full-screen workout-complete summary.
- **Workout Streak Tracking**: Tracks consecutive workout days with streak preservation.

### Coaching & Feedback
- **Live HUD Metrics**: Real-time display of joint angles, detected side, and connection status.
- **Color-Coded Feedback Toast**: Contextual coaching cues (success / warning / error) displayed as a floating pill.
- **Voice Coaching (TTS)**: Real-time spoken feedback via **ElevenLabs** text-to-speech integration with rate-limiting and caching.
- **AI-Powered Post-Workout Analysis**: Detailed workout summaries and coaching insights via **Google Gemini Flash** with an interactive chat feature.

### User Experience
- **Dark/Light Theme**: Fully themed UI with animated circle-reveal transition and persistent preference storage.
- **Particle Background Animation**: Beautiful floating particle effect on the home screen.
- **Robust WebSocket Connection**: Exponential-backoff reconnection, session IDs, frame sequencing, and server keepalive pings.
- **Privacy Focused**: Frames are processed in memory; nothing is stored permanently.

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React Native (Expo) · TypeScript · Expo Router · `react-native-svg` |
| **Backend** | Python · FastAPI · WebSockets · Uvicorn |
| **Computer Vision** | OpenCV · MediaPipe Pose (lite model) |
| **AI / LLM** | Google Gemini 1.5 Flash |
| **Voice** | ElevenLabs Text-to-Speech (Turbo v2.5) |
| **Communication** | WebSocket (JSON payloads with Base64-encoded JPEG frames) |

## 📁 Project Structure

```
├── app/
│   ├── _layout.tsx          # Expo Router stack with ThemeProvider
│   ├── index.tsx             # Home screen – exercise selector with streak tracking
│   ├── workout-config.tsx    # Sets / reps / timer configuration
│   ├── form-check.tsx        # Live camera + analysis screen
│   └── analysis.tsx          # Post-workout analysis + AI chat
├── components/
│   ├── SkeletonOverlay.tsx   # Smooth SVG skeleton + trajectory
│   ├── DepthLine.tsx         # Target depth line + indicator
│   ├── RepCounter.tsx        # Valid / invalid rep counter card
│   ├── FeedbackToast.tsx     # Color-coded coaching toast
│   ├── ThemeToggle.tsx       # Animated sun/moon theme toggle
│   ├── ParticleBackground.tsx # Floating particle animation
│   └── WaveHeader.tsx        # Decorative wave header
├── hooks/
│   ├── useTheme.tsx          # Theme context with dark/light modes
│   ├── useTTS.ts             # Text-to-speech hook for voice coaching
│   └── useOrientation.ts     # Device orientation handling
├── backend/
│   ├── server.py             # FastAPI WebSocket server + TTS endpoint
│   ├── pose_tracker.py       # MediaPipe pose estimation wrapper
│   ├── geometry.py           # Angle calculation utility
│   ├── exercises/
│   │   ├── base.py           # Shared utilities (angle smoothing, feedback stabilization)
│   │   ├── squat.py          # Squat analyzer (state machine + form checks)
│   │   └── pushup.py         # Push-up analyzer with body alignment checks
│   └── services/
│       ├── gemini_service.py # Gemini video analysis service
│       └── tts_service.py    # ElevenLabs TTS service with caching
```

## 📦 Installation

### Prerequisites

- Node.js & npm
- Python 3.9+
- Expo Go app installed on your mobile device (iOS / Android)
- A Google Cloud API Key for Gemini
- (Optional) An ElevenLabs API Key for voice coaching

### 1. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:

```
GEMINI_API_KEY=your_gemini_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here  # Optional
```

Start the server:

```bash
python server.py
```

The server will start on `http://0.0.0.0:8000`. Health check available at `GET /health`.

### 2. Frontend Setup

```bash
# From the project root
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `i` (iOS simulator) / `a` (Android emulator).

> **Note:** Update the `SERVER_URL` constant in `app/form-check.tsx` to point to your backend's local IP address.

## 📱 Usage

1.  Ensure your phone and computer are on the **same Wi-Fi network**.
2.  Start the backend server.
3.  Open the app → select an exercise (**Squats** or **Push-ups**).
4.  Configure your workout (sets, reps, countdown timer) and tap **Start Workout**.
5.  Position yourself so the camera can see your full body from the side.
6.  Perform your reps — the app provides real-time skeleton overlay, depth guidance, voice coaching, and visual feedback.
7.  After each set, a brief rest screen appears (tap "Skip Rest" to continue immediately).
8.  When all sets are complete, view your detailed **Analysis** screen with AI-powered insights.

## 🎨 Theme Support

The app supports both light and dark themes:
- Toggle via the sun/moon button in the top-right corner
- Theme preference is persisted across app sessions
- Features a smooth animated circle-reveal transition effect

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any improvements or bug fixes.
