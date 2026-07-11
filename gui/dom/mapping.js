/** Mapping tab, auto-detect, config.json export. */
import { getContext } from '../context.js';
import {
    POT_NAMES, SWITCH_NAMES, MUX_POTS_PER_MUX, MUX_RAW_SIZE,
    CONFIG_META, I2C_BUS, DETECT_POT_MIN_DELTA
} from '../config.js';
import { el } from './utils.js';

export function buildMappingPane() {
    const pane = el('div', {id:'pane-mapping', className:'tab-pane'});

    const note = el('div', {id:'mapping-note'});
    note.innerHTML =
        'Current mapping loaded from config.json on the Bela. ' +
        'Edit the values below, then download the file — ' +
        'replace config.json in the project folder and restart. ' +
        '<a href="http://bela.local/" target="_blank" rel="noopener noreferrer">Open Bela IDE</a>';
    pane.appendChild(note);

    const conflicts = el('div', {id:'mapping-conflicts'});
    conflicts.innerHTML = '<strong>Mapping conflicts</strong><ul id="mapping-conflicts-list"></ul>';
    pane.appendChild(conflicts);

    const detectBanner = el('div', {id:'detect-status'});
    pane.appendChild(detectBanner);

    const toolbar = el('div', {id:'mapping-toolbar'});
    const btn = el('button', {id:'btn-download'});
    btn.textContent = 'Download config.json';
    btn.addEventListener('click', downloadConfigJson);
    toolbar.appendChild(btn);

    getContext().downloadStatusEl = el('span', {id:'download-status'});
    toolbar.appendChild(getContext().downloadStatusEl);
    getContext().detectStatusEl = detectBanner;
    pane.appendChild(toolbar);

    // Pots table
    const potTitle = el('div', {className:'msec-title'});
    potTitle.textContent = 'Potentiometers';
    pane.appendChild(potTitle);

    const potWrap = el('div', {className:'mtable-wrap'});
    const potTbl = el('table', {className:'mtable', id:'pot-table'});
    potTbl.innerHTML = `
        <colgroup>
            <col class="col-name">
            <col class="col-num"><col class="col-num">
            <col class="col-check"><col class="col-check">
            <col class="col-detect">
        </colgroup>
        <thead><tr>
            <th>Name</th><th>MUX</th><th>Channel</th>
            <th class="col-check">Reversed</th><th class="col-check">Centered</th>
            <th class="detect-col">Auto detect</th>
        </tr></thead>
        <tbody id="pot-tbody">
            <tr><td colspan="6" class="loading-cell">Waiting for connection…</td></tr>
        </tbody>`;
    potWrap.appendChild(potTbl);
    pane.appendChild(potWrap);

    // Switches table
    const swTitle = el('div', {className:'msec-title'});
    swTitle.textContent = 'Switches (MCP23017)';
    pane.appendChild(swTitle);

    const swWrap = el('div', {className:'mtable-wrap'});
    const swTbl = el('table', {className:'mtable', id:'sw-table'});
    swTbl.innerHTML = `
        <colgroup>
            <col class="col-name">
            <col class="col-num"><col class="col-port">
            <col class="col-check">
            <col class="col-detect">
        </colgroup>
        <thead><tr>
            <th>Name</th><th>Pin</th><th>Port</th>
            <th class="col-check">Reversed</th>
            <th class="detect-col">Auto map</th>
        </tr></thead>
        <tbody id="sw-tbody">
            <tr><td colspan="5" class="loading-cell">Waiting for connection…</td></tr>
        </tbody>`;
    swWrap.appendChild(swTbl);
    pane.appendChild(swWrap);

    return pane;
}


export function tryBuildMappingTable() {
    if(getContext().mappingBuilt || !getContext().potMapping || !getContext().switchMapping) return;
    getContext().mappingBuilt = true;

    const ptbody = document.getElementById('pot-tbody');
    if(ptbody) {
        ptbody.innerHTML = '';
        POT_NAMES.forEach((name, i) => {
            const mux = Math.round(getContext().potMapping[i*4+0]);
            const pot = Math.round(getContext().potMapping[i*4+1]);
            const rev = getContext().potMapping[i*4+2] > 0.5;
            const cen = getContext().potMapping[i*4+3] > 0.5;
            const tr = document.createElement('tr');
            tr.dataset.mapTable = 'pot';
            tr.dataset.mapIndex = String(i);
            tr.innerHTML =
                `<td class="pname" title="${name}">${name}</td>` +
                `<td><input type="number" min="0" max="3"  value="${mux}" ` +
                `data-i="${i}" data-f="mux" class="pi"></td>` +
                `<td><input type="number" min="0" max="15" value="${pot}" ` +
                `data-i="${i}" data-f="pot" class="pi"></td>` +
                `<td class="col-check"><input type="checkbox" ${rev?'checked':''} ` +
                `data-i="${i}" data-f="rev" class="pi"></td>` +
                `<td class="col-check"><input type="checkbox" ${cen?'checked':''} ` +
                `data-i="${i}" data-f="cen" class="pi"></td>` +
                `<td class="detect-cell"></td>`;
            tr.querySelector('.detect-cell').appendChild(createDetectButton('pot', i));
            ptbody.appendChild(tr);
        });
    }

    const stbody = document.getElementById('sw-tbody');
    if(stbody) {
        stbody.innerHTML = '';
        SWITCH_NAMES.forEach((name, i) => {
            const pin   = Math.round(getContext().switchMapping[i*3+0]);
            const portB = getContext().switchMapping[i*3+1] > 0.5;
            const rev   = getContext().switchMapping[i*3+2] > 0.5;
            const tr = document.createElement('tr');
            tr.dataset.mapTable = 'sw';
            tr.dataset.mapIndex = String(i);
            tr.innerHTML =
                `<td class="pname" title="${name}">${name}</td>` +
                `<td><input type="number" min="0" max="7" value="${pin}" ` +
                `data-i="${i}" data-f="pin" class="si"></td>` +
                `<td><select data-i="${i}" data-f="port" class="si">` +
                `<option value="0"${!portB?' selected':''}>A</option>` +
                `<option value="1"${portB?' selected':''}>B</option></select></td>` +
                `<td class="col-check"><input type="checkbox" ${rev?'checked':''} ` +
                `data-i="${i}" data-f="rev" class="si"></td>` +
                `<td class="detect-cell"></td>`;
            tr.querySelector('.detect-cell').appendChild(createDetectButton('sw', i));
            stbody.appendChild(tr);
        });
    }

    document.querySelectorAll('.pi, .si').forEach(inp => {
        inp.addEventListener('input',  updateMappingConflicts);
        inp.addEventListener('change', updateMappingConflicts);
    });
    updateMappingConflicts();
}

/**
 * Highlights rows and lists groups that share the same MUX/channel (pots)
 * or port/pin (switches).
 */
export function updateMappingConflicts() {
    if(!getContext().mappingBuilt) return;

    document.querySelectorAll('#pot-tbody tr, #sw-tbody tr').forEach(tr =>
        tr.classList.remove('dup-conflict'));

    const messages = [];

    // Pots — duplicate MUX + channel
    const potGroups = new Map();
    for(let i = 0; i < POT_NAMES.length; i++) {
        const muxInp = document.querySelector(`.pi[data-i="${i}"][data-f="mux"]`);
        const potInp = document.querySelector(`.pi[data-i="${i}"][data-f="pot"]`);
        if(!muxInp || !potInp) continue;
        const mux = parseInt(muxInp.value, 10);
        const pot = parseInt(potInp.value, 10);
        if(isNaN(mux) || isNaN(pot)) continue;
        const key = mux + ':' + pot;
        if(!potGroups.has(key)) potGroups.set(key, []);
        potGroups.get(key).push(i);
    }
    potGroups.forEach((indices, key) => {
        if(indices.length < 2) return;
        const parts = key.split(':');
        const names = indices.map(i => POT_NAMES[i]).join(', ');
        messages.push('Pot MUX ' + parts[0] + ' / channel ' + parts[1] + ' : ' + names);
        indices.forEach(i => {
            const inp = document.querySelector(`.pi[data-i="${i}"][data-f="mux"]`);
            const tr  = inp && inp.closest('tr');
            if(tr) tr.classList.add('dup-conflict');
        });
    });

    // Switches — duplicate port + pin
    const swGroups = new Map();
    for(let i = 0; i < SWITCH_NAMES.length; i++) {
        const pinInp  = document.querySelector(`.si[data-i="${i}"][data-f="pin"]`);
        const portInp = document.querySelector(`.si[data-i="${i}"][data-f="port"]`);
        if(!pinInp || !portInp) continue;
        const pin  = parseInt(pinInp.value, 10);
        const port = parseInt(portInp.value, 10);
        if(isNaN(pin) || isNaN(port)) continue;
        const key = port + ':' + pin;
        if(!swGroups.has(key)) swGroups.set(key, []);
        swGroups.get(key).push(i);
    }
    swGroups.forEach((indices, key) => {
        if(indices.length < 2) return;
        const parts = key.split(':');
        const portLabel = parts[0] === '1' ? 'B' : 'A';
        const names = indices.map(i => SWITCH_NAMES[i]).join(', ');
        messages.push('Switch port ' + portLabel + ' / pin ' + parts[1] + ' : ' + names);
        indices.forEach(i => {
            const inp = document.querySelector(`.si[data-i="${i}"][data-f="pin"]`);
            const tr  = inp && inp.closest('tr');
            if(tr) tr.classList.add('dup-conflict');
        });
    });

    const banner = document.getElementById('mapping-conflicts');
    const list   = document.getElementById('mapping-conflicts-list');
    if(!banner || !list) return;

    if(messages.length === 0) {
        banner.classList.remove('show');
        list.innerHTML = '';
        return;
    }

    banner.classList.add('show');
    list.innerHTML = messages.map(m => '<li>' + m + '</li>').join('');
}

/** Creates a per-row Detect / Cancel button. */
export function createDetectButton(table, index) {
    const btn = el('button', {className: 'btn-detect-row', type: 'button'});
    btn.textContent = 'Map';
    btn.title       = 'Detect control';
    btn.dataset.table = table;
    btn.dataset.index = String(index);
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if(getContext().detectMode &&
           getContext().detectMode.table === table &&
           getContext().detectMode.targetIndex === index)
            cancelDetect();
        else
            startDetect(table, index);
    });
    return btn;
}

export function showDetectStatus(msg, isError) {
    if(!getContext().detectStatusEl) return;
    getContext().detectStatusEl.textContent = msg;
    getContext().detectStatusEl.className     = isError ? 'show err' : 'show';
}

export function hideDetectStatus() {
    if(!getContext().detectStatusEl) return;
    getContext().detectStatusEl.textContent = '';
    getContext().detectStatusEl.className   = '';
}

export function setDetectUiActive(active) {
    document.querySelectorAll('.btn-detect-row').forEach(btn => {
        const t = btn.dataset.table;
        const i = parseInt(btn.dataset.index, 10);
        const isTarget = active && getContext().detectMode &&
                         getContext().detectMode.table === t &&
                         getContext().detectMode.targetIndex === i;
        btn.textContent = isTarget ? '\u00d7' : 'Det';
        btn.title       = isTarget ? 'Cancel detect' : 'Detect control';
        btn.classList.toggle('detect-active', isTarget);
        btn.disabled    = active && !isTarget;
    });
    document.querySelectorAll('#pot-tbody tr, #sw-tbody tr').forEach(row =>
        row.classList.remove('row-detecting'));
    if(active && getContext().detectMode) {
        const tbody = getContext().detectMode.table === 'pot' ? '#pot-tbody' : '#sw-tbody';
        const tr = document.querySelector(
            `${tbody} tr[data-map-index="${getContext().detectMode.targetIndex}"]`);
        if(tr) tr.classList.add('row-detecting');
    }
}

/** Returns flat index into the MUX raw grid buffer. */
export function muxRawIndex(mux, pot) {
    return mux * MUX_POTS_PER_MUX + pot;
}

/** Returns active MUX count from config metadata (fallback: 4). */
export function getActiveMuxCount() {
    if(getContext().configMeta && getContext().configMeta.length > CONFIG_META.ACTIVE_MUX)
        return Math.max(1, Math.round(getContext().configMeta[CONFIG_META.ACTIVE_MUX]));
    return 4;
}

/** Returns true when a physical MUX channel is in the ignored-pots list. */
export function isPotIgnored(mux, pot) {
    if(!getContext().configMeta) return false;
    const count = Math.round(getContext().configMeta[CONFIG_META.IGNORED_COUNT]);
    for(let i = 0; i < count; i++) {
        const base = CONFIG_META.IGNORED_BASE + i * 2;
        if(Math.round(getContext().configMeta[base]) === mux &&
           Math.round(getContext().configMeta[base + 1]) === pot)
            return true;
    }
    return false;
}

/** Returns true when a MUX channel is already assigned to a named pot. */
export function isPotMapped(mux, pot) {
    if(!getContext().potMapping) return false;
    for(let i = 0; i < POT_NAMES.length; i++) {
        if(Math.round(getContext().potMapping[i * 4]) === mux &&
           Math.round(getContext().potMapping[i * 4 + 1]) === pot)
            return true;
    }
    return false;
}

/** Human-readable label for an unmapped physical pot (0-based MUX/channel, matches mapping table). */
export function formatUnmappedPotLabel(mux, pot) {
    return 'N/A MUX' + mux + ' CH' + String(pot).padStart(2, '0');
}

/** Snapshots live pot/switch values for movement detection. */
export function snapshotControlValues() {
    const snapPot = new Float32Array(POT_NAMES.length);
    const snapSw  = new Float32Array(SWITCH_NAMES.length);
    const snapMuxRaw = new Float32Array(MUX_RAW_SIZE);
    for(let i = 0; i < POT_NAMES.length; i++)
        snapPot[i] = getContext().potValues[i] != null ? getContext().potValues[i] : 0;
    for(let i = 0; i < SWITCH_NAMES.length; i++)
        snapSw[i] = getContext().switchStates[i] != null ? getContext().switchStates[i] : 0;
    for(let i = 0; i < MUX_RAW_SIZE; i++)
        snapMuxRaw[i] = getContext().muxRawValues ? getContext().muxRawValues[i] : 0;
    return {snapPot, snapSw, snapMuxRaw};
}

/** Starts listening for a pot move (≥25%) or switch toggle for one row. */
export function startDetect(table, index) {
    if(getContext().detectMode) cancelDetect();
    if(!getContext().mappingBuilt) {
        showDetectStatus('Waiting for Bela mapping…', true);
        return;
    }
    if(typeof Bela === 'undefined') {
        showDetectStatus('Bela not connected', true);
        return;
    }

    const {snapPot, snapSw, snapMuxRaw} = snapshotControlValues();
    getContext().detectMode = {table, targetIndex: index, snapPot, snapSw, snapMuxRaw};

    setDetectUiActive(true);
    const targetName = table === 'pot' ? POT_NAMES[index] : SWITCH_NAMES[index];
    if(table === 'pot') {
        showDetectStatus(
            'Move any pot at least 25% for ' + targetName + ' — ' +
            'MUX/channel will be detected automatically.'
        );
    } else {
        showDetectStatus(
            'Toggle a switch for ' + targetName + ' — ' +
            'pin/port will be copied from the switch you flip.'
        );
    }
}

/** Aborts an active detect session. */
export function cancelDetect() {
    if(!getContext().detectMode) return;
    getContext().detectMode = null;
    setDetectUiActive(false);
    hideDetectStatus();
}

/** Sets one mapping form field and notifies conflict checker. */
export function setMappingField(table, rowIndex, field, value) {
    const cls = table === 'pot' ? 'pi' : 'si';
    const inp = document.querySelector(`.${cls}[data-i="${rowIndex}"][data-f="${field}"]`);
    if(!inp) return;
    if(inp.type === 'checkbox')
        inp.checked = !!value;
    else
        inp.value = value;
    inp.dispatchEvent(new Event('input', {bubbles: true}));
}

/** Finds the MUX channel with the largest raw change since the detect snapshot. */
export function findMovedMuxPot(snapMuxRaw) {
    if(!getContext().muxRawValues) return null;
    const activeMux = getActiveMuxCount();
    let bestMux = -1;
    let bestPot = -1;
    let bestDelta = 0;
    for(let m = 0; m < activeMux; m++) {
        for(let p = 0; p < MUX_POTS_PER_MUX; p++) {
            if(isPotIgnored(m, p)) continue;
            const idx   = muxRawIndex(m, p);
            const cur   = getContext().muxRawValues[idx] != null ? getContext().muxRawValues[idx] : 0;
            const delta = Math.abs(cur - snapMuxRaw[idx]);
            if(delta > bestDelta) {
                bestDelta = delta;
                bestMux   = m;
                bestPot   = p;
            }
        }
    }
    if(bestMux < 0 || bestDelta < DETECT_POT_MIN_DELTA) return null;
    return {mux: bestMux, pot: bestPot, label: formatUnmappedPotLabel(bestMux, bestPot)};
}

/** Finds the pot index with the largest change since the detect snapshot. */
export function findMovedPotIndex(snapPot) {
    let bestIdx = -1;
    let bestDelta = 0;
    for(let i = 0; i < POT_NAMES.length; i++) {
        const cur   = getContext().potValues[i] != null ? getContext().potValues[i] : 0;
        const delta = Math.abs(cur - snapPot[i]);
        if(delta > bestDelta) {
            bestDelta = delta;
            bestIdx   = i;
        }
    }
    if(bestIdx < 0 || bestDelta < DETECT_POT_MIN_DELTA) return -1;
    return bestIdx;
}

/** Finds a switch that toggled since the detect snapshot. */
export function findToggledSwitchIndex(snapSw) {
    for(let i = 0; i < SWITCH_NAMES.length; i++) {
        const cur = getContext().switchStates[i] != null ? getContext().switchStates[i] : 0;
        if((cur > 0.5) !== (snapSw[i] > 0.5)) return i;
    }
    return -1;
}

/** Reads mux/pot/rev/cen for one pot row from the mapping table. */
export function readPotMappingRow(i) {
    const muxInp = document.querySelector(`.pi[data-i="${i}"][data-f="mux"]`);
    const potInp = document.querySelector(`.pi[data-i="${i}"][data-f="pot"]`);
    const revInp = document.querySelector(`.pi[data-i="${i}"][data-f="rev"]`);
    const cenInp = document.querySelector(`.pi[data-i="${i}"][data-f="cen"]`);
    if(!muxInp || !potInp) return null;
    return {
        mux: parseInt(muxInp.value, 10) || 0,
        pot: parseInt(potInp.value, 10) || 0,
        rev: revInp ? revInp.checked : false,
        cen: cenInp ? cenInp.checked : false
    };
}

/** Reads pin/port/rev for one switch row from the mapping table. */
export function readSwitchMappingRow(i) {
    const pinInp  = document.querySelector(`.si[data-i="${i}"][data-f="pin"]`);
    const portInp = document.querySelector(`.si[data-i="${i}"][data-f="port"]`);
    const revInp  = document.querySelector(`.si[data-i="${i}"][data-f="rev"]`);
    if(!pinInp || !portInp) return null;
    return {
        pin:  parseInt(pinInp.value, 10) || 0,
        port: parseInt(portInp.value, 10) || 0,
        rev:  revInp ? revInp.checked : false
    };
}

/** Applies a detected physical MUX channel to the selected pot row. */
export function finishDetectPotFromPhysical(mux, pot, label) {
    const dst = getContext().detectMode.targetIndex;
    setMappingField('pot', dst, 'mux', mux);
    setMappingField('pot', dst, 'pot', pot);

    if(getContext().potMapping) {
        for(let i = 0; i < POT_NAMES.length; i++) {
            if(Math.round(getContext().potMapping[i * 4]) === mux &&
               Math.round(getContext().potMapping[i * 4 + 1]) === pot) {
                const src = readPotMappingRow(i);
                if(src) {
                    setMappingField('pot', dst, 'rev', src.rev);
                    setMappingField('pot', dst, 'cen', src.cen);
                }
                break;
            }
        }
    }

    showDownloadStatus(
        'Detected ' + label + ' → MUX ' + mux + ' / ch ' + pot, false
    );
    cancelDetect();
}

/** Applies detect result to the selected row, then ends the session. */
export function finishDetect(sourceIndex, sourceName) {
    const dst = getContext().detectMode.targetIndex;
    const table = getContext().detectMode.table;

    if(table === 'pot') {
        const src = readPotMappingRow(sourceIndex);
        if(!src) { cancelDetect(); return; }
        setMappingField('pot', dst, 'mux', src.mux);
        setMappingField('pot', dst, 'pot', src.pot);
        setMappingField('pot', dst, 'rev', src.rev);
        setMappingField('pot', dst, 'cen', src.cen);
        showDownloadStatus(
            'Detected ' + sourceName + ' → MUX ' + src.mux + ' / ch ' + src.pot, false
        );
    } else {
        const src = readSwitchMappingRow(sourceIndex);
        if(!src) { cancelDetect(); return; }
        setMappingField('sw', dst, 'pin', src.pin);
        setMappingField('sw', dst, 'port', src.port);
        setMappingField('sw', dst, 'rev', src.rev);
        const portLabel = src.port > 0.5 ? 'B' : 'A';
        showDownloadStatus(
            'Detected ' + sourceName + ' → port ' + portLabel + ' / pin ' + src.pin, false
        );
    }

    updateMappingConflicts();
    cancelDetect();
}

/** Polls live buffers while detect mode is active. */
export function updateDetectMode() {
    if(!getContext().detectMode) return;

    if(getContext().detectMode.table === 'pot') {
        const hit = findMovedMuxPot(getContext().detectMode.snapMuxRaw);
        if(hit)
            finishDetectPotFromPhysical(hit.mux, hit.pot, hit.label);
    } else {
        const srcIdx = findToggledSwitchIndex(getContext().detectMode.snapSw);
        if(srcIdx >= 0)
            finishDetect(srcIdx, SWITCH_NAMES[srcIdx]);
    }
}

export function collectMappingFromForm() {
    const pm = new Float32Array(POT_NAMES.length * 4);
    document.querySelectorAll('.pi').forEach(inp => {
        const i = parseInt(inp.dataset.i, 10);
        const f = inp.dataset.f;
        if(f === 'mux') pm[i*4+0] = parseFloat(inp.value) || 0;
        if(f === 'pot') pm[i*4+1] = parseFloat(inp.value) || 0;
        if(f === 'rev') pm[i*4+2] = inp.checked ? 1.0 : 0.0;
        if(f === 'cen') pm[i*4+3] = inp.checked ? 1.0 : 0.0;
    });

    const sm = new Float32Array(SWITCH_NAMES.length * 3);
    document.querySelectorAll('.si').forEach(inp => {
        const i = parseInt(inp.dataset.i, 10);
        const f = inp.dataset.f;
        if(f === 'pin')  sm[i*3+0] = parseFloat(inp.value) || 0;
        if(f === 'port') sm[i*3+1] = parseFloat(inp.value);
        if(f === 'rev')  sm[i*3+2] = inp.checked ? 1.0 : 0.0;
    });

    return {pm, sm};
}

/** Builds a config.json string from form data and Bela metadata buffer. */
export function buildConfigJsonText(pm, sm) {
    if(!getContext().configMeta) return null;

    const M = CONFIG_META;
    const masterCount = Math.round(getContext().configMeta[M.MASTER_COUNT]);
    const masterOuts  = [];
    if(masterCount > 0) masterOuts.push(Math.round(getContext().configMeta[M.MASTER_0]));
    if(masterCount > 1) masterOuts.push(Math.round(getContext().configMeta[M.MASTER_1]));

    const ignoredCount = Math.round(getContext().configMeta[M.IGNORED_COUNT]);
    const ignoredPots  = [];
    for(let i = 0; i < ignoredCount; i++) {
        ignoredPots.push({
            mux: Math.round(getContext().configMeta[M.IGNORED_BASE + i*2 + 0]),
            pot: Math.round(getContext().configMeta[M.IGNORED_BASE + i*2 + 1])
        });
    }

    const pots = POT_NAMES.map((name, i) => ({
        name,
        mux:      Math.round(pm[i*4+0]),
        pot:      Math.round(pm[i*4+1]),
        reversed: pm[i*4+2] > 0.5,
        centered: pm[i*4+3] > 0.5
    }));

    const switches = SWITCH_NAMES.map((name, i) => ({
        name,
        pin:      Math.round(sm[i*3+0]),
        reversed: sm[i*3+2] > 0.5,
        port:     sm[i*3+1] > 0.5 ? 'B' : 'A'
    }));

    const config = {
        _comment: 'Dub Preamp BELA GEM MULTI -- hardware mapping config. Edit this file to remap pots/switches without recompiling. Restart the Bela project to apply changes.',
        mux: { activeMux: Math.round(getContext().configMeta[M.ACTIVE_MUX]) },
        calibration: {
            potScaleRecovery: +getContext().configMeta[M.SCALE].toFixed(4),
            potMax:           +getContext().configMeta[M.POT_MAX].toFixed(3),
            potMin:           +getContext().configMeta[M.POT_MIN].toFixed(3)
        },
        i2c: {
            bus:        I2C_BUS,
            mcpAddress: Math.round(getContext().configMeta[M.MCP_ADDR])
        },
        routing: {
            out: {
                master:  masterOuts,
                fx1Send: Math.round(getContext().configMeta[M.FX1_SEND]),
                fx2Send: Math.round(getContext().configMeta[M.FX2_SEND]),
                vuSub:   Math.round(getContext().configMeta[M.VU_SUB]),
                vuKick:  Math.round(getContext().configMeta[M.VU_KICK]),
                vuMid:   Math.round(getContext().configMeta[M.VU_MID]),
                vuTop:   Math.round(getContext().configMeta[M.VU_TOP])
            },
            in: {
                fx1Return: Math.round(getContext().configMeta[M.FX1_RET]),
                fx2Return: Math.round(getContext().configMeta[M.FX2_RET]),
                aux1:      Math.round(getContext().configMeta[M.AUX1]),
                aux2:      Math.round(getContext().configMeta[M.AUX2]),
                aux3:      Math.round(getContext().configMeta[M.AUX3]),
                aux4:      Math.round(getContext().configMeta[M.AUX4])
            }
        },
        pots,
        switches,
        ignoredPots
    };

    return JSON.stringify(config, null, 2);
}

/** Triggers a browser download of config.json built from the mapping tables. */
export function downloadConfigJson() {
    if(!getContext().mappingBuilt) {
        showDownloadStatus('Waiting for Bela mapping…', true);
        return;
    }
    if(!getContext().configMeta) {
        showDownloadStatus('Config metadata not received', true);
        return;
    }

    const {pm, sm} = collectMappingFromForm();
    const text     = buildConfigJsonText(pm, sm);
    if(!text) {
        showDownloadStatus('JSON generation error', true);
        return;
    }

    const blob = new Blob([text], {type: 'application/json'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showDownloadStatus('Downloaded ✓', false);
}

export function showDownloadStatus(msg, isError) {
    if(!getContext().downloadStatusEl) return;
    getContext().downloadStatusEl.textContent = msg;
    getContext().downloadStatusEl.className   = isError ? 'err' : '';
    setTimeout(() => { if(getContext().downloadStatusEl) getContext().downloadStatusEl.textContent = ''; }, 4000);
}
