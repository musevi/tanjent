import asyncio

from openai import OpenAI

from app.config import settings

_client = OpenAI(api_key=settings.OPENAI_API_KEY)

MODEL = "text-embedding-3-small"
DIMENSIONS = 1536


def _embed_sync(text: str) -> list[float]:
    response = _client.embeddings.create(input=text, model=MODEL)
    return response.data[0].embedding


async def embed(text: str) -> list[float]:
    """Return a 1536-dim embedding vector for the given text."""
    return await asyncio.to_thread(_embed_sync, text)
