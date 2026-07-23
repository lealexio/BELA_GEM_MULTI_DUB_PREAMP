/** Master EQ theoretical frequency-response curve. */
import { getContext } from '../context.js';
import { MASTER_EQ_CONFIG, masterEqFreqs, MASTER_EQ_FREQ_TICKS } from '../config.js';
import { el, cardTitle } from './utils.js';

export function masterEqPotToGainDb(pot, rangeDb) {
    return (pot - 0.5) * 2 * rangeDb;
}

/** Logarithmic pot → frequency mapping (matches ParametricEq / FilterSection). */
export function masterEqLogInterp(fMin, fMax, t) {
    return fMin * Math.pow(fMax / fMin, t);
}

/** Linear pot → Q mapping (FilterSection resonance). */
export function masterEqLinInterp(vMin, vMax, t) {
    return vMin + t * (vMax - vMin);
}

/** Returns linear magnitude of a biquad at frequency f (Audio EQ Cookbook coeffs). */
export function biquadMagLinear(c, f, fs) {
    const w = 2 * Math.PI * f / fs;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    const c2w = Math.cos(2 * w);
    const s2w = Math.sin(2 * w);
    const numRe = c.b0 + c.b1 * cw + c.b2 * c2w;
    const numIm = -c.b1 * sw - c.b2 * s2w;
    const denRe = 1 + c.a1 * cw + c.a2 * c2w;
    const denIm = -c.a1 * sw - c.a2 * s2w;
    const num = Math.hypot(numRe, numIm);
    const den = Math.hypot(denRe, denIm);
    return den > 1e-15 ? num / den : 0;
}

/** Returns dB magnitude for one biquad (optionally cascaded stages). */
export function biquadMagDb(c, f, fs, stages) {
    let m = biquadMagLinear(c, f, fs);
    if(stages > 1) m = Math.pow(m, stages);
    return 20 * Math.log10(Math.max(m, 1e-12));
}

/** Builds peaking biquad coefficients (matches Biquad.cpp setPeaking). */
export function biquadPeaking(freq, gainDb, q, fs) {
    const A = Math.pow(10, gainDb / 40);
    const w0 = 2 * Math.PI * freq / fs;
    const alpha = Math.sin(w0) / (2 * q);
    const cw = Math.cos(w0);
    const a0 = 1 + alpha / A;
    return {
        b0: (1 + alpha * A) / a0,
        b1: (-2 * cw) / a0,
        b2: (1 - alpha * A) / a0,
        a1: (-2 * cw) / a0,
        a2: (1 - alpha / A) / a0
    };
}

/** Builds low-shelf biquad coefficients (matches Biquad.cpp setLowShelf). */
export function biquadLowShelf(freq, gainDb, fs) {
    const A = Math.pow(10, gainDb / 40);
    const w0 = 2 * Math.PI * freq / fs;
    const cw = Math.cos(w0);
    const sw = Math.sin(w0);
    const alpha = sw / 2 * Math.SQRT2;
    const sqA = Math.sqrt(A);
    const a0 = (A + 1) + (A - 1) * cw + 2 * sqA * alpha;
    return {
        b0: A * ((A + 1) - (A - 1) * cw + 2 * sqA * alpha) / a0,
        b1: 2 * A * ((A - 1) - (A + 1) * cw) / a0,
        b2: A * ((A + 1) - (A - 1) * cw - 2 * sqA * alpha) / a0,
        a1: -2 * ((A - 1) + (A + 1) * cw) / a0,
        a2: ((A + 1) + (A - 1) * cw - 2 * sqA * alpha) / a0
    };
}

/** Builds high-shelf biquad coefficients (matches Biquad.cpp setHighShelf). */
export function biquadHighShelf(freq, gainDb, fs) {
    const A = Math.pow(10, gainDb / 40);
    const w0 = 2 * Math.PI * freq / fs;
    const cw = Math.cos(w0);
    const sw = Math.sin(w0);
    const alpha = sw / 2 * Math.SQRT2;
    const sqA = Math.sqrt(A);
    const a0 = (A + 1) - (A - 1) * cw + 2 * sqA * alpha;
    return {
        b0: A * ((A + 1) + (A - 1) * cw + 2 * sqA * alpha) / a0,
        b1: -2 * A * ((A - 1) + (A + 1) * cw) / a0,
        b2: A * ((A + 1) + (A - 1) * cw - 2 * sqA * alpha) / a0,
        a1: 2 * ((A - 1) - (A + 1) * cw) / a0,
        a2: ((A + 1) - (A - 1) * cw - 2 * sqA * alpha) / a0
    };
}

/** Builds low-pass biquad coefficients (matches Biquad.cpp setLowPass). */
export function biquadLowPass(freq, q, fs) {
    const w0 = 2 * Math.PI * freq / fs;
    const cw = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    return {
        b0: (1 - cw) * 0.5 / a0,
        b1: (1 - cw) / a0,
        b2: (1 - cw) * 0.5 / a0,
        a1: -2 * cw / a0,
        a2: (1 - alpha) / a0
    };
}

/** Builds high-pass biquad coefficients (matches Biquad.cpp setHighPass). */
export function biquadHighPass(freq, q, fs) {
    const w0 = 2 * Math.PI * freq / fs;
    const cw = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    return {
        b0: (1 + cw) * 0.5 / a0,
        b1: -(1 + cw) / a0,
        b2: (1 + cw) * 0.5 / a0,
        a1: -2 * cw / a0,
        a2: (1 - alpha) / a0
    };
}

/** Kill-switch band magnitude: cascaded LP/HP stages (matches KillSwitch.cpp). */
export function killBandMagLinear(band, f, fs, cfg) {
    const q = cfg.KILL_CROSSOVER_Q;
    const st = cfg.KILL_FILTER_STAGES;
    const fc = cfg.KILL_FC;
    let h = 1;
    if(band === 'sub') {
        const c = biquadLowPass(fc[0], q, fs);
        h = Math.pow(biquadMagLinear(c, f, fs), st);
    } else if(band === 'kick') {
        const hp = biquadHighPass(fc[0], q, fs);
        const lp = biquadLowPass(fc[1], q, fs);
        h = Math.pow(biquadMagLinear(hp, f, fs), st) *
            Math.pow(biquadMagLinear(lp, f, fs), st);
    } else if(band === 'mid') {
        const hp = biquadHighPass(fc[1], q, fs);
        const lp = biquadLowPass(fc[2], q, fs);
        h = Math.pow(biquadMagLinear(hp, f, fs), st) *
            Math.pow(biquadMagLinear(lp, f, fs), st);
    } else {
        const hp = biquadHighPass(fc[2], q, fs);
        h = Math.pow(biquadMagLinear(hp, f, fs), st);
    }
    return h;
}

/**
 * Computes the master-bus dry-chain magnitude curve in dB (20 Hz–20 kHz).
 * Models ParametricEq → GraphicEq → FilterSection → BandTrim → KillSwitch.
 */
export function computeMasterCurve(pots, switches) {
    const cfg = MASTER_EQ_CONFIG;
    const fs = cfg.SAMPLE_RATE;
    const eps = cfg.GAIN_EPSILON_DB;
    const p = cfg.POT;
    const out = getContext().masterEqCurveDb;
    const n = cfg.CURVE_POINTS;

    const peGainDb = [
        masterEqPotToGainDb(pots[p.PE_SUB_GAIN], cfg.MASTER_EQ_GAIN_RANGE_DB),
        masterEqPotToGainDb(pots[p.PE_KICK_GAIN], cfg.MASTER_EQ_GAIN_RANGE_DB),
        masterEqPotToGainDb(pots[p.PE_MID_GAIN], cfg.MASTER_EQ_GAIN_RANGE_DB),
        masterEqPotToGainDb(pots[p.PE_TOP_GAIN], cfg.MASTER_EQ_GAIN_RANGE_DB)
    ];
    const peFreqPot = [
        pots[p.PE_SUB_FREQ], pots[p.PE_KICK_FREQ],
        pots[p.PE_MID_FREQ], pots[p.PE_TOP_FREQ]
    ];

    const geqGainDb = [];
    for(let i = 0; i < cfg.GEQ_FREQS.length; i++)
        geqGainDb[i] = masterEqPotToGainDb(
            pots[p.GEQ_BASE + i], cfg.GEQ_GAIN_RANGE_DB);

    const btrimGainDb = [
        masterEqPotToGainDb(pots[p.BTRIM_SUB], cfg.BAND_TRIM_GAIN_DB),
        masterEqPotToGainDb(pots[p.BTRIM_KICK], cfg.BAND_TRIM_GAIN_DB),
        masterEqPotToGainDb(pots[p.BTRIM_MID], cfg.BAND_TRIM_GAIN_DB),
        masterEqPotToGainDb(pots[p.BTRIM_TOP], cfg.BAND_TRIM_GAIN_DB)
    ];

    const hpfActive = pots[p.HPF_FREQ] >= cfg.FILTER_OFF_THRESHOLD;
    const lpfActive = pots[p.LPF_FREQ] >= cfg.FILTER_OFF_THRESHOLD;
    const hpfMix = hpfActive ? 1 : 0;
    const lpfMix = lpfActive ? 1 : 0;

    let hpfCoeffs = null;
    let lpfCoeffs = null;
    if(hpfActive) {
        const fc = masterEqLogInterp(cfg.HPF_FMIN, cfg.HPF_FMAX, pots[p.HPF_FREQ]);
        const q = masterEqLinInterp(cfg.FILTER_QMIN, cfg.FILTER_QMAX, pots[p.HPF_RES]);
        hpfCoeffs = biquadHighPass(fc, q, fs);
    }
    if(lpfActive) {
        const fc = masterEqLogInterp(cfg.LPF_FMAX, cfg.LPF_FMIN, pots[p.LPF_FREQ]);
        const q = masterEqLinInterp(cfg.FILTER_QMIN, cfg.FILTER_QMAX, pots[p.LPF_RES]);
        lpfCoeffs = biquadLowPass(fc, q, fs);
    }

    const kill = cfg.KILL_SWITCH;
    const anyKill = switches[kill.SUB] > 0.5 || switches[kill.KICK] > 0.5 ||
                    switches[kill.MID] > 0.5 || switches[kill.TOP] > 0.5;
    const crossoverMix = anyKill ? 1 : 0;
    const bandGain = [
        switches[kill.SUB]  > 0.5 ? 0 : 1,
        switches[kill.KICK] > 0.5 ? 0 : 1,
        switches[kill.MID]  > 0.5 ? 0 : 1,
        switches[kill.TOP]  > 0.5 ? 0 : 1
    ];

    for(let i = 0; i < n; i++) {
        const f = masterEqFreqs[i];
        let h = 1;

        for(let b = 0; b < 4; b++) {
            if(Math.abs(peGainDb[b]) > eps) {
                const fc = masterEqLogInterp(
                    cfg.MASTER_EQ_FMIN[b], cfg.MASTER_EQ_FMAX[b], peFreqPot[b]);
                const c = biquadPeaking(fc, peGainDb[b], cfg.MASTER_EQ_Q, fs);
                h *= biquadMagLinear(c, f, fs);
            }
        }

        for(let b = 0; b < cfg.GEQ_FREQS.length; b++) {
            if(Math.abs(geqGainDb[b]) > eps) {
                const c = biquadPeaking(cfg.GEQ_FREQS[b], geqGainDb[b], cfg.GEQ_Q, fs);
                h *= biquadMagLinear(c, f, fs);
            }
        }

        if(hpfCoeffs)
            h *= (1 - hpfMix) + hpfMix * biquadMagLinear(hpfCoeffs, f, fs);
        if(lpfCoeffs) {
            const hMid = h;
            h = hMid * ((1 - lpfMix) + lpfMix * biquadMagLinear(lpfCoeffs, f, fs));
        }

        if(Math.abs(btrimGainDb[0]) > eps)
            h *= biquadMagLinear(biquadLowShelf(cfg.KILL_FC[0], btrimGainDb[0], fs), f, fs);
        if(Math.abs(btrimGainDb[1]) > eps)
            h *= biquadMagLinear(
                biquadPeaking(cfg.BAND_TRIM_KICK_FREQ, btrimGainDb[1],
                              cfg.BAND_TRIM_KICK_Q, fs), f, fs);
        if(Math.abs(btrimGainDb[2]) > eps)
            h *= biquadMagLinear(
                biquadPeaking(cfg.BAND_TRIM_MID_FREQ, btrimGainDb[2],
                              cfg.BAND_TRIM_MID_Q, fs), f, fs);
        if(Math.abs(btrimGainDb[3]) > eps)
            h *= biquadMagLinear(biquadHighShelf(cfg.KILL_FC[2], btrimGainDb[3], fs), f, fs);

        if(crossoverMix > 0) {
            const hSub  = killBandMagLinear('sub',  f, fs, cfg);
            const hKick = killBandMagLinear('kick', f, fs, cfg);
            const hMid  = killBandMagLinear('mid',  f, fs, cfg);
            const hTop  = killBandMagLinear('top',  f, fs, cfg);
            const hKill = bandGain[0] * hSub + bandGain[1] * hKick +
                          bandGain[2] * hMid + bandGain[3] * hTop;
            h *= (1 - crossoverMix) + crossoverMix * hKill;
        }

        out[i] = 20 * Math.log10(Math.max(h, 1e-12));
    }
    return out;
}

/** Formats a frequency tick label for the master EQ X axis. */
export function formatMasterEqFreqLabel(hz) {
    if(hz >= 1000) {
        const k = hz / 1000;
        const n = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1);
        return n + 'kHz';
    }
    return hz + 'Hz';
}

/** Maps frequency (Hz) to canvas X using a log scale. */
export function masterEqFreqToX(f, plotX, plotW) {
    const cfg = MASTER_EQ_CONFIG;
    const t = (Math.log10(f) - Math.log10(cfg.FREQ_MIN)) /
              (Math.log10(cfg.FREQ_MAX) - Math.log10(cfg.FREQ_MIN));
    return plotX + t * plotW;
}

/** Maps dB value to canvas Y. */
export function masterEqDbToY(db, plotY, plotH) {
    const cfg = MASTER_EQ_CONFIG;
    const t = (cfg.Y_MAX_DB - db) / (cfg.Y_MAX_DB - cfg.Y_MIN_DB);
    return plotY + t * plotH;
}

/** Redraws the master EQ magnitude plot on the canvas. */
export function drawMasterEqCurve() {
    if(!getContext().masterEqCtx || !getContext().masterEqCanvas) return;

    const cfg = MASTER_EQ_CONFIG;
    const dpr = window.devicePixelRatio || 1;
    const cssW = getContext().masterEqCanvas.clientWidth || 800;
    const cssH = getContext().masterEqCanvas.clientHeight || 240;
    const pixW = Math.round(cssW * dpr);
    const pixH = Math.round(cssH * dpr);
    if(getContext().masterEqCanvas.width !== pixW || getContext().masterEqCanvas.height !== pixH) {
        getContext().masterEqCanvas.width = pixW;
        getContext().masterEqCanvas.height = pixH;
    }

    const ctx = getContext().masterEqCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const padL = 44;
    const padR = 14;
    const padT = 14;
    const padB = 40;
    const plotX = padL;
    const plotY = padT;
    const plotW = cssW - padL - padR;
    const plotH = cssH - padT - padB;

    ctx.fillStyle = '#fafafa';
    ctx.fillRect(plotX, plotY, plotW, plotH);

    ctx.strokeStyle = '#e8e8ec';
    ctx.lineWidth = 1;
    for(let db = cfg.Y_MIN_DB; db <= cfg.Y_MAX_DB; db += 6) {
        const y = masterEqDbToY(db, plotY, plotH);
        ctx.beginPath();
        ctx.moveTo(plotX, y);
        ctx.lineTo(plotX + plotW, y);
        ctx.stroke();
    }

    MASTER_EQ_FREQ_TICKS.forEach(hz => {
        const x = masterEqFreqToX(hz, plotX, plotW);
        ctx.beginPath();
        ctx.moveTo(x, plotY);
        ctx.lineTo(x, plotY + plotH);
        ctx.stroke();
    });

    ctx.strokeStyle = '#bbb';
    ctx.setLineDash([4, 4]);
    const y0 = masterEqDbToY(0, plotY, plotH);
    ctx.beginPath();
    ctx.moveTo(plotX, y0);
    ctx.lineTo(plotX + plotW, y0);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = '#ccc';
    ctx.strokeRect(plotX, plotY, plotW, plotH);

    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for(let db = cfg.Y_MIN_DB; db <= cfg.Y_MAX_DB; db += 6) {
        const y = masterEqDbToY(db, plotY, plotH);
        ctx.fillText((db > 0 ? '+' : '') + db + ' dB', padL - 6, y);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    MASTER_EQ_FREQ_TICKS.forEach((hz, i) => {
        const x = masterEqFreqToX(hz, plotX, plotW);
        const labelY = plotY + plotH + 6 + (i % 2) * 12;
        ctx.fillText(formatMasterEqFreqLabel(hz), x, labelY);
    });

    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for(let i = 0; i < cfg.CURVE_POINTS; i++) {
        const x = masterEqFreqToX(masterEqFreqs[i], plotX, plotW);
        const y = masterEqDbToY(getContext().masterEqCurveDb[i], plotY, plotH);
        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    for(let i = 0; i < cfg.CURVE_POINTS; i++) {
        const x = masterEqFreqToX(masterEqFreqs[i], plotX, plotW);
        const y = masterEqDbToY(getContext().masterEqCurveDb[i], plotY, plotH);
        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.lineTo(masterEqFreqToX(masterEqFreqs[cfg.CURVE_POINTS - 1], plotX, plotW),
               masterEqDbToY(cfg.Y_MIN_DB, plotY, plotH));
    ctx.lineTo(masterEqFreqToX(masterEqFreqs[0], plotX, plotW),
               masterEqDbToY(cfg.Y_MIN_DB, plotY, plotH));
    ctx.closePath();
    ctx.globalAlpha = 0.08;
    ctx.fill();
    ctx.globalAlpha = 1;
}

/** Recomputes and redraws the master EQ curve when inputs change. */
export function updateMasterEq() {
    computeMasterCurve(getContext().potValues, getContext().switchStates);
    if(getContext().currentTab === 2)
        drawMasterEqCurve();
}

/** Resizes the master EQ canvas to its CSS layout box. */
export function resizeMasterEqCanvas() {
    if(getContext().masterEqCanvas && getContext().currentTab === 2)
        drawMasterEqCurve();
}

export function buildMasterEqPane() {
    const pane = el('div', {id:'pane-master-eq', className:'tab-pane'});
    const card = el('div', {id:'master-eq-card', className:'card'});
    card.appendChild(cardTitle('Master EQ — frequency response'));

    const notice = el('div', {id:'master-eq-notice'});
    notice.textContent =
        'Theoretical representation — the curve is recalculated from pot values, not a measurement of the actual audio signal.';
    card.appendChild(notice);

    const caption = el('div', {id:'master-eq-caption'});
    caption.textContent =
        'Dry master chain: Parametric EQ → Graphic EQ → HPF/LPF → Band Trim → Kill switches. Excludes master gain and FX returns.';
    card.appendChild(caption);

    const wrap = el('div', {id:'master-eq-wrap'});
    getContext().masterEqCanvas = el('canvas', {id:'master-eq-canvas'});
    getContext().masterEqCanvas.width = 800;
    getContext().masterEqCanvas.height = 320;
    getContext().masterEqCtx = getContext().masterEqCanvas.getContext('2d');
    wrap.appendChild(getContext().masterEqCanvas);
    card.appendChild(wrap);
    pane.appendChild(card);

    computeMasterCurve(getContext().potValues, getContext().switchStates);

    return pane;
}
