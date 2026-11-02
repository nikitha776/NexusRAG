import asyncio
import logging
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.db.supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Please sign in", headers={"WWW-Authenticate": "Bearer"})
    supabase = get_supabase_admin()
    try:
        # Supabase verifies the signature, expiry, and account for this token.
        response = await asyncio.to_thread(supabase.auth.get_user, credentials.credentials)
    except Exception as exc:
        status = getattr(exc, "status", None)
        if status in (400, 401, 403) or type(exc).__name__ in ("AuthInvalidTokenResponseError", "AuthSessionMissingError"):
            raise HTTPException(status_code=401, detail="Invalid or expired session") from exc
        logger.warning("Authentication service unavailable", exc_info=True)
        raise HTTPException(status_code=503, detail="Sign-in verification is temporarily unavailable. Please retry.") from exc
    account = response.user if response else None
    if not account or not account.id:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    result = await asyncio.to_thread(lambda: supabase.table("users").select("*").eq("id", account.id).execute())
    if result.data:
        return result.data[0]
    metadata = account.user_metadata or {}
    user_data = {
        "id": account.id,
        "email": account.email or "",
        "full_name": metadata.get("full_name", metadata.get("name", "")),
        "avatar_url": metadata.get("avatar_url", ""),
        "auth_provider": (account.app_metadata or {}).get("provider", "google"),
    }
    await asyncio.to_thread(lambda: supabase.table("users").upsert(user_data).execute())
    return user_data
