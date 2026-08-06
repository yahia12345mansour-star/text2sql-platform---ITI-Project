from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy import text as sql_text

from app.core.database import get_db
from app.models import DatabaseConnection, User, DatabaseTable, DatabaseColumn
from app.schemas import (
    DatabaseConnectionCreate, DatabaseConnectionResponse, ConnectionTestResponse,
    SchemaSyncResponse, TableInfo, ColumnInfo,
)
from app.core.encryption import encrypt_value, decrypt_value
from app.routes.auth_routes import get_current_user
from app.services.schema_discovery import discover_schema
from app.services.audit import log_action

router = APIRouter(prefix="/api/database-connections", tags=["database-connections"])


def _to_response(conn: DatabaseConnection) -> DatabaseConnectionResponse:
    return DatabaseConnectionResponse(
        id=str(conn.id),
        name=conn.name,
        database_type=conn.database_type,
        host=conn.host,
        port=conn.port,
        database_name=conn.database_name,
        username=conn.username,
        status=conn.status,
        last_test_message=conn.last_test_message,
        is_active=conn.is_active,
    )


@router.post("", response_model=DatabaseConnectionResponse, status_code=201)
async def create_connection(
    payload: DatabaseConnectionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only tenant admins may add new database connections — this enforces
    # the "tenant administrator submits connection details" rule from the PDF.
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Only tenant admins can create database connections")

    conn = DatabaseConnection(
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        name=payload.name,
        database_type=payload.database_type,
        host=payload.host,
        port=payload.port,
        database_name=payload.database_name,
        username=payload.username,
        # The password is encrypted before it ever touches the database —
        # even someone with direct DB access can't read it as plain text.
        encrypted_password=encrypt_value(payload.password),
        status="pending",
    )
    db.add(conn)
    await db.commit()
    await db.refresh(conn)
    await log_action(
        db, tenant_id=current_user.tenant_id, user_id=current_user.id,
        action="connection.created", resource_type="database_connection", resource_id=conn.id,
    )
    await db.commit()
    return _to_response(conn)


@router.get("", response_model=list[DatabaseConnectionResponse])
async def list_connections(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Tenant isolation: a user only ever sees connections belonging to
    # their own tenant, never another tenant's data.
    result = await db.execute(
        select(DatabaseConnection).where(DatabaseConnection.tenant_id == current_user.tenant_id)
    )
    connections = result.scalars().all()
    return [_to_response(c) for c in connections]


@router.post("/{connection_id}/test", response_model=ConnectionTestResponse)
async def test_connection(
    connection_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DatabaseConnection).where(
            DatabaseConnection.id == connection_id,
            DatabaseConnection.tenant_id == current_user.tenant_id,
        )
    )
    conn = result.scalar_one_or_none()
    if conn is None:
        raise HTTPException(status_code=404, detail="Connection not found")

    password = decrypt_value(conn.encrypted_password)

    # Only PostgreSQL is wired up for now — other database types
    # (mysql, sqlserver, oracle) would each need their own driver/URL format.
    if conn.database_type != "postgresql":
        raise HTTPException(status_code=400, detail=f"Testing '{conn.database_type}' is not implemented yet")

    test_url = (
        f"postgresql+asyncpg://{conn.username}:{password}"
        f"@{conn.host}:{conn.port}/{conn.database_name}"
    )

    try:
        test_engine = create_async_engine(test_url)
        async with test_engine.connect() as test_conn:
            await test_conn.execute(sql_text("SELECT 1"))
        await test_engine.dispose()

        conn.status = "active"
        conn.last_test_message = "Connection successful"
        await db.commit()
        return ConnectionTestResponse(success=True, message="Connection successful")

    except Exception as e:
        # Log the REAL reason to the server console — the message we send
        # back to the client stays generic (never leak credentials or raw
        # driver internals to the browser), but without this print there
        # was no way for anyone, including us, to see why a test failed.
        print(f"[connection test failed] connection_id={connection_id} error={e!r}")
        conn.status = "failed"
        conn.last_test_message = "Connection failed: unable to reach database with provided credentials"
        await db.commit()
        return ConnectionTestResponse(success=False, message=conn.last_test_message)


@router.post("/{connection_id}/sync-schema", response_model=SchemaSyncResponse)
async def sync_schema(
    connection_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DatabaseConnection).where(
            DatabaseConnection.id == connection_id,
            DatabaseConnection.tenant_id == current_user.tenant_id,
        )
    )
    conn = result.scalar_one_or_none()
    if conn is None:
        raise HTTPException(status_code=404, detail="Connection not found")

    discovered = await discover_schema(conn)

    # Wipe any previously cached schema for this connection before
    # re-saving, so re-syncing doesn't create duplicate/stale entries.
    old_tables = await db.execute(
        select(DatabaseTable).where(DatabaseTable.connection_id == conn.id)
    )
    for old_table in old_tables.scalars().all():
        await db.delete(old_table)
    await db.flush()

    for table_data in discovered:
        db_table = DatabaseTable(
            tenant_id=conn.tenant_id,
            connection_id=conn.id,
            table_name=table_data["table_name"],
        )
        db.add(db_table)
        await db.flush()  # generates db_table.id before adding columns

        for col in table_data["columns"]:
            db.add(DatabaseColumn(
                tenant_id=conn.tenant_id,
                table_id=db_table.id,
                column_name=col["name"],
                data_type=col["data_type"],
                is_primary_key=col["is_primary_key"],
            ))

    conn.schema_sync_status = "synced"
    await db.commit()

    return SchemaSyncResponse(
        tables_discovered=len(discovered),
        message=f"Discovered and cached {len(discovered)} tables",
    )


@router.get("/{connection_id}/tables", response_model=list[TableInfo])
async def list_tables(
    connection_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Confirm the connection belongs to this tenant before showing anything
    conn_result = await db.execute(
        select(DatabaseConnection).where(
            DatabaseConnection.id == connection_id,
            DatabaseConnection.tenant_id == current_user.tenant_id,
        )
    )
    if conn_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Connection not found")

    tables_result = await db.execute(
        select(DatabaseTable).where(DatabaseTable.connection_id == connection_id)
    )
    tables = tables_result.scalars().all()

    response = []
    for table in tables:
        cols_result = await db.execute(
            select(DatabaseColumn).where(DatabaseColumn.table_id == table.id)
        )
        columns = cols_result.scalars().all()
        response.append(TableInfo(
            id=str(table.id),
            table_name=table.table_name,
            columns=[
                ColumnInfo(name=c.column_name, data_type=c.data_type, is_primary_key=c.is_primary_key)
                for c in columns
            ],
        ))
    return response
