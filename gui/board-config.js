/** Runtime board config.json fetch + Bela.control Save / Restart / Reboot RPCs. */
import { getContext } from './context.js';
import { ROUTING_CONFIG } from './routing-config.js';
import { belaControlReady } from './bela/connection.js';
import { projectFileUrl } from './dom/utils.js';

let _reqSeq = 0;
let _listenerRegistered = false;
const _pendingRequests = new Map();

/** Escapes non-ASCII characters as \\uXXXX so Bela SimpleJSON (mbstowcs) parses safely. */
export function escapeAsciiJson(text) {
    return String(text).replace(/[\u007f-\uffff]/g, c =>
        '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4)
    );
}

/** Registers the Bela.control listener for configAction ACKs (idempotent). */
export function ensureConfigControlListener() {
    if (_listenerRegistered) return true;
    /* global Bela */
    if (typeof Bela === 'undefined' || !Bela.control ||
        typeof Bela.control.registerCallback !== 'function') {
        return false;
    }
    _listenerRegistered = true;
    Bela.control.registerCallback('preampConfig', (data) => {
        if (!data || data.event !== 'custom' || !data.configAction) return;
        const reqId = data.reqId || '';
        const pending = reqId && _pendingRequests.get(reqId);
        if (pending) {
            clearTimeout(pending.timer);
            _pendingRequests.delete(reqId);
            pending.resolve({
                ok: !!data.ok,
                error: data.error || '',
                content: data.content || ''
            });
            return;
        }
        // Fallback match by action name if reqId was omitted
        for (const [id, entry] of _pendingRequests.entries()) {
            if (entry.action === data.configAction) {
                clearTimeout(entry.timer);
                _pendingRequests.delete(id);
                entry.resolve({
                    ok: !!data.ok,
                    error: data.error || '',
                    content: data.content || ''
                });
                break;
            }
        }
    });
    return true;
}

/** Sends a custom config command over Bela.control and awaits its ACK. */
function sendConfigRequest(payload, expectedAction, timeoutMs = 6000) {
    ensureConfigControlListener();
    if (!belaControlReady()) {
        return Promise.resolve({
            ok: false,
            error: 'Bela control WebSocket not connected'
        });
    }
    const reqId = `${expectedAction}_${Date.now()}_${++_reqSeq}`;
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            _pendingRequests.delete(reqId);
            resolve({
                ok: false,
                error: `Timeout waiting for Bela (${expectedAction})`
            });
        }, timeoutMs);
        _pendingRequests.set(reqId, { action: expectedAction, resolve, timer });
        /* global Bela */
        Bela.control.send({ event: 'custom', ...payload, reqId });
    });
}

/** Fetches the literal config.json currently saved on Bela via HTTP. */
export async function fetchBoardConfigJson() {
    const baseUrl = projectFileUrl('config.json');
    const sep = baseUrl.indexOf('?') >= 0 ? '&' : '?';
    const url = `${baseUrl}${sep}t=${Date.now()}`;
    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            return {
                ok: false,
                status: res.status,
                error: res.status === 404
                    ? 'config.json not found on Bela'
                    : `HTTP ${res.status}`
            };
        }
        const text = await res.text();
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return { ok: false, error: 'Invalid config.json object on Bela' };
        }
        return { ok: true, text, parsed };
    } catch (err) {
        return { ok: false, error: err && err.message ? err.message : 'Fetch failed' };
    }
}

/** Returns the active routing object (live board config.json if loaded, else build-time ROUTING_CONFIG). */
export function getEffectiveRouting() {
    const ctx = getContext();
    if (ctx && ctx.boardConfigJson && ctx.boardConfigJson.routing &&
        typeof ctx.boardConfigJson.routing === 'object') {
        return ctx.boardConfigJson.routing;
    }
    return ROUTING_CONFIG;
}

/** Atomically saves config.json text to Bela via Bela.control. */
export function saveConfigToBela(jsonText) {
    return sendConfigRequest(
        { saveConfigText: escapeAsciiJson(jsonText) },
        'save',
        8000
    );
}

/** WebSocket fallback to read raw config.json from Bela. */
export function readConfigViaControl() {
    return sendConfigRequest({ readConfig: true }, 'read', 5000);
}

/** Requests a fast, click-free restart of the Bela audio program (~2–3 s, Wi-Fi intact). */
export function restartBelaAudio() {
    return sendConfigRequest({ restartAudio: true }, 'restartAudio', 5000);
}

/** Requests a full Linux OS reboot (~25–30 s) from Mapping -> Advanced. */
export function rebootBelaBoard() {
    return sendConfigRequest({ rebootBoard: true }, 'rebootBoard', 5000);
}
