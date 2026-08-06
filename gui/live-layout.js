/** Live dashboard layout prefs (localStorage). */
import { LIVE_TILES, LIVE_LAYOUT_STORAGE_KEY } from './config.js';

/** Returns default Live tile visibility map. */
export function defaultLiveLayout() {
    const prefs = {};
    LIVE_TILES.forEach(t => { prefs[t.id] = !!t.defaultOn; });
    return prefs;
}

/** Loads Live layout prefs from localStorage (falls back to defaults). */
export function loadLiveLayout() {
    const prefs = defaultLiveLayout();
    try {
        const raw = localStorage.getItem(LIVE_LAYOUT_STORAGE_KEY);
        if (!raw) return prefs;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return prefs;
        LIVE_TILES.forEach(t => {
            if (typeof parsed[t.id] === 'boolean')
                prefs[t.id] = parsed[t.id];
        });
    } catch (_) { /* ignore corrupt storage */ }
    return prefs;
}

/** Persists Live layout prefs to localStorage. */
export function saveLiveLayout(prefs) {
    try {
        localStorage.setItem(LIVE_LAYOUT_STORAGE_KEY, JSON.stringify(prefs));
    } catch (_) { /* quota / private mode */ }
}

/** Returns true when a Live tile id is enabled. */
export function isLiveTileOn(prefs, id) {
    return !!(prefs && prefs[id]);
}
