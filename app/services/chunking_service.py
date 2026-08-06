def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> list[str]:
    """
    Splits a long piece of text into smaller overlapping chunks.
    Chunking matters because embedding models work best on short passages,
    and later we want to cite the SPECIFIC passage an answer came from,
    not an entire document.

    chunk_size and overlap are measured in characters here (simple and
    predictable). Overlap means each chunk shares a bit of text with the
    next one, so we don't accidentally cut a sentence in half and lose
    its meaning at a chunk boundary.
    """
    text = text.strip()
    if not text:
        return []

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += chunk_size - overlap

    return chunks
