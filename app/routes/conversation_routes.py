from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Conversation, Message, User
from app.schemas import ConversationCreate, ConversationResponse, MessageResponse
from app.routes.auth_routes import get_current_user

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.post("", response_model=ConversationResponse, status_code=201)
async def create_conversation(
    payload: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = Conversation(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        title=payload.title,
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return ConversationResponse(id=str(conv.id), title=conv.title, status=conv.status)


@router.get("", response_model=list[ConversationResponse])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # A user only ever sees their OWN conversations, not other users'
    # in the same tenant — conversations are personal, unlike connections.
    result = await db.execute(
        select(Conversation).where(Conversation.user_id == current_user.id)
    )
    convs = result.scalars().all()
    return [ConversationResponse(id=str(c.id), title=c.title, status=c.status) for c in convs]


@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv_result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id, Conversation.user_id == current_user.id
        )
    )
    if conv_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    result = await db.execute(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at)
    )
    messages = result.scalars().all()
    return [
        MessageResponse(id=str(m.id), role=m.role, content=m.content, detected_intent=m.detected_intent)
        for m in messages
    ]


async def save_message(db: AsyncSession, tenant_id, conversation_id, role: str, content: str, intent: str | None = None):
    """
    Small shared helper other route files (chat, document-chat, general-chat)
    call to save each question/answer pair into conversation history.
    """
    msg = Message(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        role=role,
        content=content,
        detected_intent=intent,
    )
    db.add(msg)
