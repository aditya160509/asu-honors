"""Password hashing, JWT creation/validation, and current-user dependencies."""

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from apps.api.config import settings
from apps.api.database import get_db
from db.models import Portfolio, Timeline, User

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

_BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt. Truncates to bcrypt's 72-byte limit."""
    password_bytes = password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    plain_bytes = plain.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    try:
        return bcrypt.checkpw(plain_bytes, hashed.encode("utf-8"))
    except ValueError:
        logger.warning("Malformed bcrypt hash encountered during verification")
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Encode a JWT with sub/exp/iat claims."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire, "iat": now})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Return the shared fresh-sandbox user when no bearer token is supplied."""
    if settings.authentication_disabled:
        user = db.query(User).filter(User.email == "sandbox@futurelab.local").first()
        created = user is None
        if user is None:
            user = User(email="sandbox@futurelab.local", hashed_password="authentication-disabled",
                        display_name="Sandbox Investor", role="admin", starting_cash=Decimal("100000"),
                        email_verified_at=datetime.now(timezone.utc))
            db.add(user)
            db.flush()
        live = db.query(Timeline).filter(Timeline.is_live.is_(True)).first()
        if live is not None and db.query(Portfolio).filter_by(user_id=user.id, timeline_id=live.id).first() is None:
            db.add(Portfolio(user_id=user.id, timeline_id=live.id, cash_balance=user.starting_cash,
                             total_value=user.starting_cash))
            db.flush()
            created = True
        if created:
            db.commit()
            db.refresh(user)
        return user
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = _decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    try:
        user_id_int = int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.id == user_id_int).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Same as get_current_user but returns None instead of raising when unauthenticated."""
    if settings.authentication_disabled:
        return get_current_user(credentials=None, db=db)
    if credentials is None:
        return None
    try:
        payload = jwt.decode(credentials.credentials, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None
    user_id = payload.get("sub")
    if user_id is None:
        return None
    return db.query(User).filter(User.id == int(user_id)).first()


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that ensures the current user has the admin role."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return current_user
