from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text as sql_text

from app.core.encryption import decrypt_value
from app.models import DatabaseConnection


async def discover_schema(conn: DatabaseConnection) -> list[dict]:
    """
    Connects to the TARGET database (the tenant's own live database, not
    our application database) and reads its table and column structure
    using Postgres's built-in information_schema — a set of read-only
    views every Postgres database exposes describing its own structure.

    Returns a list of dicts like:
    [{"table_name": "customers", "columns": [{"name": "id", "data_type": "uuid", "is_primary_key": True}, ...]}]
    """
    password = decrypt_value(conn.encrypted_password)
    target_url = (
        f"postgresql+asyncpg://{conn.username}:{password}"
        f"@{conn.host}:{conn.port}/{conn.database_name}"
    )

    target_engine = create_async_engine(target_url)
    tables: dict[str, list[dict]] = {}

    async with target_engine.connect() as target_conn:
        # information_schema.columns lists every column of every table
        # in the "public" schema, along with its data type and position.
        result = await target_conn.execute(sql_text("""
            SELECT table_name, column_name, data_type, ordinal_position
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position
        """))
        rows = result.fetchall()

        # Separately, find which columns are primary keys
        pk_result = await target_conn.execute(sql_text("""
            SELECT tc.table_name, kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
        """))
        primary_keys = {(r.table_name, r.column_name) for r in pk_result.fetchall()}

        for row in rows:
            tables.setdefault(row.table_name, []).append({
                "name": row.column_name,
                "data_type": row.data_type,
                "is_primary_key": (row.table_name, row.column_name) in primary_keys,
            })

    await target_engine.dispose()

    return [{"table_name": name, "columns": cols} for name, cols in tables.items()]
