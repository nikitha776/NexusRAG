from supabase import create_client, Client
from app.config import get_settings

settings = get_settings()

_supabase: Client | None = None
_supabase_admin: Client | None = None


def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    return _supabase


def get_supabase_admin() -> Client:
    global _supabase_admin
    if _supabase_admin is None:
        _supabase_admin = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    return _supabase_admin
