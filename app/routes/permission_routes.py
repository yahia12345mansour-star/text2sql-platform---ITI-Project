from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import TablePermission, DatabaseConnection, DatabaseTable, User
from app.schemas import GrantPermissionRequest, TablePermissionResponse
from app.routes.auth_routes import get_current_user

router = APIRouter(prefix="/api/database-connections", tags=["permissions"])


@router.post("/{connection_id}/permissions", response_model=TablePermissionResponse, status_code=201)
async def grant_table_permission(
    connection_id: str,
    payload: GrantPermissionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only tenant admins may grant access to other users
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Only tenant admins can grant table permissions")

    # Confirm the connection and table both belong to this tenant
    conn_result = await db.execute(
        select(DatabaseConnection).where(
            DatabaseConnection.id == connection_id, DatabaseConnection.tenant_id == current_user.tenant_id
        )
    )
    if conn_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Connection not found")

    table_result = await db.execute(
        select(DatabaseTable).where(
            DatabaseTable.id == payload.table_id, DatabaseTable.tenant_id == current_user.tenant_id
        )
    )
    if table_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Table not found")

    grant = TablePermission(
        tenant_id=current_user.tenant_id,
        user_id=payload.user_id,
        connection_id=connection_id,
        table_id=payload.table_id,
        can_read=payload.can_read,
    )
    db.add(grant)
    await db.commit()
    await db.refresh(grant)

    return TablePermissionResponse(
        id=str(grant.id), user_id=str(grant.user_id), table_id=str(grant.table_id), can_read=grant.can_read
    )


@router.get("/{connection_id}/permissions", response_model=list[TablePermissionResponse])
async def list_table_permissions(
    connection_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Only tenant admins can view table permissions")

    result = await db.execute(
        select(TablePermission).where(TablePermission.connection_id == connection_id)
    )
    grants = result.scalars().all()
    return [
        TablePermissionResponse(
            id=str(g.id), user_id=str(g.user_id) if g.user_id else None, table_id=str(g.table_id), can_read=g.can_read
        )
        for g in grants
    ]


async def get_allowed_table_ids(db: AsyncSession, connection_id: str, current_user: User) -> set[str] | None:
    """
    Returns the set of table IDs this user is allowed to query for a
    given connection. Returns None to mean "no restriction" (tenant
    admins can see everything). Non-admins only see tables they've
    been explicitly granted via a TablePermission row.
    """
    if current_user.is_tenant_admin:
        return None  # no restriction

    result = await db.execute(
        select(TablePermission.table_id).where(
            TablePermission.connection_id == connection_id,
            TablePermission.user_id == current_user.id,
            TablePermission.can_read == True,  # noqa: E712
        )
    )
    return {str(row[0]) for row in result.all()}
