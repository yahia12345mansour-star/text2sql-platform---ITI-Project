from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError

from app.core.database import get_db
from app.models import User, Tenant
from app.schemas import RegisterRequest, LoginRequest, TokenResponse, UserResponse
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from app.services.audit import log_action

router = APIRouter(prefix="/api/auth", tags=["auth"])

# HTTPBearer gives a simple "paste your token here" box in the Swagger UI,
# instead of a username/password form (which was confusing and didn't match
# our JSON-based login endpoint).
bearer_scheme = HTTPBearer()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tenant).where(Tenant.code == payload.tenant_code))
    tenant = result.scalar_one_or_none()

    # Track whether this tenant already existed BEFORE we act — this is
    # what determines admin status, not just "did we create a Tenant row."
    tenant_is_new = tenant is None

    if tenant is None:
        tenant = Tenant(name=payload.tenant_name, code=payload.tenant_code)
        db.add(tenant)
        await db.flush()

    existing = await db.execute(
        select(User).where(User.tenant_id == tenant.id, User.email == payload.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered for this tenant")

    user = User(
        tenant_id=tenant.id,
        email=payload.email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        # Only the first user of a brand-new tenant becomes admin.
        # Anyone registering into an EXISTING tenant is a regular user.
        is_tenant_admin=tenant_is_new,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        tenant_id=str(user.tenant_id),
        is_tenant_admin=user.is_tenant_admin,
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if user is None or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user_id=str(user.id), tenant_id=str(user.tenant_id))
    await log_action(db, tenant_id=user.tenant_id, user_id=user.id, action="user.login")
    await db.commit()
    return TokenResponse(access_token=token)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        tenant_id=str(current_user.tenant_id),
        is_tenant_admin=current_user.is_tenant_admin,
    )
