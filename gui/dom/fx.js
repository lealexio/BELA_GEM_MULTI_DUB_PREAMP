/**
 * Digital Multi-FX Engine UI pane (Routing + Send Triggers, Tape Drive, Ducker,
 * Sub Roar, Echo Dub, Tubby Spring, Shimmer Delay, Black Ark Phaser).
 */
import { getContext } from '../context.js';
import {
    FX_DEST_HARDWARE,
    FX_DEST_SUB_ROAR,
    FX_DEST_ECHO_DUB,
    FX_DEST_TUBBY_SPRING,
    FX_DEST_BLACK_ARK,
    FX_DEST_TAPE_DRIVE,
    FX_DEST_SHIMMER_DELAY,
    FX_DEST_MUTE
} from '../config.js';
import { el, svgIcon } from './utils.js';

const ICON_SEND = ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7Z'];

function sendBelaControl(payload) {
    /* global Bela */
    if (typeof Bela !== 'undefined' && Bela.control && typeof Bela.control.send === 'function') {
        Bela.control.send(payload);
    }
}

/** Syncs UI button states and sends direct FX Send trigger state to render.cpp if changed. */
function syncFxTriggerOutput(aux, send) {
    const ctx = getContext();
    if (!ctx.fxTriggers || !ctx.fxMomentaryTriggers || !ctx.fxLatchedTriggers) return;

    const mom = !!ctx.fxMomentaryTriggers[aux][send];
    const lat = !!ctx.fxLatchedTriggers[aux][send];
    const effective = mom || lat;

    (ctx.fxTriggerButtons || []).forEach(btn => {
        if (parseInt(btn.dataset.aux, 10) === aux && parseInt(btn.dataset.send, 10) === send) {
            btn.classList.toggle('active', mom);
            btn.setAttribute('aria-pressed', mom ? 'true' : 'false');
        }
    });
    (ctx.fxLatchButtons || []).forEach(btn => {
        if (parseInt(btn.dataset.aux, 10) === aux && parseInt(btn.dataset.send, 10) === send) {
            btn.classList.toggle('active', lat);
            btn.setAttribute('aria-pressed', lat ? 'true' : 'false');
        }
    });

    if (ctx.fxTriggers[aux][send] === effective) return;
    ctx.fxTriggers[aux][send] = effective;

    sendBelaControl({
        event: 'custom',
        fxTrigger: { aux, send, active: effective, testTone: !!ctx.fxTestTone }
    });
}

function setMomentaryFxTrigger(aux, send, active) {
    const ctx = getContext();
    if (!ctx.fxMomentaryTriggers || ctx.fxMomentaryTriggers[aux][send] === active) return;
    ctx.fxMomentaryTriggers[aux][send] = active;
    syncFxTriggerOutput(aux, send);
}

function toggleLatchedFxTrigger(aux, send) {
    const ctx = getContext();
    if (!ctx.fxLatchedTriggers) return;
    ctx.fxLatchedTriggers[aux][send] = !ctx.fxLatchedTriggers[aux][send];
    syncFxTriggerOutput(aux, send);
}

/** Clears only momentary FX send triggers (preserves On/Off latched triggers). */
export function clearMomentaryFxTriggers() {
    const ctx = getContext();
    if (!ctx || !ctx.fxMomentaryTriggers) return;
    for (let a = 0; a < ctx.fxMomentaryTriggers.length; a++) {
        for (let s = 0; s < 2; s++) {
            if (ctx.fxMomentaryTriggers[a][s]) {
                ctx.fxMomentaryTriggers[a][s] = false;
                syncFxTriggerOutput(a, s);
            }
        }
    }
}

function clearAllFxTriggers() {
    const ctx = getContext();
    if (ctx) {
        [ctx.fxTriggers, ctx.fxMomentaryTriggers, ctx.fxLatchedTriggers].forEach(arr => {
            if (!arr) return;
            for (let a = 0; a < arr.length; a++) {
                arr[a][0] = false;
                arr[a][1] = false;
            }
        });
        (ctx.fxTriggerButtons || []).forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        });
        (ctx.fxLatchButtons || []).forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        });
    }
    sendBelaControl({ event: 'custom', fxTriggerClearAll: true });
}

let _windowBlurBound = false;

/** Builds the full FX tab pane. */
export function buildFxPane() {
    const pane = el('div', { className: 'tab-pane', id: 'tab-fx' });
    const container = el('div', { className: 'fx-pane-container' });

    if (!_windowBlurBound && typeof window !== 'undefined') {
        _windowBlurBound = true;
        window.addEventListener('blur', clearMomentaryFxTriggers);
    }

    container.appendChild(buildRoutingMatrixCard());

    const fxGrid = el('div', { className: 'fx-modules-grid' });
    fxGrid.appendChild(buildTapeDriveCard());
    fxGrid.appendChild(buildDubDuckerCard());
    fxGrid.appendChild(buildSubRoarCard());
    fxGrid.appendChild(buildEchoDubCard());
    fxGrid.appendChild(buildTubbySpringCard());
    fxGrid.appendChild(buildShimmerDelayCard());
    fxGrid.appendChild(buildBlackArkPhaserCard());

    container.appendChild(fxGrid);
    pane.appendChild(container);
    return pane;
}

/** Builds the channel FX send routing matrix card with direct Send Trigger buttons. */
function buildRoutingMatrixCard() {
    const ctx = getContext();
    const card = el('div', { className: 'fx-card fx-card-routing' });
    const cardHdr = el('div', { className: 'fx-card-header' });
    cardHdr.appendChild(el('div', { className: 'fx-card-title', textContent: 'Send Routing' }));

    const tools = el('div', { className: 'fx-routing-tools' });

    const testToneBtn = el('button', {
        type: 'button',
        className: 'fx-tool-btn' + (ctx.fxTestTone ? ' active' : ''),
        textContent: 'Test Tone',
        title: 'Inject 220/440 Hz test signal when triggering AUX sends',
        'aria-pressed': ctx.fxTestTone ? 'true' : 'false'
    });
    testToneBtn.addEventListener('click', () => {
        ctx.fxTestTone = !ctx.fxTestTone;
        testToneBtn.classList.toggle('active', ctx.fxTestTone);
        testToneBtn.setAttribute('aria-pressed', ctx.fxTestTone ? 'true' : 'false');
        sendBelaControl({ event: 'custom', fxTestTone: ctx.fxTestTone });
    });

    const allOffBtn = el('button', {
        type: 'button',
        className: 'fx-tool-btn',
        textContent: 'All Off',
        title: 'Turn off all active Send triggers'
    });
    allOffBtn.addEventListener('click', () => clearAllFxTriggers());

    tools.appendChild(testToneBtn);
    tools.appendChild(allOffBtn);
    cardHdr.appendChild(tools);
    card.appendChild(cardHdr);

    const table = el('div', { className: 'fx-matrix-table' });
    ctx.fxRouteSelects = [];
    ctx.fxTriggerButtons = [];
    ctx.fxLatchButtons = [];

    const auxNames = ['AUX 1', 'AUX 2', 'AUX 3', 'AUX 4', 'SIREN'];
    const destinations = [
        { id: FX_DEST_HARDWARE,      label: 'HW — Physical' },
        { id: FX_DEST_SUB_ROAR,      label: 'SUB — Sub Roar' },
        { id: FX_DEST_ECHO_DUB,      label: 'ECHO — Echo Dub' },
        { id: FX_DEST_TUBBY_SPRING,  label: 'SPRING — Tubby' },
        { id: FX_DEST_BLACK_ARK,     label: 'PHASER — Black Ark' },
        { id: FX_DEST_TAPE_DRIVE,    label: 'TAPE — Drive' },
        { id: FX_DEST_SHIMMER_DELAY, label: 'SHIM — Shimmer' },
        { id: FX_DEST_MUTE,          label: 'OFF — Mute' }
    ];

    auxNames.forEach((name, auxIdx) => {
        const row = el('div', { className: 'fx-matrix-row' });
        const chLabel = el('div', { className: 'fx-matrix-ch-label' });
        chLabel.appendChild(el('span', { className: 'fx-ch-badge', textContent: name }));
        row.appendChild(chLabel);

        const sendsWrap = el('div', { className: 'fx-matrix-sends' });

        [0, 1].forEach(sendIdx => {
            const sendCol = el('div', { className: 'fx-matrix-send-col' });
            sendCol.appendChild(el('span', {
                className: 'fx-send-tag',
                textContent: 'S' + (sendIdx + 1),
                title: 'Send ' + (sendIdx + 1)
            }));

            const currentDest = ctx.fxRouting[auxIdx][sendIdx];
            const select = el('select', {
                className: 'fx-route-select',
                'aria-label': `${name} Send ${sendIdx + 1} destination`
            });
            select.dataset.aux = String(auxIdx);
            select.dataset.send = String(sendIdx);
            select.dataset.dest = String(currentDest);

            destinations.forEach(dest => {
                const opt = el('option', {
                    value: String(dest.id),
                    textContent: dest.label
                });
                select.appendChild(opt);
            });
            select.value = String(currentDest);

            select.addEventListener('change', () => {
                const destId = parseInt(select.value, 10);
                ctx.fxRouting[auxIdx][sendIdx] = destId;
                select.dataset.dest = String(destId);
                sendBelaControl({
                    event: 'custom',
                    fxRoute: { aux: auxIdx, send: sendIdx, dest: destId }
                });
            });

            ctx.fxRouteSelects.push(select);
            sendCol.appendChild(select);

            const trigWrap = el('div', { className: 'fx-send-triggers' });

            const trigBtn = el('button', {
                type: 'button',
                className: 'fx-trig-btn' + (ctx.fxMomentaryTriggers[auxIdx][sendIdx] ? ' active' : ''),
                title: auxIdx === 4
                    ? `Hold to trigger Siren on Send ${sendIdx + 1}`
                    : `Hold to trigger ${name} Send ${sendIdx + 1}`,
                'aria-label': `Momentary ${name} Send ${sendIdx + 1}`,
                'aria-pressed': ctx.fxMomentaryTriggers[auxIdx][sendIdx] ? 'true' : 'false'
            });
            trigBtn.dataset.aux = String(auxIdx);
            trigBtn.dataset.send = String(sendIdx);
            trigBtn.appendChild(svgIcon(ICON_SEND, '0 0 24 24', 12));
            trigBtn.appendChild(el('span', { textContent: 'Send' }));

            trigBtn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                if (typeof trigBtn.setPointerCapture === 'function') {
                    try { trigBtn.setPointerCapture(e.pointerId); } catch (_) {}
                }
                setMomentaryFxTrigger(auxIdx, sendIdx, true);
            });
            const releaseMomentary = () => setMomentaryFxTrigger(auxIdx, sendIdx, false);
            trigBtn.addEventListener('pointerup', releaseMomentary);
            trigBtn.addEventListener('pointercancel', releaseMomentary);
            trigBtn.addEventListener('lostpointercapture', releaseMomentary);
            trigBtn.addEventListener('blur', releaseMomentary);

            trigBtn.addEventListener('keydown', (e) => {
                if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                    e.preventDefault();
                    setMomentaryFxTrigger(auxIdx, sendIdx, true);
                }
            });
            trigBtn.addEventListener('keyup', (e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    setMomentaryFxTrigger(auxIdx, sendIdx, false);
                }
            });

            const latchBtn = el('button', {
                type: 'button',
                className: 'fx-trig-btn fx-trig-latch' + (ctx.fxLatchedTriggers[auxIdx][sendIdx] ? ' active' : ''),
                textContent: 'On/Off',
                title: auxIdx === 4
                    ? `Toggle Siren on Send ${sendIdx + 1} (On/Off)`
                    : `Toggle ${name} Send ${sendIdx + 1} (On/Off)`,
                'aria-label': `Toggle ${name} Send ${sendIdx + 1}`,
                'aria-pressed': ctx.fxLatchedTriggers[auxIdx][sendIdx] ? 'true' : 'false'
            });
            latchBtn.dataset.aux = String(auxIdx);
            latchBtn.dataset.send = String(sendIdx);
            latchBtn.addEventListener('click', () => toggleLatchedFxTrigger(auxIdx, sendIdx));

            ctx.fxTriggerButtons.push(trigBtn);
            ctx.fxLatchButtons.push(latchBtn);
            trigWrap.appendChild(trigBtn);
            trigWrap.appendChild(latchBtn);
            sendCol.appendChild(trigWrap);
            sendsWrap.appendChild(sendCol);
        });

        row.appendChild(sendsWrap);
        table.appendChild(row);
    });

    card.appendChild(table);
    return card;
}

/** Creates a compact header with title and enable toggle switch. */
function buildFxCardHeader(title, enabled, onToggle) {
    const cardHdr = el('div', { className: 'fx-card-header' });
    cardHdr.appendChild(el('div', { className: 'fx-card-title', textContent: title }));

    const pwrWrap = el('label', { className: 'fx-toggle-wrap', title: `Enable ${title}` });
    const pwrCheck = el('input', {
        type: 'checkbox',
        checked: enabled,
        'aria-label': `Enable ${title}`
    });
    pwrCheck.addEventListener('change', () => onToggle(pwrCheck.checked));
    const track = el('span', { className: 'fx-toggle-track', 'aria-hidden': 'true' });
    track.appendChild(el('span', { className: 'fx-toggle-thumb' }));
    pwrWrap.appendChild(pwrCheck);
    pwrWrap.appendChild(track);
    cardHdr.appendChild(pwrWrap);
    return cardHdr;
}

function buildFxMeter(fillCls) {
    const track = el('div', { className: 'fx-meter-track' });
    const fill = el('div', { className: 'fx-meter-fill ' + fillCls });
    track.appendChild(fill);
    return { track, fill };
}

/** 1. TAPE DRIVE CARD */
function buildTapeDriveCard() {
    const ctx = getContext();
    const card = el('div', { className: 'fx-card' });
    card.appendChild(buildFxCardHeader('Tape Drive', ctx.tapeDrive.enabled, (en) => {
        ctx.tapeDrive.enabled = en;
        sendBelaControl({ event: 'custom', tapeDrive: { enabled: en } });
    }));

    const meter = buildFxMeter('tape-fill');
    card.appendChild(meter.track);
    ctx.fxTapeMeterEl = meter.fill;

    const controls = el('div', { className: 'fx-controls-list' });
    controls.appendChild(createFxSlider({
        label: 'Drive', unit: '%', min: 0, max: 100, step: 1,
        value: Math.round(ctx.tapeDrive.drive * 100),
        onChange: val => {
            const d = val / 100.0;
            ctx.tapeDrive.drive = d;
            sendBelaControl({ event: 'custom', tapeDrive: { drive: d } });
        }
    }));
    controls.appendChild(createFxSlider({
        label: 'Warmth', unit: ' Hz', min: 6000, max: 16000, step: 100,
        value: ctx.tapeDrive.warmth,
        onChange: val => {
            ctx.tapeDrive.warmth = val;
            sendBelaControl({ event: 'custom', tapeDrive: { warmth: val } });
        }
    }));
    controls.appendChild(createFxSlider({
        label: 'Asymmetry', unit: '%', min: 0, max: 100, step: 1,
        value: Math.round(ctx.tapeDrive.asymmetry * 100),
        onChange: val => {
            const a = val / 100.0;
            ctx.tapeDrive.asymmetry = a;
            sendBelaControl({ event: 'custom', tapeDrive: { asymmetry: a } });
        }
    }));
    controls.appendChild(createFxSlider({
        label: 'Return', unit: '%', min: 0, max: 150, step: 1,
        value: Math.round(ctx.tapeDrive.level * 100),
        onChange: val => {
            const l = val / 100.0;
            ctx.tapeDrive.level = l;
            sendBelaControl({ event: 'custom', tapeDrive: { level: l } });
        }
    }));
    card.appendChild(controls);
    return card;
}

/** 2. DUB DUCKER CARD */
function buildDubDuckerCard() {
    const ctx = getContext();
    const card = el('div', { className: 'fx-card' });
    card.appendChild(buildFxCardHeader('Ducker', ctx.dubDucker.enabled, (en) => {
        ctx.dubDucker.enabled = en;
        sendBelaControl({ event: 'custom', dubDucker: { enabled: en } });
    }));

    const meter = buildFxMeter('ducker-fill');
    card.appendChild(meter.track);
    ctx.fxDuckerMeterEl = meter.fill;

    const controls = el('div', { className: 'fx-controls-list' });

    const srcRow = el('div', { className: 'fx-preset-row' });
    const sources = [
        { id: 0, label: 'Siren' },
        { id: 1, label: 'Mic' },
        { id: 2, label: 'Master' },
        { id: 3, label: 'All' }
    ];
    sources.forEach(s => {
        const isAct = ctx.dubDucker.source === s.id;
        const btn = el('button', {
            type: 'button',
            className: 'fx-mini-btn' + (isAct ? ' active' : ''),
            textContent: s.label,
            'aria-pressed': isAct ? 'true' : 'false'
        });
        btn.addEventListener('click', () => {
            ctx.dubDucker.source = s.id;
            srcRow.querySelectorAll('.fx-mini-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
            sendBelaControl({ event: 'custom', dubDucker: { source: s.id } });
        });
        srcRow.appendChild(btn);
    });
    controls.appendChild(srcRow);

    controls.appendChild(createFxSlider({
        label: 'Threshold', unit: '%', min: 1, max: 50, step: 1,
        value: Math.round(ctx.dubDucker.threshold * 100),
        onChange: val => {
            const th = val / 100.0;
            ctx.dubDucker.threshold = th;
            sendBelaControl({ event: 'custom', dubDucker: { threshold: th } });
        }
    }));
    controls.appendChild(createFxSlider({
        label: 'Release', unit: ' ms', min: 50, max: 1500, step: 25,
        value: ctx.dubDucker.releaseMs,
        onChange: val => {
            ctx.dubDucker.releaseMs = val;
            sendBelaControl({ event: 'custom', dubDucker: { releaseMs: val } });
        }
    }));
    controls.appendChild(createFxSlider({
        label: 'Duck', unit: '%', min: 0, max: 100, step: 1,
        value: Math.round(ctx.dubDucker.duckAmount * 100),
        onChange: val => {
            const d = val / 100.0;
            ctx.dubDucker.duckAmount = d;
            sendBelaControl({ event: 'custom', dubDucker: { duckAmount: d } });
        }
    }));

    card.appendChild(controls);
    return card;
}

/** 3. SUB ROAR CARD */
function buildSubRoarCard() {
    const ctx = getContext();
    const card = el('div', { className: 'fx-card' });
    card.appendChild(buildFxCardHeader('Sub Roar', ctx.subRoar.enabled, (en) => {
        ctx.subRoar.enabled = en;
        sendBelaControl({ event: 'custom', subRoar: { enabled: en } });
    }));

    const meter = buildFxMeter('sub-fill');
    card.appendChild(meter.track);
    ctx.fxSubMeterEl = meter.fill;

    const controls = el('div', { className: 'fx-controls-list' });
    controls.appendChild(createFxSlider({
        label: 'Tune', unit: ' Hz', min: 30, max: 90, step: 1,
        value: ctx.subRoar.tune,
        onChange: val => {
            ctx.subRoar.tune = val;
            sendBelaControl({ event: 'custom', subRoar: { tune: val } });
        }
    }));
    controls.appendChild(createFxSlider({
        label: 'Drive', unit: '%', min: 0, max: 100, step: 1,
        value: Math.round(ctx.subRoar.drive * 100),
        onChange: val => {
            const d = val / 100.0;
            ctx.subRoar.drive = d;
            sendBelaControl({ event: 'custom', subRoar: { drive: d } });
        }
    }));
    controls.appendChild(createFxSlider({
        label: 'Decay', unit: ' ms', min: 100, max: 3000, step: 50,
        value: ctx.subRoar.decay,
        onChange: val => {
            ctx.subRoar.decay = val;
            sendBelaControl({ event: 'custom', subRoar: { decay: val } });
        }
    }));
    controls.appendChild(createFxSlider({
        label: 'Cutoff', unit: ' Hz', min: 40, max: 120, step: 1,
        value: ctx.subRoar.cutoff,
        onChange: val => {
            ctx.subRoar.cutoff = val;
            sendBelaControl({ event: 'custom', subRoar: { cutoff: val } });
        }
    }));
    controls.appendChild(createFxSlider({
        label: 'Return', unit: '%', min: 0, max: 150, step: 1,
        value: Math.round(ctx.subRoar.level * 100),
        onChange: val => {
            const l = val / 100.0;
            ctx.subRoar.level = l;
            sendBelaControl({ event: 'custom', subRoar: { level: l } });
        }
    }));
    card.appendChild(controls);
    return card;
}

/** 4. ECHO DUB CARD */
function buildEchoDubCard() {
    const ctx = getContext();
    const dub = ctx.echoDub || ctx.echuDub;
    const card = el('div', { className: 'fx-card' });
    card.appendChild(buildFxCardHeader('Echo Dub', dub.enabled, (en) => {
        dub.enabled = en;
        sendBelaControl({ event: 'custom', echoDub: { enabled: en }, echuDub: { enabled: en } });
    }));

    const meter = buildFxMeter('dub-fill');
    card.appendChild(meter.track);
    ctx.fxDubMeterEl = meter.fill;

    const controls = el('div', { className: 'fx-controls-list' });
    const timeCtrl = createFxSlider({
        label: 'Time', unit: ' ms', min: 40, max: 1500, step: 5,
        value: dub.time,
        onChange: val => {
            dub.time = val;
            sendBelaControl({ event: 'custom', echoDub: { time: val }, echuDub: { time: val } });
        }
    });
    const timeSliderRef = timeCtrl.querySelector('input[type=range]');
    const timeBadgeRef = timeCtrl.querySelector('.fx-slider-val');
    controls.appendChild(timeCtrl);

    const syncRow = el('div', { className: 'fx-preset-row' });
    [
        { label: '1/16', ms: 125 },
        { label: '1/8', ms: 250 },
        { label: '1/8d', ms: 375 },
        { label: '1/4', ms: 500 },
        { label: 'Dub', ms: 750 }
    ].forEach(preset => {
        const pBtn = el('button', {
            type: 'button',
            className: 'fx-mini-btn',
            textContent: preset.label,
            title: `${preset.ms} ms`
        });
        pBtn.addEventListener('click', () => {
            dub.time = preset.ms;
            if (timeSliderRef) timeSliderRef.value = preset.ms;
            if (timeBadgeRef) timeBadgeRef.textContent = preset.ms + ' ms';
            sendBelaControl({ event: 'custom', echoDub: { time: preset.ms }, echuDub: { time: preset.ms } });
        });
        syncRow.appendChild(pBtn);
    });
    controls.appendChild(syncRow);

    controls.appendChild(createFxSlider({
        label: 'Feedback', unit: '%', min: 0, max: 115, step: 1,
        value: Math.round(dub.feedback * 100), warnOver: 85,
        onChange: val => {
            const fb = val / 100.0;
            dub.feedback = fb;
            sendBelaControl({ event: 'custom', echoDub: { feedback: fb }, echuDub: { feedback: fb } });
        }
    }));
    controls.appendChild(createFxSlider({
        label: 'Tone', unit: ' Hz', min: 1000, max: 5000, step: 50,
        value: dub.tone,
        onChange: val => {
            dub.tone = val;
            sendBelaControl({ event: 'custom', echoDub: { tone: val }, echuDub: { tone: val } });
        }
    }));
    controls.appendChild(createFxSlider({
        label: 'Flutter', unit: '%', min: 0, max: 100, step: 1,
        value: Math.round(dub.flutter * 100),
        onChange: val => {
            const fl = val / 100.0;
            dub.flutter = fl;
            sendBelaControl({ event: 'custom', echoDub: { flutter: fl }, echuDub: { flutter: fl } });
        }
    }));
    controls.appendChild(createFxSlider({
        label: 'Return', unit: '%', min: 0, max: 100, step: 1,
        value: Math.round(dub.level * 100),
        onChange: val => {
            const l = val / 100.0;
            dub.level = l;
            sendBelaControl({ event: 'custom', echoDub: { level: l }, echuDub: { level: l } });
        }
    }));
    card.appendChild(controls);

    const actionBox = el('div', { className: 'fx-action-box dual-action' });
    const killBtn = el('button', {
        type: 'button',
        className: 'fx-big-btn btn-kill-send' + (dub.kill ? ' active' : ''),
        textContent: dub.kill ? 'Send Killed' : 'Kill Send',
        'aria-pressed': dub.kill ? 'true' : 'false'
    });
    killBtn.addEventListener('click', () => {
        dub.kill = !dub.kill;
        killBtn.classList.toggle('active', dub.kill);
        killBtn.setAttribute('aria-pressed', dub.kill ? 'true' : 'false');
        killBtn.textContent = dub.kill ? 'Send Killed' : 'Kill Send';
        sendBelaControl({ event: 'custom', echoDub: { kill: dub.kill }, echuDub: { kill: dub.kill } });
    });

    const clearBtn = el('button', {
        type: 'button',
        className: 'fx-big-btn btn-clear-delay',
        textContent: 'Clear'
    });
    clearBtn.addEventListener('click', () => {
        sendBelaControl({ event: 'custom', echoDubClear: true, echuDubClear: true });
        clearBtn.classList.add('flash');
        setTimeout(() => clearBtn.classList.remove('flash'), 240);
    });

    actionBox.appendChild(killBtn);
    actionBox.appendChild(clearBtn);
    card.appendChild(actionBox);
    return card;
}

/** 5. TUBBY SPRING CARD */
function buildTubbySpringCard() {
    const ctx = getContext();
    const card = el('div', { className: 'fx-card' });
    card.appendChild(buildFxCardHeader('Tubby Spring', ctx.tubbySpring.enabled, (en) => {
        ctx.tubbySpring.enabled = en;
        sendBelaControl({ event: 'custom', tubbySpring: { enabled: en } });
    }));

    const meter = buildFxMeter('spring-fill');
    card.appendChild(meter.track);
    ctx.fxSpringMeterEl = meter.fill;

    const controls = el('div', { className: 'fx-controls-list' });
    controls.appendChild(createFxSlider({
        label: 'Dwell', unit: '%', min: 0, max: 150, step: 1,
        value: Math.round(ctx.tubbySpring.dwell * 100),
        onChange: val => {
            const d = val / 100.0;
            ctx.tubbySpring.dwell = d;
            sendBelaControl({ event: 'custom', tubbySpring: { dwell: d } });
        }
    }));
    controls.appendChild(createFxSlider({
        label: 'Decay', unit: '%', min: 20, max: 95, step: 1,
        value: Math.round(ctx.tubbySpring.decay * 100),
        onChange: val => {
            const d = val / 100.0;
            ctx.tubbySpring.decay = d;
            sendBelaControl({ event: 'custom', tubbySpring: { decay: d } });
        }
    }));
    controls.appendChild(createFxSlider({
        label: 'Tone', unit: ' Hz', min: 1000, max: 5000, step: 50,
        value: ctx.tubbySpring.tone,
        onChange: val => {
            ctx.tubbySpring.tone = val;
            sendBelaControl({ event: 'custom', tubbySpring: { tone: val } });
        }
    }));
    controls.appendChild(createFxSlider({
        label: 'Return', unit: '%', min: 0, max: 100, step: 1,
        value: Math.round(ctx.tubbySpring.level * 100),
        onChange: val => {
            const l = val / 100.0;
            ctx.tubbySpring.level = l;
            sendBelaControl({ event: 'custom', tubbySpring: { level: l } });
        }
    }));
    card.appendChild(controls);

    const actionBox = el('div', { className: 'fx-action-box' });
    const splashBtn = el('button', {
        type: 'button',
        className: 'fx-big-btn btn-splash',
        textContent: 'Splash',
        title: 'Trigger mechanical spring impact'
    });
    splashBtn.addEventListener('click', () => {
        sendBelaControl({ event: 'custom', tubbySpringSplash: true });
        splashBtn.classList.add('flash');
        setTimeout(() => splashBtn.classList.remove('flash'), 240);
    });
    actionBox.appendChild(splashBtn);
    card.appendChild(actionBox);

    return card;
}

/** 6. SHIMMER DELAY CARD */
function buildShimmerDelayCard() {
    const ctx = getContext();
    const card = el('div', { className: 'fx-card' });
    card.appendChild(buildFxCardHeader('Shimmer Delay', ctx.shimmerDelay.enabled, (en) => {
        ctx.shimmerDelay.enabled = en;
        sendBelaControl({ event: 'custom', shimmerDelay: { enabled: en } });
    }));

    const meter = buildFxMeter('shimmer-fill');
    card.appendChild(meter.track);
    ctx.fxShimmerMeterEl = meter.fill;

    const controls = el('div', { className: 'fx-controls-list' });
    const semiCtrl = createFxSlider({
        label: 'Pitch', unit: ' st', min: -12, max: 12, step: 1,
        value: ctx.shimmerDelay.semitones,
        onChange: val => {
            ctx.shimmerDelay.semitones = val;
            sendBelaControl({ event: 'custom', shimmerDelay: { semitones: val } });
        }
    });
    const semiSliderRef = semiCtrl.querySelector('input[type=range]');
    const semiBadgeRef = semiCtrl.querySelector('.fx-slider-val');
    controls.appendChild(semiCtrl);

    const semiRow = el('div', { className: 'fx-preset-row' });
    [
        { label: '-12', st: -12 },
        { label: '-7', st: -7 },
        { label: '0', st: 0 },
        { label: '+7', st: 7 },
        { label: '+12', st: 12 }
    ].forEach(preset => {
        const pBtn = el('button', {
            type: 'button',
            className: 'fx-mini-btn',
            textContent: preset.label
        });
        pBtn.addEventListener('click', () => {
            ctx.shimmerDelay.semitones = preset.st;
            if (semiSliderRef) semiSliderRef.value = preset.st;
            if (semiBadgeRef) semiBadgeRef.textContent = (preset.st > 0 ? '+' : '') + preset.st + ' st';
            sendBelaControl({ event: 'custom', shimmerDelay: { semitones: preset.st } });
        });
        semiRow.appendChild(pBtn);
    });
    controls.appendChild(semiRow);

    controls.appendChild(createFxSlider({
        label: 'Time', unit: ' ms', min: 40, max: 1500, step: 5,
        value: ctx.shimmerDelay.delayTime,
        onChange: val => {
            ctx.shimmerDelay.delayTime = val;
            sendBelaControl({ event: 'custom', shimmerDelay: { delayTime: val } });
        }
    }));
    controls.appendChild(createFxSlider({
        label: 'Feedback', unit: '%', min: 0, max: 95, step: 1,
        value: Math.round(ctx.shimmerDelay.feedback * 100),
        onChange: val => {
            const fb = val / 100.0;
            ctx.shimmerDelay.feedback = fb;
            sendBelaControl({ event: 'custom', shimmerDelay: { feedback: fb } });
        }
    }));
    controls.appendChild(createFxSlider({
        label: 'Grain', unit: ' ms', min: 20, max: 100, step: 5,
        value: ctx.shimmerDelay.grainSize,
        onChange: val => {
            ctx.shimmerDelay.grainSize = val;
            sendBelaControl({ event: 'custom', shimmerDelay: { grainSize: val } });
        }
    }));
    controls.appendChild(createFxSlider({
        label: 'Return', unit: '%', min: 0, max: 150, step: 1,
        value: Math.round(ctx.shimmerDelay.level * 100),
        onChange: val => {
            const l = val / 100.0;
            ctx.shimmerDelay.level = l;
            sendBelaControl({ event: 'custom', shimmerDelay: { level: l } });
        }
    }));
    card.appendChild(controls);

    const actionBox = el('div', { className: 'fx-action-box' });
    const clearBtn = el('button', {
        type: 'button',
        className: 'fx-big-btn btn-clear-delay',
        textContent: 'Clear'
    });
    clearBtn.addEventListener('click', () => {
        sendBelaControl({ event: 'custom', shimmerClear: true });
        clearBtn.classList.add('flash');
        setTimeout(() => clearBtn.classList.remove('flash'), 240);
    });
    actionBox.appendChild(clearBtn);
    card.appendChild(actionBox);

    return card;
}

/** 7. BLACK ARK PHASER CARD */
function buildBlackArkPhaserCard() {
    const ctx = getContext();
    const card = el('div', { className: 'fx-card' });
    card.appendChild(buildFxCardHeader('Black Ark Phaser', ctx.blackArk.enabled, (en) => {
        ctx.blackArk.enabled = en;
        sendBelaControl({ event: 'custom', blackArk: { enabled: en } });
    }));

    const meter = buildFxMeter('phase-fill');
    card.appendChild(meter.track);
    ctx.fxPhaserMeterEl = meter.fill;

    const controls = el('div', { className: 'fx-controls-list' });
    const rateCtrl = createFxSlider({
        label: 'Rate', unit: ' Hz', min: 0.05, max: 5.0, step: 0.05,
        value: ctx.blackArk.rate,
        onChange: val => {
            ctx.blackArk.rate = val;
            sendBelaControl({ event: 'custom', blackArk: { rate: val } });
        }
    });
    const rateSliderRef = rateCtrl.querySelector('input[type=range]');
    const rateBadgeRef = rateCtrl.querySelector('.fx-slider-val');
    controls.appendChild(rateCtrl);

    const ratePresetRow = el('div', { className: 'fx-preset-row' });
    [
        { label: '0.1 Hz', hz: 0.1 },
        { label: '0.25 Hz', hz: 0.25 },
        { label: '0.8 Hz', hz: 0.8 },
        { label: '2.5 Hz', hz: 2.5 }
    ].forEach(preset => {
        const pBtn = el('button', {
            type: 'button',
            className: 'fx-mini-btn',
            textContent: preset.label
        });
        pBtn.addEventListener('click', () => {
            ctx.blackArk.rate = preset.hz;
            if (rateSliderRef) rateSliderRef.value = preset.hz;
            if (rateBadgeRef) rateBadgeRef.textContent = preset.hz + ' Hz';
            sendBelaControl({ event: 'custom', blackArk: { rate: preset.hz } });
        });
        ratePresetRow.appendChild(pBtn);
    });
    controls.appendChild(ratePresetRow);

    controls.appendChild(createFxSlider({
        label: 'Depth', unit: '%', min: 0, max: 100, step: 1,
        value: Math.round(ctx.blackArk.depth * 100),
        onChange: val => {
            const d = val / 100.0;
            ctx.blackArk.depth = d;
            sendBelaControl({ event: 'custom', blackArk: { depth: d } });
        }
    }));
    controls.appendChild(createFxSlider({
        label: 'Feedback', unit: '%', min: -90, max: 90, step: 1,
        value: Math.round(ctx.blackArk.feedback * 100),
        onChange: val => {
            const fb = val / 100.0;
            ctx.blackArk.feedback = fb;
            sendBelaControl({ event: 'custom', blackArk: { feedback: fb } });
        }
    }));
    controls.appendChild(createFxSlider({
        label: 'Return', unit: '%', min: 0, max: 100, step: 1,
        value: Math.round(ctx.blackArk.level * 100),
        onChange: val => {
            const l = val / 100.0;
            ctx.blackArk.level = l;
            sendBelaControl({ event: 'custom', blackArk: { level: l } });
        }
    }));
    card.appendChild(controls);

    const actionBox = el('div', { className: 'fx-action-box' });
    const is12 = ctx.blackArk.stages === 12;
    const stagesBtn = el('button', {
        type: 'button',
        className: 'fx-big-btn btn-stages' + (is12 ? ' active' : ''),
        textContent: is12 ? '12 Stages' : '6 Stages',
        'aria-pressed': is12 ? 'true' : 'false'
    });
    stagesBtn.addEventListener('click', () => {
        ctx.blackArk.stages = (ctx.blackArk.stages === 12) ? 6 : 12;
        const active12 = ctx.blackArk.stages === 12;
        stagesBtn.classList.toggle('active', active12);
        stagesBtn.setAttribute('aria-pressed', active12 ? 'true' : 'false');
        stagesBtn.textContent = active12 ? '12 Stages' : '6 Stages';
        sendBelaControl({ event: 'custom', blackArk: { stages: ctx.blackArk.stages } });
    });
    actionBox.appendChild(stagesBtn);
    card.appendChild(actionBox);

    return card;
}

/** Helper to create a labelled slider with a live numeric badge. */
function createFxSlider({ label, unit, min, max, step, value, warnOver, onChange }) {
    const wrap = el('div', { className: 'fx-slider-item' });
    const topRow = el('div', { className: 'fx-slider-top' });
    topRow.appendChild(el('span', { className: 'fx-slider-lbl', textContent: label }));

    const badge = el('span', { className: 'fx-slider-val', textContent: value + unit });
    if (warnOver != null && value >= warnOver) {
        badge.classList.add('warn');
    }
    topRow.appendChild(badge);
    wrap.appendChild(topRow);

    const slider = el('input', {
        type: 'range',
        className: 'fx-range-slider',
        min: min,
        max: max,
        step: step || 1,
        value: value,
        'aria-label': label
    });

    slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        badge.textContent = v + unit;
        if (warnOver != null) badge.classList.toggle('warn', v >= warnOver);
        onChange(v);
    });

    wrap.appendChild(slider);
    return wrap;
}

/** Real-time update called by p.draw() when Buffer 12 arrives from Bela. */
export function updateFxLive() {
    const ctx = getContext();
    if (!ctx.fxState || ctx.fxState.length < 17) return;

    autoMeter(ctx.fxSubMeterEl, ctx.fxState[0]);
    autoMeter(ctx.fxDubMeterEl, ctx.fxState[1]);
    autoMeter(ctx.fxSpringMeterEl, ctx.fxState[2]);
    autoMeter(ctx.fxPhaserMeterEl, ctx.fxState[3]);
    autoMeter(ctx.fxTapeMeterEl, ctx.fxState[4]);
    autoMeter(ctx.fxShimmerMeterEl, ctx.fxState[5]);

    if (ctx.fxDuckerMeterEl) {
        const pct = Math.min(100, Math.round((ctx.fxState[6] || 0) * 100));
        ctx.fxDuckerMeterEl.style.width = pct + '%';
    }

    if (ctx.fxRouteSelects && ctx.fxRouteSelects.length) {
        for (let aux = 0; aux < 5; ++aux) {
            for (let send = 0; send < 2; ++send) {
                ctx.fxRouting[aux][send] = Math.round(ctx.fxState[7 + aux * 2 + send]);
            }
        }
        ctx.fxRouteSelects.forEach(sel => {
            const aux = parseInt(sel.dataset.aux, 10);
            const send = parseInt(sel.dataset.send, 10);
            const destStr = String(ctx.fxRouting[aux][send]);
            if (sel.value !== destStr && document.activeElement !== sel) {
                sel.value = destStr;
                sel.dataset.dest = destStr;
            }
        });
    }
}

function autoMeter(elNode, peakVal) {
    if (!elNode) return;
    const pct = Math.min(100, Math.round((peakVal || 0) * 110));
    elNode.style.width = pct + '%';
}
