// Scroll <-> beta. Each move gets scroll length in proportion to how far it lifts the climber, so
// the wall (and every card on it) moves at the speed you scroll. Signature moves get extra room.
import { clamp, lerp } from './rng.js';

export function buildMap(route, layout) {
    const n = route.moves.length;
    const camH = [];
    let top = -Infinity;
    for (const st of route.states) camH.push((top = Math.max(top, st.hipS.y)));
    const len = [];
    const cum = [0];
    for (let i = 0; i < n; i++) {
        const mv = route.moves[i];
        const rise = Math.max(camH[i + 1] - camH[i], 9);
        len.push(rise * layout.s * (mv.big ? 1.8 : 1) + (mv.kind === 'dyno' ? 260 : 0));
        cum.push(cum[i] + len[i]);
    }
    const total = cum[n];

    function scrollToP(sc) {
        sc = clamp(sc, 0, total);
        let lo = 0;
        let hi = n - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (cum[mid] <= sc) lo = mid;
            else hi = mid - 1;
        }
        return lo + clamp((sc - cum[lo]) / len[lo], 0, 1);
    }
    const pToScroll = (p) => {
        const i = clamp(Math.floor(p), 0, n - 1);
        return cum[i] + clamp(p - i, 0, 1) * len[i];
    };
    // Camera: the bottom of the screen in world cm, keeping the pelvis at `anchor` of the height.
    function camAt(p) {
        const i = clamp(Math.floor(p), 0, n - 1);
        const f = clamp(p - i, 0, 1);
        return lerp(camH[i], camH[i + 1], f) - layout.anchor * layout.V;
    }
    // The move where the pelvis first reaches world height y.
    function pForHip(y) {
        const i = camH.findIndex((h) => h >= y);
        return i < 0 ? n : Math.max(0, i - 1) + 0.999;
    }
    return { n, total, scrollToP, pToScroll, camAt, pForHip };
}
