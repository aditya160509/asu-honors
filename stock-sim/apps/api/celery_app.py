"""Future Lab (Section 11.7) — Celery application for async branch
fast-forward / sensitivity-sweep / Monte-Carlo ensemble jobs.

No Celery/broker infrastructure existed in this repo before Phase 4 (Redis
was listed as a dependency but never actually wired to anything) -- this
module is the whole of that infra: app config, task registration. Run a
worker with:

    celery -A apps.api.celery_app worker --loglevel=info

Broker/result backend both point at the same Redis instance by default
(REDIS_URL env var); override independently via CELERY_BROKER_URL /
CELERY_RESULT_BACKEND if you need separate instances in production.
"""

import os

from celery import Celery

from apps.api.config import settings

# REDIS_URL/CELERY_BROKER_URL/CELERY_RESULT_BACKEND env vars still override,
# for deployments that want a separate broker/backend instance -- but the
# default now comes from apps.api.config.settings (which itself reads .env),
# instead of a second, independent os.environ.get("REDIS_URL", ...) default
# that could silently drift out of sync with the one Settings reads.
REDIS_URL = os.environ.get("REDIS_URL", settings.redis_url)
BROKER_URL = os.environ.get("CELERY_BROKER_URL", REDIS_URL)
RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", REDIS_URL)

celery_app = Celery("stock_sim", broker=BROKER_URL, backend=RESULT_BACKEND)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Branch fast-forward/ensemble jobs can run for tens of seconds on a
    # long fast-forward -- do not silently drop results, and let a worker
    # crash mid-task be retried rather than lost (acks_late + no prefetch
    # hoarding for these CPU-bound, non-idempotent-until-status-checked jobs).
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_track_started=True,
    # A hung task (infinite loop, deadlocked DB query) would otherwise block
    # this project's single --pool=solo worker slot forever, since nothing
    # else preempts it -- soft limit lets the task catch SoftTimeLimitExceeded
    # and clean up; the hard limit force-kills it a bit later if it doesn't.
    # 10 minutes comfortably covers the largest realistic fast-forward
    # (estimate_branch_cost's own ESTIMATED_MS_PER_COMPANY_PER_TICK floor
    # puts even a 365-day/50-company branch at a few seconds).
    task_soft_time_limit=540,
    task_time_limit=600,
    # Retry the initial broker connection at worker startup instead of
    # crashing immediately if Redis isn't up yet (e.g. container ordering
    # races in docker-compose) -- Celery 6 changes this default to False,
    # so pin it explicitly rather than depend on the current default.
    broker_connection_retry_on_startup=True,
)

# apps.api.tasks is a flat module (not a package), so autodiscover_tasks
# (which expects "app.tasks" submodules under each listed package) doesn't
# apply here -- import it directly so its @celery_app.task-decorated
# functions register on this app.
celery_app.conf.imports = ("apps.api.tasks",)
