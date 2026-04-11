import base64
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models.message import Message, MessageRole
from app.models.session import Session, SessionStatus
from app.models.user import User
from app.schemas.session import SessionListItem, SessionOut
from app.schemas.turn import TurnResponse
from app.services import groq_service

router = APIRouter()


@router.post("", response_model=SessionOut, status_code=201)
async def create_session(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = Session(user_id=current_user.id)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionOut(
        id=session.id,
        user_id=session.user_id,
        status=session.status,
        summary=session.summary,
        started_at=session.started_at,
        completed_at=session.completed_at,
        messages=[],
    )


@router.get("", response_model=list[SessionListItem])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Session, func.count(Message.id).label("message_count"))
        .outerjoin(Message, Message.session_id == Session.id)
        .where(Session.user_id == current_user.id)
        .group_by(Session.id)
        .order_by(Session.started_at.desc())
    )
    rows = await db.execute(stmt)
    result = []
    for session, count in rows:
        result.append(
            SessionListItem(
                id=session.id,
                status=session.status,
                summary=session.summary,
                started_at=session.started_at,
                completed_at=session.completed_at,
                message_count=count,
            )
        )
    return result


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.messages))
        .where(Session.id == session_id, Session.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/{session_id}/turn", response_model=TurnResponse)
async def turn(
    session_id: uuid.UUID,
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify session ownership and status
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.messages))
        .where(Session.id == session_id, Session.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != SessionStatus.active:
        raise HTTPException(status_code=400, detail="Session is already completed")

    audio_bytes = await audio.read()
    filename = audio.filename or "recording.webm"

    # STT
    transcript = await groq_service.transcribe(audio_bytes, filename)

    # LLM with full conversation history
    history = [
        {"role": msg.role.value, "content": msg.content}
        for msg in session.messages
    ]
    messages_for_llm = (
        [{"role": "system", "content": groq_service.SYSTEM_PROMPT}]
        + history
        + [{"role": "user", "content": transcript}]
    )
    response_text = await groq_service.chat(messages_for_llm)

    # TTS
    audio_wav_bytes = await groq_service.tts(response_text)

    # Persist both messages
    db.add(Message(session_id=session.id, role=MessageRole.user, content=transcript))
    db.add(
        Message(
            session_id=session.id, role=MessageRole.assistant, content=response_text
        )
    )
    await db.commit()

    return TurnResponse(
        transcript=transcript,
        response_text=response_text,
        audio_base64=base64.b64encode(audio_wav_bytes).decode("utf-8"),
        session_id=str(session.id),
    )


@router.post("/{session_id}/complete", response_model=SessionOut)
async def complete_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.messages))
        .where(Session.id == session_id, Session.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != SessionStatus.active:
        raise HTTPException(status_code=400, detail="Session is already completed")

    # Generate summary from conversation
    if session.messages:
        conversation_text = "\n".join(
            f"{msg.role.value.capitalize()}: {msg.content}"
            for msg in session.messages
        )
        summary_messages = [
            {
                "role": "user",
                "content": (
                    "Summarize this journaling session in 2-3 sentences, "
                    "capturing the main themes and emotional tone:\n\n"
                    + conversation_text
                ),
            }
        ]
        summary = await groq_service.chat(summary_messages)
    else:
        summary = "Empty session."

    session.status = SessionStatus.completed
    session.summary = summary
    session.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(session)

    # Reload with messages
    result2 = await db.execute(
        select(Session)
        .options(selectinload(Session.messages))
        .where(Session.id == session.id)
    )
    return result2.scalar_one()


@router.delete("/{session_id}", status_code=204)
async def delete_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Session).where(
            Session.id == session_id, Session.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()
