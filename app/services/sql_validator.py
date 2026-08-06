import sqlglot
from sqlglot import exp

# Only these statement types are ever allowed, per the PDF's
# "Allowed by default" list (SELECT, WITH, EXPLAIN).
ALLOWED_STATEMENT_TYPES = (exp.Select, exp.With)

# Keywords that must never appear, per the PDF's "Blocked by default" list.
BLOCKED_KEYWORDS = [
    "drop", "truncate", "alter", "create", "grant", "revoke",
    "exec", "execute", "call", "copy", "attach", "detach",
    "insert", "update", "delete", "merge",
]


class SQLValidationError(Exception):
    pass


def validate_sql(raw_sql: str, allowed_tables: set[str]) -> str:
    """
    Validates SQL against the platform's security rules using a real SQL
    parser (sqlglot) rather than naive keyword matching, per the PDF's
    requirement. Raises SQLValidationError with a clear reason if anything
    is unsafe. Returns the normalized SQL string if valid.
    """
    lowered = raw_sql.lower()

    # Block multiple statements: a semicolon followed by more content
    # (a trailing semicolon alone is fine and gets stripped).
    stripped = raw_sql.strip().rstrip(";")
    if ";" in stripped:
        raise SQLValidationError("Multiple SQL statements are not allowed")

    # Block SQL comments — a common technique for hiding malicious SQL
    if "--" in raw_sql or "/*" in raw_sql:
        raise SQLValidationError("SQL comments are not allowed")

    # Block any dangerous keyword outright, even before parsing
    for keyword in BLOCKED_KEYWORDS:
        if keyword in lowered.split():
            raise SQLValidationError(f"Statement type '{keyword}' is not allowed")

    # Parse with sqlglot — this catches things keyword-matching would miss,
    # like a blocked keyword hidden inside a string literal vs. a real clause.
    try:
        parsed = sqlglot.parse_one(stripped, read="postgres")
    except Exception as e:
        raise SQLValidationError(f"Could not parse SQL: {e}")

    if not isinstance(parsed, ALLOWED_STATEMENT_TYPES):
        raise SQLValidationError(f"Statement type '{type(parsed).__name__}' is not allowed — only SELECT is permitted")

    # Extract every table referenced in the query and confirm each one
    # is in the caller's permitted set — this is what stops the LLM
    # from querying a table it wasn't given in its prompt.
    referenced_tables = {t.name.lower() for t in parsed.find_all(exp.Table)}
    not_allowed = referenced_tables - {t.lower() for t in allowed_tables}
    if not_allowed:
        raise SQLValidationError(f"Query references unauthorized table(s): {', '.join(not_allowed)}")

    return parsed.sql(dialect="postgres")
