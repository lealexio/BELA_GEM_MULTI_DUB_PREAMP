/**
 * Live / FX Preset Snapshots (8 slots in localStorage + JSON Export/Import).
 */
import { getContext } from './context.js';
import {
    PRESETS_STORAGE_KEY,
    SUB_ROAR_DEFAULTS,
    ECHO_DUB_DEFAULTS,
    TUBBY_SPRING_DEFAULTS,
    BLACK_ARK_DEFAULTS,
    TAPE_DRIVE_DEFAULTS,
    SHIMMER_DELAY_DEFAULTS,
    DUB_DUCKER_DEFAULTS,
    FX_CHAIN_DEFAULTS,
    MASTER_BUS_DEFAULTS
} from './config.js';
import { belaControlReady } from './bela/connection.js';
import { setBpm } from './tempo.js';

export const PRESET_SLOTS = 8;

let _uiSyncCallback = null;

export function registerPresetUiSync(fn) {
    _uiSyncCallback = fn;
}

function _sendBela(payload) {
    if (!belaControlReady()) return;
    /* global Bela */
    Bela.control.send(payload);
}

/** Loads all 8 preset slots from localStorage. */
export function loadPresets() {
    const empty = new Array(PRESET_SLOTS).fill(null);
    try {
        const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
        if (!raw) return empty;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            for (let i = 0; i < PRESET_SLOTS; i++) {
                empty[i] = parsed[i] && typeof parsed[i] === 'object' ? parsed[i] : null;
            }
        }
    } catch (_) {}
    return empty;
}

function _saveAllPresets(list) {
    try {
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(list));
    } catch (_) {}
}

/** Captures a full snapshot of FX, Routing, Master Bus DSP, and BPM. */
export function captureSnapshot(name) {
    const ctx = getContext();
    return {
        name: name || 'Preset',
        savedAt: new Date().toISOString(),
        tempoBpm: ctx.tempoBpm,
        fxRouting: ctx.fxRouting.map(pair => [pair[0], pair[1]]),
        subRoar: { ...ctx.subRoar },
        echoDub: { ...ctx.echoDub },
        tubbySpring: { ...ctx.tubbySpring },
        blackArk: { ...ctx.blackArk },
        tapeDrive: { ...ctx.tapeDrive },
        shimmerDelay: { ...ctx.shimmerDelay },
        dubDucker: { ...ctx.dubDucker },
        fxChain: { ...ctx.fxChain },
        masterBus: { ...ctx.masterBus }
    };
}

/** Saves current state to a slot (0..7). */
export function savePresetSlot(slotIdx, customName) {
    if (slotIdx < 0 || slotIdx >= PRESET_SLOTS) return null;
    const list = loadPresets();
    const existing = list[slotIdx];
    const name = (customName && customName.trim())
        || (existing && existing.name)
        || `Preset ${slotIdx + 1}`;
    const snap = captureSnapshot(name);
    list[slotIdx] = snap;
    _saveAllPresets(list);
    return snap;
}

/** Clears one slot (0..7). */
export function clearPresetSlot(slotIdx) {
    if (slotIdx < 0 || slotIdx >= PRESET_SLOTS) return;
    const list = loadPresets();
    list[slotIdx] = null;
    _saveAllPresets(list);
}

/** Applies a snapshot object to runtime state, sends to Bela, and refreshes UI. */
export function applySnapshot(snap) {
    if (!snap || typeof snap !== 'object') return false;
    const ctx = getContext();

    if (Array.isArray(snap.fxRouting)) {
        for (let a = 0; a < 5; a++) {
            const pair = snap.fxRouting[a];
            if (Array.isArray(pair) && pair.length >= 2) {
                for (let s = 0; s < 2; s++) {
                    const dest = Math.max(0, Math.min(7, parseInt(pair[s], 10) || 0));
                    ctx.fxRouting[a][s] = dest;
                    _sendBela({ event: 'custom', fxRoute: { aux: a, send: s, dest } });
                }
            }
        }
    }

    if (snap.subRoar) {
        Object.assign(ctx.subRoar, SUB_ROAR_DEFAULTS, snap.subRoar);
        _sendBela({ event: 'custom', subRoar: { ...ctx.subRoar } });
    }
    if (snap.echoDub) {
        Object.assign(ctx.echoDub, ECHO_DUB_DEFAULTS, snap.echoDub);
        _sendBela({ event: 'custom', echoDub: { ...ctx.echoDub }, echuDub: { ...ctx.echoDub } });
    }
    if (snap.tubbySpring) {
        Object.assign(ctx.tubbySpring, TUBBY_SPRING_DEFAULTS, snap.tubbySpring);
        _sendBela({ event: 'custom', tubbySpring: { ...ctx.tubbySpring } });
    }
    if (snap.blackArk) {
        Object.assign(ctx.blackArk, BLACK_ARK_DEFAULTS, snap.blackArk);
        _sendBela({ event: 'custom', blackArk: { ...ctx.blackArk } });
    }
    if (snap.tapeDrive) {
        Object.assign(ctx.tapeDrive, TAPE_DRIVE_DEFAULTS, snap.tapeDrive);
        _sendBela({ event: 'custom', tapeDrive: { ...ctx.tapeDrive } });
    }
    if (snap.shimmerDelay) {
        Object.assign(ctx.shimmerDelay, SHIMMER_DELAY_DEFAULTS, snap.shimmerDelay);
        _sendBela({ event: 'custom', shimmerDelay: { ...ctx.shimmerDelay } });
    }
    if (snap.dubDucker) {
        Object.assign(ctx.dubDucker, DUB_DUCKER_DEFAULTS, snap.dubDucker);
        _sendBela({ event: 'custom', dubDucker: { ...ctx.dubDucker } });
    }
    if (snap.fxChain) {
        Object.assign(ctx.fxChain, FX_CHAIN_DEFAULTS, snap.fxChain);
        _sendBela({ event: 'custom', fxChain: { ...ctx.fxChain } });
    }
    if (snap.masterBus) {
        Object.assign(ctx.masterBus, MASTER_BUS_DEFAULTS, snap.masterBus);
        _sendBela({ event: 'custom', masterBus: { ...ctx.masterBus } });
    }
    if (typeof snap.tempoBpm === 'number') {
        setBpm(snap.tempoBpm);
    }

    if (typeof _uiSyncCallback === 'function') _uiSyncCallback();
    return true;
}

/** Recalls preset slot index (0..7). */
export function recallPresetSlot(slotIdx) {
    const list = loadPresets();
    const snap = list[slotIdx];
    if (!snap) return false;
    return applySnapshot(snap);
}

/** Exports all 8 preset slots as a JSON string. */
export function exportPresetsJson() {
    return JSON.stringify({ version: 1, presets: loadPresets() }, null, 2);
}

/** Imports preset slots from a JSON string. */
export function importPresetsJson(text) {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.presets) ? parsed.presets : null);
    if (!arr) throw new Error('Invalid preset JSON format');
    const out = new Array(PRESET_SLOTS).fill(null);
    for (let i = 0; i < PRESET_SLOTS; i++) {
        if (arr[i] && typeof arr[i] === 'object') out[i] = arr[i];
    }
    _saveAllPresets(out);
    return out;
}
