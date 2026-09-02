"""SQLite for analytics, conversations, sent mail and admin sessions. One connection per
thread (sqlite3 objects are not shareable), WAL mode so readers never block the writer.
Schema lives here and is applied on import; every other module just runs SQL through q()/x()."""
import os
import sqlite3
import threading
import time

import config

_local = threading.local()
_lock = threading.Lock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS visitors (vid TEXT PRIMARY KEY, first_ts REAL, last_ts REAL, ip TEXT, country TEXT, ua TEXT, views INTEGER DEFAULT 0, sessions INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, vid TEXT, start_ts REAL, last_ts REAL, seconds REAL DEFAULT 0, ip TEXT, country TEXT, ua TEXT, referrer TEXT, width INTEGER, sections TEXT DEFAULT '', clicks INTEGER DEFAULT 0, chats INTEGER DEFAULT 0, contacts INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, ts REAL, vid TEXT, sid TEXT, kind TEXT, detail TEXT);
CREATE INDEX IF NOT EXISTS events_sid ON events(sid, ts);
CREATE INDEX IF NOT EXISTS events_ts ON events(ts);
CREATE TABLE IF NOT EXISTS requests (id INTEGER PRIMARY KEY, ts REAL, ip TEXT, country TEXT, method TEXT, path TEXT, status INTEGER, ua TEXT, referrer TEXT, klass TEXT, bot TEXT);
CREATE INDEX IF NOT EXISTS requests_ts ON requests(ts);
CREATE INDEX IF NOT EXISTS requests_bot ON requests(klass, bot, ts);
CREATE TABLE IF NOT EXISTS ingest (name TEXT PRIMARY KEY, inode INTEGER, offset INTEGER);
CREATE TABLE IF NOT EXISTS conversations (id INTEGER PRIMARY KEY, vid TEXT, sid TEXT, start_ts REAL, last_ts REAL, ip TEXT, country TEXT, ua TEXT, turns INTEGER DEFAULT 0, notified_ts REAL);
CREATE INDEX IF NOT EXISTS conversations_last ON conversations(last_ts);
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, conv_id INTEGER, ts REAL, role TEXT, content TEXT, tokens INTEGER, tps REAL, ms INTEGER);
CREATE INDEX IF NOT EXISTS messages_conv ON messages(conv_id, ts);
CREATE TABLE IF NOT EXISTS emails (id INTEGER PRIMARY KEY, ts REAL, kind TEXT, to_addr TEXT, reply_to TEXT, subject TEXT, body TEXT, ip TEXT, vid TEXT, ok INTEGER, error TEXT);
CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, created_ts REAL, last_ts REAL, ip TEXT, ua TEXT);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, ts REAL, ip TEXT, ua TEXT, action TEXT, detail TEXT);
"""


def conn() -> sqlite3.Connection:
    c = getattr(_local, 'conn', None)
    if c is None:
        c = sqlite3.connect(config.DB_PATH, timeout=10, isolation_level=None)  # autocommit
        c.row_factory = sqlite3.Row
        c.execute('PRAGMA journal_mode=WAL')
        c.execute('PRAGMA synchronous=NORMAL')
        c.execute('PRAGMA busy_timeout=10000')
        _local.conn = c
    return c


def q(sql: str, args=()) -> list[dict]:
    """SELECT -> list of dicts."""
    return [dict(r) for r in conn().execute(sql, args).fetchall()]


def one(sql: str, args=()):
    rows = q(sql, args)
    return rows[0] if rows else None


def x(sql: str, args=()) -> int:
    """INSERT/UPDATE/DELETE -> lastrowid. Serialised so concurrent threads never fight for the write lock."""
    with _lock:
        return conn().execute(sql, args).lastrowid


def now() -> float:
    return time.time()


def init():
    os.makedirs(os.path.dirname(config.DB_PATH), exist_ok=True)
    fresh = not os.path.exists(config.DB_PATH)
    conn().executescript(SCHEMA)
    for table in ('visitors', 'sessions', 'conversations', 'requests', 'audit', 'emails'):
        if not any(c['name'] == 'loc' for c in q(f'PRAGMA table_info({table})')):
            x(f'ALTER TABLE {table} ADD COLUMN loc TEXT DEFAULT \'\'')
    if fresh:
        os.chmod(config.DB_PATH, 0o600)


init()
