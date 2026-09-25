// The Wall. Scroll position picks a point on the beta; the climber is posed there, the camera
// follows his hips, and every card on the wall moves with the camera.
import { clamp, lerp } from './rng.js';
import { computeLayout } from './layout.js';
import { buildRoute } from './route.js';
import { buildScene, drawWall, DARK } from './wall.js';
import { buildMap } from './map.js';
import { poseAt, fallPose, mixPose, LATCH } from './pose.js';
import { drawClimber } from './climber.js';
import { puff, flash, stepFx, drawFx, clearFx } from './fx.js';
import { buildTopo, paintTopo } from './topo.js';
import { buildLabels } from './labels.js';
import { initMachine } from './machine.js';
import { initRegister } from './register.js';
import { callout, hud } from './hud.js';

const root = document.documentElement;
const $ = (id) => document.getElementById(id);
const world = $('world');
const labelLayer = $('labels');
const wallC = $('wall');
const climbC = $('climber');
const wctx = wallC.getContext('2d');
const cctx = climbC.getContext('2d');
const shadowC = document.createElement('canvas');
const sctx = shadowC.getContext('2d');
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
let L; let route; let scene; let map; let dpr = 1;
let pd = 0; let lastT = 0; let lastCam = NaN; let fall = null; let pose = null;
let celebrate = 0; let sent = false;

function build() {
    const keep = map ? pd / map.n : 0;
    root.classList.add('wall-on');
    L = computeLayout(world);
    root.classList.toggle('is-mobile', L.mobile);
    route = buildRoute(L);
    scene = buildScene(L, route);
    map = buildMap(route, L);
    $('spacer').style.height = `${map.total + innerHeight}px`;
    $('hud-moves').textContent = String(map.n);
    buildLabels(labelLayer, route, L.s);
    buildTopo(L, (b) => jump(b.type === 'start' ? 0 : b.type === 'top' ? map.n : map.pForHip(b.focus)));
    dpr = Math.min(2, devicePixelRatio || 1);
    for (const c of [wallC, climbC]) { c.width = Math.round(innerWidth * dpr); c.height = Math.round(innerHeight * dpr); }
    shadowC.width = Math.ceil(innerWidth / 6);
    shadowC.height = Math.ceil(innerHeight / 6);
    pd = keep * map.n;
    if (keep) scrollTo(0, map.pToScroll(pd));
    lastCam = NaN;
    clearFx();
}

function jump(p) {
    const far = p < pd - 12 && p < 3;
    scrollTo({ top: map.pToScroll(p), behavior: calm || far ? 'auto' : 'smooth' });
}

function view(camY) {
    const s = L.s;
    return { s, camY, V: L.V, dpr, X: (x) => x * s, Y: (y) => innerHeight - (y - camY) * s };
}

function latches(from, to, target) {
    if (to <= from || calm || Math.abs(target - to) > 4) return;   // no fireworks while speed-climbing
    for (let i = Math.floor(from); i <= Math.floor(to) && i < map.n; i++) {
        const mv = route.moves[i];
        const at = i + LATCH[mv.kind];
        if (at <= from || at > to) continue;
        const B = route.states[i + 1];
        for (const limb of mv.limbs) {
            const h = B[limb];
            if (!h || h.free || h.floor) continue;
            const hand = limb[1] === 'h';
            puff(h.x, h.y + (hand ? 4 : 0), hand ? (mv.kind === 'dyno' ? 40 : 12) : 5, mv.kind === 'dyno' ? 1.8 : hand ? 1 : 0.5);
            if (hand) flash(h.x, h.y, mv.kind === 'dyno' ? 44 : 22);
        }
    }
}

function frame(now) {
    requestAnimationFrame(frame);
    const t = now / 1000;
    const dt = Math.min(0.05, t - (lastT || t));
    lastT = t;
    const target = map.scrollToP(scrollY);
    const prev = pd;
    if (calm) pd = target;
    else if (!fall && target < 2 && pd - target > 14) {
        fall = { t0: t, from: pose, cam0: map.camAt(pd) };
        pd = target;
    } else {
        const step = (target - pd) * Math.min(1, dt * 9);
        pd += clamp(step, -90 * dt, 90 * dt);
    }
    latches(prev, pd, target);
    celebrate = clamp(celebrate + (sent && pd > map.n - 0.05 ? dt : -dt) * 2, 0, 1);
    const live = poseAt(route, calm ? Math.round(pd) : pd, calm ? 0 : t, celebrate);
    let camY = map.camAt(calm ? target : pd);
    if (fall) {
        const fp = fallPose(fall.from, t - fall.t0, route.states[0].hipS.x);
        pose = fp.done ? mixPose(fp, live, clamp((t - fall.t0 - fp.dur - 1.05) / 0.45, 0, 1)) : fp;
        if (fp.done && t - fall.t0 - fp.dur > 1.5) fall = null;
        if (fp.falling) camY = Math.min(fall.cam0, Math.max(camY, pose.hip.y - L.anchor * L.V));
        if (fp.landed && !fall?.puffed && fall) { fall.puffed = true; puff(pose.hip.x, 4, 60, 2.2); }
    } else pose = live;

    const v = view(camY);
    if (!(Math.abs(camY - lastCam) <= 0.02)) {
        wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawWall(wctx, v, L, route, scene);
        lastCam = camY;
        const shift = `translate3d(0, ${(camY * L.s).toFixed(2)}px, 0)`;
        world.style.transform = shift;
        labelLayer.style.transform = shift;
    }
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cctx.clearRect(0, 0, innerWidth, innerHeight);
    // Soft shadow on the wall: the silhouette drawn at 1/6 size and scaled back up (a canvas blur
    // filter costs ~130 ms a frame without a GPU; this costs nothing).
    sctx.setTransform(1 / 6, 0, 0, 1 / 6, 0, 0);
    sctx.clearRect(0, 0, innerWidth, innerHeight);
    drawClimber(sctx, pose, v, '#191423');
    cctx.globalAlpha = 0.26;
    cctx.drawImage(shadowC, 9 * L.s, 7 * L.s, shadowC.width * 6, shadowC.height * 6);
    cctx.globalAlpha = 1;
    drawClimber(cctx, pose, v);
    stepFx(dt);
    drawFx(cctx, v);

    const band = L.bands.find((b) => pose.hip.y < b.y1) || L.bands[L.bands.length - 1];
    root.classList.toggle('is-dark', DARK.has(band.type));
    paintTopo(pose.hip.y, band.id);
    hud(pose, pd, map.n);
    callout(fall ? (pose.falling ? 'Off!' : 'Dust off. Go again.') : sent && celebrate > 0.5 ? 'SENT.' : null, pose, pd, target, v, route);
    $('cue').classList.toggle('is-gone', scrollY > 30);
}

function boot() {
    build();
    initMachine();
    initRegister(() => {
        sent = true;
        if (!calm) for (const s of [-1, 1]) puff(pose.hip.x + s * 45, pose.hip.y + 150, 40, 1.8);
    });
    let rt = 0;
    let w = innerWidth;
    addEventListener('resize', () => {
        clearTimeout(rt);
        rt = setTimeout(() => { if (innerWidth !== w || !L.mobile) { w = innerWidth; build(); } }, 180);
    });
    // Keyboard: a focused card scrolls the wall so the card is in view.
    world.addEventListener('focusin', (e) => {
        const item = e.target.closest('[data-item]');
        if (!item) return;
        const cy = Number(item.dataset.y);
        const p = map.pForHip(cy - (0.5 - L.anchor) * L.V);
        scrollTo({ top: map.pToScroll(p), behavior: 'auto' });
    });
    document.querySelector('.skip').addEventListener('click', (e) => { e.preventDefault(); jump(map.n); $('r-body').focus({ preventScroll: true }); });
    pose = poseAt(route, 0, 0);
    requestAnimationFrame(frame);
    window.__wall = { map: () => map, route: () => route, L: () => L, pose: () => pose, pd: () => pd };
    void lerp;
}

document.fonts.ready.then(boot);
