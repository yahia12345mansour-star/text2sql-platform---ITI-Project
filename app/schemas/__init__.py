from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    tenant_code: str
    tenant_name: str
    email: EmailStr
    password: str
    full_name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None
    tenant_id: str
    is_tenant_admin: bool


class DatabaseConnectionCreate(BaseModel):
    name: str
    database_type: str  # e.g. "postgresql", "mysql", "sqlserver"
    host: str
    port: int
    database_name: str
    username: str
    password: str


class DatabaseConnectionResponse(BaseModel):
    id: str
    name: str
    database_type: str
    host: str | None
    port: int | None
    database_name: str | None
    username: str | None
    status: str
    last_test_message: str | None
    is_active: bool


class ConnectionTestResponse(BaseModel):
    success: bool
    message: str


class ColumnInfo(BaseModel):
    name: str
    data_type: str
    is_primary_key: bool


class TableInfo(BaseModel):
    id: str
    table_name: str
    columns: list[ColumnInfo]


class SchemaSyncResponse(BaseModel):
    tables_discovered: int
    message: str


class ChatRequest(BaseModel):
    connection_id: str
    question: str
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    answer: str
    sql: str
    row_count: int
    columns: list[str]
    rows: list[dict]


class KnowledgeBaseCreate(BaseModel):
    name: str
    description: str | None = None


class KnowledgeBaseResponse(BaseModel):
    id: str
    name: str
    description: str | None


class FileResponse(BaseModel):
    id: str
    original_name: str
    processing_status: str
    processing_error: str | None


class AuditLogResponse(BaseModel):
    id: str
    user_id: str | None
    action: str
    resource_type: str | None
    resource_id: str | None
    created_at: str


class ConversationCreate(BaseModel):
    title: str | None = None


class ConversationResponse(BaseModel):
    id: str
    title: str | None
    status: str


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    detected_intent: str | None


class GrantPermissionRequest(BaseModel):
    user_id: str
    table_id: str
    can_read: bool = True


class TablePermissionResponse(BaseModel):
    id: str
    user_id: str | None
    table_id: str
    can_read: bool
