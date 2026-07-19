"""Update stale DB config values to match current code defaults."""

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///stocksim.db')

UPDATES = {
    'k_drift': '0.10',
    'growth_rate_min': '1.0',
    'vol_leverage_factor': '0.2',
    'w_vo': '0.10',
    'w_ns': '0.25',
    'w_eo': '0.25',
    'kyle_lambda_scale': '0.00005',
}

engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    for key, new_val in UPDATES.items():
        result = conn.execute(
            text("UPDATE config_parameters SET value = :val WHERE key = :key AND scope = 'global'"),
            {'val': new_val, 'key': key},
        )
        print(f'{key}: {result.rowcount} row(s) updated -> {new_val}')
    conn.commit()

print('Done. Run again to verify no stale rows remain.')
