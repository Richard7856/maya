"""
Payments router — the most security-sensitive domain.

Key rules enforced here:
- A tenant can only pay their own lease's payments.
- The access code is only decrypted and returned when the current month is paid.
- The Stripe webhook is verified using the webhook secret (not the JWT).
- n8n is notified after a successful payment to trigger the unlock workflow (WF-03).
"""
import hashlib
import hmac
from typing import Annotated
from uuid import UUID

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from supabase import Client

from app.config import get_settings
from app.dependencies.auth import require_tenant
from app.dependencies.supabase import get_supabase_admin
from app.integrations.n8n import trigger_workflow
from app.integrations.push import send_push_to_user
from app.models.user import UserProfile

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/{payment_id}/pay")
async def create_payment_intent(
    payment_id: UUID,
    current_user: Annotated[UserProfile, Depends(require_tenant)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Creates a Stripe PaymentIntent for the given payment.

    Returns the client_secret which the mobile app feeds into PaymentSheet.
    Validates that the payment belongs to the authenticated tenant's lease.
    """
    settings = get_settings()
    stripe.api_key = settings.stripe_secret_key

    # Verify the payment belongs to this tenant's active lease
    result = (
        supabase.table("payments")
        .select("id, amount, status, lease_id, leases!inner(tenant_id, stripe_customer_id)")
        .eq("id", str(payment_id))
        .eq("leases.tenant_id", str(current_user.id))
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found or does not belong to your lease.",
        )

    payment = result.data
    if payment["status"] == "paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This payment has already been completed.",
        )

    lease = payment["leases"]
    amount_centavos = int(float(payment["amount"]) * 100)

    # Create or retrieve the Stripe customer for this tenant
    stripe_customer_id = lease.get("stripe_customer_id")
    if not stripe_customer_id:
        customer = stripe.Customer.create(
            metadata={"tenant_id": str(current_user.id), "lease_id": payment["lease_id"]}
        )
        stripe_customer_id = customer.id
        supabase.table("leases").update({"stripe_customer_id": stripe_customer_id}).eq(
            "id", payment["lease_id"]
        ).execute()

    intent = stripe.PaymentIntent.create(
        amount=amount_centavos,
        currency="mxn",
        customer=stripe_customer_id,
        metadata={
            "payment_id": str(payment_id),
            "lease_id": payment["lease_id"],
            "tenant_id": str(current_user.id),
        },
        automatic_payment_methods={"enabled": True},
    )

    # Store the intent ID so the webhook can match it back to this payment
    supabase.table("payments").update(
        {"stripe_payment_intent_id": intent.id}
    ).eq("id", str(payment_id)).execute()

    return {
        "client_secret": intent.client_secret,
        "payment_id": str(payment_id),
        "amount": float(payment["amount"]),
    }


@router.get("/mine/access-code")
async def get_access_code(
    current_user: Annotated[UserProfile, Depends(require_tenant)],
    supabase: Annotated[Client, Depends(get_supabase_admin)],
):
    """Returns the room access code only if the current month's rent is paid.

    This is the security gate: the code is never stored on the client.
    The tenant must re-request it each session, and payment is re-validated each time.
    """
    from datetime import date

    today = date.today()
    period_start = today.replace(day=1).isoformat()

    # Find the current month's payment for this tenant's active lease
    result = (
        supabase.table("payments")
        .select("status, leases!inner(tenant_id, access_code_encrypted)")
        .eq("leases.tenant_id", str(current_user.id))
        .eq("status", "paid")
        .gte("due_date", period_start)
        .order("due_date", desc=True)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Current month's payment is not confirmed. Pay to access your code.",
        )

    encrypted_code = result.data[0]["leases"]["access_code_encrypted"]
    if not encrypted_code:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access code not yet assigned. Contact administration.",
        )

    # The code is stored as plaintext in this phase.
    # TODO: Encrypt at rest with app_secret_key before production launch.
    return {"access_code": encrypted_code}


@router.post("/webhook/stripe")
async def stripe_webhook(
    request: Request,
    supabase: Annotated[Client, Depends(get_supabase_admin)],
    stripe_signature: str = Header(alias="stripe-signature"),
):
    """Handles Stripe webhook events.

    Stripe signs every request with the webhook secret.
    We verify this signature before processing to prevent spoofed events.
    This endpoint does NOT require JWT auth — it's authenticated by the Stripe signature.
    """
    settings = get_settings()
    stripe.api_key = settings.stripe_secret_key

    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, settings.stripe_webhook_secret
        )
    except stripe.error.SignatureVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Stripe signature: {exc}",
        ) from exc

    if event["type"] == "payment_intent.succeeded":
        await _handle_payment_succeeded(event["data"]["object"], supabase)
    elif event["type"] == "payment_intent.payment_failed":
        await _handle_payment_failed(event["data"]["object"], supabase)

    return {"received": True}


async def _handle_payment_succeeded(
    payment_intent: dict, supabase: Client
) -> None:
    """Marks payment as paid, unlocks the app, and notifies the tenant."""
    payment_id = payment_intent["metadata"].get("payment_id")
    if not payment_id:
        return

    from datetime import datetime, timezone

    supabase.table("payments").update(
        {
            "status": "paid",
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "stripe_charge_id": payment_intent.get("latest_charge"),
        }
    ).eq("id", payment_id).execute()

    # Unlock the app if it was locked for non-payment
    lease_id = payment_intent["metadata"].get("lease_id")
    tenant_id = payment_intent["metadata"].get("tenant_id")
    if lease_id:
        supabase.table("user_profiles").update({"is_locked": False}).eq(
            "id", tenant_id
        ).execute()

    # Trigger n8n WF-03 to send WhatsApp + push confirmation to tenant
    await trigger_workflow(
        "wf-03-payment-confirmed",
        {"payment_id": payment_id, "tenant_id": tenant_id, "lease_id": lease_id},
    )


async def _handle_payment_failed(payment_intent: dict, supabase: Client) -> None:
    """Notifies admin and tenant when a Stripe payment fails."""
    tenant_id = payment_intent["metadata"].get("tenant_id")
    payment_id = payment_intent["metadata"].get("payment_id")

    await trigger_workflow(
        "wf-03-payment-failed",
        {"payment_id": payment_id, "tenant_id": tenant_id},
    )
