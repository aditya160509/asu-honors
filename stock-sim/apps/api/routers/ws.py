"""Realtime notifications without an external pub/sub service."""

import asyncio
from queue import Empty

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from apps.api.auth import _decode_token
from apps.api.ws_manager import subscribe, unsubscribe

router = APIRouter(prefix="/api/v1/ws", tags=["Realtime"])


@router.websocket("/notifications")
async def notifications_ws(websocket: WebSocket, token: str = Query(...)) -> None:
    try:
        user_id = int(_decode_token(token)["sub"])
    except Exception:
        await websocket.close(code=4401)
        return
    await websocket.accept()
    channel = subscribe(user_id)
    try:
        while True:
            try:
                message = await asyncio.to_thread(channel.get, True, 0.5)
            except Empty:
                continue
            await websocket.send_text(message)
    except (WebSocketDisconnect, RuntimeError, asyncio.CancelledError):
        pass
    finally:
        unsubscribe(user_id, channel)
