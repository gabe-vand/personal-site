"""Read-only SQL behind the admin views. Every function returns plain dicts/lists ready to
JSON-encode. Time windows are in days; 0 means everything."""
import time

import bots
import db


def _since(days: int) -> float:
    return 0.0 if not days else db.now() - days * 86400


def _day(ts: float) -> str:
    return time.strftime('%Y-%m-%d', time.localtime(ts))


def overview(days: int) -> dict:
    s = _since(days)
    h = db.one('SELECT COUNT(*) AS sessions, COUNT(DISTINCT vid) AS visitors, COALESCE(SUM(seconds),0) AS seconds, '
               'COALESCE(SUM(chats),0) AS chats, COALESCE(SUM(contacts),0) AS contacts, COALESCE(SUM(clicks),0) AS clicks FROM sessions WHERE start_ts>?', (s,))
    bots_ = {r['klass']: r['n'] for r in db.q('SELECT klass, COUNT(*) AS n FROM requests WHERE ts>? GROUP BY klass', (s,))}
    emails = db.one('SELECT COUNT(*) AS n, COALESCE(SUM(ok),0) AS ok FROM emails WHERE ts>?', (s,))
    convos = db.one('SELECT COUNT(*) AS n FROM conversations WHERE start_ts>?', (s,))['n']
    daily: dict[str, dict] = {}
    for r in db.q('SELECT start_ts FROM sessions WHERE start_ts>?', (s,)):
        daily.setdefault(_day(r['start_ts']), {'humans': 0, 'ai': 0, 'search': 0})['humans'] += 1
    for r in db.q('SELECT ts, klass FROM requests WHERE ts>? AND klass IN (?,?)', (s, 'ai', 'search')):
        daily.setdefault(_day(r['ts']), {'humans': 0, 'ai': 0, 'search': 0})[r['klass']] += 1
    return {'humans': h, 'bots': bots_, 'emails': emails, 'conversations': convos, 'daily': [{'day': k, **v} for k, v in sorted(daily.items())]}


def sessions(days: int, limit: int = 300) -> list:
    rows = db.q('SELECT s.*, v.sessions AS visits, v.first_ts AS first_seen FROM sessions s LEFT JOIN visitors v ON v.vid=s.vid '
                'WHERE s.start_ts>? ORDER BY s.start_ts DESC LIMIT ?', (_since(days), limit))
    for r in rows:
        r['device'] = bots.describe(r['ua'])
    return rows


def visitor(vid: str) -> dict | None:
    v = db.one('SELECT * FROM visitors WHERE vid=?', (vid,))
    if not v:
        return None
    v['device'] = bots.describe(v['ua'])
    v['sessions_list'] = db.q('SELECT * FROM sessions WHERE vid=? ORDER BY start_ts DESC', (vid,))
    v['events'] = db.q('SELECT ts, sid, kind, detail FROM events WHERE vid=? ORDER BY ts DESC LIMIT 500', (vid,))
    v['conversations'] = db.q('SELECT id, start_ts, last_ts, turns FROM conversations WHERE vid=? ORDER BY start_ts DESC', (vid,))
    v['emails'] = db.q('SELECT id, ts, kind, subject, ok FROM emails WHERE vid=? ORDER BY ts DESC', (vid,))
    return v


def clicks(days: int) -> list:
    return db.q('SELECT detail, COUNT(*) AS n, MAX(ts) AS last_ts FROM events WHERE kind=? AND ts>? GROUP BY detail ORDER BY n DESC LIMIT 100', ('click', _since(days)))


def sections(days: int) -> dict:
    counts: dict[str, int] = {}
    for r in db.q('SELECT sections FROM sessions WHERE start_ts>?', (_since(days),)):
        for sec in (r['sections'] or '').split(','):
            if sec:
                counts[sec] = counts.get(sec, 0) + 1
    return counts


def ai(days: int) -> dict:
    s = _since(days)
    per_bot = db.q('SELECT klass, bot, COUNT(*) AS hits, MIN(ts) AS first_ts, MAX(ts) AS last_ts, COUNT(DISTINCT path) AS paths '
                   'FROM requests WHERE ts>? AND klass!=? GROUP BY klass, bot ORDER BY hits DESC', (s, 'human'))
    recent = db.q('SELECT ts, ip, country, loc, method, path, status, klass, bot, ua FROM requests WHERE ts>? AND klass!=? ORDER BY ts DESC LIMIT 300', (s, 'human'))
    paths = db.q('SELECT path, COUNT(*) AS n FROM requests WHERE ts>? AND klass=? GROUP BY path ORDER BY n DESC LIMIT 30', (s, 'ai'))
    daily: dict[str, dict] = {}
    for r in db.q('SELECT ts, klass FROM requests WHERE ts>? AND klass!=?', (s, 'human')):
        daily.setdefault(_day(r['ts']), {})
        daily[_day(r['ts'])][r['klass']] = daily[_day(r['ts'])].get(r['klass'], 0) + 1
    return {'bots': per_bot, 'recent': recent, 'ai_paths': paths, 'daily': [{'day': k, **v} for k, v in sorted(daily.items())]}


def emails(days: int) -> list:
    return db.q('SELECT * FROM emails WHERE ts>? ORDER BY ts DESC LIMIT 500', (_since(days),))


def conversations(days: int) -> list:
    rows = db.q('SELECT c.*, (SELECT content FROM messages m WHERE m.conv_id=c.id AND m.role=? ORDER BY m.id LIMIT 1) AS first_q '
                'FROM conversations c WHERE c.start_ts>? ORDER BY c.start_ts DESC LIMIT 500', ('user', _since(days)))
    for r in rows:
        r['device'] = bots.describe(r['ua'])
    return rows


def conversation(cid: int) -> dict | None:
    c = db.one('SELECT * FROM conversations WHERE id=?', (cid,))
    if not c:
        return None
    c['device'] = bots.describe(c['ua'])
    c['messages'] = db.q('SELECT id, ts, role, content, tokens, tps, ms FROM messages WHERE conv_id=? ORDER BY id', (cid,))
    c['session'] = db.one('SELECT * FROM sessions WHERE sid=?', (c['sid'],)) if c['sid'] else None
    c['visitor'] = db.one('SELECT * FROM visitors WHERE vid=?', (c['vid'],)) if c['vid'] else None
    return c

