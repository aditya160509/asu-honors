"""Realtime notification push -- a thin WebSocket layer over the same Redis
pub/sub channel apps/api/ws_manager.py publishes to. Polling (RecentActivity's
useNotifications, 15s interval) remains the source of truth and works with
zero backend changes if this connection never opens or drops; this exists
purely to cut that worst-case 15s staleness down to near-instant for a
client that's actively connected.

Browsers can't set custom headers on a WebSocket handshake, so the JWT is
passed as a query param (?token=...) instead of the usual Authorization
header get_current_user reads.
"""

import json
import logging

import redis.asyncio as aioredis
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from apps.api.auth import _decode_token
from apps.api.config import settings
from apps.api.ws_manager import user_channel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ws", tags=["Realtime"])

_CONNECT_TIMEOUT_SECONDS = 2.0


@router.websocket("/notifications")
async def notifications_ws(websocket: WebSocket, token: str = Query(...)) -> None:
    try:
        payload = _decode_token(token)
        user_id = int(payload["sub"])
    except Exception:
        await websocket.close(code=4401)
        return

    await websocket.accept()

    try:
        client = aioredis.from_url(
            settings.redis_url,
            socket_connect_timeout=_CONNECT_TIMEOUT_SECONDS,
            socket_timeout=_CONNECT_TIMEOUT_SECONDS,
        )
        pubsub = client.pubsub()
        await pubsub.subscribe(user_channel(user_id))
    except Exception:
        # Redis unreachable -- close rather than hang; the client's
        # useNotifications polling keeps working regardless.
        logger.debug("Realtime push unavailable for user %s -- closing WS", user_id, exc_info=True)
        await websocket.close(code=1011)
        return

    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            data = message["data"]
            await websocket.send_text(data.decode() if isinstance(data, bytes) else data)
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.debug("Realtime push connection for user %s ended unexpectedly", user_id, exc_info=True)
    finally:
        try:
            await pubsub.unsubscribe(user_channel(user_id))
            await pubsub.close()
        finally:
            await client.close()
