"""
Tests for JWT validation and role-based access control.

These tests use real JWT encoding to exercise the full auth pipeline.
Supabase is mocked via FastAPI dependency_overrides — the correct way to
replace dependencies in FastAPI (unittest.mock.patch doesn't intercept DI).
"""
import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient

from app.dependencies.auth import get_current_user, require_admin, require_tenant, require_admin_or_tenant
from app.dependencies.supabase import get_supabase_admin
from app.models.user import UserProfile
from tests.conftest import make_jwt, make_supabase_mock, TEST_JWT_SECRET


# ── Minimal FastAPI app wired with auth dependencies ─────────────────────────
# Using a test app avoids importing the real app (which needs Stripe, n8n, etc.)

app = FastAPI()


@app.get("/me")
async def me(user: UserProfile = Depends(get_current_user)):
    return {"id": str(user.id), "role": user.role}


@app.get("/admin-only")
async def admin_only(user: UserProfile = Depends(require_admin)):
    return {"id": str(user.id)}


@app.get("/tenant-only")
async def tenant_only(user: UserProfile = Depends(require_tenant)):
    return {"id": str(user.id)}


@app.get("/admin-or-tenant")
async def admin_or_tenant(user: UserProfile = Depends(require_admin_or_tenant)):
    return {"id": str(user.id)}


client = TestClient(app)


# ── Helpers ──────────────────────────────────────────────────────────────────

def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def override_supabase(mock_sb):
    """Overrides the Supabase dependency with a mock for a test scope."""
    app.dependency_overrides[get_supabase_admin] = lambda: mock_sb


@pytest.fixture(autouse=True)
def _default_supabase_override():
    """Always override Supabase with a no-op mock.

    FastAPI resolves ALL dependencies before running the handler, so even if
    the JWT is going to fail, it still tries to instantiate the Supabase client.
    Individual tests can call override_supabase() to provide specific responses.
    """
    app.dependency_overrides[get_supabase_admin] = lambda: make_supabase_mock()
    yield
    app.dependency_overrides.clear()


# ── Tests: JWT validation ────────────────────────────────────────────────────

class TestJWTValidation:
    """Verifies that invalid, expired, or malformed tokens are rejected."""

    def test_valid_token_returns_profile(self, admin_profile):
        token = make_jwt(user_id=admin_profile["id"])
        override_supabase(make_supabase_mock(admin_profile))

        resp = client.get("/me", headers=auth_header(token))

        assert resp.status_code == 200
        assert resp.json()["role"] == "admin"

    def test_expired_token_returns_401(self):
        token = make_jwt(user_id="some-id", expired=True)

        resp = client.get("/me", headers=auth_header(token))

        assert resp.status_code == 401
        assert "expired" in resp.json()["detail"].lower() or "invalid" in resp.json()["detail"].lower()

    def test_invalid_signature_returns_401(self, admin_profile):
        token = make_jwt(user_id=admin_profile["id"], secret="wrong-secret")

        resp = client.get("/me", headers=auth_header(token))

        assert resp.status_code == 401

    def test_missing_sub_claim_returns_401(self):
        token = make_jwt(user_id=None)
        override_supabase(make_supabase_mock())

        resp = client.get("/me", headers=auth_header(token))

        assert resp.status_code == 401
        assert "subject" in resp.json()["detail"].lower()

    def test_no_auth_header_returns_403(self):
        resp = client.get("/me")

        assert resp.status_code == 403  # HTTPBearer returns 403 when header is missing


# ── Tests: user profile lookup ───────────────────────────────────────────────

class TestProfileLookup:
    """Verifies behavior when the user exists in auth but not in user_profiles."""

    def test_user_not_in_db_returns_403(self):
        token = make_jwt(user_id="nonexistent-user-id")
        override_supabase(make_supabase_mock(profile_data=None))

        resp = client.get("/me", headers=auth_header(token))

        assert resp.status_code == 403
        assert "not found" in resp.json()["detail"].lower()

    def test_inactive_user_returns_403(self, tenant_profile):
        tenant_profile["is_active"] = False
        token = make_jwt(user_id=tenant_profile["id"])
        override_supabase(make_supabase_mock(tenant_profile))

        resp = client.get("/me", headers=auth_header(token))

        assert resp.status_code == 403
        assert "inactive" in resp.json()["detail"].lower()


# ── Tests: role guards ───────────────────────────────────────────────────────

class TestRoleGuards:
    """Verifies that role-based guards correctly allow or deny access."""

    def test_admin_can_access_admin_route(self, admin_profile):
        token = make_jwt(user_id=admin_profile["id"])
        override_supabase(make_supabase_mock(admin_profile))

        resp = client.get("/admin-only", headers=auth_header(token))

        assert resp.status_code == 200

    def test_tenant_cannot_access_admin_route(self, tenant_profile):
        token = make_jwt(user_id=tenant_profile["id"])
        override_supabase(make_supabase_mock(tenant_profile))

        resp = client.get("/admin-only", headers=auth_header(token))

        assert resp.status_code == 403
        assert "admin" in resp.json()["detail"].lower()

    def test_admin_or_tenant_accepts_both(self, admin_profile, tenant_profile):
        """Both admin and tenant roles should pass the admin_or_tenant guard."""
        for profile in [admin_profile, tenant_profile]:
            token = make_jwt(user_id=profile["id"])
            override_supabase(make_supabase_mock(profile))

            resp = client.get("/admin-or-tenant", headers=auth_header(token))

            assert resp.status_code == 200, f"Failed for role: {profile['role']}"
