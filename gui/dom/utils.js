/** DOM helpers and layout utilities. */
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

export function el(tag, props) {
    const e = document.createElement(tag);
    if(props) Object.assign(e, props);
    return e;
}

export function cardTitle(text) {
    const d = el('div', {className:'card-title'});
    d.textContent = text;
    return d;
}

export function layoutTopChrome() {
    const chrome  = document.getElementById('top-chrome');
    const content = document.getElementById('tab-content');
    if(chrome && content)
        content.style.paddingTop = (chrome.offsetHeight + 14) + 'px';
}

export function hideP5Dom() {
    document.querySelectorAll('body > main').forEach(el => el.remove());
}
