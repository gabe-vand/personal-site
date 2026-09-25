// The route topo: a side profile of the wall (slab leans back, the cave leans out, the roof is
// nearly flat) with each section as a stop you can jump to, and an orange dot for the climber.
const NS = 'http://www.w3.org/2000/svg';
const LEAN = { start: -0.05, slab: -0.28, vertical: 0, overhang: 0.55, volumes: 0.12, board: 0, roof: 1.1, top: 0 };
let svg;
let wallPath;
let donePath;
let me;
let pts = [];
let links = [];
let H = 0;
let top = 1;

const el = (name, attrs, parent) => {
    const n = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    parent.append(n);
    return n;
};

export function buildTopo(layout, jump) {
    svg = document.getElementById('topo-svg');
    const box = svg.getBoundingClientRect();
    H = box.height;
    const Wd = box.width;
    top = layout.lipY + 40;
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${Wd} ${H}`);
    // Profile: x offsets accumulate with each band's lean; scale them to fit the strip.
    let off = 0;
    const raw = [{ y: 0, x: 0 }];
    for (const b of layout.bands) {
        const y1 = Math.min(b.y1, layout.lipY);
        if (y1 <= b.y0) continue;
        off += (y1 - b.y0) * (LEAN[b.type] || 0) * 0.35;
        raw.push({ y: y1, x: off });
    }
    const span = Math.max(1, ...raw.map((p) => p.x)) - Math.min(0, ...raw.map((p) => p.x));
    const minX = Math.min(0, ...raw.map((p) => p.x));
    const w = layout.mobile ? Wd * 0.6 : 44;
    const x0 = Wd - (layout.mobile ? Wd * 0.8 : 72);
    pts = raw.map((p) => ({ y: p.y, sx: x0 + ((p.x - minX) / span) * w, sy: toY(p.y) }));
    el('line', { class: 'topo-floor', x1: pts[0].sx - 16, x2: Wd, y1: H, y2: H }, svg);
    wallPath = el('polyline', { class: 'topo-wall', points: pts.map((p) => `${p.sx},${p.sy}`).join(' ') }, svg);
    donePath = el('polyline', { class: 'topo-done', points: '' }, svg);
    for (const b of layout.bands) el('circle', { class: 'topo-tick', cx: xAt(b.focus), cy: toY(b.focus), r: layout.mobile ? 3.5 : 4 }, svg);
    me = el('circle', { class: 'topo-me', r: layout.mobile ? 5 : 6, cx: pts[0].sx, cy: H }, svg);
    links = [...document.querySelectorAll('#topo-list a')];
    for (const a of links) {
        const b = layout.bands.find((x) => x.id === a.dataset.band);
        a.parentElement.style.top = `${toY(b.focus)}px`;
        if (layout.mobile) a.parentElement.style.right = `${Wd - xAt(b.focus) - 9}px`;
        a.onclick = (e) => { e.preventDefault(); jump(b); };
    }
    void wallPath;
}

function toY(y) {
    return H - (Math.max(0, Math.min(top, y)) / top) * H;
}

function xAt(y) {
    for (let i = 1; i < pts.length; i++) {
        if (y <= pts[i].y) {
            const a = pts[i - 1];
            const b = pts[i];
            const t = (y - a.y) / Math.max(1, b.y - a.y);
            return a.sx + (b.sx - a.sx) * t;
        }
    }
    return pts[pts.length - 1].sx;
}

export function paintTopo(hipY, bandId) {
    if (!svg) return;
    const y = Math.max(0, hipY);
    const done = pts.filter((p) => p.y < y).map((p) => `${p.sx},${p.sy}`);
    done.push(`${xAt(y)},${toY(y)}`);
    donePath.setAttribute('points', done.join(' '));
    me.setAttribute('cx', xAt(y));
    me.setAttribute('cy', toY(y));
    for (const a of links) a.classList.toggle('is-here', a.dataset.band === bandId);
}
