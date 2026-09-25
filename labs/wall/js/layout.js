// Measures the real cards and turns the page into a wall: each <section class="band"> becomes a
// stretch of wall tall enough for its cards, and every card gets a world position (cm, y up).
// Items climb in DOM order: the first card in a band is the lowest, the one you reach first.
import { clamp } from './rng.js';

const MIN = { start: 420, slab: 360, vertical: 480, overhang: 720, volumes: 400, board: 520, roof: 440, top: 420 };

export function computeLayout(world) {
    const vw = innerWidth;
    const vh = innerHeight;
    const mobile = vw < 760 || (vw < 1180 && vw / vh < 1.1);   // phones and portrait tablets: one column
    const V = mobile ? Math.max(600, vh / 1.5) : 470;           // wall visible top to bottom, cm
    const s = vh / V;                            // px per cm
    const W = vw / s;
    const anchor = mobile ? 0.26 : 0.4;          // pelvis height on screen, from the bottom
    const routeX = mobile ? W * 0.5 : clamp(W * 0.27, 140, 330);
    const rail = mobile ? 30 : 150;
    const mainL = mobile ? 12 : Math.max(routeX * s + 170, vw * 0.43);
    const main = { l: mainL, w: mobile ? Math.min(680, vw - 12 - rail) : Math.min(680, vw - rail - mainL) };
    const leftW = mobile ? 0 : Math.min(300, routeX * s - 150 - 34);
    const left = leftW >= 190 ? { l: 34, w: leftW } : null;
    const gap = (mobile ? 26 : 34) / s;

    const bands = [...world.querySelectorAll('.band')].map((el) => ({
        el, id: el.dataset.band, type: el.dataset.type, items: [...el.querySelectorAll('[data-item]')],
    }));
    const placed = [];
    for (const b of bands) {
        for (const el of b.items) {
            const col = el.dataset.side === 'left' && left ? left : main;
            const w = Math.min(col.w, Number(el.dataset.maxw) || Infinity);
            el.style.left = `${col === main && w < col.w && !mobile ? col.l + 24 : col.l}px`;
            el.style.width = `${w}px`;
            placed.push({ el, band: b, col: col === left ? 'left' : 'main' });
        }
    }
    for (const it of placed) it.h = it.el.offsetHeight / s;

    const shift = (0.5 - anchor) * V;            // screen centre sits this far above the pelvis
    const pad = mobile ? 0.34 * V : 0.14 * V;
    let y = 0;
    let lipY = 0;
    for (const b of bands) {
        b.y0 = y;
        const cols = { main: placed.filter((p) => p.band === b && p.col === 'main'), left: placed.filter((p) => p.band === b && p.col === 'left') };
        const stackH = (list) => list.reduce((a, p) => a + p.h, 0) + gap * Math.max(0, list.length - 1);
        const tallest = Math.max(stackH(cols.main), stackH(cols.left));
        let bottom;
        if (b.type === 'start') {
            const first = cols.main[0];
            bottom = Math.max(18, 85 + (mobile ? (0.66 - anchor) * V : shift) - first.h / 2);
        } else if (b.type === 'top') {
            lipY = y + (mobile ? 200 : 240);
            bottom = lipY + 96 + shift - tallest / 2;
        } else {
            bottom = y + Math.max(pad, (Math.max(MIN[b.type], tallest + 2 * pad) - tallest) / 2);
        }
        let top = bottom;
        for (const list of Object.values(cols)) {
            let yy = bottom;
            for (const it of list) {
                it.y = yy;
                it.el.style.bottom = `${yy * s}px`;
                it.el.dataset.y = String(yy + it.h / 2);
                yy += it.h + gap;
            }
            top = Math.max(top, yy - gap);
        }
        b.stackBottom = bottom;
        b.focus = b.type === 'top' ? lipY + 96 : (cols.main[0] ? cols.main[0].y + cols.main[0].h / 2 - shift : y + 100);
        b.y1 = b.type === 'top' ? Math.max(lipY + 96 + (1 - anchor) * V, top + 40) : Math.max(y + MIN[b.type], top + pad);
        if (b.type === 'volumes') {
            b.features = cols.main.map((it) => ({ name: it.el.dataset.volume, y: it.y + it.h / 2 - shift + 30 }));
        }
        y = b.y1;
    }
    return { vw, vh, mobile, V, s, W, anchor, routeX, bands, lipY, placed, main };
}
