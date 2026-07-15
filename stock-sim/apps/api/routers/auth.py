"""Auth endpoints: register/login/me plus refresh-token sessions, password reset, and email OTP."""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from apps.api.auth import create_access_token, get_current_user, hash_password, verify_password
from apps.api.database import get_db
from apps.api.exceptions import ConflictError
from apps.api.rate_limiter import auth_rate_limiter
from apps.api.schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    OtpRequestBody,
    OtpVerifyBody,
    ResetPasswordRequest,
    TokenResponse,
    UserCreateRequest,
    UserResponse,
)
from apps.api.services import auth_service
from apps.api.services.email_service import EmailService, get_email_service
from apps.api.config import settings
from db.models import Portfolio, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

DEFAULT_STARTING_CASH = 100_000.0

REFRESH_COOKIE = "mv_refresh"
SESSION_FLAG_COOKIE = "mv_session"  # non-httpOnly indicator read by Next.js middleware
REFRESH_COOKIE_PATH = "/api/v1/auth"

GENERIC_FORGOT_MESSAGE = "If an account exists, a reset link has been sent."
GENERIC_OTP_MESSAGE = "If an account exists, a verification code has been sent."


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _set_session_cookies(response: Response, refresh_token: str, max_age: int) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        max_age=max_age,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path=REFRESH_COOKIE_PATH,
    )
    # Lightweight logged-in flag for edge middleware; NOT a credential.
    response.set_cookie(
        SESSION_FLAG_COOKIE,
        "1",
        max_age=max_age,
        httponly=False,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def _clear_session_cookies(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)
    response.delete_cookie(SESSION_FLAG_COOKIE, path="/")


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: UserCreateRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    email_service: EmailService = Depends(get_email_service),
) -> User:
    auth_rate_limiter.check(f"register:ip:{_client_ip(http_request)}", max_requests=10, window_seconds=3600)

    existing = db.query(User).filter_by(email=request.email).first()
    if existing is not None:
        raise ConflictError("Email already registered")

    # bcrypt is CPU-bound — keep it off the event loop in async handlers.
    hashed = await run_in_threadpool(hash_password, request.password)
    user = User(
        email=request.email,
        hashed_password=hashed,
        display_name=request.display_name,
        role="user",
        starting_cash=DEFAULT_STARTING_CASH,
    )
    db.add(user)
    db.flush()

    db.add(Portfolio(
        user_id=user.id,
        timeline_id=settings.default_timeline_id,
        cash_balance=DEFAULT_STARTING_CASH,
        total_value=DEFAULT_STARTING_CASH,
    ))
    db.commit()
    db.refresh(user)

    # Mandatory-after-registration email verification: send the first OTP now.
    code = await run_in_threadpool(auth_service.create_otp, db, user, "register")
    await email_service.send_otp_code(user.email, code, "register")

    # In dev mode with skip_email_verification, auto-verify so login works immediately.
    if settings.skip_email_verification:
        user.email_verified_at = datetime.now(timezone.utc)
        db.commit()

    return user


@router.post("/login", response_model=TokenResponse)
def login(
    request: LoginRequest,
    http_request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenResponse:
    ip = _client_ip(http_request)
    auth_rate_limiter.check(f"login:ip:{ip}", max_requests=10, window_seconds=300)
    auth_rate_limiter.check(f"login:email:{request.email.lower()}", max_requests=5, window_seconds=300)

    user = db.query(User).filter_by(email=request.email).first()
    if user is None or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if user.email_verified_at is None:
        # Correct credentials but unverified email — frontend routes to /verify-email.
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="email_unverified")

    _session, refresh_token, max_age = auth_service.create_session(
        db, user, request.remember, http_request.headers.get("user-agent"), ip
    )
    _set_session_cookies(response, refresh_token, max_age)

    token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    http_request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenResponse:
    token = http_request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    rotated = auth_service.rotate_refresh_token(db, token)
    if rotated is None:
        _clear_session_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    session, new_refresh_token, max_age = rotated
    user = db.get(User, session.user_id)
    if user is None:
        _clear_session_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    _set_session_cookies(response, new_refresh_token, max_age)
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=access_token)


@router.post("/logout", response_model=MessageResponse)
def logout(
    http_request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> MessageResponse:
    token = http_request.cookies.get(REFRESH_COOKIE)
    if token:
        auth_service.revoke_session_by_token(db, token)
    _clear_session_cookies(response)
    return MessageResponse(message="Signed out.")


@router.post("/logout-all", response_model=MessageResponse)
def logout_all(
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    count = auth_service.revoke_all_sessions(db, current_user.id)
    _clear_session_cookies(response)
    return MessageResponse(message=f"Signed out of {count} session(s).")


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    request: ForgotPasswordRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    email_service: EmailService = Depends(get_email_service),
) -> MessageResponse:
    email = request.email.strip().lower()
    auth_rate_limiter.check(f"forgot:ip:{_client_ip(http_request)}", max_requests=10, window_seconds=3600)
    auth_rate_limiter.check(f"forgot:email:{email}", max_requests=3, window_seconds=3600)

    user = db.query(User).filter_by(email=request.email.strip()).first()
    if user is not None:
        token = auth_service.create_password_reset_token(db, user)
        reset_url = f"{settings.frontend_base_url}/reset-password?token={token}"
        await email_service.send_password_reset(
            user.email, reset_url, settings.password_reset_expire_minutes
        )
    # Identical response whether or not the account exists (no enumeration).
    return MessageResponse(message=GENERIC_FORGOT_MESSAGE)


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(
    request: ResetPasswordRequest,
    http_request: Request,
    db: Session = Depends(get_db),
) -> MessageResponse:
    auth_rate_limiter.check(f"reset:ip:{_client_ip(http_request)}", max_requests=10, window_seconds=3600)

    user = auth_service.consume_password_reset_token(db, request.token)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="reset_token_invalid")

    user.hashed_password = hash_password(request.new_password)
    db.commit()
    auth_service.invalidate_reset_tokens(db, user.id)
    # A password reset forces re-login everywhere.
    auth_service.revoke_all_sessions(db, user.id)
    return MessageResponse(message="Password updated.")


def _resolve_otp_user(db: Session, body_email: Optional[str]) -> Optional[User]:
    if not body_email:
        return None
    return db.query(User).filter_by(email=body_email.strip()).first()


@router.post("/otp/request", response_model=MessageResponse)
async def otp_request(
    request: OtpRequestBody,
    http_request: Request,
    db: Session = Depends(get_db),
    email_service: EmailService = Depends(get_email_service),
) -> MessageResponse:
    if request.purpose not in auth_service.OTP_PURPOSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid purpose")

    ip = _client_ip(http_request)
    auth_rate_limiter.check(f"otp-req:ip:{ip}", max_requests=10, window_seconds=3600)
    if request.email:
        email_key = request.email.strip().lower()
        auth_rate_limiter.check(f"otp-req:email:{email_key}", max_requests=1, window_seconds=60)
        auth_rate_limiter.check(f"otp-req:email-hour:{email_key}", max_requests=5, window_seconds=3600)

    user = _resolve_otp_user(db, request.email)
    if user is not None:
        if request.purpose == "register" and user.email_verified_at is not None:
            # Already verified — still return the generic message (no enumeration).
            return MessageResponse(message=GENERIC_OTP_MESSAGE)
        code = await run_in_threadpool(auth_service.create_otp, db, user, request.purpose)
        await email_service.send_otp_code(user.email, code, request.purpose)
    return MessageResponse(message=GENERIC_OTP_MESSAGE)


@router.post("/otp/verify")
def otp_verify(
    request: OtpVerifyBody,
    http_request: Request,
    db: Session = Depends(get_db),
) -> dict:
    if request.purpose not in auth_service.OTP_PURPOSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid purpose")

    auth_rate_limiter.check(f"otp-verify:ip:{_client_ip(http_request)}", max_requests=30, window_seconds=3600)

    user = _resolve_otp_user(db, request.email)
    if user is None:
        # Indistinguishable from a wrong code for a real account.
        return {"verified": False, "reason": "invalid", "attempts_remaining": 0}

    result, attempts_remaining = auth_service.verify_otp(db, user, request.purpose, request.code)
    if result == "ok":
        if request.purpose == "register" and user.email_verified_at is None:
            user.email_verified_at = datetime.now(timezone.utc)
            db.commit()
        return {"verified": True}
    reason = "invalid" if result == "not_found" else result
    return {"verified": False, "reason": reason, "attempts_remaining": attempts_remaining}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
