"""Security findings for the admin: fixed rules over the request log, the login audit and the
chat transcripts. Every finding carries the rule that produced it and that rule's standing
explanation, so the page doubles as a walk-through of what hits a small public server.

Deterministic by design: string and count rules only, no models, no external APIs. AI crawlers
and assistant fetchers are reported as welcome guests, never as threats (Gabe wants the site
to be found through ChatGPT, Claude, Perplexity and friends)."""
import re
from collections import defaultdict

import crawler_verify
import db
import security_rules as R

_SENSITIVE = re.compile(r'(?i)(wp-|wordpress|xmlrpc|wlwmanifest|/\.env|/\.git|/\.aws|/\.ssh|/\.npmrc|phpmyadmin|/cgi-bin|\.php(\?|$)|actuator|heapdump|'
                        r'/config\.(json|ya?ml|php)|appsettings|application\.ya?ml|terraform|\.tfstate|/keys\.json|awsconfiguration|\.sql(\?|$)|\.bak(\?|$)|'
                        r'/shell|/vendor/|/console|/manager/|/telescope|/_ignition|/solr|/jenkins|/owa/|/autodiscover|/boaform|/GponForm|/HNAP1|/cgi/|/etc/passwd)')
_NET_SCANNERS = {'zgrab', 'Censys', 'masscan', 'nmap', 'no user agent'}
_INJECT = re.compile(r'(?i)(ignore (all |the |your )?(previous|prior|above) (instructions|prompts?)|system prompt|you are now|developer mode|jailbreak|\bDAN\b|'
                     r'reveal (your|the) (instructions|prompt)|pretend (you|to be)|disregard (your|the|all)|api[ _-]?key|repeat (everything|the text) above)')


def _since(days: int) -> float:
    return 0.0 if not days else db.now() - days * 86400


def _finding(rule: str, actor: str, where: str, n: int, first: float, last: float, sample=(), **extra) -> dict:
    meta = R.RULES[rule]
    return {'rule': rule, 'severity': extra.pop('severity', meta['severity']), 'title': meta['title'], 'explain': meta['explain'],
            'actor': actor, 'where': where, 'count': n, 'first_ts': first, 'last_ts': last, 'sample': list(sample)[:6], **extra}


def _request_findings(since: float, admin_ips: set) -> list:
    per_ip: dict[str, dict] = {}
    for r in db.q('SELECT ts, ip, loc, country, method, path, status, ua, klass, bot FROM requests WHERE ts>? ORDER BY ts', (since,)):
        a = per_ip.setdefault(r['ip'], {'n': 0, 'nf': 0, 'sens': [], 'admin': 0, 'limited': [], 'first': r['ts'], 'last': r['ts'],
                                        'where': r['loc'] or r['country'] or '?', 'klass': r['klass'], 'bot': r['bot'], 'paths': [], 'search': None, 'ai': set()})
        a['n'] += 1
        a['last'] = r['ts']
        if r['status'] in (404, 405):
            a['nf'] += 1
        if _SENSITIVE.search(r['path']) and r['path'] not in a['sens'] and len(a['sens']) < 12:
            a['sens'].append(r['path'])
        if r['path'].startswith('/api/admin') and r['status'] in (401, 403):
            a['admin'] += 1
        if r['status'] == 429:
            a['limited'].append(r['path'])
        line = f"{r['status']} {r['path']}"
        if line not in a['paths'] and len(a['paths']) < 6:
            a['paths'].append(line)
        if r['klass'] == 'search' and not a['search']:
            a['search'] = (r['bot'], r['ua'])  # verify the first crawler name this address claimed
        elif r['klass'] == 'ai':
            a['ai'].add(r['bot'])
    out, budget, by_bot, crawlers = [], [crawler_verify.MAX_LOOKUPS_PER_CALL], defaultdict(list), defaultdict(list)
    for ip, a in per_ip.items():
        if ip in admin_ips:
            continue  # the admin's own addresses: their traffic is Gabe testing, not a visitor
        args = (ip, a['where'], a['nf'], a['first'], a['last'])
        if a['sens']:
            out.append(_finding('scanner_exploit', *args, sample=a['sens']))
        elif a['nf'] >= 10:
            out.append(_finding('scanner_404', *args, sample=a['paths']))
        if a['admin']:
            out.append(_finding('admin_probe', ip, a['where'], a['admin'], a['first'], a['last'], sample=a['paths']))
        if a['limited']:
            out.append(_finding('rate_limited', ip, a['where'], len(a['limited']), a['first'], a['last'], sample=sorted(set(a['limited']))))
        if a['search']:
            verdict, host = crawler_verify.verify(ip, a['search'][1], budget)
            rule = {1: 'crawler_verified', 0: 'impostor', -1: 'crawler_unresolved', None: 'crawler_unverifiable'}[verdict]
            if verdict in (1, None):  # genuine crawlers are summarised per vendor; suspects stay one card per address
                crawlers[(rule, a['search'][0])].append((ip, host, a))
            else:
                out.append(_finding(rule, ip, a['where'], a['n'], a['first'], a['last'], sample=a['paths'], bot=a['search'][0], host=host))
        for bot in a['ai']:
            if not a['sens']:  # a scanner wearing an AI crawler's name is not an AI visit
                by_bot[bot].append(a)
        if a['klass'] == 'tool' and ip != '127.0.0.1' and not a['search'] and not a['ai']:
            rule = 'net_scanner' if a['bot'] in _NET_SCANNERS else 'script'
            out.append(_finding(rule, ip, a['where'], a['n'], a['first'], a['last'], sample=a['paths'], bot=a['bot']))
    for (rule, bot), hits in crawlers.items():
        out.append(_finding(rule, bot, f"{len(hits)} address{'es' if len(hits) != 1 else ''}", sum(h[2]['n'] for h in hits), min(h[2]['first'] for h in hits),
                            max(h[2]['last'] for h in hits), sample=[h[1] or h[0] for h in hits], bot=''))
    for bot, hits in by_bot.items():
        rule = 'ai_user_fetch' if 'user fetch' in bot else 'ai_crawler'
        out.append(_finding(rule, bot, f"{len(hits)} address{'es' if len(hits) != 1 else ''}", sum(h['n'] for h in hits),
                            min(h['first'] for h in hits), max(h['last'] for h in hits), sample=[p for h in hits[:3] for p in h['paths'][:2]]))
    return out


def _login_findings(since: float, admin_ips: set) -> list:
    out = []
    for r in db.q('SELECT ip, MAX(loc) AS loc, COUNT(*) AS n, MIN(ts) AS first, MAX(ts) AS last, GROUP_CONCAT(DISTINCT detail) AS emails '
                  'FROM audit WHERE action=? AND ts>? GROUP BY ip', ('login_fail', since)):
        you = r['ip'] in admin_ips  # a typo from an address that later signed in is not an attack
        sev = 'low' if you else 'high' if r['n'] >= 3 else 'medium'
        out.append(_finding('login_fail', r['ip'], r['loc'] or '?', r['n'], r['first'], r['last'], sample=(r['emails'] or '').split(','), severity=sev, you=you))
    return out


def _chat_findings(since: float) -> list:
    out, seen = [], set()
    for m in db.q('SELECT m.conv_id, m.ts, m.content, c.loc, c.country, c.turns FROM messages m JOIN conversations c ON c.id=m.conv_id '
                  'WHERE m.role=? AND m.ts>? ORDER BY m.ts', ('user', since)):
        where = m['loc'] or m['country'] or '?'
        hit = _INJECT.search(m['content'] or '')
        if hit and ('inj', m['conv_id']) not in seen:
            seen.add(('inj', m['conv_id']))
            out.append(_finding('chat_injection', f"conversation #{m['conv_id']}", where, 1, m['ts'], m['ts'], sample=[hit.group(0)], conv_id=m['conv_id']))
        if (len(m['content'] or '') > 2500 or m['turns'] >= 25) and ('flood', m['conv_id']) not in seen:
            seen.add(('flood', m['conv_id']))
            out.append(_finding('chat_flood', f"conversation #{m['conv_id']}", where, m['turns'], m['ts'], m['ts'], sample=[f"{len(m['content'] or '')} chars, {m['turns']} turns"], conv_id=m['conv_id']))
    return out


def report(days: int) -> dict:
    since = _since(days)
    admin_ips = {r['ip'] for r in db.q('SELECT DISTINCT ip FROM audit WHERE action=?', ('login_ok',))}
    findings = _request_findings(since, admin_ips) + _login_findings(since, admin_ips) + _chat_findings(since)
    findings.sort(key=lambda f: (R.ORDER[f['severity']], -f['last_ts']))
    counts = defaultdict(int)
    for f in findings:
        counts[f['severity']] += 1
        counts[f['rule']] += 1
    return {'findings': findings[:250], 'counts': dict(counts), 'rules': R.RULES, 'audit': db.q('SELECT * FROM audit ORDER BY ts DESC LIMIT 200')}
