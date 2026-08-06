from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.models import User
from app.routes.auth_routes import get_current_user
from app.services.sql_generator import client, MODEL_NAME

router = APIRouter(prefix="/api/chat", tags=["streaming-chat"])


class StreamChatRequest(BaseModel):
    message: str


def _sse_format(data: str) -> str:
    # Server-Sent Events requires each chunk to be prefixed with "data: "
    # and end with two newlines — this is the protocol the browser's
    # EventSource API (or any SSE client) expects.
    return f"data: {data}\n\n"


@router.post("/stream")
async def stream_chat(
    payload: StreamChatRequest,
    current_user: User = Depends(get_current_user),
):
    def token_generator():
        # stream=True makes the AI provider send the reply piece by piece
        # as it's generated, instead of waiting for the entire message.
        stream = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": "You are a friendly, helpful assistant."},
                {"role": "user", "content": payload.message},
            ],
            temperature=0.7,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield _sse_format(delta)
        yield _sse_format("[DONE]")

    return StreamingResponse(token_generator(), media_type="text/event-stream")
