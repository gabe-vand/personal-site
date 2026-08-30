"""Admin login. One account, credentials in a 0600 file outside the repo (ADMIN_SECRET_PATH):
the password is stored only as an scrypt hash. Sessions are 32 random bytes, stored hashed,
sent as an HttpOnly/Secure/SameSite=Strict cookie scoped to /api/admin. Failed logins are
rate-limited per IP and globally, audited, and answered slowly. TOTP (RFC 6238) is built in and
switched on with TOTP_ENABLED=1 in the secret file."""
import base64
import hashlib
import hmac
import secrets
import struct
import time

import config
import db


def _secret() -> dict:
    try:
        with open(config.ADMIN_SECRET_PATH, encoding='utf-8') as fh:
            return dict(line.strip().split('=', 1) for line in fh if '=' in line and not line.startswith('#'))
    except OSError:
        return {}


def _hash(password: str, salt_hex: str) -> str:
    return hashlib.scrypt(password.encode('utf-8'), salt=bytes.fromhex(salt_hex), n=2 ** 14, r=8, p=1, dklen=32).hex()


def _totp(secret_b32: str, at: float) -> str:
    key = base64.b32decode(secret_b32.upper() + '=' * (-len(secret_b32) % 8))
    counter = struct.pack('>Q', int(at // 30))
    digest = hmac.new(key, counter, hashlib.sha1).digest()
    off = digest[-1] & 0x0F
    code = (struct.unpack('>I', digest[off:off + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f'{code:06d}'


def totp_required() -> bool:
    return _secret().get('TOTP_ENABLED', '0') == '1'


def audit(ip: str, ua: str, action: str, detail: str = ''):
    db.x('INSERT INTO audit (ts, ip, ua, action, detail) VALUES (?,?,?,?,?)', (db.now(), ip, (ua or '')[:300], action, detail[:300]))


def locked(ip: str) -> bool:
    since = db.now() - config.ADMIN_LOGIN_WINDOW_S
    mine = db.one('SELECT COUNT(*) AS n FROM audit WHERE action=? AND ip=? AND ts>?', ('login_fail', ip, since))['n']
    everyone = db.one('SELECT COUNT(*) AS n FROM audit WHERE action=? AND ts>?', ('login_fail', since))['n']
    return mine >= config.ADMIN_LOGIN_MAX or everyone >= config.ADMIN_LOGIN_GLOBAL_MAX


def login(email: str, password: str, code: str, ip: str, ua: str):
    """Returns (token, None) on success or (None, error). Always takes >= 0.5 s on failure."""
    started = time.monotonic()
    sec = _secret()
    if locked(ip):
        # Do NOT record this as another failure: a lockout must expire on its own, not renew itself while the user retries.
        time.sleep(0.5)
        return None, 'Too many attempts. Try again in 15 minutes.'
    ok = bool(sec)
    if ok:
        want_email = sec.get('ADMIN_EMAIL', '')
        ok = hmac.compare_digest(email.strip().lower().encode(), want_email.lower().encode())
    if ok:
        ok = hmac.compare_digest(_hash(password, sec['ADMIN_SALT']), sec['ADMIN_HASH'])
    if ok and sec.get('TOTP_ENABLED') == '1':
        now = time.time()
        ok = any(hmac.compare_digest(_totp(sec['TOTP_SECRET'], now + d), (code or '').strip()) for d in (-30, 0, 30))
    if not ok:
        audit(ip, ua, 'login_fail', email[:100])
        time.sleep(max(0, 0.5 - (time.monotonic() - started)))
        return None, 'Wrong email, password or code.' if not locked(ip) else 'Too many attempts. Try again in 15 minutes.'
    token = secrets.token_urlsafe(32)
    db.x('INSERT INTO admin_sessions (token_hash, created_ts, last_ts, ip, ua) VALUES (?,?,?,?,?)', (_th(token), db.now(), db.now(), ip, (ua or '')[:300]))
    audit(ip, ua, 'login_ok')
    return token, None


def _th(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def check(token: str) -> bool:
    """Valid, unexpired session? Slides the expiry on success. Also prunes dead sessions."""
    if not token or len(token) > 64:
        return False
    now = db.now()
    db.x('DELETE FROM admin_sessions WHERE last_ts < ? OR created_ts < ?', (now - config.ADMIN_SESSION_S, now - 7 * 86400))
    row = db.one('SELECT token_hash FROM admin_sessions WHERE token_hash=?', (_th(token),))
    if not row:
        return False
    db.x('UPDATE admin_sessions SET last_ts=? WHERE token_hash=?', (now, row['token_hash']))
    return True


def logout(token: str):
    if token:
        db.x('DELETE FROM admin_sessions WHERE token_hash=?', (_th(token),))


def cookie(token: str, clear: bool = False) -> str:
    base = f'{config.ADMIN_COOKIE}={"" if clear else token}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict'
    return base + ('; Max-Age=0' if clear else f'; Max-Age={config.ADMIN_SESSION_S}')


def make_secret_file(email: str, password: str) -> str:
    """Used once from the shell to (re)create the secret file. Returns the otpauth URI for TOTP."""
    salt = secrets.token_hex(16)
    totp = base64.b32encode(secrets.token_bytes(20)).decode().rstrip('=')
    body = f'ADMIN_EMAIL={email}\nADMIN_SALT={salt}\nADMIN_HASH={_hash(password, salt)}\nTOTP_SECRET={totp}\nTOTP_ENABLED=0\n'
    import os
    os.makedirs(os.path.dirname(config.ADMIN_SECRET_PATH), exist_ok=True)
    fd = os.open(config.ADMIN_SECRET_PATH, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as fh:
        fh.write(body)
    return f'otpauth://totp/gabevandevere.com:{email}?secret={totp}&issuer=gabevandevere.com&digits=6&period=30'
