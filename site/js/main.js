// Boot: load the baked passages, build a manuscript for each folio, replay each one at its
// real speed as it scrolls into view, and fill the live readings from the board.
import { Passage } from './passage.js?v=1e12842c';
import { bindReel } from './reel.js?v=1e12842c';
import { status } from './meter.js?v=1e12842c';
import { stats } from './tokens.js?v=1e12842c';
import { initAsk } from './ask.js?v=1e12842c';
import { initLetter } from './letter.js?v=1e12842c';
import { coach } from './coach.js?v=1e12842c';
import { initTrack } from './track.js?v=1e12842c';

export const passages = [];
// Same build hash this module was loaded with; build.py folds site/data/ into it, so a re-baked
// passage is fetched fresh instead of from a cached copy.
const V = new URL(import.meta.url).searchParams.get('v') || '';

async function load(section) {
    const res = await fetch(`/data/${section.dataset.passage}.json?v=${V}`);
    if (!res.ok) throw new Error(section.dataset.passage);
    return res.json();
}

function paintStats() {
    const s = stats(passages.map((p) => p.versions[0].tokens));
    const dd = document.querySelectorAll('#stats dd');
    [s.words, s.contested, s.odds].forEach((n, k) => { if (dd[k]) dd[k].textContent = n.toLocaleString(); });
}

const fmtUp = (s) => {
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
    return d ? `${d} days, ${h} hours` : `${h} hours, ${Math.floor((s % 3600) / 60)} minutes`;
};

async function live() {
    try {
        const s = await status();
        const mast = document.getElementById('mast-live');
        if (mast) mast.textContent = `Jetson Orin Nano Super · ${s.power_w.total.toFixed(1)} W`;
        const set = (k, v) => { const el = document.querySelector(`#scribe [data-s="${k}"]`); if (el) el.textContent = v; };
        set('board', s.board);
        set('model', `${s.model.name}, ${s.model.quant} · ${s.model.size_gb} GB`);
        set('watts', `${s.power_w.total.toFixed(1)} W`);
        set('gpu', `${Math.round(s.temps.gpu)} °C · ${Math.min(100, Math.round(s.gpu_load))}% busy`);
        set('tokens', s.llm.tokens_generated.toLocaleString());
        set('up', fmtUp(s.uptime_s));
    } catch { /* the page reads fine without it */ }
}

async function boot() {
    bindReel();
    const sections = [...document.querySelectorAll('.folio[data-passage]')];
    const datas = await Promise.all(sections.map((s) => load(s).catch(() => null)));
    const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
            if (!e.isIntersecting) continue;
            const p = passages.find((x) => x.section === e.target);
            if (p) p.replay();
            io.unobserve(e.target);
        }
    }, { threshold: 0.2 });
    sections.forEach((s, k) => {
        if (!datas[k]) return;
        const p = new Passage(s, datas[k]);
        passages.push(p);
        io.observe(s);
        s.addEventListener('dblclick', () => p.finishReplay());
    });
    const ro = new ResizeObserver((entries) => {
        for (const e of entries) passages.find((p) => p.ms === e.target)?.redraw();
    });
    passages.forEach((p) => ro.observe(p.ms));
    paintStats();
    if (passages[0]) coach(passages[0]);
    live();
    initAsk(passages, ro);
    initLetter();
    initTrack();
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') passages.forEach((p) => p.finishReplay());
    });
}

boot();
