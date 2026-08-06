# Multi-Tenant Text-to-SQL & Document Chat Platform

A backend platform, built with **FastAPI** and **PostgreSQL**, that lets a user ask a question in plain English and get an answer computed from a real database — without writing SQL themselves. It also supports asking questions about uploaded documents (PDFs, text files), and combining both sources in one answer ("hybrid chat").

Built as a **multi-tenant SaaS**: many separate organizations ("tenants") can use the same running instance, each with their own users, database connections, documents, and audit trail — fully isolated from every other tenant on shared infrastructure.

> This repository contains the **backend only**. The frontend is developed and versioned separately.

---

## Core idea: text-to-SQL with guardrails

The LLM is treated as **untrusted input** — exactly like a form submission from a browser. Every SQL string it produces passes through an independent validation stage before it's ever allowed to touch a real database. That validator doesn't trust the LLM's intentions; it re-parses the SQL from scratch with a real SQL parser and checks it against hard rules.

This shows up as three services working together, called in sequence from `routes/chat_routes.py`:

```
sql_generator  →  sql_validator  →  query_executor
 (asks the LLM)   (re-parses & rejects   (runs only what
                    anything unsafe)       survived validation)
```

The validator rejects, among other things: multiple statements in one query, any non-`SELECT` statement, SQL comments, and any reference to a table the requesting user hasn't been granted access to — checked against a real parsed AST, not string/keyword matching.

---

## Features

- **Ask Your Database** — natural language → validated, read-only SQL, executed against a tenant's own connected database
- **Ask Your Documents** — upload PDFs/text files, ask questions, get answers with citations back to the source chunk (RAG over a vector store)
- **Hybrid Chat** — questions answered from both a database and documents in one response
- **General Chat** — a plain streaming conversation with no data source attached
- **Multi-tenancy** — every tenant-owned table carries a `tenant_id`; every query is scoped to `current_user.tenant_id`
- **Role/table/column-level permissions** — admins grant specific tables (and columns) to specific users
- **Encrypted credentials** — a tenant's target-database password is encrypted with Fernet symmetric encryption before it's ever written to the platform's own database
- **Audit logging** — logins, connections, and queries are recorded, scoped to a tenant's own view
- **Schema discovery & caching** — a tenant's database schema is introspected once via `information_schema` and cached, not rediscovered per question

---

## Tech stack

| Layer | Technology |
|---|---|
| API framework | FastAPI (async), Uvicorn |
| Application database | PostgreSQL + SQLAlchemy (async), Alembic-ready |
| Target-database driver | asyncpg |
| SQL parsing/validation | sqlglot |
| LLM | OpenAI-compatible client, pointed at Groq's API |
| Vector store (RAG) | Qdrant |
| Embeddings | fastembed (local CPU model, `BAAI/bge-small-en-v1.5`) |
| Document parsing | pypdf |
| Auth | JWT (`python-jose`) + `passlib`/bcrypt |
| Secrets at rest | `cryptography` (Fernet) |
| Containerized services | Docker Compose (Postgres w/ pgvector, Qdrant) |

---

## Architecture

The request path: a client calls a **route**, the route calls one or more **services**, and services either talk to **core infrastructure** or reach out to **external systems** (a tenant's target database, the Groq LLM API, or the Qdrant vector store).

```
Client
  │
  ▼
routes/          ← thin: parse request, check permissions, call services, shape response
  │
  ▼
services/        ← business logic: SQL generation/validation/execution, embeddings,
  │                 chunking, document processing, schema discovery, audit
  ▼
core/            ← infrastructure: DB session, config, JWT/password security, encryption
  │
  ▼
models/          ← SQLAlchemy ORM models (the platform's own schema)
```

This layered shape replaced an earlier flat structure where every file sat directly inside `app/` with no separation between routing and business logic. Two dead-code cleanups came out of that restructuring: a duplicate, unused database setup module was removed, and several empty scaffold folders that nothing had ever been placed in were deleted rather than left as clutter.

---

## Project structure

```
.
├── app/
│   ├── main.py                      # FastAPI app instance, router registration, startup
│   │
│   ├── core/                        # Infrastructure — no business logic
│   │   ├── config.py                #   environment-driven settings (Pydantic)
│   │   ├── database.py              #   async engine/session, Base, get_db dependency
│   │   ├── security.py              #   password hashing, JWT issue/decode
│   │   └── encryption.py            #   Fernet encrypt/decrypt for stored credentials
│   │
│   ├── models/
│   │   └── __init__.py              # SQLAlchemy ORM models — tenants, users, connections,
│   │                                 #   conversations, messages, files, permissions, audit_logs...
│   │
│   ├── schemas/
│   │   └── __init__.py              # Pydantic request/response schemas
│   │
│   ├── routes/                      # Thin HTTP layer — one file per resource
│   │   ├── auth_routes.py           #   register / login / me
│   │   ├── connection_routes.py     #   add/test/sync a tenant's target database
│   │   ├── permission_routes.py     #   grant/revoke table access per user
│   │   ├── chat_routes.py           #   Ask Your Database (text-to-SQL)
│   │   ├── document_chat_routes.py  #   Ask Your Documents (RAG)
│   │   ├── hybrid_chat_routes.py    #   both sources combined
│   │   ├── general_chat_routes.py   #   plain LLM chat
│   │   ├── streaming_chat_routes.py #   SSE streaming responses
│   │   ├── file_routes.py           #   upload/list/delete documents
│   │   ├── conversation_routes.py   #   conversation/message history
│   │   └── audit_routes.py          #   tenant-scoped audit log
│   │
│   └── services/                    # Business logic — importable, testable, route-agnostic
│       ├── sql_generator.py         #   question + schema → candidate SQL (LLM call)
│       ├── sql_validator.py         #   re-parses SQL, enforces safety rules before execution
│       ├── query_executor.py        #   runs validated SQL against the tenant's DB (capped, timed out)
│       ├── schema_discovery.py      #   introspects a target DB's tables/columns
│       ├── embedding_service.py     #   text → vectors, Qdrant upsert/search
│       ├── chunking_service.py      #   splits documents into retrievable chunks
│       ├── document_processor.py    #   PDF/text extraction pipeline
│       └── audit.py                 #   writes audit log entries
│
├── schema.sql                       # Platform database schema (run once against Postgres)
├── requirements.txt                 # Python dependencies
├── docker-compose.yml               # Postgres (pgvector) + Qdrant services
├── .env.example                     # Required environment variables (template, no real secrets)
├── .gitignore
└── tests/                           # Test suite
```

---

## Getting started (Windows)

**1. Clone and enter the project**
```
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
```

**2. Create and activate a virtual environment**
```
python -m venv venv
venv\Scripts\activate
```

**3. Install dependencies**
```
pip install -r requirements.txt
```

**4. Configure environment variables**
```
copy .env.example .env
```
Then open `.env` and fill in real values — at minimum `DATABASE_URL`, `JWT_SECRET_KEY`, `ENCRYPTION_KEY`, and `OPENAI_API_KEY` (a Groq API key works, since the client points at Groq's OpenAI-compatible endpoint).

**5. Start Postgres and Qdrant**
```
docker compose up -d
```

**6. Load the database schema**
```
docker exec -i t2sql_postgres psql -U platform_admin -d platform_db < schema.sql
```

**7. Run the API**
```
uvicorn app.main:app --reload
```

**8. Explore the API**

Interactive docs (Swagger UI): `http://127.0.0.1:8000/docs`
Health check: `http://127.0.0.1:8000/api/health`

---

## Security notes

- Target-database credentials are **encrypted at rest** (Fernet) — never stored in plain text, and only decryptable by the running application holding `ENCRYPTION_KEY`.
- Every query the LLM produces is **re-validated independently** — the generator's output is never trusted or executed directly.
- All tenant-scoped tables carry `tenant_id`, and every query filters on it — there is no cross-tenant data path.
- Whoever registers **first** with a given `tenant_code` becomes that tenant's admin; anyone registering with an existing `tenant_code` joins as a regular member.

---

## What's verified working

- Registration, login, and JWT-based auth
- Adding, testing, and syncing a tenant's target database connection
- Text-to-SQL generation, validation, and execution end-to-end
- Document upload, chunking, embedding, and cited retrieval
- Hybrid and general chat modes
- Table/column-level permission enforcement
- Audit log recording per tenant

## What's next

- Alembic-managed migrations (schema is currently applied via a single `schema.sql`)
- Automated test coverage expansion
- Rate limiting and request-id tracing
- Production deployment configuration (SSL, monitoring)
