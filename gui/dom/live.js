/** Live tab: siren, console, mic inputs, switches. */
import { getContext } from '../context.js';
import {
    SIREN_PRESETS, SWITCH_GROUPS, SWITCH_NAMES, POT_NAMES,
    CONSOLE_POT_MIN_DELTA_NORMAL, CONSOLE_POT_MIN_DELTA_DETAILED, MAX_CONSOLE,
    MUX_POTS_PER_MUX, CONFIG_META, MIC_HPF_HZ_MIN, MIC_HPF_HZ_MAX
} from '../config.js';
import { el, cardTitle } from './utils.js';
import {
    muxRawIndex, getActiveMuxCount, isPotIgnored, isPotMapped, formatUnmappedPotLabel
} from './mapping.js';

/** AUX1–4 live controls — handles for sync from configMeta (buffer 6). */
const _micRows = [null, null, null, null];
const _hpfDebounceTimers = [null, null, null, null];
/** After a local edit, ignore buffer-6 sync until Bela meta catches up (or timeout). */
const _micSyncHoldUntil = [0, 0, 0, 0];
const _hpfSyncHoldUntil = [0, 0, 0, 0];
const HPF_DEBOUNCE_MS = 150;
/** Must exceed Bela static buffer resend (~2 s @ 20 fps / divisor 40). */
const MIC_SYNC_HOLD_MS = 2500;

/** Marks one AUX mic/hpf as locally authoritative for a short window. */
function _holdMicSync(idx, kind) {
    const until = Date.now() + MIC_SYNC_HOLD_MS;
    if(kind === 'mic' || kind === 'both') _micSyncHoldUntil[idx] = until;
    if(kind === 'hpf' || kind === 'both') _hpfSyncHoldUntil[idx] = until;
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
    if(!_belaControlReady()) {
        if(statusEl) {
            statusEl.textContent = 'Bela not connected — project must be running';
            statusEl.className = 'mic-live-status err';
        }
        return;
    }
    /* global Bela */
    Bela.control.send(payload);
    if(statusEl) {
        statusEl.textContent = `Live: ${desc} (lost on Bela restart)`;
        statusEl.className = 'mic-live-status ok';
    }
}

export function buildLivePane() {
    const pane = el('div', {id:'pane-live', className:'tab-pane active'});
    const grid = el('div', {id:'live-grid'});

    // Siren card
    const sirenCard = el('div', {className:'card'});
    sirenCard.appendChild(cardTitle('Siren'));

    const sirenBody = el('div', {id:'siren-body'});

    const hero = el('div', {id:'siren-hero'});
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

    const presetsDiv = el('div', {id:'siren-presets'});
    getContext().sirenPresetPills = [];
    SIREN_PRESETS.forEach((name) => {
        const pill = el('div', {className:'spreset'});
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

    // Console card
    const consoleCard = el('div', {className:'card'});
    const consoleHdr = el('div', {className:'console-header'});
    consoleHdr.appendChild(cardTitle('Console — last change'));
    const filterBar = el('div', {className:'console-filter'});
    getContext().consoleFilterBtns = [];
    [
        { mode: 'normal',   label: 'Normal'   },
        { mode: 'detailed', label: 'Détaillé' }
    ].forEach(({ mode, label }) => {
        const btn = el('button', {
            type: 'button',
            className: 'console-filter-btn' + (mode === getContext().consoleFilterMode ? ' active' : '')
        });
        btn.textContent = label;
        btn.dataset.mode = mode;
        btn.addEventListener('click', () => setConsoleFilterMode(mode));
        filterBar.appendChild(btn);
        getContext().consoleFilterBtns.push(btn);
    });
    consoleHdr.appendChild(filterBar);
    consoleCard.appendChild(consoleHdr);
    getContext().consoleList = el('ul', {id:'console-list'});
    consoleCard.appendChild(getContext().consoleList);
    renderConsole();

    grid.appendChild(sirenCard);
    grid.appendChild(consoleCard);
    grid.appendChild(buildMicInputsCard());
    pane.appendChild(grid);

    // Switches card (full width below grid)
    const swCard = el('div', {className:'card'});
    swCard.appendChild(cardTitle('Switches'));
    const swGrid = el('div', {className:'sw-grid'});
    getContext().switchPills = [];

    SWITCH_GROUPS.forEach(group => {
        const grp = el('div', {className:'sw-group sw-group-' + group.type});
        const gtitle = el('div', {className:'sw-group-title'});
        gtitle.textContent = group.label;
        grp.appendChild(gtitle);

        const items = el('div', {className:'sw-group-items'});
        group.indices.forEach(i => {
            items.appendChild(buildSwitchTile(i, SWITCH_NAMES[i], group.type));
        });
        grp.appendChild(items);
        swGrid.appendChild(grp);
    });

    swCard.appendChild(swGrid);
    pane.appendChild(swCard);

    return pane;
}

/**
 * Builds the Live "Mic inputs" card: Mic toggle + HPF Hz per AUX1–4.
 * Changes are sent via Bela.control (immediate DSP, lost on Bela restart).
 */
function buildMicInputsCard() {
    const card = el('div', {className: 'card', id: 'mic-inputs-card'});
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
    for(let i = 0; i < 4; ++i) {
        const auxN = i + 1;
        const row = el('div', {className: 'mic-live-row'});

        const label = el('span', {className: 'mic-live-label'});
        label.textContent = 'AUX' + auxN;

        // Custom switch toggle (checkbox visually hidden)
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
            if(isNaN(hz) || hz < 0) hz = 0;
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
            if(_hpfDebounceTimers[i]) clearTimeout(_hpfDebounceTimers[i]);
            _hpfDebounceTimers[i] = setTimeout(sendHpf, HPF_DEBOUNCE_MS);
        });

        row.appendChild(label);
        row.appendChild(micWrap);
        row.appendChild(hpfWrap);
        list.appendChild(row);

        _micRows[i] = {
            micCb,
            hpfInp,
            /** Silent UI update from Bela buffer 6 (no control send). */
            setMic(on) {
                if(micCb.checked === !!on) return;
                micCb.checked = !!on;
            },
            setHpf(hz) {
                const n = Math.round(hz);
                if(String(hpfInp.value) === String(n)) return;
                if(document.activeElement === hpfInp) return;
                hpfInp.value = String(n);
            }
        };
    }
    card.appendChild(list);

    const poll = setInterval(() => {
        if(_belaControlReady()) {
            statusEl.textContent = 'Live — lost on Bela restart';
            statusEl.className = 'mic-live-status ok';
            clearInterval(poll);
        }
    }, 500);

    return card;
}

/**
 * Syncs Live mic/HPF controls from configMeta buffer 6 (no send back to Bela).
 * Skips fields recently edited locally so stale meta cannot flicker the UI.
 * @param {Float32Array|ArrayLike<number>} meta
 */
export function syncMicInputs(meta) {
    if(!meta || meta.length <= CONFIG_META.HPF_AUX4) return;
    const M = CONFIG_META;
    const now = Date.now();
    const micKeys = [M.MIC_AUX1, M.MIC_AUX2, M.MIC_AUX3, M.MIC_AUX4];
    const hpfKeys = [M.HPF_AUX1, M.HPF_AUX2, M.HPF_AUX3, M.HPF_AUX4];
    for(let i = 0; i < 4; ++i) {
        const row = _micRows[i];
        if(!row) continue;

        const remoteMic = meta[micKeys[i]] > 0.5;
        const remoteHpf = meta[hpfKeys[i]] != null ? meta[hpfKeys[i]] : 0;

        if(now < _micSyncHoldUntil[i]) {
            if(row.micCb.checked === remoteMic)
                _micSyncHoldUntil[i] = 0;
        } else {
            row.setMic(remoteMic);
        }

        if(now < _hpfSyncHoldUntil[i]) {
            if(Math.round(Number(row.hpfInp.value)) === Math.round(remoteHpf))
                _hpfSyncHoldUntil[i] = 0;
        } else {
            row.setHpf(remoteHpf);
        }
    }
}

/** Returns a short display label for a switch name. */
export function switchDisplayName(name) {
    if(name.indexOf('KILL_') === 0) return name.slice(5);
    if(name === 'FX_FILTER_MIDS')  return 'FX1 MIDS';
    if(name === 'FX_FILTER_TOPS') return 'FX1 TOPS';
    if(name === 'FX2_FILTER_TOPS') return 'FX2 TOPS';
    if(name === 'FX2_FILTER_MIDS') return 'FX2 MIDS';
    if(name === 'SIREN_TRIGGER') return 'GATE';
    return name.replace(/_/g, ' ');
}

/** Builds one switch status tile with LED indicator. */
export function buildSwitchTile(index, name, type) {
    const tile = el('div', {className:'sw-tile sw-tile-' + type});
    const led  = el('div', {className:'sw-led'});
    const lbl  = el('span', {className:'sw-tile-name'});
    lbl.textContent = switchDisplayName(name);
    tile.appendChild(led);
    tile.appendChild(lbl);
    getContext().switchPills[index] = tile;
    return tile;
}

export function updateSiren() {
    const idx  = Math.max(0, Math.min(Math.round(getContext().sirenState[0]), SIREN_PRESETS.length - 1));
    const gate = getContext().sirenState[1] > 0.5;
    const mod  = getContext().sirenState[2];

    getContext().sirenPresetPills.forEach((pill, i) => {
        const isActive = (i === idx);
        pill.className = 'spreset' + (isActive ? ' active' : '') + (isActive && gate ? ' gate' : '');
    });

    if(getContext().sirenNameEl)  getContext().sirenNameEl.textContent  = SIREN_PRESETS[idx];
    if(getContext().sirenGateEl)  getContext().sirenGateEl.className     = gate ? 'on' : '';
    if(getContext().sirenModFill) getContext().sirenModFill.style.width  = (mod * 100).toFixed(1) + '%';
    if(getContext().sirenModLbl)  getContext().sirenModLbl.textContent   = Math.round(mod * 100) + '%';
}

/** Resyncs pot baselines from current live values. */
export function syncConsolePotBaselines() {
    getContext().prevPotValues.set(getContext().potValues);
    getContext().prevPotValuesNormal.set(getContext().potValues);
    if(getContext().muxRawValues && getContext().prevMuxRawValues) {
        getContext().prevMuxRawValues.set(getContext().muxRawValues);
        getContext().prevMuxRawValuesNormal.set(getContext().muxRawValues);
    }
}

/** Switches console filter mode and clears stale entries. */
export function setConsoleFilterMode(mode) {
    if(mode !== 'normal' && mode !== 'detailed') return;
    if(mode === getContext().consoleFilterMode) return;
    getContext().consoleFilterMode = mode;
    getContext().consoleFilterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    getContext().recentChanges = [];
    syncConsolePotBaselines();
    renderConsole();
}

/** Builds one console row — filled from entry or empty placeholder slot. */
export function buildConsoleRow(entry, slot) {
    const isSw    = entry && entry.type === 'sw';
    const isEmpty = !entry;
    const li = el('li', {className: 'crow' + (isEmpty ? ' empty' : (isSw ? ' sw' : ''))});
    if(isEmpty) li.style.setProperty('--slot', String(slot));
    const pct  = entry ? Math.min(100, Math.max(0, entry.value * 100)).toFixed(1) : '0';
    const cval = entry ? entry.value.toFixed(3) : '\u00a0';
    const cname = entry ? entry.name : '\u00a0';
    const fillCls = isEmpty ? 'cfill cfill-loading' : 'cfill';
    const fillStyle = isEmpty ? '' : ` style="width:${pct}%"`;
    li.innerHTML =
        `<span class="cname">${cname}</span>` +
        `<span class="ctrack"><span class="${fillCls}"${fillStyle}></span></span>` +
        `<span class="cval">${cval}</span>`;
    return li;
}

/** Detects changed pots/switches and updates the console. */
export function updateConsole() {
    const now = Date.now();
    let dirty = false;
    const isNormal = getContext().consoleFilterMode === 'normal';
    const potDelta = isNormal ? CONSOLE_POT_MIN_DELTA_NORMAL : CONSOLE_POT_MIN_DELTA_DETAILED;
    const potPrev  = isNormal ? getContext().prevPotValuesNormal : getContext().prevPotValues;

    for(let i = 0; i < POT_NAMES.length; i++) {
        const v = getContext().potValues[i];
        if(Math.abs(v - potPrev[i]) >= potDelta) {
            potPrev[i] = v;
            pushConsoleEntry({name: POT_NAMES[i], value: v, type: 'pot', ts: now});
            dirty = true;
        }
    }
    for(let i = 0; i < SWITCH_NAMES.length; i++) {
        const v = getContext().switchStates[i];
        if(v !== getContext().prevSwitchStates[i]) {
            getContext().prevSwitchStates[i] = v;
            pushConsoleEntry({name: SWITCH_NAMES[i], value: v, type: 'sw', ts: now});
            dirty = true;
        }
    }

    if(getContext().muxRawValues && getContext().prevMuxRawValues && getContext().prevMuxRawValuesNormal) {
        const muxPrev = isNormal ? getContext().prevMuxRawValuesNormal : getContext().prevMuxRawValues;
        const activeMux = getActiveMuxCount();
        for(let m = 0; m < activeMux; m++) {
            for(let p = 0; p < MUX_POTS_PER_MUX; p++) {
                if(isPotIgnored(m, p) || isPotMapped(m, p)) continue;
                const idx = muxRawIndex(m, p);
                const v   = getContext().muxRawValues[idx];
                if(Math.abs(v - muxPrev[idx]) >= potDelta) {
                    muxPrev[idx] = v;
                    pushConsoleEntry({
                        name: formatUnmappedPotLabel(m, p),
                        value: v,
                        type: 'pot',
                        ts: now
                    });
                    dirty = true;
                }
            }
        }
    }

    if(dirty) renderConsole();
}

export function pushConsoleEntry(entry) {
    getContext().recentChanges = getContext().recentChanges.filter(e => e.name !== entry.name);
    getContext().recentChanges.unshift(entry);
    if(getContext().recentChanges.length > MAX_CONSOLE) getContext().recentChanges.length = MAX_CONSOLE;
}

export function renderConsole() {
    if(!getContext().consoleList) return;
    getContext().consoleList.innerHTML = '';
    for(let i = 0; i < MAX_CONSOLE; i++) {
        getContext().consoleList.appendChild(buildConsoleRow(getContext().recentChanges[i] || null, i));
    }
}

/** Updates switch tile states from current getContext().switchStates. */
export function updateSwitches() {
    for(let i = 0; i < SWITCH_NAMES.length; i++) {
        const tile = getContext().switchPills[i];
        if(tile) tile.classList.toggle('on', getContext().switchStates[i] > 0.5);
    }
}
