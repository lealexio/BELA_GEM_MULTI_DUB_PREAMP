/** Top-level UI shell: header, tabs, tab switching. */
import { getContext } from '../context.js';
import { el, projectFileUrl } from './utils.js';
import { buildLivePane } from './live.js';
import { buildMetersPane, startMeterAnim, stopMeterAnim } from './meters.js';
import { buildMasterEqPane, drawMasterEqCurve } from './masterEq.js';
import { buildMappingPane, cancelDetect } from './mapping.js';

/** Builds the full DOM tree (header, tabs, all panes). */
export function buildUI() {
    document.body.innerHTML = '';

    const root = el('div', {id:'bela-gui'});
    const topChrome = el('div', {id:'top-chrome'});

    const hdr = el('div', {id:'gui-header'});
    hdr.innerHTML =
        '<h1>Bela Preamp</h1>' +
        '<span class="badge" id="conn-badge">OFFLINE</span>' +
        '<span class="spacer"></span>';
    const logo = el('img', { id: 'gui-logo', alt: 'Fulla Vibes' });
    logo.src = projectFileUrl('LOGO.png');
    hdr.appendChild(logo);
    topChrome.appendChild(hdr);

    const tabBar = el('div', {id:'tab-bar'});
    ['Live','Meters','Master EQ','Mapping'].forEach((lbl, i) => {
        const btn = el('button', {className:'tab-btn' + (i===0?' active':'')});
        btn.textContent = lbl;
        btn.dataset.tab = i;
        btn.addEventListener('click', () => switchTab(i));
        tabBar.appendChild(btn);
    });
    topChrome.appendChild(tabBar);
    root.appendChild(topChrome);

    const content = el('div', {id:'tab-content'});
    content.appendChild(buildLivePane());
    content.appendChild(buildMetersPane());
    content.appendChild(buildMasterEqPane());
    content.appendChild(buildMappingPane());
    root.appendChild(content);

    document.body.appendChild(root);
}

/** Switches the active tab and starts/stops tab-specific animations. */
export function switchTab(idx) {
    const ctx = getContext();
    if(idx !== 3) cancelDetect();
    ctx.currentTab = idx;
    document.querySelectorAll('.tab-btn').forEach((b, i) =>
        b.classList.toggle('active', i === idx));
    document.querySelectorAll('.tab-pane').forEach((p, i) =>
        p.classList.toggle('active', i === idx));
    if(idx === 1) {
        ctx.meterVu.forEach(vu => { if(vu) vu.resize(); });
        startMeterAnim();
    } else {
        stopMeterAnim();
    }
    if(idx === 2)
        drawMasterEqCurve();
}
