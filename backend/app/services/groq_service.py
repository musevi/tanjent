"""Groq API wrappers.

The Groq Python SDK is synchronous, so every call is wrapped with
asyncio.to_thread() to avoid blocking the async event loop.
"""

import asyncio
import logging

from groq import Groq

logger = logging.getLogger(__name__)

from app.config import settings

groq_client = Groq(api_key=settings.GROQ_API_KEY)

_TTS_MAX_CHARS = 200

SYSTEM_PROMPT = (
    "You are Tanjent, a voice journaling companion. Your reply will be spoken "
    "aloud, so keep it to one or two short sentences. No lists, no markdown, "
    "no filler phrases like 'great point' or 'thanks for sharing'. Early in a "
    "conversation ask one open question. Later, reflect back patterns you "
    "notice. Typically ask follow-up questions. Match the user's emotional tone. "
    "You are a thoughtful friend, not a therapist."
)

SUMMARY_SYSTEM_PROMPT = (
    "You are a helpful assistant. Your only job is to write a short, "
    "specific summary of a conversation. Do not greet the user or ask questions."
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


def _chat_sync(messages: list[dict], max_tokens: int = 200) -> str:
    completion = groq_client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=messages,
        max_tokens=max_tokens,
        temperature=0.6,
    )
    result = completion.choices[0].message.content or ""
    finish = completion.choices[0].finish_reason
    logger.info("chat finish_reason=%s len=%d content=%r", finish, len(result), result[:120])
    return result


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


async def chat(messages: list[dict], max_tokens: int = 200) -> str:
    return await asyncio.to_thread(_chat_sync, messages, max_tokens)


async def tts(text: str) -> bytes:
    return await asyncio.to_thread(_tts_sync, text)
