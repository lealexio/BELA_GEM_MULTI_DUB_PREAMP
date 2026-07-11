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
    let recentChanges    = [];
    let prevPotValues    = new Float32Array(58).fill(-1);
    let prevSwitchStates = new Float32Array(9).fill(-1);
    let consoleReady     = false;
    const MAX_CONSOLE    = 14;

    let currentTab   = 0;
    let mappingBuilt = false;

    /** Active detect session, or null. */
    let detectMode     = null;

    // Cached DOM references
    let sirenDots    = [];
    let sirenNameEl  = null;
    let sirenGateEl  = null;
    let sirenModFill = null;
    let sirenModLbl  = null;
    let consoleList  = null;
    let switchPills  = [];
    let downloadStatusEl = null;
    let detectStatusEl   = null;

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
#siren-body{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}
#siren-dots{display:flex;gap:8px;flex-wrap:wrap}
.sdot{
    width:54px;height:54px;border-radius:50%;
    background:#ebebeb;border:2px solid #ccc;
    display:flex;align-items:center;justify-content:center;
    flex-direction:column;font-size:9px;font-weight:700;color:#777;
    line-height:1.25;text-align:center;
    transition:background .2s,border-color .2s,box-shadow .2s;
}
.sdot.active{
    background:#1a1a2e;border-color:#e74c3c;color:#fff;
    box-shadow:0 0 12px rgba(231,76,60,.45);
}
.sdot.gate{box-shadow:0 0 22px rgba(231,76,60,.85),0 0 44px rgba(231,76,60,.3)!important}
#siren-info{flex:1;min-width:150px}
#siren-name{font-size:28px;font-weight:700;color:#1a1a2e;margin-bottom:8px}
#siren-gate-dot{
    display:inline-block;width:10px;height:10px;border-radius:50%;
    background:#ccc;vertical-align:middle;margin-right:6px;
    transition:background .1s,box-shadow .1s;
}
#siren-gate-dot.on{background:#e74c3c;box-shadow:0 0 8px rgba(231,76,60,.8)}
.gate-lbl{font-size:12px;color:#999;vertical-align:middle}
#siren-mod-track{
    margin-top:10px;height:6px;background:#eee;
    border-radius:3px;overflow:hidden;
}
#siren-mod-fill{
    height:100%;width:0%;background:#1a1a2e;
    border-radius:3px;transition:width .04s;
}
#siren-mod-lbl{font-size:11px;color:#aaa;margin-top:4px}

/* --- Console --- */
#console-list{list-style:none}
.crow{
    display:flex;align-items:center;gap:8px;
    padding:4px 0;border-bottom:1px solid #f0f0f0;
}
.crow:last-child{border-bottom:none}
.cname{
    flex:0 0 175px;font-family:monospace;font-size:11px;
    font-weight:600;color:#1a1a2e;white-space:nowrap;overflow:hidden;
}
.ctrack{flex:1;height:5px;background:#eee;border-radius:3px;overflow:hidden}
.cfill{height:100%;background:#2980b9;border-radius:3px}
.crow.sw .cfill{background:#e74c3c}
.cval{
    flex:0 0 46px;text-align:right;font-family:monospace;
    font-size:11px;color:#777;
}
#console-empty{font-size:12px;color:#bbb;font-style:italic;padding:6px 0}

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
            '<span class="spacer"></span>' +
            '<img id="gui-logo" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAC7gAAAZACAMAAADe3f//AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAADAUExURVNTU5CQkJ2dnZycnI+Pj1RUVPT09P///+np6YGBgf7+/t7e3lJSUt3d3dHR0YKCgqurq6mpqZ6envX19ejo6KqqqmRkZNzc3PPz87a2turq6mNjY8TExICAgNDQ0NLS0ri4uMXFxVVVVWJiYnJycre3t3Nzc46OjsPDw3Fxcc/Pz/39/bm5uZGRkWVlZefn55ubm39/f/b29vLy8uvr69vb26ysrHR0dMbGxoODgyIiItPT05+fn0NDQ9/f3wAAACRlnQ8AAABAdFJOU////////////////////////////////////////////////////////////////////////////////////wDCe7FEAAAACXBIWXMAAC4iAAAuIgGq4t2SAAAAGXRFWHRTb2Z0d2FyZQBQYWludC5ORVQgNS4xLjExiggWzgAAALhlWElmSUkqAAgAAAAFABoBBQABAAAASgAAABsBBQABAAAAUgAAACgBAwABAAAAAgAAADEBAgARAAAAWgAAAGmHBAABAAAAbAAAAAAAAADfkwQA6AMAAN+TBADoAwAAUGFpbnQuTkVUIDUuMS4xMQAAAwAAkAcABAAAADAyMzABoAMAAQAAAAEAAAAFoAQAAQAAAJYAAAAAAAAAAgABAAIABAAAAFI5OAACAAcABAAAADAxMDAAAAAA1L75p1svsm8AAP2kSURBVHhe7P0Nd6M4ty/6OjgxttIm6SR2pWJXXlbF6e5daz17nXvO3muve+4Y9f2/1R0SYONpbBBIc0rw/z3j6UqlbBBCiInQy+Q3AAAAAAAEb0J/AQAAAAAA4UHgDgAAAAAQAQTuAAAAAAARQOAOAAAAABABBO4AAAAAABFA4A4AAAAAEAEE7gAAAAAAEUDgDgAAAAAQAQTuAAAAAAARQOAOAAAAABABBO4AAAAAABFA4A4AAAAAEAEE7gAAAAAAEUDgDgAAAAAQAQTuAAAAAAARQOAOAAAAABABBO4AAAAAABFA4A4AAAAAEAEE7gAAAAAAEUDgDgAAAAAQAQTuAAAAAAARQOAOAAAAABABBO4AAAAAABFA4A4AAAAAEAEE7gAAAAAAEUDgDgAA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" alt="Fulla Vibes">';
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

        const dotsDiv = el('div', {id:'siren-dots'});
        sirenDots = [];
        SIREN_PRESETS.forEach((name, i) => {
            const d = el('div', {className:'sdot'});
            d.innerHTML = `<span style="font-size:11px;opacity:.7">${i+1}</span><span>${name}</span>`;
            dotsDiv.appendChild(d);
            sirenDots.push(d);
        });

        const info = el('div', {id:'siren-info'});
        info.innerHTML = `
            <div id="siren-name">—</div>
            <div style="margin-top:8px">
                <span id="siren-gate-dot"></span>
                <span class="gate-lbl">Gate</span>
            </div>
            <div id="siren-mod-track"><div id="siren-mod-fill"></div></div>
            <div id="siren-mod-lbl">Mod: 0%</div>
        `;

        sirenBody.appendChild(dotsDiv);
        sirenBody.appendChild(info);
        sirenCard.appendChild(sirenBody);

        sirenNameEl  = info.querySelector('#siren-name');
        sirenGateEl  = info.querySelector('#siren-gate-dot');
        sirenModFill = info.querySelector('#siren-mod-fill');
        sirenModLbl  = info.querySelector('#siren-mod-lbl');

        // Console card
        const consoleCard = el('div', {className:'card'});
        consoleCard.appendChild(cardTitle('Console — last change'));
        consoleList = el('ul', {id:'console-list'});
        const empty = el('li', {id:'console-empty'});
        empty.textContent = 'Waiting for data…';
        consoleList.appendChild(empty);
        consoleCard.appendChild(consoleList);

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
        note.textContent =
            'Current mapping loaded from config.json on the Bela. ' +
            'Edit the values below, then download the file — ' +
            'replace config.json in the project folder and restart.';
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

        sirenDots.forEach((d, i) => {
            const isActive = (i === idx);
            d.className = 'sdot' + (isActive ? ' active' : '') + (isActive && gate ? ' gate' : '');
        });

        if(sirenNameEl)  sirenNameEl.textContent  = SIREN_PRESETS[idx];
        if(sirenGateEl)  sirenGateEl.className     = gate ? 'on' : '';
        if(sirenModFill) sirenModFill.style.width  = (mod * 100).toFixed(1) + '%';
        if(sirenModLbl)  sirenModLbl.textContent   = 'Mod: ' + Math.round(mod * 100) + '%';
    }

    /** Detects changed pots/switches and updates the console. */
    function updateConsole() {
        const now = Date.now();
        let dirty = false;

        for(let i = 0; i < POT_NAMES.length; i++) {
            const v = potValues[i];
            if(Math.abs(v - prevPotValues[i]) > 0.003) {
                prevPotValues[i] = v;
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
        const emptyLi = document.getElementById('console-empty');
        if(emptyLi) emptyLi.remove();
        consoleList.innerHTML = '';
        recentChanges.forEach(e => {
            const li  = el('li', {className:'crow' + (e.type==='sw'?' sw':'')});
            const pct = (e.value * 100).toFixed(0);
            li.innerHTML =
                `<span class="cname">${e.name}</span>` +
                `<span class="ctrack"><span class="cfill" style="width:${pct}%"></span></span>` +
                `<span class="cval">${e.value.toFixed(3)}</span>`;
            consoleList.appendChild(li);
        });
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
    function updateBadge() {
        const badge = document.getElementById('conn-badge');
        if(!badge) return;
        const live = typeof Bela !== 'undefined' && Bela.data.buffers[0] !== null;
        badge.textContent = live ? 'LIVE' : 'OFFLINE';
        badge.className   = 'badge' + (live ? ' live' : '');
    }

    // -----------------------------------------------------------------------
    // Utility
    // -----------------------------------------------------------------------

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

        p.frameRate(60);
    };

    p.draw = function() {
        if(typeof Bela === 'undefined') { updateBadge(); return; }

        const b = Bela.data.buffers;

        // Receive data from Bela
        if(b[0]) {
            if(!consoleReady) {
                // First frame — capture baseline so console doesn't flood with 58 entries
                prevPotValues    = new Float32Array(b[0]);
                prevSwitchStates = new Float32Array(b[1] || switchStates);
                consoleReady     = true;
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
