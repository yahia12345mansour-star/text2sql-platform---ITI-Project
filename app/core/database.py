from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# The "engine" is the object that actually knows how to talk to Postgres
# over the network using the connection string from .env.
engine = create_async_engine(settings.database_url, echo=True)

# A "session" is a temporary workspace for talking to the database
# (running queries, adding/updating rows) within a single request.
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


# Base class that all SQLAlchemy models (Tenant, User, etc.) inherit from.
# This lets SQLAlchemy know which Python classes map to which database tables.
class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
