/** Canvas VU meters tab + real-time codec gain control. */
import { getContext } from '../context.js';
import {
    VU_BOX_COUNT, VU_BOX_COUNT_RED, VU_BOX_COUNT_YELLOW,
    VU_BOX_GAP_FRACTION, VU_MAX, VU_CANVAS_W, VU_CANVAS_H,
    VU_SCALE_TICKS,
    METER_ATTACK, METER_RELEASE, PEAK_HOLD_MS, PEAK_DECAY,
    CLIP_THRESHOLD, CLIP_HOLD_MS,
    buildFullRouting,
} from '../config.js';
import { ROUTING_CONFIG } from '../routing-config.js';
import { el, cardTitle } from './utils.js';

// ---------------------------------------------------------------------------
// Codec gains via Bela.control (non-RT seasocks → Bela_setHpLevel / InputGain).
// Payloads: { event:'custom', hpGain|inputGain: N, channel: C }
// ---------------------------------------------------------------------------

const INPUT_GAIN_MIN  = -12;
const INPUT_GAIN_MAX  = 10;
const INPUT_GAIN_STEP = 1;
const HP_GAIN_MIN     = -63;
const HP_GAIN_MAX     = 0;
const HP_GAIN_STEP    = 1;
const METER_COUNT     = 13;

/** Picker handles for syncCodecGains() — indexed by physical channel. */
const _inputPickers  = new Array(10).fill(null);
const _outputPickers = new Array(10).fill(null);

/** Returns true when Bela.control WebSocket is open and ready to send. */
function _belaControlReady() {
    /* global Bela */
    return typeof Bela !== 'undefined' &&
           Bela.control &&
           Bela.control.ws &&
           Bela.control.ws.readyState === 1;
}

/** Sends a codec-gain payload to render.cpp via Bela.control. */
function _sendGain(payload) {
    if (!_belaControlReady()) return;
    /* global Bela */
    Bela.control.send(payload);
}

/**
 * Builds split gain controls: − left of VU, + right, value under channel name.
 * @returns {{ btnDec: Element, btnInc: Element, valEl: Element, setValue: (n: number) => void }}
 */
function _buildMeterGainControls(initVal, min, max, step, onSend) {
    const btnDec = el('button', {
        className: 'meter-gain-btn meter-gain-btn--dec',
        title: `-${step} dB`,
        type: 'button'
    });
    const btnInc = el('button', {
        className: 'meter-gain-btn meter-gain-btn--inc',
        title: `+${step} dB`,
        type: 'button'
    });
    const valEl = el('div', {className: 'meter-gain-val'});

    btnDec.textContent = '−';
    btnInc.textContent = '+';

    let current = initVal;

    function refresh() {
        valEl.textContent = String(current) + '\u202FdB';
        btnDec.disabled = (current <= min);
        btnInc.disabled = (current >= max);
    }

    function tryChange(delta) {
        const next = current + delta;
        if (next < min || next > max) return;
        current = next;
        refresh();
        onSend(current);
    }

    /** Silently update display from buffer 8 (no Bela.control send). */
    function setValue(v) {
        const clamped = Math.round(Math.max(min, Math.min(max, v)));
        if (clamped === current) return;
        current = clamped;
        refresh();
    }

    btnDec.addEventListener('click', (e) => {
        e.stopPropagation();
        tryChange(-step);
    });
    btnInc.addEventListener('click', (e) => {
        e.stopPropagation();
        tryChange(+step);
    });

    refresh();
    return { btnDec, btnInc, valEl, setValue };
}

/**
 * Builds buf3-index → codec gain descriptor map from routing channels.
 * @returns {Object<number, {kind:'input'|'output', ch:number, label:string}>}
 */
function _buildGainByBuf3(inputChannels, outputChannels) {
    const map = {};
    inputChannels.forEach(({ch, label, buf3}) => {
        if (buf3 !== undefined)
            map[buf3] = { kind: 'input', ch, label };
    });
    outputChannels.forEach(({ch, label, buf3}) => {
        if (buf3 !== undefined)
            map[buf3] = { kind: 'output', ch, label };
    });
    return map;
}

/**
 * Creates − / + / value controls for one meter and registers them for sync.
 * @param {{kind:'input'|'output', ch:number, label:string}} desc
 */
function _createInlineGain(desc) {
    const { kind, ch, label } = desc;
    const isInput = kind === 'input';
    const min  = isInput ? INPUT_GAIN_MIN  : HP_GAIN_MIN;
    const max  = isInput ? INPUT_GAIN_MAX  : HP_GAIN_MAX;
    const step = isInput ? INPUT_GAIN_STEP : HP_GAIN_STEP;

    const controls = _buildMeterGainControls(0, min, max, step, (val) => {
        if (isInput) {
            _sendGain({ event: 'custom', inputGain: val, channel: ch });
        } else {
            _sendGain({ event: 'custom', hpGain: val, channel: ch });
        }
    });

    controls.btnDec.title = `${label}: -${step} dB`;
    controls.btnInc.title = `${label}: +${step} dB`;
    controls.valEl.title  = isInput
        ? `${label} ADC gain (−12…10 dB)`
        : `${label} HP gain (−63…0 dB)`;

    if (isInput)
        _inputPickers[ch] = controls;
    else
        _outputPickers[ch] = controls;

    return controls;
}

/**
 * Synchronises picker displays from buffer 8 (~20 fps).
 * buf[0..9] = ADC input gain, buf[10..19] = HP output gain (physical ch, dB).
 * @param {Float32Array} buf
 */
export function syncCodecGains(buf) {
    for (let ch = 0; ch < 10; ch++) {
        if (_inputPickers[ch])  _inputPickers[ch].setValue(buf[ch]);
        if (_outputPickers[ch]) _outputPickers[ch].setValue(buf[10 + ch]);
    }
}

/**
 * Creates a segmented horizontal VU meter on a canvas.
 * @returns {{ setTargets: Function, getPeakPct: Function, draw: Function, resize: Function }}
 */
function createVuMeter(canvas, config) {
    const max            = config.max || 100;
    const boxCount       = config.boxCount || 15;
    const boxCountRed    = config.boxCountRed || 2;
    const boxCountYellow = config.boxCountYellow || 3;
    const boxGapFraction = config.boxGapFraction || 0.25;

    const redStart    = boxCount - boxCountRed + 1;
    const yellowStart = boxCount - boxCountRed - boxCountYellow + 1;

    const redOn     = 'rgba(255,47,30,0.9)';
    const redOff    = 'rgba(64,12,8,0.9)';
    const yellowOn  = 'rgba(255,215,5,0.9)';
    const yellowOff = 'rgba(64,53,0,0.9)';
    const greenOn   = 'rgba(53,255,30,0.9)';
    const greenOff  = 'rgba(13,64,8,0.9)';

    const ctx2d = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let boxHeight = 0;
    let boxGapY = 0;
    let boxWidth = 0;
    let boxGapX = 0;

    let curVal = 0;
    let curPeakVal = 0;
    let lastLitBoxes = -1;
    let lastPeakPx = -1;
    let needsRedraw = true;

    /** Recomputes canvas pixel size and box geometry from CSS dimensions. */
    function resize() {
        const dpr   = window.devicePixelRatio || 1;
        const rect  = canvas.getBoundingClientRect();
        const style = window.getComputedStyle(canvas);
        let cssW = rect.width;
        let cssH = rect.height;
        if (cssW < 2) cssW = parseFloat(style.width)  || VU_CANVAS_W;
        if (cssH < 2) cssH = parseFloat(style.height) || VU_CANVAS_H;

        const newW = Math.max(1, Math.round(cssW));
        const newH = Math.max(1, Math.round(cssH));
        const pxW  = Math.round(newW * dpr);
        const pxH  = Math.round(newH * dpr);

        if (newW === width && newH === height &&
            canvas.width === pxW && canvas.height === pxH)
            return;

        width  = newW;
        height = newH;
        canvas.width  = pxW;
        canvas.height = pxH;
        ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

        boxWidth  = width / (boxCount + (boxCount + 1) * boxGapFraction);
        boxGapX   = boxWidth * boxGapFraction;
        boxHeight = Math.max(8, height - boxGapX * 2);
        boxGapY   = boxGapX;
        needsRedraw = true;
    }

    /** Returns lit-box count for a 0–max level. */
    function litBoxCount(val) {
        return Math.ceil((val / max) * boxCount);
    }

    /** Fill colour for box id (1..boxCount) given how many boxes are lit. */
    function boxColor(id, lit) {
        const on = id <= lit;
        if (id >= redStart)    return on ? redOn : redOff;
        if (id >= yellowStart) return on ? yellowOn : yellowOff;
        return on ? greenOn : greenOff;
    }

    /** Draws all segmented boxes for the current lit count. */
    function drawBoxes(lit) {
        ctx2d.save();
        ctx2d.translate(boxGapX, boxGapY);
        for (let i = 0; i < boxCount; i++) {
            const id = i + 1;
            ctx2d.fillStyle = boxColor(id, lit);
            ctx2d.fillRect(0, 0, boxWidth, boxHeight);
            ctx2d.translate(boxWidth + boxGapX, 0);
        }
        ctx2d.restore();
    }

    /** Draws the white peak-hold line (no glow). */
    function drawPeakIndicator(peakVal) {
        if (peakVal < 1.5) return;

        const innerLeft  = boxGapX;
        const innerRight = width - boxGapX;
        const x = innerLeft + (peakVal / max) * (innerRight - innerLeft);

        ctx2d.strokeStyle = '#fff';
        ctx2d.lineWidth   = 2;
        ctx2d.beginPath();
        ctx2d.moveTo(x, boxGapY);
        ctx2d.lineTo(x, height - boxGapY);
        ctx2d.stroke();
    }

    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => { resize(); }).observe(canvas);
    }
    resize();

    return {
        /** Sets current level and peak-hold percentages (0–max). */
        setTargets(level, peak) {
            curVal     = Math.max(0, Math.min(max, level));
            curPeakVal = Math.max(0, Math.min(max, peak));
        },

        /** Returns peak position as 0–100 (for peak label placement). */
        getPeakPct() {
            return curPeakVal;
        },

        /** Redraws only when lit boxes or peak pixel position changed. */
        draw() {
            const lit = litBoxCount(curVal);
            const peakPx = curPeakVal < 1.5
                ? -1
                : Math.round((curPeakVal / max) * width);

            if (!needsRedraw && lit === lastLitBoxes && peakPx === lastPeakPx)
                return;

            lastLitBoxes = lit;
            lastPeakPx   = peakPx;
            needsRedraw  = false;

            ctx2d.fillStyle = 'rgb(32,32,32)';
            ctx2d.fillRect(0, 0, width, height);
            drawBoxes(lit);
            drawPeakIndicator(curPeakVal);
        },

        resize
    };
}

/** Converts a linear peak level to a 0–100 % bar (-60 dBFS floor). */
function levelToBarPct(raw) {
    const dB = raw > 0.000032 ? 20 * Math.log10(raw) : -90;
    return ((Math.max(dB, -60) + 60) / 60) * 100;
}

/** Formats a linear peak level as a dB string. */
function levelToDbLabel(raw) {
    const dB = raw > 0.000032 ? 20 * Math.log10(raw) : -90;
    return dB < -80 ? '-\u221e' : dB.toFixed(1) + '\u202FdB';
}

/** Builds the Meters tab pane (VU strips + inline codec gains). */
export function buildMetersPane() {
    const pane    = el('div', {id: 'pane-meters', className: 'tab-pane'});
    const wrap    = el('div', {id: 'meters-wrap'});
    const columns = el('div', {className: 'meters-columns'});

    const { levelGroups, levelLabels, inputChannels, outputChannels } =
        buildFullRouting(ROUTING_CONFIG);

    const gainByBuf3 = _buildGainByBuf3(inputChannels, outputChannels);

    for (let ch = 0; ch < 10; ch++) {
        _inputPickers[ch]  = null;
        _outputPickers[ch] = null;
    }

    const ctx = getContext();
    ctx.meterVu = [];
    ctx.meterPeakDbs = [];
    ctx.meterClipLeds = [];

    levelGroups.forEach(group => {
        const card = el('div', {className: 'card meters-card'});
        card.appendChild(cardTitle(group.label));
        const row = el('div', {className: 'meter-group'});

        group.indices.forEach(idx => {
            const chRow = el('div', {className: 'meter-ch'});
            const mid   = el('div', {className: 'meter-id'});

            const lbl = el('div', {className: 'meter-lbl'});
            lbl.textContent = levelLabels[idx] || String(idx);
            mid.appendChild(lbl);

            const gainDesc = gainByBuf3[idx];
            const gainCtrl = gainDesc ? _createInlineGain(gainDesc) : null;
            if (gainCtrl)
                mid.appendChild(gainCtrl.valEl);

            const strip = el('div', {className: 'meter-strip'});
            const body  = el('div', {className: 'meter-body'});
            const mwrap = el('div', {className: 'meter-wrap'});
            mwrap.title = 'Click to reset peak hold';

            const cnv = el('canvas', {className: 'meter-canvas', id: 'mc-' + idx});
            ctx.meterVu[idx] = createVuMeter(cnv, {
                boxCount:       VU_BOX_COUNT,
                boxCountRed:    VU_BOX_COUNT_RED,
                boxCountYellow: VU_BOX_COUNT_YELLOW,
                boxGapFraction: VU_BOX_GAP_FRACTION,
                max:            VU_MAX
            });

            const peakDb = el('div', {className: 'meter-peak-db', id: 'mpd-' + idx});
            peakDb.style.left = '0%';
            peakDb.textContent = '-\u221e';
            ctx.meterPeakDbs[idx] = peakDb;

            const clipLed = el('div', {
                className: 'meter-clip-led',
                id: 'mclip-' + idx,
                title: 'Clip (≥ ' + (CLIP_THRESHOLD * 100).toFixed(0) + '% full scale)',
                role: 'img',
                'aria-label': 'Clip indicator off'
            });
            clipLed.innerHTML =
                '<span class="meter-clip-led__bezel"></span>' +
                '<span class="meter-clip-led__core"></span>';
            ctx.meterClipLeds[idx] = clipLed;

            mwrap.addEventListener('click', () => {
                ctx.peakHoldLevel[idx]  = 0;
                ctx.peakHoldExpire[idx] = 0;
            });

            const scale = el('div', {className: 'meter-scale'});
            for (let t = 0; t < VU_SCALE_TICKS.length; t++) {
                const tick = el('span');
                tick.textContent = String(VU_SCALE_TICKS[t]);
                scale.appendChild(tick);
            }

            mwrap.appendChild(cnv);
            mwrap.appendChild(peakDb);
            body.appendChild(mwrap);
            body.appendChild(scale);

            if (gainCtrl) {
                strip.appendChild(gainCtrl.btnDec);
                strip.appendChild(body);
                strip.appendChild(gainCtrl.btnInc);
            } else {
                strip.appendChild(body);
            }

            chRow.appendChild(strip);
            chRow.appendChild(clipLed);
            chRow.appendChild(mid);
            row.appendChild(chRow);
        });

        card.appendChild(row);
        columns.appendChild(card);
    });

    wrap.appendChild(columns);
    pane.appendChild(wrap);
    return pane;
}

/** Starts the meter animation loop while the Meters tab is visible. */
export function startMeterAnim() {
    if (getContext().meterAnimId != null) return;
    function tick() {
        const ctx = getContext();
        if (ctx.currentTab !== 1) {
            ctx.meterAnimId = null;
            return;
        }
        updateMetersFrame();
        ctx.meterAnimId = requestAnimationFrame(tick);
    }
    getContext().meterAnimId = requestAnimationFrame(tick);
}

/** Stops the meter animation loop. */
export function stopMeterAnim() {
    const ctx = getContext();
    if (ctx.meterAnimId == null) return;
    cancelAnimationFrame(ctx.meterAnimId);
    ctx.meterAnimId = null;
}

/** Updates canvas VU meters with peak-hold and segmented box rendering. */
function updateMetersFrame() {
    const ctx = getContext();
    const now = performance.now();

    for (let i = 0; i < METER_COUNT; i++) {
        const vu = ctx.meterVu[i];
        if (!vu) continue;

        const raw = ctx.audioLevels[i];
        const smooth = ctx.meterSmooth[i];
        const coeff  = raw > smooth ? METER_ATTACK : METER_RELEASE;
        ctx.meterSmooth[i] = smooth + (raw - smooth) * coeff;

        if (raw > ctx.peakHoldLevel[i]) {
            ctx.peakHoldLevel[i]  = raw;
            ctx.peakHoldExpire[i] = now + PEAK_HOLD_MS;
        } else if (now >= ctx.peakHoldExpire[i]) {
            ctx.peakHoldLevel[i] *= PEAK_DECAY;
        }

        if (raw >= CLIP_THRESHOLD || ctx.peakHoldLevel[i] >= CLIP_THRESHOLD)
            ctx.clipHoldUntil[i] = now + CLIP_HOLD_MS;

        const clipping = now < ctx.clipHoldUntil[i];

        const clipLed = ctx.meterClipLeds[i];
        if (clipLed) {
            const on = clipping;
            if (clipLed.classList.contains('on') !== on) {
                clipLed.classList.toggle('on', on);
                clipLed.setAttribute(
                    'aria-label',
                    on ? 'Clip indicator on' : 'Clip indicator off'
                );
            }
        }

        const peakDb = ctx.meterPeakDbs[i];
        if (peakDb)
            peakDb.classList.toggle('clip', clipping);

        vu.setTargets(
            levelToBarPct(ctx.meterSmooth[i]),
            levelToBarPct(ctx.peakHoldLevel[i])
        );
        vu.draw();

        if (peakDb) {
            const pkPct = vu.getPeakPct();
            const peakLbl = levelToDbLabel(ctx.peakHoldLevel[i]);
            if (peakDb.textContent !== peakLbl)
                peakDb.textContent = peakLbl;
            const left = pkPct.toFixed(2) + '%';
            if (peakDb.style.left !== left)
                peakDb.style.left = left;
            const op = pkPct > 1.5 ? '1' : '0';
            if (peakDb.style.opacity !== op)
                peakDb.style.opacity = op;
        }
    }
}
