"""
Symmetric encryption for sensitive data at rest (access codes, wifi passwords).

Uses Fernet (AES-128-CBC + HMAC-SHA256) from the cryptography library.
The key is derived from APP_SECRET_KEY via PBKDF2 so any arbitrary string
works as the env var — no need to generate a specific Fernet key format.

Why Fernet over raw AES: Fernet bundles IV generation, authentication (HMAC),
and versioning. One less thing to get wrong in a security-critical path.
"""
import base64

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

from app.config import get_settings

# Stable salt — changing this invalidates all existing encrypted values.
# Not secret, just ensures the derived key is unique to this application.
_SALT = b"maya-access-code-v1"


def _derive_fernet_key() -> bytes:
    """Derives a 32-byte URL-safe base64 Fernet key from APP_SECRET_KEY."""
    settings = get_settings()
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_SALT,
        iterations=480_000,  # OWASP 2023 recommendation for PBKDF2-SHA256
    )
    raw = kdf.derive(settings.app_secret_key.encode())
    return base64.urlsafe_b64encode(raw)


def encrypt_access_code(plaintext: str) -> str:
    """Encrypts an access code for storage in leases.access_code_encrypted."""
    f = Fernet(_derive_fernet_key())
    return f.encrypt(plaintext.encode()).decode()


def decrypt_access_code(ciphertext: str) -> str:
    """Decrypts an access code retrieved from the database.

    Raises ValueError if the ciphertext is corrupt or the key has changed.
    """
    f = Fernet(_derive_fernet_key())
    try:
        return f.decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise ValueError(
            "Failed to decrypt access code — key may have changed or data is corrupt"
        ) from exc
