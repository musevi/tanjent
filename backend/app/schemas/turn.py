from pydantic import BaseModel


class TurnResponse(BaseModel):
    transcript: str
    response_text: str
    audio_base64: str  # WAV bytes encoded as base64
    session_id: str
