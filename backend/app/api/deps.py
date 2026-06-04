import logging
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.db.supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    token = credentials.credentials
    supabase = get_supabase_admin()

    try:
        payload = jwt.get_unverified_claims(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: no subject")
        email = payload.get("email", "")
        role = payload.get("role", "")
        logger.info(f"Token decoded: user_id={user_id}, email={email}, role={role}")
    except (JWTError, Exception) as e:
        logger.error(f"Token decode failed: {e}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

    result = supabase.table("users").select("*").eq("id", user_id).execute()

    if not result.data:
        full_name = ""
        avatar_url = ""
        user_metadata = payload.get("user_metadata", {})
        if user_metadata:
            full_name = user_metadata.get("full_name", "")
            avatar_url = user_metadata.get("avatar_url", "")

        user_data = {
            "id": user_id,
            "email": email,
            "full_name": full_name,
            "avatar_url": avatar_url,
            "auth_provider": "google",
        }
        logger.info(f"Creating new user: {email}")
        supabase.table("users").upsert(user_data).execute()
        return user_data

    return result.data[0]
