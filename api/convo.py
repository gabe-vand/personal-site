"""Chat conversations, CRM-style. chat.py records every turn here keyed by the browser's
visitor id + tab session id (same ids as the analytics beacon). A background thread emails
Gabe once a conversation has been idle for CONVO_IDLE_NOTIFY_S, with the whole thread and a
link to it in the admin UI, at most once per conversation."""
import threading
import time

import bots
import config
import db
import mail


def record_turn(meta: dict, question: str, answer: str, timings: dict):
    """meta: {vid, sid, ip, country, ua}. Anonymous chats (no ids) are still stored, under vid ''."""
    ts = db.now()
    vid, sid = meta.get('vid') or '', meta.get('sid') or ''
    row = db.one('SELECT id FROM conversations WHERE sid=? AND vid=? ORDER BY id DESC LIMIT 1', (sid, vid)) if sid else None
    if row:
        cid = row['id']
        db.x('UPDATE conversations SET last_ts=?, turns=turns+1 WHERE id=?', (ts, cid))
    else:
        cid = db.x('INSERT INTO conversations (vid, sid, start_ts, last_ts, ip, country, ua, turns) VALUES (?,?,?,?,?,?,?,1)',
                   (vid, sid, ts, ts, meta.get('ip', ''), meta.get('country', ''), (meta.get('ua') or '')[:300]))
    db.x('INSERT INTO messages (conv_id, ts, role, content) VALUES (?,?,?,?)', (cid, ts, 'user', question))
    db.x('INSERT INTO messages (conv_id, ts, role, content, tokens, tps, ms) VALUES (?,?,?,?,?,?,?)',
         (cid, ts, 'assistant', answer, timings.get('predicted_n'), timings.get('predicted_per_second'), timings.get('ms')))
    return cid


def _thread_text(cid: int) -> str:
    lines = []
    for m in db.q('SELECT role, content FROM messages WHERE conv_id=? ORDER BY id', (cid,)):
        lines.append(('Visitor: ' if m['role'] == 'user' else 'Machine: ') + m['content'].strip())
        lines.append('')
    return '\n'.join(lines)


def _notify(c: dict):
    sess = db.one('SELECT * FROM sessions WHERE sid=?', (c['sid'],)) if c['sid'] else None
    vis = db.one('SELECT * FROM visitors WHERE vid=?', (c['vid'],)) if c['vid'] else None
    first = db.one('SELECT content FROM messages WHERE conv_id=? AND role=? ORDER BY id LIMIT 1', (c['id'], 'user'))
    when = time.strftime('%Y-%m-%d %H:%M', time.localtime(c['start_ts']))
    info = [
        f"When: {when} ({c['turns']} exchange{'s' if c['turns'] != 1 else ''})",
        f"From: {c['country'] or '?'} · {c['ip'] or '?'} · {bots.describe(c['ua'])}",
    ]
    if vis:
        info.append(f"Visitor: seen {vis['sessions']} session(s) since {time.strftime('%Y-%m-%d', time.localtime(vis['first_ts']))}")
    if sess:
        info.append(f"This visit: {int(sess['seconds'] or 0)} s on page · sections {sess['sections'] or '-'} · referrer {sess['referrer'] or 'direct'}")
    subject = f"[site] Someone talked to the machine: {(first['content'] if first else '')[:60]}"
    body = 'A visitor chatted with the machine on gabevandevere.com.\n\n' + '\n'.join(info) + \
        f"\n\nView it (login required): {config.ADMIN_URL}#conversation/{c['id']}\n\n--- Conversation ---\n\n" + _thread_text(c['id'])
    err = mail.send_mail(config.NOTIFY_TO, subject, body, kind='notify', vid=c['vid'])
    db.x('UPDATE conversations SET notified_ts=? WHERE id=?', (db.now(), c['id']))
    print(f"convo {c['id']} notify -> {'sent' if err is None else err}", flush=True)


def _loop():
    while True:
        time.sleep(60)
        try:
            cutoff = db.now() - config.CONVO_IDLE_NOTIFY_S
            for c in db.q('SELECT * FROM conversations WHERE notified_ts IS NULL AND last_ts < ? ORDER BY id LIMIT 5', (cutoff,)):
                _notify(c)
        except Exception as exc:  # never let the notifier die
            print(f'convo notifier error: {type(exc).__name__}: {exc}', flush=True)


def start():
    threading.Thread(target=_loop, name='convo-notify', daemon=True).start()
