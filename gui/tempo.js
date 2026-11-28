/**
 * Global Tap Tempo & BPM synchronization for time-based digital FX
 * (Echo Dub, Shimmer Delay, Black Ark Phaser).
 */
import { getContext } from './context.js';
import { TEMPO_DEFAULTS, TEMPO_STORAGE_KEY } from './config.js';
import { belaControlReady } from './bela/connection.js';

export const DELAY_SUBDIVS = [
    { id: '1/16', label: '1/16', beats: 0.25 },
    { id: '1/8',  label: '1/8',  beats: 0.5 },
    { id: '1/8d', label: '1/8d', beats: 0.75 },
    { id: '1/4',  label: '1/4',  beats: 1.0 },
    { id: '1/2',  label: '1/2',  beats: 2.0 }
];

export const PHASER_SUBDIVS = [
    { id: '1/2',  label: '1/2',  beats: 2.0 },
    { id: '1/1',  label: '1 Bar', beats: 4.0 },
    { id: '2/1',  label: '2 Bar', beats: 8.0 },
    { id: '4/1',  label: '4 Bar', beats: 16.0 }
];

let _taps = [];
const _bpmListeners = [];
let _syncUiHook = null;

function _sendBela(payload) {
    if (!belaControlReady()) return;
    /* global Bela */
    Bela.control.send(payload);
}

/** Loads persisted BPM on startup. */
export function loadSavedBpm() {
    try {
        const raw = localStorage.getItem(TEMPO_STORAGE_KEY);
        if (raw) {
            const v = parseFloat(raw);
            if (!isNaN(v)) {
                return Math.max(TEMPO_DEFAULTS.min, Math.min(TEMPO_DEFAULTS.max, Math.round(v * 10) / 10));
            }
        }
    } catch (_) {}
    return TEMPO_DEFAULTS.bpm;
}

function _saveBpm(bpm) {
    try {
        localStorage.setItem(TEMPO_STORAGE_KEY, String(bpm));
    } catch (_) {}
}

export function registerBpmListener(fn) {
    if (typeof fn === 'function') _bpmListeners.push(fn);
}

export function registerTempoSyncUiHook(fn) {
    _syncUiHook = fn;
}

/** Computes delay time (ms) from BPM and subdivision id. */
export function subdivToDelayMs(bpm, subdivId, minMs = 40, maxMs = 1500) {
    const item = DELAY_SUBDIVS.find(s => s.id === subdivId) || DELAY_SUBDIVS[2];
    const ms = Math.round((60000 / Math.max(20, bpm)) * item.beats);
    return Math.max(minMs, Math.min(maxMs, ms));
}

/** Computes phaser sweep LFO rate (Hz) from BPM and subdivision id. */
export function subdivToPhaserHz(bpm, subdivId) {
    const item = PHASER_SUBDIVS.find(s => s.id === subdivId) || PHASER_SUBDIVS[1];
    const hz = (bpm / 60) / item.beats;
    return Math.max(0.05, Math.min(5.0, Math.round(hz * 100) / 100));
}

/** Applies current BPM to all FX that have Sync enabled and notifies Bela + UI. */
export function applyTempoSyncToEffects() {
    const ctx = getContext();
    const bpm = ctx.tempoBpm || TEMPO_DEFAULTS.bpm;

    if (ctx.echoDub && ctx.echoDub.sync) {
        const ms = subdivToDelayMs(bpm, ctx.echoDub.subdiv, 40, 1500);
        if (ctx.echoDub.time !== ms) {
            ctx.echoDub.time = ms;
            _sendBela({ event: 'custom', echoDub: { time: ms }, echuDub: { time: ms } });
        }
    }

    if (ctx.shimmerDelay && ctx.shimmerDelay.sync) {
        const ms = subdivToDelayMs(bpm, ctx.shimmerDelay.subdiv, 40, 1500);
        if (ctx.shimmerDelay.delayTime !== ms) {
            ctx.shimmerDelay.delayTime = ms;
            _sendBela({ event: 'custom', shimmerDelay: { delayTime: ms } });
        }
    }

    if (ctx.blackArk && ctx.blackArk.sync) {
        const hz = subdivToPhaserHz(bpm, ctx.blackArk.subdiv);
        if (ctx.blackArk.rate !== hz) {
            ctx.blackArk.rate = hz;
            _sendBela({ event: 'custom', blackArk: { rate: hz } });
        }
    }

    if (typeof _syncUiHook === 'function') _syncUiHook();
}

/** Sets BPM, saves it, notifies listeners, and updates synced effects. */
export function setBpm(nextBpm) {
    const ctx = getContext();
    const clamped = Math.max(TEMPO_DEFAULTS.min, Math.min(TEMPO_DEFAULTS.max, Math.round(nextBpm * 10) / 10));
    ctx.tempoBpm = clamped;
    _saveBpm(clamped);
    applyTempoSyncToEffects();
    _bpmListeners.forEach(fn => fn(clamped));
    return clamped;
}

/** Nudges BPM by delta. */
export function nudgeBpm(delta) {
    const ctx = getContext();
    return setBpm((ctx.tempoBpm || TEMPO_DEFAULTS.bpm) + delta);
}

/** Records a Tap Tempo hit and updates BPM from moving average of recent taps. */
export function tapTempo() {
    const now = performance.now();
    if (_taps.length && (now - _taps[_taps.length - 1] > 2000)) {
        _taps = [];
    }
    _taps.push(now);
    if (_taps.length > 6) _taps.shift();

    if (_taps.length >= 2) {
        let sum = 0;
        for (let i = 1; i < _taps.length; i++) {
            sum += (_taps[i] - _taps[i - 1]);
        }
        const avgMs = sum / (_taps.length - 1);
        if (avgMs > 100) {
            const bpm = 60000 / avgMs;
            setBpm(Math.round(bpm));
        }
    }
    return getContext().tempoBpm;
}
