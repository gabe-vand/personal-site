// Turns a point on the beta (p = move index + fraction) into a body: pelvis, torso frame, and where
// each hand and foot is. A normal move is weight shift -> reach -> latch; the dyno is its own thing.
import { clamp, lerp, lerpPt, smooth, easeOut, dist } from './rng.js';
import { frame, leanFor, settle, LIMBS, SIDE, isArm } from './solver.js';
import { contactsOf } from './route.js';

export const LATCH = { reach: 0.8, step: 0.8, dyno: 0.6 };

// Where a limb goes when it is not on anything: arms hang, legs dangle, or arms up after a send.
export function restPoint(fr, limb, celebrate = 0, t = 0) {
    const r = fr[limb];
    const s = SIDE[limb];
    if (isArm(limb)) {
        const down = { x: r.x + s * 15, y: r.y - 50 };
        const up = { x: r.x + s * 30, y: r.y + 48 + 4 * Math.sin(t * 7 + s) };
        return lerpPt(down, up, celebrate);
    }
    return { x: r.x + s * 5, y: r.y - 82 };
}

const pointOf = (st, limb, fr, celebrate, t) => (st[limb] && !st[limb].free ? st[limb] : restPoint(fr, limb, celebrate, t));

function arc(a, b, t, limb) {
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    const p = lerpPt(a, b, e);
    const bulge = Math.sin(Math.PI * t) * Math.min(11, dist(a, b) * 0.22);
    return { x: p.x + SIDE[limb] * bulge, y: p.y + (isArm(limb) ? bulge * 0.2 : bulge * 0.5) };
}

export function poseAt(route, p, t, celebrate = 0) {
    const n = route.moves.length;
    p = clamp(p, 0, n);
    const i = Math.min(Math.floor(p), n - 1);
    const f = p - i;
    const A = route.states[i];
    const B = route.states[i + 1];
    const mv = route.moves[i];
    if (mv.kind === 'dyno') return dyno(A, B, f, t);

    const lt = {};
    mv.limbs.forEach((limb, k) => { lt[limb] = smooth(0.2 + k * 0.1, Math.min(1, 0.74 + k * 0.08), f); });
    const twist = lerp(A.twist, B.twist, smooth(0, 0.8, f));
    let hip = lerpPt(A.hipS, B.hipS, smooth(0, 0.82, f));
    hip.y += Math.sin(t * 1.7) * 0.7 * (1 - Math.sin(Math.PI * f));   // breathing when still
    const cA = contactsOf(A);
    const cB = contactsOf(B);
    const anchored = {};
    for (const limb of LIMBS) anchored[limb] = limb in lt ? (lt[limb] >= 1 ? cB[limb] : null) : cA[limb];
    const leanRef = { ...anchored };
    for (const limb of ['lh', 'rh']) if (limb in lt && cA[limb] && cB[limb]) leanRef[limb] = lerpPt(cA[limb], cB[limb], lt[limb]);
    hip = settle(hip, anchored, 10, twist);
    const fr = frame(hip, leanFor(hip, leanRef), twist);
    const ends = {};
    const bend = {};
    for (const limb of LIMBS) {
        if (limb in lt) {
            ends[limb] = arc(pointOf(A, limb, fr, 0, t), pointOf(B, limb, fr, celebrate, t), lt[limb], limb);
            bend[limb] = lt[limb] < 0.5 ? A.bend[limb] : B.bend[limb];
        } else {
            ends[limb] = pointOf(A, limb, fr, celebrate, t);
            bend[limb] = A.bend[limb];
        }
    }
    return { hip, fr, ends, bend, twist, i, f, mv };
}

// Crouch, explode, fly, catch, then the feet cut and swing out under the jug.
function dyno(A, B, f, t) {
    const crouch = { x: A.hipS.x - 4, y: A.hipS.y - 22 };
    const cA = contactsOf(A);
    const ends = {};
    let hip;
    let fr;
    if (f < 0.3) {
        hip = settle(lerpPt(A.hipS, crouch, smooth(0, 1, f / 0.3)), cA, 10);
        fr = frame(hip, leanFor(hip, cA));
        for (const limb of LIMBS) ends[limb] = cA[limb];
    } else if (f < LATCH.dyno) {
        const u = (f - 0.3) / (LATCH.dyno - 0.3);
        hip = lerpPt(crouch, { x: B.hipS.x, y: B.hipS.y + 16 }, easeOut(u));
        hip.y += Math.sin(Math.PI * u) * 10;
        fr = frame(hip, 0);
        for (const limb of ['lh', 'rh']) ends[limb] = lerpPt(cA[limb], B[limb], smooth(0.02, 0.95, u));
        for (const limb of ['lf', 'rf']) ends[limb] = lerpPt(cA[limb], restPoint(fr, limb), smooth(0, 0.55, u));
    } else {
        const u = (f - LATCH.dyno) / (1 - LATCH.dyno);
        const sw = Math.sin(u * Math.PI * 2.6) * (1 - u) * 26;
        const cB = { lh: B.lh, rh: B.rh };
        hip = { x: B.hipS.x + sw, y: B.hipS.y + 16 * (1 - smooth(0, 0.3, u)) - Math.abs(sw) * 0.2 };
        hip = settle(hip, cB, 10);
        fr = frame(hip, leanFor(hip, cB));
        ends.lh = B.lh;
        ends.rh = B.rh;
        for (const limb of ['lf', 'rf']) {
            const r = restPoint(fr, limb);
            ends[limb] = { x: r.x - sw * 0.9, y: r.y + Math.abs(sw) * 0.25 };
        }
    }
    return { hip, fr, ends, bend: {}, twist: 1, i: -1, f, mv: { kind: 'dyno' } };
}

// A fall from wherever he was, onto the pads, then back up to standing.
export function fallPose(from, tt, groundX) {
    const h0 = from.hip.y;
    const dur = clamp(0.55 + h0 / 2600, 0.65, 1.4);
    let hip;
    let ang = 0;
    const ends = {};
    if (tt < dur) {
        const u = tt / dur;
        hip = { x: lerp(from.hip.x, groundX, u), y: lerp(h0, 62, u * u) };
        ang = Math.sin(tt * 5) * 0.25 * (1 - u);
        const fr = frame(hip, ang);
        for (const limb of LIMBS) {
            const s = SIDE[limb];
            const r = fr[limb];
            ends[limb] = isArm(limb)
                ? { x: r.x + s * (28 + 10 * Math.sin(tt * 17 + s)), y: r.y + 30 + 14 * Math.cos(tt * 13 + s) }
                : { x: r.x + s * (14 + 10 * Math.sin(tt * 15 + s * 2)), y: r.y - 58 + 16 * Math.cos(tt * 15 + s * 2) };
        }
        return { hip, fr, ends, bend: {}, twist: 1, falling: true, dur };
    }
    const u = tt - dur;
    const squat = smooth(0, 0.12, u) * (1 - smooth(0.25, 0.8, u));
    hip = { x: groundX, y: 84 - 36 * squat };
    const fr = frame(hip, 0);
    ends.lf = { x: groundX - 17, y: 0 };
    ends.rf = { x: groundX + 17, y: 0 };
    ends.lh = restPoint(fr, 'lh');
    ends.rh = restPoint(fr, 'rh');
    if (u < 0.3) { ends.lh = { x: fr.lh.x - 30, y: fr.lh.y - 40 }; ends.rh = { x: fr.rh.x + 30, y: fr.rh.y - 40 }; }
    return { hip, fr, ends, bend: {}, twist: 1, landed: true, done: u > 1.05, dur };
}

export function mixPose(a, b, k) {
    const hip = lerpPt(a.hip, b.hip, k);
    const fr = frame(hip, lerp(a.fr.ang, b.fr.ang, k), lerp(a.twist, b.twist, k));
    const ends = {};
    for (const limb of LIMBS) ends[limb] = lerpPt(a.ends[limb], b.ends[limb], k);
    return { ...b, hip, fr, ends };
}
