# Form Check Agent

Form Check Agent is a real-time AI coaching application that helps users improve their exercise form using their phone's camera. By leveraging computer vision and generative AI, it provides instant biomechanical feedback to ensure safe and effective workouts.

## 🚀 Features

- **Real-Time Pose Detection**: Uses MediaPipe to track key body landmarks during exercises.
- **Instant Form Analysis**: Analyzes squat depth and posture in real-time.
- **AI-Powered Coaching**: Integrates with Google Gemini to provide personalized, improved feedback on your form.
- **Live Video Streaming**: Streams video from your mobile device to a powerful backend for processing.
- **Privacy Focused**: Processes video streams efficiently without storing sensitive data unnecessarily.

## 🛠 Tech Stack

- **Frontend**: React Native with Expo (TypeScript)
- **Backend**: Python with FastAPI & WebSockets
- **Computer Vision**: OpenCV, MediaPipe
- **AI Model**: Google Gemini Flash
- **State Management**: React Context / Hooks

## 📦 Installation

To get started with the Form Check Agent, follow the instructions below for both the backend and frontend.

### Prerequisites

- Node.js & npm
- Python 3.9+
- Expo Go app installed on your mobile device (iOS/Android)
- A Google Cloud API Key for Gemini

### 1. Backend Setup

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```

2.  Create a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

4.  Set up environment variables:
    - Create a `.env` file in the `backend` directory.
    - Add your Gemini API key:
      ```
      GEMINI_API_KEY=your_api_key_here
      ```

5.  Start the server:
    ```bash
    python server.py
    ```
    The server will start on `http://0.0.0.0:8000`.

### 2. Frontend Setup

1.  Navigate to the project root (if not already there):
    ```bash
    cd ..
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the Expo app:
    ```bash
    npx expo start
    ```

4.  Scan the QR code with your phone (using the Expo Go app) or press `i` to run on an iOS simulator / `a` for Android emulator.

## 📱 Usage

1.  Ensure your phone and computer are on the **same Wi-Fi network**.
2.  Open the app on your phone.
3.  Grant camera permissions.
4.  Point the camera at yourself while performing a squat.
5.  Receive real-time feedback on your form!

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any improvements or bug fixes.
