"""First-party analytics beacon. site/js/track.js POSTs small JSON events here; this validates
them hard (unknown kinds, oversized strings and malformed ids are dropped) and updates the
visitor / session / event tables. Ids are random hex the browser made up; they identify a
browser (vid, localStorage) and a tab (sid, sessionStorage) and nothing else."""
import json
import re

import bots
import config
import db

_ID = re.compile(r'^[0-9a-f]{16,32}$')
_SECTIONS = {'base', 'about', 'machine', 'contact'}


def _s(v, n=200):
    return v[:n] if isinstance(v, str) else ''


def record(payload, ip: str, country: str, ua: str):
    """Returns True if the beacon was accepted. Never raises on bad input."""
    if not isinstance(payload, dict):
        return False
    vid, sid, kind = payload.get('vid'), payload.get('sid'), payload.get('kind')
    if not (isinstance(vid, str) and _ID.match(vid) and isinstance(sid, str) and _ID.match(sid) and kind in config.BEACON_EVENTS):
        return False
    if bots.classify(ua)[0] != 'human':
        return False  # bots with JS get logged via the access log instead
    ts = db.now()
    detail = _s(payload.get('detail'), 300)
    if not db.one('SELECT vid FROM visitors WHERE vid=?', (vid,)):
        db.x('INSERT INTO visitors (vid, first_ts, last_ts, ip, country, ua) VALUES (?,?,?,?,?,?)', (vid, ts, ts, ip, country, ua[:300]))
    if not db.one('SELECT sid FROM sessions WHERE sid=?', (sid,)):
        w = payload.get('width')
        db.x('INSERT INTO sessions (sid, vid, start_ts, last_ts, ip, country, ua, referrer, width) VALUES (?,?,?,?,?,?,?,?,?)',
             (sid, vid, ts, ts, ip, country, ua[:300], _s(payload.get('ref'), 300), int(w) if isinstance(w, (int, float)) else None))
        db.x('UPDATE visitors SET sessions = sessions + 1 WHERE vid=?', (vid,))
    db.x('UPDATE visitors SET last_ts=?, ip=?, country=? WHERE vid=?', (ts, ip, country, vid))
    db.x('UPDATE sessions SET last_ts=? WHERE sid=?', (ts, sid))
    if kind == 'view':
        db.x('UPDATE visitors SET views = views + 1 WHERE vid=?', (vid,))
    elif kind == 'section' and detail in _SECTIONS:
        row = db.one('SELECT sections FROM sessions WHERE sid=?', (sid,))
        seen = [s for s in (row['sections'] or '').split(',') if s]
        if detail not in seen:
            db.x('UPDATE sessions SET sections=? WHERE sid=?', (','.join(seen + [detail]), sid))
    elif kind == 'click':
        db.x('UPDATE sessions SET clicks = clicks + 1 WHERE sid=?', (sid,))
    elif kind == 'chat':
        db.x('UPDATE sessions SET chats = chats + 1 WHERE sid=?', (sid,))
    elif kind == 'contact':
        db.x('UPDATE sessions SET contacts = contacts + 1 WHERE sid=?', (sid,))
    elif kind in ('leave', 'ping'):
        secs = payload.get('seconds')
        if isinstance(secs, (int, float)) and 0 <= secs <= 86400:
            db.x('UPDATE sessions SET seconds = MAX(seconds, ?) WHERE sid=?', (float(secs), sid))
    if kind not in ('ping',):
        db.x('INSERT INTO events (ts, vid, sid, kind, detail) VALUES (?,?,?,?,?)', (ts, vid, sid, kind, detail))
    return True


def parse(raw: bytes):
    try:
        return json.loads(raw.decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        return None
