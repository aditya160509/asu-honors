"""Registration and login endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from apps.api.auth import create_access_token, get_current_user, hash_password, verify_password
from apps.api.database import get_db
from apps.api.exceptions import ConflictError
from apps.api.schemas import LoginRequest, TokenResponse, UserCreateRequest, UserResponse
from db.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

DEFAULT_STARTING_CASH = 100_000.0


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(request: UserCreateRequest, db: Session = Depends(get_db)) -> User:
    existing = db.query(User).filter_by(email=request.email).first()
    if existing is not None:
        raise ConflictError("Email already registered")

    user = User(
        email=request.email,
        hashed_password=hash_password(request.password),
        display_name=request.display_name,
        role="user",
        starting_cash=DEFAULT_STARTING_CASH,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter_by(email=request.email).first()
    if user is None or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
