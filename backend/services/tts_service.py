import os
import hashlib
import logging
import asyncio
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class TTSService:
    """Eleven Labs Text-to-Speech service using the official SDK with in-memory caching."""

    def __init__(self):
        self.api_key = os.environ.get("ELEVENLABS_API_KEY", "")
        # Default voice: "Rachel" – clear female coaching voice
        self.voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
        self.model_id = "eleven_turbo_v2_5"
        self.output_format = "mp3_44100_128"

        # In-memory cache: md5(text) -> audio bytes
        self._cache: dict = {}

        # Lazy-init the client
        self._client = None

        if not self.api_key:
            logger.warning("ELEVENLABS_API_KEY not set – TTS will be disabled")

    def _get_client(self):
        if self._client is None and self.api_key:
            from elevenlabs.client import ElevenLabs
            self._client = ElevenLabs(api_key=self.api_key)
        return self._client

    @property
    def is_available(self) -> bool:
        return bool(self.api_key)

    async def synthesize(self, text: str) -> Optional[bytes]:
        """
        Convert text to speech using the ElevenLabs SDK.
        Returns MP3 audio bytes, or None on failure.
        Results are cached in memory so repeated phrases are instant.
        """
        if not self.api_key:
            logger.warning("TTS unavailable – no API key")
            return None

        if not text or not text.strip():
            return None

        # Strip emojis / non-ASCII decorations for cleaner speech
        clean_text = text.encode("ascii", "ignore").decode("ascii").strip()
        if not clean_text:
            clean_text = text.strip()

        # Check cache
        cache_key = hashlib.md5(clean_text.lower().encode()).hexdigest()
        if cache_key in self._cache:
            logger.info(f"TTS cache hit for: {clean_text!r}")
            return self._cache[cache_key]

        # Run the SDK call in a thread to keep the event loop free
        try:
            audio_bytes = await asyncio.to_thread(self._synthesize_sync, clean_text)
            if audio_bytes:
                self._cache[cache_key] = audio_bytes
                logger.info(f"TTS generated ({len(audio_bytes)} bytes) for: {clean_text!r}")
            return audio_bytes
        except Exception as e:
            logger.error(f"TTS error: {e}")
            return None

    def _synthesize_sync(self, text: str) -> Optional[bytes]:
        """Synchronous TTS call using the ElevenLabs SDK."""
        client = self._get_client()
        if not client:
            return None

        try:
            audio_iter = client.text_to_speech.convert(
                text=text,
                voice_id=self.voice_id,
                model_id=self.model_id,
                output_format=self.output_format,
            )
            # The SDK returns an iterator of bytes chunks – join them
            chunks = []
            for chunk in audio_iter:
                chunks.append(chunk)
            return b"".join(chunks)
        except Exception as e:
            logger.error(f"ElevenLabs SDK error: {e}")
            return None
