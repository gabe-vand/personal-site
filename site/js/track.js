// First-party analytics beacon. Sends small events to /api/beacon: page view, which sections
// were reached, link-offs (LinkedIn, mailto), chat/contact use, and time on page. Ids are
// random hex made here: vid (this browser, localStorage) and sid (this tab, sessionStorage).
// Honors Do Not Track / Global Privacy Control by sending nothing at all.
const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
const optOut = navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;

function stored(store, key) {
    try {
        let v = store.getItem(key);
        if (!v || !/^[0-9a-f]{16,32}$/.test(v)) {
            v = hex();
            store.setItem(key, v);
        }
        return v;
    } catch {
        return hex();
    }
}
const ids = optOut ? { vid: '', sid: '' } : { vid: stored(localStorage, 'gv_vid'), sid: stored(sessionStorage, 'gv_sid') };

/** Ids for other modules to attach to their own requests (chat, contact). */
export function getIds() {
    return ids;
}

let started = performance.now();
let sent = false;
function send(kind, detail, extra = {}) {
    if (optOut || !ids.vid) return;
    const body = JSON.stringify({ ...ids, kind, detail: detail || '', ...extra });
    if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/beacon', new Blob([body], { type: 'application/json' }));
    } else {
        fetch('/api/beacon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
}
export const track = send;

export function initTrack() {
    if (optOut) return;
    send('view', location.pathname, { ref: document.referrer.slice(0, 300), width: window.innerWidth });
    // Sections reached: each pitch fires once when a third of it is on screen.
    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
            if (e.isIntersecting && !seen.has(e.target.id)) {
                seen.add(e.target.id);
                send('section', e.target.id);
            }
        }
    }, { threshold: 0.33 });
    document.querySelectorAll('section.pitch[id]').forEach((s) => io.observe(s));
    // Link-offs: any link leaving the page (other origins, mailto:).
    document.addEventListener('click', (e) => {
        const a = e.target.closest('a[href]');
        if (!a) return;
        const href = a.getAttribute('href') || '';
        if (href.startsWith('mailto:') || (a.origin && a.origin !== location.origin)) send('click', href.slice(0, 200));
    });
    // Time on page: heartbeat while visible, final figure on leave.
    const seconds = () => Math.round((performance.now() - started) / 1000);
    setInterval(() => { if (!document.hidden) send('ping', '', { seconds: seconds() }); }, 20000);
    const leave = () => { if (!sent) { sent = true; send('leave', '', { seconds: seconds() }); } };
    addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', () => { if (document.hidden) leave(); else sent = false; });
}
