"""
Expo Push Notification integration.

Expo provides a free push notification service that works for both iOS and Android.
Tokens are stored in user_profiles.expo_push_token and updated on each app open.
"""
import logging

import httpx

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push(expo_token: str, title: str, body: str, data: dict | None = None) -> None:
    """Send a push notification to a single Expo push token."""
    if not expo_token or not expo_token.startswith("ExponentPushToken"):
        logger.warning("Invalid Expo push token, skipping: %s", expo_token)
        return

    payload = {
        "to": expo_token,
        "title": title,
        "body": body,
        "sound": "default",
        "data": data or {},
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(EXPO_PUSH_URL, json=payload)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        # Push failures must not block the main flow — log and continue.
        logger.error("Push notification failed: %s", exc, extra={"token": expo_token})


async def send_push_to_user(user_id: str, title: str, body: str, data: dict | None = None, supabase=None) -> None:
    """Convenience function: looks up the expo_push_token by user_id and sends."""
    if not supabase:
        logger.warning("send_push_to_user called without supabase client")
        return

    result = (
        supabase.table("user_profiles")
        .select("expo_push_token")
        .eq("id", user_id)
        .single()
        .execute()
    )

    if result.data and result.data.get("expo_push_token"):
        await send_push(result.data["expo_push_token"], title, body, data)
