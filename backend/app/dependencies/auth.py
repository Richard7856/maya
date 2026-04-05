"""
Auth dependency — validates Supabase JWTs and injects the current user profile.

How it works:
1. The client (Next.js / Expo) signs in via Supabase Auth and gets a JWT.
2. The JWT is sent as a Bearer token in every API request.
3. FastAPI validates the JWT signature using the shared SUPABASE_JWT_SECRET.
4. The user's UUID (sub claim) is used to fetch their profile + role from user_profiles.

The role is then used by route-level guards (require_admin, require_tenant, etc.)
to enforce access control beyond what Supabase RLS already does.
"""
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from supabase import Client

from app.config import get_settings
from app.dependencies.supabase import get_supabase_admin
from app.models.user import UserProfile, UserRole

_bearer = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
) -> UserProfile:
    """Validates the Bearer JWT and returns the authenticated user's profile.

    Raises 401 if the token is missing, expired, or invalid.
    Raises 403 if the user profile does not exist or is inactive.
    """
    settings = get_settings()
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            # Supabase sets audience to "authenticated" for logged-in users
            audience="authenticated",
            options={"verify_exp": True},
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id: str = payload.get("sub", "")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )

    # Fetch role + active status from user_profiles using the service role client
    # (bypasses RLS so we can read any user's profile during auth)
    result = (
        supabase.table("user_profiles")
        .select("id, role, first_name, last_name, phone, rfc, is_active")
        .eq("id", user_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User profile not found. Contact an administrator.",
        )

    profile = result.data
    if not profile["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Contact an administrator.",
        )

    return UserProfile(**profile)


def require_role(*roles: UserRole):
    """Factory that returns a dependency restricting access to specific roles.

    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(user = Depends(require_role("admin"))):
            ...
    """
    async def _check(
        current_user: Annotated[UserProfile, Depends(get_current_user)],
    ) -> UserProfile:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access restricted to roles: {', '.join(roles)}",
            )
        return current_user

    return _check


# Convenience aliases used throughout routers
require_admin = require_role("admin")
require_tenant = require_role("tenant")
require_cleaning = require_role("cleaning")
require_admin_or_tenant = require_role("admin", "tenant")
