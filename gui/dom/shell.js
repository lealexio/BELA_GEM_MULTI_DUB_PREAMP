/** Top-level UI shell: header, tabs, tab switching, theme toggle. */
import { getContext } from '../context.js';
import { TAB_LIVE, TAB_MAPPING, THEME_STORAGE_KEY } from '../config.js';
import { el, projectFileUrl } from './utils.js';
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

let _currentTheme = 'dark';
let _themeToggleBtn = null;

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
    _themeToggleBtn.innerHTML = (isDark ? '🌙' : '☀️') + '<span class="theme-btn-lbl"> ' + (isDark ? 'Dark' : 'Light') + '</span>';
    _themeToggleBtn.title = isDark ? 'Mode sombre actif (cliquer pour mode clair)' : 'Mode clair actif (cliquer pour mode sombre)';
    _themeToggleBtn.setAttribute('aria-label', isDark ? 'Passer en mode clair' : 'Passer en mode sombre');
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

    const root = el('div', {id: 'bela-gui'});
    const topChrome = el('div', {id: 'top-chrome'});

    const hdr = el('div', {id: 'gui-header'});
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

    const tabBar = el('div', {id: 'tab-bar'});
    ['Live', 'Mapping'].forEach((lbl, i) => {
        const btn = el('button', {className: 'tab-btn' + (i === TAB_LIVE ? ' active' : '')});
        btn.textContent = lbl;
        btn.dataset.tab = i;
        btn.addEventListener('click', () => switchTab(i));
        tabBar.appendChild(btn);
    });

    tabBar.appendChild(el('span', {className: 'tab-bar-spacer'}));

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
        'aria-label': 'Settings'
    });
    gear.textContent = 'Settings';
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
        if (isLiveTileOn(ctx.liveLayoutPrefs, 'meters'))
            startMeterAnim();
        if (isLiveTileOn(ctx.liveLayoutPrefs, 'masterEq'))
            drawMasterEqCurve();
    } else {
        stopMeterAnim();
        setLiveLayoutPanelOpen(false);
    }
}
