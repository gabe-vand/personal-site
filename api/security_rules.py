"""The rulebook behind security.py: one entry per rule with its severity, a title and the
standing explanation shown next to every finding. Plain text written once, by hand, so the
admin page reads the same way every time. Severity: high / medium / low / info; "info"
covers welcome visitors we simply want to see."""

ORDER = {'high': 0, 'medium': 1, 'low': 2, 'info': 3}

RULES = {
    'scanner_exploit': {'severity': 'high', 'title': 'Vulnerability scanner', 'explain':
        'Requested paths that only exist on WordPress, PHP or leaked-config installs (wp-admin, xmlrpc.php, .env, .git, actuator…). '
        'This site has none of them, so every hit was a 404. Nobody reading the page types those URLs: this is an automated sweep of the whole '
        'internet for known holes, and it moves on when nothing answers.'},
    'scanner_404': {'severity': 'medium', 'title': 'Path guessing', 'explain':
        'Ten or more not-found responses from one address. Humans follow links; guessing paths is how a scanner maps a site. '
        'Not tied to a specific exploit, so medium rather than high.'},
    'impostor': {'severity': 'high', 'title': 'Fake search crawler', 'explain':
        'The user agent claims to be a search-engine crawler, but the source address does not reverse-resolve to that vendor\'s published '
        'domain (and forward-resolve back to itself). Every real crawler passes that check. A fake one wants the lenient treatment sites give '
        'search engines, or is hiding a scanner behind a friendly name.'},
    'crawler_verified': {'severity': 'info', 'title': 'Verified search crawler', 'explain':
        'Reverse DNS names the vendor\'s crawler domain and forward DNS of that name returns this address. Identity confirmed, not just claimed.'},
    'crawler_unresolved': {'severity': 'low', 'title': 'Crawler, DNS check pending', 'explain':
        'Claims to be a search crawler and the DNS check has not completed yet (lookups are budgeted per page load and retried next time). '
        'Neither verified nor an impostor until it does.'},
    'crawler_unverifiable': {'severity': 'info', 'title': 'Search crawler (no DNS check available)', 'explain':
        'This crawler\'s vendor publishes IP lists rather than a DNS domain, so the reverse-DNS test does not apply. Reported as claimed.'},
    'admin_probe': {'severity': 'medium', 'title': 'Admin API probe', 'explain':
        'Called the admin API without a session and has never logged in. The admin needs a same-site cookie plus a custom header, so the '
        'answer was 401 or 403 every time. Often a scanner that found /admin/ in the sitemap-less dark and tried it.'},
    'login_fail': {'severity': 'medium', 'title': 'Failed admin login', 'explain':
        'Wrong email, password or code on the admin sign-in. Five failures from one address, or twenty from anywhere, in 15 minutes locks the '
        'login for 15 minutes, and every failed attempt is answered after a fixed half-second delay so timing reveals nothing.'},
    'rate_limited': {'severity': 'low', 'title': 'Rate limit hit', 'explain':
        'Sent chat or contact requests faster than the per-address limit allows and got 429. Limits exist because the GPU answers one '
        'request at a time; a burst from one visitor would starve everyone else.'},
    'net_scanner': {'severity': 'medium', 'title': 'Internet-wide port scanner', 'explain':
        'zgrab, Censys, masscan, nmap or a client with no user agent at all. These fingerprint the server (TLS, headers, open services) '
        'rather than read the page. Research projects and attackers use the same tools; nothing here is exposed beyond Cloudflare.'},
    'script': {'severity': 'low', 'title': 'Script, not a browser', 'explain':
        'curl, Python, Go or a similar HTTP client. Usually harmless: uptime monitors, link checkers, someone\'s homework, a feed reader. '
        'Worth a glance only if the paths look odd.'},
    'ai_crawler': {'severity': 'info', 'title': 'AI crawler (welcome)', 'explain':
        'A crawler that feeds an AI model or answer engine: GPTBot, ClaudeBot, PerplexityBot, Common Crawl and friends. Welcome here on '
        'purpose. Being read by these is how the site gets recommended when someone asks an assistant about Gabe. Never flagged, never blocked.'},
    'ai_user_fetch': {'severity': 'info', 'title': 'AI assistant fetched the page for a person (welcome)', 'explain':
        'ChatGPT, Claude or Perplexity fetched the page live because a person asked about it. That is a human discovering the site through '
        'an assistant, which is exactly the point. Welcome.'},
    'chat_injection': {'severity': 'low', 'title': 'Prompt-injection attempt in chat', 'explain':
        'A chat message contains phrasing used to talk a model out of its instructions ("ignore previous instructions", "reveal your system '
        'prompt"…). The persona lives server-side and the model has no tools or secrets, so the worst case is a silly answer. Still fun to read.'},
    'chat_flood': {'severity': 'low', 'title': 'Unusual chat volume', 'explain':
        'A single message over 2,500 characters or a conversation past 25 turns. Could be an enthusiast, could be someone testing limits. '
        'The per-address rate limit already bounds the cost.'},
}
