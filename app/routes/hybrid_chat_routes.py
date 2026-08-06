from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import DatabaseConnection, DatabaseTable, DatabaseColumn, User
from app.routes.auth_routes import get_current_user
from app.routes.permission_routes import get_allowed_table_ids
from app.services.sql_generator import generate_sql, client, MODEL_NAME
from app.services.sql_validator import validate_sql, SQLValidationError
from app.services.query_executor import execute_validated_sql
from app.services.embedding_service import search_chunks

router = APIRouter(prefix="/api/hybrid-chat", tags=["hybrid-chat"])


class HybridChatRequest(BaseModel):
    connection_id: str
    knowledge_base_id: str
    question: str


class HybridChatResponse(BaseModel):
    answer: str
    sql: str | None
    sql_row_count: int | None
    document_citations: list[dict]


@router.post("", response_model=HybridChatResponse)
async def hybrid_chat(
    payload: HybridChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conn_result = await db.execute(
        select(DatabaseConnection).where(
            DatabaseConnection.id == payload.connection_id,
            DatabaseConnection.tenant_id == current_user.tenant_id,
        )
    )
    conn = conn_result.scalar_one_or_none()
    if conn is None:
        raise HTTPException(status_code=404, detail="Connection not found")

    tables_result = await db.execute(
        select(DatabaseTable).where(DatabaseTable.connection_id == conn.id)
    )
    db_tables = tables_result.scalars().all()

    allowed_ids = await get_allowed_table_ids(db, str(conn.id), current_user)
    if allowed_ids is not None:
        db_tables = [t for t in db_tables if str(t.id) in allowed_ids]

    sql_result = None
    safe_sql = None
    sql_row_count = None

    if db_tables:
        schema_for_prompt = []
        allowed_table_names = set()
        for table in db_tables:
            cols_result = await db.execute(select(DatabaseColumn).where(DatabaseColumn.table_id == table.id))
            columns = cols_result.scalars().all()
            schema_for_prompt.append({
                "table_name": table.table_name,
                "columns": [{"name": c.column_name, "data_type": c.data_type} for c in columns],
            })
            allowed_table_names.add(table.table_name)

        try:
            # Ask the AI to generate SQL for only the DATABASE-relevant
            # part of the question — otherwise it tries to force document
            # concepts (like "the uploaded file") into a SQL query, which
            # produces broken SQL. The document-related part is answered
            # separately below, using the retrieved excerpts.
            sql_focused_question = (
                f"{payload.question}\n\n"
                "(Only generate SQL for the parts of this question that can be "
                "answered from the database tables. Ignore anything about documents or files.)"
            )
            raw_sql = generate_sql(sql_focused_question, schema_for_prompt)
            safe_sql = validate_sql(raw_sql, allowed_table_names)
            sql_result = await execute_validated_sql(conn, safe_sql)
            sql_row_count = sql_result["row_count"]
        except SQLValidationError:
            # The generated SQL failed our safety rules — skip the
            # database side and fall back to document evidence only.
            sql_result = None
            safe_sql = None
        except Exception:
            # The SQL was "valid" per our rules but Postgres itself
            # rejected it (bad syntax, wrong aggregation, etc.) — this
            # can happen when the AI tries to force one query to answer
            # a question that really needs two separate sources. Rather
            # than crash the whole hybrid answer, fall back gracefully.
            sql_result = None
            safe_sql = None

    doc_results = search_chunks(
        tenant_id=str(current_user.tenant_id),
        knowledge_base_id=payload.knowledge_base_id,
        query=payload.question,
        top_k=5,
    )

    if sql_result is None and not doc_results:
        raise HTTPException(status_code=404, detail="No database or document evidence found for this question")

    evidence_parts = []
    if sql_result is not None:
        evidence_parts.append(f"DATABASE RESULT (from SQL: {safe_sql}):\n{sql_result['rows']}")
    if doc_results:
        doc_text = "\n\n".join(f"[Excerpt {i+1}]\n{r['content']}" for i, r in enumerate(doc_results))
        evidence_parts.append(f"DOCUMENT EXCERPTS:\n{doc_text}")

    combined_evidence = "\n\n---\n\n".join(evidence_parts)

    system_prompt = """You answer questions using ONLY the evidence provided below, which may include
a database query result and/or document excerpts. Compare or combine both sources explicitly
when both are present. If the evidence is insufficient, say so."""

    user_prompt = f"Evidence:\n{combined_evidence}\n\nQuestion: {payload.question}"

    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0,
    )
    answer = response.choices[0].message.content.strip()

    return HybridChatResponse(
        answer=answer,
        sql=safe_sql,
        sql_row_count=sql_row_count,
        document_citations=[
            {"file_id": r["file_id"], "chunk_index": r["chunk_index"], "score": r["score"]}
            for r in doc_results
        ],
    )
