/** Canvas VU meters tab. */
import { getContext } from '../context.js';
import {
    LEVEL_GROUPS, LEVEL_LABELS,
    VU_BOX_COUNT, VU_BOX_COUNT_RED, VU_BOX_COUNT_YELLOW,
    VU_BOX_GAP_FRACTION, VU_MAX, VU_CANVAS_W, VU_CANVAS_H,
    METER_ATTACK, METER_RELEASE, PEAK_HOLD_MS, PEAK_DECAY,
    CLIP_THRESHOLD, CLIP_HOLD_MS
} from '../config.js';
import { el, cardTitle } from './utils.js';

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
