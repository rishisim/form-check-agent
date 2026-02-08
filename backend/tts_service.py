import os
import hashlib
import logging
import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class TTSService:
    """Eleven Labs Text-to-Speech service with in-memory caching."""

    def __init__(self):
        self.api_key = os.environ.get("ELEVEN_LABS_API_KEY", "")
        # Default voice: "Rachel" – a clear, natural coaching voice
        self.voice_id = os.environ.get("ELEVEN_LABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
        self.model_id = "eleven_turbo_v2_5"
        self.base_url = "https://api.elevenlabs.io/v1"

        # In-memory cache: md5(text) -> audio bytes
        self._cache: dict[str, bytes] = {}

        if not self.api_key:
            logger.warning("ELEVEN_LABS_API_KEY not set – TTS will be disabled")

    @property
    def is_available(self) -> bool:
        return bool(self.api_key)

    async def synthesize(self, text: str) -> bytes | None:
        """
        Convert text to speech using Eleven Labs API.
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

        url = f"{self.base_url}/text-to-speech/{self.voice_id}"
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }
        payload = {
            "text": clean_text,
            "model_id": self.model_id,
            "voice_settings": {
                "stability": 0.6,
                "similarity_boost": 0.75,
                "speed": 1.15,          # slightly faster for coaching cues
            },
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url, json=payload, headers=headers, timeout=10.0
                )

            if response.status_code == 200:
                audio_bytes = response.content
                self._cache[cache_key] = audio_bytes
                logger.info(
                    f"TTS generated ({len(audio_bytes)} bytes) for: {clean_text!r}"
                )
                return audio_bytes
            else:
                logger.error(
                    f"Eleven Labs API error {response.status_code}: {response.text[:200]}"
                )
                return None

        except httpx.TimeoutException:
            logger.error("TTS request timed out")
            return None
        except Exception as e:
            logger.error(f"TTS error: {e}")
            return None
