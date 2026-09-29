#!/usr/bin/env python3
"""Bake the canonical passages for the ALMOST lab.

Each passage is one question put to the model on the Jetson, with every token's probability
and the five alternatives it weighed (the chat proxy's `alts`). The page replays these at
the speed they were written and lets a visitor fork any word live. Baking once means the
page never touches the model on load.

    python3 labs/almost/bake.py              # every passage
    python3 labs/almost/bake.py dog oracle   # just these (re-roll one that got a fact wrong)

Needs labs/run.sh running (it serves /api/chat on :5100). Sequential on purpose: the model
has one slot and shares it with the Minecraft bot.
"""
import json
import sys
import time
import urllib.request
from pathlib import Path

API = 'http://localhost:5100/api'
OUT = Path(__file__).resolve().parent / 'site' / 'data'

PASSAGES = {
    'who': 'Who is Gabe?',
    'rx': 'What does Gabe do at The RxAssistant?',
    'westpepper': 'What did Gabe do at Westpepper Capital?',
    'savor': 'Tell me about Savor, the app Gabe built at HenHacks.',
    'dog': "Tell me about Gabe's dog gait analysis project.",
    'oracle': "Tell me about Oracle, Gabe's Minecraft project.",
    'offwall': 'What does Gabe do when he is not writing code?',
    'machine': 'What are you, and where is this website running?',
}


def ask(question):
    body = json.dumps({'messages': [{'role': 'user', 'content': question}], 'alts': 5}).encode()
    req = urllib.request.Request(API + '/chat', data=body, headers={'Content-Type': 'application/json'})
    tokens, done, event = [], {}, None
    with urllib.request.urlopen(req, timeout=180) as resp:
        for raw in resp:
            line = raw.decode('utf-8', 'replace').rstrip('\n')
            if line.startswith('event:'):
                event = line[6:].strip()
            elif line.startswith('data:'):
                data = json.loads(line[5:])
                if event == 'token':
                    tokens.append(data)
                elif event == 'done':
                    done = data
                elif event == 'error':
                    raise RuntimeError(data.get('message'))
    return tokens, done


def model_name():
    try:
        with urllib.request.urlopen(API + '/status', timeout=8) as resp:
            return json.load(resp).get('model', {}).get('name', '')
    except OSError:
        return ''


def main(ids):
    OUT.mkdir(exist_ok=True)
    model = model_name()
    for pid in ids:
        question = PASSAGES[pid]
        started = time.time()
        tokens, done = ask(question)
        text = ''.join(t['t'] for t in tokens)
        record = {'id': pid, 'q': question, 'model': model, 'baked': time.strftime('%Y-%m-%d'),
                  'tps': done.get('tps'), 'ms': done.get('ms'), 'tokens': tokens}
        (OUT / f'{pid}.json').write_text(json.dumps(record, ensure_ascii=False), encoding='utf-8')
        print(f'--- {pid} ({len(tokens)} tok, {done.get("tps")} tok/s, {time.time() - started:.0f}s)\n{text}\n', flush=True)
    (OUT / 'index.json').write_text(json.dumps(sorted(p.stem for p in OUT.glob('*.json') if p.stem != 'index')), encoding='utf-8')


if __name__ == '__main__':
    main(sys.argv[1:] or list(PASSAGES))
