/**
 * Dev Control Tab (Virtual Controls Mode)
 * Provides interactive virtual sliders and switches when hardware controls
 * are not connected, with strict performance throttling for Bela.
 */
import { getContext } from '../context.js';
import {
    POT_NAMES, SWITCH_NAMES, SIREN_PRESETS,
    TAB_DEV, CONFIG_META, isPotCentered
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
let _devModeBannerEl = null;
let _devControlsContainerEl = null;

/**
 * Sends a custom control payload to Bela via Bela.control WebSocket.
 */
function sendCustomControl(payload) {
    if (!belaControlReady()) return;
    /* global Bela */
    Bela.control.send(payload);
}

/**
 * Throttled sender for potentiometer values.
 */
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

/**
 * Immediate sender for switch toggles.
 */
export function sendVirtualSwitch(swIdx, active) {
    if (swIdx < 0 || swIdx >= SWITCH_NAMES.length) return;
    sendCustomControl({
        event: 'custom',
        uiSwitch: swIdx,
        val: Boolean(active)
    });
}

/**
 * Immediate sender for UI Control (Dev) mode toggle.
 */
export function sendUiDevMode(enabled) {
    const ctx = getContext();
    ctx.uiDevMode = Boolean(enabled);
    _devModeHoldUntil = Date.now() + DEV_MODE_HOLD_MS;
    updateDevModeVisuals(ctx.uiDevMode);
    if (ctx.uiDevMode) {
        // Reset sliders to default on enabling dev mode: centered -> 0.5, all others -> 0.0
        for (let i = 0; i < POT_NAMES.length; i++) {
            const defVal = isPotCentered(POT_NAMES[i]) ? 0.5 : 0.0;
            if (_potSliders[i]) _potSliders[i].value = defVal.toString();
            if (_potValueLabels[i]) _potValueLabels[i].textContent = formatPotValue(POT_NAMES[i], defVal);
        }
        for (let i = 0; i < SWITCH_NAMES.length; i++) {
            if (_switchButtons[i]) _switchButtons[i].classList.remove('active', 'firing');
        }
    }
    sendCustomControl({
        event: 'custom',
        uiDevMode: ctx.uiDevMode
    });
}

/**
 * Immediate sender to reset virtual controls to clean musical defaults.
 */
export function sendVirtualReset() {
    sendCustomControl({
        event: 'custom',
        uiReset: true
    });
}

/**
 * Updates UI mode visual styling and header badge.
 */
export function updateDevModeVisuals(active) {
    const ctx = getContext();
    ctx.uiDevMode = active;

    if (_devModeToggleBtn) {
        _devModeToggleBtn.classList.toggle('active', active);
        _devModeToggleBtn.textContent = active ? 'VIRTUAL MODE ACTIVE' : 'PHYSICAL MODE ACTIVE';
    }

    if (_devModeBannerEl) {
        _devModeBannerEl.classList.toggle('dev-active', active);
        const descEl = _devModeBannerEl.querySelector('.dev-mode-desc');
        if (descEl) {
            descEl.innerHTML = active
                ? '<strong>UI Control Mode Active:</strong> Sliders and switches below directly control Bela. Hardware ADC scanning is suspended (zero floating noise, CPU saved).'
                : '<strong>Physical Mode Active:</strong> Bela is controlled by its physical potentiometers and switches. Click above to enable virtual UI control.';
        }
    }

    if (_devControlsContainerEl) {
        _devControlsContainerEl.classList.toggle('disabled-controls', !active);
    }

    // Header badge
    const headerDevBadge = document.getElementById('dev-badge');
    if (headerDevBadge) {
        headerDevBadge.classList.toggle('visible', active);
    }
}

/**
 * Synchronizes UI Dev mode state from Buffer 6.
 */
export function syncUiDevMode(metaBuf) {
    if (!metaBuf || metaBuf.length <= CONFIG_META.UI_DEV_MODE) return;
    const isDev = metaBuf[CONFIG_META.UI_DEV_MODE] > 0.5;
    const ctx = getContext();

    // Prevent button flickering: if user recently clicked the toggle,
    // hold local state until Bela catches up or timeout expires.
    if (Date.now() < _devModeHoldUntil) {
        if (ctx.uiDevMode === isDev) {
            _devModeHoldUntil = 0; // Confirmed by Bela!
        }
        return;
    }

    if (ctx.uiDevMode !== isDev) {
        ctx.uiDevMode = isDev;
        updateDevModeVisuals(isDev);
    }
}

/**
 * Formats a pot value for display according to its name.
 */
function formatPotValue(name, val) {
    if (/^AUX\d_EQ_(LOW|MID|HIGH)$/.test(name) || /^MASTER_EQ_.*_GAIN$/.test(name) || /^BTRIM_/.test(name)) {
        // ±6 dB centered
        const db = (val - 0.5) * 12;
        return (db >= 0 ? '+' : '') + db.toFixed(1) + ' dB';
    }
    if (name.startsWith('GEQ_')) {
        // ±12 dB centered
        const db = (val - 0.5) * 24;
        return (db >= 0 ? '+' : '') + db.toFixed(1) + ' dB';
    }
    if (name === 'MASTER_HPF_FREQ') {
        const hz = 20 + val * 1980;
        return val < 0.015 ? 'Bypass' : Math.round(hz) + ' Hz';
    }
    if (name === 'MASTER_LPF_FREQ') {
        const hz = 200 + val * 19800;
        return val > 0.985 ? 'Bypass' : (hz >= 1000 ? (hz / 1000).toFixed(1) + ' kHz' : Math.round(hz) + ' Hz');
    }
    if (name === 'MASTER_HPF_RES' || name === 'MASTER_LPF_RES') {
        const q = 0.7 + val * (4.5 - 0.7);
        return 'Q ' + q.toFixed(2);
    }
    if (name === 'MASTER_EQ_SUB_FREQ') {
        return Math.round(20 + val * 60) + ' Hz';
    }
    if (name === 'MASTER_EQ_KICK_FREQ') {
        return Math.round(80 + val * 120) + ' Hz';
    }
    if (name === 'MASTER_EQ_MID_FREQ') {
        return Math.round(200 + val * 1000) + ' Hz';
    }
    if (name === 'MASTER_EQ_TOP_FREQ') {
        const hz = 1200 + val * 14800;
        return hz >= 1000 ? (hz / 1000).toFixed(1) + ' kHz' : Math.round(hz) + ' Hz';
    }
    if (name === 'SIREN_TYPE') {
        const idx = Math.min(5, Math.floor(val * 6));
        return SIREN_PRESETS[idx] || 'Preset ' + idx;
    }
    // Default percentage
    return Math.round(val * 100) + '%';
}

/**
 * Creates a single styled slider element with label and value readout.
 */
function createPotControl(potIdx, label) {
    const name = POT_NAMES[potIdx];
    const isCentered = isPotCentered(name);
    const defVal = isCentered ? 0.5 : 0.0;
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
        className: 'dev-pot-slider' + (isCentered ? ' centered' : '')
    });

    slider.addEventListener('pointerdown', () => { _activeInteractingPot = potIdx; });
    slider.addEventListener('pointerup', () => {
        _activeInteractingPot = -1;
        sendVirtualPot(potIdx, parseFloat(slider.value), true);
    });

    slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        valLbl.textContent = formatPotValue(name, v);
        sendVirtualPot(potIdx, v, false);
    });

    // Double click snaps back to default (0.5 for centered, 0.0 for others)
    slider.addEventListener('dblclick', () => {
        slider.value = defVal.toString();
        valLbl.textContent = formatPotValue(name, defVal);
        sendVirtualPot(potIdx, defVal, true);
    });

    item.appendChild(slider);

    _potSliders[potIdx] = slider;
    _potValueLabels[potIdx] = valLbl;

    return item;
}

/**
 * Builds the Master & Kills Card.
 */
function buildMasterSection() {
    const card = el('div', { className: 'card dev-section' });
    card.appendChild(cardTitle('Master & Band Kills'));

    // Dub Kill switches row
    const killSection = el('div', { className: 'dev-kill-section' });
    const killTitle = el('div', { className: 'dev-sub-heading' });
    killTitle.textContent = '4-Band Crossover Kills (24 dB/oct)';
    killSection.appendChild(killTitle);

    const killGrid = el('div', { className: 'dev-kill-grid' });
    const killDef = [
        { idx: 0, label: 'SUB (<80Hz)', color: 'sub' },
        { idx: 1, label: 'KICK (80-200Hz)', color: 'kick' },
        { idx: 2, label: 'MID (200-1.2k)', color: 'mid' },
        { idx: 3, label: 'TOP (>1.2kHz)', color: 'top' }
    ];

    killDef.forEach(({ idx, label, color }) => {
        const btn = el('button', {
            type: 'button',
            className: 'dev-kill-btn ' + color
        });
        btn.textContent = label;
        btn.addEventListener('click', () => {
            const ctx = getContext();
            const curState = (ctx.switchStates && ctx.switchStates[idx] > 0.5);
            const newState = !curState;
            btn.classList.toggle('active', newState);
            sendVirtualSwitch(idx, newState);
        });
        _switchButtons[idx] = btn;
        killGrid.appendChild(btn);
    });
    killSection.appendChild(killGrid);
    card.appendChild(killSection);

    // Master Volume & Band Trim row
    const masterGrid = el('div', { className: 'dev-grid-2col' });

    const masterCol = el('div', { className: 'dev-sub-panel' });
    masterCol.appendChild(el('div', { className: 'dev-sub-heading', textContent: 'Master Volume' }));
    masterCol.appendChild(createPotControl(24, 'Master Gain (OUT 2/3)'));
    masterGrid.appendChild(masterCol);

    const trimCol = el('div', { className: 'dev-sub-panel' });
    trimCol.appendChild(el('div', { className: 'dev-sub-heading', textContent: 'Band Trim (±6 dB)' }));
    const trimPots = el('div', { className: 'dev-pot-grid-2' });
    trimPots.appendChild(createPotControl(37, 'Trim Sub', true));
    trimPots.appendChild(createPotControl(38, 'Trim Kick', true));
    trimPots.appendChild(createPotControl(39, 'Trim Mid', true));
    trimPots.appendChild(createPotControl(40, 'Trim Top', true));
    trimCol.appendChild(trimPots);
    masterGrid.appendChild(trimCol);

    card.appendChild(masterGrid);

    // Master Resonant Filters
    const filterSection = el('div', { className: 'dev-sub-panel' });
    filterSection.appendChild(el('div', { className: 'dev-sub-heading', textContent: 'Master Resonant Filters (Soft-Bypass)' }));
    const filterGrid = el('div', { className: 'dev-pot-grid-2' });
    filterGrid.appendChild(createPotControl(33, 'HPF Cutoff (20Hz - 2kHz)'));
    filterGrid.appendChild(createPotControl(34, 'HPF Resonance (Q 0.7 - 4.5)'));
    filterGrid.appendChild(createPotControl(35, 'LPF Cutoff (200Hz - 20kHz)'));
    filterGrid.appendChild(createPotControl(36, 'LPF Resonance (Q 0.7 - 4.5)'));
    filterSection.appendChild(filterGrid);
    card.appendChild(filterSection);

    return card;
}

/**
 * Builds the 4 AUX Channel Strips Card.
 */
function buildChannelStripsSection() {
    const card = el('div', { className: 'card dev-section' });
    card.appendChild(cardTitle('AUX Channel Strips (1 to 4)'));

    const grid = el('div', { className: 'dev-channels-grid' });

    const auxConfigs = [
        { ch: 1, base: 0 },
        { ch: 2, base: 6 },
        { ch: 3, base: 12 },
        { ch: 4, base: 18 }
    ];

    auxConfigs.forEach(({ ch, base }) => {
        const col = el('div', { className: 'dev-channel-col' });
        const hdr = el('div', { className: 'dev-channel-hdr' });
        hdr.textContent = 'AUX ' + ch;
        col.appendChild(hdr);

        // Gain
        col.appendChild(createPotControl(base + 0, 'Gain In'));

        // 3-Band EQ (in musical order: High -> Mid -> Low)
        const eqBox = el('div', { className: 'dev-eq-box' });
        if (ch === 1 || ch === 2) {
            // Note: in POT_NAMES:
            // AUX1: 0=GAIN, 1=MID, 2=LOW, 3=HIGH
            // AUX2: 6=GAIN, 7=MID, 8=HIGH, 9=LOW
            // AUX3: 12=GAIN, 13=LOW, 14=MID, 15=HIGH
            // AUX4: 18=GAIN, 19=LOW, 20=MID, 21=HIGH
            if (ch === 1) {
                eqBox.appendChild(createPotControl(base + 3, 'EQ High', true));
                eqBox.appendChild(createPotControl(base + 1, 'EQ Mid', true));
                eqBox.appendChild(createPotControl(base + 2, 'EQ Low', true));
            } else {
                eqBox.appendChild(createPotControl(base + 2, 'EQ High', true));
                eqBox.appendChild(createPotControl(base + 1, 'EQ Mid', true));
                eqBox.appendChild(createPotControl(base + 3, 'EQ Low', true));
            }
        } else {
            eqBox.appendChild(createPotControl(base + 3, 'EQ High', true));
            eqBox.appendChild(createPotControl(base + 2, 'EQ Mid', true));
            eqBox.appendChild(createPotControl(base + 1, 'EQ Low', true));
        }
        col.appendChild(eqBox);

        // FX Sends
        col.appendChild(createPotControl(base + 4, 'FX 1 Send'));
        col.appendChild(createPotControl(base + 5, 'FX 2 Send'));

        grid.appendChild(col);
    });

    card.appendChild(grid);
    return card;
}

/**
 * Builds the Master Parametric & Graphic EQ Card.
 */
function buildMasterEqSection() {
    const card = el('div', { className: 'card dev-section' });
    card.appendChild(cardTitle('Master Equalizers (Parametric & 12-Band Graphic)'));

    // Parametric EQ 4 sweepable bands
    const peqBox = el('div', { className: 'dev-sub-panel' });
    peqBox.appendChild(el('div', { className: 'dev-sub-heading', textContent: '4-Band Parametric Equalizer (Sweepable Freq ±6 dB)' }));
    const peqGrid = el('div', { className: 'dev-channels-grid' });

    const peqBands = [
        { label: 'SUB (20-80 Hz)', fIdx: 25, gIdx: 26 },
        { label: 'KICK (80-200 Hz)', fIdx: 27, gIdx: 28 },
        { label: 'MID (200-1.2k Hz)', fIdx: 29, gIdx: 30 },
        { label: 'TOP (1.2-16k Hz)', fIdx: 31, gIdx: 32 }
    ];

    peqBands.forEach(({ label, fIdx, gIdx }) => {
        const bCol = el('div', { className: 'dev-channel-col' });
        bCol.appendChild(el('div', { className: 'dev-channel-hdr', textContent: label }));
        bCol.appendChild(createPotControl(fIdx, 'Frequency'));
        bCol.appendChild(createPotControl(gIdx, 'Gain (±6 dB)', true));
        peqGrid.appendChild(bCol);
    });
    peqBox.appendChild(peqGrid);
    card.appendChild(peqBox);

    // Graphic EQ 12 fixed bands
    const geqBox = el('div', { className: 'dev-sub-panel' });
    const geqHdrRow = el('div', { className: 'dev-row-between' });
    geqHdrRow.appendChild(el('div', { className: 'dev-sub-heading', textContent: '12-Band Graphic Equalizer (±12 dB)' }));

    const flatBtn = el('button', {
        type: 'button',
        className: 'dev-small-btn',
        textContent: 'Reset to Flat (0 dB)'
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
        const potIdx = 46 + i;
        geqGrid.appendChild(createPotControl(potIdx, geqLabels[i], true));
    }
    geqBox.appendChild(geqGrid);
    card.appendChild(geqBox);

    return card;
}

/**
 * Builds the FX & Dub Siren Card.
 */
function buildFxAndSirenSection() {
    const card = el('div', { className: 'card dev-section' });
    card.appendChild(cardTitle('Effects & Dub Siren'));

    const grid = el('div', { className: 'dev-grid-2col' });

    // FX Configuration Col
    const fxCol = el('div', { className: 'dev-sub-panel' });
    fxCol.appendChild(el('div', { className: 'dev-sub-heading', textContent: 'FX Sends & Returns' }));

    // FX1 Mode switches
    const fx1Row = el('div', { className: 'dev-fx-mode-row' });
    fx1Row.appendChild(el('span', { className: 'dev-pot-label', textContent: 'FX1 Send Filter:' }));
    const fx1Mids = el('button', { type: 'button', className: 'dev-mode-btn', textContent: 'MIDS (250-4k)' });
    const fx1Tops = el('button', { type: 'button', className: 'dev-mode-btn', textContent: 'TOPS (>4k)' });

    fx1Mids.addEventListener('click', () => {
        const cur = fx1Mids.classList.contains('active');
        fx1Mids.classList.toggle('active', !cur);
        sendVirtualSwitch(4, !cur);
    });
    fx1Tops.addEventListener('click', () => {
        const cur = fx1Tops.classList.contains('active');
        fx1Tops.classList.toggle('active', !cur);
        sendVirtualSwitch(5, !cur);
    });
    _switchButtons[4] = fx1Mids;
    _switchButtons[5] = fx1Tops;
    fx1Row.appendChild(fx1Mids);
    fx1Row.appendChild(fx1Tops);
    fxCol.appendChild(fx1Row);

    // FX2 Mode switches
    const fx2Row = el('div', { className: 'dev-fx-mode-row' });
    fx2Row.appendChild(el('span', { className: 'dev-pot-label', textContent: 'FX2 Send Filter:' }));
    const fx2Mids = el('button', { type: 'button', className: 'dev-mode-btn', textContent: 'MIDS (250-4k)' });
    const fx2Tops = el('button', { type: 'button', className: 'dev-mode-btn', textContent: 'TOPS (>4k)' });

    fx2Mids.addEventListener('click', () => {
        const cur = fx2Mids.classList.contains('active');
        fx2Mids.classList.toggle('active', !cur);
        sendVirtualSwitch(7, !cur);
    });
    fx2Tops.addEventListener('click', () => {
        const cur = fx2Tops.classList.contains('active');
        fx2Tops.classList.toggle('active', !cur);
        sendVirtualSwitch(6, !cur);
    });
    _switchButtons[7] = fx2Mids;
    _switchButtons[6] = fx2Tops;
    fx2Row.appendChild(fx2Mids);
    fx2Row.appendChild(fx2Tops);
    fxCol.appendChild(fx2Row);

    // FX Returns
    fxCol.appendChild(createPotControl(58, 'FX 1 Return Gain (IN 0)'));
    fxCol.appendChild(createPotControl(59, 'FX 2 Return Gain (IN 1)'));
    grid.appendChild(fxCol);

    // Dub Siren Col
    const sirenCol = el('div', { className: 'dev-sub-panel' });
    sirenCol.appendChild(el('div', { className: 'dev-sub-heading', textContent: 'Monophonic Dub Siren' }));

    sirenCol.appendChild(createPotControl(41, 'Siren Type (Preset)'));
    sirenCol.appendChild(createPotControl(42, 'Modulation LFO'));
    sirenCol.appendChild(createPotControl(43, 'Siren Gain'));
    sirenCol.appendChild(createPotControl(44, 'Siren FX 1 Send'));
    sirenCol.appendChild(createPotControl(45, 'Siren FX 2 Send'));

    // Siren Trigger interactive controls
    const triggerBox = el('div', { className: 'dev-siren-trigger-box' });
    const trigBtn = el('button', {
        type: 'button',
        className: 'dev-siren-trig-btn',
        textContent: 'TRIGGER SIREN (Hold)'
    });

    const triggerOn = (e) => {
        e.preventDefault();
        trigBtn.classList.add('firing');
        sendVirtualSwitch(8, true);
    };
    const triggerOff = (e) => {
        e.preventDefault();
        trigBtn.classList.remove('firing');
        sendVirtualSwitch(8, false);
    };

    trigBtn.addEventListener('mousedown', triggerOn);
    window.addEventListener('mouseup', triggerOff);
    trigBtn.addEventListener('touchstart', triggerOn, { passive: false });
    window.addEventListener('touchend', triggerOff, { passive: false });

    const latchBtn = el('button', {
        type: 'button',
        className: 'dev-siren-latch-btn',
        textContent: 'Continuous Latch'
    });
    latchBtn.addEventListener('click', () => {
        const isFiring = latchBtn.classList.toggle('active');
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

/**
 * Builds the full Dev Control tab pane.
 */
export function buildDevControlPane() {
    const pane = el('div', {
        id: 'pane-dev',
        className: 'tab-pane'
    });

    // 1. Top Control Banner
    const banner = el('div', { className: 'card dev-banner', id: 'dev-mode-banner' });
    _devModeBannerEl = banner;

    const bannerTop = el('div', { className: 'dev-banner-top' });

    const titleDiv = el('div', { className: 'dev-banner-title-box' });
    const title = el('h2', { className: 'dev-banner-title', textContent: 'Virtual Control Mode (Development Mode)' });
    const desc = el('p', { className: 'dev-mode-desc' });
    titleDiv.appendChild(title);
    titleDiv.appendChild(desc);
    bannerTop.appendChild(titleDiv);

    const toggleBtn = el('button', {
        type: 'button',
        id: 'dev-mode-toggle-btn',
        className: 'dev-toggle-btn'
    });
    toggleBtn.addEventListener('click', () => {
        const ctx = getContext();
        sendUiDevMode(!ctx.uiDevMode);
    });
    _devModeToggleBtn = toggleBtn;
    bannerTop.appendChild(toggleBtn);

    banner.appendChild(bannerTop);

    // Action buttons row
    const actionsRow = el('div', { className: 'dev-actions-row' });

    const resetBtn = el('button', {
        type: 'button',
        className: 'dev-action-btn',
        textContent: 'Reset to Default Values'
    });
    resetBtn.addEventListener('click', () => {
        sendVirtualReset();
        // Optimistically apply defaults to UI: centered -> 0.5, all others -> 0.0
        for (let i = 0; i < POT_NAMES.length; i++) {
            const name = POT_NAMES[i];
            const defVal = isPotCentered(name) ? 0.5 : 0.0;
            if (_potSliders[i]) _potSliders[i].value = defVal.toString();
            if (_potValueLabels[i]) _potValueLabels[i].textContent = formatPotValue(name, defVal);
        }
        for (let i = 0; i < SWITCH_NAMES.length; i++) {
            if (_switchButtons[i]) _switchButtons[i].classList.remove('active', 'firing');
        }
    });
    actionsRow.appendChild(resetBtn);

    const muteBtn = el('button', {
        type: 'button',
        className: 'dev-action-btn',
        textContent: 'Mute Master (0%)'
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
        textContent: 'Disable All Kills'
    });
    unkillBtn.addEventListener('click', () => {
        for (let i = 0; i < 4; i++) {
            if (_switchButtons[i]) _switchButtons[i].classList.remove('active');
            sendVirtualSwitch(i, false);
        }
    });
    actionsRow.appendChild(unkillBtn);

    banner.appendChild(actionsRow);
    pane.appendChild(banner);

    // 2. Interactive Sections Container
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

/**
 * Called periodically from draw() to reflect live pot and switch values
 * into the Dev Control tab when the user is not actively dragging.
 */
export function updateDevControlsLive() {
    const ctx = getContext();
    if (!ctx || !ctx.uiDevMode) return;

    // Only update UI if we have pot values
    if (ctx.potValues && ctx.potValues.length >= POT_NAMES.length) {
        for (let i = 0; i < POT_NAMES.length; i++) {
            if (i === _activeInteractingPot) continue; // Don't fight active touch/mouse
            const val = ctx.potValues[i];
            const slider = _potSliders[i];
            const valLbl = _potValueLabels[i];
            if (slider && Math.abs(parseFloat(slider.value) - val) > 0.005) {
                slider.value = val.toString();
                if (valLbl) valLbl.textContent = formatPotValue(POT_NAMES[i], val);
            }
        }
    }

    // Switches reflection
    if (ctx.switchStates && ctx.switchStates.length >= SWITCH_NAMES.length) {
        for (let i = 0; i < SWITCH_NAMES.length; i++) {
            const btn = _switchButtons[i];
            if (!btn) continue;
            const isOn = ctx.switchStates[i] > 0.5;
            if (i === 8) {
                // Siren trigger
                btn.classList.toggle('active', isOn);
            } else {
                btn.classList.toggle('active', isOn);
            }
        }
    }
}
