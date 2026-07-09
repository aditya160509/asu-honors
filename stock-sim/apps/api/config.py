"""Application settings loaded from environment variables (Phase 5 plan section 1)."""

from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the API. Values are overridable via env vars."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim"
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    redis_url: Optional[str] = None
    default_timeline_id: int = 1


settings = Settings()
