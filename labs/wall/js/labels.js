// Strips of tape stuck to the wall next to the named moves and volumes ("heel", "dyno", "Savor").
// They live in their own layer that the camera moves exactly like the cards.
export function buildLabels(layer, route, s) {
    layer.replaceChildren();
    route.labels.forEach((l, i) => {
        const span = document.createElement('span');
        span.className = `tape-label${l.plain ? ' is-plain' : ''}`;
        span.textContent = l.text;
        span.style.left = `${l.x * s}px`;
        span.style.bottom = `${l.y * s}px`;
        span.style.setProperty('--r', `${(i % 2 ? 3 : -4) + (i % 3)}deg`);
        layer.append(span);
    });
}
