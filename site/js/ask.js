// A visitor's own question becomes a new folio, written live with alternatives like the rest.
import { Passage } from './passage.js?v=74fb8903';
import { isBusy } from './stream.js?v=74fb8903';

const ROMAN = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
const roman = (n) => ROMAN.reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');

export function initAsk(passages, ro) {
    const form = document.getElementById('ask');
    const write = document.getElementById('write');
    if (!form || !write) return;
    const input = form.querySelector('input');
    let n = 9;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = input.value.trim();
        if (!q) return;
        if (isBusy()) {
            input.setCustomValidity('The model is busy with another answer. Try again when it finishes.');
            input.reportValidity();
            setTimeout(() => input.setCustomValidity(''), 2500);
            return;
        }
        const section = document.createElement('section');
        section.className = 'folio folio-asked';
        section.dataset.no = roman(n++);
        section.innerHTML = '<aside class="record"><p class="rec-label mono">Your question</p><p class="rec-note">Generated live and not reviewed. If it conflicts with the details above, trust the details.</p></aside>';
        write.before(section);
        write.querySelector('.folio-no').textContent = roman(n);
        const p = new Passage(section, { q, tokens: [], live: true });
        p.replayed = true;
        passages.push(p);
        ro.observe(p.ms);
        input.value = '';
        section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        p.write(p.versions[0], null);
    });
}
