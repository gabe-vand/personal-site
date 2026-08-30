"""Contact form -> one email to Gabe, sent through Zoho SMTP with the site's own mailbox.

Credentials come from the file at config.SMTP_SECRET_PATH (KEY=VALUE lines: SMTP_USER,
SMTP_PASS), read on every send so a rotated password needs no restart. If the file is
missing the endpoint reports "mail not configured" and nothing is sent.
"""
import imaplib
import re
import smtplib
import threading
import time
from datetime import datetime
from zoneinfo import ZoneInfo
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

import config
import db

_EMAIL = re.compile(r'^[^@\s]{1,64}@[^@\s]{1,190}\.[a-zA-Z]{2,}$')


def creds():
    try:
        with open(config.SMTP_SECRET_PATH, encoding='utf-8') as fh:
            pairs = dict(line.strip().split('=', 1) for line in fh if '=' in line and not line.startswith('#'))
        return pairs['SMTP_USER'].strip(), pairs['SMTP_PASS'].strip()
    except (OSError, KeyError):
        return None


def validate(payload: dict):
    """Return (clean_dict, None) or (None, error_message)."""
    if not isinstance(payload, dict):
        return None, 'Bad request.'
    if payload.get('website'):  # honeypot field: humans never see it
        return None, 'Bad request.'
    subject = ' '.join(str(payload.get('subject') or '').split())[:config.CONTACT_MAX_SUBJECT] or 'Hello from your website'
    body = str(payload.get('body') or '').replace('\r\n', '\n').strip()
    reply_to = str(payload.get('from') or '').strip()[:254]
    if not body:
        return None, 'Say something first.'
    if len(body) > config.CONTACT_MAX_BODY:
        return None, f'Keep it under {config.CONTACT_MAX_BODY} characters.'
    if reply_to and not _EMAIL.match(reply_to):
        return None, 'That email address does not look right.'
    return {'subject': subject, 'body': body, 'from': reply_to}, None


def send_mail(to: str, subject: str, body: str, reply_to: str = '', kind: str = 'contact', ip: str = '', vid: str = '') -> str | None:
    """Send one plain-text email through Zoho and record it in the emails table (sent or not).
    Returns None on success or a short error for the visitor."""
    auth = creds()
    err = None
    if not auth:
        err = 'Mail is not set up on this board yet. Email me directly instead.'
    else:
        user, password = auth
        msg = EmailMessage()
        msg['From'] = formataddr(('gabevandevere.com', user))
        msg['To'] = to
        msg['Subject'] = subject
        if reply_to:
            msg['Reply-To'] = reply_to
        msg.set_content(body)
        msg['Message-ID'] = make_msgid(domain='gabevandevere.com')
        try:
            with smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT, timeout=config.SMTP_TIMEOUT_S) as smtp:
                smtp.login(user, password)
                smtp.send_message(msg)
            threading.Thread(target=_tidy_sent, args=(user, password, msg['Message-ID']), daemon=True).start()
        except (smtplib.SMTPException, OSError) as exc:
            print(f'mail FAILED {type(exc).__name__}: {exc}', flush=True)
            err = 'Sending failed on my end. Email me directly instead.'
    db.x('INSERT INTO emails (ts, kind, to_addr, reply_to, subject, body, ip, vid, ok, error) VALUES (?,?,?,?,?,?,?,?,?,?)',
         (db.now(), kind, to, reply_to, subject, body, ip, vid, 0 if err else 1, err))
    if err is None:
        print(f'mail sent kind={kind} to={to} subj={subject[:60]!r}', flush=True)
    return err


def _tidy_sent(user: str, password: str, msgid: str):
    """Zoho keeps a Sent copy of every SMTP submission; since these mails go from Gabe's address to
    Gabe's address, that copy shows up as a duplicate in his client. Delete it (the emails table
    keeps the record). Retries for a few seconds because Zoho files the copy shortly after acceptance."""
    for _ in range(4):
        time.sleep(4)
        try:
            with imaplib.IMAP4_SSL(config.IMAP_HOST, 993) as imap:
                imap.login(user, password)
                imap.select('Sent')
                typ, data = imap.search(None, 'HEADER', 'Message-ID', msgid)
                ids = data[0].split() if typ == 'OK' else []
                if not ids:
                    continue
                for i in ids:
                    imap.store(i, '+FLAGS', '\\Deleted')
                imap.expunge()
                return
        except (imaplib.IMAP4.error, OSError) as exc:
            print(f'sent-copy tidy failed: {type(exc).__name__}: {exc}', flush=True)
            return


def eastern_now() -> str:
    return datetime.now(ZoneInfo('America/New_York')).strftime('%a %b %-d, %Y %-I:%M %p %Z')


def send(clean: dict, ip: str, vid: str = '') -> str | None:
    """Contact-form message -> Gabe, with the visitor's address as Reply-To."""
    # No IP here: it would ride along in every reply. The admin's Emails tab keeps it.
    footer = f'\n\n--\nreply to: {clean["from"] or "(no address given)"}\nsent: {eastern_now()}'
    return send_mail(config.CONTACT_TO, f'[site] {clean["subject"]}', clean['body'] + footer, reply_to=clean['from'], kind='contact', ip=ip, vid=vid)
