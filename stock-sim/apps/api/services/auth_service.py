"""Session (refresh token), password-reset token, and OTP business logic."""

import hashlib
import hmac
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from jose import JWTError, jwt
from sqlalchemy.orm import Session

from apps.api.auth import hash_password, verify_password
from apps.api.config import settings
from db.models import OtpCode, PasswordResetToken, User, UserSession

logger = logging.getLogger(__name__)

OTP_PURPOSES = ("login", "register", "password_reset")
OtpVerifyResult = Literal["ok", "invalid", "expired", "locked", "not_found"]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _hash_refresh_token(token: str) -> str:
    """SHA-256 is appropriate for 256-bit random tokens (unlike low-entropy passwords/OTPs)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _device_label_from_user_agent(user_agent: Optional[str]) -> Optional[str]:
    """Cheap heuristic parse — human-recognizable, not fingerprinting."""
    if not user_agent:
        return None
    ua = user_agent.lower()
    if "edg/" in ua:
        browser = "Edge"
    elif "firefox/" in ua:
        browser = "Firefox"
    elif "chrome/" in ua:
        browser = "Chrome"
    elif "safari/" in ua:
        browser = "Safari"
    else:
        browser = "Browser"
    if "windows" in ua:
        os_name = "Windows"
    elif "mac os" in ua or "macintosh" in ua:
        os_name = "macOS"
    elif "android" in ua:
        os_name = "Android"
    elif "iphone" in ua or "ipad" in ua:
        os_name = "iOS"
    elif "linux" in ua:
        os_name = "Linux"
    else:
        os_name = "Unknown OS"
    return f"{browser} on {os_name}"


# ---------------------------------------------------------------------------
# Sessions / refresh tokens
# ---------------------------------------------------------------------------


def create_session(
    db: Session,
    user: User,
    remember: bool,
    user_agent: Optional[str],
    ip_address: Optional[str],
) -> tuple[UserSession, str, int]:
    """Create a sessions row; returns (session, plaintext refresh token, max_age_seconds).

    Token format is "<session_uuid>.<secret>" so redemption can look the row up by id
    and then constant-time-compare the hash.
    """
    days = settings.refresh_token_remember_days if remember else settings.refresh_token_expire_days
    max_age = days * 24 * 3600
    session_id = uuid.uuid4()
    token = f"{session_id}.{secrets.token_urlsafe(32)}"
    now = _utcnow()
    session = UserSession(
        id=session_id,
        user_id=user.id,
        refresh_token_hash=_hash_refresh_token(token),
        device_label=_device_label_from_user_agent(user_agent),
        ip_address=ip_address,
        last_active_at=now,
        expires_at=now + timedelta(days=days),
    )
    db.add(session)
    db.commit()
    return session, token, max_age


def rotate_refresh_token(db: Session, token: str) -> Optional[tuple[UserSession, str, int]]:
    """Validate a refresh token and rotate it. Returns (session, new_token, max_age_seconds)
    or None if invalid/expired/revoked. Presenting an already-rotated token for a live
    session is treated as compromise: the whole session is revoked."""
    parts = token.split(".", 1)
    if len(parts) != 2:
        return None
    try:
        session_id = uuid.UUID(parts[0])
    except ValueError:
        return None
    session = db.get(UserSession, session_id)
    if session is None or session.revoked_at is not None:
        return None
    now = _utcnow()
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        return None
    if not hmac.compare_digest(session.refresh_token_hash, _hash_refresh_token(token)):
        # Old rotated token replayed against a live session → assume theft, kill the session.
        logger.warning("Refresh-token reuse detected for session %s — revoking", session.id)
        session.revoked_at = now
        db.commit()
        return None

    remaining = expires_at - now
    max_age = int(remaining.total_seconds())
    new_token = f"{session.id}.{secrets.token_urlsafe(32)}"
    session.refresh_token_hash = _hash_refresh_token(new_token)
    session.last_active_at = now
    db.commit()
    return session, new_token, max_age


def revoke_session_by_token(db: Session, token: str) -> bool:
    """Revoke the session matching this refresh token (logout). Best-effort."""
    parts = token.split(".", 1)
    if len(parts) != 2:
        return False
    try:
        session_id = uuid.UUID(parts[0])
    except ValueError:
        return False
    session = db.get(UserSession, session_id)
    if session is None or session.revoked_at is not None:
        return False
    session.revoked_at = _utcnow()
    db.commit()
    return True


def revoke_all_sessions(db: Session, user_id: int) -> int:
    """Revoke every live session for a user (password reset / logout-all)."""
    now = _utcnow()
    count = (
        db.query(UserSession)
        .filter(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
        .update({UserSession.revoked_at: now})
    )
    db.commit()
    return count


# ---------------------------------------------------------------------------
# Password reset tokens
# ---------------------------------------------------------------------------


def create_password_reset_token(db: Session, user: User) -> str:
    """Signed JWT (type=password_reset) with a persisted jti for single-use revocability."""
    jti = secrets.token_urlsafe(24)
    now = _utcnow()
    expires_at = now + timedelta(minutes=settings.password_reset_expire_minutes)
    db.add(PasswordResetToken(user_id=user.id, jti=jti, expires_at=expires_at))
    db.commit()
    payload = {
        "sub": str(user.id),
        "type": "password_reset",
        "jti": jti,
        "iat": now,
        "exp": expires_at,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def consume_password_reset_token(db: Session, token: str) -> Optional[User]:
    """Validate signature/expiry/jti and mark the token consumed. Returns the user or None."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None
    if payload.get("type") != "password_reset":
        return None
    jti = payload.get("jti")
    sub = payload.get("sub")
    if not jti or not sub:
        return None
    record = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.jti == jti, PasswordResetToken.consumed_at.is_(None))
        .first()
    )
    if record is None:
        return None
    user = db.get(User, int(sub))
    if user is None or record.user_id != user.id:
        return None
    record.consumed_at = _utcnow()
    db.commit()
    return user


def invalidate_reset_tokens(db: Session, user_id: int) -> None:
    """Consume all outstanding reset tokens for a user (e.g. after a successful reset)."""
    now = _utcnow()
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user_id, PasswordResetToken.consumed_at.is_(None)
    ).update({PasswordResetToken.consumed_at: now})
    db.commit()


# ---------------------------------------------------------------------------
# OTP codes
# ---------------------------------------------------------------------------


def create_otp(db: Session, user: User, purpose: str) -> str:
    """Generate a crypto-random 6-digit code, invalidating any prior unconsumed code."""
    now = _utcnow()
    db.query(OtpCode).filter(
        OtpCode.user_id == user.id, OtpCode.purpose == purpose, OtpCode.consumed_at.is_(None)
    ).update({OtpCode.consumed_at: now})
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        OtpCode(
            user_id=user.id,
            code_hash=hash_password(code),
            purpose=purpose,
            expires_at=now + timedelta(minutes=settings.otp_expire_minutes),
            attempt_count=0,
        )
    )
    db.commit()
    return code


def verify_otp(db: Session, user: User, purpose: str, code: str) -> tuple[OtpVerifyResult, int]:
    """Check the latest unconsumed code. Returns (result, attempts_remaining)."""
    record = (
        db.query(OtpCode)
        .filter(OtpCode.user_id == user.id, OtpCode.purpose == purpose, OtpCode.consumed_at.is_(None))
        .order_by(OtpCode.created_at.desc())
        .first()
    )
    if record is None:
        return "not_found", 0
    now = _utcnow()
    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        return "expired", 0
    if record.attempt_count >= settings.otp_max_attempts:
        return "locked", 0
    if not verify_password(code, record.code_hash):
        record.attempt_count += 1
        db.commit()
        remaining = settings.otp_max_attempts - record.attempt_count
        if remaining <= 0:
            return "locked", 0
        return "invalid", remaining
    record.consumed_at = now
    db.commit()
    return "ok", 0
