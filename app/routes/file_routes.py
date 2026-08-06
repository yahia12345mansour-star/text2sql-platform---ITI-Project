import os
import shutil
import uuid as uuid_lib

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import KnowledgeBase, FileRecord, User
from app.schemas import KnowledgeBaseCreate, KnowledgeBaseResponse, FileResponse
from app.routes.auth_routes import get_current_user
from app.services.document_processor import extract_text
from app.services.chunking_service import chunk_text
from app.services.embedding_service import store_chunks

router = APIRouter(tags=["files"])

UPLOAD_DIR = "uploaded_files"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/api/knowledge-bases", response_model=KnowledgeBaseResponse, status_code=201)
async def create_knowledge_base(
    payload: KnowledgeBaseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    kb = KnowledgeBase(
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        name=payload.name,
        description=payload.description,
    )
    db.add(kb)
    await db.commit()
    await db.refresh(kb)
    return KnowledgeBaseResponse(id=str(kb.id), name=kb.name, description=kb.description)


@router.get("/api/knowledge-bases", response_model=list[KnowledgeBaseResponse])
async def list_knowledge_bases(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.tenant_id == current_user.tenant_id)
    )
    kbs = result.scalars().all()
    return [KnowledgeBaseResponse(id=str(k.id), name=k.name, description=k.description) for k in kbs]


@router.post("/api/knowledge-bases/{kb_id}/files", response_model=FileResponse, status_code=201)
async def upload_file(
    kb_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Confirm the knowledge base belongs to this tenant
    kb_result = await db.execute(
        select(KnowledgeBase).where(
            KnowledgeBase.id == kb_id, KnowledgeBase.tenant_id == current_user.tenant_id
        )
    )
    kb = kb_result.scalar_one_or_none()
    if kb is None:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    extension = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if extension not in ("pdf", "txt", "md", "csv"):
        raise HTTPException(status_code=400, detail=f"Unsupported file type: .{extension}")

    # Save the uploaded file to disk with a unique name so two files
    # named "report.pdf" from different uploads don't overwrite each other.
    stored_name = f"{uuid_lib.uuid4()}.{extension}"
    storage_path = os.path.join(UPLOAD_DIR, stored_name)
    with open(storage_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_record = FileRecord(
        tenant_id=current_user.tenant_id,
        knowledge_base_id=kb.id,
        uploaded_by=current_user.id,
        original_name=file.filename,
        stored_name=stored_name,
        storage_path=storage_path,
        processing_status="processing",
    )
    db.add(file_record)
    await db.commit()
    await db.refresh(file_record)

    try:
        raw_text = extract_text(storage_path, extension)
        chunks = chunk_text(raw_text)

        if not chunks:
            raise ValueError("No text could be extracted from this file")

        store_chunks(
            tenant_id=str(current_user.tenant_id),
            knowledge_base_id=str(kb.id),
            file_id=str(file_record.id),
            chunks=chunks,
        )

        file_record.processing_status = "completed"

    except Exception as e:
        file_record.processing_status = "failed"
        file_record.processing_error = str(e)

    await db.commit()
    await db.refresh(file_record)

    return FileResponse(
        id=str(file_record.id),
        original_name=file_record.original_name,
        processing_status=file_record.processing_status,
        processing_error=file_record.processing_error,
    )
