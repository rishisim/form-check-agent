# Gemini API & ElevenLabs Integration Plan

## Objective
Optimize Gemini API feedback for ElevenLabs TTS integration by enforcing structured JSON output, cleaner text for prosody, and low latency.

## Proposed Changes

### 1. Enforce Strict JSON Schema
- Update `gemini_service.py` to use `response_mime_type="application/json"` (if supported by the SDK version) or explicit JSON instructions in the prompt.
- Define a specific schema for the output, e.g., `{"feedback": "string"}`.

### 2. Optimize for Vocal Prosody
- Update the system instruction/prompt to explicitly forbid special characters, hashtags, and non-verbal symbols.
- Request "clean, actionable strings" suitable for speech synthesis.

### 3. Latency & Length Constraints
- Reinforce the "max 10 words" constraint to ensure low TTS generation latency.
- Ensure the feedback is a single, concise sentence.

### 4. Temporal Reasoning & Context
- Verify the video buffer length (currently 2 seconds) is sufficient for temporal analysis of the movement.
- Ensure the prompt directs Gemini to analyze the *sequence* of frames to detect form changes.

## Verification
- Test the updated `gemini_service.py` (mocking or dry-running if possible, or just code review of the logic) to ensure it constructs the correct request.
- Confirm the output parsing logic handles the JSON format.
