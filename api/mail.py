"""Contact form -> one email to Gabe, sent through Zoho SMTP with the site's own mailbox.

Credentials come from the file at config.SMTP_SECRET_PATH (KEY=VALUE lines: SMTP_USER,
SMTP_PASS), read on every send so a rotated password needs no restart. If the file is
missing the endpoint reports "mail not configured" and nothing is sent.
"""
import re
import smtplib
import time
from email.message import EmailMessage
from email.utils import formataddr

import config

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


def send(clean: dict, ip: str) -> str | None:
    """Send the message; return None on success or a short error for the visitor."""
    auth = creds()
    if not auth:
        return 'Mail is not set up on this board yet. Email me directly instead.'
    user, password = auth
    msg = EmailMessage()
    msg['From'] = formataddr(('gabevandevere.com', user))
    msg['To'] = config.CONTACT_TO
    msg['Subject'] = f'[site] {clean["subject"]}'
    if clean['from']:
        msg['Reply-To'] = clean['from']
    footer = f'\n\n--\nfrom: {clean["from"] or "(no address given)"}\nip: {ip}\nsent: {time.strftime("%Y-%m-%d %H:%M:%S %Z")}'
    msg.set_content(clean['body'] + footer)
    try:
        with smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT, timeout=config.SMTP_TIMEOUT_S) as smtp:
            smtp.login(user, password)
            smtp.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        print(f'mail FAILED {type(exc).__name__}: {exc}', flush=True)
        return 'Sending failed on my end. Email me directly instead.'
    print(f'mail sent from={clean["from"] or "-"} subj={clean["subject"][:60]!r}', flush=True)
    return None
