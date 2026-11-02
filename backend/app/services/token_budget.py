"""Bound model inputs before sending them to the answer provider."""
from functools import lru_cache
import logging
import os
import tempfile
import hashlib
from pathlib import Path
import tiktoken
from app.config import get_settings


@lru_cache(maxsize=1)
def get_encoding():
    if "gpt-oss" not in get_settings().LLM_MODEL:
        return None
    url = "https://openaipublic.blob.core.windows.net/encodings/o200k_base.tiktoken"
    directory = os.getenv("TIKTOKEN_CACHE_DIR", os.getenv("DATA_GYM_CACHE_DIR", str(Path(tempfile.gettempdir()) / "data-gym-cache")))
    cache = Path(directory) / hashlib.sha1(url.encode()).hexdigest()
    if not directory or not cache.is_file():
        # Chat requests must never depend on a vocabulary download.
        return None
    expected = "446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d"
    if hashlib.sha256(cache.read_bytes()).hexdigest() != expected:
        return None
    try:
        return tiktoken.get_encoding("o200k_base")
    except Exception:
        # Keep offline deployments usable. UTF-8 bytes are a conservative upper
        # bound for byte-pair token counts when a vocabulary isn't cached.
        logging.warning("Tokenizer vocabulary unavailable; using conservative byte budgets")
        return None


def count_tokens(text: str) -> int:
    encoding = get_encoding()
    return len(encoding.encode(text, disallowed_special=())) if encoding else len(text.encode("utf-8"))


def trim_tokens(text: str, limit: int) -> str:
    if limit <= 0:
        return ""
    encoding = get_encoding()
    if encoding:
        tokens = encoding.encode(text, disallowed_special=())
        return encoding.decode(tokens[:limit], errors="ignore") if len(tokens) > limit else text
    return text.encode("utf-8")[:limit].decode("utf-8", errors="ignore")


def memory_excerpt(text: str, limit: int) -> str:
    """Keep the beginning and conclusion when a long turn must be shortened."""
    if count_tokens(text) <= limit:
        return text
    separator = "\n…\n"
    remaining = max(0, limit - count_tokens(separator))
    if remaining < 12:
        return trim_tokens(text, limit)
    head, tail = remaining * 2 // 3, remaining - remaining * 2 // 3
    encoding = get_encoding()
    ending = encoding.decode(encoding.encode(text, disallowed_special=())[-tail:], errors="ignore") if encoding else text.encode("utf-8")[-tail:].decode("utf-8", errors="ignore")
    return trim_tokens(trim_tokens(text, head) + separator + ending, limit)


def recent_history(history: list[dict], limit: int = 800) -> str:
    """Give the latest question/answer more space while retaining earlier turns."""
    selected = [m for m in history if m.get("role") in {"user", "assistant"}
                and isinstance(m.get("content"), str) and m["content"].strip()][-12:]
    if not selected or limit <= 0:
        return ""
    labels = sum(count_tokens(f"{m['role']}: \n") for m in selected)
    available = max(0, limit - labels - 12)
    weights = [3 if index >= len(selected) - 2 else 1 for index in range(len(selected))]
    total = sum(weights)
    return trim_tokens("\n".join(f"{m['role']}: {memory_excerpt(m['content'], available * weight // total)}"
                                  for m, weight in zip(selected, weights)), limit)
