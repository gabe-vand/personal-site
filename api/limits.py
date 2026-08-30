"""Rate limiting and the single-slot queue. Module-level state, no classes.

Why: the GPU serves one request at a time and this endpoint is on the public
internet. Fairness is the feature. Everything here is in-memory and resets
when the service restarts, which is fine for a personal site.
"""
import threading
import time
from collections import deque

import config

_lock = threading.Lock()
_buckets: dict[str, tuple[float, float]] = {}   # ip -> (tokens, last_refill_ts)
_ten_min: deque[float] = deque()
_day: deque[float] = deque()

_slot = threading.Semaphore(1)
_waiting = 0
_waiting_lock = threading.Lock()


def take_token(ip: str) -> float:
    """Return 0 if this IP may ask now, else seconds until it may."""
    now = time.monotonic()
    with _lock:
        tokens, last = _buckets.get(ip, (float(config.PER_IP_CAPACITY), now))
        tokens = min(config.PER_IP_CAPACITY, tokens + (now - last) / config.PER_IP_REFILL_S)
        if tokens >= 1.0:
            _buckets[ip] = (tokens - 1.0, now)
            _prune_buckets(now)
            return 0.0
        _buckets[ip] = (tokens, now)
        return (1.0 - tokens) * config.PER_IP_REFILL_S


def _prune_buckets(now: float) -> None:
    if len(_buckets) < 2000:
        return
    stale = [ip for ip, (_, last) in _buckets.items() if now - last > 3600]
    for ip in stale:
        del _buckets[ip]


def global_allow() -> bool:
    """Site-wide budget: keeps the board from running hot all night."""
    now = time.monotonic()
    with _lock:
        for window, span in ((_ten_min, 600), (_day, 86400)):
            while window and now - window[0] > span:
                window.popleft()
        if len(_ten_min) >= config.GLOBAL_PER_10MIN or len(_day) >= config.GLOBAL_PER_DAY:
            return False
        _ten_min.append(now)
        _day.append(now)
        return True


def try_enter_queue() -> bool:
    """Reserve a place in line. False means too many people are already waiting."""
    global _waiting
    with _waiting_lock:
        if _waiting >= config.MAX_WAITING:
            return False
        _waiting += 1
        return True


def leave_queue() -> None:
    global _waiting
    with _waiting_lock:
        _waiting = max(0, _waiting - 1)


def acquire_slot(timeout: float) -> bool:
    return _slot.acquire(timeout=timeout)


def release_slot() -> None:
    _slot.release()


def waiting_count() -> int:
    return _waiting


def slot_busy() -> bool:
    if _slot.acquire(blocking=False):
        _slot.release()
        return False
    return True


# Contact form: a small fixed window per IP plus a daily global cap. Sends are rare and
# each one costs an SMTP round trip, so this is deliberately tight.
_contact_lock = threading.Lock()
_contact_ip: dict[str, list[float]] = {}
_contact_day: list[float] = []


def contact_allow(ip: str) -> bool:
    now = time.monotonic()
    with _contact_lock:
        for key in [k for k, v in _contact_ip.items() if not v or v[-1] < now - 3600]:
            del _contact_ip[key]
        _contact_day[:] = [t for t in _contact_day if t > now - 86400]
        recent = [t for t in _contact_ip.get(ip, []) if t > now - 3600]
        if len(recent) >= config.CONTACT_PER_IP_PER_HOUR or len(_contact_day) >= config.CONTACT_PER_DAY:
            return False
        recent.append(now)
        _contact_ip[ip] = recent
        _contact_day.append(now)
        return True
