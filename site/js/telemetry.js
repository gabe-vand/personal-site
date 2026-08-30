// Polls /api/status and paints the machine panel, the hero status line, the power sparkline,
// and anything that subscribed with onTelemetry (the ticker). Polls every 2.5 s while the
// panel is near the viewport, every 15 s otherwise, never while the tab is hidden.
import { fmtUptime, fmtInt, fmtNum } from './format.js?v=7b0ee7fb';

const listeners = new Set();
const power = [];
let timer = 0;
let near = false;
let generating = false;
let lastData = null;

const $ = (id) => document.getElementById(id);
const text = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value;
};

export function onTelemetry(fn) {
    listeners.add(fn);
    if (lastData) fn(lastData);
}

// chat.js flips this while an answer streams so the panel reacts before the next poll.
export function setGenerating(flag) {
    generating = flag;
    if (!flag && lastData) lastData.busy = false;
    paintState(lastData);
}

export function initTelemetry() {
    const panel = $('telemetry');
    if (panel) {
        new IntersectionObserver(
            (entries) => {
                near = entries[0].isIntersecting;
                if (near) poll();
            },
            { rootMargin: '240px' },
        ).observe(panel);
    }
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) poll();
    });
    poll();
}

async function poll() {
    clearTimeout(timer);
    try {
        const res = await fetch('/api/status', { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        lastData = await res.json();
        paint(lastData);
        listeners.forEach((fn) => fn(lastData));
    } catch {
        lastData = null;
        paintState(null);
    }
    if (!document.hidden) timer = setTimeout(poll, near ? 2500 : 15000);
}

function paint(d) {
    paintState(d);
    text('t-board', d.board);
    const m = d.model;
    if (m) {
        const quant = (m.file || '').replace('.gguf', '').split('-').pop();
        text('t-model', `${m.name} · ${m.params_b ?? '?'}B params · ${quant} · ${m.size_gb ?? '?'} GB`);
    } else {
        text('t-model', 'model asleep');
    }
    const watts = d.power_w ? d.power_w.total : null;
    text('t-watts', fmtNum(watts));
    text('t-gpu-temp', fmtNum(d.temps && d.temps.gpu, 0));
    text('t-gpu-load', fmtNum(d.gpu_load, 0));
    meter('t-gpu-bar', d.gpu_load);
    text('t-cpu-temp', fmtNum(d.temps && d.temps.cpu, 0));
    text('t-load', fmtNum(d.load1, 2));
    if (d.mem) {
        text('t-mem', `${(d.mem.used_mb / 1024).toFixed(1)} / ${(d.mem.total_mb / 1024).toFixed(1)} GB`);
        meter('t-mem-bar', (100 * d.mem.used_mb) / d.mem.total_mb);
    }
    text('t-tps', fmtNum(d.tps_last));
    text('t-tokens', d.llm ? fmtInt(d.llm.tokens_generated) : '—');
    text('t-uptime', fmtUptime(d.uptime_s));
    text('foot-up', fmtUptime(d.uptime_s));
    if (watts != null) {
        text('hero-status', `served live from a Jetson Orin Nano in Wayne, PA · drawing ${fmtNum(watts)} W right now`);
        power.push(watts);
        if (power.length > 48) power.shift();
        spark($('t-spark'), power);
    }
}

function meter(id, pct) {
    const el = $(id);
    if (el && pct != null) el.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

function paintState(d) {
    const online = !!(d && d.online);
    const busy = generating || !!(d && d.busy);
    let label = 'unreachable';
    if (d && !online) label = 'model asleep';
    else if (online) label = busy ? 'generating…' : 'idle · listening';
    for (const id of ['tele-dot', 'hero-dot']) {
        const dot = $(id);
        if (!dot) continue;
        dot.classList.toggle('is-off', !online);
        dot.classList.toggle('is-busy', online && busy);
    }
    const state = $('tele-state');
    if (state) {
        state.textContent = label;
        state.classList.toggle('is-busy', online && busy);
    }
}

function spark(canvas, values) {
    if (!canvas || values.length < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 180;
    const h = canvas.clientHeight || 32;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const ice = getComputedStyle(document.documentElement).getPropertyValue('--ice').trim();
    const min = Math.min(...values) - 0.3;
    const max = Math.max(...values) + 0.3;
    const px = (i) => (i / (values.length - 1)) * (w - 4) + 2;
    const py = (v) => h - 3 - ((v - min) / (max - min)) * (h - 6);
    ctx.beginPath();
    values.forEach((v, i) => (i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v))));
    ctx.strokeStyle = ice;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.lineTo(px(values.length - 1), h);
    ctx.lineTo(px(0), h);
    ctx.closePath();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = ice;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(px(values.length - 1), py(values[values.length - 1]), 2.5, 0, Math.PI * 2);
    ctx.fill();
}
