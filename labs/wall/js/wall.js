// The gym: painted plywood panels on a T-nut grid, a charcoal cave for the crux, other routes'
// holds everywhere, crash pads below, the lip and the ceiling lights above.
import { mulberry32, mix } from './rng.js';
import { sprite, drawVolume } from './holds.js';
import { drawFloor, drawTop } from './scenery.js';

export const PAINT = { start: '#ebe7df', slab: '#efebe4', vertical: '#e3ded5', overhang: '#3b4149', volumes: '#e8e3da', board: '#e6e0d6', roof: '#2f3a48', top: '#e9e5dd' };
export const DARK = new Set(['overhang', 'roof']);
const ROUTE = ['#6a3df0', '#7446f5', '#5f35e0'];
const OTHER = ['#f2c230', '#2fa36b', '#f07f2d', '#2d7fd6', '#1f1f22', '#f4f1ea', '#d6376b', '#35b3b0'];
const TYPES = ['jug', 'crimp', 'sloper', 'pinch', 'foot', 'crimp', 'jug'];
const SIZES = { jug: 20, crimp: 13, sloper: 22, pinch: 13, foot: 7 };

export function buildScene(layout, route) {
    const R = mulberry32(7);
    const bandAt = (y) => layout.bands.find((b) => y >= b.y0 && y < b.y1) || layout.bands[layout.bands.length - 1];
    route.holds.forEach((h, i) => {
        h.base = ROUTE[i % 3];
        h.color = h.base;
        h.dark = DARK.has(bandAt(h.y).type);
    });
    const decor = [];
    const near = (x, y, r) => route.holds.some((h) => Math.abs(h.x - x) < r && Math.abs(h.y - y) < r);
    for (let y = 30; y < layout.lipY - 20; y += 26) {
        for (let n = 0; n < Math.max(2, layout.W / 90); n++) {
            const x = 12 + R() * (layout.W - 24);
            if (R() < 0.45 || near(x, y, 30)) continue;
            const type = TYPES[(R() * TYPES.length) | 0];
            const base = OTHER[(R() * OTHER.length) | 0];
            const paint = PAINT[bandAt(y).type];
            decor.push({ x, y: y + (R() - 0.5) * 20, type, base, color: mix(base, paint, DARK.has(bandAt(y).type) ? 0.35 : 0.28), size: SIZES[type] * (0.8 + R() * 0.5), rot: (R() - 0.5) * 3, seed: (R() * 1e9) | 0, route: false });
        }
    }
    const lights = [];
    for (let y = 120; y < layout.lipY + 400; y += 380) lights.push({ x: layout.W * (lights.length % 2 ? 0.72 : 0.22), y });
    return { decor, lights, bandAt, tile: null, tileK: 0 };
}

function tNutTile(k) {
    const size = Math.max(4, Math.round(20 * k));
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const R = mulberry32(3);
    for (let i = 0; i < size * size * 0.02; i++) {
        g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)';
        g.fillRect(R() * size, R() * size, 1, 1);
    }
    const r = Math.max(1, 0.75 * k);
    g.fillStyle = 'rgba(40,35,30,0.45)';
    g.beginPath();
    g.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.3)';
    g.lineWidth = Math.max(0.6, 0.25 * k);
    g.beginPath();
    g.arc(size / 2 + 0.3 * k, size / 2 + 0.3 * k, r * 1.5, 0, Math.PI * 2);
    g.stroke();
    return c;
}

export function drawWall(ctx, view, layout, route, scene) {
    const { X, Y, s, camY, V, dpr } = view;
    const W = layout.W;
    const lo = camY - 20;
    const hi = camY + V + 20;
    const vw = layout.vw;
    // Paint by band, with an angle gradient: slabs catch the light, caves fall into shadow.
    for (const b of layout.bands) {
        if (b.y1 < lo || b.y0 > hi) continue;
        const top = Math.min(b.y1, layout.lipY);
        if (b.y0 >= top) continue;
        ctx.fillStyle = PAINT[b.type];
        ctx.fillRect(0, Y(top), vw, Y(b.y0) - Y(top) + 1);
        const g = ctx.createLinearGradient(0, Y(top), 0, Y(b.y0));
        g.addColorStop(0, DARK.has(b.type) ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.18)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, Y(top), vw, Y(b.y0) - Y(top) + 1);
        if (b.y0 > 0) {   // the kicker where the wall changes angle
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.fillRect(0, Y(b.y0), vw, Math.max(1, 1.2 * s));
            ctx.fillStyle = DARK.has(b.type) ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.4)';
            ctx.fillRect(0, Y(b.y0) - Math.max(1, 1.4 * s), vw, Math.max(1, 1 * s));
        }
    }
    // T-nut grid.
    const k = s * dpr;
    if (scene.tileK !== k) { scene.tile = ctx.createPattern(tNutTile(k), 'repeat'); scene.tileK = k; }
    const tilePx = Math.round(20 * k) / dpr;
    scene.tile.setTransform(new DOMMatrix().scale(1 / dpr).translate(0, (Y(0) % tilePx) * dpr));
    ctx.fillStyle = scene.tile;
    const wy0 = Math.max(Y(layout.lipY), 0);
    const wy1 = Math.min(Y(0), layout.vh);
    if (wy1 > wy0) ctx.fillRect(0, wy0, vw, wy1 - wy0);
    // Plywood seams every 122 cm (4 ft).
    ctx.strokeStyle = 'rgba(0,0,0,0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 122; x < W; x += 122) { ctx.moveTo(X(x), wy0); ctx.lineTo(X(x), wy1); }
    for (let y = Math.ceil(Math.max(lo, 0) / 122) * 122; y < Math.min(hi, layout.lipY); y += 122) { ctx.moveTo(0, Y(y)); ctx.lineTo(vw, Y(y)); }
    ctx.stroke();
    // Pools of light from the ceiling.
    for (const l of scene.lights) {
        if (Math.abs(l.y - (lo + hi) / 2) > V + 400) continue;
        const g = ctx.createRadialGradient(X(l.x), Y(l.y), 0, X(l.x), Y(l.y), 340 * s);
        g.addColorStop(0, 'rgba(255,248,230,0.2)');
        g.addColorStop(1, 'rgba(255,248,230,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, Y(l.y + 340), vw, 680 * s);
    }
    drawFloor(ctx, view, layout);
    drawTop(ctx, view, layout);
    for (const v of route.volumes) if (v.y > lo - 100 && v.y < hi + 100) drawVolume(ctx, v, view);
    for (const h of route.holds) if (h.start && h.y > lo) drawTape(ctx, h, view);
    const draw = (h) => {
        if (h.y < lo - 40 || h.y > hi + 40) return;
        const sp = sprite(h, k);
        ctx.drawImage(sp.img, X(h.x) - sp.ox / dpr, Y(h.y) - sp.oy / dpr, sp.img.width / dpr, sp.img.height / dpr);
    };
    scene.decor.forEach(draw);
    route.holds.forEach(draw);
}

function drawTape(ctx, h, view) {
    ctx.save();
    ctx.translate(view.X(h.x), view.Y(h.y - 17));
    ctx.rotate(-0.12);
    ctx.fillStyle = '#6a3df0';
    ctx.fillRect(-9 * view.s, -2.2 * view.s, 18 * view.s, 4.4 * view.s);
    ctx.restore();
}
