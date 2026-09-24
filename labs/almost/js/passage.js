// One folio's manuscript: its versions (the baked original and any forks), the replay at the
// speed it was first written, and the fork itself — cut at a word, swap in the alternative,
// and let the machine on the desk carry on from there, live.
import { tokenNode, declutter } from './tokens.js';
import { draw } from './seismo.js';
import { drawTree, siglum } from './tree.js';
import * as stream from './stream.js';
import * as meter from './meter.js';
import { wire } from './interact.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MAX_PREFIX = 1200;

export class Passage {
    constructor(section, data) {
        this.section = section;
        this.no = section.dataset.no;
        this.q = data.q;
        this.baked = data;
        this.versions = [{ id: 0, parent: null, at: null, tokens: data.tokens || [], status: data.live ? 'writing' : 'done', tps: data.tps }];
        this.current = this.versions[0];
        this.build();
        wire(this);
    }

    get tokens() { return this.current.tokens; }

    build() {
        const head = document.createElement('header');
        head.className = 'folio-head';
        head.innerHTML = `<span class="folio-no">${this.no}</span><h2 class="folio-q"><span class="q-mark">Q.</span> <span></span></h2><p class="folio-meta mono"></p>`;
        head.querySelector('h2 span:last-child').textContent = this.q;
        this.meta = head.querySelector('.folio-meta');
        const wrap = document.createElement('div');
        wrap.className = 'ms-wrap';
        wrap.innerHTML = '<svg class="seismo" aria-hidden="true"></svg><div class="ms" tabindex="0" role="group"></div><div class="variants"></div>';
        [this.svg, this.ms, this.vars] = wrap.children;
        this.ms.setAttribute('aria-label', `The machine's answer to: ${this.q}. Arrow keys move between words; Enter shows the alternatives.`);
        this.section.prepend(head, wrap);
        drawTree(this.vars, this);
        this.setMeta();
    }

    setMeta(extra = '') {
        const v = this.current;
        const words = v.tokens.length;
        const who = v.parent == null ? (this.baked.live ? 'written live' : `written ${this.baked.baked || ''}`) : `variant ${siglum(v.id)}, written live`;
        const tps = v.tps ? ` · ${v.tps} words/s` : '';
        this.meta.textContent = `${words} words${tps} · ${who}${extra}`;
    }

    redraw() {
        cancelAnimationFrame(this.raf);
        this.raf = requestAnimationFrame(() => {
            declutter(this.ms);
            draw(this.svg, this.ms, this.tokens);
        });
    }

    render(from = 0, fresh = false) {
        if (from === 0) this.ms.replaceChildren();
        const toks = this.tokens;
        for (let i = from; i < toks.length; i++) this.ms.append(tokenNode(toks[i], i, { initial: i === 0, fresh }));
        this.shown = toks.length;
        this.redraw();
    }

    // Replay the baked text at the real speed it was generated; click the folio to skip.
    replay() {
        if (this.replayed) return;
        this.replayed = true;
        const toks = this.tokens;
        if (reduced || !toks.length) {
            this.render();
            return this.endReplay();
        }
        const perTok = 1000 / (this.baked.tps || 10);
        const t0 = performance.now();
        this.shown = 0;
        this.ms.replaceChildren();
        this.section.classList.add('is-replaying');
        this.setMeta(' · replaying at the speed it was written');
        const step = (now) => {
            if (this.current.id !== 0 || this.shown >= toks.length) return this.endReplay();
            const target = Math.min(toks.length, Math.floor((now - t0) / perTok) + 1);
            for (let i = this.shown; i < target; i++) this.ms.append(tokenNode(toks[i], i, { initial: i === 0, fresh: true }));
            if (target !== this.shown) { this.shown = target; this.redraw(); }
            this.replayRaf = requestAnimationFrame(step);
        };
        this.replayRaf = requestAnimationFrame(step);
    }

    finishReplay() {
        if (!this.section.classList.contains('is-replaying')) return;
        cancelAnimationFrame(this.replayRaf);
        this.render(this.shown);
        this.endReplay();
    }

    endReplay() {
        this.section.classList.remove('is-replaying');
        this.setMeta();
        this.redraw();
        this.section.dispatchEvent(new CustomEvent('passage:ready', { bubbles: true, detail: this }));
    }

    prefixOf(i, alt) {
        return this.tokens.slice(0, i).map((t) => t.t).join('') + alt.t;
    }

    canFork(i) { return !this.whyNot(i); }

    whyNot(i) {
        if (this.current.status === 'writing') return 'still writing this one — wait for the full stop';
        if (stream.isBusy()) return 'the machine is mid-sentence elsewhere — one slot, one pen';
        if (this.tokens.slice(0, i).map((t) => t.t).join('').length > MAX_PREFIX - 40) return 'too deep into the passage to fork from here';
        return '';
    }

    fork(i, alt) {
        this.finishReplay();
        const base = this.current;
        const was = base.tokens[i];
        const v = { id: this.versions.length, parent: base.id, at: i, status: 'writing', tps: null };
        v.tokens = [...base.tokens.slice(0, i), { ...alt, alts: was.alts, forked: true, was: was.t, branch: v.id % 5 }];
        this.versions.push(v);
        const doomed = [...this.ms.querySelectorAll('.tok')].filter((s) => +s.dataset.i >= i);
        doomed.forEach((s, k) => {
            s.style.setProperty('--d', `${Math.min(k * 12, 500) + Math.random() * 120}ms`);
            s.classList.add('dissolve');
        });
        this.current = v;
        drawTree(this.vars, this);
        setTimeout(() => {
            if (this.current === v) this.render();
            if (alt.t === '') return this.settle(v, 'stopped where you told it to');
            this.write(v, this.prefixOf(i, alt));
        }, reduced ? 0 : 520 + Math.min(doomed.length * 12, 500));
    }

    // Stream a continuation into version v. Also used for a visitor's own question (prefix '').
    write(v, prefix) {
        this.section.classList.add('is-writing');
        meter.begin(`folio ${this.no}${v.id ? `, variant ${siglum(v.id)}` : ''}`);
        this.setMeta(' · waiting for the slot');
        stream.ask({
            question: this.q,
            prefix,
            onStatus: (s) => {
                meter.state(s.state === 'queued' ? `queued, ${s.ahead} ahead` : 'reading the prompt');
            },
            onToken: (tok) => {
                tok.branch = v.id % 5;
                v.tokens.push(tok);
                meter.token();
                if (this.current === v) {
                    this.ms.append(tokenNode(tok, v.tokens.length - 1, { initial: v.tokens.length === 1, fresh: true }));
                    this.shown = v.tokens.length;
                    this.redraw();
                    this.setMeta(' · writing');
                }
            },
            onDone: (d) => { v.tps = d.tps || null; this.settle(v); meter.end(`wrote ${siglum(v.id)} at ${d.tps || '~10'} words/s`); },
            onError: (msg, code, aborted) => {
                this.settle(v, msg, aborted ? 'stopped' : 'error');
                meter.end(aborted ? 'stopped' : 'broke off');
            },
        });
    }

    settle(v, note = '', status = 'done') {
        v.status = status;
        v.note = note;
        this.section.classList.remove('is-writing');
        if (this.current === v) {
            this.setMeta(note ? ` · ${note}` : '');
            this.redraw();
        }
        drawTree(this.vars, this);
    }

    switchTo(id) {
        this.finishReplay();
        this.current = this.versions[id];
        this.render();
        this.setMeta(this.current.note ? ` · ${this.current.note}` : '');
        drawTree(this.vars, this);
    }
}
