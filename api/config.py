"""Tunables for the site API. Numbers only; the model's personality is in persona.py.

Why a proxy at all: llama.cpp on :8080 has ONE slot and an API key. The
browser must never hold that key, and one impatient visitor must never be
able to pin the GPU. So the page talks to this process, which holds the key,
fixes the system prompt, caps output length, and queues politely.
"""
import os

UPSTREAM = 'http://127.0.0.1:8080'
API_KEY_PATH = '/etc/oracle-llm/api-key'
LISTEN_HOST = '127.0.0.1'
LISTEN_PORT = 8002

# Generation
MODEL_ALIAS = 'oracle-local'
MAX_TOKENS = 260            # ~10 tok/s on this board, so ~26 s worst case
TEMPERATURE = 0.7
MAX_MESSAGE_CHARS = 500     # per message, either role
MAX_HISTORY = 6             # messages kept from the client (system prompt is added here)
MAX_BODY_BYTES = 8192

# Queueing: the model serves one request at a time. Let a couple of people
# wait behind it, turn everyone else away quickly with a clear message.
MAX_WAITING = 2
WAIT_TIMEOUT_S = 45
UPSTREAM_CONNECT_S = 5
UPSTREAM_READ_S = 90

# Rate limits (per visitor IP as reported by Cloudflare, and site-wide)
PER_IP_CAPACITY = 6
PER_IP_REFILL_S = 60        # one new question per minute after the burst is spent
GLOBAL_PER_10MIN = 40
GLOBAL_PER_DAY = 600

# Telemetry
TELEMETRY_CACHE_S = 2.0
TPS_TYPICAL = 10.6          # measured tok/s on this board; shown until there is real history
TPS_WINDOW = 20             # generations averaged for the panel's speed
TPS_STATE_PATH = os.path.expanduser('~/.local/state/site-api/tps')
MODEL_INFO_CACHE_S = 600.0
HOSTNAME = 'orin · on my desk'   # label in the panel, not the real hostname
BOARD = 'NVIDIA Jetson Orin Nano Super (8 GB)'

# Contact form (api/mail.py). Zoho SMTP with the site's own mailbox; secret file is
# KEY=VALUE lines (SMTP_USER, SMTP_PASS), mode 600 in ~/.config/site-api.
SMTP_HOST = 'smtp.zoho.com'
IMAP_HOST = 'imap.zoho.com'   # used only to delete the Sent copy of the board's own mails
SMTP_PORT = 465
SMTP_TIMEOUT_S = 20
SMTP_SECRET_PATH = '/home/gabevandevere/.config/site-api/smtp'
CONTACT_TO = 'gabe@gabevandevere.com'
CONTACT_MAX_SUBJECT = 120
CONTACT_MAX_BODY = 2000
CONTACT_PER_IP_PER_HOUR = 3
CONTACT_PER_DAY = 40

# Analytics, conversations, admin (api/db.py and friends). SQLite, not Postgres: this board has
# ~150 MB free with the model loaded and a database daemon would be the first thing the kernel
# kills. One 0600 file in the service's state directory is plenty.
DB_PATH = os.path.expanduser('~/.local/state/site-api/site.db')
ACCESS_LOG = os.path.expanduser('~/gabevandevere.com/access.log')
LOG_INGEST_S = 30                 # how often new access-log lines are pulled into the db
ADMIN_SECRET_PATH = os.path.expanduser('~/.config/site-api/admin')       # ADMIN_EMAIL, ADMIN_SALT, ADMIN_HASH, TOTP_SECRET, TOTP_ENABLED
CF_READ_TOKEN_PATH = os.path.expanduser('~/.config/site-api/cf-token-read')  # Zone Analytics:Read token (optional)
CF_ZONE_ID = 'c965a66f1a52994158bf8781806ce30d'
ADMIN_SESSION_S = 12 * 3600       # sliding session lifetime
ADMIN_LOGIN_MAX = 5               # failed logins per window per IP before lockout
ADMIN_LOGIN_WINDOW_S = 15 * 60
ADMIN_LOGIN_GLOBAL_MAX = 20       # failed logins per window from anywhere
ADMIN_COOKIE = 'gv_admin'
BEACON_MAX_BYTES = 4096
BEACON_EVENTS = {'view', 'section', 'click', 'chip', 'chat', 'contact', 'leave', 'ping'}
CONVO_IDLE_NOTIFY_S = 5 * 60      # email Gabe this long after a conversation's last message
NOTIFY_TO = 'gabe@gabevandevere.com'
ADMIN_URL = 'https://gabevandevere.com/admin/'
