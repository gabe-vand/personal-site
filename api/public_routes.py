"""Public endpoints: /status, /health, /chat (SSE), /contact, /beacon. Each handler gets the
request object `h` (see server.py for its helpers) and must send exactly one response."""
import time

import chat
import config
import limits
import mail
import telemetry
import track

SSE_HEADERS = {'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no'}


def status(h, _path):
    h.send_json(200, telemetry.snapshot())


def health(h, _path):
    h.send_json(200, {'ok': True})


def beacon(h, _path):
    payload = h.read_json(config.BEACON_MAX_BYTES)
    ok = track.record(payload, h.client_ip(), h.country(), h.ua())
    h.send_json(200 if ok else 400, {'ok': ok})


def contact(h, _path):
    payload = h.read_json()
    clean, err = mail.validate(payload)
    if err:
        return h.send_json(400, {'error': err})
    if not limits.contact_allow(h.client_ip()):
        return h.send_json(429, {'error': 'That is enough messages for now. Email me directly instead.'})
    vid = payload.get('vid') if isinstance(payload, dict) and isinstance(payload.get('vid'), str) else ''
    err = mail.send(clean, h.client_ip(), vid=vid[:32])
    if err:
        return h.send_json(500, {'error': err})  # not 502/503: Cloudflare replaces those bodies
    h.send_json(200, {'ok': True})


def chat_route(h, _path):
    payload = h.read_json()
    try:
        history = chat.clean_history(payload.get('messages'))
    except (ValueError, AttributeError):
        return h.send_json(400, {'error': 'Bad request or message too long.'})
    ids = {k: (payload.get(k) if isinstance(payload.get(k), str) else '')[:32] for k in ('vid', 'sid')}
    meta = {**ids, 'ip': h.client_ip(), 'country': h.country(), 'ua': h.ua()}
    wait = limits.take_token(h.client_ip())
    if wait > 0:
        return h.send_json(429, {'error': f'You have asked a lot in a short time. Try again in {int(wait) + 1} seconds.'})
    if not limits.global_allow():
        return h.send_json(429, {'error': 'The board is popular right now. Try again in a few minutes.'})
    if not limits.try_enter_queue():
        return h.send_json(503, {'error': 'Two people are already waiting on the one slot. Try again in a minute.'})
    try:
        _stream(h, history, meta)
    finally:
        limits.leave_queue()


def _stream(h, history, meta):
    h.send_response(200)
    for key, value in SSE_HEADERS.items():
        h.send_header(key, value)
    h.end_headers()
    if not _wait_for_slot(h):
        h.write(chat.sse('error', {'message': 'Still busy after a long wait. Try again shortly.'}))
        return
    try:
        for event in chat.stream(history, meta):
            if not h.write(event):
                break  # visitor left; dropping the upstream connection cancels generation
    finally:
        limits.release_slot()


def _wait_for_slot(h):
    deadline = time.monotonic() + config.WAIT_TIMEOUT_S
    first = True
    while True:
        if limits.acquire_slot(timeout=0.5 if first else 5.0):
            return True
        note = chat.sse('status', {'state': 'queued', 'ahead': max(0, limits.waiting_count() - 1)}) if first else b': waiting\n\n'
        first = False
        if not h.write(note) or time.monotonic() > deadline:
            return False


ROUTES = [
    ('GET', '/status', status), ('GET', '/health', health),
    ('POST', '/chat', chat_route), ('POST', '/contact', contact), ('POST', '/beacon', beacon),
]
