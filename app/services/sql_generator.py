import json
from openai import OpenAI

from app.core.config import settings

# Groq provides a free-tier API that is compatible with OpenAI's client
# library — we just point base_url at Groq's servers instead of OpenAI's,
# and use one of Groq's available model names.
client = OpenAI(
    api_key=settings.openai_api_key,
    base_url="https://api.groq.com/openai/v1",
)

MODEL_NAME = "llama-3.3-70b-versatile"


def build_schema_prompt(tables: list[dict]) -> str:
    lines = []
    for table in tables:
        col_list = ", ".join(f"{c['name']} ({c['data_type']})" for c in table["columns"])
        lines.append(f"- {table['table_name']}: {col_list}")
    return "\n".join(lines)


def generate_sql(question: str, tables: list[dict]) -> str:
    schema_text = build_schema_prompt(tables)

    system_prompt = f"""You are a SQL generator for a PostgreSQL database.
Only these tables and columns exist and may be used:

{schema_text}

Rules:
- Generate ONLY a single SELECT (or WITH ... SELECT) query. Never write INSERT, UPDATE, DELETE, DROP, ALTER, or any other statement.
- Only reference the tables and columns listed above.
- Return ONLY the raw SQL query, no explanation, no markdown formatting, no semicolon at the end.
"""

    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ],
        temperature=0,
    )

    sql = response.choices[0].message.content.strip()

    if sql.startswith("```"):
        sql = sql.strip("`")
        if sql.lower().startswith("sql"):
            sql = sql[3:].strip()

    return sql
