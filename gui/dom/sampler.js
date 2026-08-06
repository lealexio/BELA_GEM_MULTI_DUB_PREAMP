/** Live Sampler tile: lists project samples/ audio and triggers playback on Bela. */
import { getContext } from '../context.js';
import { MAX_SAMPLES, MAX_SAMPLE_NAME_LEN } from '../config.js';
import { belaControlReady } from '../bela/connection.js';
import { el, cardTitle } from './utils.js';

const EMPTY_MSG = 'Create a samples folder in the project and add WAV or MP3 files.';
const WAIT_MSG  = 'Waiting for sampler data from Bela…';
const NONE_MSG  = 'No WAV/MP3 files found in samples/.';

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
 * Sends a one-shot play command for the given slot index.
 * @param {number} slot
 */
function _sendPlay(slot) {
    if (!belaControlReady()) return;
    /* global Bela */
    Bela.control.send({ event: 'custom', samplerPlay: slot });
}

/**
 * Builds up to 3 pad lines from the basename (no extension).
 * Spaces force a line break; each line is capped at 6 characters.
 * Extra words / characters are discarded.
 * @param {string} filename
 * @returns {string[]}
 */
function _padLines(filename) {
    const base = String(filename || '').replace(/\.(wav|mp3)$/i, '');
    const words = base.split(/\s+/).filter(Boolean);
    const lines = [];
    for (let i = 0; i < words.length && lines.length < 3; ++i)
        lines.push(words[i].slice(0, 6));
    return lines.length ? lines : ['?'];
}

/**
 * Rebuilds the square pad grid from decoded names.
 * @param {string[]} names
 */
function _rebuildList(names) {
    const ctx = getContext();
    const list = ctx.samplerListEl;
    const empty = ctx.samplerEmptyEl;
    if (!list || !empty) return;

    list.innerHTML = '';
    ctx.samplerButtons = [];
    ctx.samplerHighlight = -1;

    if (!names.length) {
        empty.style.display = '';
        list.style.display = 'none';
        return;
    }

    empty.style.display = 'none';
    list.style.display = '';

    names.forEach((name, i) => {
        const btn = el('button', { className: 'sampler-pad', type: 'button' });
        btn.title = name;
        _padLines(name).forEach((line) => {
            const row = el('span', { className: 'sampler-pad-line' });
            row.textContent = line;
            btn.appendChild(row);
        });
        btn.addEventListener('click', () => _sendPlay(i));
        list.appendChild(btn);
        ctx.samplerButtons.push(btn);
    });
}

/** Builds the Live Sampler card. */
export function buildSamplerCard() {
    const card = el('div', { className: 'card live-tile' });
    card.dataset.tile = 'sampler';
    card.appendChild(cardTitle('Sampler'));

    const body = el('div', { id: 'sampler-body' });

    const hint = el('div', { className: 'sampler-hint' });
    hint.textContent = 'Uses Siren gain & FX send';
    body.appendChild(hint);

    const empty = el('div', { id: 'sampler-empty', className: 'sampler-empty' });
    empty.textContent = EMPTY_MSG;
    body.appendChild(empty);

    const list = el('div', { id: 'sampler-grid', className: 'sampler-grid' });
    list.style.display = 'none';
    body.appendChild(list);

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
    const highlight = isPlaying ? playingSlot : -1;
    if (ctx.samplerHighlight === highlight) return;
    ctx.samplerHighlight = highlight;
    (ctx.samplerButtons || []).forEach((btn, i) => {
        btn.classList.toggle('playing', i === highlight);
    });
}
