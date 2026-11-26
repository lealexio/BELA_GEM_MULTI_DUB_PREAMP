/** Mapping tab: 3-view progressive UI (Controls + Guided Learn, Audio I/O, Advanced) + Load/Save/Restart/Export. */
import { getContext } from '../context.js';
import {
    POT_NAMES, SWITCH_NAMES, MUX_POTS_PER_MUX, MUX_RAW_SIZE,
    CONFIG_META, I2C_BUS, DETECT_POT_MIN_DELTA,
    MIC_HPF_HZ_MIN, MIC_HPF_HZ_MAX, isPotCentered,
    CLIP_LED_KEYS, CLIP_LED_LABELS,
    decodeClipLedMeta, parseClipLedConfigEntry, serializeClipLedEntry
} from '../config.js';
import { IGNORED_POTS_DEFAULT } from '../routing-config.js';
import {
    fetchBoardConfigJson, getEffectiveRouting,
    saveConfigToBela, readConfigViaControl,
    restartBelaAudio, rebootBelaBoard
} from '../board-config.js';
import { belaControlReady } from '../bela/connection.js';
import { el, svgIcon } from './utils.js';

const ROUTING_CH_MIN = 0;
const ROUTING_CH_MAX = 9;
const INPUT_GAIN_MIN = -12;
const INPUT_GAIN_MAX = 10;
const OUTPUT_GAIN_MIN = -63;
const OUTPUT_GAIN_MAX = 0;
const GUIDED_SETTLE_MS = 450;

const DEFAULT_CONFIG_COMMENT = 'Dub Preamp BELA GEM MULTI -- hardware mapping config. Edit this file to remap pots/switches without recompiling. Restart the Bela project to apply changes.';

const ICON_DOWNLOAD = ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'];
const ICON_UPLOAD = ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'];
const ICON_SAVE = ['M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z', 'M17 21v-8H7v8', 'M7 3v5h8'];
const ICON_RESTART = ['M23 4v6h-6', 'M1 20v-6h6', 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10', 'M1 14l4.64 4.36A9 9 0 0 0 20.49 15'];

const ROUTING_IN_KEYS = ['aux1', 'aux2', 'aux3', 'aux4', 'fx1Return', 'fx2Return'];
const ROUTING_OUT_KEYS = ['master', 'fx1Send', 'fx2Send', 'vuSub', 'vuKick', 'vuMid', 'vuTop'];

const ROUTING_LABELS = {
    aux1: 'AUX 1',
    aux2: 'AUX 2',
    aux3: 'AUX 3',
    aux4: 'AUX 4',
    fx1Return: 'FX1 Return',
    fx2Return: 'FX2 Return',
    master: 'Master Out',
    fx1Send: 'FX1 Send',
    fx2Send: 'FX2 Send',
    vuSub: 'VU Sub',
    vuKick: 'VU Kick',
    vuMid: 'VU Mid',
    vuTop: 'VU Top'
};

const POT_INDEX = Object.fromEntries(POT_NAMES.map((n, i) => [n, i]));
const SW_INDEX = Object.fromEntries(SWITCH_NAMES.map((n, i) => [n, i]));

/** Logical groups for novice-friendly Mapping navigation. */
const CONTROL_GROUPS = [
    {
        id: 'master',
        title: 'Master & Filters',
        defaultOpen: true,
        items: [
            { table: 'pot', name: 'MASTER_GAIN', label: 'Master Gain' },
            { table: 'pot', name: 'MASTER_HPF_FREQ', label: 'HPF Freq' },
            { table: 'pot', name: 'MASTER_HPF_RES', label: 'HPF Resonance' },
            { table: 'pot', name: 'MASTER_LPF_FREQ', label: 'LPF Freq' },
            { table: 'pot', name: 'MASTER_LPF_RES', label: 'LPF Resonance' },
            { table: 'pot', name: 'BTRIM_SUB', label: 'Band Trim Sub' },
            { table: 'pot', name: 'BTRIM_KICK', label: 'Band Trim Kick' },
            { table: 'pot', name: 'BTRIM_MID', label: 'Band Trim Mid' },
            { table: 'pot', name: 'BTRIM_TOP', label: 'Band Trim Top' },
            { table: 'sw', name: 'KILL_SUB', label: 'Kill Sub' },
            { table: 'sw', name: 'KILL_KICK', label: 'Kill Kick' },
            { table: 'sw', name: 'KILL_MID', label: 'Kill Mid' },
            { table: 'sw', name: 'KILL_TOP', label: 'Kill Top' }
        ]
    },
    ...[1, 2, 3, 4].map(n => ({
        id: 'aux' + n,
        title: 'AUX ' + n,
        defaultOpen: n === 1,
        items: [
            { table: 'pot', name: `AUX${n}_INPUT_GAIN`, label: 'Input Gain' },
            { table: 'pot', name: `AUX${n}_EQ_HIGH`, label: 'EQ High' },
            { table: 'pot', name: `AUX${n}_EQ_MID`, label: 'EQ Mid' },
            { table: 'pot', name: `AUX${n}_EQ_LOW`, label: 'EQ Low' },
            { table: 'pot', name: `AUX${n}_FX_SEND`, label: 'FX1 Send' },
            { table: 'pot', name: `AUX${n}_FX2_SEND`, label: 'FX2 Send' }
        ]
    })),
    {
        id: 'peq',
        title: 'Parametric EQ',
        defaultOpen: false,
        items: [
            { table: 'pot', name: 'MASTER_EQ_SUB_FREQ', label: 'Sub Freq' },
            { table: 'pot', name: 'MASTER_EQ_SUB_GAIN', label: 'Sub Gain' },
            { table: 'pot', name: 'MASTER_EQ_KICK_FREQ', label: 'Kick Freq' },
            { table: 'pot', name: 'MASTER_EQ_KICK_GAIN', label: 'Kick Gain' },
            { table: 'pot', name: 'MASTER_EQ_MID_FREQ', label: 'Mid Freq' },
            { table: 'pot', name: 'MASTER_EQ_MID_GAIN', label: 'Mid Gain' },
            { table: 'pot', name: 'MASTER_EQ_TOP_FREQ', label: 'Top Freq' },
            { table: 'pot', name: 'MASTER_EQ_TOP_GAIN', label: 'Top Gain' }
        ]
    },
    {
        id: 'geq',
        title: 'Graphic EQ (12-Band)',
        defaultOpen: false,
        items: [
            '40HZ', '60HZ', '80HZ', '100HZ', '125HZ', '250HZ',
            '500HZ', '1KHZ', '2KHZ', '4KHZ', '8KHZ', '16KHZ'
        ].map(f => ({
            table: 'pot',
            name: 'GEQ_' + f,
            label: f.replace('HZ', ' Hz').replace('KHZ', ' kHz')
        }))
    },
    {
        id: 'fx_siren',
        title: 'Siren & FX',
        defaultOpen: false,
        items: [
            { table: 'pot', name: 'SIREN_TYPE', label: 'Siren Preset' },
            { table: 'pot', name: 'SIREN_MOD', label: 'Siren Mod' },
            { table: 'pot', name: 'SIREN_GAIN', label: 'Siren Gain' },
            { table: 'pot', name: 'SIREN_FX_SEND', label: 'Siren FX1 Send' },
            { table: 'pot', name: 'SIREN_FX2_SEND', label: 'Siren FX2 Send' },
            { table: 'sw', name: 'SIREN_TRIGGER', label: 'Siren Gate' },
            { table: 'pot', name: 'FX1_RETURN_GAIN', label: 'FX1 Return Gain' },
            { table: 'pot', name: 'FX2_RETURN_GAIN', label: 'FX2 Return Gain' },
            { table: 'sw', name: 'FX_FILTER_MIDS', label: 'FX1 Filter Mids' },
            { table: 'sw', name: 'FX_FILTER_TOPS', label: 'FX1 Filter Tops' },
            { table: 'sw', name: 'FX2_FILTER_MIDS', label: 'FX2 Filter Mids' },
            { table: 'sw', name: 'FX2_FILTER_TOPS', label: 'FX2 Filter Tops' }
        ]
    }
];

let _guidedTimer = null;
const _potLiveFills = new Array(POT_NAMES.length);
const _swLiveFills = new Array(SWITCH_NAMES.length);
const _potRevButtons = new Array(POT_NAMES.length);
const _swRevButtons = new Array(SWITCH_NAMES.length);
const _hwValues = {};
const _clipLedInputs = {};
let _devModeBootCb = null;
let _modalOverlay = null;
let _modalEscBound = null;
let _statusClearTimer = null;

function setMappingDirty(dirty) {
    const ctx = getContext();
    ctx.mappingDirty = !!dirty;
    const pill = document.getElementById('map-dirty-pill');
    if (pill) {
        pill.classList.toggle('show', ctx.mappingDirty);
    }
}

function markMappingDirty() {
    setMappingDirty(true);
}

function setActionButtonsDisabled(disabled) {
    getContext().mappingActionBusy = !!disabled;
    ['btn-load-config', 'btn-save-config', 'btn-restart-audio', 'btn-download', 'btn-reboot-bela'].forEach(id => {
        const b = document.getElementById(id);
        if (b) b.disabled = !!disabled;
    });
}

function routingInChannel(val) {
    if (val != null && typeof val === 'object' && !Array.isArray(val)) {
        if (Array.isArray(val.channels)) return val.channels;
        if (val.channel != null) {
            if (val.channelR != null && val.channelR >= 0) return [val.channel, val.channelR];
            return val.channel;
        }
        return 0;
    }
    if (Array.isArray(val)) return val;
    return val != null ? val : 0;
}

function routingOutChannel(val) {
    if (val != null && typeof val === 'object' && !Array.isArray(val)) {
        if (Array.isArray(val.channels)) return val.channels;
        return val.channel != null ? val.channel : 0;
    }
    if (Array.isArray(val)) return val;
    return val;
}

function routingOutStereo(val) {
    if (val != null && typeof val === 'object' && !Array.isArray(val)) {
        if (val.stereo !== undefined) return !!val.stereo;
        if (val.mono !== undefined) return !val.mono;
    }
    return true;
}

function routingInMic(val) {
    return (val != null && typeof val === 'object' && !Array.isArray(val)) ? !!val.mic : false;
}

function routingInHpf(val) {
    if (val != null && typeof val === 'object' && !Array.isArray(val)) {
        const h = Number(val.hpf);
        return isNaN(h) ? 0 : h;
    }
    return 0;
}

function routingGain(val) {
    if (val != null && typeof val === 'object' && !Array.isArray(val)) {
        const g = Number(val.gain);
        return isNaN(g) ? 0 : g;
    }
    return 0;
}

/** Builds the Mapping tab with 3 progressive sub-views: Controls, Audio I/O, Advanced. */
export function buildMappingPane() {
    const ctx = getContext();
    const pane = el('div', { id: 'pane-mapping', className: 'tab-pane' });

    const topbar = el('div', { className: 'map-topbar' });
    const subtabs = el('div', { className: 'map-subtabs', role: 'tablist', 'aria-label': 'Mapping sections' });
    [
        { id: 'controls', label: 'Controls' },
        { id: 'io', label: 'Audio I/O' },
        { id: 'advanced', label: 'Advanced' }
    ].forEach(t => {
        const active = ctx.mappingSubTab === t.id;
        const btn = el('button', {
            type: 'button',
            className: 'map-subtab' + (active ? ' active' : ''),
            role: 'tab',
            'aria-selected': active ? 'true' : 'false',
            textContent: t.label
        });
        btn.dataset.subtab = t.id;
        btn.addEventListener('click', () => setMappingSubTab(t.id));
        subtabs.appendChild(btn);
    });
    topbar.appendChild(subtabs);

    const dirtyPill = el('span', {
        id: 'map-dirty-pill',
        className: 'map-dirty-pill' + (ctx.mappingDirty ? ' show' : ''),
        textContent: 'Unsaved',
        title: 'Local changes not yet saved to Bela'
    });
    topbar.appendChild(dirtyPill);

    const actions = el('div', { className: 'map-topbar-actions' });
    const conflictPill = el('button', {
        type: 'button',
        id: 'map-conflict-pill',
        className: 'map-conflict-pill',
        textContent: '0 Conflicts'
    });
    conflictPill.addEventListener('click', () => {
        const box = document.getElementById('mapping-conflicts');
        if (box) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        if (ctx.mappingSubTab === 'controls') {
            setMappingFilter('conflicts');
        }
    });
    actions.appendChild(conflictPill);

    ctx.downloadStatusEl = el('div', {
        id: 'download-status',
        className: 'map-toast',
        role: 'status',
        'aria-live': 'polite'
    });
    pane.appendChild(ctx.downloadStatusEl);

    const fileInput = el('input', {
        type: 'file',
        id: 'map-load-file',
        accept: '.json,application/json',
        style: 'display:none',
        'aria-label': 'Load config.json file'
    });
    fileInput.addEventListener('change', handleLoadFileChange);
    actions.appendChild(fileInput);

    const loadBtn = el('button', {
        type: 'button',
        id: 'btn-load-config',
        className: 'btn-map-secondary',
        title: 'Load a local config.json file into the Mapping form'
    });
    loadBtn.appendChild(svgIcon(ICON_UPLOAD, '0 0 24 24', 14));
    loadBtn.appendChild(el('span', { textContent: 'Load' }));
    loadBtn.addEventListener('click', () => fileInput.click());
    actions.appendChild(loadBtn);

    const exportBtn = el('button', {
        type: 'button',
        id: 'btn-download',
        className: 'btn-map-secondary',
        title: 'Download the exact config.json currently saved on Bela'
    });
    exportBtn.appendChild(svgIcon(ICON_DOWNLOAD, '0 0 24 24', 14));
    exportBtn.appendChild(el('span', { textContent: 'Export config.json' }));
    exportBtn.addEventListener('click', exportBoardConfigJson);
    actions.appendChild(exportBtn);

    const saveBtn = el('button', {
        type: 'button',
        id: 'btn-save-config',
        className: 'btn-save',
        title: 'Save current Mapping form directly to config.json on Bela'
    });
    saveBtn.appendChild(svgIcon(ICON_SAVE, '0 0 24 24', 14));
    saveBtn.appendChild(el('span', { textContent: 'Save' }));
    saveBtn.addEventListener('click', saveConfigAction);
    actions.appendChild(saveBtn);

    const restartBtn = el('button', {
        type: 'button',
        id: 'btn-restart-audio',
        className: 'btn-restart',
        title: 'Restart Bela audio program (~2–3 s, keeps Wi-Fi/hotspot connected)'
    });
    restartBtn.appendChild(svgIcon(ICON_RESTART, '0 0 24 24', 14));
    restartBtn.appendChild(el('span', { textContent: 'Restart' }));
    restartBtn.addEventListener('click', confirmAndRestartAudio);
    actions.appendChild(restartBtn);

    topbar.appendChild(actions);
    pane.appendChild(topbar);

    const conflicts = el('div', { id: 'mapping-conflicts', className: 'map-conflicts-box' });
    conflicts.innerHTML = '<strong>Conflicts</strong><ul id="mapping-conflicts-list"></ul>';
    pane.appendChild(conflicts);

    const detectBanner = el('div', { id: 'detect-status' });
    ctx.detectStatusEl = detectBanner;
    pane.appendChild(detectBanner);

    pane.appendChild(buildControlsView());
    pane.appendChild(buildRoutingView());
    pane.appendChild(buildAdvancedView());

    setMappingSubTab(ctx.mappingSubTab || 'controls');
    return pane;
}

function setMappingSubTab(subId) {
    const ctx = getContext();
    if (subId !== 'controls') cancelDetect();
    ctx.mappingSubTab = subId;

    document.querySelectorAll('.map-subtab').forEach(btn => {
        const active = btn.dataset.subtab === subId;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.map-subview').forEach(view => {
        view.style.display = (view.dataset.subview === subId) ? '' : 'none';
    });
}

function buildControlsView() {
    const view = el('div', { className: 'map-subview' });
    view.dataset.subview = 'controls';

    const guidedBar = el('div', { id: 'map-guided-bar', className: 'map-guided-bar' });
    const guidedInfo = el('div', { className: 'map-guided-info' });
    guidedInfo.appendChild(el('div', { id: 'map-guided-step', className: 'map-guided-step', textContent: 'Setup Assistant' }));
    guidedInfo.appendChild(el('div', { id: 'map-guided-prompt', className: 'map-guided-prompt', textContent: 'Map pots and switches step by step' }));
    guidedBar.appendChild(guidedInfo);

    const guidedActions = el('div', { id: 'map-guided-actions', className: 'map-guided-actions' });
    const startBtn = el('button', {
        type: 'button',
        id: 'btn-guided-start',
        className: 'btn-detect-row',
        textContent: 'Guided Setup'
    });
    startBtn.addEventListener('click', startGuidedSetup);

    const skipBtn = el('button', {
        type: 'button',
        id: 'btn-guided-skip',
        className: 'dev-small-btn',
        textContent: 'Skip'
    });
    skipBtn.style.display = 'none';
    skipBtn.addEventListener('click', skipGuidedStep);

    const stopBtn = el('button', {
        type: 'button',
        id: 'btn-guided-stop',
        className: 'btn-del-ign',
        textContent: 'Stop'
    });
    stopBtn.style.display = 'none';
    stopBtn.addEventListener('click', cancelDetect);

    guidedActions.appendChild(startBtn);
    guidedActions.appendChild(skipBtn);
    guidedActions.appendChild(stopBtn);
    guidedBar.appendChild(guidedActions);
    view.appendChild(guidedBar);

    const filterBar = el('div', { className: 'map-filter-bar' });
    const pills = el('div', { className: 'map-filter-pills' });
    [
        { id: 'all', label: 'All' },
        { id: 'pots', label: 'Pots' },
        { id: 'switches', label: 'Switches' },
        { id: 'conflicts', label: 'Conflicts' }
    ].forEach(f => {
        const b = el('button', {
            type: 'button',
            className: 'map-filter-pill' + (getContext().mappingFilter === f.id ? ' active' : ''),
            textContent: f.label,
            'aria-pressed': getContext().mappingFilter === f.id ? 'true' : 'false'
        });
        b.dataset.filter = f.id;
        b.addEventListener('click', () => setMappingFilter(f.id));
        pills.appendChild(b);
    });
    filterBar.appendChild(pills);

    const searchInp = el('input', {
        type: 'search',
        id: 'map-search-input',
        className: 'map-search',
        placeholder: 'Filter controls…',
        'aria-label': 'Filter controls'
    });
    searchInp.addEventListener('input', () => {
        getContext().mappingSearch = searchInp.value.trim().toLowerCase();
        applyControlFilters();
    });
    filterBar.appendChild(searchInp);
    view.appendChild(filterBar);

    const groupsHost = el('div', { id: 'map-groups-host', className: 'map-groups' });
    groupsHost.appendChild(el('div', { className: 'map-empty', textContent: 'Waiting for Bela connection…' }));
    view.appendChild(groupsHost);

    return view;
}

function setMappingFilter(filterId) {
    const ctx = getContext();
    ctx.mappingFilter = filterId;
    document.querySelectorAll('.map-filter-pill').forEach(b => {
        const active = b.dataset.filter === filterId;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    applyControlFilters();
}

function applyControlFilters() {
    const ctx = getContext();
    const filter = ctx.mappingFilter || 'all';
    const q = ctx.mappingSearch || '';

    document.querySelectorAll('#map-groups-host .map-group').forEach(grp => {
        let visibleCount = 0;
        grp.querySelectorAll('.map-row').forEach(row => {
            const table = row.dataset.mapTable;
            const searchHay = (row.dataset.search || '').toLowerCase();
            const hasConflict = row.classList.contains('dup-conflict');

            let matchFilter = true;
            if (filter === 'pots') matchFilter = (table === 'pot');
            else if (filter === 'switches') matchFilter = (table === 'sw');
            else if (filter === 'conflicts') matchFilter = hasConflict;

            const matchSearch = !q || searchHay.includes(q);
            const show = matchFilter && matchSearch;
            row.style.display = show ? '' : 'none';
            if (show) visibleCount++;
        });
        grp.style.display = visibleCount > 0 ? '' : 'none';
        if ((q || filter === 'conflicts') && visibleCount > 0) {
            grp.dataset.collapsed = 'false';
        }
    });
}

function buildRoutingView() {
    const view = el('div', { className: 'map-subview', id: 'routing-section' });
    view.dataset.subview = 'io';

    const routing = getEffectiveRouting();
    const grid = el('div', { className: 'map-io-grid' });
    grid.appendChild(buildRoutingCard('Inputs', 'in', ROUTING_IN_KEYS, routing.in || {}, true));
    grid.appendChild(buildRoutingCard('Outputs', 'out', ROUTING_OUT_KEYS, routing.out || {}, false));
    view.appendChild(grid);

    const onRoutingChange = () => {
        getContext().mappingUserEdited = true;
        markMappingDirty();
        updateMappingConflicts();
    };
    view.querySelectorAll('.ri, .ri-gain, .ri-mic, .ri-hpf, .ri-stereo').forEach(inp => {
        inp.addEventListener('input', onRoutingChange);
        inp.addEventListener('change', onRoutingChange);
    });
    updateMappingConflicts();
    return view;
}

function buildRoutingCard(heading, dir, keys, values, isIn) {
    const card = el('div', { className: 'card map-io-card' });
    card.appendChild(el('div', { className: 'card-title', textContent: heading }));

    const list = el('div', { className: 'map-io-list', id: `routing-${dir}-tbody` });
    const gainMin = isIn ? INPUT_GAIN_MIN : OUTPUT_GAIN_MIN;
    const gainMax = isIn ? INPUT_GAIN_MAX : OUTPUT_GAIN_MAX;

    keys.forEach(key => {
        const raw = values[key];
        const isMaster = key === 'master';
        const isAux = key.startsWith('aux');
        const isStereoCapable = isMaster || isAux;
        const channelVal = isIn ? routingInChannel(raw) : routingOutChannel(raw);
        const display = formatRoutingValue(channelVal, isStereoCapable);
        const gainVal = routingGain(raw);

        const row = el('div', { className: 'map-io-row' });
        row.dataset.routingDir = dir;
        row.dataset.routingKey = key;

        row.appendChild(el('span', {
            className: 'map-io-label',
            textContent: ROUTING_LABELS[key] || key,
            title: key
        }));

        const fields = el('div', { className: 'map-io-fields' });

        // Bela channel(s)
        const chField = el('label', { className: 'map-field' });
        chField.appendChild(el('span', { className: 'map-field-lbl', textContent: 'Ch' }));
        const chInp = el('input', {
            type: isStereoCapable ? 'text' : 'number',
            value: display,
            className: isStereoCapable ? 'ri' : 'ri map-num',
            'aria-label': `${ROUTING_LABELS[key] || key} channel`
        });
        chInp.dataset.dir = dir;
        chInp.dataset.key = key;
        if (isStereoCapable) {
            chInp.placeholder = '0 or 0,1';
            chInp.spellcheck = false;
        } else {
            chInp.min = String(ROUTING_CH_MIN);
            chInp.max = String(ROUTING_CH_MAX);
            chInp.step = '1';
        }
        chField.appendChild(chInp);
        fields.appendChild(chField);

        // Boot Gain dB
        const gField = el('label', { className: 'map-field' });
        gField.appendChild(el('span', { className: 'map-field-lbl', textContent: 'dB' }));
        const gInp = el('input', {
            type: 'number',
            className: 'ri-gain map-num',
            value: String(gainVal),
            min: String(gainMin),
            max: String(gainMax),
            step: '1',
            title: isIn ? `Boot ADC gain (${gainMin}..${gainMax} dB)` : `Boot DAC gain (${gainMin}..${gainMax} dB)`,
            'aria-label': `${ROUTING_LABELS[key] || key} gain dB`
        });
        gInp.dataset.dir = dir;
        gInp.dataset.key = key;
        gField.appendChild(gInp);
        fields.appendChild(gField);

        if (isIn && isAux) {
            const micLbl = el('label', { className: 'map-io-check', title: 'Bypass master ParamEQ / filters / kills' });
            const micCb = el('input', {
                type: 'checkbox',
                className: 'ri-mic',
                checked: routingInMic(raw)
            });
            micCb.dataset.dir = dir;
            micCb.dataset.key = key;
            micLbl.appendChild(micCb);
            micLbl.appendChild(el('span', { textContent: 'Mic' }));
            fields.appendChild(micLbl);

            const hpfField = el('label', { className: 'map-field', title: 'Mic dry HPF Hz (0 = off)' });
            hpfField.appendChild(el('span', { className: 'map-field-lbl', textContent: 'HPF' }));
            const hpfInp = el('input', {
                type: 'number',
                className: 'ri-hpf map-num',
                value: String(routingInHpf(raw)),
                min: String(MIC_HPF_HZ_MIN),
                max: String(MIC_HPF_HZ_MAX),
                step: '1',
                'aria-label': `${ROUTING_LABELS[key] || key} HPF Hz`
            });
            hpfInp.dataset.dir = dir;
            hpfInp.dataset.key = key;
            hpfField.appendChild(hpfInp);
            fields.appendChild(hpfField);
        } else if (!isIn && isMaster) {
            const stLbl = el('label', { className: 'map-io-check', title: 'Stereo (checked) or Mono L+R' });
            const stCb = el('input', {
                type: 'checkbox',
                className: 'ri-stereo',
                checked: routingOutStereo(raw)
            });
            stCb.dataset.dir = dir;
            stCb.dataset.key = key;
            stLbl.appendChild(stCb);
            stLbl.appendChild(el('span', { textContent: 'Stereo' }));
            fields.appendChild(stLbl);
        }

        row.appendChild(fields);
        list.appendChild(row);
    });

    card.appendChild(list);
    return card;
}

function syncClipLedRowDisabled(key) {
    const refs = _clipLedInputs[key];
    if (!refs) return;
    const on = !!refs.enCb.checked;
    refs.portSel.disabled = !on;
    refs.pinInp.disabled = !on;
    refs.activeLowCb.disabled = !on;
    if (refs.row) refs.row.classList.toggle('is-disabled', !on);
}

function renderClipLedsFromContext() {
    const ctx = getContext();
    const map = ctx.clipLedsConfig || {};
    CLIP_LED_KEYS.forEach(key => {
        const refs = _clipLedInputs[key];
        const cfg = map[key] || { enabled: false, port: 'A', pin: 0, activeLow: false };
        if (!refs) return;
        refs.enCb.checked = !!cfg.enabled;
        refs.portSel.value = cfg.port === 'B' ? 'B' : 'A';
        refs.pinInp.value = String(Math.max(0, Math.min(7, Math.round(cfg.pin || 0))));
        refs.activeLowCb.checked = !!cfg.activeLow;
        syncClipLedRowDisabled(key);
    });
}

function buildAdvancedView() {
    const view = el('div', { className: 'map-subview', id: 'ignored-pots-section' });
    view.dataset.subview = 'advanced';

    const ignCard = el('div', { className: 'card' });
    const hdr = el('div', { className: 'card-header-row' });
    hdr.appendChild(el('div', { className: 'card-title', textContent: 'Excluded MUX Pins' }));
    hdr.appendChild(el('span', { id: 'ign-count-label', className: 'card-meta', textContent: '0 / 32' }));
    ignCard.appendChild(hdr);

    const tb = el('div', { className: 'map-ign-toolbar' });
    const btnAdd = el('button', { id: 'btn-add-ignored', className: 'dev-small-btn', type: 'button', textContent: '+ Add Pin' });
    btnAdd.addEventListener('click', () => addIgnoredPotRow());

    const btnAuto = el('button', {
        id: 'btn-auto-ignored',
        className: 'dev-small-btn',
        type: 'button',
        textContent: 'Auto-ignore unmapped',
        title: 'Detect all MUX channels not assigned to any pot'
    });
    btnAuto.addEventListener('click', autoIgnoreUnmappedPins);

    tb.appendChild(btnAdd);
    tb.appendChild(btnAuto);
    ignCard.appendChild(tb);

    const list = el('div', { id: 'ign-tbody', className: 'map-ign-list' });
    ignCard.appendChild(list);
    view.appendChild(ignCard);

    // Clip LEDs (MCP23017 outputs)
    const clipCard = el('div', { className: 'card' });
    const clipHdr = el('div', { className: 'card-header-row' });
    clipHdr.appendChild(el('div', { className: 'card-title', textContent: 'Clip LEDs (MCP23017)' }));
    clipHdr.appendChild(el('span', { className: 'card-meta', textContent: 'Output GPIO pins' }));
    clipCard.appendChild(clipHdr);

    const clipList = el('div', { id: 'map-clip-leds-list', className: 'map-clip-list' });
    CLIP_LED_KEYS.forEach(key => {
        const row = el('div', { className: 'map-clip-row' });
        row.dataset.clipKey = key;

        const enLbl = el('label', { className: 'map-io-check map-clip-name' });
        const enCb = el('input', { type: 'checkbox', className: 'clip-en' });
        enLbl.appendChild(enCb);
        enLbl.appendChild(el('span', { textContent: CLIP_LED_LABELS[key] || key }));
        row.appendChild(enLbl);

        const fields = el('div', { className: 'map-io-fields' });

        const portF = el('label', { className: 'map-field' });
        portF.appendChild(el('span', { className: 'map-field-lbl', textContent: 'Port' }));
        const portSel = el('select', { className: 'clip-port map-select', 'aria-label': `${CLIP_LED_LABELS[key]} LED port` });
        portSel.innerHTML = '<option value="A">A</option><option value="B">B</option>';
        portF.appendChild(portSel);
        fields.appendChild(portF);

        const pinF = el('label', { className: 'map-field' });
        pinF.appendChild(el('span', { className: 'map-field-lbl', textContent: 'Pin' }));
        const pinInp = el('input', {
            type: 'number', min: '0', max: '7', value: '0',
            className: 'clip-pin map-num', 'aria-label': `${CLIP_LED_LABELS[key]} LED pin`
        });
        pinF.appendChild(pinInp);
        fields.appendChild(pinF);

        const alLbl = el('label', { className: 'map-io-check', title: 'LOW turns LED on instead of HIGH' });
        const alCb = el('input', { type: 'checkbox', className: 'clip-activelow' });
        alLbl.appendChild(alCb);
        alLbl.appendChild(el('span', { textContent: 'Active Low' }));
        fields.appendChild(alLbl);

        row.appendChild(fields);
        clipList.appendChild(row);

        _clipLedInputs[key] = { row, enCb, portSel, pinInp, activeLowCb: alCb };

        const onClipEdit = () => {
            const ctx = getContext();
            if (!ctx.clipLedsConfig) ctx.clipLedsConfig = {};
            let pin = parseInt(pinInp.value, 10);
            if (isNaN(pin)) pin = 0;
            pin = Math.max(0, Math.min(7, pin));
            pinInp.value = String(pin);
            ctx.clipLedsConfig[key] = {
                enabled: !!enCb.checked,
                port: portSel.value === 'B' ? 'B' : 'A',
                pin,
                activeLow: !!alCb.checked
            };
            syncClipLedRowDisabled(key);
            ctx.mappingUserEdited = true;
            markMappingDirty();
            updateMappingConflicts();
        };
        enCb.addEventListener('change', onClipEdit);
        portSel.addEventListener('change', onClipEdit);
        pinInp.addEventListener('input', onClipEdit);
        pinInp.addEventListener('change', onClipEdit);
        alCb.addEventListener('change', onClipEdit);
    });
    clipCard.appendChild(clipList);
    renderClipLedsFromContext();
    view.appendChild(clipCard);

    // Boot & System card
    const bootCard = el('div', { className: 'card' });
    bootCard.appendChild(el('div', { className: 'card-title', textContent: 'Boot & System' }));

    const bootRow = el('div', { className: 'map-boot-row' });
    const devLbl = el('label', { className: 'map-io-check map-boot-check' });
    const devCb = el('input', {
        type: 'checkbox',
        id: 'map-dev-mode-boot',
        checked: !!getContext().devModeBoot
    });
    devCb.addEventListener('change', () => {
        getContext().devModeBoot = !!devCb.checked;
        getContext().mappingUserEdited = true;
        markMappingDirty();
    });
    _devModeBootCb = devCb;
    devLbl.appendChild(devCb);
    devLbl.appendChild(el('span', { textContent: 'Boot in Virtual Controls mode (developerMode)' }));
    bootRow.appendChild(devLbl);
    bootCard.appendChild(bootRow);

    const sysRow = el('div', { className: 'map-system-row' });
    const sysHint = el('span', {
        className: 'map-system-hint',
        textContent: 'Full Linux OS reboot (~25–30 s). Temporarily disconnects Wi-Fi / hotspot.'
    });
    const rebootBtn = el('button', {
        type: 'button',
        id: 'btn-reboot-bela',
        className: 'btn-danger-outline',
        textContent: 'Reboot Bela'
    });
    rebootBtn.addEventListener('click', confirmAndRebootBoard);
    sysRow.appendChild(sysHint);
    sysRow.appendChild(rebootBtn);
    bootCard.appendChild(sysRow);
    view.appendChild(bootCard);

    const hwCard = el('div', { className: 'card' });
    hwCard.appendChild(el('div', { className: 'card-title', textContent: 'Hardware Info' }));
    const hwGrid = el('div', { className: 'map-hw-grid' });
    [
        { id: 'hw-mux', label: 'Active MUX', def: '—' },
        { id: 'hw-mcp', label: 'MCP23017', def: '—' },
        { id: 'hw-i2c', label: 'I2C Bus', def: I2C_BUS },
        { id: 'hw-min', label: 'Pot Min', def: '—' },
        { id: 'hw-max', label: 'Pot Max', def: '—' },
        { id: 'hw-scale', label: 'Scale', def: '—' }
    ].forEach(item => {
        const box = el('div', { className: 'map-hw-item' });
        box.appendChild(el('div', { className: 'map-hw-k', textContent: item.label }));
        const valEl = el('div', { className: 'map-hw-v', textContent: item.def });
        _hwValues[item.id] = valEl;
        box.appendChild(valEl);
        hwGrid.appendChild(box);
    });
    hwCard.appendChild(hwGrid);
    view.appendChild(hwCard);

    return view;
}

function getEffectiveHwInfo() {
    const ctx = getContext();
    const base = ctx.loadedConfigBase || ctx.boardConfigJson || {};
    const meta = ctx.configMeta;
    const M = CONFIG_META;

    const activeMux = (base.mux && typeof base.mux.activeMux === 'number')
        ? Math.round(base.mux.activeMux)
        : (meta ? Math.round(meta[M.ACTIVE_MUX]) : 8);
    const mcpAddr = (base.i2c && typeof base.i2c.mcpAddress === 'number')
        ? Math.round(base.i2c.mcpAddress)
        : (meta ? Math.round(meta[M.MCP_ADDR]) : 32);
    const i2cBus = (base.i2c && typeof base.i2c.bus === 'string' && base.i2c.bus)
        ? base.i2c.bus : I2C_BUS;
    const potMin = (base.calibration && typeof base.calibration.potMin === 'number')
        ? base.calibration.potMin
        : (meta ? +meta[M.POT_MIN].toFixed(3) : 0.005);
    const potMax = (base.calibration && typeof base.calibration.potMax === 'number')
        ? base.calibration.potMax
        : (meta ? +meta[M.POT_MAX].toFixed(3) : 0.997);
    const potScaleRecovery = (base.calibration && typeof base.calibration.potScaleRecovery === 'number')
        ? base.calibration.potScaleRecovery
        : (meta ? +meta[M.SCALE].toFixed(4) : 1.2412);

    return { activeMux, mcpAddress: mcpAddr, bus: i2cBus, potMin, potMax, potScaleRecovery };
}

function updateHardwareSummaryFromMeta() {
    const ctx = getContext();
    if (!ctx.configMeta && !ctx.loadedConfigBase && !ctx.boardConfigJson) return;
    const hw = getEffectiveHwInfo();
    if (_hwValues['hw-mux']) _hwValues['hw-mux'].textContent = String(hw.activeMux);
    if (_hwValues['hw-mcp']) _hwValues['hw-mcp'].textContent = '0x' + hw.mcpAddress.toString(16).toUpperCase();
    if (_hwValues['hw-i2c']) _hwValues['hw-i2c'].textContent = hw.bus;
    if (_hwValues['hw-min']) _hwValues['hw-min'].textContent = Number(hw.potMin).toFixed(3);
    if (_hwValues['hw-max']) _hwValues['hw-max'].textContent = Number(hw.potMax).toFixed(3);
    if (_hwValues['hw-scale']) _hwValues['hw-scale'].textContent = Number(hw.potScaleRecovery).toFixed(4);
}

function autoIgnoreUnmappedPins() {
    const activeMux = getActiveMuxCount();
    const next = [];
    for (let m = 0; m < activeMux; m++) {
        for (let p = 0; p < MUX_POTS_PER_MUX; p++) {
            if (!isPotMapped(m, p) && next.length < 32) {
                next.push({ mux: m, pot: p });
            }
        }
    }
    getContext().ignoredPotsList = next;
    getContext().ignoredPotsUserEdited = true;
    markMappingDirty();
    cleanConsoleOfIgnored();
    renderIgnoredPotsTable();
    updateMappingConflicts();
}

function formatRoutingValue(raw, asArray) {
    if (asArray || Array.isArray(raw)) {
        const arr = Array.isArray(raw) ? raw : (raw != null ? [raw] : []);
        return arr.join(',');
    }
    return String(raw != null ? raw : 0);
}

function parseRoutingInput(inp) {
    if (!inp) return null;
    const key = inp.dataset.key;
    const text = String(inp.value).trim();
    if (key === 'master' || key.startsWith('aux')) {
        if (!text) return [];
        const parts = text.split(/[,\s]+/).filter(Boolean);
        const nums = parts.map(p => parseInt(p, 10));
        if (nums.some(n => isNaN(n))) return null;
        return nums;
    }
    const n = parseInt(text, 10);
    return isNaN(n) ? null : n;
}

/** Populates Audio I/O routing fields from a config.routing object (including boot dB gains). */
export function applyRoutingObjectToForm(routing) {
    if (!routing || typeof routing !== 'object') return;
    const inObj = routing.in || {};
    const outObj = routing.out || {};

    document.querySelectorAll('.ri').forEach(inp => {
        const dir = inp.dataset.dir;
        const key = inp.dataset.key;
        const src = dir === 'in' ? inObj[key] : outObj[key];
        if (src === undefined) return;
        const ch = dir === 'in' ? routingInChannel(src) : routingOutChannel(src);
        inp.value = formatRoutingValue(ch, key === 'master' || key.startsWith('aux'));
    });

    document.querySelectorAll('.ri-gain').forEach(inp => {
        const dir = inp.dataset.dir;
        const key = inp.dataset.key;
        const src = dir === 'in' ? inObj[key] : outObj[key];
        if (src === undefined) return;
        inp.value = String(routingGain(src));
    });

    document.querySelectorAll('.ri-mic').forEach(cb => {
        const src = inObj[cb.dataset.key];
        if (src !== undefined) cb.checked = routingInMic(src);
    });

    document.querySelectorAll('.ri-hpf').forEach(inp => {
        const src = inObj[inp.dataset.key];
        if (src !== undefined) inp.value = String(Math.round(routingInHpf(src)));
    });

    document.querySelectorAll('.ri-stereo').forEach(cb => {
        const src = outObj[cb.dataset.key];
        if (src !== undefined) cb.checked = routingOutStereo(src);
    });

    updateMappingConflicts();
}

/** Overwrites routing & advanced fields from live Bela configMeta (fallback when config.json not fetched). */
export function fillRoutingFromConfigMeta() {
    const ctx = getContext();
    if (!ctx.configMeta) return;
    updateHardwareSummaryFromMeta();

    // Also hydrate boot developerMode & clipLeds from buffer 6 when not yet populated from config.json
    const M = CONFIG_META;
    const meta = ctx.configMeta;
    if (!ctx.mappingUserEdited && !ctx.boardConfigJson) {
        if (meta.length > M.DEV_MODE_BOOT) {
            ctx.devModeBoot = meta[M.DEV_MODE_BOOT] > 0.5;
            if (_devModeBootCb) _devModeBootCb.checked = ctx.devModeBoot;
        }
        if (meta.length >= M.CLIP_LED_BASE + CLIP_LED_KEYS.length) {
            if (!ctx.clipLedsConfig) ctx.clipLedsConfig = {};
            CLIP_LED_KEYS.forEach((key, idx) => {
                ctx.clipLedsConfig[key] = decodeClipLedMeta(meta[M.CLIP_LED_BASE + idx]);
            });
            renderClipLedsFromContext();
        }
    }

    if (ctx.routingFilledFromConfigJson || ctx.routingFilledFromMeta) return;
    ctx.routingFilledFromMeta = true;
    const masterCount = Math.round(meta[M.MASTER_COUNT]);
    const masterOuts = [];
    if (masterCount > 0) masterOuts.push(Math.round(meta[M.MASTER_0]));
    if (masterCount > 1) masterOuts.push(Math.round(meta[M.MASTER_1]));

    const getAuxIns = (leftIdx, rightIdx) => {
        const l = Math.round(meta[leftIdx]);
        const r = (meta.length > rightIdx) ? Math.round(meta[rightIdx]) : -1;
        return (r >= 0) ? [l, r] : [l];
    };

    const values = {
        in: {
            fx1Return: [Math.round(meta[M.FX1_RET])],
            fx2Return: [Math.round(meta[M.FX2_RET])],
            aux1: getAuxIns(M.AUX1, M.AUX1_R),
            aux2: getAuxIns(M.AUX2, M.AUX2_R),
            aux3: getAuxIns(M.AUX3, M.AUX3_R),
            aux4: getAuxIns(M.AUX4, M.AUX4_R)
        },
        out: {
            master: masterOuts,
            fx1Send: [Math.round(meta[M.FX1_SEND])],
            fx2Send: [Math.round(meta[M.FX2_SEND])],
            vuSub: Math.round(meta[M.VU_SUB]),
            vuKick: Math.round(meta[M.VU_KICK]),
            vuMid: Math.round(meta[M.VU_MID]),
            vuTop: Math.round(meta[M.VU_TOP])
        }
    };

    const micFlags = {
        aux1: meta[M.MIC_AUX1] > 0.5,
        aux2: meta[M.MIC_AUX2] > 0.5,
        aux3: meta[M.MIC_AUX3] > 0.5,
        aux4: meta[M.MIC_AUX4] > 0.5
    };

    const hpfHz = {
        aux1: meta[M.HPF_AUX1] != null ? meta[M.HPF_AUX1] : 0,
        aux2: meta[M.HPF_AUX2] != null ? meta[M.HPF_AUX2] : 0,
        aux3: meta[M.HPF_AUX3] != null ? meta[M.HPF_AUX3] : 0,
        aux4: meta[M.HPF_AUX4] != null ? meta[M.HPF_AUX4] : 0
    };

    document.querySelectorAll('.ri').forEach(inp => {
        const dir = inp.dataset.dir;
        const key = inp.dataset.key;
        const raw = values[dir] && values[dir][key];
        if (raw === undefined) return;
        inp.value = formatRoutingValue(raw, key === 'master' || key.startsWith('aux'));
    });

    document.querySelectorAll('.ri-mic').forEach(cb => {
        cb.checked = !!micFlags[cb.dataset.key];
    });

    const isMasterStereo = (meta.length > M.MASTER_STEREO) ? (meta[M.MASTER_STEREO] > 0.5) : true;
    document.querySelectorAll('.ri-stereo').forEach(cb => {
        cb.checked = isMasterStereo;
    });

    document.querySelectorAll('.ri-hpf').forEach(inp => {
        const hz = hpfHz[inp.dataset.key];
        inp.value = hz != null ? String(Math.round(hz)) : '0';
    });
    updateMappingConflicts();
}

function collectRoutingFromForm() {
    const readChannel = (dir, key) => {
        const inp = document.querySelector(`.ri[data-dir="${dir}"][data-key="${key}"]`);
        const parsed = parseRoutingInput(inp);
        if (parsed === null) return undefined;
        if (key === 'master' || key.startsWith('aux'))
            return Array.isArray(parsed) ? parsed : [parsed];
        return parsed;
    };

    const readMic = (key) => {
        const cb = document.querySelector(`.ri-mic[data-key="${key}"]`);
        return cb ? !!cb.checked : false;
    };

    const readMasterStereo = () => {
        const cb = document.querySelector('.ri-stereo[data-key="master"]');
        return cb ? !!cb.checked : true;
    };

    const readHpf = (key) => {
        const inp = document.querySelector(`.ri-hpf[data-key="${key}"]`);
        if (!inp) return 0;
        const n = parseFloat(inp.value);
        if (isNaN(n) || n < 0) return 0;
        return Math.min(MIC_HPF_HZ_MAX, Math.max(MIC_HPF_HZ_MIN, Math.round(n)));
    };

    const readGain = (dir, key) => {
        const inp = document.querySelector(`.ri-gain[data-dir="${dir}"][data-key="${key}"]`);
        if (!inp) return 0;
        const n = parseFloat(inp.value);
        if (isNaN(n)) return 0;
        if (dir === 'in') return Math.min(INPUT_GAIN_MAX, Math.max(INPUT_GAIN_MIN, Math.round(n)));
        return Math.min(OUTPUT_GAIN_MAX, Math.max(OUTPUT_GAIN_MIN, Math.round(n)));
    };

    const out = {};
    ROUTING_OUT_KEYS.forEach(key => {
        const val = readChannel('out', key);
        if (val === undefined) return;
        const gain = readGain('out', key);
        if (key === 'master')
            out[key] = { channels: Array.isArray(val) ? val : [val], stereo: readMasterStereo(), gain };
        else if (key.startsWith('fx'))
            out[key] = { channels: Array.isArray(val) ? val : [val], gain };
        else
            out[key] = { channel: val, gain };
    });

    const inn = {};
    ROUTING_IN_KEYS.forEach(key => {
        const ch = readChannel('in', key);
        if (ch === undefined) return;
        const isAux = key.startsWith('aux');
        inn[key] = {
            channels: Array.isArray(ch) ? ch : [ch],
            mic: isAux ? readMic(key) : false,
            hpf: isAux ? readHpf(key) : 0,
            gain: readGain('in', key)
        };
    });

    return { out, in: inn };
}

/** Builds grouped, responsive control rows once potMapping & switchMapping arrive. */
export function tryBuildMappingTable() {
    const ctx = getContext();
    if (ctx.mappingBuilt || !ctx.potMapping || !ctx.switchMapping) return;
    ctx.mappingBuilt = true;

    const host = document.getElementById('map-groups-host');
    if (host) {
        host.innerHTML = '';

        CONTROL_GROUPS.forEach(grpDef => {
            const grp = el('div', { className: 'map-group' });
            grp.dataset.groupId = grpDef.id;
            grp.dataset.collapsed = grpDef.defaultOpen ? 'false' : 'true';

            const hdr = el('button', {
                type: 'button',
                className: 'map-group-hdr',
                'aria-expanded': grpDef.defaultOpen ? 'true' : 'false'
            });
            hdr.appendChild(el('span', { className: 'map-group-title', textContent: grpDef.title }));
            hdr.appendChild(el('span', { className: 'map-group-count', textContent: String(grpDef.items.length) }));
            hdr.addEventListener('click', () => {
                const nextClosed = grp.dataset.collapsed !== 'true';
                grp.dataset.collapsed = nextClosed ? 'true' : 'false';
                hdr.setAttribute('aria-expanded', nextClosed ? 'false' : 'true');
            });
            grp.appendChild(hdr);

            const body = el('div', { className: 'map-group-body' });

            grpDef.items.forEach(item => {
                if (item.table === 'pot') {
                    const i = POT_INDEX[item.name];
                    if (i === undefined) return;
                    const mux = Math.round(ctx.potMapping[i * 4 + 0]);
                    const pot = Math.round(ctx.potMapping[i * 4 + 1]);
                    const rev = ctx.potMapping[i * 4 + 2] > 0.5;
                    ctx.potMapping[i * 4 + 3] = isPotCentered(item.name) ? 1.0 : 0.0;

                    const row = el('div', { className: 'map-row' });
                    row.dataset.mapTable = 'pot';
                    row.dataset.mapIndex = String(i);
                    row.dataset.search = `${grpDef.title} ${item.label} ${item.name}`;

                    const main = el('div', { className: 'map-row-main' });
                    main.appendChild(el('div', { className: 'map-row-name', textContent: item.label, title: item.name }));
                    row.appendChild(main);

                    const meter = el('div', { className: 'map-live-meter', title: 'Live pot position' });
                    const fill = el('div', { className: 'map-live-fill' });
                    meter.appendChild(fill);
                    _potLiveFills[i] = fill;
                    row.appendChild(meter);

                    const fields = el('div', { className: 'map-row-fields' });
                    const muxF = el('label', { className: 'map-field' });
                    muxF.appendChild(el('span', { className: 'map-field-lbl', textContent: 'MUX' }));
                    const muxInp = el('input', {
                        type: 'number', min: '0', max: '7', value: String(mux),
                        className: 'pi map-num', 'aria-label': `${item.label} MUX`
                    });
                    muxInp.dataset.i = String(i);
                    muxInp.dataset.f = 'mux';
                    muxF.appendChild(muxInp);

                    const chF = el('label', { className: 'map-field' });
                    chF.appendChild(el('span', { className: 'map-field-lbl', textContent: 'Ch' }));
                    const potInp = el('input', {
                        type: 'number', min: '0', max: '9', value: String(pot),
                        className: 'pi map-num', 'aria-label': `${item.label} channel`
                    });
                    potInp.dataset.i = String(i);
                    potInp.dataset.f = 'pot';
                    chF.appendChild(potInp);

                    fields.appendChild(muxF);
                    fields.appendChild(chF);
                    row.appendChild(fields);

                    const actions = el('div', { className: 'map-row-actions' });
                    const revBtn = el('button', {
                        type: 'button',
                        className: 'btn-rev-toggle' + (rev ? ' active' : ''),
                        textContent: 'Rev',
                        title: 'Reverse rotation direction',
                        'aria-label': `Reverse ${item.label}`,
                        'aria-pressed': rev ? 'true' : 'false'
                    });
                    revBtn.dataset.i = String(i);
                    revBtn.dataset.f = 'rev';
                    revBtn.addEventListener('click', () => {
                        const nextRev = !revBtn.classList.contains('active');
                        setPotRevState(i, nextRev);
                        ctx.mappingUserEdited = true;
                        markMappingDirty();
                        updateMappingConflicts();
                    });
                    _potRevButtons[i] = revBtn;

                    actions.appendChild(revBtn);
                    actions.appendChild(createDetectButton('pot', i));
                    row.appendChild(actions);

                    const handlePotField = () => {
                        ctx.mappingUserEdited = true;
                        markMappingDirty();
                        ctx.potMapping[i * 4 + 0] = parseFloat(muxInp.value) || 0;
                        ctx.potMapping[i * 4 + 1] = parseFloat(potInp.value) || 0;
                        cleanConsoleOfIgnored();
                        updateMappingConflicts();
                    };
                    muxInp.addEventListener('input', handlePotField);
                    muxInp.addEventListener('change', handlePotField);
                    potInp.addEventListener('input', handlePotField);
                    potInp.addEventListener('change', handlePotField);

                    body.appendChild(row);
                } else {
                    const i = SW_INDEX[item.name];
                    if (i === undefined) return;
                    const pin = Math.round(ctx.switchMapping[i * 3 + 0]);
                    const portB = ctx.switchMapping[i * 3 + 1] > 0.5;
                    const rev = ctx.switchMapping[i * 3 + 2] > 0.5;

                    const row = el('div', { className: 'map-row' });
                    row.dataset.mapTable = 'sw';
                    row.dataset.mapIndex = String(i);
                    row.dataset.search = `${grpDef.title} ${item.label} ${item.name} switch`;

                    const main = el('div', { className: 'map-row-main' });
                    main.appendChild(el('div', { className: 'map-row-name', textContent: item.label, title: item.name }));
                    row.appendChild(main);

                    const meter = el('div', { className: 'map-live-meter', title: 'Live switch state' });
                    const fill = el('div', { className: 'map-live-fill sw' });
                    meter.appendChild(fill);
                    _swLiveFills[i] = fill;
                    row.appendChild(meter);

                    const fields = el('div', { className: 'map-row-fields' });
                    const portF = el('label', { className: 'map-field' });
                    portF.appendChild(el('span', { className: 'map-field-lbl', textContent: 'Port' }));
                    const portSel = el('select', { className: 'si map-select', 'aria-label': `${item.label} port` });
                    portSel.dataset.i = String(i);
                    portSel.dataset.f = 'port';
                    portSel.innerHTML = `<option value="0"${!portB ? ' selected' : ''}>A</option><option value="1"${portB ? ' selected' : ''}>B</option>`;
                    portF.appendChild(portSel);

                    const pinF = el('label', { className: 'map-field' });
                    pinF.appendChild(el('span', { className: 'map-field-lbl', textContent: 'Pin' }));
                    const pinInp = el('input', {
                        type: 'number', min: '0', max: '7', value: String(pin),
                        className: 'si map-num', 'aria-label': `${item.label} pin`
                    });
                    pinInp.dataset.i = String(i);
                    pinInp.dataset.f = 'pin';
                    pinF.appendChild(pinInp);

                    fields.appendChild(portF);
                    fields.appendChild(pinF);
                    row.appendChild(fields);

                    const actions = el('div', { className: 'map-row-actions' });
                    const revBtn = el('button', {
                        type: 'button',
                        className: 'btn-rev-toggle' + (rev ? ' active' : ''),
                        textContent: 'Rev',
                        title: 'Invert active polarity',
                        'aria-label': `Invert ${item.label}`,
                        'aria-pressed': rev ? 'true' : 'false'
                    });
                    revBtn.dataset.i = String(i);
                    revBtn.dataset.f = 'rev';
                    revBtn.addEventListener('click', () => {
                        const nextRev = !revBtn.classList.contains('active');
                        setSwitchRevState(i, nextRev);
                        ctx.mappingUserEdited = true;
                        markMappingDirty();
                        updateMappingConflicts();
                    });
                    _swRevButtons[i] = revBtn;

                    actions.appendChild(revBtn);
                    actions.appendChild(createDetectButton('sw', i));
                    row.appendChild(actions);

                    const handleSwField = () => {
                        ctx.mappingUserEdited = true;
                        markMappingDirty();
                        ctx.switchMapping[i * 3 + 0] = parseFloat(pinInp.value) || 0;
                        ctx.switchMapping[i * 3 + 1] = parseFloat(portSel.value) || 0;
                        updateMappingConflicts();
                    };
                    pinInp.addEventListener('input', handleSwField);
                    pinInp.addEventListener('change', handleSwField);
                    portSel.addEventListener('input', handleSwField);
                    portSel.addEventListener('change', handleSwField);

                    body.appendChild(row);
                }
            });

            grp.appendChild(body);
            host.appendChild(grp);
        });
    }

    renderIgnoredPotsTable();
    updateMappingConflicts();
    applyControlFilters();
}

function setPotRevState(i, rev) {
    const btn = _potRevButtons[i];
    if (btn) {
        btn.classList.toggle('active', !!rev);
        btn.setAttribute('aria-pressed', rev ? 'true' : 'false');
    }
    if (getContext().potMapping) {
        getContext().potMapping[i * 4 + 2] = rev ? 1.0 : 0.0;
    }
}

function setSwitchRevState(i, rev) {
    const btn = _swRevButtons[i];
    if (btn) {
        btn.classList.toggle('active', !!rev);
        btn.setAttribute('aria-pressed', rev ? 'true' : 'false');
    }
    if (getContext().switchMapping) {
        getContext().switchMapping[i * 3 + 2] = rev ? 1.0 : 0.0;
    }
}

/** Updates live activity bars on Mapping control rows when Mapping Controls view is visible. */
export function updateMappingLive() {
    const ctx = getContext();
    if (!ctx.mappingBuilt || ctx.mappingSubTab !== 'controls') return;

    if (ctx.potValues) {
        for (let i = 0; i < POT_NAMES.length; i++) {
            const fill = _potLiveFills[i];
            if (!fill) continue;
            const pct = Math.max(0, Math.min(100, (ctx.potValues[i] || 0) * 100)).toFixed(0) + '%';
            if (fill.style.width !== pct) fill.style.width = pct;
        }
    }
    if (ctx.switchStates) {
        for (let i = 0; i < SWITCH_NAMES.length; i++) {
            const fill = _swLiveFills[i];
            if (!fill) continue;
            const on = (ctx.switchStates[i] || 0) > 0.5;
            const pct = on ? '100%' : '0%';
            if (fill.style.width !== pct) fill.style.width = pct;
        }
    }
}

/** Highlights duplicate channels across pots, switches, clip LEDs, audio routing, and ignored pins. */
function updateMappingConflicts() {
    const messages = [];

    document.querySelectorAll('.map-row, .map-ign-row, .map-io-row, .map-clip-row')
        .forEach(row => row.classList.remove('dup-conflict'));

    if (getContext().mappingBuilt) {
        const potGroups = new Map();
        for (let i = 0; i < POT_NAMES.length; i++) {
            const muxInp = document.querySelector(`.pi[data-i="${i}"][data-f="mux"]`);
            const potInp = document.querySelector(`.pi[data-i="${i}"][data-f="pot"]`);
            if (!muxInp || !potInp) continue;
            const mux = parseInt(muxInp.value, 10);
            const pot = parseInt(potInp.value, 10);
            if (isNaN(mux) || isNaN(pot)) continue;
            const key = mux + ':' + pot;
            if (!potGroups.has(key)) potGroups.set(key, []);
            potGroups.get(key).push(i);
        }
        potGroups.forEach((indices, key) => {
            if (indices.length < 2) return;
            const parts = key.split(':');
            const names = indices.map(i => POT_NAMES[i]).join(', ');
            messages.push(`Pot MUX ${parts[0]} / Ch ${parts[1]}: ${names}`);
            indices.forEach(i => {
                const row = document.querySelector(`.map-row[data-map-table="pot"][data-map-index="${i}"]`);
                if (row) row.classList.add('dup-conflict');
            });
        });

        const mcpGroups = new Map();
        for (let i = 0; i < SWITCH_NAMES.length; i++) {
            const pinInp = document.querySelector(`.si[data-i="${i}"][data-f="pin"]`);
            const portInp = document.querySelector(`.si[data-i="${i}"][data-f="port"]`);
            if (!pinInp || !portInp) continue;
            const pin = parseInt(pinInp.value, 10);
            const port = parseInt(portInp.value, 10);
            if (isNaN(pin) || isNaN(port)) continue;
            const key = port + ':' + pin;
            if (!mcpGroups.has(key)) mcpGroups.set(key, []);
            mcpGroups.get(key).push({ kind: 'sw', idx: i, label: SWITCH_NAMES[i] });
        }

        const clipCfg = getContext().clipLedsConfig || {};
        CLIP_LED_KEYS.forEach(clipKey => {
            const c = clipCfg[clipKey];
            if (!c || !c.enabled) return;
            const portNum = c.port === 'B' ? 1 : 0;
            const pin = Math.round(Number(c.pin));
            if (isNaN(pin)) return;
            const key = portNum + ':' + pin;
            if (!mcpGroups.has(key)) mcpGroups.set(key, []);
            mcpGroups.get(key).push({ kind: 'clip', key: clipKey, label: `Clip ${CLIP_LED_LABELS[clipKey] || clipKey}` });
        });

        mcpGroups.forEach((entries, key) => {
            if (entries.length < 2) return;
            const parts = key.split(':');
            const portLabel = parts[0] === '1' ? 'B' : 'A';
            const names = entries.map(e => e.label).join(', ');
            messages.push(`MCP23017 Port ${portLabel} / Pin ${parts[1]}: ${names}`);
            entries.forEach(e => {
                if (e.kind === 'sw') {
                    const row = document.querySelector(`.map-row[data-map-table="sw"][data-map-index="${e.idx}"]`);
                    if (row) row.classList.add('dup-conflict');
                } else {
                    const row = document.querySelector(`.map-clip-row[data-clip-key="${e.key}"]`);
                    if (row) row.classList.add('dup-conflict');
                }
            });
        });
    }

    ['in', 'out'].forEach(dir => {
        const groups = new Map();
        document.querySelectorAll(`.ri[data-dir="${dir}"]`).forEach(inp => {
            const parsed = parseRoutingInput(inp);
            if (parsed === null) return;
            const chans = Array.isArray(parsed) ? parsed : [parsed];
            const seenInField = new Set();
            chans.forEach(ch => {
                if (typeof ch !== 'number' || isNaN(ch) || ch < 0) return;
                if (seenInField.has(ch)) {
                    messages.push(`Audio ${dir} Ch ${ch}: ${ROUTING_LABELS[inp.dataset.key] || inp.dataset.key} duplicate`);
                    const row = inp.closest('.map-io-row');
                    if (row) row.classList.add('dup-conflict');
                    return;
                }
                seenInField.add(ch);
                if (!groups.has(ch)) groups.set(ch, []);
                groups.get(ch).push({ key: inp.dataset.key, inp });
            });
        });
        groups.forEach((entries, ch) => {
            const keys = [...new Set(entries.map(e => e.key))];
            if (keys.length < 2) return;
            messages.push(`Audio ${dir} Ch ${ch}: ${keys.map(k => ROUTING_LABELS[k] || k).join(', ')}`);
            entries.forEach(e => {
                const row = e.inp.closest('.map-io-row');
                if (row) row.classList.add('dup-conflict');
            });
        });
    });

    if (Array.isArray(getContext().ignoredPotsList)) {
        const ignGroups = new Map();
        getContext().ignoredPotsList.forEach((item, idx) => {
            const key = item.mux + ':' + item.pot;
            if (!ignGroups.has(key)) ignGroups.set(key, []);
            ignGroups.get(key).push(idx);
        });
        ignGroups.forEach((indices, key) => {
            if (indices.length < 2) return;
            const parts = key.split(':');
            messages.push(`Excluded MUX ${parts[0]} / Ch ${parts[1]} duplicated`);
            indices.forEach(idx => {
                const row = document.querySelector(`.map-ign-row[data-ign-index="${idx}"]`);
                if (row) row.classList.add('dup-conflict');
            });
        });
    }

    document.querySelectorAll('.map-ign-row[data-ign-index]').forEach(row => {
        const idx = parseInt(row.dataset.ignIndex, 10);
        const list = getContext().ignoredPotsList;
        if (list && list[idx]) {
            const name = getMappedPotName(list[idx].mux, list[idx].pot);
            const statusEl = row.querySelector('.map-ign-status');
            if (statusEl) {
                statusEl.className = 'map-ign-status' + (name ? ' mapped' : '');
                statusEl.textContent = name ? `Mapped: ${name}` : 'Floating / Unassigned';
            }
        }
    });

    const pill = document.getElementById('map-conflict-pill');
    if (pill) {
        pill.classList.toggle('show', messages.length > 0);
        pill.textContent = messages.length === 1 ? '1 Conflict' : `${messages.length} Conflicts`;
    }

    const banner = document.getElementById('mapping-conflicts');
    const list = document.getElementById('mapping-conflicts-list');
    if (!banner || !list) return;

    if (messages.length === 0) {
        banner.classList.remove('show');
        list.innerHTML = '';
        if (getContext().mappingFilter === 'conflicts') applyControlFilters();
        return;
    }

    banner.classList.add('show');
    list.innerHTML = messages.map(m => '<li>' + m + '</li>').join('');
    if (getContext().mappingFilter === 'conflicts') applyControlFilters();
}

function createDetectButton(table, index) {
    const btn = el('button', { className: 'btn-detect-row', type: 'button', textContent: 'Learn' });
    btn.title = 'Auto-detect physical control';
    btn.dataset.table = table;
    btn.dataset.index = String(index);
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (getContext().detectMode &&
            getContext().detectMode.table === table &&
            getContext().detectMode.targetIndex === index) {
            cancelDetect();
        } else {
            getContext().mappingGuided = null;
            updateGuidedBar();
            startDetect(table, index);
        }
    });
    return btn;
}

function showDetectStatus(msg, isError) {
    if (!getContext().detectStatusEl) return;
    getContext().detectStatusEl.textContent = msg;
    getContext().detectStatusEl.className = isError ? 'map-conflicts-box show' : 'map-guided-bar listening';
}

function hideDetectStatus() {
    if (!getContext().detectStatusEl) return;
    getContext().detectStatusEl.textContent = '';
    getContext().detectStatusEl.className = '';
}

function setDetectUiActive(active) {
    document.querySelectorAll('.btn-detect-row[data-table]').forEach(btn => {
        const t = btn.dataset.table;
        const i = parseInt(btn.dataset.index, 10);
        const isTarget = active && getContext().detectMode &&
            getContext().detectMode.table === t &&
            getContext().detectMode.targetIndex === i;
        btn.textContent = isTarget ? 'Cancel' : 'Learn';
        btn.classList.toggle('detect-active', isTarget);
        btn.disabled = active && !isTarget;
    });
    document.querySelectorAll('.map-row').forEach(row => row.classList.remove('row-detecting'));
    if (active && getContext().detectMode) {
        const row = document.querySelector(
            `.map-row[data-map-table="${getContext().detectMode.table}"][data-map-index="${getContext().detectMode.targetIndex}"]`
        );
        if (row) {
            row.classList.add('row-detecting');
            const grp = row.closest('.map-group');
            if (grp && grp.dataset.collapsed === 'true') {
                grp.dataset.collapsed = 'false';
                const hdr = grp.querySelector('.map-group-hdr');
                if (hdr) hdr.setAttribute('aria-expanded', 'true');
            }
            if (getContext().mappingGuided) {
                row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }
}

function buildGuidedQueue() {
    const queue = [];
    CONTROL_GROUPS.forEach(grp => {
        grp.items.forEach(item => {
            const index = item.table === 'pot' ? POT_INDEX[item.name] : SW_INDEX[item.name];
            if (index !== undefined) {
                queue.push({
                    table: item.table,
                    index,
                    group: grp.title,
                    label: item.label
                });
            }
        });
    });
    return queue;
}

function updateGuidedBar() {
    const bar = document.getElementById('map-guided-bar');
    const stepEl = document.getElementById('map-guided-step');
    const promptEl = document.getElementById('map-guided-prompt');
    const startBtn = document.getElementById('btn-guided-start');
    const skipBtn = document.getElementById('btn-guided-skip');
    const stopBtn = document.getElementById('btn-guided-stop');
    if (!bar || !stepEl || !promptEl) return;

    const guided = getContext().mappingGuided;
    if (!guided) {
        bar.classList.remove('listening');
        stepEl.textContent = 'Setup Assistant';
        promptEl.textContent = 'Map pots and switches step by step';
        if (startBtn) startBtn.style.display = '';
        if (skipBtn) skipBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'none';
        return;
    }

    const cur = guided.queue[guided.cursor];
    bar.classList.add('listening');
    stepEl.textContent = `Step ${guided.cursor + 1} / ${guided.queue.length} · ${cur.group}`;
    promptEl.textContent = cur.table === 'pot'
        ? `${cur.label}: move physical pot (≥25%)`
        : `${cur.label}: toggle physical switch`;
    if (startBtn) startBtn.style.display = 'none';
    if (skipBtn) skipBtn.style.display = '';
    if (stopBtn) stopBtn.style.display = '';
}

function startGuidedSetup() {
    if (!getContext().mappingBuilt) {
        showDetectStatus('Waiting for Bela mapping…', true);
        return;
    }
    if (typeof Bela === 'undefined') {
        showDetectStatus('Bela not connected', true);
        return;
    }
    const queue = buildGuidedQueue();
    if (!queue.length) return;
    getContext().mappingGuided = { queue, cursor: 0 };
    updateGuidedBar();
    const cur = queue[0];
    startDetect(cur.table, cur.index);
}

function skipGuidedStep() {
    const guided = getContext().mappingGuided;
    if (!guided) return;
    if (_guidedTimer) {
        clearTimeout(_guidedTimer);
        _guidedTimer = null;
    }
    guided.cursor++;
    if (guided.cursor >= guided.queue.length) {
        showDownloadStatus('Guided setup complete ✓', false);
        cancelDetect();
        return;
    }
    updateGuidedBar();
    const next = guided.queue[guided.cursor];
    startDetect(next.table, next.index);
}

function advanceGuidedAfterHit() {
    const guided = getContext().mappingGuided;
    if (!guided) {
        cancelDetect();
        return;
    }
    getContext().detectMode = null;
    setDetectUiActive(false);

    guided.cursor++;
    if (guided.cursor >= guided.queue.length) {
        showDownloadStatus('Guided setup complete ✓', false);
        getContext().mappingGuided = null;
        updateGuidedBar();
        hideDetectStatus();
        return;
    }
    const promptEl = document.getElementById('map-guided-prompt');
    if (promptEl) promptEl.textContent = 'Detected — preparing next control…';
    if (_guidedTimer) clearTimeout(_guidedTimer);
    _guidedTimer = setTimeout(() => {
        _guidedTimer = null;
        if (!getContext().mappingGuided) return;
        updateGuidedBar();
        const next = getContext().mappingGuided.queue[getContext().mappingGuided.cursor];
        startDetect(next.table, next.index);
    }, GUIDED_SETTLE_MS);
}

export function muxRawIndex(mux, pot) {
    return mux * MUX_POTS_PER_MUX + pot;
}

export function getActiveMuxCount() {
    if (getContext().configMeta && getContext().configMeta.length > CONFIG_META.ACTIVE_MUX)
        return Math.max(1, Math.round(getContext().configMeta[CONFIG_META.ACTIVE_MUX]));
    return 8;
}

export function isPotIgnored(mux, pot) {
    if (Array.isArray(getContext().ignoredPotsList)) {
        return getContext().ignoredPotsList.some(
            p => Math.round(p.mux) === mux && Math.round(p.pot) === pot
        );
    }
    if (getContext().configMeta) {
        const count = Math.round(getContext().configMeta[CONFIG_META.IGNORED_COUNT]);
        for (let i = 0; i < count; i++) {
            const base = CONFIG_META.IGNORED_BASE + i * 2;
            if (Math.round(getContext().configMeta[base]) === mux &&
                Math.round(getContext().configMeta[base + 1]) === pot)
                return true;
        }
    }
    if (Array.isArray(IGNORED_POTS_DEFAULT)) {
        return IGNORED_POTS_DEFAULT.some(
            p => Math.round(p.mux) === mux && Math.round(p.pot) === pot
        );
    }
    return false;
}

export function getPotMuxChannel(potIndex) {
    const muxInp = document.querySelector(`.pi[data-i="${potIndex}"][data-f="mux"]`);
    const potInp = document.querySelector(`.pi[data-i="${potIndex}"][data-f="pot"]`);
    if (muxInp && potInp) {
        const m = parseInt(muxInp.value, 10);
        const p = parseInt(potInp.value, 10);
        if (!isNaN(m) && !isNaN(p)) return { mux: m, pot: p };
    }
    if (getContext().potMapping && getContext().potMapping.length > potIndex * 4 + 1) {
        return {
            mux: Math.round(getContext().potMapping[potIndex * 4 + 0]),
            pot: Math.round(getContext().potMapping[potIndex * 4 + 1])
        };
    }
    return null;
}

export function getMappedPotName(mux, pot) {
    for (let i = 0; i < POT_NAMES.length; i++) {
        const coords = getPotMuxChannel(i);
        if (coords && coords.mux === mux && coords.pot === pot)
            return POT_NAMES[i];
    }
    return null;
}

function ensureIgnoredPotsList() {
    if (!Array.isArray(getContext().ignoredPotsList)) {
        if (Array.isArray(IGNORED_POTS_DEFAULT) && IGNORED_POTS_DEFAULT.length > 0) {
            getContext().ignoredPotsList = IGNORED_POTS_DEFAULT.map(p => ({
                mux: Math.max(0, Math.min(7, Math.round(p.mux))),
                pot: Math.max(0, Math.min(9, Math.round(p.pot)))
            }));
        } else {
            getContext().ignoredPotsList = [];
        }
    }
    return getContext().ignoredPotsList;
}

export function renderIgnoredPotsTable() {
    const tbody = document.getElementById('ign-tbody');
    if (!tbody) return;

    const list = ensureIgnoredPotsList();
    const countLabel = document.getElementById('ign-count-label');
    if (countLabel) countLabel.textContent = `${list.length} / 32`;

    const btnAdd = document.getElementById('btn-add-ignored');
    if (btnAdd) btnAdd.disabled = list.length >= 32;

    if (list.length === 0) {
        tbody.innerHTML = '<div class="map-empty">No excluded MUX pins.</div>';
        return;
    }

    tbody.innerHTML = '';
    list.forEach((item, idx) => {
        const row = el('div', { className: 'map-ign-row' });
        row.dataset.ignIndex = String(idx);

        const muxF = el('label', { className: 'map-field' });
        muxF.appendChild(el('span', { className: 'map-field-lbl', textContent: 'MUX' }));
        const muxInp = el('input', {
            type: 'number', min: '0', max: '7', value: String(item.mux),
            className: 'ii map-num', 'aria-label': `Ignored pin ${idx + 1} MUX`
        });
        muxInp.dataset.idx = String(idx);
        muxInp.dataset.f = 'mux';
        muxF.appendChild(muxInp);

        const chF = el('label', { className: 'map-field' });
        chF.appendChild(el('span', { className: 'map-field-lbl', textContent: 'Ch' }));
        const chInp = el('input', {
            type: 'number', min: '0', max: '9', value: String(item.pot),
            className: 'ii map-num', 'aria-label': `Ignored pin ${idx + 1} channel`
        });
        chInp.dataset.idx = String(idx);
        chInp.dataset.f = 'pot';
        chF.appendChild(chInp);

        const mappedName = getMappedPotName(item.mux, item.pot);
        const statusEl = el('span', {
            className: 'map-ign-status' + (mappedName ? ' mapped' : ''),
            textContent: mappedName ? `Mapped: ${mappedName}` : 'Floating / Unassigned'
        });

        const delBtn = el('button', {
            type: 'button',
            className: 'btn-del-ign',
            textContent: '×',
            title: 'Remove excluded pin',
            'aria-label': `Remove excluded MUX ${item.mux} Ch ${item.pot}`
        });
        delBtn.addEventListener('click', () => removeIgnoredPotRow(idx));

        [muxInp, chInp].forEach(input => {
            input.addEventListener('change', (e) => {
                const field = e.target.dataset.f;
                let val = parseInt(e.target.value, 10);
                if (isNaN(val)) val = 0;
                val = field === 'mux' ? Math.max(0, Math.min(7, val)) : Math.max(0, Math.min(9, val));
                e.target.value = String(val);
                list[idx][field] = val;
                getContext().ignoredPotsUserEdited = true;
                markMappingDirty();
                cleanConsoleOfIgnored();
                renderIgnoredPotsTable();
                updateMappingConflicts();
            });
        });

        row.appendChild(muxF);
        row.appendChild(chF);
        row.appendChild(statusEl);
        row.appendChild(delBtn);
        tbody.appendChild(row);
    });
}

export function addIgnoredPotRow(mux, pot) {
    const list = ensureIgnoredPotsList();
    if (list.length >= 32) return;

    const m = (mux !== undefined) ? mux : 7;
    let p = (pot !== undefined) ? pot : 0;
    if (mux === undefined && pot === undefined) {
        for (let tryP = 0; tryP < 10; tryP++) {
            if (!list.some(item => item.mux === m && item.pot === tryP)) {
                p = tryP;
                break;
            }
        }
    }

    list.push({ mux: m, pot: p });
    getContext().ignoredPotsUserEdited = true;
    markMappingDirty();
    cleanConsoleOfIgnored();
    renderIgnoredPotsTable();
    updateMappingConflicts();
}

export function removeIgnoredPotRow(idx) {
    const list = ensureIgnoredPotsList();
    if (idx >= 0 && idx < list.length) {
        list.splice(idx, 1);
        getContext().ignoredPotsUserEdited = true;
        markMappingDirty();
        cleanConsoleOfIgnored();
        renderIgnoredPotsTable();
        updateMappingConflicts();
    }
}

export function cleanConsoleOfIgnored() {
    if (!Array.isArray(getContext().recentChanges)) return;
    getContext().recentChanges = getContext().recentChanges.filter(entry => {
        if (entry.type !== 'pot') return true;
        const potIdx = POT_NAMES.indexOf(entry.name);
        if (potIdx >= 0) {
            const coords = getPotMuxChannel(potIdx);
            if (coords && isPotIgnored(coords.mux, coords.pot)) return false;
        }
        const match = entry.name.match(/MUX(\d+)\s+CH(\d+)/i);
        if (match) {
            const m = parseInt(match[1], 10);
            const p = parseInt(match[2], 10);
            if (isPotIgnored(m, p) || isPotMapped(m, p)) return false;
        }
        return true;
    });
}

export function fillIgnoredPotsFromConfigMeta() {
    if (getContext().ignoredPotsFilledFromMeta || !getContext().configMeta) return;
    getContext().ignoredPotsFilledFromMeta = true;
    updateHardwareSummaryFromMeta();
    if (getContext().ignoredPotsUserEdited) return;

    const M = CONFIG_META;
    const meta = getContext().configMeta;
    const count = Math.round(meta[M.IGNORED_COUNT]);
    const list = [];
    for (let i = 0; i < count; i++) {
        list.push({
            mux: Math.round(meta[M.IGNORED_BASE + i * 2 + 0]),
            pot: Math.round(meta[M.IGNORED_BASE + i * 2 + 1])
        });
    }
    getContext().ignoredPotsList = list;
    renderIgnoredPotsTable();
}

export function isPotMapped(mux, pot) {
    for (let i = 0; i < POT_NAMES.length; i++) {
        const coords = getPotMuxChannel(i);
        if (coords && coords.mux === mux && coords.pot === pot)
            return true;
    }
    return false;
}

export function formatUnmappedPotLabel(mux, pot) {
    return 'N/A MUX' + mux + ' CH' + String(pot).padStart(2, '0');
}

function snapshotControlValues() {
    const snapPot = new Float32Array(POT_NAMES.length);
    const snapSw = new Float32Array(SWITCH_NAMES.length);
    const snapMuxRaw = new Float32Array(MUX_RAW_SIZE);
    for (let i = 0; i < POT_NAMES.length; i++)
        snapPot[i] = getContext().potValues[i] != null ? getContext().potValues[i] : 0;
    for (let i = 0; i < SWITCH_NAMES.length; i++)
        snapSw[i] = getContext().switchStates[i] != null ? getContext().switchStates[i] : 0;
    for (let i = 0; i < MUX_RAW_SIZE; i++)
        snapMuxRaw[i] = getContext().muxRawValues ? getContext().muxRawValues[i] : 0;
    return { snapPot, snapSw, snapMuxRaw };
}

function startDetect(table, index) {
    if (getContext().detectMode) {
        getContext().detectMode = null;
        setDetectUiActive(false);
    }
    if (!getContext().mappingBuilt) {
        showDetectStatus('Waiting for Bela mapping…', true);
        return;
    }
    if (typeof Bela === 'undefined') {
        showDetectStatus('Bela not connected', true);
        return;
    }

    const { snapPot, snapSw, snapMuxRaw } = snapshotControlValues();
    getContext().detectMode = { table, targetIndex: index, snapPot, snapSw, snapMuxRaw };
    setDetectUiActive(true);

    if (!getContext().mappingGuided) {
        const targetName = table === 'pot' ? POT_NAMES[index] : SWITCH_NAMES[index];
        showDetectStatus(table === 'pot'
            ? `Move pot ≥25% for ${targetName}`
            : `Toggle switch for ${targetName}`, false);
    } else {
        hideDetectStatus();
    }
}

export function cancelDetect() {
    if (_guidedTimer) {
        clearTimeout(_guidedTimer);
        _guidedTimer = null;
    }
    const hadGuided = !!getContext().mappingGuided;
    getContext().mappingGuided = null;
    if (hadGuided) updateGuidedBar();
    if (!getContext().detectMode) return;
    getContext().detectMode = null;
    setDetectUiActive(false);
    hideDetectStatus();
}

function setMappingField(table, rowIndex, field, value) {
    const cls = table === 'pot' ? 'pi' : 'si';
    const inp = document.querySelector(`.${cls}[data-i="${rowIndex}"][data-f="${field}"]`);
    if (!inp) return;
    inp.value = value;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
}

function findMovedMuxPot(snapMuxRaw) {
    if (!getContext().muxRawValues) return null;
    const activeMux = getActiveMuxCount();
    let bestMux = -1;
    let bestPot = -1;
    let bestDelta = 0;
    for (let m = 0; m < activeMux; m++) {
        for (let p = 0; p < MUX_POTS_PER_MUX; p++) {
            if (isPotIgnored(m, p)) continue;
            const idx = muxRawIndex(m, p);
            const cur = getContext().muxRawValues[idx] != null ? getContext().muxRawValues[idx] : 0;
            const delta = Math.abs(cur - snapMuxRaw[idx]);
            if (delta > bestDelta) {
                bestDelta = delta;
                bestMux = m;
                bestPot = p;
            }
        }
    }
    if (bestMux < 0 || bestDelta < DETECT_POT_MIN_DELTA) return null;
    return { mux: bestMux, pot: bestPot, label: formatUnmappedPotLabel(bestMux, bestPot) };
}

function findToggledSwitchIndex(snapSw) {
    for (let i = 0; i < SWITCH_NAMES.length; i++) {
        const cur = getContext().switchStates[i] != null ? getContext().switchStates[i] : 0;
        if ((cur > 0.5) !== (snapSw[i] > 0.5)) return i;
    }
    return -1;
}

function readPotMappingRow(i) {
    const muxInp = document.querySelector(`.pi[data-i="${i}"][data-f="mux"]`);
    const potInp = document.querySelector(`.pi[data-i="${i}"][data-f="pot"]`);
    if (!muxInp || !potInp) return null;
    const rev = getContext().potMapping ? (getContext().potMapping[i * 4 + 2] > 0.5) : false;
    return {
        mux: parseInt(muxInp.value, 10) || 0,
        pot: parseInt(potInp.value, 10) || 0,
        rev,
        cen: isPotCentered(POT_NAMES[i])
    };
}

function readSwitchMappingRow(i) {
    const pinInp = document.querySelector(`.si[data-i="${i}"][data-f="pin"]`);
    const portInp = document.querySelector(`.si[data-i="${i}"][data-f="port"]`);
    if (!pinInp || !portInp) return null;
    const rev = getContext().switchMapping ? (getContext().switchMapping[i * 3 + 2] > 0.5) : false;
    return {
        pin: parseInt(pinInp.value, 10) || 0,
        port: parseInt(portInp.value, 10) || 0,
        rev
    };
}

function finishDetectPotFromPhysical(mux, pot, label) {
    const dst = getContext().detectMode.targetIndex;
    setMappingField('pot', dst, 'mux', mux);
    setMappingField('pot', dst, 'pot', pot);

    if (getContext().potMapping) {
        for (let i = 0; i < POT_NAMES.length; i++) {
            if (Math.round(getContext().potMapping[i * 4]) === mux &&
                Math.round(getContext().potMapping[i * 4 + 1]) === pot) {
                const src = readPotMappingRow(i);
                if (src) setPotRevState(dst, src.rev);
                break;
            }
        }
    }

    getContext().mappingUserEdited = true;
    markMappingDirty();
    showDownloadStatus(`${POT_NAMES[dst]} → MUX ${mux} / Ch ${pot}`, false);
    advanceGuidedAfterHit();
}

function finishDetect(sourceIndex) {
    const dst = getContext().detectMode.targetIndex;
    const table = getContext().detectMode.table;

    if (table === 'pot') {
        const src = readPotMappingRow(sourceIndex);
        if (!src) { cancelDetect(); return; }
        setMappingField('pot', dst, 'mux', src.mux);
        setMappingField('pot', dst, 'pot', src.pot);
        setPotRevState(dst, src.rev);
        showDownloadStatus(`${POT_NAMES[dst]} → MUX ${src.mux} / Ch ${src.pot}`, false);
    } else {
        const src = readSwitchMappingRow(sourceIndex);
        if (!src) { cancelDetect(); return; }
        setMappingField('sw', dst, 'pin', src.pin);
        setMappingField('sw', dst, 'port', src.port);
        setSwitchRevState(dst, src.rev);
        const portLabel = src.port > 0.5 ? 'B' : 'A';
        showDownloadStatus(`${SWITCH_NAMES[dst]} → Port ${portLabel} / Pin ${src.pin}`, false);
    }

    getContext().mappingUserEdited = true;
    markMappingDirty();
    updateMappingConflicts();
    advanceGuidedAfterHit();
}

export function updateDetectMode() {
    if (!getContext().detectMode) return;

    if (getContext().detectMode.table === 'pot') {
        const hit = findMovedMuxPot(getContext().detectMode.snapMuxRaw);
        if (hit) finishDetectPotFromPhysical(hit.mux, hit.pot, hit.label);
    } else {
        const srcIdx = findToggledSwitchIndex(getContext().detectMode.snapSw);
        if (srcIdx >= 0) finishDetect(srcIdx);
    }
}

function collectMappingFromForm() {
    const ctx = getContext();
    const pm = new Float32Array(POT_NAMES.length * 4);
    for (let i = 0; i < POT_NAMES.length; i++) {
        pm[i * 4 + 2] = (ctx.potMapping && ctx.potMapping[i * 4 + 2] > 0.5) ? 1.0 : 0.0;
        pm[i * 4 + 3] = isPotCentered(POT_NAMES[i]) ? 1.0 : 0.0;
    }
    document.querySelectorAll('.pi').forEach(inp => {
        const i = parseInt(inp.dataset.i, 10);
        const f = inp.dataset.f;
        if (f === 'mux') pm[i * 4 + 0] = parseFloat(inp.value) || 0;
        if (f === 'pot') pm[i * 4 + 1] = parseFloat(inp.value) || 0;
    });

    const sm = new Float32Array(SWITCH_NAMES.length * 3);
    for (let i = 0; i < SWITCH_NAMES.length; i++) {
        sm[i * 3 + 2] = (ctx.switchMapping && ctx.switchMapping[i * 3 + 2] > 0.5) ? 1.0 : 0.0;
    }
    document.querySelectorAll('.si').forEach(inp => {
        const i = parseInt(inp.dataset.i, 10);
        const f = inp.dataset.f;
        if (f === 'pin') sm[i * 3 + 0] = parseFloat(inp.value) || 0;
        if (f === 'port') sm[i * 3 + 1] = parseFloat(inp.value) || 0;
    });

    return { pm, sm };
}

function buildConfigJsonText(pm, sm) {
    const ctx = getContext();
    if (!ctx.configMeta && !ctx.loadedConfigBase && !ctx.boardConfigJson) return null;

    const M = CONFIG_META;
    let ignoredPots = [];
    if (Array.isArray(ctx.ignoredPotsList)) {
        ignoredPots = ctx.ignoredPotsList.map(item => ({
            mux: Math.max(0, Math.min(7, Math.round(item.mux))),
            pot: Math.max(0, Math.min(9, Math.round(item.pot)))
        }));
    } else if (ctx.configMeta) {
        const ignoredCount = Math.round(ctx.configMeta[M.IGNORED_COUNT]);
        for (let i = 0; i < ignoredCount; i++) {
            ignoredPots.push({
                mux: Math.round(ctx.configMeta[M.IGNORED_BASE + i * 2 + 0]),
                pot: Math.round(ctx.configMeta[M.IGNORED_BASE + i * 2 + 1])
            });
        }
    }

    const pots = POT_NAMES.map((name, i) => ({
        name,
        mux: Math.max(0, Math.min(7, Math.round(pm[i * 4 + 0]))),
        pot: Math.max(0, Math.min(9, Math.round(pm[i * 4 + 1]))),
        reversed: pm[i * 4 + 2] > 0.5,
        centered: isPotCentered(name)
    }));

    const switches = SWITCH_NAMES.map((name, i) => ({
        name,
        pin: Math.max(0, Math.min(7, Math.round(sm[i * 3 + 0]))),
        reversed: sm[i * 3 + 2] > 0.5,
        port: sm[i * 3 + 1] > 0.5 ? 'B' : 'A'
    }));

    const routing = collectRoutingFromForm();
    const hw = getEffectiveHwInfo();
    const base = ctx.loadedConfigBase || ctx.boardConfigJson || {};

    const clipLeds = {};
    CLIP_LED_KEYS.forEach(key => {
        const serialized = serializeClipLedEntry(ctx.clipLedsConfig && ctx.clipLedsConfig[key]);
        if (serialized !== null) clipLeds[key] = serialized;
    });

    const config = {
        _comment: (typeof base._comment === 'string' && base._comment) ? base._comment : DEFAULT_CONFIG_COMMENT,
        developerMode: !!ctx.devModeBoot,
        mux: { activeMux: hw.activeMux },
        calibration: {
            potScaleRecovery: +Number(hw.potScaleRecovery).toFixed(4),
            potMax: +Number(hw.potMax).toFixed(3),
            potMin: +Number(hw.potMin).toFixed(3)
        },
        i2c: {
            bus: hw.bus,
            mcpAddress: hw.mcpAddress
        },
        routing,
        pots,
        switches,
        clipLeds,
        ignoredPots
    };

    // Preserve any extra custom keys from loaded/board config without overriding managed keys
    Object.keys(base).forEach(k => {
        if (!(k in config) && k !== 'devMode' && k !== 'uiDevMode') {
            config[k] = base[k];
        }
    });

    return JSON.stringify(config, null, 2);
}

/** Syncs Controls DOM inputs (.pi, .si, Rev toggles) from ctx.potMapping & ctx.switchMapping. */
function syncControlsDomFromState() {
    const ctx = getContext();
    if (!ctx.mappingBuilt) return;

    if (ctx.potMapping) {
        for (let i = 0; i < POT_NAMES.length; i++) {
            const muxInp = document.querySelector(`.pi[data-i="${i}"][data-f="mux"]`);
            const potInp = document.querySelector(`.pi[data-i="${i}"][data-f="pot"]`);
            if (muxInp) muxInp.value = String(Math.round(ctx.potMapping[i * 4 + 0]));
            if (potInp) potInp.value = String(Math.round(ctx.potMapping[i * 4 + 1]));
            setPotRevState(i, ctx.potMapping[i * 4 + 2] > 0.5);
        }
    }
    if (ctx.switchMapping) {
        for (let i = 0; i < SWITCH_NAMES.length; i++) {
            const pinInp = document.querySelector(`.si[data-i="${i}"][data-f="pin"]`);
            const portSel = document.querySelector(`.si[data-i="${i}"][data-f="port"]`);
            if (pinInp) pinInp.value = String(Math.round(ctx.switchMapping[i * 3 + 0]));
            if (portSel) portSel.value = ctx.switchMapping[i * 3 + 1] > 0.5 ? '1' : '0';
            setSwitchRevState(i, ctx.switchMapping[i * 3 + 2] > 0.5);
        }
    }
}

/** Applies a parsed config.json object into the Mapping form state & DOM. */
export function applyBoardConfigToMapping(cfg, opts = {}) {
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return false;
    const markDirty = !!opts.markDirty;
    const applyControls = opts.applyControls !== undefined ? !!opts.applyControls : true;
    const ctx = getContext();

    try {
        ctx.loadedConfigBase = JSON.parse(JSON.stringify(cfg));
    } catch (_) {
        ctx.loadedConfigBase = cfg;
    }

    if (cfg.developerMode !== undefined) ctx.devModeBoot = !!cfg.developerMode;
    else if (cfg.devMode !== undefined) ctx.devModeBoot = !!cfg.devMode;
    else if (cfg.uiDevMode !== undefined) ctx.devModeBoot = !!cfg.uiDevMode;
    if (_devModeBootCb) _devModeBootCb.checked = !!ctx.devModeBoot;

    if (cfg.routing && typeof cfg.routing === 'object') {
        applyRoutingObjectToForm(cfg.routing);
        ctx.routingFilledFromConfigJson = true;
    }

    if (cfg.clipLeds !== undefined) {
        const nextClips = {};
        CLIP_LED_KEYS.forEach(k => {
            nextClips[k] = { enabled: false, port: 'A', pin: 0, activeLow: false };
        });
        if (cfg.clipLeds && typeof cfg.clipLeds === 'object' && !Array.isArray(cfg.clipLeds)) {
            CLIP_LED_KEYS.forEach(k => {
                if (cfg.clipLeds[k] !== undefined) {
                    nextClips[k] = parseClipLedConfigEntry(cfg.clipLeds[k]);
                }
            });
        } else if (Array.isArray(cfg.clipLeds)) {
            cfg.clipLeds.forEach(entry => {
                if (!entry || typeof entry !== 'object' || !entry.name) return;
                const lower = String(entry.name).toLowerCase().replace(/^clip_/, '');
                if (CLIP_LED_KEYS.includes(lower)) {
                    nextClips[lower] = parseClipLedConfigEntry(entry);
                }
            });
        }
        ctx.clipLedsConfig = nextClips;
        renderClipLedsFromContext();
    }

    if (applyControls && Array.isArray(cfg.pots)) {
        if (!ctx.potMapping) ctx.potMapping = new Float32Array(POT_NAMES.length * 4);
        cfg.pots.forEach(p => {
            if (!p || typeof p !== 'object' || !p.name) return;
            const idx = POT_INDEX[p.name];
            if (idx === undefined) return;
            const mux = parseInt(p.mux, 10);
            const pot = parseInt(p.pot, 10);
            if (!isNaN(mux) && mux >= 0 && mux <= 7) ctx.potMapping[idx * 4 + 0] = mux;
            if (!isNaN(pot) && pot >= 0 && pot <= 9) ctx.potMapping[idx * 4 + 1] = pot;
            if (p.reversed !== undefined) ctx.potMapping[idx * 4 + 2] = p.reversed ? 1.0 : 0.0;
            ctx.potMapping[idx * 4 + 3] = isPotCentered(p.name) ? 1.0 : 0.0;
        });
    }

    if (applyControls && Array.isArray(cfg.switches)) {
        if (!ctx.switchMapping) ctx.switchMapping = new Float32Array(SWITCH_NAMES.length * 3);
        cfg.switches.forEach(sw => {
            if (!sw || typeof sw !== 'object' || !sw.name) return;
            const idx = SW_INDEX[sw.name];
            if (idx === undefined) return;
            const pin = parseInt(sw.pin, 10);
            if (!isNaN(pin) && pin >= 0 && pin <= 7) ctx.switchMapping[idx * 3 + 0] = pin;
            if (sw.port !== undefined) ctx.switchMapping[idx * 3 + 1] = String(sw.port).toUpperCase() === 'B' ? 1.0 : 0.0;
            else if (sw.portB !== undefined) ctx.switchMapping[idx * 3 + 1] = sw.portB ? 1.0 : 0.0;
            if (sw.reversed !== undefined) ctx.switchMapping[idx * 3 + 2] = sw.reversed ? 1.0 : 0.0;
        });
    }

    if (applyControls && !ctx.mappingBuilt && ctx.potMapping && ctx.switchMapping) {
        tryBuildMappingTable();
    } else if (applyControls) {
        syncControlsDomFromState();
    }

    if (Array.isArray(cfg.ignoredPots)) {
        const list = [];
        cfg.ignoredPots.forEach(item => {
            if (list.length >= 32) return;
            if (typeof item === 'string') {
                const idx = POT_INDEX[item];
                if (idx !== undefined) {
                    const coords = getPotMuxChannel(idx);
                    if (coords) list.push({ mux: coords.mux, pot: coords.pot });
                }
            } else if (item && typeof item === 'object') {
                if (item.mux !== undefined && item.pot !== undefined) {
                    const m = Math.max(0, Math.min(7, Math.round(Number(item.mux) || 0)));
                    const p = Math.max(0, Math.min(9, Math.round(Number(item.pot) || 0)));
                    list.push({ mux: m, pot: p });
                } else if (item.name) {
                    const idx = POT_INDEX[item.name];
                    if (idx !== undefined) {
                        const coords = getPotMuxChannel(idx);
                        if (coords) list.push({ mux: coords.mux, pot: coords.pot });
                    }
                }
            }
        });
        ctx.ignoredPotsList = list;
        ctx.ignoredPotsFilledFromMeta = true;
        renderIgnoredPotsTable();
    }

    updateHardwareSummaryFromMeta();
    cleanConsoleOfIgnored();
    updateMappingConflicts();

    if (markDirty) {
        ctx.mappingUserEdited = true;
        ctx.ignoredPotsUserEdited = true;
        setMappingDirty(true);
    }
    return true;
}

/** Resets Mapping build & sync flags before Bela restarts so fresh buffers rebuild the form. */
export function resetMappingStateForRestart() {
    const ctx = getContext();
    cancelDetect();
    ctx.mappingBuilt = false;
    ctx.potMapping = null;
    ctx.switchMapping = null;
    ctx.configMeta = null;
    ctx.routingFilledFromMeta = false;
    ctx.routingFilledFromConfigJson = false;
    ctx.ignoredPotsFilledFromMeta = false;
    ctx.mappingUserEdited = false;
    ctx.ignoredPotsUserEdited = false;
    setMappingDirty(false);
    const host = document.getElementById('map-groups-host');
    if (host) {
        host.innerHTML = '<div class="map-empty">Reloading mapping from Bela…</div>';
    }
}

/** Validates current Mapping form and returns serialized JSON string or null on validation failure. */
function buildValidatedConfigText() {
    const ctx = getContext();
    if (!ctx.mappingBuilt) {
        showDownloadStatus('Waiting for Bela mapping…', true);
        return null;
    }
    if (!ctx.configMeta && !ctx.loadedConfigBase && !ctx.boardConfigJson) {
        showDownloadStatus('Config metadata not received', true);
        return null;
    }

    const routing = collectRoutingFromForm();
    if (Object.keys(routing.in).length !== ROUTING_IN_KEYS.length ||
        Object.keys(routing.out).length !== ROUTING_OUT_KEYS.length) {
        showDownloadStatus('Invalid routing channels', true);
        return null;
    }
    for (const key of ROUTING_IN_KEYS) {
        const chs = routing.in[key].channels;
        if (!chs || !chs.length || chs.some(c => c < ROUTING_CH_MIN || c > ROUTING_CH_MAX)) {
            showDownloadStatus(`Invalid input channel for ${ROUTING_LABELS[key] || key}`, true);
            return null;
        }
    }
    for (const key of ROUTING_OUT_KEYS) {
        const entry = routing.out[key];
        const chs = entry.channels ? entry.channels : [entry.channel];
        if (!chs.length || chs.some(c => c < ROUTING_CH_MIN || c > ROUTING_CH_MAX)) {
            showDownloadStatus(`Invalid output channel for ${ROUTING_LABELS[key] || key}`, true);
            return null;
        }
    }
    const masterChans = routing.out.master && routing.out.master.channels;
    if (!Array.isArray(masterChans) || masterChans.length < 1) {
        showDownloadStatus('Master needs ≥1 output channel', true);
        return null;
    }

    const { pm, sm } = collectMappingFromForm();
    for (let i = 0; i < POT_NAMES.length; i++) {
        const mux = Math.round(pm[i * 4 + 0]);
        const pot = Math.round(pm[i * 4 + 1]);
        if (mux < 0 || mux > 7 || pot < 0 || pot > 9) {
            showDownloadStatus(`Invalid MUX/Ch on ${POT_NAMES[i]}`, true);
            return null;
        }
    }
    for (let i = 0; i < SWITCH_NAMES.length; i++) {
        const pin = Math.round(sm[i * 3 + 0]);
        if (pin < 0 || pin > 7) {
            showDownloadStatus(`Invalid pin on ${SWITCH_NAMES[i]}`, true);
            return null;
        }
    }

    const text = buildConfigJsonText(pm, sm);
    if (!text) {
        showDownloadStatus('JSON generation error', true);
        return null;
    }
    return text;
}

function triggerJsonDownload(text, filename = 'config.json') {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/** Handles local config.json file load into the Mapping form. */
function handleLoadFileChange(e) {
    const file = e.target && e.target.files && e.target.files[0];
    if (e.target) e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(String(reader.result || ''));
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                showDownloadStatus('Invalid config.json file (root must be an object)', true);
                return;
            }
            applyBoardConfigToMapping(parsed, { markDirty: true, applyControls: true });
            showDownloadStatus(`Loaded ${file.name} — click Save to write to Bela`, false);
        } catch (err) {
            showDownloadStatus('Failed to parse JSON: ' + (err && err.message ? err.message : 'invalid syntax'), true);
        }
    };
    reader.onerror = () => showDownloadStatus('Failed to read selected file', true);
    reader.readAsText(file);
}

/** Literally downloads the config.json file currently saved on Bela. */
async function exportBoardConfigJson() {
    if (getContext().mappingActionBusy) return;
    setActionButtonsDisabled(true);
    try {
        let res = await fetchBoardConfigJson();
        if (!res.ok && res.status !== 404 && belaControlReady()) {
            const wsRes = await readConfigViaControl();
            if (wsRes.ok && wsRes.content) {
                res = { ok: true, text: wsRes.content };
            }
        }
        if (!res.ok || !res.text) {
            showDownloadStatus(res.error || 'No config.json on Bela yet — click Save first', true);
            return;
        }
        triggerJsonDownload(res.text, 'config.json');
        showDownloadStatus(
            getContext().mappingDirty
                ? 'Exported Bela saved config.json (unsaved form edits not included)'
                : 'Exported config.json from Bela',
            false
        );
    } finally {
        setActionButtonsDisabled(false);
    }
}

/** Writes the validated Mapping form directly to config.json on Bela. */
async function saveConfigAction() {
    if (getContext().mappingActionBusy) return false;
    if (!belaControlReady()) {
        showDownloadStatus('Bela not connected — cannot save', true);
        return false;
    }
    const text = buildValidatedConfigText();
    if (!text) return false;

    setActionButtonsDisabled(true);
    let savingNoticeShown = false;
    const savingTimer = setTimeout(() => {
        savingNoticeShown = true;
        showDownloadStatus('Saving config.json to Bela…', false, 0);
    }, 150);
    try {
        const res = await saveConfigToBela(text);
        clearTimeout(savingTimer);
        if (!res.ok) {
            showDownloadStatus(res.error || 'Failed to save config.json on Bela', true);
            return false;
        }
        const parsed = JSON.parse(text);
        const ctx = getContext();
        ctx.boardConfigRawText = text;
        ctx.boardConfigJson = parsed;
        ctx.loadedConfigBase = JSON.parse(text);
        setMappingDirty(false);
        showDownloadStatus('Saved config.json to Bela — click Restart to apply', false);
        return true;
    } finally {
        clearTimeout(savingTimer);
        if (savingNoticeShown && getContext().downloadStatusEl &&
            getContext().downloadStatusEl.textContent === 'Saving config.json to Bela…') {
            showDownloadStatus('', false, 0);
        }
        setActionButtonsDisabled(false);
    }
}

function closeConfirmModal() {
    if (_modalEscBound) {
        document.removeEventListener('keydown', _modalEscBound);
        _modalEscBound = null;
    }
    if (_modalOverlay && _modalOverlay.parentNode) {
        _modalOverlay.parentNode.removeChild(_modalOverlay);
    }
    _modalOverlay = null;
}

function openConfirmModal({ title, body, actions }) {
    closeConfirmModal();
    const overlay = el('div', { className: 'map-modal-backdrop' });
    const panel = el('div', {
        className: 'map-modal-panel',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': title
    });
    panel.appendChild(el('div', { className: 'map-modal-title', textContent: title }));
    panel.appendChild(el('p', { className: 'map-modal-body', textContent: body }));

    const row = el('div', { className: 'map-modal-actions' });
    let focusBtn = null;
    actions.forEach(act => {
        const btn = el('button', {
            type: 'button',
            className: act.className || 'btn-map-secondary',
            textContent: act.label
        });
        btn.addEventListener('click', async () => {
            closeConfirmModal();
            if (typeof act.onClick === 'function') await act.onClick();
        });
        if (act.autoFocus) focusBtn = btn;
        row.appendChild(btn);
    });
    panel.appendChild(row);
    overlay.appendChild(panel);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeConfirmModal();
    });
    _modalEscBound = (e) => {
        if (e.key === 'Escape') closeConfirmModal();
    };
    document.addEventListener('keydown', _modalEscBound);
    document.body.appendChild(overlay);
    _modalOverlay = overlay;
    if (focusBtn) focusBtn.focus();
}

async function executeAudioRestart() {
    if (!belaControlReady()) {
        showDownloadStatus('Bela not connected — cannot restart', true);
        return;
    }
    const ctx = getContext();
    setActionButtonsDisabled(true);
    ctx.awaitingRestartReconnect = true;
    ctx.sawOfflineDuringRestart = false;
    showDownloadStatus('Restarting Bela audio engine…', false, 0);

    const res = await restartBelaAudio();
    setActionButtonsDisabled(false);
    if (!res.ok) {
        ctx.awaitingRestartReconnect = false;
        ctx.sawOfflineDuringRestart = false;
        showDownloadStatus(res.error || 'Failed to restart Bela audio', true);
    }
}

function confirmAndRestartAudio() {
    if (getContext().mappingActionBusy) return;
    if (!belaControlReady()) {
        showDownloadStatus('Bela not connected — cannot restart', true);
        return;
    }

    if (getContext().mappingDirty) {
        openConfirmModal({
            title: 'Unsaved Configuration Changes',
            body: 'You have unsaved Mapping changes. Save them to Bela before restarting the audio engine (~2–3 s, Wi-Fi preserved)?',
            actions: [
                { label: 'Cancel', className: 'btn-map-secondary', autoFocus: true },
                {
                    label: 'Restart Without Saving',
                    className: 'btn-restart',
                    onClick: () => executeAudioRestart()
                },
                {
                    label: 'Save & Restart',
                    className: 'btn-save',
                    onClick: async () => {
                        const saved = await saveConfigAction();
                        if (saved) await executeAudioRestart();
                    }
                }
            ]
        });
    } else {
        openConfirmModal({
            title: 'Restart Bela Audio Engine?',
            body: 'Cleanly fades out audio and restarts the Bela preamp program (~2–3 s) to reload config.json. Wi-Fi and hotspot remain connected.',
            actions: [
                { label: 'Cancel', className: 'btn-map-secondary', autoFocus: true },
                {
                    label: 'Restart Audio',
                    className: 'btn-restart',
                    onClick: () => executeAudioRestart()
                }
            ]
        });
    }
}

function confirmAndRebootBoard() {
    if (getContext().mappingActionBusy) return;
    if (!belaControlReady()) {
        showDownloadStatus('Bela not connected — cannot reboot', true);
        return;
    }
    openConfirmModal({
        title: 'Reboot Entire Bela Board?',
        body: 'Performs a full Linux OS reboot (~25–30 s). Audio stops and Wi-Fi / hotspot will temporarily disconnect until boot finishes.',
        actions: [
            { label: 'Cancel', className: 'btn-map-secondary', autoFocus: true },
            {
                label: 'Reboot Bela',
                className: 'btn-danger-solid',
                onClick: async () => {
                    const ctx = getContext();
                    setActionButtonsDisabled(true);
                    ctx.awaitingRestartReconnect = true;
                    ctx.sawOfflineDuringRestart = false;
                    showDownloadStatus('Rebooting Bela board (~30 s)…', false, 0);
                    const res = await rebootBelaBoard();
                    setActionButtonsDisabled(false);
                    if (!res.ok) {
                        ctx.awaitingRestartReconnect = false;
                        ctx.sawOfflineDuringRestart = false;
                        showDownloadStatus(res.error || 'Failed to reboot Bela', true);
                    }
                }
            }
        ]
    });
}

/** Public status message helper for main.js post-restart reconnect notification. */
export function setMappingStatus(msg, isError = false) {
    showDownloadStatus(msg, isError);
}

function showDownloadStatus(msg, isError, durationMs = 5000) {
    const elNode = getContext().downloadStatusEl;
    if (!elNode) return;
    if (_statusClearTimer) {
        clearTimeout(_statusClearTimer);
        _statusClearTimer = null;
    }
    if (!msg) {
        elNode.classList.remove('show', 'err');
        elNode.textContent = '';
        return;
    }
    elNode.textContent = msg;
    elNode.classList.toggle('err', !!isError);
    elNode.classList.add('show');
    if (durationMs > 0) {
        _statusClearTimer = setTimeout(() => {
            _statusClearTimer = null;
            if (getContext().downloadStatusEl === elNode && elNode.textContent === msg) {
                elNode.classList.remove('show', 'err');
            }
        }, durationMs);
    }
}
