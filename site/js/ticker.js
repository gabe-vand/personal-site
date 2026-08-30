// The ticker strip under the hero. Duplicates its items once so the CSS animation can loop
// seamlessly, and fills the live slots (uptime, temperature, watts, tokens) from telemetry.
import { onTelemetry } from './telemetry.js?v=0a57082b';
import { fmtUptime, fmtInt, fmtNum } from './format.js?v=0a57082b';

export function initTicker(reduced) {
    const track = document.getElementById('ticker-track');
    if (!track) return;
    if (!reduced) {
        const copy = [...track.children].map((li) => li.cloneNode(true));
        track.append(...copy);
    }
    const set = (key, value) => {
        if (value == null || value === '—') return;
        track.querySelectorAll(`[data-tick="${key}"]`).forEach((el) => {
            el.textContent = value;
        });
    };
    onTelemetry((d) => {
        set('uptime', fmtUptime(d.uptime_s));
        set('gpu', fmtNum(d.temps && d.temps.gpu, 0));
        set('watts', fmtNum(d.power_w && d.power_w.total));
        set('tokens', d.llm ? fmtInt(d.llm.tokens_generated) : null);
    });
}
