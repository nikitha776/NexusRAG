import os
import logging

logger = logging.getLogger(__name__)

LOCAL_STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(LOCAL_STORAGE_DIR, exist_ok=True)


async def upload_file_to_s3(key: str, content: bytes, content_type: str) -> str:
    file_path = os.path.join(LOCAL_STORAGE_DIR, key.replace("/", os.sep))
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(content)
    logger.info(f"Saved file locally: {file_path} ({len(content)} bytes)")
    return key


async def delete_file_from_s3(key: str):
    file_path = os.path.join(LOCAL_STORAGE_DIR, key.replace("/", os.sep))
    if os.path.exists(file_path):
        os.remove(file_path)
        logger.info(f"Deleted local file: {file_path}")


async def download_file_from_s3(key: str) -> bytes:
    file_path = os.path.join(LOCAL_STORAGE_DIR, key.replace("/", os.sep))
    logger.info(f"Reading local file: {file_path}")
    with open(file_path, "rb") as f:
        return f.read()
