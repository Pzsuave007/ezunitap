"""Text-to-speech voice-over for Reels (OpenAI TTS via Emergent Universal Key)."""
import os

from dotenv import load_dotenv
from emergentintegrations.llm.openai import OpenAITextToSpeech

load_dotenv()

# Voice per language — a clear, professional tone for contractor marketing.
_VOICE = {"en": "onyx", "es": "onyx"}


async def generate_voiceover(text: str, language: str = "en") -> bytes:
    """Return MP3 bytes of the spoken text. Caps length to TTS limit."""
    text = (text or "").strip()[:900]
    if not text:
        raise ValueError("Texto vacío para la voz en off")
    tts = OpenAITextToSpeech(api_key=os.getenv("EMERGENT_LLM_KEY"))
    voice = _VOICE.get(language, "onyx")
    return await tts.generate_speech(text=text, model="tts-1", voice=voice, response_format="mp3")
