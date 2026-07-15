"""Application settings loaded from environment variables (Phase 5 plan section 1)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the API. Values are overridable via env vars."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim"
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    refresh_token_remember_days: int = 30
    password_reset_expire_minutes: int = 15
    otp_expire_minutes: int = 10
    otp_max_attempts: int = 5
    cookie_secure: bool = False  # set True behind HTTPS in production
    frontend_base_url: str = "http://localhost:3000"
    # Email delivery: when resend_api_key is set, ResendEmailService is used;
    # otherwise emails are console-logged (dev mode).
    resend_api_key: str = ""
    email_from: str = "Stock Sim <onboarding@resend.dev>"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    default_timeline_id: int = 1


settings = Settings()
