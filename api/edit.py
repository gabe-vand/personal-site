"""In-page text editing for the admin.

site/index.html is GENERATED from src/page/*.html, so an edit made against the live DOM has to
go back into the partial and be rebuilt. Writing the served file instead would work until the
next ./deploy.sh, which would silently revert it. That is the whole reason this module exists.

Three things keep a bad edit from taking the page down:
  - only an element carrying data-edit="<key>" in a partial can be changed at all;
  - the submitted markup is REBUILT from an allowlist of inline tags, so it cannot arrive
    unbalanced and cannot carry attributes, scripts or styles;
  - if build.py then fails, the partial is restored and rebuilt before the error comes back.
"""
import html as htmllib
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ROOT / 'src' / 'page'

ALLOWED_TAGS = {'strong', 'em', 'code', 'br'}
VOID_TAGS = {'br'}
MAX_CHARS = 4000
KEY_RE = re.compile(r'^[a-z0-9][a-z0-9-]{0,63}$')


class _Clean(HTMLParser):
    """Re-emits only allowlisted inline tags, with no attributes, and closes anything left
    open. Output is balanced by construction, so it cannot break the surrounding document."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.open = []

    def handle_starttag(self, tag, _attrs):
        if tag not in ALLOWED_TAGS:
            return
        if tag in VOID_TAGS:
            self.out.append(f'<{tag}>')
        else:
            self.out.append(f'<{tag}>')
            self.open.append(tag)

    def handle_startendtag(self, tag, _attrs):
        if tag in VOID_TAGS:
            self.out.append(f'<{tag}>')

    def handle_endtag(self, tag):
        if tag in VOID_TAGS or tag not in self.open:
            return
        while self.open:                       # close through to the matching tag
            t = self.open.pop()
            self.out.append(f'</{t}>')
            if t == tag:
                break

    def handle_data(self, data):
        self.out.append(htmllib.escape(data, quote=False))

    def result(self):
        while self.open:
            self.out.append(f'</{self.open.pop()}>')
        return ''.join(self.out)


# The browser hands back literal characters; the partials are written with entities. Put them
# back so an edited file still reads like the rest of the repo (and so a stray non-breaking
# space from a paste is visible in a diff rather than invisible).
ENTITIES = {
    ' ': '&nbsp;', '’': '&rsquo;', '‘': '&lsquo;', '“': '&ldquo;',
    '”': '&rdquo;', '—': '&mdash;', '–': '&ndash;', '·': '&middot;',
    '…': '&hellip;', '×': '&times;', '−': '&minus;', '→': '&rarr;',
    '←': '&larr;', '↑': '&uarr;', '↓': '&darr;', '°': '&deg;',
    '₂': '&#8322;',
}


def sanitize(markup: str) -> str:
    parser = _Clean()
    parser.feed(markup[:MAX_CHARS * 2])
    parser.close()
    text = parser.result().strip()
    text = re.sub(r'[ \t]*\n[ \t]*', ' ', text)
    for char, entity in ENTITIES.items():
        text = text.replace(char, entity)
    return text[:MAX_CHARS]


def _pattern(key: str) -> re.Pattern:
    """Opening tag carrying the key, its contents, its matching close. The \\2 backreference
    keeps the close tag matched to the open one; non-greedy is safe because no element marked
    editable nests another of the same tag."""
    return re.compile(rf'(<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\bdata-edit="{re.escape(key)}"[^>]*>)(.*?)(</\2>)', re.S)


def _partials():
    return sorted(PAGES.glob('*.html'))


def find(key: str):
    """-> (path, current_inner_markup) or (None, None)."""
    for path in _partials():
        text = path.read_text(encoding='utf-8')
        match = _pattern(key).search(text)
        if match:
            return path, match.group(3)
    return None, None


def keys() -> dict:
    """Every editable key on the page, mapped to its partial. Used by the admin UI and tests."""
    found = {}
    for path in _partials():
        for key in re.findall(r'\bdata-edit="([a-z0-9-]+)"', path.read_text(encoding='utf-8')):
            found.setdefault(key, path.name)
    return found


def _build() -> tuple[bool, str]:
    proc = subprocess.run([sys.executable, str(ROOT / 'build.py')], cwd=str(ROOT),
                          capture_output=True, text=True, timeout=120)
    return proc.returncode == 0, (proc.stderr or proc.stdout or '').strip()[:400]


def apply(key: str, markup: str) -> tuple[bool, str]:
    """Write the sanitized markup into the partial and rebuild. -> (ok, message)."""
    if not KEY_RE.match(key or ''):
        return False, 'bad key'
    path, _current = find(key)
    if path is None:
        return False, 'no such editable element'

    clean = sanitize(markup or '')
    if not clean:
        return False, 'empty'

    before = path.read_text(encoding='utf-8')
    # A literal replacement string would treat a backslash or \\1 in the text as a group ref.
    after = _pattern(key).sub(lambda m: m.group(1) + clean + m.group(4), before, count=1)
    if after == before:
        return True, 'unchanged'

    path.write_text(after, encoding='utf-8')
    ok, detail = _build()
    if not ok:
        path.write_text(before, encoding='utf-8')
        _build()
        return False, f'build failed, reverted: {detail}'
    return True, f'saved to src/page/{path.name}'
