/**
 * Keyboard Shortcuts + WebMIDI Controller Mapping (MIDI Learn) for Live Dub Control.
 */
import { getContext } from './context.js';
import { MIDI_STORAGE_KEY } from './config.js';
import { belaControlReady } from './bela/connection.js';
import { tapTempo } from './tempo.js';
import { el } from './dom/utils.js';

export const MIDI_ACTIONS = [
    { id: 'kill_0', label: 'Kill SUB', kind: 'toggle' },
    { id: 'kill_1', label: 'Kill KICK', kind: 'toggle' },
    { id: 'kill_2', label: 'Kill MID', kind: 'toggle' },
    { id: 'kill_3', label: 'Kill TOP', kind: 'toggle' },
    { id: 'siren_gate', label: 'Dub Siren Gate', kind: 'momentary' },
    { id: 'tap_tempo', label: 'Tap Tempo', kind: 'trigger' },
    { id: 'aux_mute_0', label: 'AUX 1 Mute', kind: 'toggle' },
    { id: 'aux_mute_1', label: 'AUX 2 Mute', kind: 'toggle' },
    { id: 'aux_mute_2', label: 'AUX 3 Mute', kind: 'toggle' },
    { id: 'aux_mute_3', label: 'AUX 4 Mute', kind: 'toggle' },
    { id: 'echo_kill', label: 'Echo Dub Kill Send', kind: 'toggle' },
    { id: 'echo_clear', label: 'Echo Dub Clear', kind: 'trigger' },
    { id: 'spring_splash', label: 'Tubby Spring Splash', kind: 'trigger' },
    { id: 'master_warmth', label: 'Master Warmth (CC)', kind: 'cc' },
    { id: 'master_width', label: 'Stereo Width (CC)', kind: 'cc' },
    { id: 'master_punch', label: 'Master 4-Band Punch (CC)', kind: 'cc' },
    { id: 'sampler_0', label: 'Sampler Pad 1', kind: 'trigger' },
    { id: 'sampler_1', label: 'Sampler Pad 2', kind: 'trigger' },
    { id: 'sampler_2', label: 'Sampler Pad 3', kind: 'trigger' },
    { id: 'sampler_3', label: 'Sampler Pad 4', kind: 'trigger' },
    { id: 'sampler_4', label: 'Sampler Pad 5', kind: 'trigger' },
    { id: 'sampler_5', label: 'Sampler Pad 6', kind: 'trigger' },
    { id: 'sampler_6', label: 'Sampler Pad 7', kind: 'trigger' },
    { id: 'sampler_7', label: 'Sampler Pad 8', kind: 'trigger' }
];

let _midiMap = {}; // actionId -> { type: 'note'|'cc', ch, num }
let _midiAccess = null;
let _modalEl = null;
let _modalStatusEl = null;
let _modalRowsWrap = null;
let _perfToggleHook = null;
let _uiRefreshHook = null;
let _midiBadgeBtn = null;
let _spaceSirenActive = false;

const SAMPLER_KEY_MAP = {
    KeyQ: 0, KeyW: 1, KeyE: 2, KeyR: 3,
    KeyA: 4, KeyS: 5, KeyD: 6, KeyF: 7
};

function _sendBela(payload) {
    if (!belaControlReady()) return;
    /* global Bela */
    Bela.control.send(payload);
}

export function registerPerfToggleHook(fn) {
    _perfToggleHook = fn;
}

export function registerInputUiRefreshHook(fn) {
    _uiRefreshHook = fn;
}

export function registerMidiBadgeButton(btn) {
    _midiBadgeBtn = btn;
    _updateMidiBadge();
}

function _loadMidiMap() {
    try {
        const raw = localStorage.getItem(MIDI_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') return parsed;
        }
    } catch (_) {}
    return {};
}

function _saveMidiMap() {
    try {
        localStorage.setItem(MIDI_STORAGE_KEY, JSON.stringify(_midiMap));
    } catch (_) {}
}

export function toggleKillMaskBit(bitIdx) {
    const ctx = getContext();
    ctx.guiKillsMask = (ctx.guiKillsMask ^ (1 << bitIdx)) & 0x0F;
    _sendBela({ event: 'custom', guiKillsMask: ctx.guiKillsMask });
    if (typeof _uiRefreshHook === 'function') _uiRefreshHook();
}

export function setSirenGuiGate(on) {
    _sendBela({ event: 'custom', sirenGate: !!on });
}

function _executeAction(actionId, valueNorm, isPress) {
    const ctx = getContext();
    if (actionId.startsWith('kill_')) {
        if (!isPress) return;
        const idx = parseInt(actionId.slice(5), 10);
        toggleKillMaskBit(idx);
        return;
    }
    if (actionId === 'siren_gate') {
        setSirenGuiGate(isPress);
        return;
    }
    if (actionId === 'tap_tempo') {
        if (isPress) tapTempo();
        return;
    }
    if (actionId.startsWith('aux_mute_')) {
        if (!isPress) return;
        const idx = parseInt(actionId.slice(9), 10);
        ctx.auxMuted[idx] = !ctx.auxMuted[idx];
        _sendBela({ event: 'custom', auxMute: { aux: idx, muted: ctx.auxMuted[idx] } });
        if (typeof _uiRefreshHook === 'function') _uiRefreshHook();
        return;
    }
    if (actionId === 'echo_kill') {
        if (!isPress) return;
        ctx.echoDub.kill = !ctx.echoDub.kill;
        _sendBela({ event: 'custom', echoDub: { kill: ctx.echoDub.kill }, echuDub: { kill: ctx.echoDub.kill } });
        if (typeof _uiRefreshHook === 'function') _uiRefreshHook();
        return;
    }
    if (actionId === 'echo_clear') {
        if (isPress) _sendBela({ event: 'custom', echoDubClear: true, echuDubClear: true });
        return;
    }
    if (actionId === 'spring_splash') {
        if (isPress) _sendBela({ event: 'custom', tubbySpringSplash: true });
        return;
    }
    if (actionId === 'master_warmth') {
        ctx.masterBus.warmth = Math.max(0, Math.min(1, valueNorm));
        _sendBela({ event: 'custom', masterBus: { warmth: ctx.masterBus.warmth } });
        if (typeof _uiRefreshHook === 'function') _uiRefreshHook();
        return;
    }
    if (actionId === 'master_width') {
        ctx.masterBus.stereoWidth = Math.round(valueNorm * 1.5 * 100) / 100;
        _sendBela({ event: 'custom', masterBus: { stereoWidth: ctx.masterBus.stereoWidth } });
        if (typeof _uiRefreshHook === 'function') _uiRefreshHook();
        return;
    }
    if (actionId === 'master_punch') {
        ctx.masterBus.punch = Math.max(0, Math.min(1, valueNorm));
        _sendBela({ event: 'custom', masterBus: { punch: ctx.masterBus.punch } });
        if (typeof _uiRefreshHook === 'function') _uiRefreshHook();
        return;
    }
    if (actionId.startsWith('sampler_')) {
        if (!isPress) return;
        const slot = parseInt(actionId.slice(8), 10);
        _sendBela({ event: 'custom', samplerPlay: slot });
    }
}

function _isTextInputFocused() {
    const a = document.activeElement;
    if (!a) return false;
    const tag = a.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || a.isContentEditable;
}

/** Installs global live keyboard shortcuts. */
export function initKeyboardShortcuts() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (_modalEl && !_modalEl.hasAttribute('hidden')) {
            if (e.key === 'Escape') closeMidiModal();
            return;
        }
        if (_isTextInputFocused()) return;

        if (e.code === 'Space') {
            e.preventDefault();
            if (!e.repeat && !_spaceSirenActive) {
                _spaceSirenActive = true;
                setSirenGuiGate(true);
            }
            return;
        }
        if (e.repeat) return;

        if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') {
            e.preventDefault();
            toggleKillMaskBit(parseInt(e.key, 10) - 1);
            return;
        }
        if (e.code === 'KeyT') {
            e.preventDefault();
            tapTempo();
            return;
        }
        if (e.code === 'KeyP') {
            e.preventDefault();
            if (typeof _perfToggleHook === 'function') _perfToggleHook();
            return;
        }
        if (e.code === 'KeyX' || e.key === 'Backspace') {
            e.preventDefault();
            _sendBela({ event: 'custom', samplerStop: true });
            return;
        }
        if (SAMPLER_KEY_MAP[e.code] !== undefined) {
            e.preventDefault();
            _sendBela({ event: 'custom', samplerPlay: SAMPLER_KEY_MAP[e.code] });
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space' && _spaceSirenActive) {
            _spaceSirenActive = false;
            setSirenGuiGate(false);
        }
    });

    window.addEventListener('blur', () => {
        if (_spaceSirenActive) {
            _spaceSirenActive = false;
            setSirenGuiGate(false);
        }
    });
}

function _formatMidiBinding(b) {
    if (!b) return '—';
    const prefix = b.type === 'cc' ? 'CC' : 'Note';
    return `Ch${b.ch + 1} · ${prefix} ${b.num}`;
}

function _onMidiMessage(ev) {
    const d = ev.data;
    if (!d || d.length < 2) return;
    const status = d[0] & 0xF0;
    const ch = d[0] & 0x0F;
    const num = d[1];
    const val = d.length > 2 ? d[2] : 0;

    let msgType = null;
    let isPress = false;
    if (status === 0x90 && val > 0) {
        msgType = 'note';
        isPress = true;
    } else if (status === 0x80 || (status === 0x90 && val === 0)) {
        msgType = 'note';
        isPress = false;
    } else if (status === 0xB0) {
        msgType = 'cc';
        isPress = val >= 64;
    } else {
        return;
    }

    const ctx = getContext();
    if (ctx.midiLearnTarget) {
        if (msgType === 'note' && !isPress) return;
        const targetId = ctx.midiLearnTarget;
        ctx.midiLearnTarget = null;
        _midiMap[targetId] = { type: msgType, ch, num };
        _saveMidiMap();
        _renderMidiRows();
        return;
    }

    const norm = val / 127;
    for (const [actionId, b] of Object.entries(_midiMap)) {
        if (!b || b.type !== msgType || b.ch !== ch || b.num !== num) continue;
        if (msgType === 'cc') {
            const meta = MIDI_ACTIONS.find(a => a.id === actionId);
            if (meta && meta.kind === 'cc') {
                _executeAction(actionId, norm, true);
            } else if (isPress) {
                _executeAction(actionId, norm, true);
            }
        } else {
            _executeAction(actionId, norm, isPress);
        }
    }
}

function _bindMidiInputs() {
    if (!_midiAccess) return;
    const ctx = getContext();
    let count = 0;
    let firstName = '';
    for (const inp of _midiAccess.inputs.values()) {
        inp.onmidimessage = _onMidiMessage;
        if (!firstName) firstName = inp.name || 'MIDI Device';
        count++;
    }
    ctx.midiConnected = count > 0;
    ctx.midiDeviceName = count > 1 ? `${firstName} (+${count - 1})` : firstName;
    _updateMidiBadge();
    if (_modalStatusEl) {
        _modalStatusEl.textContent = count > 0
            ? `Connected: ${ctx.midiDeviceName}`
            : 'No MIDI input detected (plug in a USB MIDI controller)';
    }
}

function _updateMidiBadge() {
    if (!_midiBadgeBtn) return;
    const ctx = getContext();
    _midiBadgeBtn.classList.toggle('midi-online', !!ctx.midiConnected);
    _midiBadgeBtn.title = ctx.midiConnected
        ? `WebMIDI connected (${ctx.midiDeviceName}) · Shortcuts & MIDI Learn`
        : 'Keyboard Shortcuts & WebMIDI Learn';
}

/** Initialises WebMIDI + loads persisted MIDI map. */
export function initInputControls() {
    _midiMap = _loadMidiMap();
    initKeyboardShortcuts();

    if (typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function') {
        navigator.requestMIDIAccess().then(access => {
            _midiAccess = access;
            _bindMidiInputs();
            access.onstatechange = () => _bindMidiInputs();
        }).catch(() => {
            if (_modalStatusEl) _modalStatusEl.textContent = 'WebMIDI permission denied or unavailable.';
        });
    }
}

function _renderMidiRows() {
    if (!_modalRowsWrap) return;
    const ctx = getContext();
    _modalRowsWrap.innerHTML = '';
    MIDI_ACTIONS.forEach(act => {
        const row = el('div', { className: 'midi-map-row' });
        row.appendChild(el('span', { className: 'midi-act-lbl', textContent: act.label }));

        const binding = _midiMap[act.id];
        row.appendChild(el('span', {
            className: 'midi-bind-val' + (binding ? ' mapped' : ''),
            textContent: _formatMidiBinding(binding)
        }));

        const isLearning = ctx.midiLearnTarget === act.id;
        const learnBtn = el('button', {
            type: 'button',
            className: 'midi-learn-btn' + (isLearning ? ' learning' : ''),
            textContent: isLearning ? 'Listening…' : 'Learn'
        });
        learnBtn.addEventListener('click', () => {
            ctx.midiLearnTarget = isLearning ? null : act.id;
            _renderMidiRows();
        });
        row.appendChild(learnBtn);

        const clearBtn = el('button', {
            type: 'button',
            className: 'midi-clear-btn',
            textContent: '×',
            title: 'Clear MIDI binding',
            disabled: !binding
        });
        clearBtn.addEventListener('click', () => {
            delete _midiMap[act.id];
            _saveMidiMap();
            _renderMidiRows();
        });
        row.appendChild(clearBtn);

        _modalRowsWrap.appendChild(row);
    });
}

/** Opens the Keyboard Shortcuts & WebMIDI Learn modal. */
export function openMidiModal() {
    if (!_modalEl) {
        const backdrop = el('div', { className: 'map-modal-backdrop', id: 'midi-modal-backdrop', hidden: true });
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeMidiModal();
        });
        const panel = el('div', { className: 'map-modal-panel midi-modal-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Keyboard & WebMIDI Control' });

        const hdr = el('div', { className: 'midi-modal-hdr' });
        hdr.appendChild(el('div', { className: 'map-modal-title', textContent: 'Keyboard Shortcuts & WebMIDI' }));
        const closeBtn = el('button', { type: 'button', className: 'midi-close-btn', textContent: 'Close' });
        closeBtn.addEventListener('click', closeMidiModal);
        hdr.appendChild(closeBtn);
        panel.appendChild(hdr);

        const shortcutsBox = el('div', { className: 'midi-shortcuts-box' });
        shortcutsBox.innerHTML =
            '<span><kbd>Space</kbd> Siren Gate</span>' +
            '<span><kbd>1</kbd>–<kbd>4</kbd> Kill SUB/KICK/MID/TOP</span>' +
            '<span><kbd>T</kbd> Tap Tempo</span>' +
            '<span><kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd><kbd>R</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><kbd>F</kbd> Sampler 1–8</span>' +
            '<span><kbd>X</kbd> Stop Sample</span>' +
            '<span><kbd>P</kbd> Perf Mode</span>';
        panel.appendChild(shortcutsBox);

        _modalStatusEl = el('div', { className: 'midi-status-line' });
        _modalStatusEl.textContent = (typeof navigator !== 'undefined' && navigator.requestMIDIAccess)
            ? (getContext().midiConnected ? `Connected: ${getContext().midiDeviceName}` : 'No MIDI input detected')
            : 'WebMIDI requires Chrome/Edge over HTTPS or localhost.';
        panel.appendChild(_modalStatusEl);

        _modalRowsWrap = el('div', { className: 'midi-rows-wrap' });
        panel.appendChild(_modalRowsWrap);

        backdrop.appendChild(panel);
        document.body.appendChild(backdrop);
        _modalEl = backdrop;
    }
    _renderMidiRows();
    _modalEl.removeAttribute('hidden');
}

export function closeMidiModal() {
    getContext().midiLearnTarget = null;
    if (_modalEl) _modalEl.setAttribute('hidden', '');
}
