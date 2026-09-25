// Climbing holds, each one sculpted from its seed and baked once into a small sprite at the
// current scale: noisy outline per type, top-left light, contact shadow, texture, bolt, chalk.
import { mulberry32, shade } from './rng.js';

const ASPECT = { jug: [1.55, 0.95], crimp: [2.6, 0.62], sloper: [1.25, 1], pinch: [0.62, 1.55], foot: [1.2, 1], big: [1.7, 1.05] };
let cache = new Map();
let cacheKey = '';

function outline(h, R) {
    const [ax, ay] = ASPECT[h.type] || [1, 1];
    const p1 = R() * 6.28;
    const p2 = R() * 6.28;
    const pts = [];
    for (let i = 0; i < 30; i++) {
        const th = (i / 30) * Math.PI * 2;
        const r = 1 + 0.11 * Math.sin(3 * th + p1) + 0.06 * Math.sin(5 * th + p2) + (R() - 0.5) * 0.04;
        const x = Math.cos(th) * ax * r * 0.5;
        const y = Math.sin(th) * ay * r * 0.5;
        pts.push({ x: x * Math.cos(h.rot) - y * Math.sin(h.rot), y: x * Math.sin(h.rot) + y * Math.cos(h.rot) });
    }
    return pts;
}

// h.size is cm; k = device px per cm. Returns { img, ox, oy } where (ox, oy) is the hold centre in the sprite.
export function sprite(h, k) {
    const key = `${k.toFixed(4)}`;
    if (key !== cacheKey) { cache = new Map(); cacheKey = key; }
    const id = `${h.seed}|${h.color}|${h.type}|${h.dark ? 1 : 0}`;
    if (cache.has(id)) return cache.get(id);
    const R = mulberry32(h.seed);
    const pts = outline(h, R);
    const S = h.size * k;
    const pad = Math.ceil(S * 0.5 + 8 * k);
    const dim = Math.ceil(S * 1.8) + pad * 2;
    const c = document.createElement('canvas');
    c.width = c.height = dim;
    const g = c.getContext('2d');
    const o = dim / 2;
    const path = new Path2D();
    pts.forEach((p, i) => (i ? path.lineTo(o + p.x * S, o + p.y * S) : path.moveTo(o + p.x * S, o + p.y * S)));
    path.closePath();

    // Chalk ghost on the wall around used route holds.
    if (h.route && h.type !== 'foot') {
        const cg = g.createRadialGradient(o, o - S * 0.2, S * 0.2, o, o - S * 0.1, S * 0.95);
        cg.addColorStop(0, `rgba(255,255,255,${h.dark ? 0.16 : 0.5})`);
        cg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = cg;
        g.fillRect(0, 0, dim, dim);
    }
    g.save();
    g.shadowColor = 'rgba(20,15,10,0.42)';
    g.shadowBlur = 3.5 * k;
    g.shadowOffsetX = 1.6 * k;
    g.shadowOffsetY = 2.6 * k;
    g.fillStyle = h.color;
    g.fill(path);
    g.restore();
    g.save();
    g.clip(path);
    const hi = g.createRadialGradient(o - S * 0.22, o - S * 0.28, S * 0.02, o - S * 0.1, o - S * 0.1, S * 0.9);
    hi.addColorStop(0, 'rgba(255,255,255,0.55)');
    hi.addColorStop(0.35, 'rgba(255,255,255,0.12)');
    hi.addColorStop(1, 'rgba(0,0,0,0.32)');
    g.fillStyle = hi;
    g.fillRect(0, 0, dim, dim);
    for (let i = 0; i < 40; i++) {   // moulded grit
        g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.13)' : 'rgba(255,255,255,0.16)';
        g.fillRect(o + (R() - 0.5) * S * 1.6, o + (R() - 0.5) * S * 1.6, 0.5 * k + 0.5, 0.5 * k + 0.5);
    }
    if (h.type === 'jug' || h.type === 'big') {   // the incut you actually grab
        g.fillStyle = 'rgba(15,8,30,0.45)';
        g.beginPath();
        g.ellipse(o, o - S * 0.26, S * 0.46, S * 0.13, h.rot, 0, Math.PI * 2);
        g.fill();
    }
    if (h.route && h.type !== 'foot') {   // chalk on the grip
        const ch = g.createLinearGradient(0, o - S * 0.5, 0, o + S * 0.1);
        ch.addColorStop(0, 'rgba(250,248,244,0.75)');
        ch.addColorStop(1, 'rgba(250,248,244,0)');
        g.fillStyle = ch;
        g.fillRect(0, 0, dim, dim);
    }
    g.restore();
    // The bolt.
    const br = Math.max(1, (h.type === 'foot' ? 0.9 : 1.5) * k);
    g.fillStyle = '#1d1b1a';
    g.beginPath();
    g.arc(o + S * 0.04, o + S * 0.04, br, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = shade(h.base || '#888888', 0.4);
    g.lineWidth = Math.max(0.6, 0.35 * k);
    g.stroke();
    const out = { img: c, ox: o, oy: o };
    cache.set(id, out);
    return out;
}

// A wooden volume: a shallow pyramid bolted to the wall, three faces lit from the top left.
export function drawVolume(ctx, v, view) {
    const R = mulberry32(v.seed);
    const pts = [
        { x: v.x - v.w / 2, y: v.y - v.h / 2 + R() * 12 },
        { x: v.x + v.w / 2, y: v.y - v.h / 2 + R() * 12 },
        { x: v.x + (R() - 0.5) * v.w * 0.3, y: v.y + v.h / 2 },
    ].map((p) => ({ x: view.X(p.x), y: view.Y(p.y) }));
    const apex = { x: view.X(v.x + v.w * 0.08), y: view.Y(v.y - v.h * 0.08) };
    const faces = [[0, 1, '#b99469'], [1, 2, '#d3b287'], [2, 0, '#e6cda3']];
    ctx.save();
    ctx.shadowColor = 'rgba(25,18,10,0.35)';
    ctx.shadowBlur = 14 * view.s;
    ctx.shadowOffsetX = 5 * view.s;
    ctx.shadowOffsetY = 8 * view.s;
    ctx.fillStyle = '#c9a77b';
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.fill();
    ctx.restore();
    for (const [a, b, fill] of faces) {
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[b].x, pts[b].y);
        ctx.lineTo(apex.x, apex.y);
        ctx.fill();
        ctx.strokeStyle = 'rgba(80,55,25,0.35)';
        ctx.lineWidth = Math.max(1, 0.4 * view.s);
        ctx.stroke();
    }
}
