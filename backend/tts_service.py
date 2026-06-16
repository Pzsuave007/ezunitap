"""Text-to-speech voice-over for Reels.

Primary engine: ElevenLabs `eleven_multilingual_v2` — pronounces Spanish
natively (no "gringo" accent) AND English with the same voices. Falls back to
OpenAI TTS (via the Emergent Universal Key) only if no ElevenLabs key is set.
"""
import os

from dotenv import load_dotenv

load_dotenv()

_EL_KEY = os.getenv("ELEVENLABS_API_KEY") or ""
_EL_MODEL = "eleven_multilingual_v2"

# Curated ElevenLabs voices. With the multilingual model EACH voice speaks
# BOTH Spanish and English naturally, so the same picker works for either
# language (the reel's language toggle controls the TEXT, not the voice).
VOICES = [
    {"id": "nPczCjzI2devNBz1zQrb", "label": "Brian", "desc": "Hombre · profunda y reconfortante", "gender": "m"},
    {"id": "cjVigY5qzO86Huf0OWal", "label": "Eric", "desc": "Hombre · suave y confiable", "gender": "m"},
    {"id": "TX3LPaxmHKxFdv7VOQHJ", "label": "Liam", "desc": "Hombre · enérgica, para redes", "gender": "m"},
    {"id": "iP95p4xoKVk53GoZ742B", "label": "Chris", "desc": "Hombre · cercana y natural", "gender": "m"},
    {"id": "pqHfZKP75CvOlQylNhV4", "label": "Bill", "desc": "Hombre · madura y equilibrada", "gender": "m"},
    {"id": "EXAVITQu4vr4xnSDxMaL", "label": "Sarah", "desc": "Mujer · cálida y confiable", "gender": "f"},
    {"id": "XrExE9yKIg1WjnnlVkGX", "label": "Matilda", "desc": "Mujer · profesional y clara", "gender": "f"},
    {"id": "cgSgspJ2msm6clMCkdW9", "label": "Jessica", "desc": "Mujer · alegre y cálida", "gender": "f"},
    {"id": "FGY2WhTYpPnrIDTdsKH5", "label": "Laura", "desc": "Mujer · joven y entusiasta", "gender": "f"},
    {"id": "SAz9YHcvj6GT2YYXdXww", "label": "River", "desc": "Neutral · relajada e informativa", "gender": "n"},
]
_VOICE_IDS = {v["id"] for v in VOICES}
# Default per language: warm female for Spanish, deep male for English.
_DEFAULT_VOICE = {"es": "EXAVITQu4vr4xnSDxMaL", "en": "nPczCjzI2devNBz1zQrb"}

# Speed presets shown in the UI. ElevenLabs supports 0.7–1.2 (clamped below).
SPEEDS = [
    {"id": "slow", "label": "Pausada", "value": 0.9},
    {"id": "natural", "label": "Natural", "value": 1.0},
    {"id": "lively", "label": "Ágil", "value": 1.1},
    {"id": "fast", "label": "Rápida", "value": 1.2},
]

# Legacy OpenAI voice ids → closest ElevenLabs voice (so old saved choices map).
_LEGACY_OPENAI = {
    "onyx": "nPczCjzI2devNBz1zQrb", "echo": "cjVigY5qzO86Huf0OWal",
    "ash": "pqHfZKP75CvOlQylNhV4", "sage": "iP95p4xoKVk53GoZ742B",
    "nova": "EXAVITQu4vr4xnSDxMaL", "shimmer": "cgSgspJ2msm6clMCkdW9",
    "coral": "XrExE9yKIg1WjnnlVkGX", "fable": "SAz9YHcvj6GT2YYXdXww",
    "alloy": "SAz9YHcvj6GT2YYXdXww",
}


def resolve_voice(voice: str, language: str = "en") -> str:
    if voice in _VOICE_IDS:
        return voice
    if voice in _LEGACY_OPENAI:
        return _LEGACY_OPENAI[voice]
    return _DEFAULT_VOICE.get(language, _DEFAULT_VOICE["en"])


async def _elevenlabs_voiceover(text: str, voice: str, speed: float) -> bytes:
    from elevenlabs.client import AsyncElevenLabs
    from elevenlabs import VoiceSettings

    client = AsyncElevenLabs(api_key=_EL_KEY)
    settings = VoiceSettings(
        stability=0.5, similarity_boost=0.75, style=0.0,
        use_speaker_boost=True, speed=speed,
    )
    stream = client.text_to_speech.convert(
        voice_id=voice, text=text, model_id=_EL_MODEL,
        output_format="mp3_44100_128", voice_settings=settings,
    )
    out = b""
    async for chunk in stream:
        if chunk:
            out += chunk
    if not out:
        raise RuntimeError("ElevenLabs devolvió audio vacío")
    return out


async def _openai_voiceover(text: str, language: str, voice: str, speed: float) -> bytes:
    """Fallback engine (OpenAI TTS via Emergent Universal Key)."""
    from emergentintegrations.llm.openai import OpenAITextToSpeech

    _openai_default = {"es": "nova", "en": "onyx"}
    legacy = {v: k for k, v in _LEGACY_OPENAI.items()}
    ov = legacy.get(voice) or _openai_default.get(language, "onyx")
    tts = OpenAITextToSpeech(api_key=os.getenv("EMERGENT_LLM_KEY"))
    return await tts.generate_speech(
        text=text, model="tts-1-hd", voice=ov,
        speed=max(0.7, min(1.4, speed)), response_format="mp3",
    )


async def generate_voiceover(text: str, language: str = "en",
                             voice: str = "", speed: float = 1.0) -> bytes:
    """Return MP3 bytes of the spoken text. Uses ElevenLabs multilingual for
    natural Spanish/English; `voice` picks the speaker, `speed` controls pace."""
    text = (text or "").strip()[:5000]
    if not text:
        raise ValueError("Texto vacío para la voz en off")
    voice = resolve_voice(voice, language)
    try:
        speed = float(speed)
    except (TypeError, ValueError):
        speed = 1.0
    if _EL_KEY:
        speed = max(0.7, min(1.2, speed))
        return await _elevenlabs_voiceover(text, voice, speed)
    return await _openai_voiceover(text, language, voice, speed)
