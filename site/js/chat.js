// The "Ask" box: a short conversation with the model on the Jetson, streamed as it writes.
import { ask, isBusy } from './stream.js?v=bf6a28fc';

export function initChat() {
    const form = document.getElementById('chat-form');
    const log = document.getElementById('chat-log');
    if (!form || !log) return;
    const input = form.querySelector('input');
    const button = form.querySelector('button');
    const history = [];

    const line = (cls, text) => {
        const p = document.createElement('p');
        p.className = cls;
        p.textContent = text;
        log.append(p);
        return p;
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const q = input.value.trim();
        if (!q || isBusy()) return;
        input.value = '';
        button.disabled = true;
        line('q', q);
        const a = line('a is-waiting', 'Thinking…');
        history.push({ role: 'user', content: q });
        let text = '';
        await ask({
            messages: history.slice(-5),
            onStatus: (s) => { if (s.state === 'queued' && !text) a.textContent = 'Waiting for another answer to finish…'; },
            onToken: ({ t }) => {
                if (!text) a.classList.remove('is-waiting');
                text += t;
                a.textContent = text;
            },
            onDone: () => {
                if (text) history.push({ role: 'assistant', content: text });
                else history.pop();
            },
            onError: (msg) => {
                history.pop();
                a.className = 'a is-error';
                a.textContent = text ? `${text} (${msg})` : msg;
            },
        });
        button.disabled = false;
        input.focus();
    });
}
