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
SMTP_PORT = 465
SMTP_TIMEOUT_S = 20
SMTP_SECRET_PATH = '/home/gabevandevere/.config/site-api/smtp'
CONTACT_TO = 'gabe@gabevandevere.com'
CONTACT_MAX_SUBJECT = 120
CONTACT_MAX_BODY = 2000
CONTACT_PER_IP_PER_HOUR = 3
CONTACT_PER_DAY = 40
