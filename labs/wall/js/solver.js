// The body: proportions, where the hips want to be for a set of contacts, and two-bone IK.
// World units are centimetres, y up from the floor. Seen from behind (we face the wall with him).
import { clamp } from './rng.js';

export const BODY = { torso: 50, shoulder: 20, hip: 12, upper: 30, fore: 29, thigh: 44, shin: 43, head: 11, neck: 8 };
const ARM = BODY.upper + BODY.fore;
const LEG = BODY.thigh + BODY.shin;
export const LIMBS = ['lh', 'rh', 'lf', 'rf'];
export const SIDE = { lh: -1, rh: 1, lf: -1, rf: 1 };
export const isArm = (limb) => limb[1] === 'h';

// Torso lean (radians from vertical) toward the hands, so reaching sideways tilts the chest.
export function leanFor(hip, contacts) {
    const hands = [contacts.lh, contacts.rh].filter(Boolean);
    if (!hands.length) return 0;
    const mx = hands.reduce((a, h) => a + h.x, 0) / hands.length;
    return clamp((mx - hip.x) / 110, -0.38, 0.38);
}

// Anchor points of the torso for a pelvis position, lean and twist (1 = square to the wall).
export function frame(hip, ang, twist = 1) {
    const up = { x: Math.sin(ang), y: Math.cos(ang) };
    const rt = { x: Math.cos(ang), y: -Math.sin(ang) };
    const chest = { x: hip.x + up.x * BODY.torso, y: hip.y + up.y * BODY.torso };
    const sw = BODY.shoulder * twist;
    const hw = BODY.hip * (0.6 + 0.4 * twist);
    return {
        hip, chest, up, rt, ang,
        lh: { x: chest.x - rt.x * sw, y: chest.y - rt.y * sw },
        rh: { x: chest.x + rt.x * sw, y: chest.y + rt.y * sw },
        lf: { x: hip.x - rt.x * hw, y: hip.y - rt.y * hw },
        rf: { x: hip.x + rt.x * hw, y: hip.y + rt.y * hw },
    };
}

// Where the pelvis would like to be before reach limits are applied.
export function desiredHip(c) {
    const hands = [c.lh, c.rh].filter(Boolean);
    const feet = [c.lf, c.rf].filter(Boolean);
    const all = hands.concat(feet);
    const x = all.reduce((a, p) => a + p.x, 0) / all.length;
    const hy = hands.length ? hands.reduce((a, p) => a + p.y, 0) / hands.length - 104 : null;
    const fy = feet.length ? feet.reduce((a, p) => a + p.y, 0) / feet.length + 64 : null;
    const y = hy == null ? fy : fy == null ? hy - 20 : hy * 0.6 + fy * 0.4;
    return { x, y };
}

// Move the pelvis (rigidly, torso follows) until every anchored limb is within reach.
export function settle(hip, contacts, iters = 24, twist = 1) {
    const h = { x: hip.x, y: hip.y };
    for (let k = 0; k < iters; k++) {
        const f = frame(h, leanFor(h, contacts), twist);
        let dx = 0;
        let dy = 0;
        let n = 0;
        for (const limb of LIMBS) {
            const p = contacts[limb];
            if (!p) continue;
            const r = f[limb];
            const max = (isArm(limb) ? ARM : LEG) * 0.965;
            const min = isArm(limb) ? 18 : 30;
            const vx = p.x - r.x;
            const vy = p.y - r.y;
            const d = Math.hypot(vx, vy) || 1e-6;
            if (d > max) { dx += (vx / d) * (d - max); dy += (vy / d) * (d - max); n++; }
            else if (d < min) { dx -= (vx / d) * (min - d); dy -= (vy / d) * (min - d); n++; }
        }
        if (!n) break;
        h.x += (dx / n) * 0.8;
        h.y += (dy / n) * 0.8;
    }
    return h;
}

// Worst reach violation (cm) for a pelvis position: 0 means every contact is held.
export function strain(hip, contacts, twist = 1) {
    const f = frame(hip, leanFor(hip, contacts), twist);
    let worst = 0;
    for (const limb of LIMBS) {
        const p = contacts[limb];
        if (!p) continue;
        const d = Math.hypot(p.x - f[limb].x, p.y - f[limb].y);
        worst = Math.max(worst, d - (isArm(limb) ? ARM : LEG));
    }
    return worst;
}

// Two-bone IK. pref says which side the elbow/knee should bend toward.
export function ik(root, target, a, b, pref) {
    const vx = target.x - root.x;
    const vy = target.y - root.y;
    const d = Math.hypot(vx, vy) || 1e-6;
    const dc = clamp(d, Math.abs(a - b) + 1, a + b - 0.3);
    const ux = vx / d;
    const uy = vy / d;
    const along = (a * a - b * b + dc * dc) / (2 * dc);
    const h = Math.sqrt(Math.max(0, a * a - along * along));
    let px = -uy;
    let py = ux;
    if (px * pref.x + py * pref.y < 0) { px = -px; py = -py; }
    return {
        joint: { x: root.x + ux * along + px * h, y: root.y + uy * along + py * h },
        end: { x: root.x + ux * dc, y: root.y + uy * dc },
    };
}

// Bend preferences: elbows out and down, knees out and a little up; a drop-knee turns it in.
export function bendPref(limb, style) {
    const s = SIDE[limb];
    if (isArm(limb)) return { x: s, y: -0.7 };
    if (style === 'drop') return { x: -s, y: -0.9 };
    if (style === 'heel') return { x: s * 0.4, y: 1 };
    return { x: s, y: 0.3 };
}

export { ARM, LEG };
