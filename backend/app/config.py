"""
Application configuration loaded from environment variables.
All settings are validated at startup — missing required values raise an error
so the app fails fast rather than silently misbehaving in production.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str

    # Stripe
    stripe_secret_key: str
    stripe_webhook_secret: str

    # n8n internal webhook auth
    n8n_webhook_secret: str

    # WhatsApp (Meta Cloud API)
    whatsapp_api_token: str = ""
    whatsapp_phone_number_id: str = ""

    # App
    environment: str = "development"
    app_secret_key: str

    # Comma-separated allowed origins — override in .env for staging/prod
    cors_origins: str = "http://localhost:3000,http://localhost:8081,https://dashboard.maya.app"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
