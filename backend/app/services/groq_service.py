"""Groq API wrappers.

The Groq Python SDK is synchronous, so every call is wrapped with
asyncio.to_thread() to avoid blocking the async event loop.
"""

import asyncio

from groq import Groq

from app.config import settings

groq_client = Groq(api_key=settings.GROQ_API_KEY)

_TTS_MAX_CHARS = 200

SYSTEM_PROMPT = (
    "You are a thoughtful journaling companion. "
    "Respond to the user's journal entry with a brief, empathetic reflection "
    "or gentle question. Keep responses concise — 1-3 sentences."
)


def _truncate_for_tts(text: str) -> str:
    """Trim to the last sentence boundary within 200 chars (Orpheus hard limit)."""
    if len(text) <= _TTS_MAX_CHARS:
        return text
    slice_ = text[:_TTS_MAX_CHARS]
    last_end = max(
        slice_.rfind(". "),
        slice_.rfind("! "),
        slice_.rfind("? "),
    )
    if last_end > 0:
        return slice_[: last_end + 1]
    last_space = slice_.rfind(" ")
    return (slice_[:last_space] + "\u2026") if last_space > 0 else slice_


def _transcribe_sync(audio_bytes: bytes, filename: str) -> str:
    result = groq_client.audio.transcriptions.create(
        file=(filename, audio_bytes),
        model="whisper-large-v3",
        response_format="json",
        language="en",
    )
    return result.text.strip()


def _chat_sync(messages: list[dict]) -> str:
    completion = groq_client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=messages,
        max_tokens=200,
        temperature=0.8,
    )
    return completion.choices[0].message.content or ""


def _tts_sync(text: str) -> bytes:
    truncated = _truncate_for_tts(text)
    response = groq_client.audio.speech.create(
        model="canopylabs/orpheus-v1-english",
        voice="hannah",
        input=truncated,
        response_format="wav",
    )
    return response.read()


async def transcribe(audio_bytes: bytes, filename: str) -> str:
    return await asyncio.to_thread(_transcribe_sync, audio_bytes, filename)


async def chat(messages: list[dict]) -> str:
    return await asyncio.to_thread(_chat_sync, messages)


async def tts(text: str) -> bytes:
    return await asyncio.to_thread(_tts_sync, text)
