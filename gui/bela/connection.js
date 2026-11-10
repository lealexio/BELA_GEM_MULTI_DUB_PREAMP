/** Bela WebSocket connection health and header badge. */
import { getContext } from '../context.js';
import {
    BELA_OFFLINE_TIMEOUT_MS, BELA_LAG_THRESHOLD_MS, BELA_LAG_HOLD_MS,
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

let _belaListenersAttached = false;

/**
 * Attaches event listeners to Bela.data.target and the WebSocket
 * to record actual packet reception timestamps.
 */
export function ensureBelaWatchdogListeners() {
    if (_belaListenersAttached) return true;
    if (typeof Bela === 'undefined') return false;

    const onDataReceived = () => {
        try {
            const ctx = getContext();
            ctx.lastBelaRxMs = Date.now();
            ctx.belaRxPackets = (ctx.belaRxPackets || 0) + 1;
        } catch (_) {}
    };

    // 1. Bela.data.target EventTarget dispatches 'buffer-ready' whenever any buffer is received
    if (Bela.data && Bela.data.target && typeof Bela.data.target.addEventListener === 'function') {
        Bela.data.target.addEventListener('buffer-ready', onDataReceived);
        _belaListenersAttached = true;
    }

    // 2. Underlying WebSocket message listener
    const ws = Bela.socket || Bela.ws || (Bela.data && Bela.data.socket);
    if (ws && typeof ws.addEventListener === 'function') {
        ws.addEventListener('message', onDataReceived);
        ws.addEventListener('close', () => {
            try {
                const ctx = getContext();
                ctx.lastBelaRxMs = 0;
                ctx.belaConnState = 'offline';
                updateBadge();
            } catch (_) {}
        });
        _belaListenersAttached = true;
    }

    return _belaListenersAttached;
}

/**
 * Fallback fingerprint covering buffers if event listeners are unavailable (e.g. test harness).
 */
export function sampleBelaFingerprint(b) {
    if (!b) return '';
    const parts = [];
    if (b[0] && b[0].length) {
        parts.push('p:' + b[0][0].toFixed(3) + ':' + b[0][b[0].length - 1].toFixed(3) + ':' + b[0].length);
    }
    if (b[3] && b[3].length) {
        parts.push('a:' + b[3][0].toFixed(4));
    }
    return parts.join(',');
}

export function updateBelaRxWatchdog(b) {
    if (!b) return;
    ensureBelaWatchdogListeners();

    const now = Date.now();
    const ctx = getContext();

    // If watchdog listeners are active, lastBelaRxMs is updated by incoming events.
    // However, if lastBelaRxMs is still 0 (e.g. first frame received), initialise it now.
    if (ctx.lastBelaRxMs === 0 && (b[0] || b[1] || b[3])) {
        ctx.lastBelaRxMs = now;
    }

    // If event listeners could not be attached (e.g. mock/test harness), fallback to change detection
    if (!_belaListenersAttached && b[0]) {
        const fp = sampleBelaFingerprint(b);
        if (fp !== ctx.belaRxFingerprint) {
            ctx.belaRxFingerprint = fp;
            ctx.lastBelaRxMs = now;
        }
    }
}

export function getBelaConnState() {
    if (typeof Bela === 'undefined') return 'offline';
    if (!belaSocketOpen()) return 'offline';
    const ctx = getContext();
    if (ctx.lastBelaRxMs === 0) return 'offline';

    const now = Date.now();
    const staleMs = now - ctx.lastBelaRxMs;

    if (staleMs >= BELA_OFFLINE_TIMEOUT_MS) {
        ctx.belaConnState = 'offline';
        return 'offline';
    }

    if (staleMs >= BELA_LAG_THRESHOLD_MS) {
        ctx.belaConnState = 'lag';
        ctx.belaLastLagMs = now;
        return 'lag';
    }

    // Anti-flicker: if we were lagging, hold the LAG state for BELA_LAG_HOLD_MS
    // so momentary packets do not cause strobe-like switching.
    if (ctx.belaConnState === 'lag' && (now - (ctx.belaLastLagMs || 0)) < BELA_LAG_HOLD_MS) {
        return 'lag';
    }

    ctx.belaConnState = 'live';
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
