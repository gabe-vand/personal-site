"""Streams one answer from llama.cpp to the browser as server-sent events.

The browser never talks to :8080. This module adds the system prompt, caps
the output length, forwards tokens as they arrive, and reports timing at
the end so the page can show real tokens-per-second.

Events, in order:  status -> token* -> done      (or error at any point)
"""
import json
import time
import urllib.error
import urllib.request

import config
import persona
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


def _request(history):
    body = json.dumps({
        'model': config.MODEL_ALIAS,
        'stream': True,
        'max_tokens': config.MAX_TOKENS,
        'temperature': config.TEMPERATURE,
        'messages': [{'role': 'system', 'content': persona.SYSTEM_PROMPT}] + history,
    }).encode('utf-8')
    headers = {'Authorization': 'Bearer ' + telemetry.api_key(), 'Content-Type': 'application/json'}
    return urllib.request.Request(config.UPSTREAM + '/v1/chat/completions', data=body, method='POST', headers=headers)


def _done(timings, choice, pieces, started):
    tps = timings.get('predicted_per_second')
    if tps:
        telemetry.note_tps(tps)
    return sse('done', {
        'tokens': timings.get('predicted_n', pieces),
        'prompt_tokens': timings.get('prompt_n'),
        'cached_tokens': timings.get('cache_n', 0),
        'tps': round(tps, 1) if tps else None,
        'ms': int((time.monotonic() - started) * 1000),
        'finish': choice.get('finish_reason'),
    })


def _log(question, answer, timings):
    tps = timings.get('predicted_per_second') or 0
    print(f"chat {timings.get('predicted_n', 0)} tok {tps:.1f} tok/s | Q: {question[:120]!r} | A: {answer[:200]!r}", flush=True)


def stream(history):
    """Yield SSE byte strings for one exchange. Closing the generator early cancels generation upstream."""
    started = time.monotonic()
    pieces = 0
    answer = []
    try:
        with urllib.request.urlopen(_request(history), timeout=config.UPSTREAM_READ_S) as resp:
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
                if text:
                    pieces += 1
                    answer.append(text)
                    yield sse('token', {'t': text})
                if chunk.get('timings'):
                    _log(history[-1]['content'], ''.join(answer), chunk['timings'])
                    yield _done(chunk['timings'], choice, pieces, started)
                    return
        yield sse('done', {'tokens': pieces, 'ms': int((time.monotonic() - started) * 1000)})
    except urllib.error.HTTPError as err:
        yield sse('error', {'message': f'The model refused the request (HTTP {err.code}).'})
    except (urllib.error.URLError, TimeoutError, OSError):
        yield sse('error', {'message': persona.OFFLINE_MESSAGE})
    except (ValueError, KeyError, IndexError):
        yield sse('error', {'message': 'The model sent something I could not read.'})
