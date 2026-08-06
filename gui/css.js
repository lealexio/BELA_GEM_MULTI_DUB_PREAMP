/** Injects all GUI styles into document head. */
export function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
:root{
--bg:#e8eaee;
--bg-elev:#ffffff;
--ink:#1a1a2e;
--ink-soft:#3a3a44;
--muted:#6b6b76;
--line:#e2e2e8;
--line-soft:#ececf0;
--accent:#e74c3c;
--surface:#f4f5f7;
--radius:10px;
--shadow:0 1px 2px rgba(26,26,46,.04),0 4px 14px rgba(26,26,46,.06);
--font:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
--mono:ui-monospace,'Cascadia Mono','SF Mono',Menlo,Consolas,monospace;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{
width:100%;
margin:0;
padding:0;
overflow-x:hidden;
}
body{
font-family:var(--font);
background:var(--bg);color:var(--ink);font-size:14px;
-webkit-font-smoothing:antialiased;
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
box-shadow:0 1px 0 rgba(0,0,0,.06);
}

/* --- Header --- */
#gui-header{
background:var(--ink);color:#fff;
padding:8px 18px;display:flex;align-items:center;gap:10px;
width:100%;
}
#gui-header .spacer{flex:1}
#gui-bela-logo{
height:28px;width:auto;
mix-blend-mode:screen;
opacity:.92;
}
#gui-logo{
height:42px;width:auto;
mix-blend-mode:screen; /* blacks become transparent on the dark header */
opacity:.92;
}
.badge{
background:#555;color:#fff;font-size:10px;font-weight:700;
padding:3px 9px;border-radius:999px;letter-spacing:.06em;
}
.badge.live{background:#1f9d55}
.badge.lag{background:#d97706}
.badge.temp{
background:#2563eb;font-variant-numeric:tabular-nums;
letter-spacing:.02em;min-width:3.6em;text-align:center;
}
.badge.temp.warm{background:#d97706}
.badge.temp.hot{background:var(--accent)}
.badge.temp.unknown{background:#555}
.clip-badges{
display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;
}
.badge.clip{
display:none;
background:#e11d2e;letter-spacing:.04em;
animation:clip-badge-pulse 1s ease-in-out infinite;
}
.badge.clip.on{display:inline-block}
@keyframes clip-badge-pulse{
0%,100%{opacity:1}
50%{opacity:.72}
}

/* --- Tab bar --- */
#tab-bar{
display:flex;align-items:stretch;background:var(--bg-elev);
border-bottom:1px solid var(--line);
width:100%;
padding:0 6px;
}
.tab-btn{
padding:12px 18px;font-size:13px;font-weight:600;color:var(--muted);
cursor:pointer;border:none;background:none;
border-bottom:2px solid transparent;margin-bottom:-1px;
transition:color .15s,border-color .15s;letter-spacing:.02em;
}
.tab-btn:hover{color:var(--ink)}
.tab-btn.active{color:var(--ink);border-bottom-color:var(--accent)}
.tab-bar-spacer{flex:1;min-width:8px}
.live-layout-gear{
align-self:center;height:32px;margin-right:4px;
padding:0 10px;font-size:12px;font-weight:600;letter-spacing:.02em;
line-height:1;color:var(--muted);
cursor:pointer;border:1px solid transparent;border-radius:7px;
background:transparent;position:relative;z-index:210;
transition:color .12s,background .12s,border-color .12s;
}
.live-layout-gear:hover{color:var(--ink);background:var(--surface);border-color:var(--line)}
.live-layout-gear.active{
color:#fff;background:var(--ink);border-color:var(--ink);
}

/* --- Content --- */
#tab-content{
flex:1;
padding:14px;
overflow-y:auto;
overflow-x:hidden;
max-width:100%;
min-height:0;
}
.tab-pane{display:none;max-width:1100px;margin:0 auto}
.tab-pane.active{display:block}
#pane-mapping{max-width:100%}

/* --- Cards --- */
.card{
background:var(--bg-elev);border-radius:var(--radius);
border:1px solid var(--line);
box-shadow:var(--shadow);
padding:14px 16px;margin-bottom:12px;
}
.card-title{
font-size:11px;font-weight:700;letter-spacing:.1em;
text-transform:uppercase;color:var(--ink-soft);margin-bottom:12px;
}

/* --- Siren --- */
#siren-body{display:flex;flex-direction:column;gap:12px}
#siren-hero{
background:var(--surface);border-radius:8px;padding:12px 14px;
border:1px solid var(--line-soft);
border-left:3px solid var(--ink);
}
#siren-hero-top{
display:flex;align-items:center;justify-content:space-between;gap:10px;
}
#siren-name{font-size:17px;font-weight:700;color:var(--ink);line-height:1.2}
#siren-gate{
display:flex;align-items:center;gap:6px;flex-shrink:0;
}
#siren-gate-dot{
display:inline-block;width:10px;height:10px;border-radius:50%;
background:#ccc;
transition:background .1s,box-shadow .1s;
}
#siren-gate-dot.on{background:var(--accent);box-shadow:0 0 8px rgba(231,76,60,.8)}
.gate-lbl{font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.04em}
#siren-mod-row{
display:flex;align-items:center;gap:10px;margin-top:10px;
}
.siren-mod-label{
flex:0 0 auto;font-size:10px;font-weight:700;color:var(--muted);
letter-spacing:.05em;text-transform:uppercase;
}
#siren-mod-track{
flex:1;height:6px;background:var(--line);
border-radius:3px;overflow:hidden;min-width:0;
}
#siren-mod-fill{
display:block;height:100%;width:0%;background:var(--ink);
border-radius:3px;transition:width .04s;
}
#siren-mod-lbl{
flex:0 0 36px;font-size:11px;font-weight:700;color:var(--muted);
font-family:var(--mono);text-align:right;
}
#siren-presets{
display:flex;gap:5px;flex-wrap:nowrap;width:100%;
}
.spreset{
flex:1 1 0;min-width:0;
padding:8px 2px;border-radius:7px;
background:var(--surface);border:1px solid var(--line);
font-size:9px;font-weight:700;color:var(--muted);
text-align:center;letter-spacing:.02em;
line-height:1.2;white-space:nowrap;overflow:hidden;
text-overflow:ellipsis;
transition:background .15s,color .15s,border-color .15s,box-shadow .15s;
}
.spreset:hover{border-color:#c8c8d0;color:var(--ink)}
.spreset.active{
background:var(--ink);border-color:var(--ink);color:#fff;
}
.spreset.active.gate{
border-color:var(--accent);
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
padding:4px 11px;font-size:10px;font-weight:700;color:var(--muted);
cursor:pointer;border:1px solid var(--line);border-radius:999px;
background:var(--surface);letter-spacing:.03em;
transition:background .1s,color .1s,border-color .1s;
}
.console-filter-btn:hover{color:var(--ink);border-color:#c8c8d0}
.console-filter-btn.active{
background:var(--ink);color:#fff;border-color:var(--ink);
}
.console-list{list-style:none;margin:0;padding:0}
.crow{
display:flex;align-items:center;gap:8px;
padding:5px 0;border-bottom:1px solid var(--line-soft);
}
.crow:last-child{border-bottom:none}
.crow.empty .cname,
.crow.empty .cval{color:transparent}
.cname{
flex:0 0 175px;font-family:var(--mono);font-size:11px;
font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;
}
.ctrack{flex:1;height:5px;background:var(--line-soft);border-radius:3px;overflow:hidden}
.cfill{
display:block;height:100%;min-width:0;
background:var(--ink);border-radius:3px;
transition:width .15s ease;
}
.crow.sw .cfill{background:var(--accent)}
.crow.empty .ctrack{background:var(--line-soft)}
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
flex:0 0 46px;text-align:right;font-family:var(--mono);
font-size:11px;color:var(--muted);
}

/* --- Switches (grouped tiles) --- */
.sw-grid{
display:grid;grid-template-columns:repeat(3,1fr);
gap:10px;margin-top:6px;
}
.sw-group{
background:var(--surface);border:1px solid var(--line);
border-radius:8px;padding:10px 12px 12px;
}
.sw-group-kill{border-top:2px solid rgba(231,76,60,.35)}
.sw-group-fx{border-top:2px solid rgba(243,156,18,.35)}
.sw-group-siren{border-top:2px solid rgba(41,128,185,.35)}
.sw-group-title{
font-size:11px;font-weight:700;text-transform:uppercase;
letter-spacing:.08em;color:var(--ink-soft);margin-bottom:8px;
}
.sw-group-items{display:flex;flex-wrap:wrap;gap:6px}
.sw-group-kill .sw-group-items,
.sw-group-fx .sw-group-items{
display:grid;grid-template-columns:1fr 1fr;gap:6px;
}
.sw-tile{
display:flex;align-items:center;gap:8px;
padding:8px 10px;background:var(--bg-elev);
border:1px solid var(--line);border-radius:7px;
transition:border-color .15s,background .15s,box-shadow .15s;
}
.sw-tile.on{background:#fafafa;border-color:#d0d0d4}
.sw-tile-kill.on{border-color:rgba(231,76,60,.45);background:#fff8f7}
.sw-tile-fx.on{border-color:rgba(243,156,18,.4);background:#fffdf7}
.sw-tile-siren.on{border-color:rgba(41,128,185,.45);background:#f7fbff}
.sw-led{
flex-shrink:0;width:9px;height:9px;border-radius:50%;
background:#d8d8dc;
transition:background .15s,box-shadow .15s;
}
.sw-tile.on .sw-led{background:var(--ink);box-shadow:0 0 5px rgba(26,26,46,.35)}
.sw-tile-kill.on .sw-led{background:var(--accent);box-shadow:0 0 7px rgba(231,76,60,.45)}
.sw-tile-fx.on .sw-led{background:#d68910;box-shadow:0 0 6px rgba(214,137,16,.4)}
.sw-tile-siren.on .sw-led{background:#2980b9;box-shadow:0 0 7px rgba(41,128,185,.45)}
.sw-tile-name{
font-size:10px;font-weight:700;color:#444;
letter-spacing:.04em;line-height:1.2;
}

/* --- Meters (canvas VU, horizontal) --- */
#meters-wrap{
display:flex;flex-direction:column;gap:10px;
margin:0;
}
.meters-columns{
display:grid;
grid-template-columns:repeat(2,minmax(0,1fr));
gap:12px;align-items:stretch;
}
.meters-card{
min-width:0;height:100%;margin-bottom:0;
display:flex;flex-direction:column;box-sizing:border-box;
}
.meter-group{
display:flex;flex-direction:column;gap:4px;
align-items:stretch;padding:4px 0 2px;flex:1;
}
.meter-ch{
display:flex;flex-direction:row;align-items:center;gap:8px;
width:100%;min-width:0;
padding-top:11px;
}
.meter-id{
display:flex;flex-direction:column;gap:1px;
min-width:58px;width:58px;flex-shrink:0;
align-items:flex-start;text-align:left;
}
.meter-strip{
display:flex;flex-direction:row;align-items:stretch;
flex:1 1 0;min-width:0;width:100%;max-width:none;gap:0;
}
.meter-body{
display:flex;flex-direction:column;gap:1px;
flex:1 1 0;min-width:0;width:100%;
}
.meter-wrap{
position:relative;flex:1 1 0;min-width:0;
width:100%;height:26px;margin-bottom:0;
cursor:pointer;
}
.meter-canvas{
display:block;width:100%;height:26px;
border-radius:0;
}
.meter-scale{
display:flex;justify-content:space-between;
width:100%;padding:0 1px;
font-size:7px;font-family:var(--mono);color:#9a9aa3;
line-height:1;user-select:none;pointer-events:none;
}
.meter-peak-db{
position:absolute;top:-11px;left:0;
font-size:8px;font-family:var(--mono);color:var(--muted);
transform:translateX(-50%);
white-space:nowrap;pointer-events:none;
opacity:0;
transition:left 60ms linear,opacity 120ms ease;
}
.meter-lbl{
font-size:10px;font-weight:700;color:var(--ink-soft);
text-align:left;letter-spacing:.03em;
}
.meter-gain-val{
font-size:12px;font-family:var(--mono);font-weight:700;
color:var(--ink);line-height:1.2;
}
.meter-peak-db.clip{color:#ff3b2a;font-weight:700}
.meter-clip-led{
position:relative;flex:0 0 auto;
width:10px;height:10px;
align-self:center;
}
.meter-clip-led__bezel{
position:absolute;inset:0;border-radius:50%;
background:linear-gradient(145deg,#3a3a3a 0%,#1a1a1a 55%,#2e2e2e 100%);
box-shadow:inset 0 1px 2px rgba(255,255,255,.12),0 1px 2px rgba(0,0,0,.45);
}
.meter-clip-led__core{
position:absolute;inset:2px;border-radius:50%;
background:radial-gradient(circle at 35% 30%,#5a2018 0%,#2a0a06 70%,#180604 100%);
box-shadow:inset 0 1px 3px rgba(0,0,0,.6);
transition:background 120ms ease,box-shadow 120ms ease;
}
.meter-clip-led.on .meter-clip-led__core{
background:radial-gradient(circle at 35% 28%,#ffb0a0 0%,#ff4028 35%,#c01808 85%);
box-shadow:0 0 8px rgba(255,59,42,.85),0 0 14px rgba(255,59,42,.45),inset 0 -1px 2px rgba(0,0,0,.35);
}
.meter-clip-led.on .meter-clip-led__bezel{
box-shadow:inset 0 1px 2px rgba(255,255,255,.18),0 0 6px rgba(255,59,42,.35);
}

/* Gain ± flush with VU bar (same height as canvas row) */
.meter-gain-btn{
flex:0 0 auto;align-self:flex-start;
width:22px;height:26px;padding:0;margin:0;
border:none;background:#202020;color:#c8c8c8;
font-size:13px;font-weight:700;line-height:1;cursor:pointer;
transition:background .1s,color .1s;
}
.meter-gain-btn--dec{border-radius:3px 0 0 3px}
.meter-gain-btn--inc{border-radius:0 3px 3px 0}
.meter-gain-btn:hover{background:#2e2e2e;color:#fff}
.meter-gain-btn:active{background:#3a3a3a}
.meter-gain-btn:disabled{color:#555;cursor:default;background:#1a1a1a}

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
.routing-hint{
font-size:11px;color:#666;margin:-4px 0 10px;
}
.routing-grid{
display:grid;
grid-template-columns:1fr 1fr;
gap:16px;
margin-bottom:8px;
}
@media (max-width:720px){
.routing-grid{grid-template-columns:1fr}
}
.msec-subtitle{
font-size:11px;font-weight:700;text-transform:uppercase;
letter-spacing:.06em;color:#666;margin:0 0 6px;
}
.routing-table col.col-name{width:62%}
.routing-table col.col-num{width:38%}
.routing-table input[type=text]{
width:100%;min-width:0;max-width:100%;
padding:3px 4px;border:1px solid #ddd;
border-radius:4px;font-size:12px;font-family:inherit;
}
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
padding:9px 22px;background:var(--ink);color:#fff;
border:none;border-radius:6px;font-size:13px;font-weight:600;
cursor:pointer;letter-spacing:.03em;transition:background .15s;
}
#btn-download:hover{background:#2c2c54}
#download-status{font-size:12px;font-weight:600;color:#27ae60}
#download-status.err{color:#e74c3c}
.msec-title{
font-size:12px;font-weight:700;text-transform:uppercase;
letter-spacing:.07em;color:#3a3a44;margin:14px 0 7px;
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
#live-grid{
display:grid;grid-template-columns:1fr 1fr;gap:12px;
align-items:stretch;margin-bottom:0;
}
#live-grid > .card{
height:100%;margin-bottom:0;
display:flex;flex-direction:column;box-sizing:border-box;
}
#live-grid #siren-body,
#live-grid #mic-inputs-card .mic-live-list{
flex:1;
}
}

#live-layout-popup{
position:fixed;inset:0;z-index:200;
}
#live-layout-popup[hidden]{display:none!important}
.live-layout-backdrop{
position:absolute;inset:0;
background:rgba(26,26,46,.22);
}
.live-layout-panel{
position:absolute;z-index:1;
max-height:min(70vh,520px);overflow-y:auto;
background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius);
box-shadow:0 8px 28px rgba(26,26,46,.18),var(--shadow);
padding:12px 14px;
}
.live-layout-title{
font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
color:var(--ink-soft);margin-bottom:4px;
}
.live-layout-hint{
font-size:11px;color:var(--muted);line-height:1.4;margin-bottom:10px;
}
.live-layout-list{
display:flex;flex-direction:column;gap:6px;
}
.live-layout-row{
display:flex;align-items:center;justify-content:space-between;gap:10px;
font-size:13px;font-weight:600;color:var(--ink);user-select:none;
padding:6px 8px;border-radius:6px;background:var(--surface);border:1px solid var(--line-soft);
}
.live-layout-check{
display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;min-width:0;
}
.live-layout-check input{width:15px;height:15px;accent-color:var(--ink);cursor:pointer}
.live-layout-moves{display:flex;gap:4px;flex-shrink:0}
.live-layout-move{
width:28px;height:28px;padding:0;font-size:11px;line-height:1;
color:var(--muted);cursor:pointer;border:1px solid var(--line);
border-radius:6px;background:var(--bg-elev);
}
.live-layout-move:hover:not(:disabled){color:var(--ink);border-color:#c8c8d0}
.live-layout-move:disabled{opacity:.35;cursor:default}
#live-board{display:flex;flex-direction:column;gap:12px}
#live-board > .card,
#live-board > #meters-wrap,
#live-board > #live-grid{margin-bottom:0}
#live-grid.live-grid-single{grid-template-columns:1fr}

/* --- Live mic inputs --- */
#mic-inputs-card{
margin:0;
max-width:100%;
display:flex;flex-direction:column;
}
.mic-live-note{
font-size:11px;color:var(--muted);line-height:1.4;margin-bottom:6px;
}
.mic-live-list{display:flex;flex-direction:column;gap:6px}
.mic-live-row{
display:flex;align-items:center;gap:10px;flex-wrap:nowrap;
padding:8px 10px;background:var(--surface);border:1px solid var(--line);border-radius:8px;
}
.mic-live-label{
font-weight:700;font-size:12px;min-width:42px;letter-spacing:.04em;color:var(--ink);
}

/* Mic toggle switch */
.mic-toggle{
display:inline-flex;align-items:center;gap:8px;cursor:pointer;user-select:none;
}
.mic-toggle-input{
position:absolute;opacity:0;width:0;height:0;pointer-events:none;
}
.mic-toggle-track{
position:relative;display:inline-block;width:36px;height:20px;
background:#c8c8ce;border-radius:999px;transition:background .15s ease;
flex-shrink:0;
}
.mic-toggle-thumb{
position:absolute;top:2px;left:2px;width:16px;height:16px;
background:#fff;border-radius:50%;
box-shadow:0 1px 3px rgba(0,0,0,.25);
transition:transform .15s ease;
}
.mic-toggle-input:checked + .mic-toggle-track{background:#1a7a3a}
.mic-toggle-input:checked + .mic-toggle-track .mic-toggle-thumb{transform:translateX(16px)}
.mic-toggle-input:focus-visible + .mic-toggle-track{
outline:2px solid #1a5276;outline-offset:2px;
}
.mic-toggle-text{
font-size:12px;font-weight:600;color:#444;min-width:1.8em;
}
.mic-toggle-input:checked ~ .mic-toggle-text{color:#1a7a3a}

.mic-live-hpf{
display:flex;align-items:center;gap:5px;font-size:12px;margin-left:auto;
color:#555;font-weight:600;
}
.mic-live-hpf input[type=number]{
width:58px;padding:3px 5px;border:1px solid #ccc;border-radius:5px;
font-size:12px;background:#fff;
}
.mic-live-hpf-unit{color:#999;font-size:11px;font-weight:500}
@media(max-width:720px){
.sw-grid{grid-template-columns:1fr}
.meters-columns{grid-template-columns:1fr}
.mtable col.col-name{width:26%}
.mtable col.col-num{width:11%}
.mtable col.col-check{width:10%}
.mtable col.col-port{width:12%}
.mtable col.col-detect{width:16%}
.mtable th,.mtable td{padding-left:4px;padding-right:4px}
.mtable th{font-size:9px}
.mtable input[type=number],.mtable select{font-size:11px}
}

/* --- Master EQ curve --- */
.live-tile[data-tile="masterEq"]{margin-bottom:12px}
.master-eq-notice{
font-size:12px;font-weight:700;color:#3a3a44;
margin-bottom:6px;line-height:1.4;
}
.master-eq-caption{
font-size:11px;color:#888;margin-bottom:10px;line-height:1.45;
}
.master-eq-wrap{
width:100%;max-width:900px;margin:0 auto;
}
.master-eq-canvas{
display:block;width:100%;
height:240px;min-height:240px;
border-radius:6px;background:transparent;
}
@media(min-width:720px){
.master-eq-canvas{height:320px;min-height:320px}
}
    `;
    document.head.appendChild(s);
}
