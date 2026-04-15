import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models.session import SessionStatus
from app.schemas.message import MessageOut


class SessionOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    status: SessionStatus
    summary: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]
    messages: List[MessageOut] = []

    model_config = {"from_attributes": True}


class SessionListItem(BaseModel):
    id: uuid.UUID
    status: SessionStatus
    summary: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]
    message_count: int = 0


class SearchResultItem(SessionListItem):
    relevance: float = 0.0
