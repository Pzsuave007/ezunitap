"""Text-to-speech voice-over for Reels (OpenAI TTS via Emergent Universal Key)."""
import os

from dotenv import load_dotenv
from emergentintegrations.llm.openai import OpenAITextToSpeech

load_dotenv()

# Selectable voices (OpenAI TTS). Each voice has its own natural pitch/tone, so
# choosing a voice IS how the user controls "pitch" (deep onyx vs bright shimmer).
VOICES = [
    {"id": "onyx", "label": "Onyx", "desc": "Hombre · profunda y autoritaria", "gender": "m"},
    {"id": "echo", "label": "Echo", "desc": "Hombre · calmada y clara", "gender": "m"},
    {"id": "ash", "label": "Ash", "desc": "Hombre · firme y articulada", "gender": "m"},
    {"id": "sage", "label": "Sage", "desc": "Hombre · serena y madura", "gender": "m"},
    {"id": "nova", "label": "Nova", "desc": "Mujer · enérgica y positiva", "gender": "f"},
    {"id": "shimmer", "label": "Shimmer", "desc": "Mujer · brillante y alegre", "gender": "f"},
    {"id": "coral", "label": "Coral", "desc": "Mujer · cálida y amigable", "gender": "f"},
    {"id": "fable", "label": "Fable", "desc": "Expresiva · tipo narrador", "gender": "n"},
    {"id": "alloy", "label": "Alloy", "desc": "Neutral y balanceada", "gender": "n"},
]
_VOICE_IDS = {v["id"] for v in VOICES}
_DEFAULT_VOICE = {"en": "onyx", "es": "nova"}

# Speed presets shown in the UI (OpenAI supports 0.25–4.0; we keep a natural range).
SPEEDS = [
    {"id": "slow", "label": "Pausada", "value": 0.9},
    {"id": "natural", "label": "Natural", "value": 1.0},
    {"id": "lively", "label": "Ágil", "value": 1.12},
    {"id": "fast", "label": "Rápida", "value": 1.25},
]


def resolve_voice(voice: str, language: str = "en") -> str:
    return voice if voice in _VOICE_IDS else _DEFAULT_VOICE.get(language, "onyx")


async def generate_voiceover(text: str, language: str = "en",
                             voice: str = "", speed: float = 1.0) -> bytes:
    """Return MP3 bytes of the spoken text. Uses tts-1-hd for a more natural
    sound. `voice` picks the speaker (pitch/tone); `speed` controls pacing
    (1.0 = natural; lower = slower/clearer)."""
    text = (text or "").strip()[:900]
    if not text:
        raise ValueError("Texto vacío para la voz en off")
    voice = resolve_voice(voice, language)
    try:
        speed = float(speed)
    except (TypeError, ValueError):
        speed = 1.0
    speed = max(0.7, min(1.4, speed))
    tts = OpenAITextToSpeech(api_key=os.getenv("EMERGENT_LLM_KEY"))
    return await tts.generate_speech(
        text=text, model="tts-1-hd", voice=voice, speed=speed, response_format="mp3",
    )
