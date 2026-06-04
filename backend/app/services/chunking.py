import io
from pypdf import PdfReader
from app.config import get_settings

settings = get_settings()


def extract_text_from_pdf(file_content: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_content))
    text_parts = []
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text_parts.append(page_text)
    return "\n\n".join(text_parts)


def extract_text(file_content: bytes, filename: str) -> str:
    if filename.lower().endswith(".pdf"):
        return extract_text_from_pdf(file_content)
    try:
        return file_content.decode("utf-8")
    except UnicodeDecodeError:
        return file_content.decode("latin-1")


def chunk_text(text: str, chunk_size: int = None, chunk_overlap: int = None) -> list[str]:
    chunk_size = chunk_size or settings.CHUNK_SIZE
    chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP

    words = text.split()
    chunks = []
    current_chunk = []
    current_len = 0

    for word in words:
        current_chunk.append(word)
        current_len += 1

        if current_len >= chunk_size:
            chunks.append(" ".join(current_chunk))
            overlap_words = current_chunk[-chunk_overlap:]
            current_chunk = overlap_words
            current_len = len(overlap_words)

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks
