// Chat with the model on this board. POSTs to /api/chat and reads the server-sent event
// stream (status -> token* -> done | error), painting each token as it lands.
// Nothing here knows an API key; the proxy in api/ holds it.
import { setGenerating } from './telemetry.js?v=0a57082b';

export function initChat() {
    const form = document.getElementById('chat-form');
    if (!form) return;
    const input = document.getElementById('chat-input');
    const log = document.getElementById('chat-log');
    const send = document.getElementById('chat-send');
    const chips = document.getElementById('chips');
    const history = [];
    let busy = false;

    if (chips) {
        chips.addEventListener('click', (e) => {
            const chip = e.target.closest('.chip');
            if (chip) ask(chip.dataset.q);
        });
    }
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        ask(input.value);
    });

    function addMessage(kind, content) {
        const el = document.createElement('div');
        el.className = `msg msg-${kind}`;
        const p = document.createElement('p');
        p.textContent = content;
        el.append(p);
        log.append(el);
        log.scrollTop = log.scrollHeight;
        return el;
    }

    function setStatus(el, message) {
        const p = el.querySelector('p');
        p.textContent = '';
        const span = document.createElement('span');
        span.className = 'msg-status';
        span.textContent = message;
        p.append(span);
    }

    function addMeta(el, data) {
        const meta = document.createElement('span');
        meta.className = 'msg-meta mono';
        const bits = [];
        if (data.tokens != null) bits.push(`${data.tokens} tokens`);
        if (data.tps) bits.push(`${data.tps} tok/s`);
        if (data.ms) bits.push(`${(data.ms / 1000).toFixed(1)} s`);
        bits.push('on the Jetson, no cloud');
        meta.textContent = bits.join(' · ');
        el.append(meta);
    }

    async function ask(raw) {
        const question = (raw || '').trim();
        if (!question || busy) return;
        busy = true;
        send.disabled = true;
        input.value = '';
        history.push({ role: 'user', content: question });
        addMessage('user', question);
        const bot = addMessage('bot', '');
        bot.classList.add('is-streaming');
        setStatus(bot, 'sending to the board…');
        const p = bot.querySelector('p');
        let answer = '';
        setGenerating(true);
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: history.slice(-6) }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `The board answered HTTP ${res.status}.`);
            }
            for await (const ev of events(res.body)) {
                if (ev.event === 'status') {
                    setStatus(bot, ev.data.state === 'queued' ? `someone else is talking to it — waiting (${ev.data.ahead} ahead)…` : 'thinking…');
                } else if (ev.event === 'token') {
                    answer += ev.data.t;
                    p.textContent = answer;
                    log.scrollTop = log.scrollHeight;
                } else if (ev.event === 'done') {
                    addMeta(bot, ev.data);
                } else if (ev.event === 'error') {
                    throw new Error(ev.data.message);
                }
            }
            history.push({ role: 'assistant', content: answer });
        } catch (err) {
            history.pop();
            bot.classList.add('msg-error');
            p.textContent = answer ? `${answer} [${err.message}]` : err.message;
        } finally {
            bot.classList.remove('is-streaming');
            busy = false;
            send.disabled = false;
            setGenerating(false);
            log.scrollTop = log.scrollHeight;
        }
    }
}

// Minimal SSE reader over fetch(): yields {event, data} for each blank-line-terminated block.
async function* events(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const ev = parseBlock(block);
            if (ev) yield ev;
        }
    }
}

function parseBlock(block) {
    let event = 'message';
    let data = '';
    for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) return null;
    try {
        return { event, data: JSON.parse(data) };
    } catch {
        return null;
    }
}
