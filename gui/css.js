/** Injects all GUI styles into document head. */
export function injectCSS() {
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
font-size:12px;font-weight:700;letter-spacing:.08em;
text-transform:uppercase;color:#3a3a44;margin-bottom:10px;
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
#siren-name{font-size:17px;font-weight:700;color:#1a1a2e;line-height:1.2}
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

/* --- Switches (grouped tiles) --- */
.sw-grid{
display:grid;grid-template-columns:repeat(3,1fr);
gap:10px;margin-top:6px;
}
.sw-group{
background:#f7f7f8;border:1px solid #e6e6e8;
border-radius:8px;padding:10px 12px 12px;
}
.sw-group-kill{border-top:2px solid rgba(231,76,60,.35)}
.sw-group-fx{border-top:2px solid rgba(243,156,18,.35)}
.sw-group-siren{border-top:2px solid rgba(41,128,185,.35)}
.sw-group-title{
font-size:11px;font-weight:700;text-transform:uppercase;
letter-spacing:.08em;color:#555;margin-bottom:8px;
}
.sw-group-items{display:flex;flex-wrap:wrap;gap:6px}
.sw-group-kill .sw-group-items,
.sw-group-fx .sw-group-items{
display:grid;grid-template-columns:1fr 1fr;gap:6px;
}
.sw-tile{
display:flex;align-items:center;gap:8px;
padding:8px 10px;background:#fff;
border:1px solid #e4e4e6;border-radius:6px;
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
.sw-tile.on .sw-led{background:#1a1a2e;box-shadow:0 0 5px rgba(26,26,46,.35)}
.sw-tile-kill.on .sw-led{background:#e74c3c;box-shadow:0 0 7px rgba(231,76,60,.45)}
.sw-tile-fx.on .sw-led{background:#d68910;box-shadow:0 0 6px rgba(214,137,16,.4)}
.sw-tile-siren.on .sw-led{background:#2980b9;box-shadow:0 0 7px rgba(41,128,185,.45)}
.sw-tile-name{
font-size:10px;font-weight:700;color:#444;
letter-spacing:.04em;line-height:1.2;
}

/* --- Meters (canvas VU, horizontal) --- */
#meters-wrap{display:flex;flex-direction:column;gap:8px}
.meters-columns{
display:grid;grid-template-columns:1fr;
gap:12px;align-items:start;
}
.meters-card{min-width:0}
.meter-group{
display:flex;flex-direction:column;gap:12px;
align-items:stretch;padding:12px 2px 8px;
}
.meter-ch{
display:flex;flex-direction:row;align-items:center;gap:6px;
width:100%;min-width:0;
padding-top:18px;
}
.meter-id{
display:flex;flex-direction:column;gap:2px;
min-width:40px;flex-shrink:0;
align-items:flex-end;text-align:right;
}
.meter-wrap{
position:relative;flex:1 1 0;min-width:0;
max-width:300px;height:44px;margin-bottom:2px;
}
.meter-canvas{
display:block;width:100%;height:44px;
border-radius:4px;
}
.meter-peak-db{
position:absolute;top:-15px;left:0;
font-size:8px;font-family:monospace;color:#555;
transform:translateX(-50%);
white-space:nowrap;pointer-events:none;
opacity:0;
transition:left 60ms linear,opacity 120ms ease;
}
.meter-lbl{
font-size:9px;font-weight:700;color:#555;
text-align:right;letter-spacing:.03em;
}
.meter-db{
font-size:9px;color:#888;font-family:monospace;
text-align:right;line-height:1.2;
transition:color 120ms ease;
}
.meter-db.clip{color:#ff3b2a;font-weight:700}
.meter-peak-db.clip{color:#ff3b2a;font-weight:700}
.meter-clip-led{
position:relative;flex:0 0 auto;
width:12px;height:12px;
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
#live-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
}
@media(max-width:720px){
.sw-grid{grid-template-columns:1fr}
.mtable col.col-name{width:26%}
.mtable col.col-num{width:11%}
.mtable col.col-check{width:10%}
.mtable col.col-port{width:12%}
.mtable col.col-detect{width:16%}
.mtable th,.mtable td{padding-left:4px;padding-right:4px}
.mtable th{font-size:9px}
.mtable input[type=number],.mtable select{font-size:11px}
}
@media(min-width:720px){
.meters-columns{grid-template-columns:1fr 1fr}
}
@media(min-width:860px){
.meter-wrap{max-width:320px;height:48px}
.meter-canvas{height:48px}
}

/* --- Master EQ curve --- */
#master-eq-card{margin-bottom:12px}
#master-eq-notice{
font-size:12px;font-weight:700;color:#3a3a44;
margin-bottom:6px;line-height:1.4;
}
#master-eq-caption{
font-size:11px;color:#888;margin-bottom:10px;line-height:1.45;
}
#master-eq-wrap{
width:100%;max-width:900px;margin:0 auto;
}
#master-eq-canvas{
display:block;width:100%;
height:240px;min-height:240px;
border-radius:6px;background:#fafafa;
}
@media(min-width:720px){
#master-eq-canvas{height:320px;min-height:320px}
}

/* --- Codec gain test card --- */
.codec-gain-notice{
font-size:11px;color:#888;margin-bottom:12px;line-height:1.45;
}
.codec-gain-row{
display:flex;align-items:center;gap:14px;margin-bottom:10px;
}
.codec-gain-label{
font-size:12px;font-weight:600;color:#3a3a44;white-space:nowrap;
}
.codec-gain-picker{
display:flex;align-items:stretch;
border:1px solid #ccc;border-radius:4px;overflow:hidden;
}
.codec-gain-btn{
padding:6px 14px;background:#f0f0f2;border:none;
font-size:18px;font-weight:700;color:#333;cursor:pointer;
line-height:1;transition:background .1s;
}
.codec-gain-btn:hover{background:#e0e0e4}
.codec-gain-btn:active{background:#d0d0d6}
.codec-gain-btn:disabled{color:#bbb;cursor:default;background:#f8f8f8}
.codec-gain-val{
width:54px;text-align:center;
font-family:monospace;font-size:15px;font-weight:700;
border:none;
border-left:1px solid #ccc;border-right:1px solid #ccc;
padding:6px 4px;background:#fff;color:#1a1a2e;
}
.codec-gain-section{
font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;
color:#888;margin:10px 0 4px;padding-bottom:2px;border-bottom:1px solid #e8e8ec;
}
.codec-gain-status{
font-size:11px;color:#999;margin-top:10px;line-height:1.4;
}
.codec-gain-status.ok{color:#27ae60;font-weight:600}
.codec-gain-status.err{color:#e74c3c;font-weight:600}
    `;
    document.head.appendChild(s);
}
