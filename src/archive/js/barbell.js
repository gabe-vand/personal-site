// "Load the bar." Plates are drawn into the SVG here; the bar itself is static markup.
// Sizes are roughly to scale: the big four share a diameter, the change plates shrink.
const BAR_KG = 20;
const SPEC = { 25: { h: 232, w: 34 }, 20: { h: 232, w: 30 }, 15: { h: 232, w: 26 }, 10: { h: 232, w: 22 }, 5: { h: 156, w: 18 }, 2.5: { h: 112, w: 14 }, 1.25: { h: 88, w: 10 } };
const ORDER = [25, 20, 15, 10, 5, 2.5, 1.25];
const SLEEVE = 236; // usable pixels per side before the plates fall off the end
const INNER_LEFT = 252;
const INNER_RIGHT = 748;
const CENTER_Y = 130;
const SVG_NS = 'http://www.w3.org/2000/svg';

const widthOf = (list) => list.reduce((sum, kg) => sum + SPEC[kg].w + 2, 0);

export function initBarbell(reduced) {
    const svg = document.getElementById('barbell');
    if (!svg) return;
    const left = document.getElementById('plates-left');
    const right = document.getElementById('plates-right');
    const kgEl = document.getElementById('bar-kg');
    const lbEl = document.getElementById('bar-lb');
    let plates = []; // per side, inner to outer

    function plate(kg, x, index, fresh) {
        const { h, w } = SPEC[kg];
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', CENTER_Y - h / 2);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('rx', 3);
        rect.setAttribute('class', `pl pl-${String(kg).replace('.', '-')}${fresh >= 0 && !reduced ? ' is-new' : ''}`);
        rect.dataset.index = index;
        if (fresh >= 0 && !reduced) rect.style.animationDelay = `${fresh * 70}ms`;
        const title = document.createElementNS(SVG_NS, 'title');
        title.textContent = `${kg} kg — click to take it off`;
        rect.append(title);
        return rect;
    }

    function render(fresh = []) {
        left.replaceChildren();
        right.replaceChildren();
        let offset = 0;
        plates.forEach((kg, i) => {
            const order = fresh.indexOf(i);
            left.append(plate(kg, INNER_LEFT - offset - SPEC[kg].w, i, order));
            right.append(plate(kg, INNER_RIGHT + offset, i, order));
            offset += SPEC[kg].w + 2;
        });
        const total = BAR_KG + 2 * plates.reduce((sum, kg) => sum + kg, 0);
        kgEl.textContent = String(Math.round(total * 100) / 100);
        lbEl.textContent = `${Math.round(total * 2.20462)} lb`;
    }

    function add(kg) {
        if (widthOf(plates) + SPEC[kg].w + 2 > SLEEVE) {
            svg.classList.remove('is-full');
            void svg.getBoundingClientRect();
            svg.classList.add('is-full');
            return;
        }
        plates.push(kg);
        render([plates.length - 1]);
    }

    function load(total) {
        let perSide = Math.max(0, (total - BAR_KG) / 2);
        const next = [];
        for (const kg of ORDER) {
            while (perSide >= kg - 1e-9 && widthOf(next) + SPEC[kg].w + 2 <= SLEEVE) {
                next.push(kg);
                perSide -= kg;
            }
        }
        plates = next;
        render(next.map((_, i) => i));
    }

    const rack = document.getElementById('plate-buttons');
    if (rack) {
        rack.addEventListener('click', (e) => {
            const button = e.target.closest('.plate');
            if (button) add(Number(button.dataset.kg));
        });
    }
    const presets = document.getElementById('presets');
    if (presets) {
        presets.addEventListener('click', (e) => {
            const button = e.target.closest('.preset');
            if (button) load(Number(button.dataset.kg));
        });
    }
    svg.addEventListener('click', (e) => {
        const rect = e.target.closest('.pl');
        if (!rect) return;
        plates.splice(Number(rect.dataset.index), 1);
        render();
    });
    svg.addEventListener('animationend', (e) => {
        if (e.target === svg) svg.classList.remove('is-full');
    });
    load(100); // what the bar shows before anyone touches it. EDIT to taste.
}
