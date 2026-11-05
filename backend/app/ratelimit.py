"""Tiny in-memory sliding-window rate limiter (per process). Good enough for one Render instance;
use Redis if you ever run several instances."""
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_hits: dict[str, deque[float]] = defaultdict(deque)
_lock = threading.Lock()


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")  # set by Render / nginx
    return fwd.split(",")[0].strip() or (request.client.host if request.client else "unknown")


def limit(key: str, max_calls: int, per_seconds: float) -> None:
    now = time.monotonic()
    with _lock:
        q = _hits[key]
        while q and now - q[0] > per_seconds:
            q.popleft()
        if len(q) >= max_calls:
            raise HTTPException(429, "Too many requests - slow down and try again in a minute")
        q.append(now)


def reset() -> None:  # used by tests
    with _lock:
        _hits.clear()
