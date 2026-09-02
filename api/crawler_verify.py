"""Is a request that claims to be Googlebot really from Google? The User-Agent is a string
anyone can send; the source IP is not. Big crawlers publish the DNS domain their crawler IPs
reverse-resolve to, so the check is: reverse-look up the IP, require the published suffix,
then forward-resolve that hostname and require it to contain the original IP. Both directions
must agree. Results are cached in the db for a month so each IP costs at most one lookup
pair, and no more than a handful of new IPs are resolved per admin page load.

Deterministic on purpose: DNS answers, no heuristics, no external APIs beyond the resolver."""
import socket

import db

# User-Agent needle -> reverse-DNS suffixes the vendor documents for its crawlers.
# Crawlers that publish IP lists instead of DNS (OpenAI, Anthropic, Perplexity, DuckDuckGo)
# are absent here: we report them as "unverifiable" rather than guess.
RDNS = [
    ('googlebot', ('.googlebot.com', '.google.com')), ('google-inspectiontool', ('.googlebot.com', '.google.com')),
    ('bingbot', ('.search.msn.com',)), ('bingpreview', ('.search.msn.com',)),
    ('yandex', ('.yandex.ru', '.yandex.net', '.yandex.com')), ('baiduspider', ('.baidu.com', '.baidu.jp')),
    ('applebot', ('.applebot.apple.com',)), ('slurp', ('.crawl.yahoo.net',)),
    ('ahrefsbot', ('.ahrefs.com', '.ahrefs.net')), ('petalbot', ('.petalsearch.com', '.aspiegel.com')),
]
CACHE_S = 30 * 86400
MAX_LOOKUPS_PER_CALL = 15


def claimed_suffixes(ua: str):
    low = (ua or '').lower()
    for needle, suffixes in RDNS:
        if needle in low:
            return suffixes
    return None


def _lookup(ip: str, suffixes) -> tuple[int, str]:
    """1 verified, 0 impostor, -1 could not resolve. Never raises."""
    try:
        host = socket.gethostbyaddr(ip)[0].lower()
    except (socket.herror, socket.gaierror, OSError):
        return 0, ''  # no reverse record at all: a real crawler always has one
    if not any(host.endswith(s) for s in suffixes):
        return 0, host
    try:
        forward = {ai[4][0] for ai in socket.getaddrinfo(host, None)}
    except (socket.gaierror, OSError):
        return -1, host
    return (1 if ip in forward else 0), host


def verify(ip: str, ua: str, budget: list) -> tuple[int | None, str]:
    """(verdict, hostname). verdict: 1 real, 0 impostor, -1 unresolved, None not verifiable
    from DNS for this crawler. `budget` is a one-element list of remaining lookups for this
    call, so a page load never waits on more than a few resolver round-trips."""
    suffixes = claimed_suffixes(ua)
    if not suffixes or not ip:
        return None, ''
    row = db.one('SELECT verdict, host, checked_ts FROM crawler_dns WHERE ip=?', (ip,))
    if row and row['checked_ts'] > db.now() - CACHE_S and row['verdict'] != -1:
        return row['verdict'], row['host']
    if budget[0] <= 0:
        return (row['verdict'], row['host']) if row else (-1, '')
    budget[0] -= 1
    verdict, host = _lookup(ip, suffixes)
    db.x('INSERT INTO crawler_dns (ip, host, verdict, checked_ts) VALUES (?,?,?,?) ON CONFLICT(ip) DO UPDATE SET host=excluded.host, verdict=excluded.verdict, checked_ts=excluded.checked_ts',
         (ip, host, verdict, db.now()))
    return verdict, host
