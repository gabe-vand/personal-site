// The route setter. Given the section bands (heights come from the cards on them), it sets holds
// up the wall and writes the beta: an ordered list of moves, each taking the climber from one
// state (which hold each hand and foot is on) to the next. Seeded, so the problem never changes.
import { mulberry32 } from './rng.js';
import { desiredHip, settle } from './solver.js';

const TYPES = {
    start: ['jug'], slab: ['crimp', 'sloper', 'crimp', 'pinch'], vertical: ['crimp', 'pinch', 'crimp', 'jug'],
    overhang: ['jug', 'pinch', 'sloper', 'jug'], volumes: ['jug', 'pinch', 'crimp'], board: ['crimp', 'jug', 'pinch', 'sloper'],
    roof: ['jug', 'jug', 'sloper'], top: ['jug', 'crimp'],
};
const SIZE = { jug: [17, 23], crimp: [12, 16], sloper: [19, 27], pinch: [11, 15], foot: [6, 8.5], big: [30, 36] };
const NAME = { lh: 'left hand', rh: 'right hand', lf: 'left foot', rf: 'right foot' };

export function buildRoute(L) {
    const R = mulberry32(20260924);
    const holds = [];
    const moves = [];
    const states = [];
    const volumes = [];
    const labels = [];
    const cx = (y) => L.routeX + 18 * Math.sin(y / 190) + 8 * Math.sin(y / 67);
    let band = L.bands[0];
    let S = null;

    const hold = (x, y, type) => {
        const [a, b] = SIZE[type];
        const h = { id: holds.length, x, y, type, route: true, size: a + R() * (b - a), rot: (R() - 0.5) * 0.9, seed: (R() * 1e9) | 0 };
        holds.push(h);
        return h;
    };
    const push = (kind, limbs, changes, label, extra = {}) => {
        moves.push({ kind, limbs, label, band: band.id, big: !!extra.big });
        S = { ...S, ...changes, bend: { ...S.bend, ...(extra.bend || {}) }, hipOverride: extra.hip || null, twist: extra.twist || 1 };
        states.push(S);
    };
    const lower = (a, b) => (S[a].y <= S[b].y ? a : b);
    const pick = () => TYPES[band.type][(R() * TYPES[band.type].length) | 0];

    function hand(opts = {}) {
        const lo = lower('lh', 'rh');
        const hi = lo === 'lh' ? 'rh' : 'lh';
        const s = lo === 'lh' ? -1 : 1;
        const y = S[hi].y + (opts.dy || 30 + R() * 10);
        const x = cx(y) + s * (opts.dx || 14 + R() * 13);
        for (let k = 0; k < 2 && y - Math.min(S.lf.y, S.rf.y) > 184; k++) foot();  // bring a foot up first
        const t = opts.type || pick();
        push('reach', [lo], { [lo]: hold(x, y, t) }, opts.label || `${NAME[lo]} · ${t}`, opts);
    }
    function foot(opts = {}) {
        const lo = lower('lf', 'rf');
        const s = lo === 'lf' ? -1 : 1;
        const mh = Math.min(S.lh.y, S.rh.y);
        const y = mh - (opts.below || 68 + R() * 10);
        if (y < S[lo].y + 12) return;
        push('step', [lo], { [lo]: hold(cx(y) + s * (12 + R() * 11), y, 'foot') }, `${NAME[lo]} up`, { bend: { [lo]: null } });
    }
    const climbTo = (top) => {
        while (Math.max(S.lh.y, S.rh.y) < top) { hand(); foot(); }
    };
    function match() {
        const lo = lower('lh', 'rh');
        const hi = lo === 'lh' ? 'rh' : 'lh';
        const s = lo === 'lh' ? -1 : 1;
        push('reach', [lo], { [lo]: { x: S[hi].x + s * 7, y: S[hi].y - 1, virtual: true } }, 'match', { big: true });
        labels.push({ x: S[hi].x + 34, y: S[hi].y + 20, text: 'match' });
    }

    for (band of L.bands) {
        const { y0, y1 } = band;
        if (band.type === 'start') {
            const x = cx(170);
            const lh = hold(x - 21, 184, 'jug');
            const rh = hold(x + 22, 190, 'jug');
            lh.start = rh.start = true;
            S = { lh, rh, lf: { x: x - 16, y: 0, floor: true }, rf: { x: x + 15, y: 0, floor: true }, bend: {}, hipOverride: { x, y: 85 }, twist: 1 };
            states.push(S);
            push('step', ['lf', 'rf'], { lf: hold(x - 21, 33, 'foot'), rf: hold(x + 19, 41, 'foot') }, 'pull on', { big: true });
            labels.push({ x: x + 66, y: 190, text: 'start' });
            climbTo(y1 - 40);
        } else if (band.type === 'overhang') {
            climbTo(y0 + (y1 - y0) * 0.22);
            // Heel hook: right heel high on a jug, then a long left-hand move off it.
            const mh = Math.min(S.lh.y, S.rh.y);
            push('step', ['rf'], { rf: hold(cx(mh) + 46, mh - 48, 'jug') }, 'heel hook', { bend: { rf: 'heel' }, big: true });
            labels.push({ x: S.rf.x + 30, y: S.rf.y - 24, text: 'heel' });
            if (lower('lh', 'rh') === 'rh') hand();
            hand({ dy: 40, label: 'pull through the heel' });
            push('step', ['rf'], { rf: hold(cx(S.rf.y) + 16, Math.min(S.lh.y, S.rh.y) - 72, 'foot') }, 'heel off', { bend: { rf: null } });
            climbTo(y0 + (y1 - y0) * 0.5);
            // Drop-knee: left knee turned in so the right hand can go long and wide.
            const dh = Math.min(S.lh.y, S.rh.y);
            push('step', ['lf'], { lf: hold(cx(dh) - 36, dh - 62, 'pinch') }, 'drop knee', { bend: { lf: 'drop' }, twist: 0.72, big: true });
            labels.push({ x: S.lf.x - 34, y: S.lf.y - 22, text: 'drop knee' });
            if (lower('lh', 'rh') === 'lh') hand();
            hand({ dy: 40, dx: 24, label: 'long right hand' });
            push('step', ['lf'], { lf: hold(cx(S.lf.y) - 14, Math.min(S.lh.y, S.rh.y) - 72, 'foot') }, 'knee out', { bend: { lf: null } });
            climbTo(y1 - 150);
            match();
            // The dyno: both hands leave, feet cut, and he catches the big jug at the lip of the cave.
            const topY = Math.max(S.lh.y, S.rh.y) + 104;
            const big = hold(cx(topY) + 8, topY, 'big');
            push('dyno', ['lh', 'rh', 'lf', 'rf'], { lh: { x: big.x - 9, y: big.y + 2, virtual: true }, rh: { x: big.x + 9, y: big.y + 3, virtual: true }, lf: null, rf: null }, 'DYNO', { big: true });
            labels.push({ x: big.x + 48, y: big.y + 20, text: 'dyno' });
            const fy = topY - 120;
            push('step', ['lf', 'rf'], { lf: hold(cx(fy) - 18, fy, 'foot'), rf: hold(cx(fy) + 17, fy + 6, 'foot') }, 'feet back on', { big: true });
            climbTo(y1 - 20);
        } else if (band.type === 'volumes') {
            for (const f of band.features || []) {
                volumes.push({ x: cx(f.y) + 4, y: f.y, w: 130 + R() * 50, h: 95 + R() * 30, seed: (R() * 1e9) | 0 });
                labels.push({ x: cx(f.y) + 4, y: f.y - 58, text: f.name, plain: true });
                climbTo(f.y + 10);
            }
            climbTo(y1 - 30);
        } else if (band.type === 'top') {
            const lip = L.lipY;
            climbTo(lip - 36);
            const x = cx(lip);
            const lipL = { x: x - 24, y: lip, virtual: true };
            const lipR = { x: x + 24, y: lip, virtual: true };
            const lo = lower('lh', 'rh');
            push('reach', [lo], { [lo]: lo === 'lh' ? lipL : lipR }, 'hand on the lip');
            const other = lo === 'lh' ? 'rh' : 'lh';
            push('reach', [other], { [other]: other === 'lh' ? lipL : lipR }, 'both hands on the lip');
            foot({ below: 78 });
            foot({ below: 70 });
            push('step', ['rf'], { rf: hold(x + 22, lip - 42, 'foot') }, 'mantle', { hip: { x, y: lip + 6 }, big: true });
            push('step', ['lf', 'rf', 'lh', 'rh'], {
                lf: { x: x - 15, y: lip + 12, floor: true }, rf: { x: x + 15, y: lip + 12, floor: true },
                lh: { free: true }, rh: { free: true },
            }, 'Top out.', { hip: { x, y: lip + 96 }, big: true });
        } else {
            if (band.type === 'board') {
                climbTo(y0 + (y1 - y0) * 0.5);
                match();
            }
            climbTo(y1 - 30);
        }
    }

    // Settled pelvis for every state (free/floor feet count as contacts; free hands do not).
    for (const st of states) {
        const c = contactsOf(st);
        st.hipS = st.hipOverride || settle(desiredHip(c), c, 60, st.twist);
    }
    return { holds, moves, states, volumes, labels, lipY: L.lipY };
}

export function contactsOf(st) {
    const c = {};
    for (const k of ['lh', 'rh', 'lf', 'rf']) c[k] = st[k] && !st[k].free ? st[k] : null;
    return c;
}
