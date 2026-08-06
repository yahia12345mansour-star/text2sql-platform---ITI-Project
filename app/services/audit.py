import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


async def log_action(
    db: AsyncSession,
    tenant_id,
    user_id,
    action: str,
    resource_type: str | None = None,
    resource_id=None,
):
    """
    Records one audit event. Called from routes right after something
    meaningful happens (a login, a connection created, a query executed),
    so there's always a trail of who did what.

    This does NOT call db.commit() itself — it's added to the same
    transaction as the action it's logging, so if the main action fails
    and rolls back, we don't end up with a log entry for something that
    didn't actually happen.
    """
    entry = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
    )
    db.add(entry)
