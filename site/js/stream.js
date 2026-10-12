// POST /api/chat and read the server-sent events: status -> token* -> done | error.
// Only one rewrite runs at a time: the board has one slot, and so does this page.

import { getIds, track } from './track.js?v=44c278d2';

let current = null;

export const isBusy = () => current !== null;

export function stop() {
    if (current) current.abort();
}

// fork: {src, i, a} -- which text, which word, which alternative; the server rebuilds the words so far.
export async function ask({ question, fork = null, onGen, onStatus, onToken, onDone, onError }) {
    if (current) return onError('The model is busy with another answer. Try again when it finishes.');
    track('chat', fork ? `fork ${fork.src}:${fork.i}` : question.slice(0, 120));
    const ctrl = new AbortController();
    current = ctrl;
    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', content: question }], alts: 5, ...(fork && { fork }), ...getIds() }),
            signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
            let msg = `Request failed (HTTP ${res.status}).`;
            try { msg = (await res.json()).error || msg; } catch { /* keep the generic line */ }
            return onError(msg, res.status);
        }
        await read(res.body.getReader(), { onGen, onStatus, onToken, onDone, onError });
    } catch (err) {
        if (err.name === 'AbortError') onError('Stopped.', 0, true);
        else onError('Couldn’t reach the model. Try again shortly.');
    } finally {
        if (current === ctrl) current = null;
    }
}

async function read(reader, handlers) {
    const decoder = new TextDecoder();
    let buf = '';
    let finished = false;
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let cut;
        while ((cut = buf.indexOf('\n\n')) >= 0) {
            const block = buf.slice(0, cut);
            buf = buf.slice(cut + 2);
            finished = dispatch(block, handlers) || finished;
        }
    }
    if (!finished) handlers.onDone({});
}

function dispatch(block, { onGen, onStatus, onToken, onDone, onError }) {
    let event = 'message', data = '';
    for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) return false;
    let payload;
    try { payload = JSON.parse(data); } catch { return false; }
    if (event === 'token') onToken(payload);
    else if (event === 'status') onStatus(payload);
    else if (event === 'gen') onGen?.(payload.id);
    else if (event === 'done') { onDone(payload); return true; }
    else if (event === 'error') { onError(payload.message || 'Something went wrong.'); return true; }
    return false;
}
