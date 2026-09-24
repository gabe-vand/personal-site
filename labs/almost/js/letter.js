// The letter to Gabe: POST /api/contact. No model involved.
export function initLetter() {
    const form = document.getElementById('letter');
    if (!form) return;
    const note = document.getElementById('letter-note');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        const btn = form.querySelector('button');
        btn.disabled = true;
        note.textContent = 'sending…';
        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject: data.subject || '', body: data.body || '', from: data.from || '' }),
            });
            const out = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(out.error || 'It did not go through.');
            form.reset();
            note.textContent = 'Sent. It is in his inbox; he reads everything.';
            form.classList.add('is-sent');
        } catch (err) {
            note.textContent = `${err.message} Or write to gabe@gabevandevere.com.`;
        } finally {
            btn.disabled = false;
        }
    });
}
