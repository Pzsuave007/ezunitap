"""Text-to-speech voice-over for Reels (OpenAI TTS via Emergent Universal Key)."""
import os

from dotenv import load_dotenv
from emergentintegrations.llm.openai import OpenAITextToSpeech

load_dotenv()

# Voice per language — a clear, professional tone for contractor marketing.
_VOICE = {"en": "onyx", "es": "nova"}


async def generate_voiceover(text: str, language: str = "en", speed: float = 0.9) -> bytes:
    """Return MP3 bytes of the spoken text. Caps length to TTS limit.
    speed < 1.0 makes the narration slower / easier to follow."""
    text = (text or "").strip()[:900]
    if not text:
        raise ValueError("Texto vacío para la voz en off")
    speed = max(0.5, min(1.5, speed))
    tts = OpenAITextToSpeech(api_key=os.getenv("EMERGENT_LLM_KEY"))
    voice = _VOICE.get(language, "onyx")
    return await tts.generate_speech(text=text, model="tts-1", voice=voice, speed=speed, response_format="mp3")
