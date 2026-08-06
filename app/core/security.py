from datetime import datetime, timedelta, timezone

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

# CryptContext handles hashing passwords securely (never store plain text passwords)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: str, tenant_id: str) -> str:
    # A JWT token is a signed piece of text the client stores and sends back
    # with every request. It proves who the user is without needing to
    # look up a session in the database every time.
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,       # "subject" = the user this token belongs to
        "tenant_id": tenant_id,
        "exp": expire,        # expiration time — token stops working after this
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    # Raises an exception automatically if the token is invalid or expired
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[ALGORITHM])
