// One token -> one span. Confidence is the probability the model gave the word it chose;
// the "gloss" is the runner-up it almost wrote instead, printed above the line in red.

// Five ink levels, from sure (4) to a coin toss (0).
export const conf = (p) => (p == null || p >= 0.9 ? 4 : p >= 0.6 ? 3 : p >= 0.35 ? 2 : p >= 0.15 ? 1 : 0);

// Hesitation in 0..1: 0 when the model was certain, 1 at p = 2% or below.
export const hesitation = (p) => (p == null ? 0 : Math.min(1, Math.max(0, -Math.log(Math.max(p, 1e-6)) / Math.log(50))));

// How a token reads on its own, in the reel or a gloss. '' is the end-of-answer token.
export function show(t) {
    if (t === '') return '∎ stop';
    if (/^\s*\n/.test(t)) return '¶';
    return t.trim() || '␣';
}

export const pct = (p) => (p == null ? '?' : p >= 0.995 ? '>99%' : p < 0.005 ? '<1%' : `${Math.round(p * 100)}%`);

export function runnerUp(tok) {
    return (tok.alts || []).find((a) => a.t !== tok.t) || null;
}

export function isFavourite(tok) {
    return !tok.alts || !tok.alts.length || tok.alts[0].t === tok.t;
}

// The runner-up, written small above the line. A real element (not ::before) so layout can
// measure it and drop the weaker of two glosses that would collide.
function gloss(el, text, cls, weight) {
    const g = Object.assign(document.createElement('span'), { className: cls, textContent: text });
    g.setAttribute('aria-hidden', 'true');
    g.dataset.w = weight;
    el.append(g);
}

// Hide glosses that would overprint a neighbour on the same line; the likelier one stays.
export function declutter(ms) {
    let prev = null;
    for (const g of ms.querySelectorAll('.gl')) {
        g.classList.remove('gl-off');
        const r = g.getBoundingClientRect();
        const box = { g, top: Math.round(r.top), left: r.left, right: r.right };
        if (prev && Math.abs(prev.top - box.top) < 4 && box.left < prev.right + 6) {
            const loser = +g.dataset.w > +prev.g.dataset.w ? prev : box;
            loser.g.classList.add('gl-off');
            if (loser === prev) prev = box;
            continue;
        }
        prev = box;
    }
}

function spaces(frag, ws) {
    if (!ws) return;
    const breaks = (ws.match(/\n/g) || []).length;
    if (breaks) frag.append(Object.assign(document.createElement('span'), { className: 'pbreak' }));
    else frag.append(' ');
}

// Returns a fragment: leading space, the token span, trailing space.
export function tokenNode(tok, i, { initial = false, fresh = false } = {}) {
    const frag = document.createDocumentFragment();
    const [, lead, core, trail] = tok.t.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const el = document.createElement('span');
    el.className = `tok c${conf(tok.p)}`;
    el.dataset.i = i;
    if (!core) {
        // A token that is only whitespace: a space stays a (pointable) space, a newline is a pilcrow.
        const newline = /\n/.test(tok.t);
        el.classList.add('tok-ws');
        el.textContent = newline ? '¶' : ' ';
        frag.append(el);
        if (newline) spaces(frag, '\n');
    } else {
        spaces(frag, lead);
        el.textContent = core;
        if (initial) el.classList.add('first');
        frag.append(el);
        spaces(frag, trail);
    }
    const r = runnerUp(tok);
    if (tok.forked) {
        el.classList.add('forked');
        gloss(el, show(tok.was), 'gl gl-was', 2);
    } else if (r && tok.p != null && tok.p < 0.5 && r.p >= 0.08) {
        gloss(el, show(r.t), r.p >= 0.25 ? 'gl gl-hi' : 'gl', r.p);
    }
    if (!isFavourite(tok)) el.classList.add('odds');
    if (tok.branch) el.dataset.branch = tok.branch;
    if (fresh) el.classList.add('fresh');
    return frag;
}

export function stats(passages) {
    let words = 0, contested = 0, odds = 0;
    for (const toks of passages) {
        for (const t of toks) {
            if (!t.t.trim()) continue;
            words += 1;
            if (t.p != null && t.p < 0.5) contested += 1;
            if (!isFavourite(t)) odds += 1;
        }
    }
    return { words, contested, odds };
}
