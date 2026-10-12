// The instrument strip that rises while the machine writes: live words per second measured
// here in the browser, and the board's own watts, GPU temperature and load from /api/status
// (polled every 2 s only while writing). Afterwards it states what the rewrite cost in joules.

const meter = document.getElementById('meter');
let run = null;

export async function status() {
    const res = await fetch('/api/status', { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
}

function cell(label, value, cls = '') {
    return `<span class="m-cell ${cls}"><b>${value}</b><small>${label}</small></span>`;
}

function paint() {
    if (!run) return;
    const secs = (performance.now() - run.t0) / 1000;
    const recent = run.stamps.filter((t) => performance.now() - t < 3000);
    const tps = recent.length > 1 ? (recent.length - 1) / ((recent[recent.length - 1] - recent[0]) / 1000) : 0;
    const s = run.status;
    const state = run.state === 'writing' ? 'writing' : run.state;
    meter.innerHTML = [
        `<span class="m-state"><i class="m-dot"></i>${state}<small class="m-opt">${run.label}</small></span>`,
        cell('words / s', tps ? tps.toFixed(1) : '—', 'm-big'),
        cell('words', run.count),
        cell('watts', s ? s.power_w.total.toFixed(1) : '—'),
        cell('gpu °C', s ? Math.round(s.temps.gpu) : '—', 'm-opt'),
        cell('gpu load', s ? `${Math.min(100, Math.round(s.gpu_load))}%` : '—', 'm-opt'),
        cell('joules', run.joules ? Math.round(run.joules) : '—'),
        cell('elapsed', `${secs.toFixed(1)} s`, 'm-opt'),
    ].join('');
}

async function poll() {
    if (!run) return;
    const r = run;
    try {
        const s = await status();
        const now = performance.now();
        if (r.status && r.lastPoll) r.joules += r.status.power_w.total * ((now - r.lastPoll) / 1000);
        r.status = s;
        r.lastPoll = now;
    } catch { /* keep the last reading */ }
    if (run === r) {
        paint();
        r.timer = setTimeout(poll, 2000);
    }
}

export function begin(label) {
    clearTimeout(meter.__hide);
    run = { label, t0: performance.now(), stamps: [], count: 0, state: 'connecting', status: null, joules: 0, lastPoll: 0 };
    meter.hidden = false;
    meter.classList.remove('is-done');
    requestAnimationFrame(() => meter.classList.add('is-up'));
    paint();
    poll();
    run.tick = setInterval(paint, 250);
}

export function state(label) {
    if (run) { run.state = label; paint(); }
}

export function token() {
    if (!run) return;
    run.state = 'writing';
    run.count += 1;
    run.stamps.push(performance.now());
    if (run.stamps.length > 60) run.stamps.shift();
}

export function end(summary) {
    if (!run) return;
    const r = run;
    run = null;
    clearTimeout(r.timer);
    clearInterval(r.tick);
    const secs = (performance.now() - r.t0) / 1000;
    const joules = r.joules || (r.status ? r.status.power_w.total * secs : 0);
    meter.classList.add('is-done');
    meter.innerHTML = `<span class="m-state"><i class="m-dot"></i>${summary || 'done'}</span>` +
        cell('words', r.count, 'm-opt') + cell('seconds', secs.toFixed(1)) +
        cell('joules, about', joules ? Math.round(joules) : '—', 'm-big');
    meter.__hide = setTimeout(() => {
        meter.classList.remove('is-up');
        setTimeout(() => { if (!run) meter.hidden = true; }, 500);
    }, 6000);
}
