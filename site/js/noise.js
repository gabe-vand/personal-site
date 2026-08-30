// 2D simplex noise (Stefan Gustavson's algorithm) with a fixed seed. Returns roughly -1..1.
// Used by contour.js to draw the drifting lines behind the hero.
const GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const perm = new Uint8Array(512);

(function seed() {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = 1337;
    for (let i = 255; i > 0; i--) {
        s = (s * 16807) % 2147483647;
        const j = s % (i + 1);
        const tmp = p[i];
        p[i] = p[j];
        p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
})();

function corner(x, y, g) {
    let t = 0.5 - x * x - y * y;
    if (t < 0) return 0;
    t *= t;
    return t * t * (g[0] * x + g[1] * y);
}

export function noise2(x, y) {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    let n = corner(x0, y0, GRAD[perm[ii + perm[jj]] & 7]);
    n += corner(x1, y1, GRAD[perm[ii + i1 + perm[jj + j1]] & 7]);
    n += corner(x2, y2, GRAD[perm[ii + 1 + perm[jj + 1]] & 7]);
    return 70 * n;
}
