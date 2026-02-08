# Form Check Agent

<div align="center">

| 🏠 **[Home / README](README.md)** | 📄 **[Product Specs (PRD)](PRD.md)** |
| :---: | :---: |

</div>
<br />

Form Check Agent is a real-time AI coaching application that helps users improve their exercise form using their phone's camera. By leveraging computer vision and generative AI, it provides instant biomechanical feedback — including a live skeleton overlay, depth tracking, rep counting, and per-rep form validation — to ensure safe and effective workouts.

## 🚀 Features

- **Real-Time Pose Detection**: Uses MediaPipe to track 33 body landmarks at ~7 fps with automatic side detection (left/right).
- **Smooth Skeleton Overlay**: 60 fps interpolated skeleton drawn on the camera feed with hip trajectory visualization.
- **Depth Guide Line**: Visual target-depth indicator showing where your hips need to reach relative to your knees.
- **Rep Counting with Form Validation**: 4-stage state machine (up → descending → bottom → ascending) counts reps and classifies each as **valid** or **invalid** based on depth and posture.
- **Workout Configuration**: Configurable sets, reps-per-set, and countdown timer from a dedicated setup screen.
- **Set & Workout Tracking**: Automatic set transitions with rest periods and a full-screen workout-complete summary.
- **Live HUD Metrics**: Real-time display of knee angle, back (hip) angle, detected side, and connection status.
- **Color-Coded Feedback Toast**: Contextual coaching cues (success / warning / error) displayed as a floating pill at the bottom of the screen.
- **Robust WebSocket Connection**: Exponential-backoff reconnection, session IDs, frame sequencing, and server keepalive pings.
- **AI-Powered Coaching (Gemini)**: Buffers frames for periodic high-level analysis via Google Gemini Flash.
- **Privacy Focused**: Frames are processed in memory; nothing is stored permanently.

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React Native (Expo) · TypeScript · Expo Router · `react-native-svg` |
| **Backend** | Python · FastAPI · WebSockets · Uvicorn |
| **Computer Vision** | OpenCV · MediaPipe Pose (lite model) |
| **AI / LLM** | Google Gemini 1.5 Flash |
| **Communication** | WebSocket (JSON payloads with Base64-encoded JPEG frames) |

## 📁 Project Structure

```
├── app/
│   ├── _layout.tsx          # Expo Router stack (headerless)
│   ├── index.tsx             # Home screen – exercise selector
│   ├── workout-config.tsx    # Sets / reps / timer configuration
│   └── form-check.tsx        # Live camera + analysis screen
├── components/
│   ├── SkeletonOverlay.tsx   # Smooth SVG skeleton + hip trajectory
│   ├── DepthLine.tsx         # Target depth line + hip indicator
│   ├── RepCounter.tsx        # Valid / invalid rep counter card
│   └── FeedbackToast.tsx     # Color-coded coaching toast
├── backend/
│   ├── server.py             # FastAPI WebSocket server
│   ├── pose_tracker.py       # MediaPipe pose estimation wrapper
│   ├── geometry.py           # Angle calculation utility
│   ├── gemini_service.py     # Gemini video analysis service
│   └── exercises/
│       └── squat.py          # Squat analyzer (state machine + form checks)
```

## 📦 Installation

### Prerequisites

- Node.js & npm
- Python 3.9+
- Expo Go app installed on your mobile device (iOS / Android)
- A Google Cloud API Key for Gemini

### 1. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:

```
GEMINI_API_KEY=your_api_key_here
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
3.  Open the app → select **Squats**.
4.  Configure your workout (sets, reps, countdown timer) and tap **Start Workout**.
5.  Position yourself so the camera can see your full body from the side.
6.  Perform your reps — the app provides real-time skeleton overlay, depth guidance, and coaching feedback.
7.  After each set, a brief transition screen appears before the next set.
8.  When all sets are complete, a summary screen is shown.

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any improvements or bug fixes.
