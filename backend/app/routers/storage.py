"""
Storage router — generates presigned upload URLs for Supabase Storage.

The client uses the returned upload_url to PUT the file directly to Supabase.
FastAPI never receives the binary data, keeping memory usage low and
avoiding timeouts on large photo uploads.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import Client

from app.config import get_settings
from app.dependencies.auth import get_current_user
from app.dependencies.supabase import get_supabase_admin
from app.models.user import UserProfile

router = APIRouter(prefix="/storage", tags=["storage"])

# Allowed buckets per role to prevent unauthorized storage access
ALLOWED_BUCKETS = {
    "admin": ["documents", "incidents", "contracts", "profiles"],
    "tenant": ["profiles", "incidents"],
    "cleaning": ["cleaning-sessions"],
    "security": [],
}


class PresignRequest(BaseModel):
    bucket: str
    path: str   # e.g. "sessions/abc123/stove.jpg"
    content_type: str


@router.post("/presign")
async def presign_upload(
    body: PresignRequest,
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Returns a signed upload URL. The client PUTs the file directly to Supabase Storage."""
    allowed = ALLOWED_BUCKETS.get(current_user.role, [])
    if body.bucket not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{current_user.role}' cannot upload to bucket '{body.bucket}'.",
        )

    EXPIRY_SECONDS = 300  # 5-minute upload window

    result = supabase.storage.from_(body.bucket).create_signed_upload_url(body.path)

    if "error" in result and result["error"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not generate upload URL: {result['error']}",
        )

    settings = get_settings()
    public_url = f"{settings.supabase_url}/storage/v1/object/public/{body.bucket}/{body.path}"

    return {
        "upload_url": result["signedURL"],
        "public_url": public_url,
        "expires_in": EXPIRY_SECONDS,
    }
