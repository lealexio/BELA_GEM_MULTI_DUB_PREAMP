/**
 * Bela GUI entry — p5.js instance mode sketch factory.
 */
import { createState } from './state.js';
import { initContext, getContext } from './context.js';
import { injectCSS } from './css.js';
import { buildUI } from './dom/shell.js';
import { layoutTopChrome, hideP5Dom } from './dom/utils.js';
import { updateSiren, syncMicInputs } from './dom/live.js';
import { updateSampler } from './dom/sampler.js';
import { updateConsole, updateSwitches } from './dom/console.js';
import { startMeterAnim, syncCodecGains, updateClipIndicators, clearClipBadges } from './dom/meters.js';
import { TAB_LIVE } from './config.js';
import { isLiveTileOn } from './live-layout.js';
import { updateMasterEq, resizeMasterEqCanvas } from './dom/masterEq.js';
import { tryBuildMappingTable, updateDetectMode, fillRoutingFromConfigMeta } from './dom/mapping.js';
import {
    updateBelaRxWatchdog, isBelaConnected, updateBadge, updateTempBadge
} from './bela/connection.js';

export default function sketch(p) {
    initContext(createState());

    p.setup = function() {
        injectCSS();
        buildUI();
        layoutTopChrome();

        if(typeof p.noCanvas === 'function')
            p.noCanvas();
        else {
            const cnv = p.createCanvas(1, 1);
            cnv.elt.style.display = 'none';
        }
        hideP5Dom();

        window.addEventListener('resize', () => {
            layoutTopChrome();
            getContext().meterVu.forEach(vu => { if(vu) vu.resize(); });
            resizeMasterEqCanvas();
        });

        p.frameRate(20);
    };

    p.draw = function() {
        const ctx = getContext();
        if(typeof Bela === 'undefined') {
            updateBadge();
            updateTempBadge(undefined);
            clearClipBadges();
            return;
        }

        const b = Bela.data.buffers;
        updateBelaRxWatchdog(b);

        if(!isBelaConnected()) {
            updateBadge();
            updateTempBadge(undefined);
            clearClipBadges();
            return;
        }

        if(b[0]) {
            if(!ctx.consoleReady) {
                ctx.prevPotValues       = new Float32Array(b[0]);
                ctx.prevPotValuesNormal = new Float32Array(b[0]);
                ctx.prevSwitchStates    = new Float32Array(b[1] || ctx.switchStates);
                if(b[7]) {
                    ctx.prevMuxRawValues       = new Float32Array(b[7]);
                    ctx.prevMuxRawValuesNormal = new Float32Array(b[7]);
                }
                ctx.consoleReady = true;
            }
            ctx.potValues = b[0];
        }
        if(b[1]) ctx.switchStates = b[1];
        if(b[2]) ctx.sirenState   = b[2];
        if(b[3]) ctx.audioLevels  = b[3];
        // Buffer 10: sampler state [folderOk, count, playingSlot, isPlaying, playhead]
        if(b[10] && b[10].length >= 5) {
            ctx.samplerState = b[10];
            ctx.samplerStateLive = true;
        }
        // Buffer 11: packed sample names (static, resent periodically)
        if(b[11] && b[11].length && !ctx.samplerNamesBuilt) {
            ctx.samplerNamesBuf = Float32Array.from(b[11]);
        }
        if(b[7]) {
            if(!ctx.prevMuxRawValues) {
                ctx.prevMuxRawValues       = new Float32Array(b[7]);
                ctx.prevMuxRawValuesNormal = new Float32Array(b[7]);
            }
            ctx.muxRawValues = b[7];
        }
        if(b[4] && !ctx.potMapping) {
            ctx.potMapping = Float32Array.from(b[4]);
            tryBuildMappingTable();
        }
        if(b[5] && !ctx.switchMapping) {
            ctx.switchMapping = Float32Array.from(b[5]);
            tryBuildMappingTable();
        }
        if(b[6] && !ctx.configMeta) {
            ctx.configMeta = Float32Array.from(b[6]);
            fillRoutingFromConfigMeta();
        }
        // Buffer 6 also carries live mic/hpf flags — sync Live tab (no send back).
        if(b[6]) {
            ctx.configMeta = b[6];
            syncMicInputs(b[6]);
        }

        // Buffer 8: codec gain state — sync all connected clients (no send back to Bela).
        if(b[8]) syncCodecGains(b[8]);

        // Buffer 9: CPU temperature °C (polled ~2 s on Bela AuxTask).
        if(b[9] && b[9].length) updateTempBadge(b[9][0]);
        else updateTempBadge(undefined);

        if(ctx.consoleReady) updateConsole();
        updateSiren();
        updateSampler();
        updateSwitches();
        updateMasterEq();
        updateClipIndicators();
        updateBadge();

        if(ctx.currentTab === TAB_LIVE &&
           isLiveTileOn(ctx.liveLayoutPrefs, 'meters') && ctx.meterAnimId == null)
            startMeterAnim();
        if(ctx.detectMode) updateDetectMode();
    };
}
