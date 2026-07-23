/** Canvas VU meters tab + real-time codec gain control. */
import { getContext } from '../context.js';
import {
    LEVEL_GROUPS, LEVEL_LABELS,
    VU_BOX_COUNT, VU_BOX_COUNT_RED, VU_BOX_COUNT_YELLOW,
    VU_BOX_GAP_FRACTION, VU_MAX, VU_CANVAS_W, VU_CANVAS_H,
    METER_ATTACK, METER_RELEASE, PEAK_HOLD_MS, PEAK_DECAY,
    CLIP_THRESHOLD, CLIP_HOLD_MS
} from '../config.js';
import { el, cardTitle } from './utils.js';

// ---------------------------------------------------------------------------
// Real-time codec gain control via Bela.control WebSocket.
//
// Flow:  [Button] → Bela.control.send({ event:'custom', ...payload })
//                       ↓  ws://bela:5555/gui_control
//                   render.cpp : gGui.setControlDataCallback(...)
//                       ↓  seasocks thread (non-RT, I2C-safe)
//                   Bela_setHpLevel / Bela_setAudioInputGain  (written immediately)
//
// Supported payloads:
//   { event:'custom', hp1Gain: N }               — MASTER (OUT 1), [-63, 0] dB
//   { event:'custom', inputGain: N, channel: C } — ADC PGA, [-12, 10] dB
// ---------------------------------------------------------------------------

/** Codec gain state — all defaults at 0 dB (unity). */
const _codecGains = {
    hp:    0,
    input: [0, 0, 0, 0],  // AUX1 (ch0), AUX2 (ch1), AUX3 (ch2), AUX4 (ch3)
};

/** Input channel descriptors — must match HardwareConfig.h audio inputs. */
const INPUT_CHANNELS = [
    { ch: 0, label: 'AUX1 (IN0)' },
    { ch: 1, label: 'AUX2 (IN1)' },
    { ch: 2, label: 'AUX3 (IN2)' },
    { ch: 3, label: 'AUX4 (IN3)' },
];

const INPUT_GAIN_MIN  = -12;
const INPUT_GAIN_MAX  = 10;
const INPUT_GAIN_STEP = 1;
const HP_GAIN_MIN     = -63;
const HP_GAIN_MAX     = 0;
const HP_GAIN_STEP    = 1;

/** Returns true when Bela.control WebSocket is open and ready to send. */
function _belaControlReady() {
    /* global Bela */
    return typeof Bela !== 'undefined' &&
           Bela.control &&
           Bela.control.ws &&
           Bela.control.ws.readyState === 1; // WebSocket.OPEN
}

/**
 * Sends a JSON payload to render.cpp via Bela.control.
 * @param {object} payload
 * @param {string} desc - human-readable description for status
 * @param {Element} statusEl
 */
function _sendGain(payload, desc, statusEl) {
    if (!_belaControlReady()) {
        statusEl.textContent =
            'Bela.control not connected — make sure the project is running';
        statusEl.className = 'codec-gain-status err';
        return;
    }
    /* global Bela */
    Bela.control.send(payload);
    statusEl.textContent = `Real-time: ${desc} (applied immediately, no restart)`;
    statusEl.className   = 'codec-gain-status ok';
}

/**
 * Builds one gain-picker row: label [−] value [+].
 * Calls onSend(newVal, statusEl) whenever the value changes.
 */
function _buildPickerRow(label, initVal, min, max, step, onSend, statusEl) {
    const row    = el('div',    {className: 'codec-gain-row'});
    const lbl    = el('span',   {className: 'codec-gain-label'});
    const picker = el('span',   {className: 'codec-gain-picker'});
    const btnDec = el('button', {className: 'codec-gain-btn', title: `-${step} dB`});
    const valEl  = el('input',  {type: 'text', className: 'codec-gain-val', readOnly: true});
    const btnInc = el('button', {className: 'codec-gain-btn', title: `+${step} dB`});

    lbl.textContent    = label;
    btnDec.textContent = '−';
    btnInc.textContent = '+';

    let current = initVal;

    function refresh() {
        valEl.value     = String(current);
        btnDec.disabled = (current <= min);
        btnInc.disabled = (current >= max);
    }

    function tryChange(delta) {
        const next = current + delta;
        if (next < min || next > max) return;
        current = next;
        refresh();
        onSend(current, statusEl);
    }

    btnDec.addEventListener('click', () => tryChange(-step));
    btnInc.addEventListener('click', () => tryChange(+step));

    picker.appendChild(btnDec);
    picker.appendChild(valEl);
    picker.appendChild(btnInc);
    row.appendChild(lbl);
    row.appendChild(picker);

    refresh();
    return row;
}

/**
 * Builds the unified Codec Gains card.
 * Sections: ADC input PGA (AUX1–4) and HP output (MASTER OUT 1).
 * Uses Bela.control WebSocket — no project restart required.
 */
function buildCodecGainCard() {
    const card = el('div', {className: 'card'});
    card.appendChild(cardTitle('Codec Gains — real-time'));

    const notice = el('p', {className: 'codec-gain-notice'});
    notice.textContent =
        'Changes are applied immediately via Bela.control. ' +
        'Values are volatile — they reset on project restart.';
    card.appendChild(notice);

    const statusEl = el('div', {className: 'codec-gain-status'});
    statusEl.textContent = 'Waiting for Bela.control connection…';

    // --- Input section ---
    const inSection = el('div', {className: 'codec-gain-section'});
    inSection.textContent = 'ADC Input PGA (-12–10 dB)';
    card.appendChild(inSection);

    INPUT_CHANNELS.forEach(({ch, label}) => {
        card.appendChild(_buildPickerRow(
            label,
            _codecGains.input[ch],
            INPUT_GAIN_MIN, INPUT_GAIN_MAX, INPUT_GAIN_STEP,
            (val, st) => {
                _codecGains.input[ch] = val;
                _sendGain(
                    { event: 'custom', inputGain: val, channel: ch },
                    `${label} → ${val} dB`,
                    st
                );
            },
            statusEl
        ));
    });

    // --- Output section ---
    const outSection = el('div', {className: 'codec-gain-section'});
    outSection.textContent = 'HP Output (-63–0 dB)';
    card.appendChild(outSection);

    card.appendChild(_buildPickerRow(
        'MASTER (OUT 1)',
        _codecGains.hp,
        HP_GAIN_MIN, HP_GAIN_MAX, HP_GAIN_STEP,
        (val, st) => {
            _codecGains.hp = val;
            _sendGain({ event: 'custom', hp1Gain: val }, `MASTER (OUT 1) → ${val} dB`, st);
        },
        statusEl
    ));

    card.appendChild(statusEl);

    // Poll until Bela.control is ready
    const _poll = setInterval(() => {
        if (_belaControlReady()) {
            statusEl.textContent = 'Bela.control connected — ready';
            statusEl.className   = 'codec-gain-status ok';
            clearInterval(_poll);
        }
    }, 1000);

    return card;
}

export function createVuMeter(canvas, config) {
    const max            = config.max || 100;
    const boxCount       = config.boxCount || 15;
    const boxCountRed    = config.boxCountRed || 2;
    const boxCountYellow = config.boxCountYellow || 3;
    const boxGapFraction = config.boxGapFraction || 0.25;

    const redOn     = 'rgba(255,47,30,0.9)';
    const redOff    = 'rgba(64,12,8,0.9)';
    const yellowOn  = 'rgba(255,215,5,0.9)';
    const yellowOff = 'rgba(64,53,0,0.9)';
    const greenOn   = 'rgba(53,255,30,0.9)';
    const greenOff  = 'rgba(13,64,8,0.9)';

    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let boxHeight = 0;
    let boxGapY = 0;
    let boxWidth = 0;
    let boxGapX = 0;

    let curVal = 0;
    let curPeakVal = 0;
    let targetVal = 0;
    let targetPeakVal = 0;

    /** Recomputes canvas pixel size and box geometry from CSS dimensions. */
    function resize() {
        const dpr   = window.devicePixelRatio || 1;
        const rect  = canvas.getBoundingClientRect();
        const style = window.getComputedStyle(canvas);
        let cssW = rect.width;
        let cssH = rect.height;
        // Hidden tab panes report 0×0 — fall back to CSS size.
        if(cssW < 2) cssW = parseFloat(style.width)  || VU_CANVAS_W;
        if(cssH < 2) cssH = parseFloat(style.height) || VU_CANVAS_H;

        const newW = Math.max(1, Math.round(cssW));
        const newH = Math.max(1, Math.round(cssH));
        const pxW  = Math.round(newW * dpr);
        const pxH  = Math.round(newH * dpr);

        if(newW === width && newH === height &&
           canvas.width === pxW && canvas.height === pxH)
            return;

        width  = newW;
        height = newH;
        canvas.width  = pxW;
        canvas.height = pxH;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        boxWidth  = width / (boxCount + (boxCount + 1) * boxGapFraction);
        boxGapX   = boxWidth * boxGapFraction;
        boxHeight = Math.max(8, height - boxGapX * 2);
        boxGapY   = boxGapX;
    }

    /** Maps draw-loop index to logical box id (left = 1, right = boxCount). */
    function getId(index) {
        return index + 1;
    }

    /** Returns true when a box should be lit at the current value. */
    function isOn(id, val) {
        const maxOn = Math.ceil((val / max) * boxCount);
        return id <= maxOn;
    }

    /** Returns on/off fill colour for one box. */
    function getBoxColor(id, val) {
        if(id > boxCount - boxCountRed)
            return isOn(id, val) ? redOn : redOff;
        if(id > boxCount - boxCountRed - boxCountYellow)
            return isOn(id, val) ? yellowOn : yellowOff;
        return isOn(id, val) ? greenOn : greenOff;
    }

    /** Draws all segmented boxes for the current level (left → right). */
    function drawBoxes(val) {
        ctx.save();
        ctx.translate(boxGapX, boxGapY);
        for(let i = 0; i < boxCount; i++) {
            const id = getId(i);
            ctx.beginPath();
            if(isOn(id, val)) {
                ctx.shadowBlur  = 10;
                ctx.shadowColor = getBoxColor(id, val);
            } else {
                ctx.shadowBlur = 0;
            }
            ctx.rect(0, 0, boxWidth, boxHeight);
            ctx.fillStyle = getBoxColor(id, val);
            ctx.fill();
            ctx.translate(boxWidth + boxGapX, 0);
        }
        ctx.restore();
    }

    /** Draws the white peak-hold line (vertical marker). */
    function drawPeakIndicator(peakVal) {
        if(peakVal < 1.5) return;

        const innerLeft  = boxGapX;
        const innerRight = width - boxGapX;
        const x = innerLeft + (peakVal / max) * (innerRight - innerLeft);

        ctx.save();
        ctx.strokeStyle = '#fff';
        ctx.shadowBlur  = 5;
        ctx.shadowColor = '#fff';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(x, boxGapY);
        ctx.lineTo(x, height - boxGapY);
        ctx.stroke();
        ctx.restore();
    }

    return {
        /** Sets target level and peak-hold percentages (0–max). */
        setTargets(level, peak) {
            targetVal     = Math.max(0, Math.min(max, level));
            targetPeakVal = Math.max(0, Math.min(max, peak));
        },

        /** Returns smoothed peak position as 0–100 (for external label placement). */
        getPeakPct() {
            return curPeakVal;
        },

        /** Advances smoothing and redraws the meter. */
        draw() {
            resize();

            if(curVal <= targetVal)
                curVal += (targetVal - curVal) / 5;
            else
                curVal -= (curVal - targetVal) / 5;

            if(curPeakVal <= targetPeakVal)
                curPeakVal += (targetPeakVal - curPeakVal) / 4;
            else
                curPeakVal -= (curPeakVal - targetPeakVal) / 6;

            ctx.save();
            ctx.fillStyle = 'rgb(32,32,32)';
            ctx.fillRect(0, 0, width, height);
            ctx.restore();

            drawBoxes(curVal);
            drawPeakIndicator(curPeakVal);
        },

        /** Recomputes layout after a window resize. */
        resize
    };
}

export function buildMetersPane() {
    const pane = el('div', {id:'pane-meters', className:'tab-pane'});
    const wrap = el('div', {id:'meters-wrap'});
    const columns = el('div', {className:'meters-columns'});

    LEVEL_GROUPS.forEach(group => {
        const card = el('div', {className:'card meters-card'});
        card.appendChild(cardTitle(group.label));
        const row = el('div', {className:'meter-group'});

        group.indices.forEach(idx => {
            const ch = el('div', {className:'meter-ch'});
            const mid = el('div', {className:'meter-id'});

            const lbl = el('div', {className:'meter-lbl'});
            lbl.textContent = LEVEL_LABELS[idx];

            const dbv = el('div', {className:'meter-db', id:'md-'+idx});
            dbv.textContent = '-\u221e';
            getContext().meterDbs[idx] = dbv;

            mid.appendChild(lbl);
            mid.appendChild(dbv);

            const mwrap = el('div', {className:'meter-wrap'});

            const cnv = el('canvas', {className:'meter-canvas', id:'mc-'+idx});
            getContext().meterVu[idx] = createVuMeter(cnv, {
                boxCount:        VU_BOX_COUNT,
                boxCountRed:     VU_BOX_COUNT_RED,
                boxCountYellow:  VU_BOX_COUNT_YELLOW,
                boxGapFraction:  VU_BOX_GAP_FRACTION,
                max:             VU_MAX
            });

            const peakDb = el('div', {className:'meter-peak-db', id:'mpd-'+idx});
            peakDb.style.left = '0%';
            peakDb.textContent = '-\u221e';
            getContext().meterPeakDbs[idx] = peakDb;

            const clipLed = el('div', {
                className: 'meter-clip-led',
                id: 'mclip-' + idx,
                title: 'Clip (≥ ' + (CLIP_THRESHOLD * 100).toFixed(0) + '% full scale)',
                role: 'img',
                'aria-label': 'Clip indicator off'
            });
            clipLed.innerHTML = '<span class="meter-clip-led__bezel"></span><span class="meter-clip-led__core"></span>';
            getContext().meterClipLeds[idx] = clipLed;

            mwrap.appendChild(cnv);
            mwrap.appendChild(peakDb);

            ch.appendChild(mid);
            ch.appendChild(mwrap);
            ch.appendChild(clipLed);
            row.appendChild(ch);
        });

        card.appendChild(row);
        columns.appendChild(card);
    });

    wrap.appendChild(columns);
    pane.appendChild(wrap);
    pane.appendChild(buildCodecGainCard());
    return pane;
}

/** Converts a linear peak level to a 0–100 % bar height (-60 dBFS floor). */
export function levelToBarPct(raw) {
    const dB = raw > 0.000032 ? 20 * Math.log10(raw) : -90;
    return ((Math.max(dB, -60) + 60) / 60) * 100;
}

/** Formats a linear peak level as a dB string. */
export function levelToDbLabel(raw) {
    const dB = raw > 0.000032 ? 20 * Math.log10(raw) : -90;
    return dB < -80 ? '-\u221e' : dB.toFixed(1) + '\u202FdB';
}

/** Starts the 60 fps meter animation loop while the Meters tab is visible. */
export function startMeterAnim() {
    if(getContext().meterAnimId != null) return;
    function tick() {
        if(getContext().currentTab !== 1) {
            getContext().meterAnimId = null;
            return;
        }
        updateMetersFrame();
        getContext().meterAnimId = requestAnimationFrame(tick);
    }
    getContext().meterAnimId = requestAnimationFrame(tick);
}

/** Stops the meter animation loop. */
export function stopMeterAnim() {
    if(getContext().meterAnimId == null) return;
    cancelAnimationFrame(getContext().meterAnimId);
    getContext().meterAnimId = null;
}

/** Returns true when a linear peak level is at or above the clip threshold. */
export function isLevelClipping(raw) {
    return raw >= CLIP_THRESHOLD;
}

/** Updates canvas VU meters with peak-hold and segmented box rendering. */
export function updateMetersFrame() {
    const ctx = getContext();
    const now = performance.now();

    for(let i = 0; i < 13; i++) {
        const raw = ctx.audioLevels[i];

        const smooth = ctx.meterSmooth[i];
        const coeff  = raw > smooth ? METER_ATTACK : METER_RELEASE;
        ctx.meterSmooth[i] = smooth + (raw - smooth) * coeff;

        if(raw > ctx.peakHoldLevel[i]) {
            ctx.peakHoldLevel[i]  = raw;
            ctx.peakHoldExpire[i] = now + PEAK_HOLD_MS;
        } else if(now >= ctx.peakHoldExpire[i]) {
            ctx.peakHoldLevel[i] *= PEAK_DECAY;
        }

        if(isLevelClipping(raw) || isLevelClipping(ctx.peakHoldLevel[i]))
            ctx.clipHoldUntil[i] = now + CLIP_HOLD_MS;

        const clipping = now < ctx.clipHoldUntil[i];

        const clipLed = ctx.meterClipLeds[i];
        if(clipLed) {
            clipLed.classList.toggle('on', clipping);
            clipLed.setAttribute('aria-label', clipping ? 'Clip indicator on' : 'Clip indicator off');
        }
        if(ctx.meterDbs[i])
            ctx.meterDbs[i].classList.toggle('clip', clipping);
        if(ctx.meterPeakDbs[i])
            ctx.meterPeakDbs[i].classList.toggle('clip', clipping);

        const vu = ctx.meterVu[i];
        if(vu) {
            vu.setTargets(
                levelToBarPct(ctx.meterSmooth[i]),
                levelToBarPct(ctx.peakHoldLevel[i])
            );
            vu.draw();
        }

        const peakDb = ctx.meterPeakDbs[i];
        if(peakDb && vu) {
            const pkPct = vu.getPeakPct();
            peakDb.textContent = levelToDbLabel(ctx.peakHoldLevel[i]);
            peakDb.style.left = pkPct.toFixed(2) + '%';
            peakDb.style.opacity = pkPct > 1.5 ? '1' : '0';
        }
        if(ctx.meterDbs[i])
            ctx.meterDbs[i].textContent = levelToDbLabel(ctx.meterSmooth[i]);
    }
}
