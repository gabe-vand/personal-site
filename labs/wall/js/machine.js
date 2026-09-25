// The wall computer: live readings from the Jetson (GET /api/status, only while the panel is near
// the viewport) and one-question-at-a-time chat with the model on it (POST /api/chat, SSE).
const $ = (id) => document.getElementById(id);
let timer = 0;
let near = false;
let busy = false;

export function initMachine() {
    const panel = document.querySelector('.lcd');
    if (!panel) return;
    new IntersectionObserver((e) => {
        near = e[0].isIntersecting;
        if (near) poll();
    }, { rootMargin: '300px' }).observe(panel);
    $('lcd-form').addEventListener('submit', (e) => {
        e.preventDefault();
        ask($('lcd-input').value);
    });
}

async function poll() {
    clearTimeout(timer);
    if (!near || document.hidden) return;
    try {
        const r = await fetch('/api/status', { cache: 'no-store' });
        const d = await r.json();
        $('lcd-gpu').textContent = d.temps?.gpu?.toFixed(1) ?? '—';
        $('lcd-watts').textContent = d.power_w?.total?.toFixed(1) ?? '—';
        $('lcd-model').textContent = d.model?.name ?? '—';
        $('lcd-tps').textContent = d.tps_last ?? '—';
        $('lcd-dot').className = `lcd-dot ${d.busy ? 'is-busy' : 'is-live'}`;
        $('lcd-state').textContent = d.busy ? 'conditions: the model is talking to someone' : 'conditions: live from the board';
    } catch {
        $('lcd-dot').className = 'lcd-dot';
        $('lcd-state').textContent = 'conditions: board unreachable';
    }
    timer = setTimeout(poll, 4000);
}

async function ask(raw) {
    const q = (raw || '').trim();
    if (!q || busy) return;
    busy = true;
    const out = $('lcd-answer');
    const send = $('lcd-send');
    send.disabled = true;
    $('lcd-input').value = '';
    out.textContent = 'sending to the board…';
    let answer = '';
    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', content: q }] }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
        for await (const ev of events(res.body)) {
            if (ev.event === 'status') out.textContent = ev.data.state === 'queued' ? 'someone else has the slot — waiting…' : 'thinking…';
            else if (ev.event === 'token') out.textContent = answer += ev.data.t;
            else if (ev.event === 'error') throw new Error(ev.data.message);
            else if (ev.event === 'done') {
                const m = document.createElement('span');
                m.className = 'meta';
                m.textContent = [ev.data.tokens && `${ev.data.tokens} tokens`, ev.data.tps && `${ev.data.tps} tok/s`, 'on the Jetson, no cloud'].filter(Boolean).join(' · ');
                out.append(m);
            }
        }
    } catch (err) {
        out.textContent = answer ? `${answer} [${err.message}]` : err.message;
    } finally {
        busy = false;
        send.disabled = false;
    }
}

async function* events(body) {
    const reader = body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            let event = 'message';
            let data = '';
            for (const line of block.split('\n')) {
                if (line.startsWith('event:')) event = line.slice(6).trim();
                else if (line.startsWith('data:')) data += line.slice(5).trim();
            }
            try { if (data) yield { event, data: JSON.parse(data) }; } catch { /* partial or comment */ }
        }
    }
}
