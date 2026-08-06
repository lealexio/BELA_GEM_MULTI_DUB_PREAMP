/** Live tab: configurable dashboard tiles (siren, mic, meters, …). */
import { getContext } from '../context.js';
import {
    SIREN_PRESETS, CONFIG_META, MIC_HPF_HZ_MIN, MIC_HPF_HZ_MAX,
    LIVE_TILES, TAB_LIVE
} from '../config.js';
import { loadLiveLayout, saveLiveLayout, isLiveTileOn,
    moveLiveTile, orderedLiveTiles
} from '../live-layout.js';
import { belaControlReady } from '../bela/connection.js';
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
let _layoutPopup = null;
let _layoutPanel = null;
let _layoutList = null;
let _layoutGearBtn = null;
let _layoutEscBound = null;

/** Marks one AUX mic/hpf as locally authoritative for a short window. */
function _holdMicSync(idx, kind) {
    const until = Date.now() + MIC_SYNC_HOLD_MS;
    if (kind === 'mic' || kind === 'both') _micSyncHoldUntil[idx] = until;
    if (kind === 'hpf' || kind === 'both') _hpfSyncHoldUntil[idx] = until;
}

/**
 * Sends a custom control payload to render.cpp via Bela.control.
 * @param {object} payload
 */
function _sendMicControl(payload) {
    if (!belaControlReady()) return;
    /* global Bela */
    Bela.control.send(payload);
}

/** Builds the Siren status card. */
function buildSirenCard() {
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
 * Changes are sent via Bela.control (immediate DSP).
 */
function buildMicInputsCard() {
    const card = el('div', {
        className: 'card live-tile',
        id: 'mic-inputs-card'
    });
    card.dataset.tile = 'mic';
    card.appendChild(cardTitle('Mic inputs'));

    const note = el('div', {className: 'mic-live-note'});
    note.textContent =
        'Mic bypasses ParamEQ / filters / kills. HPF Hz cuts subs (0 = off).';
    card.appendChild(note);

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
            _sendMicControl({ event: 'custom', auxMic: auxN, mic: !!micCb.checked });
        });

        const sendHpf = () => {
            let hz = parseFloat(hpfInp.value);
            if (isNaN(hz) || hz < 0) hz = 0;
            hz = Math.min(MIC_HPF_HZ_MAX, Math.max(MIC_HPF_HZ_MIN, Math.round(hz)));
            hpfInp.value = String(hz);
            _holdMicSync(i, 'hpf');
            _sendMicControl({ event: 'custom', auxHpf: auxN, hpf: hz });
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

    return card;
}

/** Builds meters section wrapped as a live tile. */
function buildMetersTile() {
    const wrap = buildMetersSection();
    wrap.classList.add('live-tile');
    wrap.dataset.tile = 'meters';
    return wrap;
}

/** Builds one layout row: checkbox + label + ▲▼. */
function _buildLayoutRow(prefs, tileId, index) {
    const tile = LIVE_TILES.find(t => t.id === tileId);
    if (!tile) return null;

    const row = el('div', {className: 'live-layout-row'});
    const left = el('label', {className: 'live-layout-check'});
    const cb = el('input', {type: 'checkbox'});
    cb.checked = isLiveTileOn(prefs, tile.id);
    cb.addEventListener('change', () => {
        const p = getContext().liveLayoutPrefs;
        p.enabled[tile.id] = cb.checked;
        saveLiveLayout(p);
        renderLiveBoard();
    });
    const lbl = el('span');
    lbl.textContent = tile.label;
    left.appendChild(cb);
    left.appendChild(lbl);

    const moves = el('div', {className: 'live-layout-moves'});
    const up = el('button', {
        type: 'button',
        className: 'live-layout-move',
        title: 'Move up',
        'aria-label': 'Move up'
    });
    up.textContent = '▲';
    up.disabled = index === 0;
    up.addEventListener('click', () => {
        const p = getContext().liveLayoutPrefs;
        if (!moveLiveTile(p, tile.id, -1)) return;
        saveLiveLayout(p);
        rebuildLayoutPanelRows();
        renderLiveBoard();
    });

    const down = el('button', {
        type: 'button',
        className: 'live-layout-move',
        title: 'Move down',
        'aria-label': 'Move down'
    });
    down.textContent = '▼';
    down.disabled = index >= prefs.order.length - 1;
    down.addEventListener('click', () => {
        const p = getContext().liveLayoutPrefs;
        if (!moveLiveTile(p, tile.id, 1)) return;
        saveLiveLayout(p);
        rebuildLayoutPanelRows();
        renderLiveBoard();
    });

    moves.appendChild(up);
    moves.appendChild(down);
    row.appendChild(left);
    row.appendChild(moves);
    return row;
}

/** Rebuilds layout panel rows from current prefs.order. */
function rebuildLayoutPanelRows() {
    if (!_layoutList) return;
    const prefs = getContext().liveLayoutPrefs;
    _layoutList.innerHTML = '';
    prefs.order.forEach((id, i) => {
        const row = _buildLayoutRow(prefs, id, i);
        if (row) _layoutList.appendChild(row);
    });
}

/** Positions the layout popup under the gear button. */
function _positionLayoutPopup() {
    if (!_layoutPanel || !_layoutGearBtn) return;
    const r = _layoutGearBtn.getBoundingClientRect();
    const gap = 8;
    const width = Math.min(300, window.innerWidth - 16);
    let left = r.right - width;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    _layoutPanel.style.top = Math.round(r.bottom + gap) + 'px';
    _layoutPanel.style.left = Math.round(left) + 'px';
    _layoutPanel.style.width = width + 'px';
}

/** Builds the floating Live layout popup (backdrop + panel). */
function buildLayoutPopup() {
    const popup = el('div', {
        id: 'live-layout-popup',
        hidden: true
    });

    const backdrop = el('div', {className: 'live-layout-backdrop'});
    backdrop.addEventListener('click', () => setLiveLayoutPanelOpen(false));

    const panel = el('div', {
        className: 'live-layout-panel',
        role: 'dialog',
        'aria-label': 'Live layout'
    });
    const title = el('div', {className: 'live-layout-title'});
    title.textContent = 'Live layout';
    panel.appendChild(title);

    const hint = el('p', {className: 'live-layout-hint'});
    hint.textContent = 'Show/hide and reorder tiles. Saved in this browser.';
    panel.appendChild(hint);

    _layoutList = el('div', {className: 'live-layout-list'});
    panel.appendChild(_layoutList);
    rebuildLayoutPanelRows();

    popup.appendChild(backdrop);
    popup.appendChild(panel);
    _layoutPanel = panel;
    return popup;
}

/** Opens or closes the Live layout popup; syncs gear active state. */
export function setLiveLayoutPanelOpen(open) {
    if (!_layoutPopup) return;
    if (open) {
        rebuildLayoutPanelRows();
        _layoutPopup.removeAttribute('hidden');
        _positionLayoutPopup();
        if (!_layoutEscBound) {
            _layoutEscBound = (e) => {
                if (e.key === 'Escape') setLiveLayoutPanelOpen(false);
            };
            document.addEventListener('keydown', _layoutEscBound);
        }
        window.addEventListener('resize', _positionLayoutPopup);
    } else {
        _layoutPopup.setAttribute('hidden', '');
        if (_layoutEscBound) {
            document.removeEventListener('keydown', _layoutEscBound);
            _layoutEscBound = null;
        }
        window.removeEventListener('resize', _positionLayoutPopup);
    }
    if (_layoutGearBtn)
        _layoutGearBtn.classList.toggle('active', open);
}

/** Toggles the Live layout popup. Returns whether it is now open. */
export function toggleLiveLayoutPanel() {
    if (!_layoutPopup) return false;
    const open = _layoutPopup.hasAttribute('hidden');
    setLiveLayoutPanelOpen(open);
    return open;
}

/** Registers the tab-bar gear button that toggles the layout popup. */
export function setLiveLayoutGearButton(btn) {
    _layoutGearBtn = btn;
}

/** Mounts a single tile (or paired siren/mic grid) onto the board. */
function _appendTile(board, id, prefs, pairedDone) {
    if (id === 'siren' || id === 'mic') {
        if (pairedDone.done) return;
        const showSiren = isLiveTileOn(prefs, 'siren');
        const showMic = isLiveTileOn(prefs, 'mic');
        if (!showSiren && !showMic) return;
        // Pair both into one grid at the first occurrence in order.
        if (showSiren && showMic) {
            pairedDone.done = true;
            const grid = el('div', {id: 'live-grid'});
            // Preserve relative order of siren vs mic within the pair.
            const firstPair = prefs.order.indexOf('siren') <= prefs.order.indexOf('mic')
                ? 'siren' : 'mic';
            if (firstPair === 'siren') {
                grid.appendChild(buildSirenCard());
                grid.appendChild(buildMicInputsCard());
            } else {
                grid.appendChild(buildMicInputsCard());
                grid.appendChild(buildSirenCard());
            }
            board.appendChild(grid);
            return;
        }
        pairedDone.done = true;
        const grid = el('div', {id: 'live-grid', className: 'live-grid-single'});
        if (showSiren) grid.appendChild(buildSirenCard());
        if (showMic) grid.appendChild(buildMicInputsCard());
        board.appendChild(grid);
        return;
    }
    if (id === 'meters') {
        board.appendChild(buildMetersTile());
        return;
    }
    if (id === 'switches') {
        board.appendChild(buildSwitchesCard());
        return;
    }
    if (id === 'console') {
        board.appendChild(buildConsoleCard('live-console-list'));
        return;
    }
    if (id === 'masterEq') {
        board.appendChild(buildMasterEqCard({
            canvasId: 'live-master-eq-canvas'
        }));
    }
}

/** Schedules a Master EQ redraw after layout (CSS size known). */
function _scheduleMasterEqDraw() {
    if (!isLiveTileOn(getContext().liveLayoutPrefs, 'masterEq')) return;
    requestAnimationFrame(() => {
        if (!isLiveTileOn(getContext().liveLayoutPrefs, 'masterEq')) return;
        drawMasterEqCurve();
    });
}

/** Rebuilds the Live board from current layout prefs (order + enabled). */
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

    const pairedDone = { done: false };
    orderedLiveTiles(prefs).forEach(id => {
        _appendTile(_liveBoard, id, prefs, pairedDone);
    });

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

    // Defer until the board is in the document and has a laid-out size.
    _scheduleMasterEqDraw();
}

/** Builds the Live tab with configurable tiles (layout popup mounts on body). */
export function buildLivePane() {
    const pane = el('div', {id: 'pane-live', className: 'tab-pane active'});

    const prefs = loadLiveLayout();
    getContext().liveLayoutPrefs = prefs;

    if (_layoutPopup && _layoutPopup.parentNode)
        _layoutPopup.parentNode.removeChild(_layoutPopup);
    _layoutPopup = buildLayoutPopup();
    document.body.appendChild(_layoutPopup);

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
