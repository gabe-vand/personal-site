"""Streams one answer from llama.cpp to the browser as server-sent events.

The browser never talks to :8080. This module adds the system prompt, caps
the output length, forwards tokens as they arrive, and reports timing at
the end so the page can show real tokens-per-second.

Events, in order:  status -> token* -> done      (or error at any point)

Two optional extras, used by the labs frontends:
  alts   -- 1..5: each token event also carries its probability `p` and the `alts` the model
            weighed at that position ([{t, p}], most likely first). llama.cpp's logprobs.
  prefix -- text the answer must start with (a "fork": the visitor picked another word and the
            model carries on from there). Sent as an assistant prefill; never echoed back.
"""
import math
import json
import time
import urllib.error
import urllib.request

import config
import convo
import persona
import speed
import telemetry


def clean_history(raw):
    """Validate what the browser sent. Returns [{role, content}] or raises ValueError."""
    if not isinstance(raw, list) or not raw:
        raise ValueError('messages must be a non-empty list')
    out = []
    for item in raw[-config.MAX_HISTORY:]:
        if not isinstance(item, dict):
            raise ValueError('bad message')
        role, content = item.get('role'), item.get('content')
        if role not in ('user', 'assistant') or not isinstance(content, str):
            raise ValueError('bad message')
        content = content.strip()[: config.MAX_MESSAGE_CHARS]
        if content:
            out.append({'role': role, 'content': content})
    if not out or out[-1]['role'] != 'user':
        raise ValueError('last message must be from the user')
    return out


def sse(event, payload):
    return f'event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n'.encode('utf-8')


def clean_extras(payload):
    """Validate the optional alts/prefix fields. Returns (alts, prefix) or raises ValueError."""
    alts, prefix = payload.get('alts', 0), payload.get('prefix', '')
    if not isinstance(alts, int) or not 0 <= alts <= 5:
        raise ValueError('alts must be 0-5')
    if not isinstance(prefix, str) or len(prefix) > config.MAX_PREFIX_CHARS:
        raise ValueError('prefix too long')
    return alts, prefix


def _request(history, alts=0, prefix=''):
    messages = [{'role': 'system', 'content': persona.SYSTEM_PROMPT}] + history
    if prefix:
        messages.append({'role': 'assistant', 'content': prefix})
    req = {
        'model': config.MODEL_ALIAS,
        'stream': True,
        'max_tokens': config.MAX_TOKENS,
        'temperature': config.TEMPERATURE,
        'messages': messages,
    }
    if alts:
        req.update(logprobs=True, top_logprobs=alts)
    body = json.dumps(req).encode('utf-8')
    headers = {'Authorization': 'Bearer ' + telemetry.api_key(), 'Content-Type': 'application/json'}
    return urllib.request.Request(config.UPSTREAM + '/v1/chat/completions', data=body, method='POST', headers=headers)


def _done(timings, choice, pieces, started):
    tps = timings.get('predicted_per_second')
    if tps:
        speed.note(tps)
    return sse('done', {
        'tokens': timings.get('predicted_n', pieces),
        'prompt_tokens': timings.get('prompt_n'),
        'cached_tokens': timings.get('cache_n', 0),
        'tps': round(tps, 1) if tps else None,
        'ms': int((time.monotonic() - started) * 1000),
        'finish': choice.get('finish_reason'),
    })


def _log(question, answer, timings, meta):
    tps = timings.get('predicted_per_second') or 0
    print(f"chat {timings.get('predicted_n', 0)} tok {tps:.1f} tok/s | Q: {question[:120]!r} | A: {answer[:200]!r}", flush=True)
    try:
        convo.record_turn(meta, question, answer, timings)
    except Exception as exc:  # storage must never break the answer
        print(f'convo record error: {type(exc).__name__}: {exc}', flush=True)


def _prob(logprob):
    return round(math.exp(logprob), 4) if isinstance(logprob, (int, float)) else None


def _token_event(text, choice, alts):
    """One token event; with alts, attach p and the alternatives from llama.cpp's logprobs."""
    payload = {'t': text}
    entries = ((choice.get('logprobs') or {}).get('content') or []) if alts else []
    if entries:
        last = entries[-1]
        payload['p'] = _prob(last.get('logprob'))
        payload['alts'] = [{'t': a.get('token', ''), 'p': _prob(a.get('logprob'))} for a in last.get('top_logprobs') or []]
    return sse('token', payload)


def stream(history, meta=None, alts=0, prefix=''):
    """Yield SSE byte strings for one exchange. Closing the generator early cancels generation upstream.
    meta: {vid, sid, ip, country, ua} for the conversation record."""
    meta = meta or {}
    started = time.monotonic()
    pieces = 0
    answer = [prefix] if prefix else []
    echo = prefix  # llama.cpp repeats the prefill at the start of the first delta; drop it once
    try:
        with urllib.request.urlopen(_request(history, alts, prefix), timeout=config.UPSTREAM_READ_S) as resp:
            yield sse('status', {'state': 'thinking'})
            for raw in resp:
                line = raw.decode('utf-8', 'replace').strip()
                if not line.startswith('data:'):
                    continue
                data = line[5:].strip()
                if data == '[DONE]':
                    break
                chunk = json.loads(data)
                choice = (chunk.get('choices') or [{}])[0]
                text = (choice.get('delta') or {}).get('content')
                if text and echo:
                    text, echo = (text[len(echo):] if text.startswith(echo) else text), ''
                if text:
                    pieces += 1
                    answer.append(text)
                    yield _token_event(text, choice, alts)
                if chunk.get('timings'):
                    chunk['timings']['ms'] = int((time.monotonic() - started) * 1000)
                    _log(history[-1]['content'], ''.join(answer), chunk['timings'], meta)
                    yield _done(chunk['timings'], choice, pieces, started)
                    return
        _log(history[-1]['content'], ''.join(answer), {'predicted_n': pieces, 'ms': int((time.monotonic() - started) * 1000)}, meta)
        yield sse('done', {'tokens': pieces, 'ms': int((time.monotonic() - started) * 1000)})
    except urllib.error.HTTPError as err:
        yield sse('error', {'message': f'The model refused the request (HTTP {err.code}).'})
    except (urllib.error.URLError, TimeoutError, OSError):
        yield sse('error', {'message': persona.OFFLINE_MESSAGE})
    except (ValueError, KeyError, IndexError):
        yield sse('error', {'message': 'The model sent something I could not read.'})
