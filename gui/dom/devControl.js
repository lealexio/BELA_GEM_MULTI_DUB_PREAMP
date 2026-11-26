/**
 * Dev Control Tab (Virtual Controls Mode)
 * Interactive virtual sliders and switches with throttled Bela WebSocket updates.
 */
import { getContext } from '../context.js';
import {
    POT_NAMES, SWITCH_NAMES, SIREN_PRESETS,
    CONFIG_META, isPotCentered, getPotDevDefault
} from '../config.js';
import { belaControlReady } from '../bela/connection.js';
import { el, cardTitle } from './utils.js';

/** Outgoing send throttling state (~30 ms per pot during drag). */
const _lastSendTs = new Float64Array(POT_NAMES.length);
const _pendingRaf = new Int32Array(POT_NAMES.length).fill(-1);
const _pendingVals = new Float32Array(POT_NAMES.length).fill(-1);
const MIN_SEND_INTERVAL_MS = 30;

/** Anti-flicker hold window after user toggles dev mode locally. */
let _devModeHoldUntil = 0;
const DEV_MODE_HOLD_MS = 2500;

/** Active user interaction tracking to avoid feedback fighting during drags. */
let _activeInteractingPot = -1;

/** Cached DOM elements for fast value reflection. */
const _potSliders = new Array(POT_NAMES.length);
const _potValueLabels = new Array(POT_NAMES.length);
const _switchButtons = new Array(SWITCH_NAMES.length);

let _devModeToggleBtn = null;
let _devModePillEl = null;
let _devModeBannerEl = null;
let _devControlsContainerEl = null;

function sendCustomControl(payload) {
    if (!belaControlReady()) return;
    /* global Bela */
    Bela.control.send(payload);
}

/** Throttled sender for potentiometer values. */
export function sendVirtualPot(potIdx, val, forceImmediate = false) {
    if (potIdx < 0 || potIdx >= POT_NAMES.length) return;
    const now = performance.now();
    _pendingVals[potIdx] = val;

    if (forceImmediate || (now - _lastSendTs[potIdx] >= MIN_SEND_INTERVAL_MS)) {
        _lastSendTs[potIdx] = now;
        if (_pendingRaf[potIdx] !== -1) {
            cancelAnimationFrame(_pendingRaf[potIdx]);
            _pendingRaf[potIdx] = -1;
        }
        sendCustomControl({
            event: 'custom',
            uiPot: potIdx,
            val: Number(val.toFixed(4))
        });
        return;
    }

    if (_pendingRaf[potIdx] === -1) {
        _pendingRaf[potIdx] = requestAnimationFrame(() => {
            _pendingRaf[potIdx] = -1;
            _lastSendTs[potIdx] = performance.now();
            sendCustomControl({
                event: 'custom',
                uiPot: potIdx,
                val: Number(_pendingVals[potIdx].toFixed(4))
            });
        });
    }
}

/** Immediate sender for switch toggles. */
export function sendVirtualSwitch(swIdx, active) {
    if (swIdx < 0 || swIdx >= SWITCH_NAMES.length) return;
    sendCustomControl({
        event: 'custom',
        uiSwitch: swIdx,
        val: Boolean(active)
    });
}

/** Immediate sender for UI Control (Dev) mode toggle. */
export function sendUiDevMode(enabled) {
    const ctx = getContext();
    ctx.uiDevMode = Boolean(enabled);
    _devModeHoldUntil = Date.now() + DEV_MODE_HOLD_MS;
    updateDevModeVisuals(ctx.uiDevMode);
    if (ctx.uiDevMode) {
        for (let i = 0; i < POT_NAMES.length; i++) {
            const defVal = getPotDevDefault(POT_NAMES[i]);
            if (_potSliders[i]) _potSliders[i].value = defVal.toString();
            if (_potValueLabels[i]) _potValueLabels[i].textContent = formatPotValue(POT_NAMES[i], defVal);
        }
        for (let i = 0; i < SWITCH_NAMES.length; i++) {
            if (_switchButtons[i]) {
                _switchButtons[i].classList.remove('active', 'firing');
                _switchButtons[i].setAttribute('aria-pressed', 'false');
            }
        }
    }
    sendCustomControl({
        event: 'custom',
        uiDevMode: ctx.uiDevMode
    });
}

/** Immediate sender to reset virtual controls to musical defaults. */
export function sendVirtualReset() {
    sendCustomControl({
        event: 'custom',
        uiReset: true
    });
}

/** Updates UI mode visual styling and header badge. */
export function updateDevModeVisuals(active) {
    const ctx = getContext();
    ctx.uiDevMode = active;

    if (_devModeToggleBtn) {
        _devModeToggleBtn.classList.toggle('active', active);
        _devModeToggleBtn.textContent = active ? 'Virtual Active' : 'Enable Virtual';
        _devModeToggleBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    if (_devModePillEl) {
        _devModePillEl.textContent = active ? 'Virtual · ADC paused' : 'Hardware';
    }

    if (_devModeBannerEl) {
        _devModeBannerEl.classList.toggle('dev-active', active);
    }

    if (_devControlsContainerEl) {
        _devControlsContainerEl.classList.toggle('disabled-controls', !active);
    }

    const headerDevBadge = document.getElementById('dev-badge');
    if (headerDevBadge) {
        headerDevBadge.classList.toggle('visible', active);
    }
}

/** Synchronizes UI Dev mode state from Buffer 6. */
export function syncUiDevMode(metaBuf) {
    if (!metaBuf || metaBuf.length <= CONFIG_META.UI_DEV_MODE) return;
    const isDev = metaBuf[CONFIG_META.UI_DEV_MODE] > 0.5;
    const ctx = getContext();

    if (Date.now() < _devModeHoldUntil) {
        if (ctx.uiDevMode === isDev) _devModeHoldUntil = 0;
        return;
    }

    if (ctx.uiDevMode !== isDev) {
        ctx.uiDevMode = isDev;
        updateDevModeVisuals(isDev);
    }
}

/** Formats a pot value for display according to its name. */
function formatPotValue(name, val) {
    if (/^AUX\d_EQ_(LOW|MID|HIGH)$/.test(name) || /^MASTER_EQ_.*_GAIN$/.test(name) || /^BTRIM_/.test(name)) {
        const db = (val - 0.5) * 12;
        return (db >= 0 ? '+' : '') + db.toFixed(1) + ' dB';
    }
    if (name.startsWith('GEQ_')) {
        const db = (val - 0.5) * 24;
        return (db >= 0 ? '+' : '') + db.toFixed(1) + ' dB';
    }
    if (name === 'MASTER_HPF_FREQ') {
        const hz = 20 + val * 1980;
        return val < 0.015 ? 'Off' : Math.round(hz) + ' Hz';
    }
    if (name === 'MASTER_LPF_FREQ') {
        const hz = 200 + val * 19800;
        return val > 0.985 ? 'Off' : (hz >= 1000 ? (hz / 1000).toFixed(1) + ' kHz' : Math.round(hz) + ' Hz');
    }
    if (name === 'MASTER_HPF_RES' || name === 'MASTER_LPF_RES') {
        const q = 0.7 + val * (4.5 - 0.7);
        return 'Q ' + q.toFixed(2);
    }
    if (name === 'MASTER_EQ_SUB_FREQ') return Math.round(20 + val * 60) + ' Hz';
    if (name === 'MASTER_EQ_KICK_FREQ') return Math.round(80 + val * 120) + ' Hz';
    if (name === 'MASTER_EQ_MID_FREQ') return Math.round(200 + val * 1000) + ' Hz';
    if (name === 'MASTER_EQ_TOP_FREQ') {
        const hz = 1200 + val * 14800;
        return hz >= 1000 ? (hz / 1000).toFixed(1) + ' kHz' : Math.round(hz) + ' Hz';
    }
    if (name === 'SIREN_TYPE') {
        const idx = Math.min(5, Math.floor(val * 6));
        return SIREN_PRESETS[idx] || 'Preset ' + idx;
    }
    return Math.round(val * 100) + '%';
}

/** Creates a single styled slider element with label and value readout. */
function createPotControl(potIdx, label, ariaPrefix) {
    const name = POT_NAMES[potIdx];
    const isCentered = isPotCentered(name);
    const defVal = getPotDevDefault(name);
    const item = el('div', { className: 'dev-pot-item' });

    const topRow = el('div', { className: 'dev-pot-top' });
    const lbl = el('span', { className: 'dev-pot-label' });
    lbl.textContent = label || name;
    const valLbl = el('span', { className: 'dev-pot-val' });
    valLbl.textContent = formatPotValue(name, defVal);

    topRow.appendChild(lbl);
    topRow.appendChild(valLbl);
    item.appendChild(topRow);

    const slider = el('input', {
        type: 'range',
        min: '0',
        max: '1',
        step: '0.005',
        value: defVal.toString(),
        className: 'dev-pot-slider' + (isCentered ? ' centered' : ''),
        'aria-label': ariaPrefix ? `${ariaPrefix} ${label}` : (label || name)
    });

    slider.addEventListener('pointerdown', () => { _activeInteractingPot = potIdx; });
    const endDrag = () => {
        if (_activeInteractingPot === potIdx) {
            _activeInteractingPot = -1;
            sendVirtualPot(potIdx, parseFloat(slider.value), true);
        }
    };
    slider.addEventListener('pointerup', endDrag);
    slider.addEventListener('pointercancel', endDrag);

    slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        valLbl.textContent = formatPotValue(name, v);
        sendVirtualPot(potIdx, v, false);
    });

    slider.addEventListener('dblclick', () => {
        const dVal = getPotDevDefault(name);
        slider.value = dVal.toString();
        valLbl.textContent = formatPotValue(name, dVal);
        sendVirtualPot(potIdx, dVal, true);
    });

    item.appendChild(slider);

    _potSliders[potIdx] = slider;
    _potValueLabels[potIdx] = valLbl;

    return item;
}

/** Builds the Master & Kills Card. */
function buildMasterSection() {
    const card = el('div', { className: 'card dev-section' });
    card.appendChild(cardTitle('Master'));

    const killSection = el('div', { className: 'dev-kill-section' });
    killSection.appendChild(el('div', { className: 'dev-sub-heading', textContent: 'Kills' }));

    const killGrid = el('div', { className: 'dev-kill-grid' });
    const killDef = [
        { idx: 0, label: 'SUB', sub: '<80Hz', color: 'sub' },
        { idx: 1, label: 'KICK', sub: '80–200', color: 'kick' },
        { idx: 2, label: 'MID', sub: '200–1.2k', color: 'mid' },
        { idx: 3, label: 'TOP', sub: '>1.2k', color: 'top' }
    ];

    killDef.forEach(({ idx, label, sub, color }) => {
        const btn = el('button', {
            type: 'button',
            className: 'dev-kill-btn ' + color,
            'aria-pressed': 'false'
        });
        btn.appendChild(el('span', { textContent: label }));
        btn.appendChild(el('span', { className: 'dev-kill-sub', textContent: sub }));
        btn.addEventListener('click', () => {
            const ctx = getContext();
            const curState = (ctx.switchStates && ctx.switchStates[idx] > 0.5);
            const newState = !curState;
            btn.classList.toggle('active', newState);
            btn.setAttribute('aria-pressed', newState ? 'true' : 'false');
            sendVirtualSwitch(idx, newState);
        });
        _switchButtons[idx] = btn;
        killGrid.appendChild(btn);
    });
    killSection.appendChild(killGrid);
    card.appendChild(killSection);

    const masterGrid = el('div', { className: 'dev-grid-2col' });

    const masterCol = el('div', { className: 'dev-sub-panel' });
    masterCol.appendChild(el('div', { className: 'dev-sub-heading', textContent: 'Output' }));
    masterCol.appendChild(createPotControl(24, 'Master Gain', 'Master'));
    masterGrid.appendChild(masterCol);

    const trimCol = el('div', { className: 'dev-sub-panel' });
    trimCol.appendChild(el('div', { className: 'dev-sub-heading', textContent: 'Band Trim' }));
    const trimPots = el('div', { className: 'dev-pot-grid-2' });
    trimPots.appendChild(createPotControl(37, 'Sub', 'Band Trim'));
    trimPots.appendChild(createPotControl(38, 'Kick', 'Band Trim'));
    trimPots.appendChild(createPotControl(39, 'Mid', 'Band Trim'));
    trimPots.appendChild(createPotControl(40, 'Top', 'Band Trim'));
    trimCol.appendChild(trimPots);
    masterGrid.appendChild(trimCol);

    card.appendChild(masterGrid);

    const filterSection = el('div', { className: 'dev-sub-panel' });
    filterSection.style.marginTop = '12px';
    filterSection.appendChild(el('div', { className: 'dev-sub-heading', textContent: 'Filters' }));
    const filterGrid = el('div', { className: 'dev-pot-grid-2' });
    filterGrid.appendChild(createPotControl(33, 'HPF Freq', 'Master'));
    filterGrid.appendChild(createPotControl(34, 'HPF Res', 'Master'));
    filterGrid.appendChild(createPotControl(35, 'LPF Freq', 'Master'));
    filterGrid.appendChild(createPotControl(36, 'LPF Res', 'Master'));
    filterSection.appendChild(filterGrid);
    card.appendChild(filterSection);

    return card;
}

/** Builds the 4 AUX Channel Strips Card. */
function buildChannelStripsSection() {
    const card = el('div', { className: 'card dev-section' });
    card.appendChild(cardTitle('Channels'));

    const grid = el('div', { className: 'dev-channels-grid' });
    const auxConfigs = [
        { ch: 1, base: 0 },
        { ch: 2, base: 6 },
        { ch: 3, base: 12 },
        { ch: 4, base: 18 }
    ];

    auxConfigs.forEach(({ ch, base }) => {
        const col = el('div', { className: 'dev-channel-col' });
        const hdr = el('div', { className: 'dev-channel-hdr', textContent: 'AUX ' + ch });
        col.appendChild(hdr);
        const prefix = 'AUX ' + ch;

        col.appendChild(createPotControl(base + 0, 'Gain', prefix));

        const eqBox = el('div', { className: 'dev-eq-box' });
        if (ch === 1) {
            eqBox.appendChild(createPotControl(base + 3, 'High', prefix));
            eqBox.appendChild(createPotControl(base + 1, 'Mid', prefix));
            eqBox.appendChild(createPotControl(base + 2, 'Low', prefix));
        } else if (ch === 2) {
            eqBox.appendChild(createPotControl(base + 2, 'High', prefix));
            eqBox.appendChild(createPotControl(base + 1, 'Mid', prefix));
            eqBox.appendChild(createPotControl(base + 3, 'Low', prefix));
        } else {
            eqBox.appendChild(createPotControl(base + 3, 'High', prefix));
            eqBox.appendChild(createPotControl(base + 2, 'Mid', prefix));
            eqBox.appendChild(createPotControl(base + 1, 'Low', prefix));
        }
        col.appendChild(eqBox);

        col.appendChild(createPotControl(base + 4, 'FX1', prefix));
        col.appendChild(createPotControl(base + 5, 'FX2', prefix));

        grid.appendChild(col);
    });

    card.appendChild(grid);
    return card;
}

/** Builds the Master Parametric & Graphic EQ Card. */
function buildMasterEqSection() {
    const card = el('div', { className: 'card dev-section' });
    card.appendChild(cardTitle('Master EQ'));

    const peqBox = el('div', { className: 'dev-sub-panel' });
    peqBox.appendChild(el('div', { className: 'dev-sub-heading', textContent: 'Parametric' }));
    const peqGrid = el('div', { className: 'dev-channels-grid' });

    const peqBands = [
        { label: 'SUB', fIdx: 25, gIdx: 26 },
        { label: 'KICK', fIdx: 27, gIdx: 28 },
        { label: 'MID', fIdx: 29, gIdx: 30 },
        { label: 'TOP', fIdx: 31, gIdx: 32 }
    ];

    peqBands.forEach(({ label, fIdx, gIdx }) => {
        const bCol = el('div', { className: 'dev-channel-col' });
        bCol.appendChild(el('div', { className: 'dev-channel-hdr', textContent: label }));
        bCol.appendChild(createPotControl(fIdx, 'Freq', label));
        bCol.appendChild(createPotControl(gIdx, 'Gain', label));
        peqGrid.appendChild(bCol);
    });
    peqBox.appendChild(peqGrid);
    card.appendChild(peqBox);

    const geqBox = el('div', { className: 'dev-sub-panel' });
    geqBox.style.marginTop = '12px';
    const geqHdrRow = el('div', { className: 'dev-row-between' });
    geqHdrRow.appendChild(el('div', { className: 'dev-sub-heading', textContent: 'Graphic EQ' }));

    const flatBtn = el('button', {
        type: 'button',
        className: 'dev-small-btn',
        textContent: 'Flat'
    });
    flatBtn.addEventListener('click', () => {
        for (let i = 46; i <= 57; i++) {
            if (_potSliders[i]) _potSliders[i].value = '0.5';
            if (_potValueLabels[i]) _potValueLabels[i].textContent = '0.0 dB';
            sendVirtualPot(i, 0.5, true);
        }
    });
    geqHdrRow.appendChild(flatBtn);
    geqBox.appendChild(geqHdrRow);

    const geqGrid = el('div', { className: 'dev-geq-grid' });
    const geqLabels = ['40Hz', '60Hz', '80Hz', '100Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz'];
    for (let i = 0; i < 12; i++) {
        geqGrid.appendChild(createPotControl(46 + i, geqLabels[i], 'GEQ'));
    }
    geqBox.appendChild(geqGrid);
    card.appendChild(geqBox);

    return card;
}

/** Builds the FX & Dub Siren Card. */
function buildFxAndSirenSection() {
    const card = el('div', { className: 'card dev-section' });
    card.appendChild(cardTitle('FX & Siren'));

    const grid = el('div', { className: 'dev-grid-2col' });

    const fxCol = el('div', { className: 'dev-sub-panel' });
    fxCol.appendChild(el('div', { className: 'dev-sub-heading', textContent: 'FX Bus' }));

    const fx1Row = el('div', { className: 'dev-fx-mode-row' });
    fx1Row.appendChild(el('span', { className: 'dev-pot-label', textContent: 'FX1 Filter' }));
    const fx1Mids = el('button', { type: 'button', className: 'dev-mode-btn', textContent: 'Mids', 'aria-pressed': 'false' });
    const fx1Tops = el('button', { type: 'button', className: 'dev-mode-btn', textContent: 'Tops', 'aria-pressed': 'false' });

    fx1Mids.addEventListener('click', () => {
        const next = fx1Mids.classList.toggle('active');
        fx1Mids.setAttribute('aria-pressed', next ? 'true' : 'false');
        sendVirtualSwitch(4, next);
    });
    fx1Tops.addEventListener('click', () => {
        const next = fx1Tops.classList.toggle('active');
        fx1Tops.setAttribute('aria-pressed', next ? 'true' : 'false');
        sendVirtualSwitch(5, next);
    });
    _switchButtons[4] = fx1Mids;
    _switchButtons[5] = fx1Tops;
    fx1Row.appendChild(fx1Mids);
    fx1Row.appendChild(fx1Tops);
    fxCol.appendChild(fx1Row);

    const fx2Row = el('div', { className: 'dev-fx-mode-row' });
    fx2Row.appendChild(el('span', { className: 'dev-pot-label', textContent: 'FX2 Filter' }));
    const fx2Mids = el('button', { type: 'button', className: 'dev-mode-btn', textContent: 'Mids', 'aria-pressed': 'false' });
    const fx2Tops = el('button', { type: 'button', className: 'dev-mode-btn', textContent: 'Tops', 'aria-pressed': 'false' });

    fx2Mids.addEventListener('click', () => {
        const next = fx2Mids.classList.toggle('active');
        fx2Mids.setAttribute('aria-pressed', next ? 'true' : 'false');
        sendVirtualSwitch(7, next);
    });
    fx2Tops.addEventListener('click', () => {
        const next = fx2Tops.classList.toggle('active');
        fx2Tops.setAttribute('aria-pressed', next ? 'true' : 'false');
        sendVirtualSwitch(6, next);
    });
    _switchButtons[7] = fx2Mids;
    _switchButtons[6] = fx2Tops;
    fx2Row.appendChild(fx2Mids);
    fx2Row.appendChild(fx2Tops);
    fxCol.appendChild(fx2Row);

    fxCol.appendChild(createPotControl(58, 'FX1 Return', 'FX'));
    fxCol.appendChild(createPotControl(59, 'FX2 Return', 'FX'));
    grid.appendChild(fxCol);

    const sirenCol = el('div', { className: 'dev-sub-panel' });
    sirenCol.appendChild(el('div', { className: 'dev-sub-heading', textContent: 'Dub Siren' }));

    sirenCol.appendChild(createPotControl(41, 'Preset', 'Siren'));
    sirenCol.appendChild(createPotControl(42, 'Mod', 'Siren'));
    sirenCol.appendChild(createPotControl(43, 'Gain', 'Siren'));
    sirenCol.appendChild(createPotControl(44, 'FX1', 'Siren'));
    sirenCol.appendChild(createPotControl(45, 'FX2', 'Siren'));

    const triggerBox = el('div', { className: 'dev-siren-trigger-box' });
    const trigBtn = el('button', {
        type: 'button',
        className: 'dev-siren-trig-btn',
        textContent: 'Trigger'
    });

    let trigActive = false;
    const setTrigger = (on) => {
        if (trigActive === on) return;
        trigActive = on;
        trigBtn.classList.toggle('firing', on);
        sendVirtualSwitch(8, on);
    };

    trigBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (typeof trigBtn.setPointerCapture === 'function') {
            try { trigBtn.setPointerCapture(e.pointerId); } catch (_) {}
        }
        setTrigger(true);
    });
    const endTrigger = () => setTrigger(false);
    trigBtn.addEventListener('pointerup', endTrigger);
    trigBtn.addEventListener('pointercancel', endTrigger);
    trigBtn.addEventListener('lostpointercapture', endTrigger);
    trigBtn.addEventListener('keydown', (e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault();
            setTrigger(true);
        }
    });
    trigBtn.addEventListener('keyup', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            setTrigger(false);
        }
    });
    trigBtn.addEventListener('blur', endTrigger);

    const latchBtn = el('button', {
        type: 'button',
        className: 'dev-siren-latch-btn',
        textContent: 'Latch',
        'aria-pressed': 'false'
    });
    latchBtn.addEventListener('click', () => {
        const isFiring = latchBtn.classList.toggle('active');
        latchBtn.setAttribute('aria-pressed', isFiring ? 'true' : 'false');
        trigBtn.classList.toggle('firing', isFiring);
        sendVirtualSwitch(8, isFiring);
    });
    _switchButtons[8] = latchBtn;

    triggerBox.appendChild(trigBtn);
    triggerBox.appendChild(latchBtn);
    sirenCol.appendChild(triggerBox);

    grid.appendChild(sirenCol);
    card.appendChild(grid);
    return card;
}

/** Builds the full Dev Control tab pane. */
export function buildDevControlPane() {
    const pane = el('div', {
        id: 'pane-dev',
        className: 'tab-pane'
    });

    const banner = el('div', { className: 'card dev-banner', id: 'dev-mode-banner' });
    _devModeBannerEl = banner;

    const bannerTop = el('div', { className: 'dev-banner-top' });
    const titleDiv = el('div', { className: 'dev-banner-title-box' });
    titleDiv.appendChild(el('h2', { className: 'dev-banner-title', textContent: 'Virtual Controls' }));
    _devModePillEl = el('span', { className: 'dev-mode-pill', textContent: 'Hardware' });
    titleDiv.appendChild(_devModePillEl);
    bannerTop.appendChild(titleDiv);

    const toggleBtn = el('button', {
        type: 'button',
        id: 'dev-mode-toggle-btn',
        className: 'dev-toggle-btn',
        'aria-pressed': 'false'
    });
    toggleBtn.addEventListener('click', () => {
        const ctx = getContext();
        sendUiDevMode(!ctx.uiDevMode);
    });
    _devModeToggleBtn = toggleBtn;
    bannerTop.appendChild(toggleBtn);
    banner.appendChild(bannerTop);

    const actionsRow = el('div', { className: 'dev-actions-row' });

    const resetBtn = el('button', {
        type: 'button',
        className: 'dev-action-btn',
        textContent: 'Reset'
    });
    resetBtn.addEventListener('click', () => {
        sendVirtualReset();
        for (let i = 0; i < POT_NAMES.length; i++) {
            const name = POT_NAMES[i];
            const defVal = getPotDevDefault(name);
            if (_potSliders[i]) _potSliders[i].value = defVal.toString();
            if (_potValueLabels[i]) _potValueLabels[i].textContent = formatPotValue(name, defVal);
        }
        for (let i = 0; i < SWITCH_NAMES.length; i++) {
            if (_switchButtons[i]) {
                _switchButtons[i].classList.remove('active', 'firing');
                _switchButtons[i].setAttribute('aria-pressed', 'false');
            }
        }
    });
    actionsRow.appendChild(resetBtn);

    const muteBtn = el('button', {
        type: 'button',
        className: 'dev-action-btn',
        textContent: 'Mute Master'
    });
    muteBtn.addEventListener('click', () => {
        if (_potSliders[24]) _potSliders[24].value = '0';
        if (_potValueLabels[24]) _potValueLabels[24].textContent = '0%';
        sendVirtualPot(24, 0.0, true);
    });
    actionsRow.appendChild(muteBtn);

    const unkillBtn = el('button', {
        type: 'button',
        className: 'dev-action-btn',
        textContent: 'Unkill All'
    });
    unkillBtn.addEventListener('click', () => {
        for (let i = 0; i < 4; i++) {
            if (_switchButtons[i]) {
                _switchButtons[i].classList.remove('active');
                _switchButtons[i].setAttribute('aria-pressed', 'false');
            }
            sendVirtualSwitch(i, false);
        }
    });
    actionsRow.appendChild(unkillBtn);

    banner.appendChild(actionsRow);
    pane.appendChild(banner);

    const controlsContainer = el('div', { id: 'dev-controls-container', className: 'dev-controls-container' });
    _devControlsContainerEl = controlsContainer;

    controlsContainer.appendChild(buildMasterSection());
    controlsContainer.appendChild(buildChannelStripsSection());
    controlsContainer.appendChild(buildMasterEqSection());
    controlsContainer.appendChild(buildFxAndSirenSection());

    pane.appendChild(controlsContainer);

    updateDevModeVisuals(false);

    return pane;
}

/** Reflects live pot and switch values into Dev Controls when not actively dragging. */
export function updateDevControlsLive() {
    const ctx = getContext();
    if (!ctx || !ctx.uiDevMode) return;

    if (ctx.potValues && ctx.potValues.length >= POT_NAMES.length) {
        for (let i = 0; i < POT_NAMES.length; i++) {
            if (i === _activeInteractingPot) continue;
            const val = ctx.potValues[i];
            const slider = _potSliders[i];
            const valLbl = _potValueLabels[i];
            if (slider && Math.abs(parseFloat(slider.value) - val) > 0.005) {
                slider.value = val.toString();
                if (valLbl) valLbl.textContent = formatPotValue(POT_NAMES[i], val);
            }
        }
    }

    if (ctx.switchStates && ctx.switchStates.length >= SWITCH_NAMES.length) {
        for (let i = 0; i < SWITCH_NAMES.length; i++) {
            const btn = _switchButtons[i];
            if (!btn) continue;
            const isOn = ctx.switchStates[i] > 0.5;
            btn.classList.toggle('active', isOn);
            btn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
        }
    }
}
