import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.message import MessageRole


class MessageOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    role: MessageRole
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}
