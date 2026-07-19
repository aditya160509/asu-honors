"""Update stale DB config values to match current code defaults."""

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from db.models import ConfigParameter

DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///stocksim.db')

UPDATES = {
    'k_drift': '0.10',
    'growth_rate_min': '1.0',
    'vol_leverage_factor': '0.2',
    'w_vo': '0.10',
    'w_ns': '0.25',
    'w_eo': '0.25',
    'kyle_lambda_scale': '0.00005',
    'fair_pe_baseline': '10.0',
}

engine = create_engine(DATABASE_URL)
with Session(engine) as session:
    for key, new_val in UPDATES.items():
        row = session.query(ConfigParameter).filter_by(key=key, scope='global').first()
        if row is not None:
            row.value = new_val
            print(f'{key}: updated -> {new_val}')
        else:
            session.add(ConfigParameter(key=key, value=new_val, scope='global', description=''))
            print(f'{key}: inserted -> {new_val}')
    session.commit()

print('Done.')
