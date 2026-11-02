import io
import zipfile
from pathlib import Path
from xml.etree import ElementTree
from pypdf import PdfReader
from app.config import get_settings

settings = get_settings()
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md", ".csv"}
MAX_FILE_BYTES = 50 * 1024 * 1024


def extract_text_from_pdf(file_content: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_content))
    return "\n\n".join(text for page in reader.pages if (text := page.extract_text()))


def extract_text(file_content: bytes, filename: str) -> str:
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise ValueError("Unsupported format. Use PDF, DOCX, TXT, MD, or CSV.")
    if extension == ".pdf":
        return extract_text_from_pdf(file_content)
    if extension == ".docx":
        with zipfile.ZipFile(io.BytesIO(file_content)) as archive:
            info = archive.getinfo("word/document.xml")
            if info.file_size > MAX_FILE_BYTES:
                raise ValueError("The expanded Word document exceeds 50 MB.")
            xml = archive.read(info)
            if b"<!DOCTYPE" in xml or b"<!ENTITY" in xml:
                raise ValueError("Unsupported XML declarations in Word document.")
            root = ElementTree.fromstring(xml)
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        return "\n".join("".join(p.itertext()) for p in root.findall(".//w:p", ns))
    try:
        return file_content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("Save this text file with UTF-8 encoding and upload it again.") from exc


def chunk_text(text: str, chunk_size: int = None, chunk_overlap: int = None) -> list[str]:
    size = settings.CHUNK_SIZE if chunk_size is None else chunk_size
    overlap = settings.CHUNK_OVERLAP if chunk_overlap is None else chunk_overlap
    if size <= 0 or overlap < 0 or overlap >= size:
        raise ValueError("Chunk size must be positive and overlap must be smaller than size.")
    words = text.split()
    chunks = []
    for start in range(0, len(words), size - overlap):
        chunks.append(" ".join(words[start:start + size]))
        if start + size >= len(words):
            break
    return chunks
