/** Top-level UI shell: header, tabs, tab switching, theme toggle. */
import { getContext } from '../context.js';
import { TAB_LIVE, TAB_FX, TAB_DEV, TAB_MAPPING, THEME_STORAGE_KEY } from '../config.js';
import { el, svgIcon, projectFileUrl } from './utils.js';
import {
    buildLivePane,
    setLiveLayoutGearButton,
    setLiveLayoutPanelOpen,
    toggleLiveLayoutPanel
} from './live.js';
import { isLiveTileOn } from '../live-layout.js';
import { startMeterAnim, stopMeterAnim } from './meters.js';
import { drawMasterEqCurve } from './masterEq.js';
import { buildMappingPane, cancelDetect } from './mapping.js';
import { buildDevControlPane } from './devControl.js';
import { buildFxPane, clearMomentaryFxTriggers } from './fx.js';

let _currentTheme = 'dark';
let _themeToggleBtn = null;

const ICON_MOON = 'M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z';
const ICON_SUN = [
    'M12 3v2', 'M12 19v2', 'M4.93 4.93l1.41 1.41', 'M17.66 17.66l1.41 1.41',
    'M3 12h2', 'M19 12h2', 'M4.93 19.07l1.41-1.41', 'M17.66 6.34l1.41-1.41',
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z'
];
const ICON_SLIDERS = [
    'M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3',
    'M2 14h4', 'M10 10h4', 'M18 16h4'
];

/** Returns the active theme ('dark' | 'light'). */
export function getActiveTheme() {
    return _currentTheme;
}

/** Determines initial theme from localStorage or system preference (defaults to 'dark'). */
export function getInitialTheme() {
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') return stored;
    } catch (_) {}
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
    }
    return 'dark';
}

/** Updates the visual label/tooltip of the theme toggle button. */
export function updateThemeButton() {
    if (!_themeToggleBtn) return;
    const isDark = _currentTheme === 'dark';
    _themeToggleBtn.innerHTML = '';
    _themeToggleBtn.appendChild(svgIcon(isDark ? ICON_MOON : ICON_SUN, '0 0 24 24', 14));
    const lbl = el('span', { className: 'theme-btn-lbl' });
    lbl.textContent = isDark ? 'Dark' : 'Light';
    _themeToggleBtn.appendChild(lbl);
    _themeToggleBtn.title = isDark ? 'Switch to light theme' : 'Switch to dark theme';
    _themeToggleBtn.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
}

/** Applies a theme ('dark' | 'light'), persists to localStorage and redraws canvas if needed. */
export function setTheme(theme) {
    _currentTheme = (theme === 'light') ? 'light' : 'dark';
    document.documentElement.dataset.theme = _currentTheme;
    try {
        localStorage.setItem(THEME_STORAGE_KEY, _currentTheme);
    } catch (_) {}
    updateThemeButton();
    try {
        const ctx = getContext();
        if (ctx && ctx.currentTab === TAB_LIVE && isLiveTileOn(ctx.liveLayoutPrefs, 'masterEq')) {
            drawMasterEqCurve();
        }
    } catch (_) {}
}

/** Toggles between 'dark' and 'light' theme. */
export function toggleTheme() {
    setTheme(_currentTheme === 'dark' ? 'light' : 'dark');
}

/** Builds the full DOM tree (header, tabs, all panes). */
export function buildUI() {
    setTheme(getInitialTheme());

    document.body.innerHTML = '';

    const root = el('div', { id: 'bela-gui' });
    const topChrome = el('header', { id: 'top-chrome' });

    const hdr = el('div', { id: 'gui-header' });
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

    const devBadge = el('span', {
        className: 'badge dev-badge',
        id: 'dev-badge',
        title: 'Virtual control mode active'
    });
    devBadge.textContent = 'VIRTUAL';
    hdr.appendChild(devBadge);

    const clipBadges = el('div', {
        id: 'clip-badges',
        className: 'clip-badges',
        'aria-live': 'polite'
    });
    hdr.appendChild(clipBadges);
    hdr.appendChild(el('span', { className: 'spacer' }));

    const logo = el('img', { id: 'gui-logo', alt: 'Fulla Vibes' });
    logo.src = projectFileUrl('LOGO.png');
    hdr.appendChild(logo);
    topChrome.appendChild(hdr);

    const tabBar = el('nav', { id: 'tab-bar', role: 'tablist', 'aria-label': 'Main navigation' });
    const tabPaneIds = ['pane-live', 'tab-fx', 'pane-dev', 'pane-mapping'];
    ['Live', 'FX', 'Controls', 'Mapping'].forEach((lbl, i) => {
        const btn = el('button', {
            type: 'button',
            className: 'tab-btn' + (i === TAB_LIVE ? ' active' : ''),
            role: 'tab',
            'aria-selected': i === TAB_LIVE ? 'true' : 'false',
            'aria-controls': tabPaneIds[i]
        });
        btn.textContent = lbl;
        btn.dataset.tab = i;
        btn.addEventListener('click', () => switchTab(i));
        tabBar.appendChild(btn);
    });

    tabBar.appendChild(el('span', { className: 'tab-bar-spacer' }));

    const themeBtn = el('button', {
        type: 'button',
        id: 'theme-toggle-btn',
        className: 'theme-toggle-btn'
    });
    themeBtn.addEventListener('click', () => toggleTheme());
    _themeToggleBtn = themeBtn;
    updateThemeButton();
    tabBar.appendChild(themeBtn);

    const gear = el('button', {
        type: 'button',
        id: 'live-layout-gear',
        className: 'live-layout-gear',
        title: 'Live layout',
        'aria-label': 'Live layout',
        'aria-expanded': 'false',
        'aria-haspopup': 'dialog'
    });
    gear.appendChild(svgIcon(ICON_SLIDERS, '0 0 24 24', 14));
    const gearLbl = el('span', { className: 'gear-btn-lbl' });
    gearLbl.textContent = 'Layout';
    gear.appendChild(gearLbl);
    gear.addEventListener('click', () => {
        const ctx = getContext();
        if (ctx.currentTab !== TAB_LIVE) {
            switchTab(TAB_LIVE);
            setLiveLayoutPanelOpen(true);
            return;
        }
        toggleLiveLayoutPanel();
    });
    tabBar.appendChild(gear);
    setLiveLayoutGearButton(gear);

    topChrome.appendChild(tabBar);
    root.appendChild(topChrome);

    const content = el('main', { id: 'tab-content' });
    content.appendChild(buildLivePane());
    content.appendChild(buildFxPane());
    content.appendChild(buildDevControlPane());
    content.appendChild(buildMappingPane());
    root.appendChild(content);

    document.body.appendChild(root);
}

/** Switches the active tab and starts/stops tab-specific animations. */
export function switchTab(idx) {
    const ctx = getContext();
    if (idx !== TAB_MAPPING) cancelDetect();
    if (idx !== TAB_FX) clearMomentaryFxTriggers();
    ctx.currentTab = idx;
    document.querySelectorAll('.tab-btn').forEach((b, i) => {
        const active = i === idx;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.tab-pane').forEach((p, i) =>
        p.classList.toggle('active', i === idx));
    if (idx === TAB_LIVE) {
        ctx.meterVu.forEach(vu => { if (vu) vu.resize(); });
        if (isLiveTileOn(ctx.liveLayoutPrefs, 'meters'))
            startMeterAnim();
        if (isLiveTileOn(ctx.liveLayoutPrefs, 'masterEq'))
            drawMasterEqCurve();
    } else {
        stopMeterAnim();
        setLiveLayoutPanelOpen(false);
    }
}
