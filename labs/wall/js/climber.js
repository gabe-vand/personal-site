// Draws the climber from behind: tapered limbs from two-bone IK, a tee, chalk bag, messy hair,
// climbing shoes. Everything is computed in world cm and mapped to the screen by the view.
import { BODY, ik, bendPref, LIMBS } from './solver.js';

const C = {
    tee: '#ff5a1f', teeDark: '#c9400f', teeLight: '#ff8a55', pants: '#46679b', pantsLight: '#5d7fb5',
    skin: '#e2ad8a', skinDark: '#bf8966', hair: '#2b1d15', shoe: '#1b1b1f', rand: '#ffd23f', bag: '#2f6fd0', chalk: '#f3ede4',
};

export function limbsOf(pose) {
    const out = {};
    for (const limb of LIMBS) {
        const arm = limb[1] === 'h';
        const root = pose.fr[limb];
        const { joint, end } = ik(root, pose.ends[limb], arm ? BODY.upper : BODY.thigh, arm ? BODY.fore : BODY.shin, bendPref(limb, pose.bend[limb]));
        out[limb] = { root, joint, end, style: pose.bend[limb] };
    }
    return out;
}

// Tapered capsule between two screen points.
function seg(ctx, a, b, w1, w2, fill) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1e-6;
    const nx = -dy / d;
    const ny = dx / d;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(a.x + nx * w1, a.y + ny * w1);
    ctx.lineTo(b.x + nx * w2, b.y + ny * w2);
    ctx.lineTo(b.x - nx * w2, b.y - ny * w2);
    ctx.lineTo(a.x - nx * w1, a.y - ny * w1);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(a.x, a.y, w1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(b.x, b.y, w2, 0, Math.PI * 2);
    ctx.fill();
}

function blob(ctx, c, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
}

// mono: when set, every fill is that colour (used for the soft shadow on the wall).
export function drawClimber(ctx, pose, view, mono) {
    const P = (p) => ({ x: view.X(p.x), y: view.Y(p.y) });
    const k = view.s;
    const col = (c) => mono || c;
    const L = limbsOf(pose);
    const fr = pose.fr;
    const hip = P(fr.hip);
    const chest = P(fr.chest);

    // Arms first: from behind, they reach past the head to the wall. Short sleeves, chalked hands.
    for (const limb of ['lh', 'rh']) {
        const { root, joint, end } = L[limb];
        const r = P(root);
        const j = P(joint);
        const e = P(end);
        seg(ctx, r, j, 4.9 * k, 4.1 * k, col(C.skin));
        seg(ctx, j, e, 4.1 * k, 3.3 * k, col(C.skin));
        const sleeve = { x: r.x + (j.x - r.x) * 0.38, y: r.y + (j.y - r.y) * 0.38 };
        seg(ctx, r, sleeve, 6.2 * k, 5.4 * k, col(C.tee));
        blob(ctx, e, 4.3 * k, col(C.chalk));
    }

    // Legs: thigh, shin, shoe. Heel hooks show the shoe side-on.
    for (const limb of ['lf', 'rf']) {
        const { root, joint, end, style } = L[limb];
        const r = P(root);
        const j = P(joint);
        const e = P(end);
        seg(ctx, r, j, 7.6 * k, 5.6 * k, col(C.pants));
        seg(ctx, j, e, 5.4 * k, 3.9 * k, col(C.pants));
        const ang = Math.atan2(e.y - j.y, e.x - j.x);
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(style === 'heel' ? ang + (limb === 'rf' ? -1.2 : 1.2) : ang);
        ctx.fillStyle = col(C.shoe);
        ctx.beginPath();
        ctx.ellipse(2 * k, 0, (style === 'heel' ? 8 : 6.5) * k, (style === 'heel' ? 4.6 : 5.2) * k, 0, 0, Math.PI * 2);
        ctx.fill();
        if (!mono) {
            ctx.fillStyle = C.rand;
            ctx.fillRect(-1.6 * k, -4.4 * k, 1.6 * k, 8.8 * k);
        }
        ctx.restore();
    }

    // Hips and pants seat.
    const hl = P(fr.lf);
    const hr = P(fr.rf);
    seg(ctx, hl, hr, 8.4 * k, 8.4 * k, col(C.pants));

    // Torso: the tee from behind, wider at the lats, with a spine crease and shoulder blades.
    const sl = P(fr.lh);
    const sr = P(fr.rh);
    const ux = (chest.x - hip.x) / (BODY.torso * k);
    const uy = (chest.y - hip.y) / (BODY.torso * k);
    const wl = { x: hl.x - (sr.x - sl.x) * 0.06, y: hl.y };
    const wr = { x: hr.x + (sr.x - sl.x) * 0.06, y: hr.y };
    ctx.beginPath();
    ctx.moveTo(sl.x - (sr.x - sl.x) * 0.1, sl.y + 2 * k);
    ctx.quadraticCurveTo(sl.x - (sr.x - sl.x) * 0.02 + ux * 18 * k, sl.y + uy * 22 * k, wl.x, wl.y + 3 * k);
    ctx.lineTo(wr.x, wr.y + 3 * k);
    ctx.quadraticCurveTo(sr.x + (sr.x - sl.x) * 0.02 + ux * 18 * k, sr.y + uy * 22 * k, sr.x + (sr.x - sl.x) * 0.1, sr.y + 2 * k);
    ctx.quadraticCurveTo(chest.x, chest.y - 4 * k, sl.x - (sr.x - sl.x) * 0.1, sl.y + 2 * k);
    if (mono) ctx.fillStyle = mono;
    else {
        const g = ctx.createLinearGradient(sl.x, 0, sr.x, 0);
        g.addColorStop(0, C.teeDark);
        g.addColorStop(0.45, C.tee);
        g.addColorStop(1, C.teeLight);
        ctx.fillStyle = g;
    }
    ctx.fill();
    if (!mono) {
        ctx.strokeStyle = 'rgba(90,25,0,0.35)';
        ctx.lineWidth = 0.7 * k;
        ctx.beginPath();
        ctx.moveTo(chest.x - ux * 6 * k, chest.y - uy * 6 * k);
        ctx.lineTo(hip.x + ux * 10 * k, hip.y + uy * 10 * k);
        for (const s of [sl, sr]) {
            const m = { x: (s.x + chest.x) / 2, y: (s.y + chest.y) / 2 };
            ctx.moveTo(m.x - uy * 6 * k, m.y + ux * 6 * k - uy * 3 * k);
            ctx.quadraticCurveTo(m.x + ux * 9 * k, m.y + uy * 9 * k + 6 * k, m.x + uy * 5 * k, m.y - ux * 5 * k + 11 * k);
        }
        ctx.stroke();
        // Chalk bag on the belt, rim dusted white.
        const bag = { x: hip.x - ux * 4 * k, y: hip.y - uy * 4 * k };
        ctx.fillStyle = C.bag;
        ctx.beginPath();
        ctx.roundRect(bag.x - 5 * k, bag.y - 2 * k, 10 * k, 11 * k, 3 * k);
        ctx.fill();
        ctx.fillStyle = C.chalk;
        ctx.fillRect(bag.x - 5 * k, bag.y - 2.5 * k, 10 * k, 2.2 * k);
    }

    // Neck and head: from behind it is mostly hair, which does what it wants.
    const neck = { x: chest.x + ux * 7 * k, y: chest.y + uy * 7 * k };
    const head = { x: chest.x + ux * (BODY.neck + BODY.head + 1) * k, y: chest.y + uy * (BODY.neck + BODY.head + 1) * k };
    seg(ctx, P(fr.chest), neck, 4.4 * k, 4.2 * k, col(C.skin));
    blob(ctx, { x: head.x - 10.6 * k, y: head.y + 1 * k }, 2.6 * k, col(C.skinDark));
    blob(ctx, { x: head.x + 10.6 * k, y: head.y + 1 * k }, 2.6 * k, col(C.skinDark));
    blob(ctx, head, BODY.head * k, col(C.skin));
    ctx.fillStyle = col(C.hair);
    ctx.beginPath();
    for (let a = 0; a <= 24; a++) {
        const th = Math.PI * 0.92 + (a / 24) * Math.PI * 1.16;
        const tuft = a % 2 ? 1.18 : 1.02 + 0.05 * Math.sin(a * 2.3);
        ctx.lineTo(head.x + Math.cos(th) * BODY.head * tuft * k, head.y + Math.sin(th) * BODY.head * tuft * k);
    }
    ctx.quadraticCurveTo(head.x, head.y + 4 * k, head.x - Math.cos(0.08) * BODY.head * k, head.y + 1 * k);
    ctx.fill();

}
