"""Seed demo users, portfolios, and sample transactions."""

import os

import bcrypt
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

# Path setup handled by run_all.py entry point

from db.models import Portfolio, Timeline, User

USER_DEFS = [
    {"email": "alice@example.com", "display_name": "Alice", "role": "admin", "starting_cash": 100_000},
    {"email": "bob@example.com", "display_name": "Bob", "role": "user", "starting_cash": 100_000},
    {"email": "charlie@example.com", "display_name": "Charlie", "role": "user", "starting_cash": 100_000},
]


def seed(session: Session) -> None:
    password_hash = bcrypt.hashpw(b"demo", bcrypt.gensalt()).decode()
    for ud in USER_DEFS:
        existing = session.query(User).filter_by(email=ud["email"]).first()
        if existing is None:
            session.add(User(
                email=ud["email"],
                hashed_password=password_hash,
                display_name=ud["display_name"],
                role=ud["role"],
                starting_cash=ud["starting_cash"],
            ))
    session.flush()

    timeline = session.query(Timeline).filter_by(id=1).first()
    if timeline is None:
        session.add(Timeline(
            id=1, name="Live Market", is_live=True,
            rng_seed=42, parent_timeline_id=None, owner_user_id=None,
        ))
        session.flush()

    for ud in USER_DEFS:
        user = session.query(User).filter_by(email=ud["email"]).first()
        existing = session.query(Portfolio).filter_by(user_id=user.id, timeline_id=1).first()
        if existing is None:
            session.add(Portfolio(
                user_id=user.id, timeline_id=1,
                cash_balance=ud["starting_cash"],
                total_value=ud["starting_cash"],
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
