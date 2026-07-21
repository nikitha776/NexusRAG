import logging
import asyncio
import boto3
from botocore.config import Config

from app.config import get_settings

logger = logging.getLogger(__name__)

_settings = get_settings()
_s3_client = boto3.client(
    "s3",
    aws_access_key_id=_settings.S3_ACCESS_KEY,
    aws_secret_access_key=_settings.S3_SECRET_KEY,
    region_name=_settings.S3_REGION or None,
    endpoint_url=_settings.S3_ENDPOINT or None,
    config=Config(signature_version="s3v4"),
)


async def upload_file_to_s3(key: str, content: bytes, content_type: str) -> str:
    await asyncio.to_thread(
        _s3_client.put_object,
        Bucket=_settings.S3_BUCKET,
        Key=key,
        Body=content,
        ContentType=content_type,
    )
    logger.info(f"Uploaded to S3: s3://{_settings.S3_BUCKET}/{key} ({len(content)} bytes)")
    return key


async def delete_file_from_s3(key: str):
    await asyncio.to_thread(
        _s3_client.delete_object,
        Bucket=_settings.S3_BUCKET,
        Key=key,
    )
    logger.info(f"Deleted from S3: s3://{_settings.S3_BUCKET}/{key}")


async def download_file_from_s3(key: str) -> bytes:
    response = await asyncio.to_thread(
        _s3_client.get_object,
        Bucket=_settings.S3_BUCKET,
        Key=key,
    )
    logger.info(f"Downloaded from S3: s3://{_settings.S3_BUCKET}/{key}")
    return response["Body"].read()
