/** Live tab: configurable dashboard tiles (siren, mic, meters, …). */
import { getContext } from '../context.js';
import {
    SIREN_PRESETS, CONFIG_META, MIC_HPF_HZ_MIN, MIC_HPF_HZ_MAX,
    LIVE_TILES, TAB_LIVE
} from '../config.js';
import { loadLiveLayout, saveLiveLayout, isLiveTileOn } from '../live-layout.js';
import { el, cardTitle } from './utils.js';
import { buildMetersSection, startMeterAnim, stopMeterAnim } from './meters.js';
import { buildConsoleCard, buildSwitchesCard } from './console.js';
import { buildMasterEqCard, drawMasterEqCurve } from './masterEq.js';

/** AUX1–4 live controls — handles for sync from configMeta (buffer 6). */
const _micRows = [null, null, null, null];
const _hpfDebounceTimers = [null, null, null, null];
/** After a local edit, ignore buffer-6 sync until Bela meta catches up (or timeout). */
const _micSyncHoldUntil = [0, 0, 0, 0];
const _hpfSyncHoldUntil = [0, 0, 0, 0];
const HPF_DEBOUNCE_MS = 150;
/** Must exceed Bela static buffer resend (~2 s @ 20 fps / divisor 40). */
const MIC_SYNC_HOLD_MS = 2500;

let _liveBoard = null;
let _layoutPanel = null;

/** Marks one AUX mic/hpf as locally authoritative for a short window. */
function _holdMicSync(idx, kind) {
    const until = Date.now() + MIC_SYNC_HOLD_MS;
    if (kind === 'mic' || kind === 'both') _micSyncHoldUntil[idx] = until;
    if (kind === 'hpf' || kind === 'both') _hpfSyncHoldUntil[idx] = until;
}

/** Returns true when Bela.control WebSocket is open. */
function _belaControlReady() {
    /* global Bela */
    return typeof Bela !== 'undefined' &&
           Bela.control &&
           Bela.control.ws &&
           Bela.control.ws.readyState === 1;
}

/**
 * Sends a custom control payload to render.cpp via Bela.control.
 * @param {object} payload
 * @param {string} desc
 * @param {Element|null} statusEl
 */
function _sendMicControl(payload, desc, statusEl) {
    if (!_belaControlReady()) {
        if (statusEl) {
            statusEl.textContent = 'Bela not connected — project must be running';
            statusEl.className = 'mic-live-status err';
        }
        return;
    }
    /* global Bela */
    Bela.control.send(payload);
    if (statusEl) {
        statusEl.textContent = `Live: ${desc} (lost on Bela restart)`;
        statusEl.className = 'mic-live-status ok';
    }
}

/** Builds the Siren status card. */
export function buildSirenCard() {
    const sirenCard = el('div', {className: 'card live-tile'});
    sirenCard.dataset.tile = 'siren';
    sirenCard.appendChild(cardTitle('Siren'));

    const sirenBody = el('div', {id: 'siren-body'});

    const hero = el('div', {id: 'siren-hero'});
    hero.innerHTML = `
        <div id="siren-hero-top">
            <div id="siren-name">—</div>
            <div id="siren-gate">
                <span id="siren-gate-dot"></span>
                <span class="gate-lbl">Gate</span>
            </div>
        </div>
        <div id="siren-mod-row">
            <span class="siren-mod-label">Mod</span>
            <div id="siren-mod-track"><div id="siren-mod-fill"></div></div>
            <span id="siren-mod-lbl">0%</span>
        </div>
    `;
    sirenBody.appendChild(hero);

    const presetsDiv = el('div', {id: 'siren-presets'});
    getContext().sirenPresetPills = [];
    SIREN_PRESETS.forEach((name) => {
        const pill = el('div', {className: 'spreset'});
        pill.textContent = name;
        pill.title = name;
        presetsDiv.appendChild(pill);
        getContext().sirenPresetPills.push(pill);
    });
    sirenBody.appendChild(presetsDiv);
    sirenCard.appendChild(sirenBody);

    getContext().sirenNameEl  = hero.querySelector('#siren-name');
    getContext().sirenGateEl  = hero.querySelector('#siren-gate-dot');
    getContext().sirenModFill = hero.querySelector('#siren-mod-fill');
    getContext().sirenModLbl  = hero.querySelector('#siren-mod-lbl');

    return sirenCard;
}

/**
 * Builds the Live "Mic inputs" card: Mic toggle + HPF Hz per AUX1–4.
 * Changes are sent via Bela.control (immediate DSP, lost on Bela restart).
 */
export function buildMicInputsCard() {
    const card = el('div', {
        className: 'card live-tile',
        id: 'mic-inputs-card'
    });
    card.dataset.tile = 'mic';
    card.appendChild(cardTitle('Mic inputs'));

    const note = el('div', {className: 'mic-live-note'});
    note.textContent =
        'Mic bypasses ParamEQ / filters / kills. HPF Hz cuts subs (0 = off). Live — lost on restart.';
    card.appendChild(note);

    const statusEl = el('div', {className: 'mic-live-status'});
    statusEl.textContent = 'Waiting for Bela.control…';
    card.appendChild(statusEl);
    getContext().micLiveStatusEl = statusEl;

    const list = el('div', {className: 'mic-live-list'});
    for (let i = 0; i < 4; ++i) {
        const auxN = i + 1;
        const row = el('div', {className: 'mic-live-row'});

        const label = el('span', {className: 'mic-live-label'});
        label.textContent = 'AUX' + auxN;

        const micWrap = el('label', {className: 'mic-toggle'});
        const micCb = el('input', {type: 'checkbox', className: 'mic-toggle-input'});
        micCb.title = 'Mic mode';
        const track = el('span', {className: 'mic-toggle-track', 'aria-hidden': 'true'});
        track.appendChild(el('span', {className: 'mic-toggle-thumb'}));
        const micLbl = el('span', {className: 'mic-toggle-text'});
        micLbl.textContent = 'Mic';
        micWrap.appendChild(micCb);
        micWrap.appendChild(track);
        micWrap.appendChild(micLbl);

        const hpfWrap = el('label', {className: 'mic-live-hpf'});
        const hpfLbl = el('span');
        hpfLbl.textContent = 'HPF';
        const hpfInp = el('input', {
            type: 'number',
            min: String(MIC_HPF_HZ_MIN),
            max: String(MIC_HPF_HZ_MAX),
            step: '1',
            value: '0'
        });
        hpfInp.title = 'Mic HPF Hz (0 = off)';
        const hpfUnit = el('span', {className: 'mic-live-hpf-unit'});
        hpfUnit.textContent = 'Hz';
        hpfWrap.appendChild(hpfLbl);
        hpfWrap.appendChild(hpfInp);
        hpfWrap.appendChild(hpfUnit);

        micCb.addEventListener('change', () => {
            _holdMicSync(i, 'mic');
            _sendMicControl(
                { event: 'custom', auxMic: auxN, mic: !!micCb.checked },
                `AUX${auxN} mic ${micCb.checked ? 'on' : 'off'}`,
                statusEl
            );
        });

        const sendHpf = () => {
            let hz = parseFloat(hpfInp.value);
            if (isNaN(hz) || hz < 0) hz = 0;
            hz = Math.min(MIC_HPF_HZ_MAX, Math.max(MIC_HPF_HZ_MIN, Math.round(hz)));
            hpfInp.value = String(hz);
            _holdMicSync(i, 'hpf');
            _sendMicControl(
                { event: 'custom', auxHpf: auxN, hpf: hz },
                `AUX${auxN} HPF ${hz} Hz`,
                statusEl
            );
        };

        hpfInp.addEventListener('change', sendHpf);
        hpfInp.addEventListener('input', () => {
            if (_hpfDebounceTimers[i]) clearTimeout(_hpfDebounceTimers[i]);
            _hpfDebounceTimers[i] = setTimeout(sendHpf, HPF_DEBOUNCE_MS);
        });

        row.appendChild(label);
        row.appendChild(micWrap);
        row.appendChild(hpfWrap);
        list.appendChild(row);

        _micRows[i] = {
            micCb,
            hpfInp,
            setMic(on) {
                if (micCb.checked === !!on) return;
                micCb.checked = !!on;
            },
            setHpf(hz) {
                const n = Math.round(hz);
                if (String(hpfInp.value) === String(n)) return;
                if (document.activeElement === hpfInp) return;
                hpfInp.value = String(n);
            }
        };
    }
    card.appendChild(list);

    const poll = setInterval(() => {
        if (_belaControlReady()) {
            statusEl.textContent = 'Live — lost on Bela restart';
            statusEl.className = 'mic-live-status ok';
            clearInterval(poll);
        }
    }, 500);

    return card;
}

/** Builds meters section wrapped as a live tile. */
function buildMetersTile() {
    const wrap = buildMetersSection();
    wrap.classList.add('live-tile');
    wrap.dataset.tile = 'meters';
    return wrap;
}

/** Builds the Layout settings panel (checkboxes). */
function buildLayoutPanel(prefs) {
    const panel = el('div', {
        id: 'live-layout-panel',
        className: 'live-layout-panel',
        hidden: true
    });
    const title = el('div', {className: 'live-layout-title'});
    title.textContent = 'Live layout';
    panel.appendChild(title);

    const hint = el('p', {className: 'live-layout-hint'});
    hint.textContent = 'Choose which tiles appear on Live. Saved in this browser.';
    panel.appendChild(hint);

    const list = el('div', {className: 'live-layout-list'});
    LIVE_TILES.forEach(tile => {
        const row = el('label', {className: 'live-layout-row'});
        const cb = el('input', {type: 'checkbox'});
        cb.checked = isLiveTileOn(prefs, tile.id);
        cb.dataset.tileId = tile.id;
        cb.addEventListener('change', () => {
            const p = getContext().liveLayoutPrefs;
            p[tile.id] = cb.checked;
            saveLiveLayout(p);
            renderLiveBoard();
        });
        const lbl = el('span');
        lbl.textContent = tile.label;
        row.appendChild(cb);
        row.appendChild(lbl);
        list.appendChild(row);
    });
    panel.appendChild(list);
    return panel;
}

/** Rebuilds the Live board from current layout prefs. */
export function renderLiveBoard() {
    if (!_liveBoard) return;
    const prefs = getContext().liveLayoutPrefs;
    const hadMeters = (getContext().meterVu || []).some(Boolean);

    _liveBoard.innerHTML = '';

    // Drop disconnected master-eq / console nodes from a previous Live mount.
    if (getContext().masterEqTargets) {
        getContext().masterEqTargets = getContext().masterEqTargets.filter(
            t => t.canvas && t.canvas.isConnected
        );
    }
    getContext().consoleLists =
        (getContext().consoleLists || []).filter(l => l.isConnected);
    getContext().consoleFilterBtns =
        (getContext().consoleFilterBtns || []).filter(b => b.isConnected);

    const showSiren = isLiveTileOn(prefs, 'siren');
    const showMic   = isLiveTileOn(prefs, 'mic');

    if (showSiren || showMic) {
        const grid = el('div', {id: 'live-grid'});
        if (showSiren) grid.appendChild(buildSirenCard());
        if (showMic)   grid.appendChild(buildMicInputsCard());
        if (showSiren !== showMic)
            grid.classList.add('live-grid-single');
        _liveBoard.appendChild(grid);
    }

    if (isLiveTileOn(prefs, 'meters'))
        _liveBoard.appendChild(buildMetersTile());
    if (isLiveTileOn(prefs, 'switches'))
        _liveBoard.appendChild(buildSwitchesCard());
    if (isLiveTileOn(prefs, 'console'))
        _liveBoard.appendChild(buildConsoleCard('live-console-list'));
    if (isLiveTileOn(prefs, 'masterEq')) {
        _liveBoard.appendChild(buildMasterEqCard({
            canvasId: 'live-master-eq-canvas'
        }));
        drawMasterEqCurve();
    }

    const hasMeters = isLiveTileOn(prefs, 'meters');
    if (getContext().currentTab === TAB_LIVE) {
        if (hasMeters) {
            getContext().meterVu.forEach(vu => { if (vu) vu.resize(); });
            startMeterAnim();
        } else if (hadMeters) {
            stopMeterAnim();
            getContext().meterVu = [];
        }
    }
}

/** Builds the Live tab with layout toolbar + configurable tiles. */
export function buildLivePane() {
    const pane = el('div', {id: 'pane-live', className: 'tab-pane active'});

    const prefs = loadLiveLayout();
    getContext().liveLayoutPrefs = prefs;

    const toolbar = el('div', {id: 'live-toolbar'});
    const layoutBtn = el('button', {
        type: 'button',
        id: 'live-layout-btn',
        className: 'live-layout-btn',
        title: 'Choose Live tiles'
    });
    layoutBtn.textContent = 'Layout';
    layoutBtn.addEventListener('click', () => {
        if (!_layoutPanel) return;
        const open = _layoutPanel.hasAttribute('hidden');
        if (open) _layoutPanel.removeAttribute('hidden');
        else _layoutPanel.setAttribute('hidden', '');
        layoutBtn.classList.toggle('active', open);
    });
    toolbar.appendChild(layoutBtn);
    pane.appendChild(toolbar);

    _layoutPanel = buildLayoutPanel(prefs);
    pane.appendChild(_layoutPanel);

    _liveBoard = el('div', {id: 'live-board'});
    pane.appendChild(_liveBoard);
    renderLiveBoard();

    return pane;
}

/**
 * Syncs Live mic/HPF controls from configMeta buffer 6 (no send back to Bela).
 * @param {Float32Array|ArrayLike<number>} meta
 */
export function syncMicInputs(meta) {
    if (!meta || meta.length <= CONFIG_META.HPF_AUX4) return;
    const M = CONFIG_META;
    const now = Date.now();
    const micKeys = [M.MIC_AUX1, M.MIC_AUX2, M.MIC_AUX3, M.MIC_AUX4];
    const hpfKeys = [M.HPF_AUX1, M.HPF_AUX2, M.HPF_AUX3, M.HPF_AUX4];
    for (let i = 0; i < 4; ++i) {
        const row = _micRows[i];
        if (!row) continue;

        const remoteMic = meta[micKeys[i]] > 0.5;
        const remoteHpf = meta[hpfKeys[i]] != null ? meta[hpfKeys[i]] : 0;

        if (now < _micSyncHoldUntil[i]) {
            if (row.micCb.checked === remoteMic)
                _micSyncHoldUntil[i] = 0;
        } else {
            row.setMic(remoteMic);
        }

        if (now < _hpfSyncHoldUntil[i]) {
            if (Math.round(Number(row.hpfInp.value)) === Math.round(remoteHpf))
                _hpfSyncHoldUntil[i] = 0;
        } else {
            row.setHpf(remoteHpf);
        }
    }
}

/** Updates siren hero / presets from sirenState buffer. */
export function updateSiren() {
    if (!getContext().sirenPresetPills || !getContext().sirenPresetPills.length)
        return;
    const idx  = Math.max(0, Math.min(Math.round(getContext().sirenState[0]), SIREN_PRESETS.length - 1));
    const gate = getContext().sirenState[1] > 0.5;
    const mod  = getContext().sirenState[2];

    getContext().sirenPresetPills.forEach((pill, i) => {
        const isActive = (i === idx);
        pill.className = 'spreset' + (isActive ? ' active' : '') + (isActive && gate ? ' gate' : '');
    });

    if (getContext().sirenNameEl)  getContext().sirenNameEl.textContent  = SIREN_PRESETS[idx];
    if (getContext().sirenGateEl)  getContext().sirenGateEl.className     = gate ? 'on' : '';
    if (getContext().sirenModFill) getContext().sirenModFill.style.width  = (mod * 100).toFixed(1) + '%';
    if (getContext().sirenModLbl)  getContext().sirenModLbl.textContent   = Math.round(mod * 100) + '%';
}
