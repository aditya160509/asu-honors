"""Verify DB config parameter values."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from sqlalchemy import create_engine, text
engine = create_engine(os.environ.get('DATABASE_URL', 'sqlite:///stocksim.db'))
with engine.connect() as conn:
    rows = conn.execute(text("SELECT key, value FROM config_parameters WHERE scope='global' ORDER BY key")).all()
    for k, v in rows:
        print(f'{k}={v}')
