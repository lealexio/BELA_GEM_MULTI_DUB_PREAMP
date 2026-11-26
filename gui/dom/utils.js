/** DOM helpers, inline SVG icons, and layout utilities. */
export function projectFileUrl(filename) {
    const scripts = document.querySelectorAll('script[src*="/api/read/file/"]');
    for (const s of scripts) {
        const m = s.src.match(/\/api\/read\/file\/([^?]+)/);
        if (m) {
            const projectPath = decodeURIComponent(m[1]);
            const base = projectPath.replace(/\/[^/]+$/, '');
            return '/api/read/file/' + encodeURIComponent(base + '/' + filename);
        }
    }
    const project = (window.location.hash || '').slice(1);
    if (project)
        return '/api/read/file/' + encodeURIComponent(project + '/' + filename);
    return filename;
}

/** Creates an element; hyphenated keys become attributes (aria-*, data-*). */
export function el(tag, props) {
    const e = document.createElement(tag);
    if (!props) return e;
    for (const key of Object.keys(props)) {
        const val = props[key];
        if (key === 'style' && typeof val === 'string')
            e.style.cssText = val;
        else if (key.indexOf('-') >= 0)
            e.setAttribute(key, val);
        else
            e[key] = val;
    }
    return e;
}

/** Creates a compact decorative inline SVG icon (15x15). */
export function svgIcon(paths, viewBox = '0 0 24 24', size = 15) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const list = Array.isArray(paths) ? paths : [paths];
    list.forEach(d => {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', d);
        svg.appendChild(p);
    });
    return svg;
}

export function cardTitle(text) {
    const d = el('div', { className: 'card-title' });
    d.textContent = text;
    return d;
}

/** Retained for compatibility — top chrome is now flex-flowed inside 100dvh. */
export function layoutTopChrome() {
    const content = document.getElementById('tab-content');
    if (content && content.style.paddingTop)
        content.style.paddingTop = '';
}

export function hideP5Dom() {
    document.querySelectorAll('body > main').forEach(node => node.remove());
}
