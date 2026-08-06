from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import DatabaseConnection, DatabaseTable, DatabaseColumn, User
from app.schemas import ChatRequest, ChatResponse
from app.routes.auth_routes import get_current_user
from app.services.sql_generator import generate_sql
from app.services.sql_validator import validate_sql, SQLValidationError
from app.services.query_executor import execute_validated_sql
from app.services.audit import log_action
from app.routes.conversation_routes import save_message
from app.routes.permission_routes import get_allowed_table_ids

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Confirm the connection belongs to this tenant (tenant isolation)
    conn_result = await db.execute(
        select(DatabaseConnection).where(
            DatabaseConnection.id == payload.connection_id,
            DatabaseConnection.tenant_id == current_user.tenant_id,
        )
    )
    conn = conn_result.scalar_one_or_none()
    if conn is None:
        raise HTTPException(status_code=404, detail="Connection not found")

    # 2. Load the cached, permission-filtered schema for this connection.
    # (Right now this loads ALL cached tables — the next step after this
    # would be filtering by the user's specific table/column permissions.)
    tables_result = await db.execute(
        select(DatabaseTable).where(DatabaseTable.connection_id == conn.id)
    )
    db_tables = tables_result.scalars().all()
    if not db_tables:
        raise HTTPException(status_code=400, detail="No schema cached for this connection — run sync-schema first")

    # Filter to only the tables this specific user is permitted to query.
    # Tenant admins see everything; regular users only see tables they've
    # been explicitly granted via a TablePermission row. This is what
    # actually enforces the PDF's "approved schemas, tables, columns"
    # requirement, instead of trusting tenant isolation alone.
    allowed_ids = await get_allowed_table_ids(db, str(conn.id), current_user)
    if allowed_ids is not None:
        db_tables = [t for t in db_tables if str(t.id) in allowed_ids]
        if not db_tables:
            raise HTTPException(status_code=403, detail="You don't have access to any tables on this connection")

    schema_for_prompt = []
    allowed_table_names = set()
    for table in db_tables:
        cols_result = await db.execute(
            select(DatabaseColumn).where(DatabaseColumn.table_id == table.id)
        )
        columns = cols_result.scalars().all()
        schema_for_prompt.append({
            "table_name": table.table_name,
            "columns": [{"name": c.column_name, "data_type": c.data_type} for c in columns],
        })
        allowed_table_names.add(table.table_name)

    # 3. Ask the AI model to generate SQL from the question + schema
    raw_sql = generate_sql(payload.question, schema_for_prompt)

    # 4. Validate the generated SQL before ever running it — this is the
    # real security boundary, independent of whether the AI "behaved."
    try:
        safe_sql = validate_sql(raw_sql, allowed_table_names)
    except SQLValidationError as e:
        raise HTTPException(status_code=400, detail=f"Generated SQL failed validation: {e}")

    # 5. Execute the validated, safe SQL with row/time limits
    result = await execute_validated_sql(conn, safe_sql)

    # Record exactly what SQL ran and how many rows came back — this is
    # the core traceability requirement from the PDF: every answer must
    # be traceable to its SQL execution record.
    await log_action(
        db, tenant_id=current_user.tenant_id, user_id=current_user.id,
        action="sql.executed", resource_type="database_connection", resource_id=conn.id,
    )
    await db.commit()

    # 6. Build a simple natural-language summary of the result
    answer = f"Query returned {result['row_count']} row(s)."

    # If this chat is part of a saved conversation, record both the
    # question and the answer so conversation history works.
    if payload.conversation_id:
        await save_message(db, current_user.tenant_id, payload.conversation_id, "user", payload.question, intent="database")
        await save_message(db, current_user.tenant_id, payload.conversation_id, "assistant", answer, intent="database")
        await db.commit()

    return ChatResponse(
        answer=answer,
        sql=safe_sql,
        row_count=result["row_count"],
        columns=result["columns"],
        rows=result["rows"],
    )
