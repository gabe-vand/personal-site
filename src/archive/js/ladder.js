// Grade ladder: hover, focus, or tap a rung to read its note (the data-note attribute).
export function initLadder() {
    const ladder = document.getElementById('ladder');
    const note = document.getElementById('ladder-note');
    if (!ladder || !note) return;
    const idle = note.textContent;
    let open = null;
    const show = (rung) => {
        note.textContent = `${rung.dataset.grade}: ${rung.dataset.note}`;
    };
    const rest = () => {
        if (open) show(open);
        else note.textContent = idle;
    };
    ladder.addEventListener('pointerover', (e) => {
        const rung = e.target.closest('.rung');
        if (rung) show(rung);
    });
    ladder.addEventListener('pointerleave', rest);
    ladder.addEventListener('focusin', (e) => {
        const rung = e.target.closest('.rung');
        if (rung) show(rung);
    });
    ladder.addEventListener('click', (e) => {
        const rung = e.target.closest('.rung');
        if (!rung) return;
        if (open) open.classList.remove('is-open');
        open = open === rung ? null : rung;
        if (open) open.classList.add('is-open');
        rest();
    });
}
