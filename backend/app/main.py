"""
Maya API — FastAPI application entry point.

All routes are prefixed /api/v1/ to allow future versioning without breaking clients.
The Stripe webhook is the only endpoint without JWT auth (it uses Stripe signature instead).
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import buildings, payments, storage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title="Maya API",
    version="0.1.0",
    # Disable automatic docs in production to avoid leaking schema
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
)

# CORS: allow the Next.js dashboard and Expo apps in dev.
# In production, replace with the actual deployed domains.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # Next.js dev
        "http://localhost:8081",   # Expo dev
        "https://dashboard.maya.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ────────────────────────────────────────────────────────────────
app.include_router(buildings.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")
app.include_router(storage.router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """Used by Docker health checks and load balancers."""
    return {"status": "ok", "version": "0.1.0"}
