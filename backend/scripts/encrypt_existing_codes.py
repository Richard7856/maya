"""
One-time migration: encrypt existing plaintext access codes in leases table.

Run once before deploying the encrypted read path:
    cd backend && python -m scripts.encrypt_existing_codes

Idempotent — skips rows that are already valid Fernet tokens.
Requires APP_SECRET_KEY and SUPABASE_* env vars (loads from .env).
"""
import sys
from pathlib import Path

# Ensure the backend package is importable when running as a script
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.dependencies.supabase import get_supabase_admin
from app.services.encryption import encrypt_access_code, decrypt_access_code


def main() -> None:
    supabase = get_supabase_admin()

    result = (
        supabase.table("leases")
        .select("id, access_code_encrypted")
        .not_.is_("access_code_encrypted", "null")
        .execute()
    )

    if not result.data:
        print("No leases with access codes found. Nothing to migrate.")
        return

    migrated = 0
    skipped = 0

    for lease in result.data:
        code = lease["access_code_encrypted"]

        # Check if already encrypted (valid Fernet token)
        try:
            decrypt_access_code(code)
            skipped += 1
            continue
        except ValueError:
            pass  # Not a valid Fernet token — needs encryption

        encrypted = encrypt_access_code(code)
        supabase.table("leases").update(
            {"access_code_encrypted": encrypted}
        ).eq("id", lease["id"]).execute()
        migrated += 1

    print(f"Done. Migrated: {migrated}, Already encrypted: {skipped}")


if __name__ == "__main__":
    main()
