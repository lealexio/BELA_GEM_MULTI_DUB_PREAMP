/** Bela WebSocket connection health and header badge. */
import { getContext } from '../context.js';
import {
    BELA_OFFLINE_TIMEOUT_MS, BELA_LAG_THRESHOLD_MS,
    CPU_TEMP_WARM_C, CPU_TEMP_HOT_C
} from '../config.js';

/** Returns true when the Bela data WebSocket looks open. */
export function belaSocketOpen() {
    if(typeof Bela === 'undefined') return false;
    const ws = Bela.socket || Bela.ws || (Bela.data && Bela.data.socket);
    if(ws && typeof ws.readyState === 'number')
        return ws.readyState === WebSocket.OPEN;
    return true;
}

/** Returns true when Bela.control WebSocket is open and ready to send. */
export function belaControlReady() {
    /* global Bela */
    return typeof Bela !== 'undefined' &&
           Bela.control &&
           Bela.control.ws &&
           Bela.control.ws.readyState === 1;
}

export function sampleBelaFingerprint(b) {
    const parts = [];
    if(b[0]) {
        parts.push('p');
        for(let i = 0; i < Math.min(6, b[0].length); i++)
            parts.push(b[0][i].toFixed(4));
    }
    if(b[3]) {
        parts.push('a');
        for(let i = 0; i < b[3].length; i++)
            parts.push(b[3][i].toFixed(5));
    }
    return parts.join(',');
}

export function updateBelaRxWatchdog(b) {
    if(!b || !b[0]) return;
    const now = Date.now();
    const fp = sampleBelaFingerprint(b);
    if(fp !== getContext().belaRxFingerprint) {
        getContext().belaRxFingerprint = fp;
        getContext().lastBelaRxMs = now;
    } else if(getContext().lastBelaRxMs === 0) {
        getContext().belaRxFingerprint = fp;
        getContext().lastBelaRxMs = now;
    }
}

export function getBelaConnState() {
    if(typeof Bela === 'undefined') return 'offline';
    if(!belaSocketOpen()) return 'offline';
    if(getContext().lastBelaRxMs === 0) return 'offline';
    const staleMs = Date.now() - getContext().lastBelaRxMs;
    if(staleMs >= BELA_OFFLINE_TIMEOUT_MS) return 'offline';
    if(staleMs >= BELA_LAG_THRESHOLD_MS) return 'lag';
    return 'live';
}

export function isBelaConnected() {
    return getBelaConnState() !== 'offline';
}

/** Cached conn-badge element (resolved once on first call). */
let _connBadgeEl = null;
let _connBadgeLastState = '';

export function updateBadge() {
    if (!_connBadgeEl || !_connBadgeEl.isConnected)
        _connBadgeEl = document.getElementById('conn-badge');
    if (!_connBadgeEl) return;
    const state = getBelaConnState();
    if (state === _connBadgeLastState) return;
    _connBadgeLastState = state;
    if (state === 'live') {
        _connBadgeEl.textContent = 'LIVE';
        _connBadgeEl.className   = 'badge live';
    } else if (state === 'lag') {
        _connBadgeEl.textContent = 'LAG';
        _connBadgeEl.className   = 'badge lag';
    } else {
        _connBadgeEl.textContent = 'OFFLINE';
        _connBadgeEl.className   = 'badge';
    }
}

/** Cached temp-badge element and last displayed values. */
let _tempBadgeEl = null;
let _tempBadgeLastText = '';
let _tempBadgeLastCls = '';

/**
 * Updates the CPU temperature bubble from GUI buffer 9 (°C).
 * @param {number|undefined} tempC - Celsius, or negative / NaN if unavailable
 */
export function updateTempBadge(tempC) {
    if (!_tempBadgeEl || !_tempBadgeEl.isConnected)
        _tempBadgeEl = document.getElementById('temp-badge');
    if (!_tempBadgeEl) return;

    let text, cls;
    if (typeof tempC !== 'number' || !isFinite(tempC) || tempC < 0) {
        text = '--°C';
        cls  = 'badge temp unknown';
    } else {
        text = `${Math.round(tempC)}°C`;
        cls  = 'badge temp';
        if (tempC >= CPU_TEMP_HOT_C)       cls += ' hot';
        else if (tempC >= CPU_TEMP_WARM_C) cls += ' warm';
    }
    if (text !== _tempBadgeLastText) {
        _tempBadgeLastText = text;
        _tempBadgeEl.textContent = text;
    }
    if (cls !== _tempBadgeLastCls) {
        _tempBadgeLastCls = cls;
        _tempBadgeEl.className = cls;
    }
}
