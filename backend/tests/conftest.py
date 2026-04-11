"""
Shared test fixtures for Maya backend tests.

Uses real JWT encoding (python-jose) so tests exercise the actual decode path.
Supabase is mocked — we never hit a real database in unit tests.
"""
import time
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from jose import jwt

# Test secret — matches what we inject into settings
TEST_JWT_SECRET = "test-jwt-secret-for-unit-tests"
TEST_APP_SECRET = "test-app-secret-key"


@pytest.fixture(autouse=True)
def _override_settings(monkeypatch):
    """Injects test settings so we never need a real .env file."""
    env = {
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_ANON_KEY": "fake-anon-key",
        "SUPABASE_SERVICE_ROLE_KEY": "fake-service-role-key",
        "SUPABASE_JWT_SECRET": TEST_JWT_SECRET,
        "STRIPE_SECRET_KEY": "sk_test_fake",
        "STRIPE_WEBHOOK_SECRET": "whsec_fake",
        "N8N_WEBHOOK_SECRET": "fake-n8n-secret",
        "APP_SECRET_KEY": TEST_APP_SECRET,
        "ENVIRONMENT": "development",
    }
    for key, value in env.items():
        monkeypatch.setenv(key, value)

    # Clear the lru_cache so settings reload with test values
    from app.config import get_settings
    get_settings.cache_clear()


def make_jwt(
    user_id: str | None = None,
    expired: bool = False,
    audience: str = "authenticated",
    secret: str = TEST_JWT_SECRET,
) -> str:
    """Creates a real HS256 JWT matching Supabase's format."""
    now = int(time.time())
    payload = {
        "aud": audience,
        "iat": now,
        "exp": now - 3600 if expired else now + 3600,
    }
    if user_id is not None:
        payload["sub"] = user_id
    return jwt.encode(payload, secret, algorithm="HS256")


def make_supabase_mock(profile_data: dict | None = None):
    """Creates a mock Supabase client that returns the given profile on query.

    If profile_data is None, simulates a user not found in user_profiles.
    """
    mock = MagicMock()
    result = MagicMock()
    result.data = profile_data

    # Chain: supabase.table("user_profiles").select(...).eq(...).single().execute()
    mock.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = result

    return mock


@pytest.fixture
def admin_profile():
    """A valid admin user profile as it would come from the DB."""
    return {
        "id": str(uuid4()),
        "role": "admin",
        "first_name": "Ana",
        "last_name": "García",
        "phone": "+525512345678",
        "rfc": "GARA900101ABC",
        "is_active": True,
    }


@pytest.fixture
def tenant_profile():
    """A valid tenant user profile as it would come from the DB."""
    return {
        "id": str(uuid4()),
        "role": "tenant",
        "first_name": "Carlos",
        "last_name": "López",
        "phone": "+525598765432",
        "rfc": "LOPC950215XYZ",
        "is_active": True,
    }
