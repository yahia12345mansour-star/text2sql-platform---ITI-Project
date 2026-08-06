from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text as sql_text

from app.core.encryption import decrypt_value
from app.models import DatabaseConnection

MAX_ROWS = 500
TIMEOUT_SECONDS = 10


async def execute_validated_sql(conn: DatabaseConnection, sql: str) -> dict:
    """
    Runs an already-validated, read-only SQL query against the target
    database, with a row limit and timeout so a runaway or accidental
    huge query can't hang the connection or return unbounded data.
    """
    password = decrypt_value(conn.encrypted_password)
    target_url = (
        f"postgresql+asyncpg://{conn.username}:{password}"
        f"@{conn.host}:{conn.port}/{conn.database_name}"
    )

    # Wrap the query so we never return more than MAX_ROWS, regardless
    # of what the original query would have returned.
    limited_sql = f"SELECT * FROM ({sql}) AS subquery LIMIT {MAX_ROWS}"

    target_engine = create_async_engine(
        target_url,
        connect_args={"command_timeout": TIMEOUT_SECONDS, "server_settings": {"statement_timeout": str(TIMEOUT_SECONDS * 1000)}},
    )

    try:
        async with target_engine.connect() as target_conn:
            result = await target_conn.execute(sql_text(limited_sql))
            columns = list(result.keys())
            rows = [dict(zip(columns, row)) for row in result.fetchall()]
        return {"status": "success", "columns": columns, "rows": rows, "row_count": len(rows)}
    finally:
        await target_engine.dispose()
