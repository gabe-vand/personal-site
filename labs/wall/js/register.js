// The top-out register: POST /api/contact {subject, body, from}. On success the form turns into
// "Sent." and the climber on top gets his arms up (onSent).
const $ = (id) => document.getElementById(id);

export function initRegister(onSent) {
    const form = $('register-form');
    if (!form) return;
    const note = $('register-note');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = new FormData(form);
        const body = String(data.get('body') || '').trim();
        if (!body) return;
        const btn = form.querySelector('button');
        btn.disabled = true;
        note.hidden = true;
        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject: String(data.get('subject') || '').trim(), body, from: String(data.get('from') || '').trim() }),
            });
            const out = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(out.error || `The board answered HTTP ${res.status}.`);
            form.hidden = true;
            form.reset();
            $('register-sent').hidden = false;
            onSent();
        } catch (err) {
            note.textContent = `${err.message} You can also email gabe@gabevandevere.com.`;
            note.hidden = false;
        } finally {
            btn.disabled = false;
        }
    });
    $('register-again').addEventListener('click', () => {
        $('register-sent').hidden = true;
        form.hidden = false;
        $('r-body').focus();
    });
}
