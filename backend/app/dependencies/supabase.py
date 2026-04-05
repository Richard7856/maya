"""
Supabase client dependency.

Two clients are used:
- anon client: for operations that should respect RLS (user-facing reads)
- admin client: uses the service_role key to bypass RLS (auth checks, admin writes)

The admin client must NEVER be exposed to the frontend — it lives only in FastAPI.
"""
from functools import lru_cache

from supabase import Client, create_client

from app.config import get_settings


@lru_cache
def _get_admin_client() -> Client:
    """Singleton admin Supabase client (service role — bypasses RLS)."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_supabase_admin() -> Client:
    """FastAPI dependency that returns the admin Supabase client."""
    return _get_admin_client()
