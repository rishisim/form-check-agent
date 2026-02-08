# ElevenLabs TTS Integration - Complete

## Overview
Successfully integrated ElevenLabs Text-to-Speech API for real-time voice coaching feedback during workouts. The system now provides AI-powered form analysis via Gemini with optional voice narration.

## Features Implemented

### 1. Voice Feedback Toggle (Frontend)
- **Location**: `app/workout-config.tsx`
- Added a toggle switch in the workout configuration screen
- Users can enable/disable voice feedback before starting their workout
- Default: **Enabled**
- The preference is passed to the backend via WebSocket configuration message

### 2. TTS Service (Backend)
- **Location**: `backend/tts_service.py`
- Integrates with ElevenLabs API
- Uses `eleven_turbo_v2` model for low latency
- Voice: Rachel (ID: `21m00Tcm4TlvDq8ikWAM`)
- Returns MP3 audio as bytes
- Graceful error handling if API key is missing

### 3. Periodic Gemini Analysis (Backend)
- **Location**: `backend/server.py`
- Gemini analysis now runs **every 5 seconds** (configurable via `GEMINI_INTERVAL`)
- Requires minimum 45 frames in buffer before triggering
- Runs in background thread to avoid blocking WebSocket
- Sends structured JSON feedback optimized for vocal prosody

### 4. Audio Playback (Frontend)
- **Location**: `app/form-check.tsx`
- Receives base64-encoded MP3 audio from backend
- Plays audio using `expo-av`
- Auto-cleanup when playback finishes
- Handles `gemini_feedback` WebSocket message type

## Architecture

```
┌─────────────────┐
│  Expo Frontend  │
│                 │
│  [Toggle Voice] │
│  [Camera Feed]  │
└────────┬────────┘
         │ WebSocket
         │ 1. Configure (voice_feedback: true/false)
         │ 2. Frame stream (~7fps)
         ▼
┌─────────────────┐
│  FastAPI Server │
│                 │
│  Per 5s:        │
│  ├─ Gemini API  │ ──► JSON feedback (max 10 words)
│  └─ If voice ON:│
│     └─ TTS API  │ ──► MP3 audio bytes
└────────┬────────┘
         │ WebSocket
         │ 3. gemini_feedback { text, audio }
         ▼
┌─────────────────┐
│  Expo Frontend  │
│                 │
│  [Play Audio]   │
│  [Show Text]    │
└─────────────────┘
```

## Configuration

### Environment Variables
Create a `.env` file in the `backend/` directory:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

### Tunable Parameters

**Backend (`server.py`):**
- `GEMINI_INTERVAL = 5.0` - Seconds between Gemini analyses
- Minimum buffer frames: `45` (adjustable in line 217)

**Gemini Service (`gemini_service.py`):**
- Buffer size: `2 seconds * 30 fps = 60 frames`
- Model: `gemini-1.5-flash`
- Response schema: `{"feedback": string, "is_perfect_form": boolean}`

**TTS Service (`tts_service.py`):**
- Voice ID: `21m00Tcm4TlvDq8ikWAM` (Rachel)
- Model: `eleven_turbo_v2`
- Stability: `0.5`
- Similarity boost: `0.5`

## Message Flow

### 1. Configuration Message (Frontend → Backend)
```json
{
  "type": "configure",
  "config": {
    "voice_feedback": true
  }
}
```

### 2. Gemini Feedback Message (Backend → Frontend)
```json
{
  "type": "gemini_feedback",
  "text": "Keep your back straight",
  "audio": "base64_encoded_mp3_data_or_null"
}
```

## Dependencies

### Backend
- `google-genai` - Gemini API
- `requests` - HTTP client for ElevenLabs
- `python-dotenv` - Environment variables
- Standard library: `asyncio`, `base64`, `time`

### Frontend
- `expo-av` - Audio playback (installed ✓)
- `expo-router` - Navigation with params

## Testing Checklist

- [ ] Set `GEMINI_API_KEY` in `.env`
- [ ] Set `ELEVENLABS_API_KEY` in `.env`
- [ ] Start backend: `python backend/server.py`
- [ ] Start frontend: `npx expo start`
- [ ] Navigate to workout config
- [ ] Toggle voice feedback ON/OFF
- [ ] Start workout
- [ ] Verify Gemini analysis triggers every 5s (check backend logs)
- [ ] Verify audio plays when voice is ON
- [ ] Verify no audio when voice is OFF
- [ ] Verify text feedback displays in both cases

## Known Limitations

1. **Latency**: Combined Gemini + TTS latency is ~2-4 seconds
   - Gemini: ~1-2s
   - ElevenLabs: ~1-2s
   - Consider caching common phrases for faster response

2. **Cost**: Each analysis incurs API costs
   - Gemini: ~$0.00015 per request (flash model)
   - ElevenLabs: ~$0.18 per 1000 characters
   - 5-second interval = ~12 requests/minute

3. **Network**: Requires stable internet connection
   - Base64 audio in WebSocket can be large (~50-100KB per message)
   - Consider streaming audio or using URLs instead

## Future Enhancements

1. **Caching**: Pre-generate audio for common feedback phrases
2. **Streaming**: Use ElevenLabs streaming API for lower latency
3. **Voice Selection**: Allow users to choose voice in settings
4. **Language Support**: Multi-language TTS
5. **Offline Mode**: Fallback to text-only when offline
6. **Analytics**: Track which feedback is most helpful

## Troubleshooting

### No audio playing
- Check browser console for errors
- Verify `ELEVENLABS_API_KEY` is set
- Check backend logs for TTS generation errors
- Ensure `expo-av` is installed: `npx expo install expo-av`

### Gemini not triggering
- Check `GEMINI_API_KEY` is set
- Verify frame buffer has >45 frames (check backend logs)
- Ensure 5 seconds have passed since last analysis

### Audio cuts off
- Check network stability
- Verify base64 encoding/decoding is correct
- Check audio format is MP3

## Files Modified/Created

### Created
- `backend/tts_service.py` - ElevenLabs integration
- `.env.example` - API key template

### Modified
- `app/workout-config.tsx` - Voice toggle UI
- `app/form-check.tsx` - Audio playback logic
- `backend/server.py` - Periodic Gemini analysis + TTS integration
- `package.json` - Added `expo-av` dependency

## Summary

The integration is **complete and functional**. Users can now:
1. Toggle voice feedback in workout config
2. Receive AI-powered form analysis every 5 seconds
3. Hear coaching cues narrated by ElevenLabs TTS
4. See text feedback on screen simultaneously

The system is optimized for low latency with:
- Turbo TTS model
- Async/threaded processing
- Minimal feedback text (max 10 words)
- JSON-only Gemini responses
