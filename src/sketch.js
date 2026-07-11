/**
 * Dub Preamp — Bela GUI (sketch.js)
 *
 * Runs at http://bela.local/gui/  (Bela GUI library, p5.js instance mode).
 *
 * Buffer index convention (Bela → JS, via gGui.sendBuffer):
 *   [0] Float32[58]      — pot values, kAllNamedPots order
 *   [1] Float32[9]       — switch states (0/1)
 *   [2] Float32[3]       — siren: [presetIdx, gate, mod]
 *   [3] Float32[13]      — audio peak levels
 *   [4] Float32[58×4]    — pot mapping [mux,pot,rev,cen]×58
 *   [5] Float32[9×3]     — switch mapping [pin,portB,rev]×9
 *   [6] Float32[N]       — config metadata (mux, routing, ignoredPots)
 */

var sketch = function(p) {

    // -----------------------------------------------------------------------
    // Constants — must match render.cpp / HardwareConfigData.cpp exactly
    // -----------------------------------------------------------------------

    /** Minimum pot travel (0–1) required to accept a detect hit. */
    const DETECT_POT_MIN_DELTA = 0.25;

    /** Console pot change thresholds — detailed catches ADC jitter, normal filters it. */
    const CONSOLE_POT_MIN_DELTA_DETAILED = 0.003;
    const CONSOLE_POT_MIN_DELTA_NORMAL   = 0.02;

    /** No fresh Bela data for this long → badge OFFLINE. */
    const BELA_OFFLINE_TIMEOUT_MS = 1000;
    /** Nominal GUI tick ~50 ms @ 20 fps; gap above this → badge LAG (orange). */
    const BELA_LAG_THRESHOLD_MS = 180;

    const SIREN_PRESETS = ['Wail', 'Whoop', 'Police', 'Scanner', 'Riotgun', 'Laser'];

    /** Pot names in kAllNamedPots order (58 entries). */
    const POT_NAMES = [
        // AUX1 — idx 0-5
        'AUX1_INPUT_GAIN','AUX1_EQ_MID','AUX1_EQ_LOW','AUX1_EQ_HIGH','AUX1_FX_SEND','AUX1_FX2_SEND',
        // AUX2 — idx 6-11
        'AUX2_INPUT_GAIN','AUX2_EQ_MID','AUX2_EQ_HIGH','AUX2_EQ_LOW','AUX2_FX_SEND','AUX2_FX2_SEND',
        // AUX3 — idx 12-17
        'AUX3_INPUT_GAIN','AUX3_EQ_LOW','AUX3_EQ_MID','AUX3_EQ_HIGH','AUX3_FX_SEND','AUX3_FX2_SEND',
        // AUX4 — idx 18-23
        'AUX4_INPUT_GAIN','AUX4_EQ_LOW','AUX4_EQ_MID','AUX4_EQ_HIGH','AUX4_FX_SEND','AUX4_FX2_SEND',
        // Master — idx 24
        'MASTER_GAIN',
        // Parametric EQ — idx 25-32
        'MASTER_EQ_SUB_FREQ','MASTER_EQ_SUB_GAIN',
        'MASTER_EQ_KICK_FREQ','MASTER_EQ_KICK_GAIN',
        'MASTER_EQ_MID_FREQ','MASTER_EQ_MID_GAIN',
        'MASTER_EQ_TOP_FREQ','MASTER_EQ_TOP_GAIN',
        // Filters — idx 33-36
        'MASTER_HPF_FREQ','MASTER_HPF_RES','MASTER_LPF_FREQ','MASTER_LPF_RES',
        // Band Trim — idx 37-40
        'BTRIM_SUB','BTRIM_KICK','BTRIM_MID','BTRIM_TOP',
        // Siren — idx 41-45
        'SIREN_TYPE','SIREN_MOD','SIREN_GAIN','SIREN_FX_SEND','SIREN_FX2_SEND',
        // Graphic EQ 12 bands — idx 46-57
        'GEQ_40HZ','GEQ_60HZ','GEQ_80HZ','GEQ_100HZ','GEQ_125HZ','GEQ_250HZ',
        'GEQ_500HZ','GEQ_1KHZ','GEQ_2KHZ','GEQ_4KHZ','GEQ_8KHZ','GEQ_16KHZ'
    ]; // 58 entries

    /** Switch names matching kGuiSwitchRefs[] order in render.cpp. */
    const SWITCH_NAMES = [
        'KILL_SUB','KILL_KICK','KILL_MID','KILL_TOP',
        'FX_FILTER_MIDS','FX_FILTER_TOPS','FX2_FILTER_TOPS','FX2_FILTER_MIDS',
        'SIREN_TRIGGER'
    ]; // 9 entries

    /** Human-readable labels for the 13 audio peak channels. */
    const LEVEL_LABELS = [
        'IN 1','IN 2','IN 3','IN 4',
        'FX Ret 1','FX Ret 2',
        'Master','FX Snd 1','FX Snd 2',
        'VU SUB','VU KICK','VU MID','VU TOP'
    ];

    const LEVEL_GROUPS = [
        { label: 'INPUTS',  indices: [0,1,2,3,4,5]        },
        { label: 'OUTPUTS', indices: [6,7,8,9,10,11,12]   }
    ];

    /** I2C bus string — must match kI2cBus in HardwareConfig.h. */
    const I2C_BUS = '/dev/i2c-1';

    /** Layout of Bela → JS buffer [6] (config metadata for JSON download). */
    const CONFIG_META = {
        ACTIVE_MUX: 0, SCALE: 1, POT_MAX: 2, POT_MIN: 3, MCP_ADDR: 4,
        MASTER_COUNT: 5, MASTER_0: 6, MASTER_1: 7,
        FX1_SEND: 8, FX2_SEND: 9,
        VU_SUB: 10, VU_KICK: 11, VU_MID: 12, VU_TOP: 13,
        FX1_RET: 14, FX2_RET: 15,
        AUX1: 16, AUX2: 17, AUX3: 18, AUX4: 19,
        IGNORED_COUNT: 20, IGNORED_BASE: 21
    };

    // -----------------------------------------------------------------------
    // Runtime state
    // -----------------------------------------------------------------------

    let potValues     = new Float32Array(58);
    let switchStates  = new Float32Array(9);
    let sirenState    = new Float32Array(3);   // [presetIdx, gate, mod]
    let audioLevels   = new Float32Array(13);
    let potMapping    = null;                  // Float32Array(58×4)
    let switchMapping = null;                  // Float32Array(9×3)
    let configMeta    = null;                  // Float32Array — mux/routing/ignoredPots

    // Peak-hold for meters (JS-side, display only)
    const peakHold      = new Float32Array(13).fill(0);
    const peakHoldTimer = new Int32Array(13).fill(0);
    const PEAK_HOLD_FRAMES = 45; // ~0.75 s at 60 fps
    const PEAK_DECAY         = 0.82; // fast peak-line fall after hold expires

    // Cached meter DOM nodes (avoid getElementById every frame)
    const meterFills = [];
    const meterPeaks = [];
    const meterDbs   = [];

    // Console tracking
    let recentChanges         = [];
    let prevPotValues         = new Float32Array(58).fill(-1);
    let prevPotValuesNormal   = new Float32Array(58).fill(-1);
    let prevSwitchStates      = new Float32Array(9).fill(-1);
    let consoleReady          = false;
    let consoleFilterMode     = 'normal';
    const MAX_CONSOLE         = 10;

    let currentTab   = 0;
    let mappingBuilt = false;

    /** Active detect session, or null. */
    let detectMode     = null;

    // Cached DOM references
    let sirenPresetPills = [];
    let sirenNameEl  = null;
    let sirenGateEl  = null;
    let sirenModFill = null;
    let sirenModLbl  = null;
    let consoleList       = null;
    let consoleFilterBtns = [];
    let switchPills  = [];
    let downloadStatusEl = null;
    let detectStatusEl   = null;

    // Bela connection watchdog (buffers stay cached after stop — need fresh-data detection)
    let lastBelaRxMs      = 0;
    let belaRxFingerprint = '';

    // -----------------------------------------------------------------------
    // CSS injection
    // -----------------------------------------------------------------------

    function injectCSS() {
        const s = document.createElement('style');
        s.textContent = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{
    width:100%;
    margin:0;
    padding:0;
    overflow-x:hidden;
}
body{
    font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
    background:#f2f2f2;color:#1a1a1a;font-size:14px;
}
/* p5.js injects <main> + canvas for draw() — not used by our DOM UI */
body > main{
    display:none!important;
    visibility:hidden!important;
    width:0!important;height:0!important;
    overflow:hidden!important;position:absolute!important;
    pointer-events:none!important;
}
#bela-gui{
    display:flex;flex-direction:column;
    width:100%;max-width:100%;
    height:100vh;overflow-x:hidden;
}

/* Fixed top chrome — full viewport width without 100vw (no horizontal scroll). */
#top-chrome{
    position:fixed;top:0;left:0;right:0;
    z-index:100;
}

/* --- Header --- */
#gui-header{
    background:#1a1a2e;color:#fff;
    padding:8px 18px;display:flex;align-items:center;gap:10px;
    width:100%;
}
#gui-header h1{font-size:16px;font-weight:700;letter-spacing:.05em}
#gui-header .spacer{flex:1}
#gui-logo{
    height:42px;width:auto;
    mix-blend-mode:screen; /* blacks become transparent on the dark header */
    opacity:.92;
}
.badge{
    background:#888;color:#fff;font-size:10px;font-weight:700;
    padding:2px 8px;border-radius:10px;letter-spacing:.06em;
}
.badge.live{background:#27ae60}
.badge.lag{background:#e67e22}

/* --- Tab bar --- */
#tab-bar{
    display:flex;background:#fff;
    border-bottom:2px solid #e0e0e0;
    width:100%;
}
.tab-btn{
    padding:11px 22px;font-size:13px;font-weight:600;color:#777;
    cursor:pointer;border:none;background:none;
    border-bottom:3px solid transparent;margin-bottom:-2px;
    transition:color .15s,border-color .15s;letter-spacing:.03em;
}
.tab-btn:hover{color:#333}
.tab-btn.active{color:#1a1a2e;border-bottom-color:#e74c3c}

/* --- Content --- */
#tab-content{
    flex:1;
    padding:14px;
    overflow-y:auto;
    overflow-x:hidden;
    max-width:100%;
    /* Forces the flex child to shrink and scroll rather than expand the parent */
    min-height:0;
}
.tab-pane{display:none;max-width:100%}
.tab-pane.active{display:block}

/* --- Cards --- */
.card{
    background:#fff;border-radius:8px;
    box-shadow:0 1px 4px rgba(0,0,0,.09);
    padding:14px;margin-bottom:12px;
}
.card-title{
    font-size:10px;font-weight:700;letter-spacing:.1em;
    text-transform:uppercase;color:#999;margin-bottom:10px;
}

/* --- Siren --- */
#siren-body{display:flex;flex-direction:column;gap:12px}
#siren-hero{
    background:#f7f7f9;border-radius:6px;padding:12px 14px;
    border-left:3px solid #1a1a2e;
}
#siren-hero-top{
    display:flex;align-items:center;justify-content:space-between;gap:10px;
}
#siren-name{font-size:26px;font-weight:700;color:#1a1a2e;line-height:1.1}
#siren-gate{
    display:flex;align-items:center;gap:6px;flex-shrink:0;
}
#siren-gate-dot{
    display:inline-block;width:10px;height:10px;border-radius:50%;
    background:#ccc;
    transition:background .1s,box-shadow .1s;
}
#siren-gate-dot.on{background:#e74c3c;box-shadow:0 0 8px rgba(231,76,60,.8)}
.gate-lbl{font-size:11px;font-weight:700;color:#999;letter-spacing:.04em}
#siren-mod-row{
    display:flex;align-items:center;gap:10px;margin-top:10px;
}
.siren-mod-label{
    flex:0 0 auto;font-size:10px;font-weight:700;color:#888;
    letter-spacing:.05em;text-transform:uppercase;
}
#siren-mod-track{
    flex:1;height:6px;background:#e0e0e0;
    border-radius:3px;overflow:hidden;min-width:0;
}
#siren-mod-fill{
    display:block;height:100%;width:0%;background:#1a1a2e;
    border-radius:3px;transition:width .04s;
}
#siren-mod-lbl{
    flex:0 0 36px;font-size:11px;font-weight:700;color:#666;
    font-family:monospace;text-align:right;
}
#siren-presets{
    display:flex;gap:4px;flex-wrap:nowrap;width:100%;
}
.spreset{
    flex:1 1 0;min-width:0;
    padding:7px 2px;border-radius:6px;
    background:#eee;border:1px solid #ddd;
    font-size:9px;font-weight:700;color:#888;
    text-align:center;letter-spacing:.02em;
    line-height:1.2;white-space:nowrap;overflow:hidden;
    text-overflow:ellipsis;
    transition:background .15s,color .15s,border-color .15s,box-shadow .15s;
}
.spreset.active{
    background:#1a1a2e;border-color:#1a1a2e;color:#fff;
}
.spreset.active.gate{
    border-color:#e74c3c;
    box-shadow:0 0 10px rgba(231,76,60,.55);
}

/* --- Console --- */
.console-header{
    display:flex;align-items:center;justify-content:space-between;
    gap:8px;margin-bottom:10px;
}
.console-header .card-title{margin-bottom:0}
.console-filter{display:flex;gap:4px}
.console-filter-btn{
    padding:3px 10px;font-size:10px;font-weight:700;color:#888;
    cursor:pointer;border:1px solid #ddd;border-radius:10px;
    background:#f5f5f5;letter-spacing:.03em;
    transition:background .1s,color .1s,border-color .1s;
}
.console-filter-btn:hover{color:#333;border-color:#bbb}
.console-filter-btn.active{
    background:#1a1a2e;color:#fff;border-color:#1a1a2e;
}
#console-list{list-style:none}
.crow{
    display:flex;align-items:center;gap:8px;
    padding:4px 0;border-bottom:1px solid #f0f0f0;
}
.crow:last-child{border-bottom:none}
.crow.empty .cname,
.crow.empty .cval{color:transparent}
.cname{
    flex:0 0 175px;font-family:monospace;font-size:11px;
    font-weight:600;color:#1a1a2e;white-space:nowrap;overflow:hidden;
}
.ctrack{flex:1;height:5px;background:#eee;border-radius:3px;overflow:hidden}
.cfill{
    display:block;height:100%;min-width:0;
    background:#1a1a2e;border-radius:3px;
    transition:width .15s ease;
}
.crow.sw .cfill{background:#e74c3c}
.crow.empty .ctrack{background:#ececec}
.crow.empty .cfill-loading{
    width:20%;background:#999;
    transition:none;
    animation:consoleBarFade 2s ease-in-out infinite;
    animation-delay:calc(var(--slot, 0) * 0.15s);
}
@keyframes consoleBarFade{
    0%,100%{width:12%;opacity:.3}
    50%{width:58%;opacity:.85}
}
.cval{
    flex:0 0 46px;text-align:right;font-family:monospace;
    font-size:11px;color:#777;
}

/* --- Switch pills --- */
#sw-pills{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.sw-pill{
    padding:4px 11px;border-radius:12px;font-size:11px;font-weight:700;
    background:#eee;color:#888;letter-spacing:.03em;
    transition:background .1s,color .1s;
}
.sw-pill.on{background:#1a1a2e;color:#fff}
.sw-pill.kill.on{background:#e74c3c;color:#fff}

/* --- Meters --- */
#meters-wrap{display:flex;flex-direction:column;gap:0}
.meter-group{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;padding:4px 0}
.meter-ch{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:46px}
.meter-bar{
    width:30px;height:150px;background:#e8e8e8;border-radius:4px;
    overflow:hidden;position:relative;
    display:flex;flex-direction:column;justify-content:flex-end;
}
.meter-fill{
    width:100%;height:0%;border-radius:4px 4px 0 0;
}
.meter-peak{
    position:absolute;left:2px;right:2px;height:2px;
    background:#e74c3c;bottom:0%;pointer-events:none;
    border-radius:2px;
}
.meter-lbl{font-size:9px;font-weight:700;color:#666;text-align:center;letter-spacing:.02em}
.meter-db{font-size:9px;color:#999;font-family:monospace;min-width:36px;text-align:center}

/* --- Mapping --- */
#mapping-note{
    font-size:11px;color:#856404;background:#fffbe6;
    border-left:3px solid #f39c12;padding:8px 12px;
    border-radius:0 4px 4px 0;margin-bottom:12px;
}
#mapping-note a{color:#1a5276;font-weight:700;text-decoration:underline}
#mapping-note a:hover{color:#0d3d56}
#mapping-conflicts{
    display:none;font-size:12px;color:#922;
    background:#fdecea;border-left:3px solid #e74c3c;
    padding:8px 12px;border-radius:0 4px 4px 0;margin-bottom:12px;
}
#mapping-conflicts.show{display:block}
#mapping-conflicts ul{margin:6px 0 0 18px;padding:0}
#mapping-conflicts li{margin:2px 0}
.mtable tr.dup-conflict td{background:#fff5f5}
.mtable tr.dup-conflict input[type=number],
.mtable tr.dup-conflict select{border-color:#e74c3c;background:#fffafa}
#detect-status{
    display:none;font-size:12px;color:#1a5276;
    background:#eaf4fb;border-left:3px solid #2980b9;
    padding:8px 12px;border-radius:0 4px 4px 0;margin-bottom:12px;
}
#detect-status.show{display:block}
#detect-status.err{color:#922;background:#fdecea;border-left-color:#e74c3c}
.mtable tr.row-detecting td{
    background:#fff8e6;
    animation:detectPulse 0.9s ease-in-out infinite alternate;
}
@keyframes detectPulse{
    from{background:#fff8e6}
    to{background:#ffe9a8}
}
.btn-detect-row{
    display:block;width:100%;margin:0 auto;
    padding:4px 2px;background:#2980b9;color:#fff;
    border:none;border-radius:4px;font-size:9px;font-weight:700;
    cursor:pointer;letter-spacing:.02em;white-space:nowrap;
    line-height:1.3;
}
.btn-detect-row:hover{background:#1f6391}
.btn-detect-row:disabled{background:#ccc;cursor:default}
.btn-detect-row.detect-active{
    background:#fff;color:#e74c3c;border:2px solid #e74c3c;
    font-size:12px;padding:2px 0;
}
.btn-detect-row.detect-active:hover{background:#fdecea}
#pane-mapping{max-width:100%}
.mtable-wrap{
    width:100%;max-width:100%;
    margin-bottom:4px;
}
.mtable{
    width:100%;max-width:100%;
    table-layout:fixed;
    border-collapse:collapse;
    font-size:12px;
}
.mtable col.col-name{width:32%}
.mtable col.col-num{width:10%}
.mtable col.col-check{width:9%}
.mtable col.col-port{width:11%}
.mtable col.col-detect{width:15%}
.mtable th,.mtable td{
    overflow:hidden;
    vertical-align:middle;
}
.mtable th.detect-col,
.mtable td.detect-cell{
    text-align:center;
    padding:4px 3px!important;
}
.mtable th.detect-col{
    font-size:9px;line-height:1.2;text-align:center;
    letter-spacing:.03em;white-space:normal;
    word-break:break-word;
}
.mtable th.col-check,.mtable td.col-check{text-align:center}
#mapping-toolbar{
    display:flex;align-items:center;gap:12px;
    margin-bottom:14px;flex-wrap:wrap;
}
#btn-download{
    padding:9px 22px;background:#1a1a2e;color:#fff;
    border:none;border-radius:5px;font-size:13px;font-weight:600;
    cursor:pointer;letter-spacing:.03em;transition:background .15s;
}
#btn-download:hover{background:#2c2c54}
#download-status{font-size:12px;font-weight:600;color:#27ae60}
#download-status.err{color:#e74c3c}
.msec-title{
    font-size:11px;font-weight:700;text-transform:uppercase;
    letter-spacing:.08em;color:#999;margin:14px 0 7px;
}
.mtable th{
    background:#f5f5f5;text-align:left;
    padding:6px 6px;font-weight:700;
    border-bottom:2px solid #ddd;color:#666;
    font-size:10px;letter-spacing:.05em;text-transform:uppercase;
}
.mtable td{padding:4px 6px;border-bottom:1px solid #f2f2f2}
.mtable tr:hover td{background:#fafafa}
.mtable input[type=number]{
    width:100%;min-width:0;max-width:100%;
    padding:3px 4px;border:1px solid #ddd;
    border-radius:4px;font-size:12px;font-family:inherit;
}
.mtable input[type=checkbox]{width:16px;height:16px;cursor:pointer;margin:0 auto;display:block}
.mtable select{
    width:100%;min-width:0;max-width:100%;
    padding:3px 4px;border:1px solid #ddd;
    border-radius:4px;font-size:12px;font-family:inherit;
}
.pname{
    font-family:monospace;font-size:11px;
    font-weight:700;color:#1a1a2e;
    white-space:nowrap;text-overflow:ellipsis;overflow:hidden;
}
.loading-cell{font-style:italic;color:#bbb;padding:10px}

/* --- Responsive --- */
@media(min-width:580px){
    #tab-content{padding:18px}
    #live-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
}
@media(max-width:720px){
    .mtable col.col-name{width:26%}
    .mtable col.col-num{width:11%}
    .mtable col.col-check{width:10%}
    .mtable col.col-port{width:12%}
    .mtable col.col-detect{width:16%}
    .mtable th,.mtable td{padding-left:4px;padding-right:4px}
    .mtable th{font-size:9px}
    .mtable input[type=number],.mtable select{font-size:11px}
}
@media(min-width:860px){
    .meter-bar{height:190px}
    .meter-ch{min-width:52px}
}
        `;
        document.head.appendChild(s);
    }

    // -----------------------------------------------------------------------
    // DOM construction
    // -----------------------------------------------------------------------

    function buildUI() {
        document.body.innerHTML = '';

        const root = el('div', {id:'bela-gui'});
        const topChrome = el('div', {id:'top-chrome'});

        // Header
        const hdr = el('div', {id:'gui-header'});
        hdr.innerHTML =
            '<h1>Bela Preamp</h1>' +
            '<span class="badge" id="conn-badge">OFFLINE</span>' +
            '<span class="spacer"></span>';
        const logo = el('img', { id: 'gui-logo', alt: 'Fulla Vibes' });
        logo.src = projectFileUrl('LOGO.png');
        hdr.appendChild(logo);
        topChrome.appendChild(hdr);

        // Tab bar
        const tabBar = el('div', {id:'tab-bar'});
        ['Live','Meters','Mapping'].forEach((lbl, i) => {
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
        content.appendChild(buildMappingPane());
        root.appendChild(content);

        document.body.appendChild(root);
    }

    // ---- Live tab ----------------------------------------------------------

    function buildLivePane() {
        const pane = el('div', {id:'pane-live', className:'tab-pane active'});
        const grid = el('div', {id:'live-grid'});

        // Siren card
        const sirenCard = el('div', {className:'card'});
        sirenCard.appendChild(cardTitle('Siren'));

        const sirenBody = el('div', {id:'siren-body'});

        const hero = el('div', {id:'siren-hero'});
        hero.innerHTML = `
            <div id="siren-hero-top">
                <div id="siren-name">—</div>
                <div id="siren-gate">
                    <span id="siren-gate-dot"></span>
                    <span class="gate-lbl">Gate</span>
                </div>
            </div>
            <div id="siren-mod-row">
                <span class="siren-mod-label">Mod</span>
                <div id="siren-mod-track"><div id="siren-mod-fill"></div></div>
                <span id="siren-mod-lbl">0%</span>
            </div>
        `;
        sirenBody.appendChild(hero);

        const presetsDiv = el('div', {id:'siren-presets'});
        sirenPresetPills = [];
        SIREN_PRESETS.forEach((name) => {
            const pill = el('div', {className:'spreset'});
            pill.textContent = name;
            pill.title = name;
            presetsDiv.appendChild(pill);
            sirenPresetPills.push(pill);
        });
        sirenBody.appendChild(presetsDiv);
        sirenCard.appendChild(sirenBody);

        sirenNameEl  = hero.querySelector('#siren-name');
        sirenGateEl  = hero.querySelector('#siren-gate-dot');
        sirenModFill = hero.querySelector('#siren-mod-fill');
        sirenModLbl  = hero.querySelector('#siren-mod-lbl');

        // Console card
        const consoleCard = el('div', {className:'card'});
        const consoleHdr = el('div', {className:'console-header'});
        consoleHdr.appendChild(cardTitle('Console — last change'));
        const filterBar = el('div', {className:'console-filter'});
        consoleFilterBtns = [];
        [
            { mode: 'normal',   label: 'Normal'   },
            { mode: 'detailed', label: 'Détaillé' }
        ].forEach(({ mode, label }) => {
            const btn = el('button', {
                type: 'button',
                className: 'console-filter-btn' + (mode === consoleFilterMode ? ' active' : '')
            });
            btn.textContent = label;
            btn.dataset.mode = mode;
            btn.addEventListener('click', () => setConsoleFilterMode(mode));
            filterBar.appendChild(btn);
            consoleFilterBtns.push(btn);
        });
        consoleHdr.appendChild(filterBar);
        consoleCard.appendChild(consoleHdr);
        consoleList = el('ul', {id:'console-list'});
        consoleCard.appendChild(consoleList);
        renderConsole();

        grid.appendChild(sirenCard);
        grid.appendChild(consoleCard);
        pane.appendChild(grid);

        // Switches card (full width below grid)
        const swCard = el('div', {className:'card'});
        swCard.appendChild(cardTitle('Switches'));
        const pills = el('div', {id:'sw-pills'});
        switchPills = [];
        SWITCH_NAMES.forEach((name, i) => {
            const killNames = ['KILL_SUB','KILL_KICK','KILL_MID','KILL_TOP'];
            const isKill = killNames.includes(name);
            const pill = el('div', {className:'sw-pill' + (isKill?' kill':'')});
            pill.textContent = name.replace(/_/g, '\u202F');
            pills.appendChild(pill);
            switchPills.push(pill);
        });
        swCard.appendChild(pills);
        pane.appendChild(swCard);

        return pane;
    }

    // ---- Meters tab --------------------------------------------------------

    function buildMetersPane() {
        const pane = el('div', {id:'pane-meters', className:'tab-pane'});
        const wrap = el('div', {id:'meters-wrap'});

        LEVEL_GROUPS.forEach(group => {
            const card = el('div', {className:'card'});
            card.appendChild(cardTitle(group.label));
            const row = el('div', {className:'meter-group'});

            group.indices.forEach(idx => {
                const ch = el('div', {className:'meter-ch'});

                const bar = el('div', {className:'meter-bar'});
                const fill = el('div', {className:'meter-fill', id:'mf-'+idx});
                fill.style.cssText = 'height:0%;background:#27ae60';
                const peak = el('div', {className:'meter-peak', id:'mp-'+idx});
                peak.style.bottom = '0%';
                bar.appendChild(fill);
                bar.appendChild(peak);

                const lbl = el('div', {className:'meter-lbl'});
                lbl.textContent = LEVEL_LABELS[idx];

                const dbv = el('div', {className:'meter-db', id:'md-'+idx});
                dbv.textContent = '-\u221e';

                meterFills[idx] = fill;
                meterPeaks[idx] = peak;
                meterDbs[idx]   = dbv;

                ch.appendChild(bar);
                ch.appendChild(lbl);
                ch.appendChild(dbv);
                row.appendChild(ch);
            });

            card.appendChild(row);
            wrap.appendChild(card);
        });

        pane.appendChild(wrap);
        return pane;
    }

    // ---- Mapping tab -------------------------------------------------------

    function buildMappingPane() {
        const pane = el('div', {id:'pane-mapping', className:'tab-pane'});

        const note = el('div', {id:'mapping-note'});
        note.innerHTML =
            'Current mapping loaded from config.json on the Bela. ' +
            'Edit the values below, then download the file — ' +
            'replace config.json in the project folder and restart. ' +
            '<a href="http://bela.local/" target="_blank" rel="noopener noreferrer">Open Bela IDE</a>';
        pane.appendChild(note);

        const conflicts = el('div', {id:'mapping-conflicts'});
        conflicts.innerHTML = '<strong>Mapping conflicts</strong><ul id="mapping-conflicts-list"></ul>';
        pane.appendChild(conflicts);

        const detectBanner = el('div', {id:'detect-status'});
        pane.appendChild(detectBanner);

        const toolbar = el('div', {id:'mapping-toolbar'});
        const btn = el('button', {id:'btn-download'});
        btn.textContent = 'Download config.json';
        btn.addEventListener('click', downloadConfigJson);
        toolbar.appendChild(btn);

        downloadStatusEl = el('span', {id:'download-status'});
        toolbar.appendChild(downloadStatusEl);
        detectStatusEl = detectBanner;
        pane.appendChild(toolbar);

        // Pots table
        const potTitle = el('div', {className:'msec-title'});
        potTitle.textContent = 'Potentiometers';
        pane.appendChild(potTitle);

        const potWrap = el('div', {className:'mtable-wrap'});
        const potTbl = el('table', {className:'mtable', id:'pot-table'});
        potTbl.innerHTML = `
            <colgroup>
                <col class="col-name">
                <col class="col-num"><col class="col-num">
                <col class="col-check"><col class="col-check">
                <col class="col-detect">
            </colgroup>
            <thead><tr>
                <th>Name</th><th>MUX</th><th>Channel</th>
                <th class="col-check">Reversed</th><th class="col-check">Centered</th>
                <th class="detect-col">Auto detect</th>
            </tr></thead>
            <tbody id="pot-tbody">
                <tr><td colspan="6" class="loading-cell">Waiting for connection…</td></tr>
            </tbody>`;
        potWrap.appendChild(potTbl);
        pane.appendChild(potWrap);

        // Switches table
        const swTitle = el('div', {className:'msec-title'});
        swTitle.textContent = 'Switches (MCP23017)';
        pane.appendChild(swTitle);

        const swWrap = el('div', {className:'mtable-wrap'});
        const swTbl = el('table', {className:'mtable', id:'sw-table'});
        swTbl.innerHTML = `
            <colgroup>
                <col class="col-name">
                <col class="col-num"><col class="col-port">
                <col class="col-check">
                <col class="col-detect">
            </colgroup>
            <thead><tr>
                <th>Name</th><th>Pin</th><th>Port</th>
                <th class="col-check">Reversed</th>
                <th class="detect-col">Auto map</th>
            </tr></thead>
            <tbody id="sw-tbody">
                <tr><td colspan="5" class="loading-cell">Waiting for connection…</td></tr>
            </tbody>`;
        swWrap.appendChild(swTbl);
        pane.appendChild(swWrap);

        return pane;
    }

    // -----------------------------------------------------------------------
    // Tab switching
    // -----------------------------------------------------------------------

    function switchTab(idx) {
        if(idx !== 2) cancelDetect();
        currentTab = idx;
        document.querySelectorAll('.tab-btn').forEach((b, i) =>
            b.classList.toggle('active', i === idx));
        document.querySelectorAll('.tab-pane').forEach((p, i) =>
            p.classList.toggle('active', i === idx));
    }

    // -----------------------------------------------------------------------
    // Mapping table population (runs once when buffers 4+5 both arrive)
    // -----------------------------------------------------------------------

    function tryBuildMappingTable() {
        if(mappingBuilt || !potMapping || !switchMapping) return;
        mappingBuilt = true;

        const ptbody = document.getElementById('pot-tbody');
        if(ptbody) {
            ptbody.innerHTML = '';
            POT_NAMES.forEach((name, i) => {
                const mux = Math.round(potMapping[i*4+0]);
                const pot = Math.round(potMapping[i*4+1]);
                const rev = potMapping[i*4+2] > 0.5;
                const cen = potMapping[i*4+3] > 0.5;
                const tr = document.createElement('tr');
                tr.dataset.mapTable = 'pot';
                tr.dataset.mapIndex = String(i);
                tr.innerHTML =
                    `<td class="pname" title="${name}">${name}</td>` +
                    `<td><input type="number" min="0" max="3"  value="${mux}" ` +
                    `data-i="${i}" data-f="mux" class="pi"></td>` +
                    `<td><input type="number" min="0" max="15" value="${pot}" ` +
                    `data-i="${i}" data-f="pot" class="pi"></td>` +
                    `<td class="col-check"><input type="checkbox" ${rev?'checked':''} ` +
                    `data-i="${i}" data-f="rev" class="pi"></td>` +
                    `<td class="col-check"><input type="checkbox" ${cen?'checked':''} ` +
                    `data-i="${i}" data-f="cen" class="pi"></td>` +
                    `<td class="detect-cell"></td>`;
                tr.querySelector('.detect-cell').appendChild(createDetectButton('pot', i));
                ptbody.appendChild(tr);
            });
        }

        const stbody = document.getElementById('sw-tbody');
        if(stbody) {
            stbody.innerHTML = '';
            SWITCH_NAMES.forEach((name, i) => {
                const pin   = Math.round(switchMapping[i*3+0]);
                const portB = switchMapping[i*3+1] > 0.5;
                const rev   = switchMapping[i*3+2] > 0.5;
                const tr = document.createElement('tr');
                tr.dataset.mapTable = 'sw';
                tr.dataset.mapIndex = String(i);
                tr.innerHTML =
                    `<td class="pname" title="${name}">${name}</td>` +
                    `<td><input type="number" min="0" max="7" value="${pin}" ` +
                    `data-i="${i}" data-f="pin" class="si"></td>` +
                    `<td><select data-i="${i}" data-f="port" class="si">` +
                    `<option value="0"${!portB?' selected':''}>A</option>` +
                    `<option value="1"${portB?' selected':''}>B</option></select></td>` +
                    `<td class="col-check"><input type="checkbox" ${rev?'checked':''} ` +
                    `data-i="${i}" data-f="rev" class="si"></td>` +
                    `<td class="detect-cell"></td>`;
                tr.querySelector('.detect-cell').appendChild(createDetectButton('sw', i));
                stbody.appendChild(tr);
            });
        }

        document.querySelectorAll('.pi, .si').forEach(inp => {
            inp.addEventListener('input',  updateMappingConflicts);
            inp.addEventListener('change', updateMappingConflicts);
        });
        updateMappingConflicts();
    }

    /**
     * Highlights rows and lists groups that share the same MUX/channel (pots)
     * or port/pin (switches).
     */
    function updateMappingConflicts() {
        if(!mappingBuilt) return;

        document.querySelectorAll('#pot-tbody tr, #sw-tbody tr').forEach(tr =>
            tr.classList.remove('dup-conflict'));

        const messages = [];

        // Pots — duplicate MUX + channel
        const potGroups = new Map();
        for(let i = 0; i < POT_NAMES.length; i++) {
            const muxInp = document.querySelector(`.pi[data-i="${i}"][data-f="mux"]`);
            const potInp = document.querySelector(`.pi[data-i="${i}"][data-f="pot"]`);
            if(!muxInp || !potInp) continue;
            const mux = parseInt(muxInp.value, 10);
            const pot = parseInt(potInp.value, 10);
            if(isNaN(mux) || isNaN(pot)) continue;
            const key = mux + ':' + pot;
            if(!potGroups.has(key)) potGroups.set(key, []);
            potGroups.get(key).push(i);
        }
        potGroups.forEach((indices, key) => {
            if(indices.length < 2) return;
            const parts = key.split(':');
            const names = indices.map(i => POT_NAMES[i]).join(', ');
            messages.push('Pot MUX ' + parts[0] + ' / channel ' + parts[1] + ' : ' + names);
            indices.forEach(i => {
                const inp = document.querySelector(`.pi[data-i="${i}"][data-f="mux"]`);
                const tr  = inp && inp.closest('tr');
                if(tr) tr.classList.add('dup-conflict');
            });
        });

        // Switches — duplicate port + pin
        const swGroups = new Map();
        for(let i = 0; i < SWITCH_NAMES.length; i++) {
            const pinInp  = document.querySelector(`.si[data-i="${i}"][data-f="pin"]`);
            const portInp = document.querySelector(`.si[data-i="${i}"][data-f="port"]`);
            if(!pinInp || !portInp) continue;
            const pin  = parseInt(pinInp.value, 10);
            const port = parseInt(portInp.value, 10);
            if(isNaN(pin) || isNaN(port)) continue;
            const key = port + ':' + pin;
            if(!swGroups.has(key)) swGroups.set(key, []);
            swGroups.get(key).push(i);
        }
        swGroups.forEach((indices, key) => {
            if(indices.length < 2) return;
            const parts = key.split(':');
            const portLabel = parts[0] === '1' ? 'B' : 'A';
            const names = indices.map(i => SWITCH_NAMES[i]).join(', ');
            messages.push('Switch port ' + portLabel + ' / pin ' + parts[1] + ' : ' + names);
            indices.forEach(i => {
                const inp = document.querySelector(`.si[data-i="${i}"][data-f="pin"]`);
                const tr  = inp && inp.closest('tr');
                if(tr) tr.classList.add('dup-conflict');
            });
        });

        const banner = document.getElementById('mapping-conflicts');
        const list   = document.getElementById('mapping-conflicts-list');
        if(!banner || !list) return;

        if(messages.length === 0) {
            banner.classList.remove('show');
            list.innerHTML = '';
            return;
        }

        banner.classList.add('show');
        list.innerHTML = messages.map(m => '<li>' + m + '</li>').join('');
    }

    /** Creates a per-row Detect / Cancel button. */
    function createDetectButton(table, index) {
        const btn = el('button', {className: 'btn-detect-row', type: 'button'});
        btn.textContent = 'Map';
        btn.title       = 'Detect control';
        btn.dataset.table = table;
        btn.dataset.index = String(index);
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if(detectMode &&
               detectMode.table === table &&
               detectMode.targetIndex === index)
                cancelDetect();
            else
                startDetect(table, index);
        });
        return btn;
    }

    function showDetectStatus(msg, isError) {
        if(!detectStatusEl) return;
        detectStatusEl.textContent = msg;
        detectStatusEl.className     = isError ? 'show err' : 'show';
    }

    function hideDetectStatus() {
        if(!detectStatusEl) return;
        detectStatusEl.textContent = '';
        detectStatusEl.className   = '';
    }

    function setDetectUiActive(active) {
        document.querySelectorAll('.btn-detect-row').forEach(btn => {
            const t = btn.dataset.table;
            const i = parseInt(btn.dataset.index, 10);
            const isTarget = active && detectMode &&
                             detectMode.table === t &&
                             detectMode.targetIndex === i;
            btn.textContent = isTarget ? '\u00d7' : 'Det';
            btn.title       = isTarget ? 'Cancel detect' : 'Detect control';
            btn.classList.toggle('detect-active', isTarget);
            btn.disabled    = active && !isTarget;
        });
        document.querySelectorAll('#pot-tbody tr, #sw-tbody tr').forEach(row =>
            row.classList.remove('row-detecting'));
        if(active && detectMode) {
            const tbody = detectMode.table === 'pot' ? '#pot-tbody' : '#sw-tbody';
            const tr = document.querySelector(
                `${tbody} tr[data-map-index="${detectMode.targetIndex}"]`);
            if(tr) tr.classList.add('row-detecting');
        }
    }

    /** Snapshots live pot/switch values for movement detection. */
    function snapshotControlValues() {
        const snapPot = new Float32Array(POT_NAMES.length);
        const snapSw  = new Float32Array(SWITCH_NAMES.length);
        for(let i = 0; i < POT_NAMES.length; i++)
            snapPot[i] = potValues[i] != null ? potValues[i] : 0;
        for(let i = 0; i < SWITCH_NAMES.length; i++)
            snapSw[i] = switchStates[i] != null ? switchStates[i] : 0;
        return {snapPot, snapSw};
    }

    /** Starts listening for a pot move (≥25%) or switch toggle for one row. */
    function startDetect(table, index) {
        if(detectMode) cancelDetect();
        if(!mappingBuilt) {
            showDetectStatus('Waiting for Bela mapping…', true);
            return;
        }
        if(typeof Bela === 'undefined') {
            showDetectStatus('Bela not connected', true);
            return;
        }

        const {snapPot, snapSw} = snapshotControlValues();
        detectMode = {table, targetIndex: index, snapPot, snapSw};

        setDetectUiActive(true);
        const targetName = table === 'pot' ? POT_NAMES[index] : SWITCH_NAMES[index];
        if(table === 'pot') {
            showDetectStatus(
                'Move a pot at least 25% for ' + targetName + ' — ' +
                'MUX/channel will be copied from the control you move.'
            );
        } else {
            showDetectStatus(
                'Toggle a switch for ' + targetName + ' — ' +
                'pin/port will be copied from the switch you flip.'
            );
        }
    }

    /** Aborts an active detect session. */
    function cancelDetect() {
        if(!detectMode) return;
        detectMode = null;
        setDetectUiActive(false);
        hideDetectStatus();
    }

    /** Sets one mapping form field and notifies conflict checker. */
    function setMappingField(table, rowIndex, field, value) {
        const cls = table === 'pot' ? 'pi' : 'si';
        const inp = document.querySelector(`.${cls}[data-i="${rowIndex}"][data-f="${field}"]`);
        if(!inp) return;
        if(inp.type === 'checkbox')
            inp.checked = !!value;
        else
            inp.value = value;
        inp.dispatchEvent(new Event('input', {bubbles: true}));
    }

    /** Finds the pot index with the largest change since the detect snapshot. */
    function findMovedPotIndex(snapPot) {
        let bestIdx = -1;
        let bestDelta = 0;
        for(let i = 0; i < POT_NAMES.length; i++) {
            const cur   = potValues[i] != null ? potValues[i] : 0;
            const delta = Math.abs(cur - snapPot[i]);
            if(delta > bestDelta) {
                bestDelta = delta;
                bestIdx   = i;
            }
        }
        if(bestIdx < 0 || bestDelta < DETECT_POT_MIN_DELTA) return -1;
        return bestIdx;
    }

    /** Finds a switch that toggled since the detect snapshot. */
    function findToggledSwitchIndex(snapSw) {
        for(let i = 0; i < SWITCH_NAMES.length; i++) {
            const cur = switchStates[i] != null ? switchStates[i] : 0;
            if((cur > 0.5) !== (snapSw[i] > 0.5)) return i;
        }
        return -1;
    }

    /** Reads mux/pot/rev/cen for one pot row from the mapping table. */
    function readPotMappingRow(i) {
        const muxInp = document.querySelector(`.pi[data-i="${i}"][data-f="mux"]`);
        const potInp = document.querySelector(`.pi[data-i="${i}"][data-f="pot"]`);
        const revInp = document.querySelector(`.pi[data-i="${i}"][data-f="rev"]`);
        const cenInp = document.querySelector(`.pi[data-i="${i}"][data-f="cen"]`);
        if(!muxInp || !potInp) return null;
        return {
            mux: parseInt(muxInp.value, 10) || 0,
            pot: parseInt(potInp.value, 10) || 0,
            rev: revInp ? revInp.checked : false,
            cen: cenInp ? cenInp.checked : false
        };
    }

    /** Reads pin/port/rev for one switch row from the mapping table. */
    function readSwitchMappingRow(i) {
        const pinInp  = document.querySelector(`.si[data-i="${i}"][data-f="pin"]`);
        const portInp = document.querySelector(`.si[data-i="${i}"][data-f="port"]`);
        const revInp  = document.querySelector(`.si[data-i="${i}"][data-f="rev"]`);
        if(!pinInp || !portInp) return null;
        return {
            pin:  parseInt(pinInp.value, 10) || 0,
            port: parseInt(portInp.value, 10) || 0,
            rev:  revInp ? revInp.checked : false
        };
    }

    /** Applies detect result to the selected row, then ends the session. */
    function finishDetect(sourceIndex, sourceName) {
        const dst = detectMode.targetIndex;
        const table = detectMode.table;

        if(table === 'pot') {
            const src = readPotMappingRow(sourceIndex);
            if(!src) { cancelDetect(); return; }
            setMappingField('pot', dst, 'mux', src.mux);
            setMappingField('pot', dst, 'pot', src.pot);
            setMappingField('pot', dst, 'rev', src.rev);
            setMappingField('pot', dst, 'cen', src.cen);
            showDownloadStatus(
                'Detected ' + sourceName + ' → MUX ' + src.mux + ' / ch ' + src.pot, false
            );
        } else {
            const src = readSwitchMappingRow(sourceIndex);
            if(!src) { cancelDetect(); return; }
            setMappingField('sw', dst, 'pin', src.pin);
            setMappingField('sw', dst, 'port', src.port);
            setMappingField('sw', dst, 'rev', src.rev);
            const portLabel = src.port > 0.5 ? 'B' : 'A';
            showDownloadStatus(
                'Detected ' + sourceName + ' → port ' + portLabel + ' / pin ' + src.pin, false
            );
        }

        updateMappingConflicts();
        cancelDetect();
    }

    /** Polls live buffers while detect mode is active. */
    function updateDetectMode() {
        if(!detectMode) return;

        if(detectMode.table === 'pot') {
            const srcIdx = findMovedPotIndex(detectMode.snapPot);
            if(srcIdx >= 0)
                finishDetect(srcIdx, POT_NAMES[srcIdx]);
        } else {
            const srcIdx = findToggledSwitchIndex(detectMode.snapSw);
            if(srcIdx >= 0)
                finishDetect(srcIdx, SWITCH_NAMES[srcIdx]);
        }
    }

    // -----------------------------------------------------------------------
    // Download config.json (browser-side — user copies file to Bela project)
    // -----------------------------------------------------------------------

    /** Reads pot/switch mapping from the editable tables. */
    function collectMappingFromForm() {
        const pm = new Float32Array(POT_NAMES.length * 4);
        document.querySelectorAll('.pi').forEach(inp => {
            const i = parseInt(inp.dataset.i, 10);
            const f = inp.dataset.f;
            if(f === 'mux') pm[i*4+0] = parseFloat(inp.value) || 0;
            if(f === 'pot') pm[i*4+1] = parseFloat(inp.value) || 0;
            if(f === 'rev') pm[i*4+2] = inp.checked ? 1.0 : 0.0;
            if(f === 'cen') pm[i*4+3] = inp.checked ? 1.0 : 0.0;
        });

        const sm = new Float32Array(SWITCH_NAMES.length * 3);
        document.querySelectorAll('.si').forEach(inp => {
            const i = parseInt(inp.dataset.i, 10);
            const f = inp.dataset.f;
            if(f === 'pin')  sm[i*3+0] = parseFloat(inp.value) || 0;
            if(f === 'port') sm[i*3+1] = parseFloat(inp.value);
            if(f === 'rev')  sm[i*3+2] = inp.checked ? 1.0 : 0.0;
        });

        return {pm, sm};
    }

    /** Builds a config.json string from form data and Bela metadata buffer. */
    function buildConfigJsonText(pm, sm) {
        if(!configMeta) return null;

        const M = CONFIG_META;
        const masterCount = Math.round(configMeta[M.MASTER_COUNT]);
        const masterOuts  = [];
        if(masterCount > 0) masterOuts.push(Math.round(configMeta[M.MASTER_0]));
        if(masterCount > 1) masterOuts.push(Math.round(configMeta[M.MASTER_1]));

        const ignoredCount = Math.round(configMeta[M.IGNORED_COUNT]);
        const ignoredPots  = [];
        for(let i = 0; i < ignoredCount; i++) {
            ignoredPots.push({
                mux: Math.round(configMeta[M.IGNORED_BASE + i*2 + 0]),
                pot: Math.round(configMeta[M.IGNORED_BASE + i*2 + 1])
            });
        }

        const pots = POT_NAMES.map((name, i) => ({
            name,
            mux:      Math.round(pm[i*4+0]),
            pot:      Math.round(pm[i*4+1]),
            reversed: pm[i*4+2] > 0.5,
            centered: pm[i*4+3] > 0.5
        }));

        const switches = SWITCH_NAMES.map((name, i) => ({
            name,
            pin:      Math.round(sm[i*3+0]),
            reversed: sm[i*3+2] > 0.5,
            port:     sm[i*3+1] > 0.5 ? 'B' : 'A'
        }));

        const config = {
            _comment: 'Dub Preamp BELA GEM MULTI -- hardware mapping config. Edit this file to remap pots/switches without recompiling. Restart the Bela project to apply changes.',
            mux: { activeMux: Math.round(configMeta[M.ACTIVE_MUX]) },
            calibration: {
                potScaleRecovery: +configMeta[M.SCALE].toFixed(4),
                potMax:           +configMeta[M.POT_MAX].toFixed(3),
                potMin:           +configMeta[M.POT_MIN].toFixed(3)
            },
            i2c: {
                bus:        I2C_BUS,
                mcpAddress: Math.round(configMeta[M.MCP_ADDR])
            },
            routing: {
                out: {
                    master:  masterOuts,
                    fx1Send: Math.round(configMeta[M.FX1_SEND]),
                    fx2Send: Math.round(configMeta[M.FX2_SEND]),
                    vuSub:   Math.round(configMeta[M.VU_SUB]),
                    vuKick:  Math.round(configMeta[M.VU_KICK]),
                    vuMid:   Math.round(configMeta[M.VU_MID]),
                    vuTop:   Math.round(configMeta[M.VU_TOP])
                },
                in: {
                    fx1Return: Math.round(configMeta[M.FX1_RET]),
                    fx2Return: Math.round(configMeta[M.FX2_RET]),
                    aux1:      Math.round(configMeta[M.AUX1]),
                    aux2:      Math.round(configMeta[M.AUX2]),
                    aux3:      Math.round(configMeta[M.AUX3]),
                    aux4:      Math.round(configMeta[M.AUX4])
                }
            },
            pots,
            switches,
            ignoredPots
        };

        return JSON.stringify(config, null, 2);
    }

    /** Triggers a browser download of config.json built from the mapping tables. */
    function downloadConfigJson() {
        if(!mappingBuilt) {
            showDownloadStatus('Waiting for Bela mapping…', true);
            return;
        }
        if(!configMeta) {
            showDownloadStatus('Config metadata not received', true);
            return;
        }

        const {pm, sm} = collectMappingFromForm();
        const text     = buildConfigJsonText(pm, sm);
        if(!text) {
            showDownloadStatus('JSON generation error', true);
            return;
        }

        const blob = new Blob([text], {type: 'application/json'});
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'config.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showDownloadStatus('Downloaded ✓', false);
    }

    function showDownloadStatus(msg, isError) {
        if(!downloadStatusEl) return;
        downloadStatusEl.textContent = msg;
        downloadStatusEl.className   = isError ? 'err' : '';
        setTimeout(() => { if(downloadStatusEl) downloadStatusEl.textContent = ''; }, 4000);
    }

    // -----------------------------------------------------------------------
    // Display update functions
    // -----------------------------------------------------------------------

    /** Updates siren card from sirenState buffer. */
    function updateSiren() {
        const idx  = Math.max(0, Math.min(Math.round(sirenState[0]), SIREN_PRESETS.length - 1));
        const gate = sirenState[1] > 0.5;
        const mod  = sirenState[2];

        sirenPresetPills.forEach((pill, i) => {
            const isActive = (i === idx);
            pill.className = 'spreset' + (isActive ? ' active' : '') + (isActive && gate ? ' gate' : '');
        });

        if(sirenNameEl)  sirenNameEl.textContent  = SIREN_PRESETS[idx];
        if(sirenGateEl)  sirenGateEl.className     = gate ? 'on' : '';
        if(sirenModFill) sirenModFill.style.width  = (mod * 100).toFixed(1) + '%';
        if(sirenModLbl)  sirenModLbl.textContent   = Math.round(mod * 100) + '%';
    }

    /** Resyncs pot baselines from current live values. */
    function syncConsolePotBaselines() {
        prevPotValues.set(potValues);
        prevPotValuesNormal.set(potValues);
    }

    /** Switches console filter mode and clears stale entries. */
    function setConsoleFilterMode(mode) {
        if(mode !== 'normal' && mode !== 'detailed') return;
        if(mode === consoleFilterMode) return;
        consoleFilterMode = mode;
        consoleFilterBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        recentChanges = [];
        syncConsolePotBaselines();
        renderConsole();
    }

    /** Builds one console row — filled from entry or empty placeholder slot. */
    function buildConsoleRow(entry, slot) {
        const isSw    = entry && entry.type === 'sw';
        const isEmpty = !entry;
        const li = el('li', {className: 'crow' + (isEmpty ? ' empty' : (isSw ? ' sw' : ''))});
        if(isEmpty) li.style.setProperty('--slot', String(slot));
        const pct  = entry ? Math.min(100, Math.max(0, entry.value * 100)).toFixed(1) : '0';
        const cval = entry ? entry.value.toFixed(3) : '\u00a0';
        const cname = entry ? entry.name : '\u00a0';
        const fillCls = isEmpty ? 'cfill cfill-loading' : 'cfill';
        const fillStyle = isEmpty ? '' : ` style="width:${pct}%"`;
        li.innerHTML =
            `<span class="cname">${cname}</span>` +
            `<span class="ctrack"><span class="${fillCls}"${fillStyle}></span></span>` +
            `<span class="cval">${cval}</span>`;
        return li;
    }

    /** Detects changed pots/switches and updates the console. */
    function updateConsole() {
        const now = Date.now();
        let dirty = false;
        const isNormal = consoleFilterMode === 'normal';
        const potDelta = isNormal ? CONSOLE_POT_MIN_DELTA_NORMAL : CONSOLE_POT_MIN_DELTA_DETAILED;
        const potPrev  = isNormal ? prevPotValuesNormal : prevPotValues;

        for(let i = 0; i < POT_NAMES.length; i++) {
            const v = potValues[i];
            if(Math.abs(v - potPrev[i]) >= potDelta) {
                potPrev[i] = v;
                pushConsoleEntry({name: POT_NAMES[i], value: v, type: 'pot', ts: now});
                dirty = true;
            }
        }
        for(let i = 0; i < SWITCH_NAMES.length; i++) {
            const v = switchStates[i];
            if(v !== prevSwitchStates[i]) {
                prevSwitchStates[i] = v;
                pushConsoleEntry({name: SWITCH_NAMES[i], value: v, type: 'sw', ts: now});
                dirty = true;
            }
        }

        if(dirty) renderConsole();
    }

    function pushConsoleEntry(entry) {
        recentChanges = recentChanges.filter(e => e.name !== entry.name);
        recentChanges.unshift(entry);
        if(recentChanges.length > MAX_CONSOLE) recentChanges.length = MAX_CONSOLE;
    }

    function renderConsole() {
        if(!consoleList) return;
        consoleList.innerHTML = '';
        for(let i = 0; i < MAX_CONSOLE; i++) {
            consoleList.appendChild(buildConsoleRow(recentChanges[i] || null, i));
        }
    }

    /** Updates switch pill colors from current switchStates. */
    function updateSwitches() {
        switchPills.forEach((pill, i) => {
            const on = switchStates[i] > 0.5;
            pill.classList.toggle('on', on);
        });
    }

    /** Converts a linear peak level to a 0–100 % bar height (-60 dBFS floor). */
    function levelToBarPct(raw) {
        const dB = raw > 0.000032 ? 20 * Math.log10(raw) : -90;
        return ((Math.max(dB, -60) + 60) / 60) * 100;
    }

    /** Formats a linear peak level as a dB string. */
    function levelToDbLabel(raw) {
        const dB = raw > 0.000032 ? 20 * Math.log10(raw) : -90;
        return dB < -80 ? '-\u221e' : dB.toFixed(1) + '\u202FdB';
    }

    /** Updates VU meter bars and peak-hold markers. Only called when Meters tab is active. */
    function updateMeters() {
        for(let i = 0; i < 13; i++) {
            const raw    = audioLevels[i];
            const barPct = levelToBarPct(raw);

            // Peak hold: reset timer on new peak, else decay after hold expires
            if(raw > peakHold[i]) {
                peakHold[i]      = raw;
                peakHoldTimer[i] = PEAK_HOLD_FRAMES;
            } else if(peakHoldTimer[i] > 0) {
                peakHoldTimer[i]--;
            } else {
                peakHold[i] *= PEAK_DECAY;
            }
            const pkPct = levelToBarPct(peakHold[i]);

            // Colour ramp: green → yellow → red
            let col;
            if(barPct < 62)      col = '#27ae60';
            else if(barPct < 85) col = '#f39c12';
            else                 col = '#e74c3c';

            const fill = meterFills[i];
            const peak = meterPeaks[i];
            const dblb = meterDbs[i];

            if(fill) { fill.style.height = barPct + '%'; fill.style.background = col; }
            if(peak) { peak.style.bottom = pkPct + '%'; }
            if(dblb) { dblb.textContent = levelToDbLabel(raw); }
        }
    }

    /** Updates the LIVE / OFFLINE badge in the header. */
    function belaSocketOpen() {
        if(typeof Bela === 'undefined') return false;
        const ws = Bela.socket || Bela.ws || (Bela.data && Bela.data.socket);
        if(ws && typeof ws.readyState === 'number')
            return ws.readyState === WebSocket.OPEN;
        return true;
    }

    /** Builds a lightweight fingerprint from live buffers (pots + audio peaks). */
    function sampleBelaFingerprint(b) {
        const parts = [];
        if(b[0]) {
            parts.push('p');
            for(let i = 0; i < Math.min(6, b[0].length); i++)
                parts.push(b[0][i].toFixed(4));
        }
        if(b[3]) {
            parts.push('a');
            for(let i = 0; i < b[3].length; i++)
                parts.push(b[3][i].toFixed(5));
        }
        return parts.join(',');
    }

    /** Records timestamp when Bela data changes (detects project stop / WS drop). */
    function updateBelaRxWatchdog(b) {
        if(!b || !b[0]) return;
        const now = Date.now();
        const fp = sampleBelaFingerprint(b);
        if(fp !== belaRxFingerprint) {
            belaRxFingerprint = fp;
            lastBelaRxMs = now;
        } else if(lastBelaRxMs === 0) {
            belaRxFingerprint = fp;
            lastBelaRxMs = now;
        }
    }

    /**
     * Returns connection health: 'live' | 'lag' | 'offline'.
     * Uses time since last fresh buffer — gaps grow when the link is congested.
     */
    function getBelaConnState() {
        if(typeof Bela === 'undefined') return 'offline';
        if(!belaSocketOpen()) return 'offline';
        if(lastBelaRxMs === 0) return 'offline';
        const staleMs = Date.now() - lastBelaRxMs;
        if(staleMs >= BELA_OFFLINE_TIMEOUT_MS) return 'offline';
        if(staleMs >= BELA_LAG_THRESHOLD_MS) return 'lag';
        return 'live';
    }

    /** Returns true while Bela is still sending data (live or lagging). */
    function isBelaConnected() {
        return getBelaConnState() !== 'offline';
    }

    function updateBadge() {
        const badge = document.getElementById('conn-badge');
        if(!badge) return;
        const state = getBelaConnState();
        if(state === 'live') {
            badge.textContent = 'LIVE';
            badge.className   = 'badge live';
        } else if(state === 'lag') {
            badge.textContent = 'LAG';
            badge.className   = 'badge lag';
        } else {
            badge.textContent = 'OFFLINE';
            badge.className   = 'badge';
        }
    }

    // -----------------------------------------------------------------------
    // Utility
    // -----------------------------------------------------------------------

    /**
     * Builds a Bela IDE asset URL (/api/read/file/…) for a file in the
     * running project. Resolves the project folder from the sketch.js script
     * src, falling back to the #projectName hash fragment.
     */
    function projectFileUrl(filename) {
        const scripts = document.querySelectorAll('script[src*="/api/read/file/"]');
        for (const s of scripts) {
            const m = s.src.match(/\/api\/read\/file\/([^?]+)/);
            if (m) {
                const projectPath = decodeURIComponent(m[1]);
                const base = projectPath.replace(/\/[^/]+$/, '');
                return '/api/read/file/' + encodeURIComponent(base + '/' + filename);
            }
        }
        const project = (window.location.hash || '').slice(1);
        if (project)
            return '/api/read/file/' + encodeURIComponent(project + '/' + filename);
        return filename;
    }

    /** Creates a DOM element with properties shorthand. */
    function el(tag, props) {
        const e = document.createElement(tag);
        if(props) Object.assign(e, props);
        return e;
    }

    function cardTitle(text) {
        const d = el('div', {className:'card-title'});
        d.textContent = text;
        return d;
    }

    /** Sets tab-content top padding to clear the fixed header chrome. */
    function layoutTopChrome() {
        const chrome  = document.getElementById('top-chrome');
        const content = document.getElementById('tab-content');
        if(chrome && content)
            content.style.paddingTop = (chrome.offsetHeight + 14) + 'px';
    }

    /** Removes p5.js wrapper nodes (main/canvas) that sit beside #bela-gui. */
    function hideP5Dom() {
        document.querySelectorAll('body > main').forEach(el => el.remove());
    }

    // -----------------------------------------------------------------------
    // p5.js lifecycle
    // -----------------------------------------------------------------------

    p.setup = function() {
        injectCSS();
        buildUI();
        layoutTopChrome();

        // draw() loop without a visible canvas (Bela GUI is pure DOM).
        if(typeof p.noCanvas === 'function')
            p.noCanvas();
        else {
            const cnv = p.createCanvas(1, 1);
            cnv.elt.style.display = 'none';
        }
        hideP5Dom();

        // p5 resets body margin after our CSS — force full-width layout.
        document.documentElement.style.margin = '0';
        document.documentElement.style.padding = '0';
        document.documentElement.style.width = '100%';
        document.documentElement.style.overflowX = 'hidden';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.width = '100%';
        document.body.style.overflowX = 'hidden';

        layoutTopChrome();
        window.addEventListener('resize', layoutTopChrome);

        p.frameRate(20);
    };

    p.draw = function() {
        if(typeof Bela === 'undefined') { updateBadge(); return; }

        const b = Bela.data.buffers;
        updateBelaRxWatchdog(b);

        if(!isBelaConnected()) {
            updateBadge();
            return;
        }

        // Receive data from Bela
        if(b[0]) {
            if(!consoleReady) {
                // First frame — capture baseline so console doesn't flood with 58 entries
                prevPotValues       = new Float32Array(b[0]);
                prevPotValuesNormal = new Float32Array(b[0]);
                prevSwitchStates    = new Float32Array(b[1] || switchStates);
                consoleReady        = true;
            }
            potValues   = b[0];
        }
        if(b[1]) switchStates = b[1];
        if(b[2]) sirenState   = b[2];
        if(b[3]) audioLevels  = b[3];
        if(b[4] && !potMapping)    { potMapping    = Float32Array.from(b[4]); tryBuildMappingTable(); }
        if(b[5] && !switchMapping) { switchMapping = Float32Array.from(b[5]); tryBuildMappingTable(); }
        if(b[6] && !configMeta)    { configMeta    = Float32Array.from(b[6]); }

        // Update all tabs (keep state current even when tab is not visible)
        if(consoleReady) updateConsole();
        updateSiren();
        updateSwitches();
        updateBadge();

        // Meters are DOM-heavy — only update when visible
        if(currentTab === 1) updateMeters();
        if(detectMode) updateDetectMode();
    };
};

new p5(sketch);
