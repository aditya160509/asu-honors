"""Email delivery abstraction: Resend (when RESEND_API_KEY is configured) or
console logging (dev fallback)."""

import logging
from typing import Protocol

import httpx

from apps.api.config import settings

logger = logging.getLogger("stock-sim.email")

RESEND_API_URL = "https://api.resend.com/emails"
SEND_TIMEOUT_SECONDS = 10.0


class EmailService(Protocol):
    async def send_password_reset(self, to: str, reset_url: str, expires_in_minutes: int) -> None: ...

    async def send_otp_code(self, to: str, code: str, purpose: str) -> None: ...


class ConsoleEmailService:
    """Dev/local implementation: logs the full email content instead of sending."""

    async def send_password_reset(self, to: str, reset_url: str, expires_in_minutes: int) -> None:
        logger.info(
            "\n========== EMAIL (password reset) ==========\n"
            "To: %s\n"
            "Subject: Reset your Stock Sim password\n"
            "Body:\n"
            "  Someone requested a password reset for this account.\n"
            "  Reset link (expires in %d minutes):\n"
            "  %s\n"
            "  If you didn't request this, you can ignore this email.\n"
            "============================================",
            to,
            expires_in_minutes,
            reset_url,
        )

    async def send_otp_code(self, to: str, code: str, purpose: str) -> None:
        logger.info(
            "\n========== EMAIL (OTP: %s) ==========\n"
            "To: %s\n"
            "Subject: Your Stock Sim verification code\n"
            "Body:\n"
            "  Your 6-digit verification code is: %s\n"
            "  It expires in 10 minutes. Never share this code.\n"
            "============================================",
            purpose,
            to,
            code,
        )


class ResendEmailService:
    """Sends via the Resend HTTP API.

    Deliberately never raises: a provider outage on /auth/forgot-password would
    otherwise turn into a 500 only when the account exists, leaking existence.
    Failures are logged server-side; the user can always hit "Resend".
    """

    async def _send(self, to: str, subject: str, html: str, text: str) -> None:
        try:
            async with httpx.AsyncClient(timeout=SEND_TIMEOUT_SECONDS) as client:
                res = await client.post(
                    RESEND_API_URL,
                    headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                    json={
                        "from": settings.email_from,
                        "to": [to],
                        "subject": subject,
                        "html": html,
                        "text": text,
                    },
                )
            if res.status_code >= 400:
                logger.error(
                    "Resend send failed (%d) for %s: %s", res.status_code, to, res.text[:300]
                )
            else:
                logger.info("Email sent via Resend to %s (%s)", to, subject)
        except httpx.HTTPError as exc:
            logger.error("Resend request error for %s: %s", to, exc)

    async def send_password_reset(self, to: str, reset_url: str, expires_in_minutes: int) -> None:
        subject = "Reset your Stock Sim password"
        text = (
            "Someone requested a password reset for this account.\n"
            f"Reset link (expires in {expires_in_minutes} minutes):\n{reset_url}\n"
            "If you didn't request this, you can ignore this email."
        )
        html = (
            "<p>Someone requested a password reset for this account.</p>"
            f'<p><a href="{reset_url}">Reset your password</a> '
            f"(link expires in {expires_in_minutes} minutes).</p>"
            "<p>If you didn't request this, you can ignore this email.</p>"
        )
        await self._send(to, subject, html, text)

    async def send_otp_code(self, to: str, code: str, purpose: str) -> None:
        subject = "Your Stock Sim verification code"
        text = (
            f"Your 6-digit verification code is: {code}\n"
            "It expires in 10 minutes. Never share this code."
        )
        html = (
            f"<p>Your 6-digit verification code is:</p>"
            f'<p style="font-size:24px;font-weight:bold;letter-spacing:4px;font-family:monospace">{code}</p>'
            "<p>It expires in 10 minutes. Never share this code.</p>"
        )
        await self._send(to, subject, html, text)


_console_email_service = ConsoleEmailService()
_resend_email_service = ResendEmailService()


def get_email_service() -> EmailService:
    """FastAPI dependency: Resend when an API key is configured, console otherwise."""
    if settings.resend_api_key:
        return _resend_email_service
    return _console_email_service
