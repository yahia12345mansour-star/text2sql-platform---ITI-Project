from pypdf import PdfReader


def extract_text(file_path: str, extension: str) -> str:
    """
    Reads a file from disk and returns its plain text content.
    Different file types need different extraction logic — a PDF's text
    is stored very differently from a plain .txt file internally.
    """
    extension = extension.lower()

    if extension == "pdf":
        reader = PdfReader(file_path)
        pages_text = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages_text)

    elif extension in ("txt", "md", "csv"):
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()

    else:
        raise ValueError(f"Unsupported file type: .{extension}")
