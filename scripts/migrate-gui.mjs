/**
 * One-time migration: splits gui/_source_sketch.js into ES modules.
 * Run: node scripts/migrate-gui.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcPath = path.join(root, 'gui', '_source_sketch.js');
const guiRoot = path.join(root, 'gui');

const lines = fs.readFileSync(srcPath, 'utf8').split(/\r?\n/);

function sliceLines(start, end) {
    return lines.slice(start - 1, end).join('\n');
}

const STATE_VARS = [
    'potValues', 'switchStates', 'sirenState', 'audioLevels',
    'potMapping', 'switchMapping', 'configMeta', 'muxRawValues',
    'meterAnimId', 'meterVu', 'meterPeakDbs', 'meterDbs',
    'recentChanges', 'prevPotValues', 'prevPotValuesNormal',
    'prevSwitchStates', 'prevMuxRawValues', 'prevMuxRawValuesNormal',
    'consoleReady', 'consoleFilterMode', 'currentTab', 'mappingBuilt',
    'detectMode', 'masterEqCanvas', 'masterEqCtx', 'masterEqCurveDb',
    'sirenPresetPills', 'sirenNameEl', 'sirenGateEl', 'sirenModFill', 'sirenModLbl',
    'consoleList', 'consoleFilterBtns', 'switchPills',
    'downloadStatusEl', 'detectStatusEl',
    'lastBelaRxMs', 'belaRxFingerprint'
];

function transformState(code) {
    let out = code;
    for(const v of STATE_VARS) {
        out = out.replace(new RegExp(`^\\s*let\\s+${v}\\s*=[^;\\n]*;\\s*$`, 'gm'), '');
    }
    for(const v of STATE_VARS) {
        out = out.replace(new RegExp(`(?<![.\\w])${v}(?![\\w])`, 'g'), `getContext().${v}`);
    }
    return out.replace(/^    /gm, '');
}

function writeFile(relPath, content) {
    const file = path.join(guiRoot, relPath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    console.log('Wrote', relPath);
}

// config.js
const configLines = [
    sliceLines(23, 168),
    sliceLines(187, 190),
    sliceLines(193, 200),
    sliceLines(215, 215)
].join('\n')
    .replace(/^    /gm, '')
    .replace(/\bconst /g, 'export const ');
writeFile('config.js',
`/**
 * GUI constants — must match render.cpp / HardwareConfig.h / SoftwareConfig.h.
 */
${configLines}
`);

// state.js
writeFile('state.js',
`/** Runtime GUI state (mutable, shared across modules via context). */
import { MASTER_EQ_CONFIG } from './config.js';

/** Creates the initial mutable GUI state object. */
export function createState() {
    return {
        potValues: new Float32Array(58),
        switchStates: new Float32Array(9),
        sirenState: new Float32Array(3),
        audioLevels: new Float32Array(13),
        potMapping: null,
        switchMapping: null,
        configMeta: null,
        muxRawValues: null,
        meterSmooth: new Float32Array(13).fill(0),
        peakHoldLevel: new Float32Array(13).fill(0),
        peakHoldExpire: new Float64Array(13).fill(0),
        meterAnimId: null,
        meterVu: [],
        meterPeakDbs: [],
        meterDbs: [],
        recentChanges: [],
        prevPotValues: new Float32Array(58).fill(-1),
        prevPotValuesNormal: new Float32Array(58).fill(-1),
        prevSwitchStates: new Float32Array(9).fill(-1),
        prevMuxRawValues: null,
        prevMuxRawValuesNormal: null,
        consoleReady: false,
        consoleFilterMode: 'normal',
        currentTab: 0,
        mappingBuilt: false,
        detectMode: null,
        masterEqCanvas: null,
        masterEqCtx: null,
        masterEqCurveDb: new Float32Array(MASTER_EQ_CONFIG.CURVE_POINTS),
        sirenPresetPills: [],
        sirenNameEl: null,
        sirenGateEl: null,
        sirenModFill: null,
        sirenModLbl: null,
        consoleList: null,
        consoleFilterBtns: [],
        switchPills: [],
        downloadStatusEl: null,
        detectStatusEl: null,
        lastBelaRxMs: 0,
        belaRxFingerprint: ''
    };
}
`);

writeFile('context.js',
`/** Shared runtime context for all GUI modules. */
let _ctx = null;

/** Stores the active GUI state object. */
export function initContext(state) {
    _ctx = state;
}

/** Returns the active GUI state. */
export function getContext() {
    if(!_ctx) throw new Error('GUI context not initialised');
    return _ctx;
}
`);

writeFile('css.js',
`/** Injects all GUI styles into document head. */
${sliceLines(248, 714).replace(/^    /gm, '').replace('function injectCSS', 'export function injectCSS')}
`);

writeFile('dom/utils.js',
`/** DOM helpers and layout utilities. */
${[
    sliceLines(2530, 2544),
    sliceLines(2547, 2551),
    sliceLines(2553, 2557),
    sliceLines(2560, 2565),
    sliceLines(2568, 2570)
].join('\n\n').replace(/^    /gm, '').replace(/\bfunction /g, 'export function ')}
`);

writeFile('bela/connection.js',
`/** Bela WebSocket connection health and header badge. */
import { getContext } from '../context.js';
import { BELA_OFFLINE_TIMEOUT_MS, BELA_LAG_THRESHOLD_MS } from '../config.js';

${transformState([
    sliceLines(2448, 2454),
    sliceLines(2457, 2470),
    sliceLines(2473, 2484),
    sliceLines(2490, 2498),
    sliceLines(2501, 2503),
    sliceLines(2505, 2519)
].join('\n\n')).replace(/\bfunction /g, 'export function ')}
`);

writeFile('dom/masterEq.js',
`/** Master EQ theoretical frequency-response curve. */
import { getContext } from '../context.js';
import { MASTER_EQ_CONFIG, masterEqFreqs, MASTER_EQ_FREQ_TICKS } from '../config.js';
import { el, cardTitle } from './utils.js';

${transformState(sliceLines(1194, 1629)).replace(/\bfunction /g, 'export function ')}
`);

writeFile('dom/meters.js',
`/** Canvas VU meters tab. */
import { getContext } from '../context.js';
import {
    LEVEL_GROUPS, LEVEL_LABELS,
    VU_BOX_COUNT, VU_BOX_COUNT_RED, VU_BOX_COUNT_YELLOW,
    VU_BOX_GAP_FRACTION, VU_MAX, VU_CANVAS_W, VU_CANVAS_H,
    METER_ATTACK, METER_RELEASE, PEAK_HOLD_MS, PEAK_DECAY
} from '../config.js';
import { el, cardTitle } from './utils.js';

${transformState(sliceLines(890, 1105) + '\n\n' + sliceLines(2375, 2445)).replace(/\bfunction /g, 'export function ')}
`);

writeFile('dom/mapping.js',
`/** Mapping tab, auto-detect, config.json export. */
import { getContext } from '../context.js';
import {
    POT_NAMES, SWITCH_NAMES, MUX_POTS_PER_MUX, MUX_RAW_SIZE,
    CONFIG_META, I2C_BUS, DETECT_POT_MIN_DELTA
} from '../config.js';
import { el } from './utils.js';

${transformState(
    sliceLines(1109, 1190) + '\n\n' +
    sliceLines(1656, 2101) + '\n\n' +
    sliceLines(2108, 2239)
).replace(/\bfunction /g, 'export function ')}
`);

writeFile('dom/live.js',
`/** Live tab: siren, console, switches. */
import { getContext } from '../context.js';
import {
    SIREN_PRESETS, SWITCH_GROUPS, SWITCH_NAMES, POT_NAMES,
    CONSOLE_POT_MIN_DELTA_NORMAL, CONSOLE_POT_MIN_DELTA_DETAILED, MAX_CONSOLE
} from '../config.js';
import { el, cardTitle } from './utils.js';
import {
    muxRawIndex, getActiveMuxCount, isPotIgnored, isPotMapped, formatUnmappedPotLabel
} from './mapping.js';

${transformState(
    sliceLines(761, 882) + '\n\n' +
    sliceLines(2246, 2373)
).replace(/\bfunction /g, 'export function ')}
`);

writeFile('dom/shell.js',
`/** Top-level UI shell: header, tabs, tab switching. */
import { getContext } from '../context.js';
import { el, projectFileUrl } from './utils.js';
import { buildLivePane } from './live.js';
import { buildMetersPane, startMeterAnim, stopMeterAnim } from './meters.js';
import { buildMasterEqPane, drawMasterEqCurve } from './masterEq.js';
import { buildMappingPane, cancelDetect } from './mapping.js';

export function buildUI() {
${sliceLines(721, 757).replace(/^    /gm, '    ')}
}

export function switchTab(idx) {
${transformState(sliceLines(1636, 1650)).replace(/^export function switchTab[\s\S]*?\{/, '').replace(/\}$/, '')}
}
`);

// Fix shell.js switchTab - the replace above is wrong. Let me write shell manually
writeFile('dom/shell.js',
`/** Top-level UI shell: header, tabs, tab switching. */
import { getContext } from '../context.js';
import { el, projectFileUrl } from './utils.js';
import { buildLivePane } from './live.js';
import { buildMetersPane, startMeterAnim, stopMeterAnim } from './meters.js';
import { buildMasterEqPane, drawMasterEqCurve } from './masterEq.js';
import { buildMappingPane, cancelDetect } from './mapping.js';

/** Builds the full DOM tree (header, tabs, all panes). */
export function buildUI() {
    document.body.innerHTML = '';

    const root = el('div', {id:'bela-gui'});
    const topChrome = el('div', {id:'top-chrome'});

    const hdr = el('div', {id:'gui-header'});
    hdr.innerHTML =
        '<h1>Bela Preamp</h1>' +
        '<span class="badge" id="conn-badge">OFFLINE</span>' +
        '<span class="spacer"></span>';
    const logo = el('img', { id: 'gui-logo', alt: 'Fulla Vibes' });
    logo.src = projectFileUrl('LOGO.png');
    hdr.appendChild(logo);
    topChrome.appendChild(hdr);

    const tabBar = el('div', {id:'tab-bar'});
    ['Live','Meters','Master EQ','Mapping'].forEach((lbl, i) => {
        const btn = el('button', {className:'tab-btn' + (i===0?' active':'')});
        btn.textContent = lbl;
        btn.dataset.tab = i;
        btn.addEventListener('click', () => switchTab(i));
        tabBar.appendChild(btn);
    });
    topChrome.appendChild(tabBar);
    root.appendChild(topChrome);

    const content = el('div', {id:'tab-content'});
    content.appendChild(buildLivePane());
    content.appendChild(buildMetersPane());
    content.appendChild(buildMasterEqPane());
    content.appendChild(buildMappingPane());
    root.appendChild(content);

    document.body.appendChild(root);
}

/** Switches the active tab and starts/stops tab-specific animations. */
export function switchTab(idx) {
    const ctx = getContext();
    if(idx !== 3) cancelDetect();
    ctx.currentTab = idx;
    document.querySelectorAll('.tab-btn').forEach((b, i) =>
        b.classList.toggle('active', i === idx));
    document.querySelectorAll('.tab-pane').forEach((p, i) =>
        p.classList.toggle('active', i === idx));
    if(idx === 1) {
        ctx.meterVu.forEach(vu => { if(vu) vu.resize(); });
        startMeterAnim();
    } else {
        stopMeterAnim();
    }
    if(idx === 2)
        drawMasterEqCurve();
}
`);

writeFile('main.js',
`/**
 * Bela GUI entry — p5.js instance mode sketch factory.
 */
import { createState } from './state.js';
import { initContext, getContext } from './context.js';
import { injectCSS } from './css.js';
import { buildUI, switchTab } from './dom/shell.js';
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
`);

console.log('Migration complete. Run: npm install && npm run build:gui');
