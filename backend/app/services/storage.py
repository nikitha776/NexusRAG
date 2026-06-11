import os
import logging
import asyncio

logger = logging.getLogger(__name__)

LOCAL_STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(LOCAL_STORAGE_DIR, exist_ok=True)


def _write_file(file_path: str, content: bytes):
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(content)


def _read_file(file_path: str) -> bytes:
    with open(file_path, "rb") as f:
        return f.read()


def _delete_file(file_path: str):
    if os.path.exists(file_path):
        os.remove(file_path)


async def upload_file_to_s3(key: str, content: bytes, content_type: str) -> str:
    file_path = os.path.join(LOCAL_STORAGE_DIR, key.replace("/", os.sep))
    await asyncio.to_thread(_write_file, file_path, content)
    logger.info(f"Saved file locally: {file_path} ({len(content)} bytes)")
    return key


async def delete_file_from_s3(key: str):
    file_path = os.path.join(LOCAL_STORAGE_DIR, key.replace("/", os.sep))
    await asyncio.to_thread(_delete_file, file_path)
    logger.info(f"Deleted local file: {file_path}")


async def download_file_from_s3(key: str) -> bytes:
    file_path = os.path.join(LOCAL_STORAGE_DIR, key.replace("/", os.sep))
    logger.info(f"Reading local file: {file_path}")
    return await asyncio.to_thread(_read_file, file_path)
