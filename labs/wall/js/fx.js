// Chalk: a puff when a hand latches, a cloud when he lands on the pads, a ring flash on the hold.
// World coordinates (cm), velocities in cm/s. Chalk drifts, it does not fall like a rock.
const parts = [];
const rings = [];

export function puff(x, y, n = 14, power = 1) {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = (20 + Math.random() * 50) * power;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 + 12 * power, life: 0, max: 0.6 + Math.random() * 0.8, r: 1.2 + Math.random() * 2.8 * power });
    }
    if (parts.length > 600) parts.splice(0, parts.length - 600);
}

export function flash(x, y, size = 20) {
    rings.push({ x, y, t: 0, size });
}

export function stepFx(dt) {
    const drag = Math.exp(-dt * 3.2);
    for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;
        if (p.life > p.max) { parts.splice(i, 1); continue; }
        p.vx *= drag;
        p.vy = p.vy * drag - 14 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
    }
    for (let i = rings.length - 1; i >= 0; i--) {
        rings[i].t += dt;
        if (rings[i].t > 0.5) rings.splice(i, 1);
    }
    return parts.length + rings.length > 0;
}

export function drawFx(ctx, view) {
    const { X, Y, s } = view;
    for (const r of rings) {
        const u = r.t / 0.5;
        ctx.strokeStyle = `rgba(255,255,255,${0.85 * (1 - u)})`;
        ctx.lineWidth = Math.max(1, 2.2 * s * (1 - u));
        ctx.beginPath();
        ctx.arc(X(r.x), Y(r.y), (r.size * 0.6 + u * r.size * 0.9) * s, 0, Math.PI * 2);
        ctx.stroke();
    }
    for (const p of parts) {
        const u = p.life / p.max;
        ctx.fillStyle = `rgba(250,248,244,${0.75 * (1 - u) * (1 - u)})`;
        ctx.beginPath();
        ctx.arc(X(p.x), Y(p.y), p.r * (1 + u * 1.8) * s, 0, Math.PI * 2);
        ctx.fill();
    }
}

export function clearFx() {
    parts.length = 0;
    rings.length = 0;
}
