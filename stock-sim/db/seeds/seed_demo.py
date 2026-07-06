"""Seed demo users, portfolios, and sample transactions."""

import os
import sys

import bcrypt
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from db.models import Portfolio, Timeline, User


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


USERS = [
    {
        "email": "alice@example.com",
        "hashed_password": _hash("demo"),
        "display_name": "Alice",
        "role": "admin",
        "starting_cash": 1_000_000,
    },
    {
        "email": "bob@example.com",
        "hashed_password": _hash("demo"),
        "display_name": "Bob",
        "role": "user",
        "starting_cash": 500_000,
    },
    {
        "email": "charlie@example.com",
        "hashed_password": _hash("demo"),
        "display_name": "Charlie",
        "role": "user",
        "starting_cash": 250_000,
    },
]


def seed(session: Session) -> None:
    for user_data in USERS:
        existing = session.query(User).filter_by(email=user_data["email"]).first()
        if existing is None:
            session.add(User(**user_data))
    session.flush()

    timeline = session.query(Timeline).filter_by(id=1).first()
    if timeline is None:
        session.add(Timeline(
            id=1, name="Live Market", is_live=True,
            rng_seed=42, parent_timeline_id=None, owner_user_id=None,
        ))
        session.flush()

    for user_data in USERS:
        user = session.query(User).filter_by(email=user_data["email"]).first()
        existing = session.query(Portfolio).filter_by(user_id=user.id, timeline_id=1).first()
        if existing is None:
            session.add(Portfolio(
                user_id=user.id, timeline_id=1,
                cash_balance=user_data["starting_cash"],
            ))


def main() -> None:
    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim",
    )
    engine = create_engine(database_url)
    with Session(engine) as session:
        seed(session)
        session.commit()
    print("seed_demo.py done.")


if __name__ == "__main__":
    main()
