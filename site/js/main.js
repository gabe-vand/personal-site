// Entry point. Every feature is its own module and guards its own DOM, so deleting a
// section from src/page/ never breaks the rest of the page.
import { initTelemetry } from './telemetry.js?v=dfc225fb';
import { initContour } from './contour.js?v=dfc225fb';
import { initTopo } from './topo.js?v=dfc225fb';
import { initTicker } from './ticker.js?v=dfc225fb';
import { initChat } from './chat.js?v=dfc225fb';
import { initChalk } from './chalk.js?v=dfc225fb';
import { initReveal, initKonami } from './reveal.js?v=dfc225fb';
import { initContact } from './contact.js?v=dfc225fb';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('has-js');
document.querySelectorAll('#year').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
});

initTelemetry();
initContour(reduced);
initTopo();
initTicker(reduced);
initChat();
initChalk(reduced);
initReveal(reduced);
initKonami();
initContact();
