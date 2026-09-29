"""Forks: the visitor picks another word and the model carries on from there.

Why this exists: a fork is sent to llama.cpp as an assistant prefill ("the answer so far"). If the
browser sent that text, anyone could put words in the machine's mouth and screenshot it. So the
browser only names a position -- which text, which word, which alternative -- and the prefix is
rebuilt here from text this server produced or published:

  src  'who', 'rx', ...  a baked passage in site/data/<src>.json (the page's own copy)
       'g<hex>'          a recent live generation, kept in memory (lost on restart; that's fine)
  i    the word position to replace
  a    which of the alternatives the model weighed at that position

A visitor can therefore only ever choose among words the model itself considered.
"""
import json
import re
import secrets
import threading
from collections import OrderedDict
from pathlib import Path

import config

DATA = Path(__file__).resolve().parent.parent / 'site' / 'data'
KEEP = 400                      # live generations remembered for forking
_lock = threading.Lock()
_gens: 'OrderedDict[str, dict]' = OrderedDict()
_baked: dict[str, tuple[float, dict]] = {}


def _load_baked(name):
    path = DATA / f'{name}.json'
    mtime = path.stat().st_mtime  # FileNotFoundError -> ValueError below
    hit = _baked.get(name)
    if hit and hit[0] == mtime:
        return hit[1]
    raw = json.loads(path.read_text(encoding='utf-8'))
    doc = {'q': raw['q'], 'tokens': [(t['t'], [a['t'] for a in t.get('alts') or []]) for t in raw['tokens']]}
    _baked[name] = (mtime, doc)
    return doc


def source(src):
    """The {q, tokens: [(text, [alt texts])]} a fork starts from, or raise ValueError."""
    if not isinstance(src, str):
        raise ValueError('bad fork source')
    if re.fullmatch(r'g[0-9a-f]{16}', src):
        with _lock:
            doc = _gens.get(src)
        if not doc:
            raise ValueError('That version has expired. Fork from the original instead.')
        return doc
    if re.fullmatch(r'[a-z]{1,20}', src):
        try:
            return _load_baked(src)
        except (OSError, ValueError, KeyError, TypeError):
            raise ValueError('bad fork source') from None
    raise ValueError('bad fork source')


def resolve(fork):
    """{src, i, a} -> (question, prefix, head tokens). Raises ValueError on anything off."""
    if not isinstance(fork, dict):
        raise ValueError('bad fork')
    doc = source(fork.get('src'))
    i, a = fork.get('i'), fork.get('a')
    toks = doc['tokens']
    if not isinstance(i, int) or not isinstance(a, int) or not 0 <= i < len(toks) or not 0 <= a < len(toks[i][1]):
        raise ValueError('bad fork position')
    head = toks[:i] + [(toks[i][1][a], toks[i][1])]
    prefix = ''.join(t for t, _ in head)
    if len(prefix) > config.MAX_PREFIX_CHARS:
        raise ValueError('too deep into the passage to fork from there')
    return doc['q'], prefix, head


def new_id():
    return 'g' + secrets.token_hex(8)


def remember(gen_id, question, tokens):
    """Keep a finished (or broken-off) generation so it can itself be forked."""
    with _lock:
        _gens[gen_id] = {'q': question, 'tokens': tokens}
        _gens.move_to_end(gen_id)
        while len(_gens) > KEEP:
            _gens.popitem(last=False)
