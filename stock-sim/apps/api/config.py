"""Application settings loaded from environment variables (Phase 5 plan section 1)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the API. Values are overridable via env vars."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim"
    redis_url: str = "redis://localhost:6379/0"
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
    skip_email_verification: bool = False  # auto-verify emails in dev
    # Email delivery: when resend_api_key is set, ResendEmailService is used;
    # otherwise emails are console-logged (dev mode).
    resend_api_key: str = ""
    email_from: str = "Stock Sim <onboarding@resend.dev>"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    default_timeline_id: int = 1
    # AI Financial Advisor (Section "AI Workspace") -- empty by default, same
    # pattern as resend_api_key. Unlike email (which degrades to console-log
    # when unset), ai_service must fail loudly with a clear error when this
    # is empty rather than fabricate a response -- see ai_service.py.
    # Gemini (Google AI Studio), not Anthropic -- has a genuinely free tier,
    # picked over Claude specifically to avoid a billing-credit requirement.
    gemini_api_key: str = ""
    ai_model: str = "gemini-3.5-flash"


settings = Settings()
