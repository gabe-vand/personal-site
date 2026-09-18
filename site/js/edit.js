// Admin text editing, in place.
//
// Off unless the URL ends in #edit AND /api/admin/me confirms a live admin session, so an
// ordinary visitor never sees it and never pays for the check. Log in at /admin/ first; the
// session cookie is scoped to /api/admin, which is exactly what this calls.
//
// A save goes to src/page/*.html and rebuilds on the server, because site/index.html is
// generated — see api/edit.py. Edits are live immediately and land in git on the next deploy.
const API = '/api/admin';

async function call(path, body) {
    const res = await fetch(API + path, {
        method: body ? 'POST' : 'GET',
        headers: { 'X-Admin': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'same-origin',
        cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...data };
}

export async function initEdit() {
    if (window.location.hash !== '#edit') return;
    const me = await call('/me').catch(() => ({ ok: false }));
    if (!me.ok) {
        // Not logged in (or not Gabe). Say so once, quietly, and do nothing else.
        if (me.status === 401) bar('Not signed in. Open /admin/, log in, then come back to #edit.', 'bad');
        return;
    }
    start();
}

function bar(message, tone) {
    let el = document.getElementById('editbar');
    if (!el) {
        el = document.createElement('div');
        el.id = 'editbar';
        el.className = 'editbar mono';
        el.innerHTML = '<span class="editbar-dot"></span><span id="editbar-msg"></span>';
        const done = document.createElement('button');
        done.type = 'button';
        done.className = 'editbar-done';
        done.textContent = 'done';
        done.addEventListener('click', () => {
            window.location.hash = '';
            window.location.reload();
        });
        el.append(done);
        document.body.append(el);
    }
    const msg = el.querySelector('#editbar-msg');
    msg.textContent = message;
    el.dataset.tone = tone || '';
    return el;
}

function start() {
    const fields = [...document.querySelectorAll('[data-edit]')];
    if (!fields.length) {
        bar('Edit mode on, but nothing on this page is marked editable.', 'bad');
        return;
    }
    document.documentElement.classList.add('editing');
    bar(`Edit mode. ${fields.length} fields — click one to change it, click away to save.`);

    for (const el of fields) {
        el.classList.add('editable');
        el.tabIndex = 0;
        el.addEventListener('focus', () => {
            el.contentEditable = 'true';
            el.dataset.was = el.innerHTML;
        });
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                el.innerHTML = el.dataset.was || '';
                el.blur();
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) el.blur();
        });
        el.addEventListener('blur', () => save(el));
    }
}

async function save(el) {
    el.contentEditable = 'false';
    const now = el.innerHTML;
    const was = el.dataset.was;
    if (was === undefined || now === was) return;

    const key = el.dataset.edit;
    el.classList.add('is-saving');
    bar(`Saving ${key}…`);
    const res = await call('/edit', { key, html: now }).catch((e) => ({ ok: false, message: String(e) }));
    el.classList.remove('is-saving');

    if (res.ok) {
        el.dataset.was = now;
        el.classList.add('is-saved');
        setTimeout(() => el.classList.remove('is-saved'), 1400);
        bar(`Saved ${key} — ${res.message || 'written and rebuilt'}`, 'good');
    } else {
        el.innerHTML = was;                       // put it back; the server did not take it
        el.classList.add('is-failed');
        setTimeout(() => el.classList.remove('is-failed'), 2400);
        bar(`Could not save ${key}: ${res.message || res.error || 'unknown error'}`, 'bad');
    }
}
