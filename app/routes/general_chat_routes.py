from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.models import User
from app.routes.auth_routes import get_current_user
from app.services.sql_generator import client, MODEL_NAME  # reuse the same Groq client

router = APIRouter(prefix="/api/general-chat", tags=["general-chat"])


class GeneralChatRequest(BaseModel):
    message: str


class GeneralChatResponse(BaseModel):
    reply: str


@router.post("", response_model=GeneralChatResponse)
async def general_chat(
    payload: GeneralChatRequest,
    current_user: User = Depends(get_current_user),
):
    # No database, no documents — just a normal conversational reply.
    # This matches the "general" intent from the PDF's classifier list.
    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": "You are a friendly, helpful assistant. Keep replies short."},
            {"role": "user", "content": payload.message},
        ],
        temperature=0.7,
    )

    reply = response.choices[0].message.content.strip()
    return GeneralChatResponse(reply=reply)
