"""
n8n integration — triggers workflow webhooks from FastAPI.

n8n workflows are triggered by sending a POST to their webhook URL.
All internal calls include the shared secret header so n8n can verify
the request came from our API and not from an external source.
"""
import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

# Base URL where n8n is reachable inside the Docker network
N8N_INTERNAL_URL = "http://n8n:5678"


async def trigger_workflow(workflow_name: str, payload: dict) -> None:
    """POST to a named n8n webhook. Fails silently in dev, raises in production.

    workflow_name maps to the webhook path configured in n8n,
    e.g. "wf-03-payment-confirmed" → POST /webhook/wf-03-payment-confirmed
    """
    settings = get_settings()
    url = f"{N8N_INTERNAL_URL}/webhook/{workflow_name}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                url,
                json=payload,
                headers={"X-Maya-Webhook-Secret": settings.n8n_webhook_secret},
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        # Log but don't crash the main request — notification failures should not
        # block the business operation that triggered them.
        logger.error(
            "n8n workflow trigger failed",
            extra={"workflow": workflow_name, "error": str(exc)},
        )
        if settings.is_production:
            raise
