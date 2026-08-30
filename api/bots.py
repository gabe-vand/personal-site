"""Classify a User-Agent: who is this request from? Returns (klass, name).
klass: human | ai | search | preview | tool.  Order matters: first match wins."""
import re

AI = [  # LLM training / answer-engine crawlers and their on-demand fetchers
    ('GPTBot', 'OpenAI GPTBot'), ('ChatGPT-User', 'ChatGPT (user fetch)'), ('OAI-SearchBot', 'OpenAI SearchBot'),
    ('ClaudeBot', 'Anthropic ClaudeBot'), ('Claude-User', 'Claude (user fetch)'), ('Claude-SearchBot', 'Anthropic SearchBot'), ('anthropic-ai', 'Anthropic'),
    ('PerplexityBot', 'Perplexity'), ('Perplexity-User', 'Perplexity (user fetch)'), ('Google-Extended', 'Google-Extended (Gemini)'),
    ('Applebot-Extended', 'Apple Intelligence'), ('Bytespider', 'ByteDance Bytespider'), ('CCBot', 'Common Crawl'), ('cohere-ai', 'Cohere'),
    ('Amazonbot', 'Amazon (Alexa/AI)'), ('meta-externalagent', 'Meta AI'), ('FacebookBot', 'Meta AI (FacebookBot)'), ('Diffbot', 'Diffbot'),
    ('YouBot', 'You.com'), ('DuckAssistBot', 'DuckDuckGo AI'), ('MistralAI-User', 'Mistral (user fetch)'), ('Timpibot', 'Timpi'), ('omgili', 'Webz.io'),
    ('AI2Bot', 'Allen Institute'), ('ImagesiftBot', 'Imagesift'), ('PetalBot', 'Huawei Petal'), ('iaskspider', 'iAsk'), ('Kangaroo Bot', 'Kangaroo'),
]
SEARCH = [('Googlebot', 'Googlebot'), ('bingbot', 'Bingbot'), ('BingPreview', 'Bing preview'), ('DuckDuckBot', 'DuckDuckBot'), ('YandexBot', 'Yandex'),
          ('Baiduspider', 'Baidu'), ('Applebot', 'Applebot'), ('Slurp', 'Yahoo'), ('SeznamBot', 'Seznam'), ('Qwantify', 'Qwant'), ('AhrefsBot', 'Ahrefs'), ('SemrushBot', 'Semrush'), ('MJ12bot', 'Majestic')]
PREVIEW = [('LinkedInBot', 'LinkedIn'), ('Slackbot', 'Slack'), ('Slack-ImgProxy', 'Slack'), ('Discordbot', 'Discord'), ('Twitterbot', 'X/Twitter'),
           ('facebookexternalhit', 'Facebook/iMessage'), ('WhatsApp', 'WhatsApp'), ('TelegramBot', 'Telegram'), ('Iframely', 'Iframely'), ('Embedly', 'Embedly'), ('SkypeUriPreview', 'Skype/Teams'), ('Google-PageRenderer', 'Google preview')]
TOOL = [('curl/', 'curl'), ('Wget', 'wget'), ('python-requests', 'python-requests'), ('Python-urllib', 'python-urllib'), ('Go-http-client', 'Go http'),
        ('node-fetch', 'node-fetch'), ('axios', 'axios'), ('HeadlessChrome', 'headless Chrome'), ('PhantomJS', 'PhantomJS'), ('scrapy', 'Scrapy'),
        ('UptimeRobot', 'UptimeRobot'), ('Pingdom', 'Pingdom'), ('censys', 'Censys'), ('zgrab', 'zgrab'), ('masscan', 'masscan'), ('nmap', 'nmap'), ('libwww', 'libwww')]
_GENERIC_BOT = re.compile(r'bot|crawl|spider|scan|fetch|monitor|probe|scrape|checker|validator|archive', re.I)


def classify(ua: str) -> tuple[str, str]:
    if not ua:
        return 'tool', 'no user agent'
    for needle, name in AI:
        if needle.lower() in ua.lower():
            return 'ai', name
    for needle, name in SEARCH:
        if needle.lower() in ua.lower():
            return 'search', name
    for needle, name in PREVIEW:
        if needle.lower() in ua.lower():
            return 'preview', name
    for needle, name in TOOL:
        if needle.lower() in ua.lower():
            return 'tool', name
    if _GENERIC_BOT.search(ua) and 'Mozilla/5.0 (' not in ua:
        return 'tool', 'unknown bot'
    return 'human', ''


def describe(ua: str) -> str:
    """Short human-readable browser/OS for the admin UI, e.g. 'Chrome · Windows'."""
    if not ua:
        return '?'
    b = 'browser'
    for needle, name in (('Edg/', 'Edge'), ('OPR/', 'Opera'), ('SamsungBrowser', 'Samsung'), ('Firefox/', 'Firefox'), ('CriOS', 'Chrome'), ('Chrome/', 'Chrome'), ('Safari/', 'Safari')):
        if needle in ua:
            b = name
            break
    o = 'OS'
    for needle, name in (('iPhone', 'iPhone'), ('iPad', 'iPad'), ('Android', 'Android'), ('Windows', 'Windows'), ('Mac OS X', 'macOS'), ('CrOS', 'ChromeOS'), ('Linux', 'Linux')):
        if needle in ua:
            o = name
            break
    return f'{b} · {o}'
