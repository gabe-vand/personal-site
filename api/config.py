"""Tunables for the site API. Numbers only; the model's personality is in persona.py.

Why a proxy at all: llama.cpp on :8080 has ONE slot and an API key. The
browser must never hold that key, and one impatient visitor must never be
able to pin the GPU. So the page talks to this process, which holds the key,
fixes the system prompt, caps output length, and queues politely.
"""

UPSTREAM = 'http://127.0.0.1:8080'
API_KEY_PATH = '/etc/oracle-llm/api-key'
LISTEN_HOST = '127.0.0.1'
LISTEN_PORT = 8002

# Generation
MODEL_ALIAS = 'oracle-local'
MAX_TOKENS = 220            # ~10 tok/s on this board, so ~20 s worst case
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
MODEL_INFO_CACHE_S = 600.0
HOSTNAME = 'orin'
BOARD = 'NVIDIA Jetson Orin Nano Super (8 GB)'
