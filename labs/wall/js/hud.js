// The altimeter in the corner and the beta callout by the climber's head: what a friend on the
// mats shouts while you move ("right hand · crimp", "heel hook", "DYNO").
const $ = (id) => document.getElementById(id);
const beta = $('beta');
let shown = '';
let hold = 0;

export function hud(pose, pd, n) {
    $('hud-height').textContent = (Math.max(0, pose.hip.y - 85) / 100).toFixed(1);
    $('hud-move').textContent = String(Math.min(n, Math.round(pd)));
}

export function callout(override, pose, pd, target, view, route) {
    let text = override;
    let big = !!override;
    if (!text) {
        const i = Math.min(Math.floor(pd), route.moves.length - 1);
        const f = pd - i;
        const mv = route.moves[i];
        const moving = Math.abs(target - pd) > 0.004;
        if (mv && (moving || mv.big) && (mv.big || !document.documentElement.classList.contains('is-mobile')) && f > 0.04 && f < 0.985 && Math.abs(target - pd) < 6) {
            text = mv.label;
            big = mv.big;
        } else if (pd >= route.moves.length - 0.02) {
            text = 'Top out.';
            big = true;
        }
    }
    const head = pose.fr.chest;
    const x = view.X(head.x) + 38 * view.s;
    const y = view.Y(head.y) - 30 * view.s;
    if (text && document.documentElement.classList.contains('is-mobile')) {
        const under = document.elementFromPoint(view.X(head.x), view.Y(head.y + 20));
        if (under && under.closest('[data-item]')) text = null;   // he is behind a card: say nothing
    }
    if (text) hold = performance.now();
    else if (performance.now() - hold < 500) text = shown;
    if (text !== shown) {
        shown = text || '';
        if (text) beta.textContent = text;
    }
    beta.classList.toggle('is-on', !!text);
    beta.classList.toggle('is-big', !!text && big);
    beta.style.transform = `translate3d(${Math.round(Math.min(x, innerWidth - 200))}px, ${Math.round(y)}px, 0)`;
}
