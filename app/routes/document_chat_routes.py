from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.models import User
from app.routes.auth_routes import get_current_user
from app.services.embedding_service import search_chunks
from app.services.sql_generator import client, MODEL_NAME  # reuse the same Groq client

router = APIRouter(prefix="/api/document-chat", tags=["document-chat"])


class DocumentChatRequest(BaseModel):
    knowledge_base_id: str
    question: str


class Citation(BaseModel):
    file_id: str
    chunk_index: int
    score: float


class DocumentChatResponse(BaseModel):
    answer: str
    citations: list[Citation]


@router.post("", response_model=DocumentChatResponse)
async def document_chat(
    payload: DocumentChatRequest,
    current_user: User = Depends(get_current_user),
):
    results = search_chunks(
        tenant_id=str(current_user.tenant_id),
        knowledge_base_id=payload.knowledge_base_id,
        query=payload.question,
        top_k=5,
    )

    if not results:
        raise HTTPException(status_code=404, detail="No relevant content found — has a file been uploaded and processed?")

    context_text = "\n\n".join(
        f"[Excerpt {i+1}]\n{r['content']}" for i, r in enumerate(results)
    )

    system_prompt = """You answer questions using ONLY the excerpts provided below.
If the excerpts don't contain enough information to answer, say so clearly.
Do not use any outside knowledge."""

    user_prompt = f"Excerpts:\n{context_text}\n\nQuestion: {payload.question}"

    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0,
    )

    answer = response.choices[0].message.content.strip()

    citations = [
        Citation(file_id=r["file_id"], chunk_index=r["chunk_index"], score=r["score"])
        for r in results
    ]

    return DocumentChatResponse(answer=answer, citations=citations)
