"""
WhatsApp Business API integration (Meta Cloud API).

Used for payment reminders, security notifications, cleaning confirmations,
and compliance notices. All messages use pre-approved templates to comply
with Meta's policies (template messages for outbound initiation).
"""
import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

WHATSAPP_API_URL = "https://graph.facebook.com/v21.0"


async def send_template_message(
    to_phone: str,
    template_name: str,
    language_code: str = "es_MX",
    components: list | None = None,
) -> None:
    """Send a WhatsApp template message to a phone number.

    Args:
        to_phone: Phone number in E.164 format, e.g. "5215512345678"
        template_name: Pre-approved template name in Meta Business Manager
        language_code: Template language (default: es_MX)
        components: Template variable substitutions
    """
    settings = get_settings()

    if not settings.whatsapp_api_token or not settings.whatsapp_phone_number_id:
        logger.warning("WhatsApp not configured, skipping message to %s", to_phone)
        return

    url = f"{WHATSAPP_API_URL}/{settings.whatsapp_phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code},
            "components": components or [],
        },
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                url,
                json=payload,
                headers={"Authorization": f"Bearer {settings.whatsapp_api_token}"},
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        # WhatsApp failures must not block the main flow.
        logger.error(
            "WhatsApp message failed",
            extra={"to": to_phone, "template": template_name, "error": str(exc)},
        )


async def send_security_access_alert(
    security_phone: str,
    tenant_name: str,
    room_number: str,
    event_type: str,
    notes: str | None = None,
) -> None:
    """Notifies the security guard via WhatsApp when a tenant enters or exits.

    Uses the 'maya_access_alert' template which must be pre-approved in Meta.
    Template variables: {{1}} = tenant name, {{2}} = room, {{3}} = event type.
    """
    event_label = {
        "entry": "ingresando",
        "exit": "saliendo",
        "guest_entry": "con visita ingresando",
        "package": "esperando paquete",
        "uber": "esperando Uber",
        "moving_in": "mudanza de entrada",
        "moving_out": "mudanza de salida",
    }.get(event_type, event_type)

    await send_template_message(
        to_phone=security_phone,
        template_name="maya_access_alert",
        components=[
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": tenant_name},
                    {"type": "text", "text": room_number},
                    {"type": "text", "text": event_label},
                ],
            }
        ],
    )
