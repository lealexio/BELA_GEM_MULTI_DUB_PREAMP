/** Live Sampler tile: lists project samples/ audio, supports Loop/Pitch/Gain & WAV/MP3 upload. */
import { getContext } from '../context.js';
import {
    MAX_SAMPLES, MAX_SAMPLE_NAME_LEN, SAMPLER_PAD_LABEL_LEN,
    SAMPLER_CFG_STORAGE_KEY, SAMPLER_PAD_KEYS
} from '../config.js';
import { belaControlReady } from '../bela/connection.js';
import { el, cardTitle } from './utils.js';

const EMPTY_MSG = 'No samples folder found (src/samples/).';
const WAIT_MSG  = 'Waiting for Bela…';
const NONE_MSG  = 'No WAV/MP3 files in src/samples/.';

let _inspTitleEl = null;
let _inspLoopBtn = null;
let _inspGainSlider = null;
let _inspGainVal = null;
let _inspPitchSlider = null;
let _inspPitchVal = null;
let _uploadStatusEl = null;
let _padProgressEls = [];

function _loadSlotCfgMap() {
    try {
        const raw = localStorage.getItem(SAMPLER_CFG_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') return parsed;
        }
    } catch (_) {}
    return {};
}

function _saveSlotCfgMap(map) {
    try {
        localStorage.setItem(SAMPLER_CFG_STORAGE_KEY, JSON.stringify(map));
    } catch (_) {}
}

function _getSlotCfg(slot) {
    const ctx = getContext();
    if (!ctx.samplerSlotCfg || typeof ctx.samplerSlotCfg !== 'object') {
        ctx.samplerSlotCfg = _loadSlotCfgMap();
    }
    const existing = ctx.samplerSlotCfg[slot];
    if (existing) return existing;
    return { loop: false, gain: 1.0, pitch: 0 };
}

function _pushSlotCfg(slot, cfg) {
    const ctx = getContext();
    ctx.samplerSlotCfg[slot] = { ...cfg };
    _saveSlotCfgMap(ctx.samplerSlotCfg);
    if (belaControlReady()) {
        /* global Bela */
        Bela.control.send({
            event: 'custom',
            samplerSlotCfg: { slot, loop: !!cfg.loop, gain: cfg.gain, pitch: cfg.pitch }
        });
    }
}

/**
 * Decodes fixed-width ASCII floats from GUI buffer 11 into filename strings.
 * @param {ArrayLike<number>} namesBuf
 * @param {number} count
 * @returns {string[]}
 */
export function decodeSampleNames(namesBuf, count) {
    const names = [];
    if (!namesBuf || count <= 0) return names;
    const n = Math.min(count, MAX_SAMPLES);
    for (let i = 0; i < n; ++i) {
        const base = i * MAX_SAMPLE_NAME_LEN;
        let s = '';
        for (let c = 0; c < MAX_SAMPLE_NAME_LEN; ++c) {
            const code = Math.round(namesBuf[base + c] || 0);
            if (code <= 0) break;
            s += String.fromCharCode(code);
        }
        names.push(s || `Sample ${i + 1}`);
    }
    return names;
}

/**
 * Sends a play command for the given slot index (and syncs its loop/gain/pitch config).
 * @param {number} slot
 */
function _sendPlay(slot) {
    const ctx = getContext();
    ctx.samplerSelectedSlot = slot;
    _refreshInspector();
    const cfg = _getSlotCfg(slot);
    if (!belaControlReady()) return;
    /* global Bela */
    Bela.control.send({
        event: 'custom',
        samplerSlotCfg: { slot, loop: !!cfg.loop, gain: cfg.gain, pitch: cfg.pitch }
    });
    Bela.control.send({ event: 'custom', samplerPlay: slot });
}

function _sendStop() {
    if (!belaControlReady()) return;
    /* global Bela */
    Bela.control.send({ event: 'custom', samplerStop: true });
}

function _refreshInspector() {
    const ctx = getContext();
    const slot = ctx.samplerSelectedSlot || 0;
    const cfg = _getSlotCfg(slot);
    const name = (ctx.samplerNames && ctx.samplerNames[slot]) || `Slot ${slot + 1}`;
    if (_inspTitleEl) _inspTitleEl.textContent = `#${slot + 1} ${_padLabel(name)}`;
    if (_inspLoopBtn) {
        _inspLoopBtn.classList.toggle('active', !!cfg.loop);
        _inspLoopBtn.setAttribute('aria-pressed', cfg.loop ? 'true' : 'false');
    }
    if (_inspGainSlider) {
        const pct = Math.round((cfg.gain ?? 1.0) * 100);
        _inspGainSlider.value = String(pct);
        if (_inspGainVal) _inspGainVal.textContent = pct + '%';
    }
    if (_inspPitchSlider) {
        const st = Math.round(cfg.pitch || 0);
        _inspPitchSlider.value = String(st);
        if (_inspPitchVal) _inspPitchVal.textContent = (st > 0 ? '+' : '') + st + ' st';
    }
    (ctx.samplerButtons || []).forEach((btn, i) => {
        const sc = _getSlotCfg(i);
        btn.classList.toggle('loop-on', !!sc.loop);
        btn.classList.toggle('selected', i === slot);
    });
}

function _handleUploadFile(file) {
    if (!file) return;
    if (!/\.(wav|mp3)$/i.test(file.name)) {
        if (_uploadStatusEl) _uploadStatusEl.textContent = 'WAV / MP3 only';
        return;
    }
    if (file.size > 4 * 1024 * 1024) {
        if (_uploadStatusEl) _uploadStatusEl.textContent = 'Max 4 MB';
        return;
    }
    if (!belaControlReady()) {
        if (_uploadStatusEl) _uploadStatusEl.textContent = 'Bela offline';
        return;
    }
    if (_uploadStatusEl) _uploadStatusEl.textContent = 'Uploading…';
    const reader = new FileReader();
    reader.onload = () => {
        const bytes = new Uint8Array(reader.result);
        let bin = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
            bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        const b64 = btoa(bin);
        /* global Bela */
        Bela.control.send({
            event: 'custom',
            uploadSample: { name: file.name, dataB64: b64 }
        });
        if (_uploadStatusEl) _uploadStatusEl.textContent = `Sent ${file.name}`;
        setTimeout(() => { if (_uploadStatusEl) _uploadStatusEl.textContent = ''; }, 3000);
    };
    reader.readAsArrayBuffer(file);
}

/**
 * Single-line pad label from basename (no extension), capped at SAMPLER_PAD_LABEL_LEN.
 * @param {string} filename
 * @returns {string}
 */
function _padLabel(filename) {
    const base = String(filename || '').replace(/\.(wav|mp3)$/i, '').trim();
    if (!base) return '?';
    return base.length > SAMPLER_PAD_LABEL_LEN
        ? base.slice(0, SAMPLER_PAD_LABEL_LEN)
        : base;
}

/**
 * Rebuilds the rectangular pad grid from decoded names.
 * @param {string[]} names
 */
function _rebuildList(names) {
    const ctx = getContext();
    const list = ctx.samplerListEl;
    const empty = ctx.samplerEmptyEl;
    if (!list || !empty) return;

    list.innerHTML = '';
    ctx.samplerButtons = [];
    _padProgressEls = [];
    ctx.samplerHighlight = -1;

    if (!names.length) {
        empty.style.display = '';
        list.style.display = 'none';
        return;
    }

    empty.style.display = 'none';
    list.style.display = '';

    names.forEach((name, i) => {
        const cfg = _getSlotCfg(i);
        const btn = el('button', {
            className: 'sampler-pad' + (cfg.loop ? ' loop-on' : '') + (i === ctx.samplerSelectedSlot ? ' selected' : ''),
            type: 'button'
        });
        btn.title = `${name} (Click to play, Right-click to select)`;
        const lbl = el('span', { className: 'sampler-pad-lbl', textContent: _padLabel(name) });
        btn.appendChild(lbl);

        const meta = el('span', { className: 'sampler-pad-badges' });
        if (i < SAMPLER_PAD_KEYS.length) {
            meta.appendChild(el('kbd', { className: 'sampler-key-badge', textContent: SAMPLER_PAD_KEYS[i] }));
        }
        const loopTag = el('span', { className: 'sampler-loop-badge', textContent: '∞', title: 'Loop enabled' });
        meta.appendChild(loopTag);
        btn.appendChild(meta);

        const prog = el('span', { className: 'sampler-pad-prog' });
        btn.appendChild(prog);
        _padProgressEls.push(prog);

        btn.addEventListener('click', () => _sendPlay(i));
        btn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            ctx.samplerSelectedSlot = i;
            _refreshInspector();
        });
        list.appendChild(btn);
        ctx.samplerButtons.push(btn);

        // Sync saved loop/gain/pitch to Bela once discovered
        if (cfg.loop || cfg.gain !== 1.0 || cfg.pitch !== 0) {
            _pushSlotCfg(i, cfg);
        }
    });
    _refreshInspector();
}

/** Builds the Live Sampler card. */
export function buildSamplerCard() {
    const card = el('div', { className: 'card live-tile', id: 'live-sampler-card' });
    card.dataset.tile = 'sampler';
    const hdr = el('div', { className: 'card-header-row' });
    hdr.appendChild(cardTitle('Sampler'));

    const tools = el('div', { className: 'sampler-hdr-tools' });
    _uploadStatusEl = el('span', { className: 'sampler-upload-status' });
    tools.appendChild(_uploadStatusEl);

    const stopBtn = el('button', {
        type: 'button',
        className: 'sampler-tool-btn stop',
        textContent: '■ Stop',
        title: 'Stop playing sample (key: X)'
    });
    stopBtn.addEventListener('click', _sendStop);
    tools.appendChild(stopBtn);

    const fileInput = el('input', {
        type: 'file',
        accept: '.wav,.mp3,audio/wav,audio/mpeg',
        style: 'display:none'
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
            _handleUploadFile(fileInput.files[0]);
            fileInput.value = '';
        }
    });
    const upBtn = el('button', {
        type: 'button',
        className: 'sampler-tool-btn',
        textContent: '+ WAV/MP3',
        title: 'Upload WAV/MP3 sample to Bela (or drag & drop)'
    });
    upBtn.addEventListener('click', () => fileInput.click());
    tools.appendChild(upBtn);
    tools.appendChild(fileInput);

    hdr.appendChild(tools);
    card.appendChild(hdr);

    // Drag & Drop WAV/MP3 upload onto card
    card.addEventListener('dragover', (e) => {
        e.preventDefault();
        card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
            _handleUploadFile(e.dataTransfer.files[0]);
        }
    });

    const body = el('div', { id: 'sampler-body' });

    const empty = el('div', { id: 'sampler-empty', className: 'sampler-empty' });
    empty.textContent = EMPTY_MSG;
    body.appendChild(empty);

    const list = el('div', { id: 'sampler-grid', className: 'sampler-grid' });
    list.style.display = 'none';
    body.appendChild(list);

    // Selected Pad Inspector Bar (Loop, Gain, Pitch)
    const insp = el('div', { className: 'sampler-inspector' });
    _inspTitleEl = el('span', { className: 'sampler-insp-name', textContent: '#1' });
    insp.appendChild(_inspTitleEl);

    _inspLoopBtn = el('button', {
        type: 'button',
        className: 'sampler-insp-loop',
        textContent: '∞ Loop',
        'aria-pressed': 'false'
    });
    _inspLoopBtn.addEventListener('click', () => {
        const slot = getContext().samplerSelectedSlot || 0;
        const cfg = { ..._getSlotCfg(slot) };
        cfg.loop = !cfg.loop;
        _pushSlotCfg(slot, cfg);
        _refreshInspector();
    });
    insp.appendChild(_inspLoopBtn);

    const gWrap = el('label', { className: 'sampler-insp-ctrl' });
    gWrap.appendChild(el('span', { textContent: 'Vol' }));
    _inspGainSlider = el('input', { type: 'range', min: '0', max: '150', step: '5', value: '100', 'aria-label': 'Pad Gain' });
    _inspGainVal = el('span', { className: 'sampler-insp-val', textContent: '100%' });
    _inspGainSlider.addEventListener('input', () => {
        const slot = getContext().samplerSelectedSlot || 0;
        const cfg = { ..._getSlotCfg(slot) };
        const pct = parseInt(_inspGainSlider.value, 10);
        cfg.gain = pct / 100;
        _inspGainVal.textContent = pct + '%';
        _pushSlotCfg(slot, cfg);
    });
    gWrap.appendChild(_inspGainSlider);
    gWrap.appendChild(_inspGainVal);
    insp.appendChild(gWrap);

    const pWrap = el('label', { className: 'sampler-insp-ctrl' });
    pWrap.appendChild(el('span', { textContent: 'Pitch' }));
    _inspPitchSlider = el('input', { type: 'range', min: '-12', max: '12', step: '1', value: '0', 'aria-label': 'Pad Pitch' });
    _inspPitchVal = el('span', { className: 'sampler-insp-val', textContent: '0 st' });
    _inspPitchSlider.addEventListener('input', () => {
        const slot = getContext().samplerSelectedSlot || 0;
        const cfg = { ..._getSlotCfg(slot) };
        const st = parseInt(_inspPitchSlider.value, 10);
        cfg.pitch = st;
        _inspPitchVal.textContent = (st > 0 ? '+' : '') + st + ' st';
        _pushSlotCfg(slot, cfg);
    });
    pWrap.appendChild(_inspPitchSlider);
    pWrap.appendChild(_inspPitchVal);
    insp.appendChild(pWrap);

    body.appendChild(insp);
    card.appendChild(body);

    const ctx = getContext();
    ctx.samplerEmptyEl = empty;
    ctx.samplerListEl = list;
    ctx.samplerButtons = [];
    ctx.samplerHighlight = -1;
    ctx.samplerNamesBuilt = false;

    // If names arrived before the tile was mounted, rebuild now.
    if (ctx.samplerNames && ctx.samplerNames.length) {
        _rebuildList(ctx.samplerNames);
        ctx.samplerNamesBuilt = true;
    } else if (ctx.samplerState &&
               (ctx.samplerState[0] < 0.5 || Math.round(ctx.samplerState[1] || 0) === 0)) {
        empty.style.display = '';
    }

    return card;
}

/**
 * Applies buffer 10/11 updates: rebuild list once, highlight playing slot.
 */
export function updateSampler() {
    const ctx = getContext();
    if (!ctx.samplerListEl) return;

    // No buffer 10 yet (C++ not rebuilt / not running with SamplePlayer).
    if (!ctx.samplerStateLive) {
        if (ctx.samplerEmptyEl) {
            ctx.samplerEmptyEl.textContent = WAIT_MSG;
            ctx.samplerEmptyEl.style.display = '';
        }
        if (ctx.samplerListEl) ctx.samplerListEl.style.display = 'none';
        return;
    }

    const st = ctx.samplerState;
    const folderOk = st[0] > 0.5;
    const count = Math.max(0, Math.round(st[1] || 0));

    if (!folderOk) {
        if (ctx.samplerEmptyEl) {
            ctx.samplerEmptyEl.textContent = EMPTY_MSG;
            ctx.samplerEmptyEl.style.display = '';
        }
        if (ctx.samplerListEl) ctx.samplerListEl.style.display = 'none';
        ctx.samplerButtons = [];
        return;
    }

    if (count === 0) {
        if (ctx.samplerEmptyEl) {
            ctx.samplerEmptyEl.textContent = NONE_MSG;
            ctx.samplerEmptyEl.style.display = '';
        }
        if (ctx.samplerListEl) ctx.samplerListEl.style.display = 'none';
        ctx.samplerButtons = [];
        return;
    }

    // Names may arrive slightly after state (static buffer cadence).
    if (!ctx.samplerNamesBuilt && ctx.samplerNamesBuf) {
        ctx.samplerNames = decodeSampleNames(ctx.samplerNamesBuf, count);
        _rebuildList(ctx.samplerNames);
        ctx.samplerNamesBuilt = true;
    } else if (!ctx.samplerNamesBuilt) {
        // Show placeholders until buffer 11 arrives so the tile is not blank.
        if (!ctx.samplerButtons || ctx.samplerButtons.length !== count) {
            const placeholders = [];
            for (let i = 0; i < count; ++i) placeholders.push(`Sample ${i + 1}`);
            _rebuildList(placeholders);
        }
    }

    const playingSlot = Math.round(st[2]);
    const isPlaying = st[3] > 0.5;
    const playhead = Math.max(0, Math.min(1, st[4] || 0));
    const highlight = isPlaying ? playingSlot : -1;

    _padProgressEls.forEach((prog, i) => {
        if (!prog) return;
        prog.style.width = (i === highlight) ? (Math.round(playhead * 100) + '%') : '0%';
    });

    if (ctx.samplerHighlight === highlight) return;
    ctx.samplerHighlight = highlight;
    (ctx.samplerButtons || []).forEach((btn, i) => {
        btn.classList.toggle('playing', i === highlight);
    });
}
