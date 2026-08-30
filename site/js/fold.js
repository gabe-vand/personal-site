// The Send button folds itself into a paper plane. The button's two halves are clip-path
// polygons whose corners are CSS custom properties (see src/css/85-send-btn.css); this module
// tweens those numbers frame by frame. Fold choreography adapted from Aaron Iker's paper-plane
// button (github.com/withaarzoo/Animated-Paper-Plane-Button), rebuilt without GSAP so it runs
// under our CSP. Numbers are percentages of the button box unless noted.
const REST = {
    'left-wing-first-x': 0, 'left-wing-first-y': 0, 'left-wing-second-x': 50, 'left-wing-second-y': 0, 'left-wing-third-x': 0, 'left-wing-third-y': 100,
    'left-body-first-x': 51, 'left-body-first-y': 0, 'left-body-second-x': 51, 'left-body-second-y': 100, 'left-body-third-x': 0, 'left-body-third-y': 100,
    'right-wing-first-x': 49, 'right-wing-first-y': 0, 'right-wing-second-x': 100, 'right-wing-second-y': 0, 'right-wing-third-x': 100, 'right-wing-third-y': 100,
    'right-body-first-x': 49, 'right-body-first-y': 0, 'right-body-second-x': 49, 'right-body-second-y': 100, 'right-body-third-x': 100, 'right-body-third-y': 100,
    'rotate': 0, 'plane-x': 0, 'plane-y': 0, 'text-opacity': 1, 'radius': 999, 'shade': 0,
};

// Each step: {to: {...}, set: {...}, ms}. `set` jumps instantly at the start of the step.
const STEPS = [
    { ms: 110, set: { shade: 1 }, to: { 'text-opacity': 0, radius: 0 } },
    { ms: 200, to: { 'left-wing-first-x': 50, 'left-wing-first-y': 100, 'right-wing-second-x': 50, 'right-wing-second-y': 100 } },
    {
        ms: 200,
        set: {
            'left-wing-first-y': 0, 'left-wing-second-x': 40, 'left-wing-second-y': 100, 'left-wing-third-x': 0, 'left-wing-third-y': 100, 'left-body-third-x': 40,
            'right-wing-first-x': 50, 'right-wing-first-y': 0, 'right-wing-second-x': 60, 'right-wing-second-y': 100, 'right-wing-third-x': 100, 'right-wing-third-y': 100, 'right-body-third-x': 60, shade: 2,
        },
        to: { 'left-wing-third-x': 20, 'left-wing-third-y': 90, 'left-wing-second-y': 90, 'left-body-third-y': 90, 'right-wing-third-x': 80, 'right-wing-third-y': 90, 'right-body-third-y': 90, 'right-wing-second-y': 90 },
    },
    { ms: 250, set: { shade: 3 }, to: { rotate: 50, 'left-wing-third-y': 95, 'left-wing-third-x': 27, 'right-body-third-x': 45, 'right-wing-second-x': 45, 'right-wing-third-x': 60, 'right-wing-third-y': 83 } },
    { ms: 220, to: { rotate: 58, 'plane-x': -6, 'plane-y': 10 } },
    { ms: 160, to: { rotate: 45, 'plane-x': 0, 'plane-y': 0 } }, // settles, at rest: the flight does the throw
];

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function apply(button, state) {
    for (const [key, value] of Object.entries(state)) button.style.setProperty(`--${key}`, String(value));
}

/** Fold the button into a plane. Resolves when the plane has just hopped off the button. */
export function foldButton(button) {
    const state = { ...REST };
    button.classList.add('is-folding');
    apply(button, state);
    return new Promise((resolve) => {
        let i = 0;
        let from = null;
        let t0 = null;
        function frame(now) {
            const step = STEPS[i];
            if (t0 === null) {
                t0 = now;
                if (step.set) Object.assign(state, step.set);
                from = { ...state };
            }
            const u = Math.min(1, (now - t0) / step.ms);
            const k = ease(u);
            for (const [key, target] of Object.entries(step.to)) state[key] = from[key] + (target - from[key]) * k;
            apply(button, state);
            if (u < 1) return requestAnimationFrame(frame);
            i += 1;
            t0 = null;
            if (i < STEPS.length) return requestAnimationFrame(frame);
            resolve();
        }
        requestAnimationFrame(frame);
    });
}

/** Put the button back (it fades in via CSS). */
export function unfoldButton(button) {
    for (const key of Object.keys(REST)) button.style.removeProperty(`--${key}`);
    button.classList.remove('is-folding', 'is-away');
}
