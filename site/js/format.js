// Small formatting helpers shared by the ticker, the telemetry panel, and the footer.
export function fmtUptime(seconds) {
    if (seconds == null) return '—';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

export function fmtInt(n) {
    return n == null ? '—' : Math.round(n).toLocaleString('en-US');
}

export function fmtNum(n, digits = 1) {
    return n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toFixed(digits);
}
