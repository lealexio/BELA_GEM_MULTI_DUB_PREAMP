/** Live dashboard layout prefs (localStorage): visibility + order. */
import {
    LIVE_TILES,
    LIVE_LAYOUT_STORAGE_KEY,
    LIVE_LAYOUT_STORAGE_KEY_V1
} from './config.js';

/** Returns default Live layout: enabled map + tile order. */
function defaultLiveLayout() {
    const enabled = {};
    const order = [];
    LIVE_TILES.forEach(t => {
        enabled[t.id] = !!t.defaultOn;
        order.push(t.id);
    });
    return { enabled, order };
}

/** Ensures prefs have a complete enabled map and a valid order array. */
function _normalize(prefs) {
    const def = defaultLiveLayout();
    const enabled = { ...def.enabled };
    const known = new Set(LIVE_TILES.map(t => t.id));

    if (prefs && prefs.enabled && typeof prefs.enabled === 'object') {
        LIVE_TILES.forEach(t => {
            if (typeof prefs.enabled[t.id] === 'boolean')
                enabled[t.id] = prefs.enabled[t.id];
        });
    }

    let order = Array.isArray(prefs && prefs.order) ? prefs.order.slice() : [];
    order = order.filter(id => known.has(id));
    LIVE_TILES.forEach(t => {
        if (!order.includes(t.id)) order.push(t.id);
    });

    return { enabled, order };
}

/** Migrates flat v1 boolean map into v2 { enabled, order }. */
function _migrateV1(parsed) {
    const prefs = defaultLiveLayout();
    if (!parsed || typeof parsed !== 'object') return prefs;
    LIVE_TILES.forEach(t => {
        if (typeof parsed[t.id] === 'boolean')
            prefs.enabled[t.id] = parsed[t.id];
    });
    return prefs;
}

/** Loads Live layout prefs from localStorage (v2, or migrate v1). */
export function loadLiveLayout() {
    try {
        const rawV2 = localStorage.getItem(LIVE_LAYOUT_STORAGE_KEY);
        if (rawV2) {
            const parsed = JSON.parse(rawV2);
            if (parsed && typeof parsed === 'object' && parsed.enabled)
                return _normalize(parsed);
        }
        const rawV1 = localStorage.getItem(LIVE_LAYOUT_STORAGE_KEY_V1);
        if (rawV1) {
            const migrated = _migrateV1(JSON.parse(rawV1));
            saveLiveLayout(migrated);
            return migrated;
        }
    } catch (_) { /* ignore corrupt storage */ }
    return defaultLiveLayout();
}

/** Persists Live layout prefs to localStorage. */
export function saveLiveLayout(prefs) {
    try {
        localStorage.setItem(LIVE_LAYOUT_STORAGE_KEY, JSON.stringify(prefs));
    } catch (_) { /* quota / private mode */ }
}

/** Returns true when a Live tile id is enabled. */
export function isLiveTileOn(prefs, id) {
    return !!(prefs && prefs.enabled && prefs.enabled[id]);
}

/**
 * Moves a tile one step in prefs.order.
 * @param {object} prefs
 * @param {string} id
 * @param {number} dir +1 down, -1 up
 * @returns {boolean} true if order changed
 */
export function moveLiveTile(prefs, id, dir) {
    if (!prefs || !Array.isArray(prefs.order)) return false;
    const i = prefs.order.indexOf(id);
    if (i < 0) return false;
    const j = i + dir;
    if (j < 0 || j >= prefs.order.length) return false;
    const tmp = prefs.order[i];
    prefs.order[i] = prefs.order[j];
    prefs.order[j] = tmp;
    return true;
}

/** Returns enabled tile ids in layout order. */
export function orderedLiveTiles(prefs) {
    if (!prefs || !Array.isArray(prefs.order)) return [];
    return prefs.order.filter(id => isLiveTileOn(prefs, id));
}
