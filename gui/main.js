/**
 * Bela GUI entry — p5.js instance mode sketch factory.
 */
import { createState } from './state.js';
import { initContext, getContext } from './context.js';
import { injectCSS } from './css.js';
import { buildUI } from './dom/shell.js';
import { layoutTopChrome, hideP5Dom } from './dom/utils.js';
import { updateSiren, updateSwitches, updateConsole } from './dom/live.js';
import { startMeterAnim } from './dom/meters.js';
import { updateMasterEq, resizeMasterEqCanvas } from './dom/masterEq.js';
import { tryBuildMappingTable, updateDetectMode } from './dom/mapping.js';
import {
    updateBelaRxWatchdog, isBelaConnected, updateBadge
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

        document.documentElement.style.margin = '0';
        document.documentElement.style.padding = '0';
        document.documentElement.style.width = '100%';
        document.documentElement.style.overflowX = 'hidden';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.width = '100%';
        document.body.style.overflowX = 'hidden';

        layoutTopChrome();
        window.addEventListener('resize', () => {
            layoutTopChrome();
            getContext().meterVu.forEach(vu => { if(vu) vu.resize(); });
            resizeMasterEqCanvas();
        });

        p.frameRate(20);
    };

    p.draw = function() {
        const ctx = getContext();
        if(typeof Bela === 'undefined') { updateBadge(); return; }

        const b = Bela.data.buffers;
        updateBelaRxWatchdog(b);

        if(!isBelaConnected()) {
            updateBadge();
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
        if(b[6] && !ctx.configMeta)
            ctx.configMeta = Float32Array.from(b[6]);

        if(ctx.consoleReady) updateConsole();
        updateSiren();
        updateSwitches();
        updateMasterEq();
        updateBadge();

        if(ctx.currentTab === 1 && ctx.meterAnimId == null) startMeterAnim();
        if(ctx.detectMode) updateDetectMode();
    };
}
