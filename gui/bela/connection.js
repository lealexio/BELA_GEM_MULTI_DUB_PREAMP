/** Bela WebSocket connection health and header badge. */
import { getContext } from '../context.js';
import {
    BELA_OFFLINE_TIMEOUT_MS, BELA_LAG_THRESHOLD_MS,
    CPU_TEMP_WARM_C, CPU_TEMP_HOT_C
} from '../config.js';

export function belaSocketOpen() {
    if(typeof Bela === 'undefined') return false;
    const ws = Bela.socket || Bela.ws || (Bela.data && Bela.data.socket);
    if(ws && typeof ws.readyState === 'number')
        return ws.readyState === WebSocket.OPEN;
    return true;
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

export function updateBadge() {
    const badge = document.getElementById('conn-badge');
    if(!badge) return;
    const state = getBelaConnState();
    if(state === 'live') {
        badge.textContent = 'LIVE';
        badge.className   = 'badge live';
    } else if(state === 'lag') {
        badge.textContent = 'LAG';
        badge.className   = 'badge lag';
    } else {
        badge.textContent = 'OFFLINE';
        badge.className   = 'badge';
    }
}

/**
 * Updates the CPU temperature bubble from GUI buffer 9 (°C).
 * @param {number|undefined} tempC - Celsius, or negative / NaN if unavailable
 */
export function updateTempBadge(tempC) {
    const badge = document.getElementById('temp-badge');
    if(!badge) return;
    if(typeof tempC !== 'number' || !isFinite(tempC) || tempC < 0) {
        badge.textContent = '--°C';
        badge.className   = 'badge temp unknown';
        return;
    }
    badge.textContent = `${Math.round(tempC)}°C`;
    let cls = 'badge temp';
    if(tempC >= CPU_TEMP_HOT_C)       cls += ' hot';
    else if(tempC >= CPU_TEMP_WARM_C) cls += ' warm';
    badge.className = cls;
}
