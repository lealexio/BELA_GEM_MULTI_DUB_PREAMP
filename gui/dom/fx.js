/**
 * Digital Multi-FX Engine UI pane (SUB ROAR, ECHO DUB, TUBBY SPRING, BLACK ARK,
 * TAPE DRIVE, SHIMMER DELAY, DUCKER).
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
        textContent: 'Divert channel FX sends to internal real-time DSP effects (Echo, Spring, Saturation, Shimmer, Ducker)',
        className: 'fx-subtitle'
    }));
    hdr.appendChild(titleBox);
    container.appendChild(hdr);

    // 1. ROUTING MATRIX SECTION
    container.appendChild(buildRoutingMatrixCard());

    // 2. EFFECTS GRID
    const fxGrid = el('div', { className: 'fx-modules-grid' });
    // Analog Coloration & Dynamics
    fxGrid.appendChild(buildTapeDriveCard());
    fxGrid.appendChild(buildDubDuckerCard());
    fxGrid.appendChild(buildSubRoarCard());

    // Delays & Space Reverb
    fxGrid.appendChild(buildEchoDubCard());
    fxGrid.appendChild(buildTubbySpringCard());
    fxGrid.appendChild(buildShimmerDelayCard());

    // Modulation & Psychedelic Dub
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

    const auxNames = ['AUX 1', 'AUX 2', 'AUX 3', 'AUX 4', '🚨 SIREN'];
    const destinations = [
        { id: FX_DEST_HARDWARE,      label: 'HW',     cls: 'dest-hw' },
        { id: FX_DEST_SUB_ROAR,      label: 'SUB',    cls: 'dest-sub' },
        { id: FX_DEST_ECHO_DUB,      label: 'ECHO',   cls: 'dest-dub' },
        { id: FX_DEST_TUBBY_SPRING,  label: 'SPRING', cls: 'dest-spring' },
        { id: FX_DEST_BLACK_ARK,     label: 'PHASER', cls: 'dest-phase' },
        { id: FX_DEST_TAPE_DRIVE,    label: 'TAPE',   cls: 'dest-tape' },
        { id: FX_DEST_SHIMMER_DELAY, label: 'SHIM',   cls: 'dest-shimmer' },
        { id: FX_DEST_MUTE,          label: 'OFF',    cls: 'dest-mute' }
    ];

    auxNames.forEach((name, auxIdx) => {
        const row = el('div', { className: 'fx-matrix-row' });
        const chLabel = el('div', { className: 'fx-matrix-ch-label' });
        chLabel.appendChild(el('span', { className: 'fx-ch-badge', textContent: name }));
        row.appendChild(chLabel);

        // Send 1 (FX1)
        const send1Col = el('div', { className: 'fx-matrix-send-col' });
        send1Col.appendChild(el('span', {
            className: 'fx-send-title',
            textContent: auxIdx === 4 ? 'SIREN SEND 1' : 'FX 1 SEND (OUT0)'
        }));
        const grp1 = el('div', { className: 'fx-pill-group' });

        // Send 2 (FX2)
        const send2Col = el('div', { className: 'fx-matrix-send-col' });
        send2Col.appendChild(el('span', {
            className: 'fx-send-title',
            textContent: auxIdx === 4 ? 'SIREN SEND 2' : 'FX 2 SEND (OUT1)'
        }));
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

/** 1. TAPE DRIVE CARD */
function buildTapeDriveCard() {
    const ctx = getContext();
    const card = el('div', { className: 'fx-card fx-card-tapedrive' });

    const cardHdr = el('div', { className: 'fx-card-header' });
    const titleGroup = el('div', { className: 'fx-card-title-group' });
    titleGroup.appendChild(el('div', { className: 'fx-card-title tape-title', textContent: '📼 TAPE SATURATION & DRIVE' }));
    titleGroup.appendChild(el('div', { className: 'fx-card-desc', textContent: 'Analog Desk Coloration, Even Harmonics & Warm Bandwidth' }));
    cardHdr.appendChild(titleGroup);

    const pwrWrap = el('label', { className: 'fx-toggle-wrap' });
    const pwrCheck = el('input', { type: 'checkbox', checked: ctx.tapeDrive.enabled });
    pwrCheck.addEventListener('change', () => {
        ctx.tapeDrive.enabled = pwrCheck.checked;
        sendBelaControl({ event: 'custom', tapeDrive: { enabled: pwrCheck.checked } });
    });
    pwrWrap.appendChild(pwrCheck);
    pwrWrap.appendChild(el('span', { className: 'fx-toggle-label', textContent: 'ACTIVE' }));
    cardHdr.appendChild(pwrWrap);
    card.appendChild(cardHdr);

    const meterBox = el('div', { className: 'fx-meter-box' });
    meterBox.appendChild(el('span', { className: 'fx-meter-lbl', textContent: 'TAPE DRIVE LEVEL' }));
    const meterTrack = el('div', { className: 'fx-meter-track' });
    const meterFill = el('div', { className: 'fx-meter-fill tape-fill' });
    meterTrack.appendChild(meterFill);
    meterBox.appendChild(meterTrack);
    card.appendChild(meterBox);
    ctx.fxTapeMeterEl = meterFill;

    const controls = el('div', { className: 'fx-controls-list' });

    controls.appendChild(createFxSlider({
        label: 'DRIVE (Saturation)',
        unit: '%',
        min: 0, max: 100, step: 1,
        value: Math.round(ctx.tapeDrive.drive * 100),
        onChange: val => {
            const d = val / 100.0;
            ctx.tapeDrive.drive = d;
            sendBelaControl({ event: 'custom', tapeDrive: { drive: d } });
        }
    }));

    controls.appendChild(createFxSlider({
        label: 'TAPE WARMTH (High-Cut LPF)',
        unit: ' Hz',
        min: 6000, max: 16000, step: 100,
        value: ctx.tapeDrive.warmth,
        onChange: val => {
            ctx.tapeDrive.warmth = val;
            sendBelaControl({ event: 'custom', tapeDrive: { warmth: val } });
        }
    }));

    controls.appendChild(createFxSlider({
        label: 'ASYMMETRY (Even Harmonics)',
        unit: '%',
        min: 0, max: 100, step: 1,
        value: Math.round(ctx.tapeDrive.asymmetry * 100),
        onChange: val => {
            const a = val / 100.0;
            ctx.tapeDrive.asymmetry = a;
            sendBelaControl({ event: 'custom', tapeDrive: { asymmetry: a } });
        }
    }));

    controls.appendChild(createFxSlider({
        label: 'RETURN LEVEL',
        unit: '%',
        min: 0, max: 150, step: 1,
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

/** 2. DUB DUCKER CARD (SIDECHAIN) */
function buildDubDuckerCard() {
    const ctx = getContext();
    const card = el('div', { className: 'fx-card fx-card-ducker' });

    const cardHdr = el('div', { className: 'fx-card-header' });
    const titleGroup = el('div', { className: 'fx-card-title-group' });
    titleGroup.appendChild(el('div', { className: 'fx-card-title ducker-title', textContent: '🦆 DUCKING SIDECHAIN' }));
    titleGroup.appendChild(el('div', { className: 'fx-card-desc', textContent: 'Automatic Echo & Reverb Attenuation for MC Vocals & Siren' }));
    cardHdr.appendChild(titleGroup);

    const pwrWrap = el('label', { className: 'fx-toggle-wrap' });
    const pwrCheck = el('input', { type: 'checkbox', checked: ctx.dubDucker.enabled });
    pwrCheck.addEventListener('change', () => {
        ctx.dubDucker.enabled = pwrCheck.checked;
        sendBelaControl({ event: 'custom', dubDucker: { enabled: pwrCheck.checked } });
    });
    pwrWrap.appendChild(pwrCheck);
    pwrWrap.appendChild(el('span', { className: 'fx-toggle-label', textContent: 'ACTIVE' }));
    cardHdr.appendChild(pwrWrap);
    card.appendChild(cardHdr);

    const meterBox = el('div', { className: 'fx-meter-box' });
    meterBox.appendChild(el('span', { className: 'fx-meter-lbl', textContent: 'GAIN REDUCTION (COMPRESSION)' }));
    const meterTrack = el('div', { className: 'fx-meter-track ducker-track' });
    const meterFill = el('div', { className: 'fx-meter-fill ducker-fill' });
    meterTrack.appendChild(meterFill);
    meterBox.appendChild(meterTrack);
    card.appendChild(meterBox);
    ctx.fxDuckerMeterEl = meterFill;

    const controls = el('div', { className: 'fx-controls-list' });

    // Source Selector
    const srcRow = el('div', { className: 'fx-preset-row' });
    const sources = [
        { id: 0, label: '🚨 Siren & Sampler' },
        { id: 1, label: '🎤 Mic Inputs' },
        { id: 2, label: '🎚️ Master Bus' },
        { id: 3, label: '🌐 All Key Sources' }
    ];
    sources.forEach(s => {
        const btn = el('button', {
            type: 'button',
            className: 'fx-mini-btn' + (ctx.dubDucker.source === s.id ? ' active' : ''),
            textContent: s.label
        });
        btn.addEventListener('click', () => {
            ctx.dubDucker.source = s.id;
            srcRow.querySelectorAll('.fx-mini-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            sendBelaControl({ event: 'custom', dubDucker: { source: s.id } });
        });
        srcRow.appendChild(btn);
    });
    controls.appendChild(srcRow);

    controls.appendChild(createFxSlider({
        label: 'THRESHOLD',
        unit: '%',
        min: 1, max: 50, step: 1,
        value: Math.round(ctx.dubDucker.threshold * 100),
        onChange: val => {
            const th = val / 100.0;
            ctx.dubDucker.threshold = th;
            sendBelaControl({ event: 'custom', dubDucker: { threshold: th } });
        }
    }));

    controls.appendChild(createFxSlider({
        label: 'RELEASE TIME',
        unit: ' ms',
        min: 50, max: 1500, step: 25,
        value: ctx.dubDucker.releaseMs,
        onChange: val => {
            ctx.dubDucker.releaseMs = val;
            sendBelaControl({ event: 'custom', dubDucker: { releaseMs: val } });
        }
    }));

    controls.appendChild(createFxSlider({
        label: 'DUCK AMOUNT (Attenuation)',
        unit: '%',
        min: 0, max: 100, step: 1,
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
    const card = el('div', { className: 'fx-card fx-card-subroar' });

    const cardHdr = el('div', { className: 'fx-card-header' });
    const titleGroup = el('div', { className: 'fx-card-title-group' });
    titleGroup.appendChild(el('div', { className: 'fx-card-title sub-title', textContent: '⚡ SUB ROAR' }));
    titleGroup.appendChild(el('div', { className: 'fx-card-desc', textContent: 'Sub-Harmonic Synthesizer & Roar Saturator (< 80 Hz)' }));
    cardHdr.appendChild(titleGroup);

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

    const meterBox = el('div', { className: 'fx-meter-box' });
    meterBox.appendChild(el('span', { className: 'fx-meter-lbl', textContent: 'SUB ACTIVITY' }));
    const meterTrack = el('div', { className: 'fx-meter-track' });
    const meterFill = el('div', { className: 'fx-meter-fill sub-fill' });
    meterTrack.appendChild(meterFill);
    meterBox.appendChild(meterTrack);
    card.appendChild(meterBox);
    ctx.fxSubMeterEl = meterFill;

    const controls = el('div', { className: 'fx-controls-list' });

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

/** 4. ECHO DUB CARD */
function buildEchoDubCard() {
    const ctx = getContext();
    const dub = ctx.echoDub || ctx.echuDub;
    const card = el('div', { className: 'fx-card fx-card-echodub' });

    const cardHdr = el('div', { className: 'fx-card-header' });
    const titleGroup = el('div', { className: 'fx-card-title-group' });
    titleGroup.appendChild(el('div', { className: 'fx-card-title dub-title', textContent: '📼 ECHO DUB' }));
    titleGroup.appendChild(el('div', { className: 'fx-card-desc', textContent: 'Space Tape Echo & Saturating Dub Delay' }));
    cardHdr.appendChild(titleGroup);

    const pwrWrap = el('label', { className: 'fx-toggle-wrap' });
    const pwrCheck = el('input', { type: 'checkbox', checked: dub.enabled });
    pwrCheck.addEventListener('change', () => {
        dub.enabled = pwrCheck.checked;
        sendBelaControl({ event: 'custom', echoDub: { enabled: pwrCheck.checked }, echuDub: { enabled: pwrCheck.checked } });
    });
    pwrWrap.appendChild(pwrCheck);
    pwrWrap.appendChild(el('span', { className: 'fx-toggle-label', textContent: 'ACTIVE' }));
    cardHdr.appendChild(pwrWrap);
    card.appendChild(cardHdr);

    const meterBox = el('div', { className: 'fx-meter-box' });
    meterBox.appendChild(el('span', { className: 'fx-meter-lbl', textContent: 'ECHO ACTIVITY' }));
    const meterTrack = el('div', { className: 'fx-meter-track' });
    const meterFill = el('div', { className: 'fx-meter-fill dub-fill' });
    meterTrack.appendChild(meterFill);
    meterBox.appendChild(meterTrack);
    card.appendChild(meterBox);
    ctx.fxDubMeterEl = meterFill;

    const controls = el('div', { className: 'fx-controls-list' });

    let timeSliderRef = null;
    let timeBadgeRef = null;
    const timeCtrl = createFxSlider({
        label: 'DELAY TIME',
        unit: ' ms',
        min: 40, max: 1500, step: 5,
        value: dub.time,
        onChange: val => {
            dub.time = val;
            sendBelaControl({ event: 'custom', echoDub: { time: val }, echuDub: { time: val } });
        }
    });
    timeSliderRef = timeCtrl.querySelector('input[type=range]');
    timeBadgeRef = timeCtrl.querySelector('.fx-slider-val');
    controls.appendChild(timeCtrl);

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
            dub.time = preset.ms;
            if (timeSliderRef) timeSliderRef.value = preset.ms;
            if (timeBadgeRef) timeBadgeRef.textContent = preset.ms + ' ms';
            sendBelaControl({ event: 'custom', echoDub: { time: preset.ms }, echuDub: { time: preset.ms } });
        });
        syncRow.appendChild(pBtn);
    });
    controls.appendChild(syncRow);

    controls.appendChild(createFxSlider({
        label: 'FEEDBACK (>85% = Oscillation)',
        unit: '%',
        min: 0, max: 115, step: 1,
        value: Math.round(dub.feedback * 100),
        warnOver: 85,
        onChange: val => {
            const fb = val / 100.0;
            dub.feedback = fb;
            sendBelaControl({ event: 'custom', echoDub: { feedback: fb }, echuDub: { feedback: fb } });
        }
    }));

    controls.appendChild(createFxSlider({
        label: 'TAPE TONE (High-Cut)',
        unit: ' Hz',
        min: 1000, max: 5000, step: 50,
        value: dub.tone,
        onChange: val => {
            dub.tone = val;
            sendBelaControl({ event: 'custom', echoDub: { tone: val }, echuDub: { tone: val } });
        }
    }));

    controls.appendChild(createFxSlider({
        label: 'TAPE FLUTTER & WOW',
        unit: '%',
        min: 0, max: 100, step: 1,
        value: Math.round(dub.flutter * 100),
        onChange: val => {
            const fl = val / 100.0;
            dub.flutter = fl;
            sendBelaControl({ event: 'custom', echoDub: { flutter: fl }, echuDub: { flutter: fl } });
        }
    }));

    controls.appendChild(createFxSlider({
        label: 'RETURN LEVEL',
        unit: '%',
        min: 0, max: 100, step: 1,
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
        textContent: dub.kill ? '⚡ SEND KILLED (Echo Looping)' : '✂️ KILL SEND (Cut Input)'
    });
    killBtn.addEventListener('click', () => {
        dub.kill = !dub.kill;
        killBtn.classList.toggle('active', dub.kill);
        killBtn.textContent = dub.kill ? '⚡ SEND KILLED (Echo Looping)' : '✂️ KILL SEND (Cut Input)';
        sendBelaControl({ event: 'custom', echoDub: { kill: dub.kill }, echuDub: { kill: dub.kill } });
    });

    const clearBtn = el('button', {
        type: 'button',
        className: 'fx-big-btn btn-clear-delay',
        textContent: '🧹 CLEAR ECHO'
    });
    clearBtn.addEventListener('click', () => {
        sendBelaControl({ event: 'custom', echoDubClear: true, echuDubClear: true });
        clearBtn.classList.add('flash');
        setTimeout(() => clearBtn.classList.remove('flash'), 300);
    });

    actionBox.appendChild(killBtn);
    actionBox.appendChild(clearBtn);
    card.appendChild(actionBox);

    return card;
}

/** 5. TUBBY SPRING CARD */
function buildTubbySpringCard() {
    const ctx = getContext();
    const card = el('div', { className: 'fx-card fx-card-tubbyspring' });

    const cardHdr = el('div', { className: 'fx-card-header' });
    const titleGroup = el('div', { className: 'fx-card-title-group' });
    titleGroup.appendChild(el('div', { className: 'fx-card-title spring-title', textContent: '🌊 TUBBY SPRING' }));
    titleGroup.appendChild(el('div', { className: 'fx-card-desc', textContent: 'King Tubby Space Reverb & Mechanical Spring Tank' }));
    cardHdr.appendChild(titleGroup);

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

    const meterBox = el('div', { className: 'fx-meter-box' });
    meterBox.appendChild(el('span', { className: 'fx-meter-lbl', textContent: 'SPRING ACTIVITY' }));
    const meterTrack = el('div', { className: 'fx-meter-track' });
    const meterFill = el('div', { className: 'fx-meter-fill spring-fill' });
    meterTrack.appendChild(meterFill);
    meterBox.appendChild(meterTrack);
    card.appendChild(meterBox);
    ctx.fxSpringMeterEl = meterFill;

    const controls = el('div', { className: 'fx-controls-list' });

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
    return card;
}

/** 6. SHIMMER DELAY CARD */
function buildShimmerDelayCard() {
    const ctx = getContext();
    const card = el('div', { className: 'fx-card fx-card-shimmer' });

    const cardHdr = el('div', { className: 'fx-card-header' });
    const titleGroup = el('div', { className: 'fx-card-title-group' });
    titleGroup.appendChild(el('div', { className: 'fx-card-title shimmer-title', textContent: '✨ SHIMMER DUB DELAY' }));
    titleGroup.appendChild(el('div', { className: 'fx-card-desc', textContent: 'Pitch-Shifted Delay & Granular Re-pitch (-12 to +12 Semitones)' }));
    cardHdr.appendChild(titleGroup);

    const pwrWrap = el('label', { className: 'fx-toggle-wrap' });
    const pwrCheck = el('input', { type: 'checkbox', checked: ctx.shimmerDelay.enabled });
    pwrCheck.addEventListener('change', () => {
        ctx.shimmerDelay.enabled = pwrCheck.checked;
        sendBelaControl({ event: 'custom', shimmerDelay: { enabled: pwrCheck.checked } });
    });
    pwrWrap.appendChild(pwrCheck);
    pwrWrap.appendChild(el('span', { className: 'fx-toggle-label', textContent: 'ACTIVE' }));
    cardHdr.appendChild(pwrWrap);
    card.appendChild(cardHdr);

    const meterBox = el('div', { className: 'fx-meter-box' });
    meterBox.appendChild(el('span', { className: 'fx-meter-lbl', textContent: 'SHIMMER ACTIVITY' }));
    const meterTrack = el('div', { className: 'fx-meter-track' });
    const meterFill = el('div', { className: 'fx-meter-fill shimmer-fill' });
    meterTrack.appendChild(meterFill);
    meterBox.appendChild(meterTrack);
    card.appendChild(meterBox);
    ctx.fxShimmerMeterEl = meterFill;

    const controls = el('div', { className: 'fx-controls-list' });

    let semiSliderRef = null;
    let semiBadgeRef = null;
    const semiCtrl = createFxSlider({
        label: 'PITCH SHIFT',
        unit: ' st',
        min: -12, max: 12, step: 1,
        value: ctx.shimmerDelay.semitones,
        onChange: val => {
            ctx.shimmerDelay.semitones = val;
            sendBelaControl({ event: 'custom', shimmerDelay: { semitones: val } });
        }
    });
    semiSliderRef = semiCtrl.querySelector('input[type=range]');
    semiBadgeRef = semiCtrl.querySelector('.fx-slider-val');
    controls.appendChild(semiCtrl);

    const semiRow = el('div', { className: 'fx-preset-row' });
    const semiPresets = [
        { label: '-12 Oct Drop', st: -12 },
        { label: '-7 Fifth Down', st: -7 },
        { label: '0 Unison', st: 0 },
        { label: '+7 Fifth Up', st: 7 },
        { label: '+12 Shimmer Oct', st: 12 }
    ];
    semiPresets.forEach(preset => {
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
        label: 'DELAY TIME',
        unit: ' ms',
        min: 40, max: 1500, step: 5,
        value: ctx.shimmerDelay.delayTime,
        onChange: val => {
            ctx.shimmerDelay.delayTime = val;
            sendBelaControl({ event: 'custom', shimmerDelay: { delayTime: val } });
        }
    }));

    controls.appendChild(createFxSlider({
        label: 'FEEDBACK (Cascade)',
        unit: '%',
        min: 0, max: 95, step: 1,
        value: Math.round(ctx.shimmerDelay.feedback * 100),
        onChange: val => {
            const fb = val / 100.0;
            ctx.shimmerDelay.feedback = fb;
            sendBelaControl({ event: 'custom', shimmerDelay: { feedback: fb } });
        }
    }));

    controls.appendChild(createFxSlider({
        label: 'GRAIN / CROSSFADE WINDOW',
        unit: ' ms',
        min: 20, max: 100, step: 5,
        value: ctx.shimmerDelay.grainSize,
        onChange: val => {
            ctx.shimmerDelay.grainSize = val;
            sendBelaControl({ event: 'custom', shimmerDelay: { grainSize: val } });
        }
    }));

    controls.appendChild(createFxSlider({
        label: 'RETURN LEVEL',
        unit: '%',
        min: 0, max: 150, step: 1,
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
        textContent: '🧹 CLEAR SHIMMER'
    });
    clearBtn.addEventListener('click', () => {
        sendBelaControl({ event: 'custom', shimmerClear: true });
        clearBtn.classList.add('flash');
        setTimeout(() => clearBtn.classList.remove('flash'), 300);
    });
    actionBox.appendChild(clearBtn);
    card.appendChild(actionBox);

    return card;
}

/** 7. BLACK ARK PHASER CARD */
function buildBlackArkPhaserCard() {
    const ctx = getContext();
    const card = el('div', { className: 'fx-card fx-card-blackark' });

    const cardHdr = el('div', { className: 'fx-card-header' });
    const titleGroup = el('div', { className: 'fx-card-title-group' });
    titleGroup.appendChild(el('div', { className: 'fx-card-title phase-title', textContent: '🌀 BLACK ARK PHASER' }));
    titleGroup.appendChild(el('div', { className: 'fx-card-desc', textContent: 'Lee Scratch Perry Mu-Tron Style Bi-Phase & Deep Dub Swirl' }));
    cardHdr.appendChild(titleGroup);

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

    const meterBox = el('div', { className: 'fx-meter-box' });
    meterBox.appendChild(el('span', { className: 'fx-meter-lbl', textContent: 'PHASER ACTIVITY' }));
    const meterTrack = el('div', { className: 'fx-meter-track' });
    const meterFill = el('div', { className: 'fx-meter-fill phase-fill' });
    meterTrack.appendChild(meterFill);
    meterBox.appendChild(meterTrack);
    card.appendChild(meterBox);
    ctx.fxPhaserMeterEl = meterFill;

    const controls = el('div', { className: 'fx-controls-list' });

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
    if (!ctx.fxState || ctx.fxState.length < 17) return;

    // Buffer 12: [0..5] peaks, [6] ducker reduction, [7..16] 5 sources (AUX 1..4 + SIREN) routing
    const subPeak     = ctx.fxState[0];
    const echoPeak    = ctx.fxState[1];
    const springPeak  = ctx.fxState[2];
    const phaserPeak  = ctx.fxState[3];
    const tapePeak    = ctx.fxState[4];
    const shimmerPeak = ctx.fxState[5];
    const duckGainRed = ctx.fxState[6];

    autoMeter(ctx.fxSubMeterEl, subPeak, '#ffb300');
    autoMeter(ctx.fxDubMeterEl, echoPeak, '#00e5ff');
    autoMeter(ctx.fxSpringMeterEl, springPeak, '#f59e0b');
    autoMeter(ctx.fxPhaserMeterEl, phaserPeak, '#a855f7');
    autoMeter(ctx.fxTapeMeterEl, tapePeak, '#f97316');
    autoMeter(ctx.fxShimmerMeterEl, shimmerPeak, '#eab308');

    // Ducking Gain Reduction Meter
    if (ctx.fxDuckerMeterEl) {
        const pct = Math.min(100, Math.round(duckGainRed * 100));
        ctx.fxDuckerMeterEl.style.width = pct + '%';
        if (pct > 25) ctx.fxDuckerMeterEl.style.boxShadow = '0 0 10px #ef4444';
        else ctx.fxDuckerMeterEl.style.boxShadow = 'none';
    }

    // Sync routing pills with hardware state
    if (ctx.fxRouteButtons && ctx.fxRouteButtons.length) {
        for (let aux = 0; aux < 5; ++aux) {
            for (let send = 0; send < 2; ++send) {
                const sDest = Math.round(ctx.fxState[7 + aux * 2 + send]);
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

function autoMeter(el, peakVal, glowColor) {
    if (!el) return;
    const pct = Math.min(100, Math.round((peakVal || 0) * 110));
    el.style.width = pct + '%';
    if (pct > 80 && glowColor) {
        el.style.boxShadow = `0 0 10px ${glowColor}`;
    } else {
        el.style.boxShadow = 'none';
    }
}
