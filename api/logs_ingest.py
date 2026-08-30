"""Pull Caddy's JSON access log into the requests table every LOG_INGEST_S seconds, tracking
the file offset (and inode, for log rotation) so each line is read once. This is how bot and
AI-crawler traffic becomes visible: crawlers never run the beacon, but every request they make
lands in this log with its User-Agent and the CF-IPCountry header Cloudflare adds."""
import calendar
import json
import os
import re
import threading
import time

import bots
import config
import db

SKIP_PREFIX = ('/api/beacon',)
_STAMP = re.compile(r'^(\d{4})/(\d{2})/(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?')  # console-format prefix, UTC


def _stamp(line: str) -> float | None:
    m = _STAMP.match(line)
    if not m:
        return None
    y, mo, d, h, mi, sec = (int(x) for x in m.groups()[:6])
    return calendar.timegm((y, mo, d, h, mi, sec, 0, 0, 0)) + (float('0.' + m.group(7)) if m.group(7) else 0.0)


def _parse(line: str):
    i = line.find('{')
    if i < 0:
        return None
    try:
        rec = json.loads(line[i:])
    except ValueError:
        return None
    req = rec.get('request') or {}
    h = req.get('headers') or {}
    hv = lambda k: (h.get(k) or [''])[0]
    path = req.get('uri') or ''
    if path.startswith(SKIP_PREFIX):
        return None
    ua = hv('User-Agent')
    klass, bot = bots.classify(ua)
    ip = hv('Cf-Connecting-Ip') or req.get('client_ip') or req.get('remote_ip') or ''
    return (rec.get('ts') or _stamp(line) or time.time(), ip, hv('Cf-Ipcountry'), req.get('method') or '', path[:300], int(rec.get('status') or 0), ua[:300], hv('Referer')[:300], klass, bot)


def ingest_once() -> int:
    path = config.ACCESS_LOG
    try:
        st = os.stat(path)
    except OSError:
        return 0
    state = db.one('SELECT inode, offset FROM ingest WHERE name=?', ('access',)) or {'inode': None, 'offset': 0}
    offset = state['offset'] if state['inode'] == st.st_ino and state['offset'] <= st.st_size else 0
    rows = []
    with open(path, 'rb') as fh:
        fh.seek(offset)
        for raw in fh:
            if not raw.endswith(b'\n'):
                break  # partial line still being written; pick it up next time
            offset += len(raw)
            parsed = _parse(raw.decode('utf-8', 'replace'))
            if parsed:
                rows.append(parsed)
    for r in rows:
        db.x('INSERT INTO requests (ts, ip, country, method, path, status, ua, referrer, klass, bot) VALUES (?,?,?,?,?,?,?,?,?,?)', r)
    db.x('INSERT INTO ingest (name, inode, offset) VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET inode=excluded.inode, offset=excluded.offset', ('access', st.st_ino, offset))
    return len(rows)


def _loop():
    while True:
        try:
            ingest_once()
        except Exception as exc:
            print(f'log ingest error: {type(exc).__name__}: {exc}', flush=True)
        time.sleep(config.LOG_INGEST_S)


def start():
    threading.Thread(target=_loop, name='log-ingest', daemon=True).start()
