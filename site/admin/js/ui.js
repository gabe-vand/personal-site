// Tiny DOM helpers. Everything goes through textContent: nothing a visitor typed can ever
// become markup here.
export function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') node.className = v;
        else if (k === 'style') Object.assign(node.style, v); // CSSOM, not a style attribute: the CSP forbids inline styles
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c != null) node.append(c.nodeType ? c : document.createTextNode(String(c)));
    return node;
}

export const when = (ts) => (ts ? new Date(ts * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const day = (ts) => (ts ? new Date(ts * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—');
export const dur = (s) => (!s ? '—' : s < 60 ? `${Math.round(s)}s` : s < 3600 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${(s / 3600).toFixed(1)}h`);
export const num = (n) => (n == null ? '—' : Number(n).toLocaleString());
export const bytes = (b) => (b < 1e6 ? `${(b / 1e3).toFixed(0)} kB` : b < 1e9 ? `${(b / 1e6).toFixed(1)} MB` : `${(b / 1e9).toFixed(2)} GB`);
export const ago = (ts) => {
    const s = Date.now() / 1000 - ts;
    return s < 90 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`;
};

export function stat(value, label, cls = '') {
    return el('div', { class: `stat ${cls}` }, [el('b', { text: value }), el('span', { text: label })]);
}

export function table(columns, rows, onRow) {
    const head = el('tr', {}, columns.map((c) => el('th', { text: c.label })));
    const body = rows.map((r) => {
        const tr = el('tr', { class: onRow ? 'is-link' : '' }, columns.map((c) => {
            const v = c.render ? c.render(r) : r[c.key];
            return el('td', { class: c.wrap ? 'wrap' : '', title: typeof v === 'string' ? v : '' }, [v]);
        }));
        if (onRow) tr.addEventListener('click', () => onRow(r));
        return tr;
    });
    if (!rows.length) body.push(el('tr', {}, [el('td', { class: 'muted', colspan: String(columns.length), text: 'nothing yet' })]));
    return el('div', { class: 'tbl-wrap' }, [el('table', { class: 'tbl' }, [el('thead', {}, [head]), el('tbody', {}, body)])]);
}

export function bars(pairs, cls = '') {
    const max = Math.max(1, ...pairs.map(([, n]) => n));
    return el('div', { class: 'bars' }, pairs.map(([k, n]) => el('div', { class: `bar ${cls}` }, [
        el('span', { class: 'k', text: k || '?' }), el('i', { style: { width: `${(100 * n) / max}%` } }), el('span', { class: 'n', text: num(n) }),
    ])));
}

export function tag(text, cls = '') {
    return el('span', { class: `tag ${cls}`, text });
}

export function section(title, ...children) {
    return el('section', {}, [el('h3', { text: title }), ...children]);
}

export function kv(pairs) {
    return el('dl', { class: 'kv' }, pairs.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', {}, [v == null ? '—' : v])]));
}
