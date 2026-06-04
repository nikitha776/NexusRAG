import ssl
import logging
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from sqlmodel import SQLModel
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=20,
    max_overflow=10,
    connect_args={"ssl": ssl_ctx},
)


async def init_db():
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
            await conn.run_sync(SQLModel.metadata.create_all)
        logger.info("Database connection OK, tables verified")
    except Exception as e:
        logger.warning(f"Database init skipped (tables exist in Supabase): {e}")


async def get_session():
    async with AsyncSession(engine, expire_on_commit=False) as session:
        yield session
