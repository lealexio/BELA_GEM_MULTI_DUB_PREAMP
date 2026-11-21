/**
 * Digital Multi-FX Engine UI pane (SUB ROAR, ECHU DUB, TUBBY SPRING, BLACK ARK).
 */
import { getContext } from '../context.js';
import {
    FX_DEST_HARDWARE,
    FX_DEST_SUB_ROAR,
    FX_DEST_ECHU_DUB,
    FX_DEST_TUBBY_SPRING,
    FX_DEST_BLACK_ARK,
    FX_DEST_MUTE
} from '../config.js';
import { el } from './utils.js';

function sendBelaControl(payload) {
    /* global Bela */
    if (typeof Bela !== 'undefined' && Bela.control && typeof Bela.control.send === 'function') {
        Bela.control.send(payload);
    }
}

/** Builds the full FX tab pane. */
export function buildFxPane() {
    const pane = el('div', { className: 'tab-pane', id: 'tab-fx' });
    const container = el('div', { className: 'fx-pane-container' });

    // Top Header Banner
    const hdr = el('div', { className: 'fx-header-banner' });
    const titleBox = el('div', { className: 'fx-title-box' });
    titleBox.appendChild(el('h2', { textContent: 'DIGITAL MULTI-FX ENGINE', className: 'fx-main-title' }));
    titleBox.appendChild(el('p', {
        textContent: 'Divert channel FX sends to internal real-time DSP effects (SUB ROAR, ECHU DUB, TUBBY SPRING, BLACK ARK)',
        className: 'fx-subtitle'
    }));
    hdr.appendChild(titleBox);
    container.appendChild(hdr);

    // 1. ROUTING MATRIX SECTION
    container.appendChild(buildRoutingMatrixCard());

    // 2. EFFECTS GRID (4 Modules)
    const fxGrid = el('div', { className: 'fx-modules-grid' });
    fxGrid.appendChild(buildSubRoarCard());
    fxGrid.appendChild(buildEchuDubCard());
    fxGrid.appendChild(buildTubbySpringCard());
    fxGrid.appendChild(buildBlackArkPhaserCard());
    container.appendChild(fxGrid);

    pane.appendChild(container);
    return pane;
}

/** Builds the channel FX send routing matrix card. */
function buildRoutingMatrixCard() {
    const card = el('div', { className: 'fx-card fx-card-routing' });
    const cardHdr = el('div', { className: 'fx-card-header' });
    cardHdr.appendChild(el('div', { className: 'fx-card-title', textContent: '🎛️ CHANNEL SENDS ROUTING MATRIX' }));
    cardHdr.appendChild(el('div', {
        className: 'fx-card-badge',
        textContent: 'Hardware Knobs → Internal DSP'
    }));
    card.appendChild(cardHdr);

    const desc = el('p', {
        className: 'fx-routing-desc',
        textContent: 'Choose destination for each channel\'s FX Send. Selecting an internal digital effect diverts the signal from physical Jack Out directly into the DSP engine.'
    });
    card.appendChild(desc);

    const table = el('div', { className: 'fx-matrix-table' });
    const ctx = getContext();
    ctx.fxRouteButtons = [];

    const auxNames = ['AUX 1', 'AUX 2', 'AUX 3', 'AUX 4'];
    const destinations = [
        { id: FX_DEST_HARDWARE,     label: 'HW OUT',  cls: 'dest-hw' },
        { id: FX_DEST_SUB_ROAR,     label: 'SUB',     cls: 'dest-sub' },
        { id: FX_DEST_ECHU_DUB,     label: 'ECHO',    cls: 'dest-dub' },
        { id: FX_DEST_TUBBY_SPRING, label: 'SPRING',  cls: 'dest-spring' },
        { id: FX_DEST_BLACK_ARK,    label: 'PHASER',  cls: 'dest-phase' },
        { id: FX_DEST_MUTE,         label: 'OFF',     cls: 'dest-mute' }
    ];

    auxNames.forEach((name, auxIdx) => {
        const row = el('div', { className: 'fx-matrix-row' });
        const chLabel = el('div', { className: 'fx-matrix-ch-label' });
        chLabel.appendChild(el('span', { className: 'fx-ch-badge', textContent: name }));
        row.appendChild(chLabel);

        // Send 1 (FX1)
        const send1Col = el('div', { className: 'fx-matrix-send-col' });
        send1Col.appendChild(el('span', { className: 'fx-send-title', textContent: 'FX 1 SEND (OUT0)' }));
        const grp1 = el('div', { className: 'fx-pill-group' });

        // Send 2 (FX2)
        const send2Col = el('div', { className: 'fx-matrix-send-col' });
        send2Col.appendChild(el('span', { className: 'fx-send-title', textContent: 'FX 2 SEND (OUT1)' }));
        const grp2 = el('div', { className: 'fx-pill-group' });

        [0, 1].forEach(sendIdx => {
            const grp = sendIdx === 0 ? grp1 : grp2;
            destinations.forEach(dest => {
                const btn = el('button', {
                    type: 'button',
                    className: `fx-pill-btn ${dest.cls}`,
                    textContent: dest.label
                });

                const isCurrent = ctx.fxRouting[auxIdx][sendIdx] === dest.id;
                if (isCurrent) btn.classList.add('active');

                btn.dataset.aux = auxIdx;
                btn.dataset.send = sendIdx;
                btn.dataset.dest = dest.id;

                btn.addEventListener('click', () => {
                    ctx.fxRouting[auxIdx][sendIdx] = dest.id;
                    grp.querySelectorAll('.fx-pill-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    sendBelaControl({
                        event: 'custom',
                        fxRoute: { aux: auxIdx, send: sendIdx, dest: dest.id }
                    });
                });

                grp.appendChild(btn);
                ctx.fxRouteButtons.push(btn);
            });
        });

        send1Col.appendChild(grp1);
        send2Col.appendChild(grp2);
        row.appendChild(send1Col);
        row.appendChild(send2Col);
        table.appendChild(row);
    });

    card.appendChild(table);
    return card;
}

/** Builds the SUB ROAR control module card. */
function buildSubRoarCard() {
    const ctx = getContext();
    const card = el('div', { className: 'fx-card fx-card-subroar' });

    // Header
    const cardHdr = el('div', { className: 'fx-card-header' });
    const titleGroup = el('div', { className: 'fx-card-title-group' });
    titleGroup.appendChild(el('div', { className: 'fx-card-title sub-title', textContent: '⚡ SUB ROAR' }));
    titleGroup.appendChild(el('div', { className: 'fx-card-desc', textContent: 'Sub-Harmonic Synthesizer & Roar Saturator (< 80 Hz)' }));
    cardHdr.appendChild(titleGroup);

    // Power toggle
    const pwrWrap = el('label', { className: 'fx-toggle-wrap' });
    const pwrCheck = el('input', { type: 'checkbox', checked: ctx.subRoar.enabled });
    pwrCheck.addEventListener('change', () => {
        ctx.subRoar.enabled = pwrCheck.checked;
        sendBelaControl({ event: 'custom', subRoar: { enabled: pwrCheck.checked } });
    });
    pwrWrap.appendChild(pwrCheck);
    pwrWrap.appendChild(el('span', { className: 'fx-toggle-label', textContent: 'ACTIVE' }));
    cardHdr.appendChild(pwrWrap);
    card.appendChild(cardHdr);

    // Sub Activity Meter
    const meterBox = el('div', { className: 'fx-meter-box' });
    meterBox.appendChild(el('span', { className: 'fx-meter-lbl', textContent: 'SUB ACTIVITY' }));
    const meterTrack = el('div', { className: 'fx-meter-track' });
    const meterFill = el('div', { className: 'fx-meter-fill sub-fill' });
    meterTrack.appendChild(meterFill);
    meterBox.appendChild(meterTrack);
    card.appendChild(meterBox);
    ctx.fxSubMeterEl = meterFill;

    // Sliders Container
    const controls = el('div', { className: 'fx-controls-list' });

    // 1. Tune (Hz)
    controls.appendChild(createFxSlider({
        label: 'TUNE FREQUENCY',
        unit: ' Hz',
        min: 30, max: 90, step: 1,
        value: ctx.subRoar.tune,
        onChange: val => {
            ctx.subRoar.tune = val;
            sendBelaControl({ event: 'custom', subRoar: { tune: val } });
        }
    }));

    // 2. Drive
    controls.appendChild(createFxSlider({
        label: 'ROAR DRIVE (Saturation)',
        unit: '%',
        min: 0, max: 100, step: 1,
        value: Math.round(ctx.subRoar.drive * 100),
        onChange: val => {
            const d = val / 100.0;
            ctx.subRoar.drive = d;
            sendBelaControl({ event: 'custom', subRoar: { drive: d } });
        }
    }));

    // 3. Decay (ms)
    controls.appendChild(createFxSlider({
        label: 'DROP DECAY TIME',
        unit: ' ms',
        min: 100, max: 3000, step: 50,
        value: ctx.subRoar.decay,
        onChange: val => {
            ctx.subRoar.decay = val;
            sendBelaControl({ event: 'custom', subRoar: { decay: val } });
        }
    }));

    // 4. Cutoff (Hz)
    controls.appendChild(createFxSlider({
        label: 'STEEP LPF CUTOFF (24 dB/oct)',
        unit: ' Hz',
        min: 40, max: 120, step: 1,
        value: ctx.subRoar.cutoff,
        onChange: val => {
            ctx.subRoar.cutoff = val;
            sendBelaControl({ event: 'custom', subRoar: { cutoff: val } });
        }
    }));

    // 5. Return Level
    controls.appendChild(createFxSlider({
        label: 'RETURN LEVEL',
        unit: '%',
        min: 0, max: 150, step: 1,
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

/** Builds the ECHU DUB control module card. */
function buildEchuDubCard() {
    const ctx = getContext();
    const card = el('div', { className: 'fx-card fx-card-echudub' });

    // Header
    const cardHdr = el('div', { className: 'fx-card-header' });
    const titleGroup = el('div', { className: 'fx-card-title-group' });
    titleGroup.appendChild(el('div', { className: 'fx-card-title dub-title', textContent: '📼 ECHU DUB' }));
    titleGroup.appendChild(el('div', { className: 'fx-card-desc', textContent: 'Space Tape Echo & Saturating Dub Delay' }));
    cardHdr.appendChild(titleGroup);

    // Power toggle
    const pwrWrap = el('label', { className: 'fx-toggle-wrap' });
    const pwrCheck = el('input', { type: 'checkbox', checked: ctx.echuDub.enabled });
    pwrCheck.addEventListener('change', () => {
        ctx.echuDub.enabled = pwrCheck.checked;
        sendBelaControl({ event: 'custom', echuDub: { enabled: pwrCheck.checked } });
    });
    pwrWrap.appendChild(pwrCheck);
    pwrWrap.appendChild(el('span', { className: 'fx-toggle-label', textContent: 'ACTIVE' }));
    cardHdr.appendChild(pwrWrap);
    card.appendChild(cardHdr);

    // Echo Activity Meter
    const meterBox = el('div', { className: 'fx-meter-box' });
    meterBox.appendChild(el('span', { className: 'fx-meter-lbl', textContent: 'ECHO ACTIVITY' }));
    const meterTrack = el('div', { className: 'fx-meter-track' });
    const meterFill = el('div', { className: 'fx-meter-fill dub-fill' });
    meterTrack.appendChild(meterFill);
    meterBox.appendChild(meterTrack);
    card.appendChild(meterBox);
    ctx.fxDubMeterEl = meterFill;

    // Sliders Container
    const controls = el('div', { className: 'fx-controls-list' });

    // 1. Time (ms)
    let timeSliderRef = null;
    let timeBadgeRef = null;
    const timeCtrl = createFxSlider({
        label: 'DELAY TIME',
        unit: ' ms',
        min: 40, max: 1500, step: 5,
        value: ctx.echuDub.time,
        onChange: val => {
            ctx.echuDub.time = val;
            sendBelaControl({ event: 'custom', echuDub: { time: val } });
        }
    });
    timeSliderRef = timeCtrl.querySelector('input[type=range]');
    timeBadgeRef = timeCtrl.querySelector('.fx-slider-val');
    controls.appendChild(timeCtrl);

    // Quick Rhythm Sync Buttons
    const syncRow = el('div', { className: 'fx-preset-row' });
    const syncPresets = [
        { label: '1/16 (125ms)', ms: 125 },
        { label: '1/8 (250ms)', ms: 250 },
        { label: '1/8d (375ms)', ms: 375 },
        { label: '1/4 (500ms)', ms: 500 },
        { label: 'Dub Long (750ms)', ms: 750 }
    ];
    syncPresets.forEach(preset => {
        const pBtn = el('button', {
            type: 'button',
            className: 'fx-mini-btn',
            textContent: preset.label
        });
        pBtn.addEventListener('click', () => {
            ctx.echuDub.time = preset.ms;
            if (timeSliderRef) timeSliderRef.value = preset.ms;
            if (timeBadgeRef) timeBadgeRef.textContent = preset.ms + ' ms';
            sendBelaControl({ event: 'custom', echuDub: { time: preset.ms } });
        });
        syncRow.appendChild(pBtn);
    });
    controls.appendChild(syncRow);

    // 2. Feedback (%)
    controls.appendChild(createFxSlider({
        label: 'FEEDBACK (>85% = Oscillation)',
        unit: '%',
        min: 0, max: 115, step: 1,
        value: Math.round(ctx.echuDub.feedback * 100),
        warnOver: 85,
        onChange: val => {
            const fb = val / 100.0;
            ctx.echuDub.feedback = fb;
            sendBelaControl({ event: 'custom', echuDub: { feedback: fb } });
        }
    }));

    // 3. Tone / Tape Damping (Hz)
    controls.appendChild(createFxSlider({
        label: 'TAPE TONE (High-Cut)',
        unit: ' Hz',
        min: 1000, max: 5000, step: 50,
        value: ctx.echuDub.tone,
        onChange: val => {
            ctx.echuDub.tone = val;
            sendBelaControl({ event: 'custom', echuDub: { tone: val } });
        }
    }));

    // 4. Flutter / Wow (%)
    controls.appendChild(createFxSlider({
        label: 'TAPE FLUTTER & WOW',
        unit: '%',
        min: 0, max: 100, step: 1,
        value: Math.round(ctx.echuDub.flutter * 100),
        onChange: val => {
            const fl = val / 100.0;
            ctx.echuDub.flutter = fl;
            sendBelaControl({ event: 'custom', echuDub: { flutter: fl } });
        }
    }));

    // 5. Return Level
    controls.appendChild(createFxSlider({
        label: 'RETURN LEVEL',
        unit: '%',
        min: 0, max: 100, step: 1,
        value: Math.round(ctx.echuDub.level * 100),
        onChange: val => {
            const l = val / 100.0;
            ctx.echuDub.level = l;
            sendBelaControl({ event: 'custom', echuDub: { level: l } });
        }
    }));

    card.appendChild(controls);

    // DUB ACTION BUTTONS (KILL SEND & CLEAR)
    const actionBox = el('div', { className: 'fx-action-box dual-action' });

    // Kill Send Toggle Button
    const killBtn = el('button', {
        type: 'button',
        className: 'fx-big-btn btn-kill-send' + (ctx.echuDub.kill ? ' active' : ''),
        textContent: ctx.echuDub.kill ? '⚡ SEND KILLED (Echo Looping)' : '✂️ KILL SEND (Cut Input)'
    });
    killBtn.addEventListener('click', () => {
        ctx.echuDub.kill = !ctx.echuDub.kill;
        killBtn.classList.toggle('active', ctx.echuDub.kill);
        killBtn.textContent = ctx.echuDub.kill ? '⚡ SEND KILLED (Echo Looping)' : '✂️ KILL SEND (Cut Input)';
        sendBelaControl({ event: 'custom', echuDub: { kill: ctx.echuDub.kill } });
    });

    // Clear / Flush Button
    const clearBtn = el('button', {
        type: 'button',
        className: 'fx-big-btn btn-clear-delay',
        textContent: '🧹 CLEAR ECHO'
    });
    clearBtn.addEventListener('click', () => {
        sendBelaControl({ event: 'custom', echuDubClear: true });
        clearBtn.classList.add('flash');
        setTimeout(() => clearBtn.classList.remove('flash'), 300);
    });

    actionBox.appendChild(killBtn);
    actionBox.appendChild(clearBtn);
    card.appendChild(actionBox);

    return card;
}

/** Builds the TUBBY SPRING control module card. */
function buildTubbySpringCard() {
    const ctx = getContext();
    const card = el('div', { className: 'fx-card fx-card-tubbyspring' });

    // Header
    const cardHdr = el('div', { className: 'fx-card-header' });
    const titleGroup = el('div', { className: 'fx-card-title-group' });
    titleGroup.appendChild(el('div', { className: 'fx-card-title spring-title', textContent: '🌊 TUBBY SPRING' }));
    titleGroup.appendChild(el('div', { className: 'fx-card-desc', textContent: 'King Tubby Space Reverb & Mechanical Spring Tank' }));
    cardHdr.appendChild(titleGroup);

    // Power toggle
    const pwrWrap = el('label', { className: 'fx-toggle-wrap' });
    const pwrCheck = el('input', { type: 'checkbox', checked: ctx.tubbySpring.enabled });
    pwrCheck.addEventListener('change', () => {
        ctx.tubbySpring.enabled = pwrCheck.checked;
        sendBelaControl({ event: 'custom', tubbySpring: { enabled: pwrCheck.checked } });
    });
    pwrWrap.appendChild(pwrCheck);
    pwrWrap.appendChild(el('span', { className: 'fx-toggle-label', textContent: 'ACTIVE' }));
    cardHdr.appendChild(pwrWrap);
    card.appendChild(cardHdr);

    // Spring Activity Meter
    const meterBox = el('div', { className: 'fx-meter-box' });
    meterBox.appendChild(el('span', { className: 'fx-meter-lbl', textContent: 'SPRING ACTIVITY' }));
    const meterTrack = el('div', { className: 'fx-meter-track' });
    const meterFill = el('div', { className: 'fx-meter-fill spring-fill' });
    meterTrack.appendChild(meterFill);
    meterBox.appendChild(meterTrack);
    card.appendChild(meterBox);
    ctx.fxSpringMeterEl = meterFill;

    // Sliders Container
    const controls = el('div', { className: 'fx-controls-list' });

    // 1. Dwell (Drive)
    controls.appendChild(createFxSlider({
        label: 'DWELL (Input Drive & Saturation)',
        unit: '%',
        min: 0, max: 150, step: 1,
        value: Math.round(ctx.tubbySpring.dwell * 100),
        onChange: val => {
            const d = val / 100.0;
            ctx.tubbySpring.dwell = d;
            sendBelaControl({ event: 'custom', tubbySpring: { dwell: d } });
        }
    }));

    // 2. Decay (Tension)
    controls.appendChild(createFxSlider({
        label: 'SPRING DECAY / TENSION',
        unit: '%',
        min: 20, max: 95, step: 1,
        value: Math.round(ctx.tubbySpring.decay * 100),
        onChange: val => {
            const d = val / 100.0;
            ctx.tubbySpring.decay = d;
            sendBelaControl({ event: 'custom', tubbySpring: { decay: d } });
        }
    }));

    // 3. Tone
    controls.appendChild(createFxSlider({
        label: 'SPRING TONE (High Damping)',
        unit: ' Hz',
        min: 1000, max: 5000, step: 50,
        value: ctx.tubbySpring.tone,
        onChange: val => {
            ctx.tubbySpring.tone = val;
            sendBelaControl({ event: 'custom', tubbySpring: { tone: val } });
        }
    }));

    // 4. Return Level
    controls.appendChild(createFxSlider({
        label: 'RETURN LEVEL',
        unit: '%',
        min: 0, max: 100, step: 1,
        value: Math.round(ctx.tubbySpring.level * 100),
        onChange: val => {
            const l = val / 100.0;
            ctx.tubbySpring.level = l;
            sendBelaControl({ event: 'custom', tubbySpring: { level: l } });
        }
    }));

    card.appendChild(controls);

    // SIGNATURE SPRING SPLASH BUTTON (VIRTUAL TANK HIT)
    const actionBox = el('div', { className: 'fx-action-box' });
    const splashBtn = el('button', {
        type: 'button',
        className: 'fx-big-btn btn-spring-splash',
        textContent: '💥 SPRING SPLASH (Kick Tank)'
    });
    splashBtn.addEventListener('click', () => {
        sendBelaControl({ event: 'custom', tubbySpringSplash: true });
        splashBtn.classList.add('splash-active');
        setTimeout(() => splashBtn.classList.remove('splash-active'), 250);
    });
    actionBox.appendChild(splashBtn);
    card.appendChild(actionBox);

    return card;
}

/** Builds the BLACK ARK PHASER control module card. */
function buildBlackArkPhaserCard() {
    const ctx = getContext();
    const card = el('div', { className: 'fx-card fx-card-blackark' });

    // Header
    const cardHdr = el('div', { className: 'fx-card-header' });
    const titleGroup = el('div', { className: 'fx-card-title-group' });
    titleGroup.appendChild(el('div', { className: 'fx-card-title phase-title', textContent: '🌀 BLACK ARK PHASER' }));
    titleGroup.appendChild(el('div', { className: 'fx-card-desc', textContent: 'Lee Scratch Perry Mu-Tron Style Bi-Phase & Deep Dub Swirl' }));
    cardHdr.appendChild(titleGroup);

    // Power toggle
    const pwrWrap = el('label', { className: 'fx-toggle-wrap' });
    const pwrCheck = el('input', { type: 'checkbox', checked: ctx.blackArk.enabled });
    pwrCheck.addEventListener('change', () => {
        ctx.blackArk.enabled = pwrCheck.checked;
        sendBelaControl({ event: 'custom', blackArk: { enabled: pwrCheck.checked } });
    });
    pwrWrap.appendChild(pwrCheck);
    pwrWrap.appendChild(el('span', { className: 'fx-toggle-label', textContent: 'ACTIVE' }));
    cardHdr.appendChild(pwrWrap);
    card.appendChild(cardHdr);

    // Phaser Activity Meter
    const meterBox = el('div', { className: 'fx-meter-box' });
    meterBox.appendChild(el('span', { className: 'fx-meter-lbl', textContent: 'PHASER ACTIVITY' }));
    const meterTrack = el('div', { className: 'fx-meter-track' });
    const meterFill = el('div', { className: 'fx-meter-fill phase-fill' });
    meterTrack.appendChild(meterFill);
    meterBox.appendChild(meterTrack);
    card.appendChild(meterBox);
    ctx.fxPhaserMeterEl = meterFill;

    // Sliders Container
    const controls = el('div', { className: 'fx-controls-list' });

    // 1. Sweep Rate
    let rateSliderRef = null;
    let rateBadgeRef = null;
    const rateCtrl = createFxSlider({
        label: 'SWEEP RATE',
        unit: ' Hz',
        min: 0.05, max: 5.0, step: 0.05,
        value: ctx.blackArk.rate,
        onChange: val => {
            ctx.blackArk.rate = val;
            sendBelaControl({ event: 'custom', blackArk: { rate: val } });
        }
    });
    rateSliderRef = rateCtrl.querySelector('input[type=range]');
    rateBadgeRef = rateCtrl.querySelector('.fx-slider-val');
    controls.appendChild(rateCtrl);

    // Rate Presets
    const ratePresetRow = el('div', { className: 'fx-preset-row' });
    const ratePresets = [
        { label: 'Roots (0.1Hz)', hz: 0.1 },
        { label: 'Meditative (0.25Hz)', hz: 0.25 },
        { label: 'Skank (0.8Hz)', hz: 0.8 },
        { label: 'Fast Swirl (2.5Hz)', hz: 2.5 }
    ];
    ratePresets.forEach(preset => {
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

    // 2. Depth (%)
    controls.appendChild(createFxSlider({
        label: 'SWEEP DEPTH',
        unit: '%',
        min: 0, max: 100, step: 1,
        value: Math.round(ctx.blackArk.depth * 100),
        onChange: val => {
            const d = val / 100.0;
            ctx.blackArk.depth = d;
            sendBelaControl({ event: 'custom', blackArk: { depth: d } });
        }
    }));

    // 3. Feedback Resonance (%)
    controls.appendChild(createFxSlider({
        label: 'FEEDBACK RESONANCE (±90%)',
        unit: '%',
        min: -90, max: 90, step: 1,
        value: Math.round(ctx.blackArk.feedback * 100),
        onChange: val => {
            const fb = val / 100.0;
            ctx.blackArk.feedback = fb;
            sendBelaControl({ event: 'custom', blackArk: { feedback: fb } });
        }
    }));

    // 4. Return Level
    controls.appendChild(createFxSlider({
        label: 'RETURN LEVEL',
        unit: '%',
        min: 0, max: 100, step: 1,
        value: Math.round(ctx.blackArk.level * 100),
        onChange: val => {
            const l = val / 100.0;
            ctx.blackArk.level = l;
            sendBelaControl({ event: 'custom', blackArk: { level: l } });
        }
    }));

    card.appendChild(controls);

    // STAGES TOGGLE (6 POLES VINTAGE vs 12 POLES COSMIC)
    const actionBox = el('div', { className: 'fx-action-box' });
    const stagesBtn = el('button', {
        type: 'button',
        className: 'fx-big-btn btn-stages' + (ctx.blackArk.stages === 12 ? ' active' : ''),
        textContent: ctx.blackArk.stages === 12 ? '✨ 12-STAGE PHASER (Deep Cosmic Sweep)' : '📻 6-STAGE PHASER (Vintage Swirl)'
    });
    stagesBtn.addEventListener('click', () => {
        ctx.blackArk.stages = (ctx.blackArk.stages === 12) ? 6 : 12;
        stagesBtn.classList.toggle('active', ctx.blackArk.stages === 12);
        stagesBtn.textContent = ctx.blackArk.stages === 12 ? '✨ 12-STAGE PHASER (Deep Cosmic Sweep)' : '📻 6-STAGE PHASER (Vintage Swirl)';
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
        value: value
    });

    slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        badge.textContent = v + unit;
        if (warnOver != null) {
            badge.classList.toggle('warn', v >= warnOver);
        }
        onChange(v);
    });

    wrap.appendChild(slider);
    return wrap;
}

/**
 * Real-time update called by p.draw() when Buffer 12 arrives from Bela.
 * Synchronises visual meters and routing indicators.
 */
export function updateFxLive() {
    const ctx = getContext();
    if (!ctx.fxState || ctx.fxState.length < 12) return;

    // Buffer 12: [0..3] peaks (sub, echu, spring, phaser), [4..11] aux routing
    const subPeak    = ctx.fxState[0];
    const echuPeak   = ctx.fxState[1];
    const springPeak = ctx.fxState[2];
    const phaserPeak = ctx.fxState[3];

    if (ctx.fxSubMeterEl) {
        const pct = Math.min(100, Math.round(subPeak * 110));
        ctx.fxSubMeterEl.style.width = pct + '%';
        if (pct > 80) ctx.fxSubMeterEl.style.boxShadow = '0 0 10px #ffb300';
        else ctx.fxSubMeterEl.style.boxShadow = 'none';
    }

    if (ctx.fxDubMeterEl) {
        const pct = Math.min(100, Math.round(echuPeak * 110));
        ctx.fxDubMeterEl.style.width = pct + '%';
        if (pct > 80) ctx.fxDubMeterEl.style.boxShadow = '0 0 10px #00e5ff';
        else ctx.fxDubMeterEl.style.boxShadow = 'none';
    }

    if (ctx.fxSpringMeterEl) {
        const pct = Math.min(100, Math.round(springPeak * 110));
        ctx.fxSpringMeterEl.style.width = pct + '%';
        if (pct > 80) ctx.fxSpringMeterEl.style.boxShadow = '0 0 10px #f59e0b';
        else ctx.fxSpringMeterEl.style.boxShadow = 'none';
    }

    if (ctx.fxPhaserMeterEl) {
        const pct = Math.min(100, Math.round(phaserPeak * 110));
        ctx.fxPhaserMeterEl.style.width = pct + '%';
        if (pct > 80) ctx.fxPhaserMeterEl.style.boxShadow = '0 0 10px #a855f7';
        else ctx.fxPhaserMeterEl.style.boxShadow = 'none';
    }

    // Sync routing pills with hardware state
    if (ctx.fxRouteButtons && ctx.fxRouteButtons.length) {
        for (let aux = 0; aux < 4; ++aux) {
            for (let send = 0; send < 2; ++send) {
                const sDest = Math.round(ctx.fxState[4 + aux * 2 + send]);
                ctx.fxRouting[aux][send] = sDest;
            }
        }
        ctx.fxRouteButtons.forEach(btn => {
            const aux = parseInt(btn.dataset.aux, 10);
            const send = parseInt(btn.dataset.send, 10);
            const dest = parseInt(btn.dataset.dest, 10);
            btn.classList.toggle('active', ctx.fxRouting[aux][send] === dest);
        });
    }
}
