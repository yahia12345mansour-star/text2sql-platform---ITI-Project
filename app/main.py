from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.routes.auth_routes import router as auth_router
from app.routes.connection_routes import router as connection_router
from app.routes.chat_routes import router as chat_router
from app.routes.file_routes import router as file_router
from app.routes.document_chat_routes import router as document_chat_router
from app.routes.general_chat_routes import router as general_chat_router
from app.routes.audit_routes import router as audit_router
from app.routes.conversation_routes import router as conversation_router
from app.routes.permission_routes import router as permission_router
from app.routes.hybrid_chat_routes import router as hybrid_chat_router
from app.routes.streaming_chat_routes import router as streaming_chat_router

app = FastAPI(title="Text-to-SQL Platform")

# Without this, a browser blocks every request from your frontend (a
# different origin than the API) as a security measure — this shows up
# as "CORS policy" or "Failed to fetch" errors in the browser console,
# even though the backend itself is working fine.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for local development only — restrict this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(connection_router)
app.include_router(chat_router)
app.include_router(file_router)
app.include_router(document_chat_router)
app.include_router(general_chat_router)
app.include_router(audit_router)
app.include_router(conversation_router)
app.include_router(permission_router)
app.include_router(hybrid_chat_router)
app.include_router(streaming_chat_router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "API is running"}


@app.get("/")
def root():
    return {"message": "Welcome to the Text-to-SQL Platform API"}


@app.get("/api/db-check")
async def db_check(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT 1"))
    value = result.scalar()
    return {"database_connected": value == 1}
