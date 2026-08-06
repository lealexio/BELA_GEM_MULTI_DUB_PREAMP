/** Top-level UI shell: header, tabs, tab switching. */
import { getContext } from '../context.js';
import { TAB_LIVE, TAB_MAPPING } from '../config.js';
import { el, projectFileUrl } from './utils.js';
import { buildLivePane } from './live.js';
import { startMeterAnim, stopMeterAnim } from './meters.js';
import { drawMasterEqCurve } from './masterEq.js';
import { buildMappingPane, cancelDetect } from './mapping.js';

/** Builds the full DOM tree (header, tabs, all panes). */
export function buildUI() {
    document.body.innerHTML = '';

    const root = el('div', {id: 'bela-gui'});
    const topChrome = el('div', {id: 'top-chrome'});

    const hdr = el('div', {id: 'gui-header'});
    const belaLogo = el('img', { id: 'gui-bela-logo', alt: 'Bela' });
    belaLogo.src = projectFileUrl('BELA.png');
    hdr.appendChild(belaLogo);
    const connBadge = el('span', { className: 'badge', id: 'conn-badge' });
    connBadge.textContent = 'OFFLINE';
    hdr.appendChild(connBadge);
    const tempBadge = el('span', {
        className: 'badge temp unknown',
        id: 'temp-badge',
        title: 'CPU temperature'
    });
    tempBadge.textContent = '--°C';
    hdr.appendChild(tempBadge);
    hdr.appendChild(el('span', { className: 'spacer' }));
    const logo = el('img', { id: 'gui-logo', alt: 'Fulla Vibes' });
    logo.src = projectFileUrl('LOGO.png');
    hdr.appendChild(logo);
    topChrome.appendChild(hdr);

    const tabBar = el('div', {id: 'tab-bar'});
    ['Live', 'Mapping'].forEach((lbl, i) => {
        const btn = el('button', {className: 'tab-btn' + (i === TAB_LIVE ? ' active' : '')});
        btn.textContent = lbl;
        btn.dataset.tab = i;
        btn.addEventListener('click', () => switchTab(i));
        tabBar.appendChild(btn);
    });
    topChrome.appendChild(tabBar);
    root.appendChild(topChrome);

    const content = el('div', {id: 'tab-content'});
    content.appendChild(buildLivePane());
    content.appendChild(buildMappingPane());
    root.appendChild(content);

    document.body.appendChild(root);
}

/** Switches the active tab and starts/stops tab-specific animations. */
export function switchTab(idx) {
    const ctx = getContext();
    if (idx !== TAB_MAPPING) cancelDetect();
    ctx.currentTab = idx;
    document.querySelectorAll('.tab-btn').forEach((b, i) =>
        b.classList.toggle('active', i === idx));
    document.querySelectorAll('.tab-pane').forEach((p, i) =>
        p.classList.toggle('active', i === idx));
    if (idx === TAB_LIVE) {
        ctx.meterVu.forEach(vu => { if (vu) vu.resize(); });
        if (ctx.liveLayoutPrefs && ctx.liveLayoutPrefs.meters)
            startMeterAnim();
        if (ctx.liveLayoutPrefs && ctx.liveLayoutPrefs.masterEq)
            drawMasterEqCurve();
    } else {
        stopMeterAnim();
    }
}
