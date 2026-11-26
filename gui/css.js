/** Injects unified, sober, responsive GUI styles into document head. */
export function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
:root{
--bg:#eef0f3;
--bg-elev:#ffffff;
--surface:#f5f6f8;
--ink:#151922;
--ink-soft:#3d4452;
--muted:#646c7a;
--line:#dce0e6;
--line-soft:#eaedf1;
--accent:#d94336;
--ok:#1f9d55;
--warn:#d97706;
--danger:#dc2626;
--info:#2563eb;
--focus-ring:#2563eb;
--header-bg:#141821;
--btn-active-bg:#151922;
--btn-active-text:#ffffff;
--bar-fill:#2563eb;
--input-bg:#ffffff;
--input-border:#cfd5de;
--radius:10px;
--radius-sm:6px;
--shadow:0 1px 2px rgba(15,23,42,.04),0 2px 8px rgba(15,23,42,.04);
--z-chrome:100;
--z-popup:200;
--font:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
--mono:ui-monospace,'Cascadia Mono','SF Mono',Menlo,Consolas,monospace;
}

[data-theme="dark"]{
--bg:#0d1016;
--bg-elev:#141922;
--surface:#1b222d;
--ink:#edf1f7;
--ink-soft:#b9c2d0;
--muted:#848e9d;
--line:#283140;
--line-soft:#1e2531;
--accent:#ef5347;
--ok:#22c55e;
--warn:#f59e0b;
--danger:#ef4444;
--info:#3b82f6;
--focus-ring:#60a5fa;
--header-bg:#090c11;
--btn-active-bg:#3b82f6;
--btn-active-text:#ffffff;
--bar-fill:#3b82f6;
--input-bg:#11161f;
--input-border:#2d3748;
--shadow:0 1px 3px rgba(0,0,0,.35),0 4px 12px rgba(0,0,0,.25);
}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{
width:100%;height:100%;
margin:0;padding:0;
overflow:hidden;
}
body{
font-family:var(--font);
background:var(--bg);color:var(--ink);font-size:14px;
line-height:1.4;
-webkit-font-smoothing:antialiased;
text-rendering:optimizeLegibility;
}
/* p5.js injects <main> + canvas — hidden */
body > main{
display:none!important;visibility:hidden!important;
width:0!important;height:0!important;overflow:hidden!important;
position:absolute!important;pointer-events:none!important;
}

button,input,select{font-family:inherit}
button:focus-visible,input:focus-visible,select:focus-visible,[tabindex]:focus-visible{
outline:2px solid var(--focus-ring);outline-offset:2px;
}

#bela-gui{
display:flex;flex-direction:column;
width:100%;max-width:100%;
height:100dvh;overflow:hidden;
}

/* --- Top chrome --- */
#top-chrome{
flex-shrink:0;position:relative;z-index:var(--z-chrome);
padding-top:env(safe-area-inset-top);
background:var(--header-bg);
}
#gui-header{
background:var(--header-bg);color:#fff;
padding:8px 16px;
padding-left:max(16px,env(safe-area-inset-left));
padding-right:max(16px,env(safe-area-inset-right));
display:flex;align-items:center;gap:8px;flex-wrap:wrap;
width:100%;min-height:46px;
}
#gui-header .spacer{flex:1;min-width:8px}
#gui-logo{
height:34px;width:auto;
mix-blend-mode:screen;opacity:.92;flex-shrink:0;
}
.badge{
background:#4b5563;color:#fff;font-size:10px;font-weight:700;
padding:3px 8px;border-radius:999px;letter-spacing:.05em;
line-height:1.2;white-space:nowrap;
}
.badge.live{background:var(--ok)}
.badge.lag{background:var(--warn);color:#111}
.badge.temp{
background:#1d4ed8;font-variant-numeric:tabular-nums;
letter-spacing:.02em;min-width:3.6em;text-align:center;
}
.badge.temp.warm{background:var(--warn);color:#111}
.badge.temp.hot{background:var(--danger)}
.badge.temp.unknown{background:#4b5563}
.badge.dev-badge{
display:none;background:#0369a1;color:#fff;letter-spacing:.05em;
}
.badge.dev-badge.visible{display:inline-block}
.clip-badges{
display:flex;align-items:center;gap:5px;flex-wrap:wrap;min-width:0;
}
.badge.clip{
display:none;background:var(--danger);letter-spacing:.04em;
}
.badge.clip.on{display:inline-block}

/* --- Tab bar --- */
#tab-bar{
display:flex;align-items:center;
background:var(--bg-elev);
border-bottom:1px solid var(--line);
width:100%;
padding:0 8px;
padding-left:max(8px,env(safe-area-inset-left));
padding-right:max(8px,env(safe-area-inset-right));
overflow-x:auto;scrollbar-width:none;
}
#tab-bar::-webkit-scrollbar{display:none}
.tab-btn{
flex-shrink:0;
padding:11px 16px;min-height:42px;
font-size:13px;font-weight:600;color:var(--muted);
cursor:pointer;border:none;background:none;
border-bottom:2px solid transparent;
white-space:nowrap;letter-spacing:.01em;
transition:color .12s ease,border-color .12s ease;
}
.tab-btn:hover{color:var(--ink)}
.tab-btn.active{color:var(--ink);border-bottom-color:var(--accent)}
.tab-bar-spacer{flex:1;min-width:8px}

.theme-toggle-btn,.live-layout-gear{
flex-shrink:0;height:32px;padding:0 10px;margin-left:4px;
font-size:12px;font-weight:600;color:var(--muted);
cursor:pointer;border:1px solid transparent;border-radius:var(--radius-sm);
background:transparent;display:inline-flex;align-items:center;gap:6px;
user-select:none;white-space:nowrap;
transition:color .12s ease,background .12s ease,border-color .12s ease;
}
.theme-toggle-btn:hover,.live-layout-gear:hover{
color:var(--ink);background:var(--surface);border-color:var(--line);
}
.live-layout-gear.active{
color:var(--btn-active-text);background:var(--btn-active-bg);border-color:var(--btn-active-bg);
}

/* --- Main scroll container --- */
#tab-content{
flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;
padding:16px;
padding-left:max(16px,env(safe-area-inset-left));
padding-right:max(16px,env(safe-area-inset-right));
padding-bottom:calc(20px + env(safe-area-inset-bottom));
}
.tab-pane{display:none;max-width:1180px;margin:0 auto}
.tab-pane.active{display:block}

/* --- Shared Cards --- */
.card{
background:var(--bg-elev);border-radius:var(--radius);
border:1px solid var(--line);box-shadow:var(--shadow);
padding:14px 16px;margin-bottom:12px;
}
.card-header-row{
display:flex;align-items:center;justify-content:space-between;
gap:10px;margin-bottom:12px;flex-wrap:wrap;
}
.card-header-row .card-title{margin-bottom:0}
.card-title{
font-size:11px;font-weight:700;letter-spacing:.08em;
text-transform:uppercase;color:var(--ink-soft);margin-bottom:12px;
text-wrap:balance;
}
.card-meta{
font-size:11px;font-weight:600;color:var(--muted);
}

/* --- Live Board & Grid --- */
#live-board{display:flex;flex-direction:column;gap:12px}
#live-board > .card,
#live-board > #meters-wrap,
#live-board > #live-grid{margin-bottom:0}
#live-grid{display:grid;grid-template-columns:1fr;gap:12px}
#live-grid > .card{margin-bottom:0;display:flex;flex-direction:column}
@media(min-width:640px){
#live-grid{grid-template-columns:1fr 1fr;align-items:stretch}
#live-grid.live-grid-single{grid-template-columns:1fr}
#live-grid > .card{height:100%}
#live-grid #siren-body,
#live-grid #mic-inputs-card .mic-live-list{flex:1}
}

/* --- Siren --- */
#siren-body{display:flex;flex-direction:column;gap:12px}
#siren-hero{
background:var(--surface);border-radius:8px;padding:12px 14px;
border:1px solid var(--line-soft);border-left:3px solid var(--accent);
}
#siren-hero-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
#siren-name{font-size:17px;font-weight:700;color:var(--ink);line-height:1.2}
#siren-gate{display:flex;align-items:center;gap:6px;flex-shrink:0}
#siren-gate-dot{
display:inline-block;width:9px;height:9px;border-radius:50%;
background:var(--muted);transition:background .1s ease;
}
#siren-gate-dot.on{background:var(--accent)}
.gate-lbl{font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.04em;text-transform:uppercase}
#siren-mod-row{display:flex;align-items:center;gap:10px;margin-top:10px}
.siren-mod-label{
flex:0 0 auto;font-size:10px;font-weight:700;color:var(--muted);
letter-spacing:.05em;text-transform:uppercase;
}
#siren-mod-track{
flex:1;height:6px;background:var(--line);border-radius:3px;overflow:hidden;min-width:0;
}
#siren-mod-fill{
display:block;height:100%;width:0%;background:var(--bar-fill);
border-radius:3px;transition:width .05s linear;
}
#siren-mod-lbl{
flex:0 0 38px;font-size:11px;font-weight:700;color:var(--muted);
font-family:var(--mono);font-variant-numeric:tabular-nums;text-align:right;
}
#siren-presets{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;width:100%}
.spreset{
padding:8px 4px;border-radius:var(--radius-sm);
background:var(--surface);border:1px solid var(--line);
font-size:10px;font-weight:700;color:var(--muted);
text-align:center;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
transition:background .12s ease,color .12s ease,border-color .12s ease;
}
.spreset.active{
background:var(--btn-active-bg);border-color:var(--btn-active-bg);color:var(--btn-active-text);
}
.spreset.active.gate{background:var(--accent);border-color:var(--accent);color:#fff}

/* --- Mic inputs --- */
#mic-inputs-card{margin:0;max-width:100%;display:flex;flex-direction:column}
.mic-live-list{display:flex;flex-direction:column;gap:6px}
.mic-live-row{
display:flex;align-items:center;gap:10px;flex-wrap:wrap;
padding:8px 10px;background:var(--surface);border:1px solid var(--line);border-radius:8px;
}
.mic-live-label{
font-weight:700;font-size:12px;min-width:42px;letter-spacing:.04em;color:var(--ink);
}
.mic-toggle{
display:inline-flex;align-items:center;gap:8px;cursor:pointer;user-select:none;min-height:28px;
}
.mic-toggle-input{position:absolute;opacity:0;width:0;height:0;pointer-events:none}
.mic-toggle-track{
position:relative;display:inline-block;width:36px;height:20px;
background:var(--muted);border-radius:999px;transition:background .15s ease;flex-shrink:0;
}
.mic-toggle-thumb{
position:absolute;top:2px;left:2px;width:16px;height:16px;
background:#fff;border-radius:50%;transition:transform .15s ease;
}
.mic-toggle-input:checked + .mic-toggle-track{background:var(--ok)}
.mic-toggle-input:checked + .mic-toggle-track .mic-toggle-thumb{transform:translateX(16px)}
.mic-toggle-input:focus-visible + .mic-toggle-track{outline:2px solid var(--focus-ring);outline-offset:2px}
.mic-toggle-text{font-size:12px;font-weight:600;color:var(--ink-soft);min-width:2em}
.mic-toggle-input:checked ~ .mic-toggle-text{color:var(--ok)}
.mic-live-hpf{
display:flex;align-items:center;gap:5px;font-size:12px;margin-left:auto;
color:var(--ink-soft);font-weight:600;
}
.mic-live-hpf input[type=number]{
width:60px;padding:4px 6px;border:1px solid var(--input-border);border-radius:5px;
font-size:12px;font-variant-numeric:tabular-nums;background:var(--input-bg);color:var(--ink);
}
.mic-live-hpf-unit{color:var(--muted);font-size:11px;font-weight:500}

/* --- Sampler --- */
#sampler-body{display:flex;flex-direction:column;gap:8px}
.sampler-empty{
padding:12px;border:1px dashed var(--line);border-radius:8px;
font-size:12px;line-height:1.45;color:var(--muted);background:var(--surface);
text-wrap:pretty;
}
.sampler-grid{
display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,142px),1fr));gap:8px;
}
.sampler-pad{
display:flex;align-items:center;justify-content:flex-start;
min-height:38px;padding:0 12px;border-radius:8px;cursor:pointer;
background:var(--surface);border:1px solid var(--line);
font-family:var(--mono);font-size:11px;font-weight:700;color:var(--ink);
text-align:left;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
transition:background .12s ease,border-color .12s ease,transform .08s ease;
}
.sampler-pad:hover{border-color:var(--muted);background:var(--bg-elev)}
.sampler-pad:active{transform:scale(.98)}
.sampler-pad.playing{
border-color:var(--accent);background:rgba(217,67,54,.14);color:var(--accent);
}

/* --- Console --- */
.console-header{
display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;
}
.console-header .card-title{margin-bottom:0}
.console-filter{display:flex;gap:4px}
.console-filter-btn{
padding:4px 10px;font-size:11px;font-weight:600;color:var(--muted);
cursor:pointer;border:1px solid var(--line);border-radius:999px;
background:var(--surface);transition:background .12s ease,color .12s ease,border-color .12s ease;
}
.console-filter-btn:hover{color:var(--ink);border-color:var(--muted)}
.console-filter-btn.active{
background:var(--btn-active-bg);color:var(--btn-active-text);border-color:var(--btn-active-bg);
}
.console-list{list-style:none;margin:0;padding:0;position:relative;overflow:hidden}
.crow{
display:flex;align-items:center;gap:8px;
padding:5px 6px;border-bottom:1px solid var(--line-soft);
border-left:3px solid transparent;border-radius:4px;
background:transparent;transition:background .4s ease,border-left-color .4s ease;
}
.crow:last-child{border-bottom:none}
.crow.empty .cname{color:transparent}
.crow.empty .cval-group{visibility:hidden}
.cname{
flex:0 1 clamp(92px,30vw,160px);min-width:0;
font-family:var(--mono);font-size:11px;font-weight:600;color:var(--ink);
white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.ctrack{flex:1;min-width:36px;height:5px;background:var(--line-soft);border-radius:3px;overflow:hidden;position:relative}
.cfill{
display:block;height:100%;min-width:0;background:var(--bar-fill);border-radius:3px;
transition:width .08s ease-out;
}
.crow.sw .cfill{background:var(--accent)}
.crow.empty .cfill-loading{width:18%;background:var(--line);transition:none}
.cval-group{
display:flex;align-items:center;gap:4px;flex:0 0 auto;
font-family:var(--mono);font-size:11px;font-variant-numeric:tabular-nums;
}
.coldval{color:var(--muted);opacity:.65;min-width:38px;text-align:right}
.cdir{width:12px;text-align:center;font-size:10px;line-height:1;font-weight:700;user-select:none}
.cdir.up{color:var(--ok)}
.cdir.down{color:var(--warn)}
.cdir.sw{color:var(--accent)}
.cval{min-width:38px;text-align:right;color:var(--muted)}
.crow.active{background:rgba(37,99,235,.09);border-left-color:var(--info)}
.crow.active .cname,.crow.active .cval{color:var(--ink);font-weight:700}
.crow.active .coldval{opacity:1;color:var(--ink-soft)}
.crow.sw.active{background:rgba(217,67,54,.09);border-left-color:var(--accent)}

/* --- Switches --- */
.sw-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:4px}
@media(max-width:720px){.sw-grid{grid-template-columns:1fr}}
.sw-group{
background:var(--surface);border:1px solid var(--line);
border-radius:8px;padding:10px 12px;
}
.sw-group-kill{border-top:2px solid var(--danger)}
.sw-group-fx{border-top:2px solid var(--warn)}
.sw-group-siren{border-top:2px solid var(--info)}
.sw-group-title{
font-size:11px;font-weight:700;text-transform:uppercase;
letter-spacing:.06em;color:var(--ink-soft);margin-bottom:8px;
}
.sw-group-items{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.sw-group-siren .sw-group-items{grid-template-columns:1fr}
.sw-tile{
display:flex;align-items:center;gap:8px;padding:8px 10px;
background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius-sm);
}
.sw-tile-kill.on{border-color:var(--danger);background:rgba(220,38,38,.1)}
.sw-tile-fx.on{border-color:var(--warn);background:rgba(217,119,6,.1)}
.sw-tile-siren.on{border-color:var(--info);background:rgba(37,99,235,.1)}
.sw-led{flex-shrink:0;width:8px;height:8px;border-radius:50%;background:var(--muted)}
.sw-tile-kill.on .sw-led{background:var(--danger)}
.sw-tile-fx.on .sw-led{background:var(--warn)}
.sw-tile-siren.on .sw-led{background:var(--info)}
.sw-tile-name{font-size:10px;font-weight:700;color:var(--ink);letter-spacing:.04em}

/* --- VU Meters --- */
#meters-wrap{display:flex;flex-direction:column;gap:10px;margin:0}
.meters-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:stretch}
@media(max-width:760px){.meters-columns{grid-template-columns:1fr}}
.meters-card{min-width:0;height:100%;margin-bottom:0;display:flex;flex-direction:column}
.meter-group{display:flex;flex-direction:column;gap:6px;align-items:stretch;padding:2px 0;flex:1}
.meter-ch{
display:flex;flex-direction:row;align-items:center;gap:8px;
width:100%;min-width:0;padding-top:11px;
}
.meter-id{
display:flex;flex-direction:column;gap:2px;
min-width:64px;width:64px;flex-shrink:0;align-items:flex-start;text-align:left;
}
.meter-strip{display:flex;flex-direction:row;align-items:stretch;flex:1 1 0;min-width:0}
.meter-body{display:flex;flex-direction:column;gap:2px;flex:1 1 0;min-width:0}
.meter-wrap{position:relative;flex:1 1 0;min-width:0;width:100%;height:26px;cursor:pointer}
.meter-canvas{display:block;width:100%;height:26px}
.meter-scale{
display:flex;justify-content:space-between;width:100%;padding:0 1px;
font-size:8px;font-family:var(--mono);font-variant-numeric:tabular-nums;color:var(--muted);
line-height:1;user-select:none;pointer-events:none;
}
.meter-peak-db{
position:absolute;top:-12px;left:0;font-size:9px;font-family:var(--mono);
font-variant-numeric:tabular-nums;color:var(--muted);
transform:translateX(-50%);white-space:nowrap;pointer-events:none;opacity:0;
transition:left 60ms linear,opacity 120ms ease;
}
.meter-peak-db.clip{color:var(--danger);font-weight:700}
.meter-lbl{font-size:10px;font-weight:700;color:var(--ink-soft);letter-spacing:.03em}
.meter-gain-val{
font-size:11px;font-family:var(--mono);font-variant-numeric:tabular-nums;
font-weight:700;color:var(--ink);line-height:1.2;
}
.meter-clip-led{position:relative;flex:0 0 auto;width:10px;height:10px;align-self:center}
.meter-clip-led__bezel{
position:absolute;inset:0;border-radius:50%;
background:#262b35;border:1px solid #3c4352;
}
.meter-clip-led__core{
position:absolute;inset:2px;border-radius:50%;
background:#471a16;transition:background 100ms ease;
}
.meter-clip-led.on .meter-clip-led__core{background:#ef4444}
.meter-gain-btn{
flex:0 0 auto;align-self:flex-start;width:24px;height:26px;padding:0;margin:0;
border:1px solid var(--line);background:var(--surface);color:var(--ink-soft);
font-size:13px;font-weight:700;line-height:1;cursor:pointer;
transition:background .1s ease,color .1s ease;
}
.meter-gain-btn--dec{border-radius:4px 0 0 4px;border-right:none}
.meter-gain-btn--inc{border-radius:0 4px 4px 0;border-left:none}
.meter-gain-btn:hover:not(:disabled){background:var(--bg-elev);color:var(--ink)}
.meter-gain-btn:disabled{opacity:.35;cursor:default}
.meter-mode-btn{
align-self:flex-start;padding:2px 6px;font-size:9px;font-family:var(--mono);
font-weight:700;line-height:1.2;border-radius:4px;border:1px solid transparent;
cursor:pointer;letter-spacing:.04em;user-select:none;
}
.meter-mode-btn.stereo{background:var(--ok);color:#fff}
.meter-mode-btn.mono{background:var(--warn);color:#111}

@media(max-width:480px){
.meter-ch{
display:grid;grid-template-columns:1fr auto;grid-template-rows:auto auto;
gap:4px 8px;padding-top:12px;
}
.meter-id{
grid-column:1;grid-row:1;width:auto;min-width:0;
flex-direction:row;align-items:center;gap:8px;
}
.meter-clip-led{grid-column:2;grid-row:1}
.meter-strip{grid-column:1 / -1;grid-row:2}
.meter-gain-btn{width:28px}
}

/* --- Master EQ --- */
.master-eq-wrap{width:100%;max-width:920px;margin:0 auto}
.master-eq-canvas{display:block;width:100%;height:220px;min-height:220px;border-radius:6px}
@media(min-width:720px){.master-eq-canvas{height:300px;min-height:300px}}

/* --- Live layout popup --- */
#live-layout-popup{position:fixed;inset:0;z-index:var(--z-popup)}
#live-layout-popup[hidden]{display:none!important}
.live-layout-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.48)}
.live-layout-panel{
position:absolute;z-index:1;max-height:min(72dvh,520px);overflow-y:auto;
background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius);
box-shadow:var(--shadow);padding:14px;
}
.live-layout-title{
font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
color:var(--ink-soft);margin-bottom:4px;
}
.live-layout-hint{font-size:11px;color:var(--muted);margin-bottom:10px}
.live-layout-list{display:flex;flex-direction:column;gap:6px}
.live-layout-row{
display:flex;align-items:center;justify-content:space-between;gap:10px;
font-size:13px;font-weight:600;color:var(--ink);user-select:none;
padding:6px 8px;border-radius:6px;background:var(--surface);border:1px solid var(--line-soft);
}
.live-layout-check{display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;min-width:0}
.live-layout-check input{width:16px;height:16px;accent-color:var(--accent);cursor:pointer}
.live-layout-moves{display:flex;gap:4px;flex-shrink:0}
.live-layout-move{
width:30px;height:30px;padding:0;font-size:11px;line-height:1;
color:var(--muted);cursor:pointer;border:1px solid var(--line);
border-radius:6px;background:var(--bg-elev);
}
.live-layout-move:hover:not(:disabled){color:var(--ink);border-color:var(--muted)}
.live-layout-move:disabled{opacity:.35;cursor:default}

/* --- Controls Tab (Virtual / Dev) --- */
.dev-banner{
margin-bottom:12px;padding:12px 16px;border-left:3px solid var(--muted);
}
.dev-banner.dev-active{border-left-color:var(--ok)}
.dev-banner-top{
display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;
margin-bottom:10px;
}
.dev-banner-title-box{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dev-banner-title{font-size:15px;font-weight:700;color:var(--ink)}
.dev-mode-pill{
font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;
background:var(--surface);border:1px solid var(--line);color:var(--muted);
}
.dev-banner.dev-active .dev-mode-pill{
border-color:var(--ok);color:var(--ok);background:rgba(31,157,85,.1);
}
.dev-toggle-btn{
padding:8px 14px;font-size:12px;font-weight:700;
border-radius:var(--radius-sm);border:1px solid var(--line);
background:var(--surface);color:var(--ink-soft);cursor:pointer;
transition:background .12s ease,color .12s ease,border-color .12s ease;
}
.dev-toggle-btn:hover{border-color:var(--muted);color:var(--ink)}
.dev-toggle-btn.active{background:var(--ok);color:#fff;border-color:var(--ok)}
.dev-actions-row{
display:flex;gap:8px;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--line-soft);
}
.dev-action-btn,.dev-small-btn{
padding:6px 12px;font-size:12px;font-weight:600;
border-radius:var(--radius-sm);border:1px solid var(--line);
background:var(--surface);color:var(--ink-soft);cursor:pointer;
transition:background .12s ease,color .12s ease,border-color .12s ease;
}
.dev-action-btn:hover,.dev-small-btn:hover{background:var(--bg-elev);color:var(--ink);border-color:var(--muted)}
.dev-controls-container{display:flex;flex-direction:column;gap:12px;transition:opacity .15s ease}
.dev-controls-container.disabled-controls{opacity:.48;pointer-events:none;user-select:none}
.dev-section{padding:14px 16px;margin-bottom:0}
.dev-sub-panel{
background:var(--surface);border:1px solid var(--line);
border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:10px;
}
.dev-sub-heading{
font-size:11px;font-weight:700;color:var(--ink-soft);
text-transform:uppercase;letter-spacing:.06em;
}
.dev-row-between{display:flex;justify-content:space-between;align-items:center;gap:8px}
.dev-grid-2col{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px;margin-top:10px}
.dev-channels-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:12px;margin-top:4px}
.dev-channel-col{
background:var(--surface);border:1px solid var(--line);border-radius:8px;
padding:12px;display:flex;flex-direction:column;gap:10px;
}
.dev-channel-hdr{
font-size:12px;font-weight:700;color:var(--ink);letter-spacing:.04em;
text-align:center;padding-bottom:6px;border-bottom:1px solid var(--line);
}
.dev-eq-box{
background:var(--bg-elev);border:1px solid var(--line-soft);
border-radius:6px;padding:8px;display:flex;flex-direction:column;gap:8px;
}
.dev-pot-grid-2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:10px}
.dev-geq-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,132px),1fr));gap:10px;margin-top:4px}
.dev-pot-item{display:flex;flex-direction:column;gap:4px}
.dev-pot-top{display:flex;justify-content:space-between;align-items:baseline;gap:6px;font-size:12px}
.dev-pot-label{font-weight:600;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dev-pot-val{
font-family:var(--mono);font-size:11px;font-variant-numeric:tabular-nums;
color:var(--ink);font-weight:700;flex-shrink:0;
}
.dev-pot-slider,.fx-range-slider{
width:100%;height:6px;border-radius:3px;background:var(--line);
outline:none;-webkit-appearance:none;appearance:none;cursor:pointer;
}
.dev-pot-slider::-webkit-slider-thumb,.fx-range-slider::-webkit-slider-thumb{
-webkit-appearance:none;appearance:none;width:16px;height:16px;border-radius:50%;
background:var(--ink);border:2px solid var(--bg-elev);cursor:pointer;
}
.dev-pot-slider.centered::-webkit-slider-thumb{background:var(--info)}
.dev-kill-section{margin-bottom:10px}
.dev-kill-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:8px}
@media(max-width:560px){.dev-kill-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
.dev-kill-btn{
padding:10px 8px;border-radius:var(--radius-sm);border:1px solid var(--line);
background:var(--surface);color:var(--ink-soft);cursor:pointer;
display:flex;flex-direction:column;align-items:center;gap:2px;
font-size:13px;font-weight:800;letter-spacing:.04em;
transition:background .12s ease,color .12s ease,border-color .12s ease;
}
.dev-kill-btn:hover{border-color:var(--muted);color:var(--ink)}
.dev-kill-btn.active{background:var(--danger);color:#fff;border-color:var(--danger)}
.dev-kill-sub{font-size:10px;font-weight:600;opacity:.75;font-variant-numeric:tabular-nums}
.dev-fx-mode-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dev-fx-mode-row .dev-pot-label{min-width:72px;font-size:12px}
.dev-mode-btn{
flex:1;min-width:76px;padding:6px 10px;font-size:11px;font-weight:700;
border-radius:var(--radius-sm);border:1px solid var(--line);
background:var(--bg-elev);color:var(--ink-soft);cursor:pointer;
}
.dev-mode-btn.active{background:var(--btn-active-bg);color:var(--btn-active-text);border-color:var(--btn-active-bg)}
.dev-siren-trigger-box{display:flex;gap:8px;margin-top:4px;flex-wrap:wrap}
.dev-siren-trig-btn{
flex:2;min-width:140px;padding:12px;font-size:13px;font-weight:700;
border-radius:var(--radius-sm);border:1px solid var(--warn);
background:rgba(217,119,6,.1);color:var(--warn);cursor:pointer;
user-select:none;touch-action:none;text-align:center;
}
.dev-siren-trig-btn.firing{background:var(--warn);color:#111}
.dev-siren-latch-btn{
flex:1;min-width:96px;padding:10px 12px;font-size:12px;font-weight:700;
border-radius:var(--radius-sm);border:1px solid var(--line);
background:var(--bg-elev);color:var(--ink-soft);cursor:pointer;
}
.dev-siren-latch-btn.active{background:var(--warn);color:#111;border-color:var(--warn)}

/* --- FX Tab --- */
.fx-pane-container{display:flex;flex-direction:column;gap:12px}
.fx-card{
background:var(--bg-elev);border:1px solid var(--line);
border-radius:var(--radius);padding:14px 16px;box-shadow:var(--shadow);
display:flex;flex-direction:column;
}
.fx-card-header{
display:flex;justify-content:space-between;align-items:center;
gap:10px;margin-bottom:10px;flex-wrap:wrap;
}
.fx-card-title{
font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--ink);
}
.fx-routing-tools{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.fx-tool-btn{
display:inline-flex;align-items:center;gap:5px;
padding:5px 10px;font-size:11px;font-weight:600;border-radius:999px;
border:1px solid var(--line);background:var(--surface);color:var(--ink-soft);cursor:pointer;
transition:background .12s ease,color .12s ease,border-color .12s ease;
}
.fx-tool-btn:hover{border-color:var(--muted);color:var(--ink)}
.fx-tool-btn.active{background:var(--btn-active-bg);color:var(--btn-active-text);border-color:var(--btn-active-bg)}
.fx-matrix-table{display:flex;flex-direction:column;gap:8px}
.fx-matrix-row{
display:flex;align-items:center;gap:10px;padding:8px 12px;
background:var(--surface);border:1px solid var(--line-soft);border-radius:8px;
}
.fx-matrix-ch-label{min-width:58px;flex-shrink:0}
.fx-ch-badge{
display:inline-block;font-size:11px;font-weight:700;letter-spacing:.04em;
padding:4px 8px;background:var(--bg-elev);border:1px solid var(--line);
border-radius:var(--radius-sm);color:var(--ink);
}
.fx-matrix-sends{
flex:1;min-width:0;display:grid;
grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:8px 12px;
}
.fx-matrix-send-col{display:flex;flex-direction:row;align-items:center;gap:6px;min-width:0}
.fx-send-tag{
font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.05em;
text-transform:uppercase;flex-shrink:0;min-width:16px;
}
.fx-send-triggers{display:inline-flex;align-items:center;gap:4px;flex-shrink:0}
.fx-trig-btn{
display:inline-flex;align-items:center;gap:4px;
padding:4px 9px;font-size:11px;font-weight:700;border-radius:var(--radius-sm);
border:1px solid var(--line);background:var(--bg-elev);color:var(--ink-soft);
cursor:pointer;user-select:none;touch-action:none;white-space:nowrap;
transition:background .1s ease,color .1s ease,border-color .1s ease;
}
.fx-trig-btn:hover{border-color:var(--muted);color:var(--ink)}
.fx-trig-btn.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.fx-trig-btn.fx-trig-latch.active{background:var(--info);color:#fff;border-color:var(--info)}
.fx-route-select{
flex:1;min-width:96px;padding:5px 8px;font-size:12px;font-weight:600;
border-radius:var(--radius-sm);border:1px solid var(--line);
background:var(--bg-elev);color:var(--ink);cursor:pointer;
transition:border-color .12s ease,background .12s ease;
}
.fx-route-select:hover{border-color:var(--muted)}
.fx-route-select:focus-visible{outline:2px solid var(--focus-ring);outline-offset:1px}
.fx-route-select[data-dest="7"]{color:var(--muted)}

.fx-modules-grid{
display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px;
}
.fx-toggle-wrap{
display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none;
}
.fx-toggle-wrap input{position:absolute;opacity:0;width:0;height:0;pointer-events:none}
.fx-toggle-track{
position:relative;display:inline-block;width:34px;height:19px;
background:var(--muted);border-radius:999px;transition:background .15s ease;
}
.fx-toggle-thumb{
position:absolute;top:2px;left:2px;width:15px;height:15px;
background:#fff;border-radius:50%;transition:transform .15s ease;
}
.fx-toggle-wrap input:checked + .fx-toggle-track{background:var(--ok)}
.fx-toggle-wrap input:checked + .fx-toggle-track .fx-toggle-thumb{transform:translateX(15px)}
.fx-toggle-wrap input:focus-visible + .fx-toggle-track{outline:2px solid var(--focus-ring);outline-offset:2px}
.fx-meter-track{
height:4px;background:var(--surface);border-radius:2px;overflow:hidden;margin-bottom:12px;
border:1px solid var(--line-soft);
}
.fx-meter-fill{height:100%;width:0%;background:var(--bar-fill);transition:width 60ms linear}
.fx-meter-fill.ducker-fill{background:var(--danger)}
.fx-meter-fill.sub-fill,.fx-meter-fill.spring-fill,.fx-meter-fill.shimmer-fill{background:var(--warn)}
.fx-meter-fill.tape-fill,.fx-meter-fill.phase-fill{background:var(--accent)}
.fx-controls-list{display:flex;flex-direction:column;gap:11px;flex:1}
.fx-slider-item{display:flex;flex-direction:column;gap:4px}
.fx-slider-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.fx-slider-lbl{font-size:12px;font-weight:600;color:var(--ink-soft)}
.fx-slider-val{
font-family:var(--mono);font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;
color:var(--ink);background:var(--surface);padding:2px 6px;border-radius:4px;
border:1px solid var(--line-soft);
}
.fx-slider-val.warn{color:var(--danger);border-color:var(--danger);background:rgba(220,38,38,.1)}
.fx-preset-row{display:flex;gap:5px;flex-wrap:wrap}
.fx-mini-btn{
padding:4px 8px;font-size:11px;font-weight:600;border-radius:5px;
border:1px solid var(--line);background:var(--surface);color:var(--ink-soft);cursor:pointer;
transition:background .1s ease,color .1s ease,border-color .1s ease;
}
.fx-mini-btn:hover{color:var(--ink);border-color:var(--muted)}
.fx-mini-btn.active{background:var(--btn-active-bg);color:var(--btn-active-text);border-color:var(--btn-active-bg)}
.fx-action-box{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.fx-big-btn{
flex:1;min-width:100px;padding:9px 12px;font-size:12px;font-weight:700;
border-radius:var(--radius-sm);cursor:pointer;text-align:center;
border:1px solid var(--line);background:var(--surface);color:var(--ink-soft);
transition:background .12s ease,color .12s ease,border-color .12s ease;
}
.fx-big-btn:hover{border-color:var(--muted);color:var(--ink)}
.btn-kill-send.active{background:var(--danger);color:#fff;border-color:var(--danger)}
.btn-stages.active{background:var(--btn-active-bg);color:var(--btn-active-text);border-color:var(--btn-active-bg)}
.btn-clear-delay.flash,.btn-splash.flash{background:var(--info);color:#fff;border-color:var(--info)}

/* --- Mapping Tab (3-view guided redesign) --- */
.map-topbar{
display:flex;align-items:center;justify-content:space-between;
gap:10px;flex-wrap:wrap;margin-bottom:12px;
}
.map-subtabs{
display:inline-flex;background:var(--surface);border:1px solid var(--line);
border-radius:8px;padding:3px;gap:2px;flex-wrap:wrap;
}
.map-subtab{
padding:6px 12px;font-size:12px;font-weight:600;color:var(--muted);
border:none;background:transparent;border-radius:6px;cursor:pointer;
transition:background .12s ease,color .12s ease;
}
.map-subtab:hover{color:var(--ink)}
.map-subtab.active{background:var(--bg-elev);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.map-topbar-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.map-conflict-pill{
display:none;padding:6px 10px;font-size:11px;font-weight:700;border-radius:999px;
border:1px solid var(--danger);background:rgba(220,38,38,.1);color:var(--danger);cursor:pointer;
}
.map-conflict-pill.show{display:inline-flex;align-items:center;gap:5px}
.btn-export,.btn-map-secondary,.btn-save,.btn-restart,.btn-danger-outline,.btn-danger-solid{
display:inline-flex;align-items:center;gap:6px;
padding:8px 13px;border-radius:var(--radius-sm);font-size:12px;font-weight:600;cursor:pointer;
border:1px solid transparent;transition:opacity .12s ease,background .12s ease,border-color .12s ease,color .12s ease;
}
.btn-export,.btn-save{background:var(--btn-active-bg);color:var(--btn-active-text)}
.btn-map-secondary{background:var(--surface);color:var(--ink-soft);border-color:var(--line)}
.btn-map-secondary:hover:not(:disabled){color:var(--ink);border-color:var(--muted);background:var(--bg-elev)}
.btn-restart{background:rgba(217,119,6,.14);color:var(--warn);border-color:rgba(217,119,6,.45)}
.btn-restart:hover:not(:disabled){background:var(--warn);color:#111;border-color:var(--warn)}
.btn-danger-outline{background:rgba(220,38,38,.1);color:var(--danger);border-color:rgba(220,38,38,.35)}
.btn-danger-outline:hover:not(:disabled){background:var(--danger);color:#fff;border-color:var(--danger)}
.btn-danger-solid{background:var(--danger);color:#fff}
.btn-export:hover:not(:disabled),.btn-save:hover:not(:disabled),.btn-danger-solid:hover:not(:disabled){opacity:.9}
.btn-export:disabled,.btn-map-secondary:disabled,.btn-save:disabled,.btn-restart:disabled,.btn-danger-outline:disabled,.btn-danger-solid:disabled{
opacity:.45;cursor:default;
}
.map-dirty-pill{
display:none;padding:4px 9px;font-size:11px;font-weight:700;border-radius:999px;
border:1px solid rgba(217,119,6,.45);background:rgba(217,119,6,.12);color:var(--warn);
}
.map-dirty-pill.show{display:inline-flex;align-items:center}
.map-toast{
position:fixed;right:max(18px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));
z-index:calc(var(--z-popup) + 10);max-width:min(420px,calc(100vw - 36px));
padding:10px 14px;border-radius:var(--radius-sm);
background:var(--bg-elev);border:1px solid var(--ok);border-left:4px solid var(--ok);
box-shadow:var(--shadow);font-size:12px;font-weight:600;color:var(--ink);
opacity:0;transform:translateY(8px);pointer-events:none;
transition:opacity .15s ease,transform .15s ease;
}
.map-toast.show{opacity:1;transform:translateY(0)}
.map-toast.err{border-color:var(--danger);border-left-color:var(--danger);color:var(--danger)}
.map-conflicts-box{
display:none;font-size:12px;color:var(--danger);
background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.35);
border-left:3px solid var(--danger);padding:10px 12px;border-radius:var(--radius-sm);margin-bottom:12px;
}
.map-conflicts-box.show{display:block}
.map-conflicts-box ul{margin:6px 0 0 16px}
.map-conflicts-box li{margin:2px 0;font-family:var(--mono);font-size:11px}

.map-guided-bar{
display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
padding:10px 14px;margin-bottom:12px;border-radius:var(--radius);
background:var(--bg-elev);border:1px solid var(--line);
}
.map-guided-bar.listening{
border-color:var(--info);background:rgba(37,99,235,.08);
}
.map-guided-info{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.map-guided-step{
font-size:11px;font-weight:700;color:var(--info);text-transform:uppercase;
letter-spacing:.05em;font-variant-numeric:tabular-nums;
}
.map-guided-prompt{font-size:13px;font-weight:600;color:var(--ink)}
.map-guided-actions{display:flex;gap:6px;flex-shrink:0}
.map-filter-bar{
display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px;
}
.map-filter-pills{display:flex;gap:4px;flex-wrap:wrap}
.map-filter-pill{
padding:5px 10px;font-size:11px;font-weight:600;border-radius:999px;
border:1px solid var(--line);background:var(--bg-elev);color:var(--muted);cursor:pointer;
}
.map-filter-pill:hover{color:var(--ink);border-color:var(--muted)}
.map-filter-pill.active{background:var(--btn-active-bg);color:var(--btn-active-text);border-color:var(--btn-active-bg)}
.map-search{
padding:6px 10px;border:1px solid var(--input-border);border-radius:var(--radius-sm);
background:var(--input-bg);color:var(--ink);font-size:12px;min-width:170px;
}
.map-groups{display:flex;flex-direction:column;gap:10px}
.map-group{
background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;
}
.map-group-hdr{
display:flex;align-items:center;justify-content:space-between;gap:8px;
width:100%;padding:10px 14px;border:none;background:var(--surface);
color:var(--ink);cursor:pointer;text-align:left;border-bottom:1px solid var(--line-soft);
}
.map-group[data-collapsed="true"] .map-group-hdr{border-bottom-color:transparent}
.map-group[data-collapsed="true"] .map-group-body{display:none}
.map-group-title{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase}
.map-group-count{font-size:11px;font-family:var(--mono);font-variant-numeric:tabular-nums;color:var(--muted)}
.map-group-body{display:flex;flex-direction:column}
.map-row{
display:grid;grid-template-columns:minmax(140px,1.3fr) minmax(70px,.7fr) auto auto auto;
align-items:center;gap:10px;padding:8px 14px;
border-bottom:1px solid var(--line-soft);
}
.map-row:last-child{border-bottom:none}
.map-row.row-detecting{background:rgba(37,99,235,.1)}
.map-row.dup-conflict{background:rgba(220,38,38,.08)}
.map-row-main{min-width:0}
.map-row-name{font-size:13px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.map-row-sub{font-size:10px;font-family:var(--mono);color:var(--muted)}
.map-live-meter{
height:5px;background:var(--surface);border-radius:3px;overflow:hidden;
border:1px solid var(--line-soft);min-width:54px;
}
.map-live-fill{height:100%;width:0%;background:var(--bar-fill)}
.map-live-fill.sw{background:var(--accent)}
.map-row-fields{display:flex;align-items:center;gap:6px}
.map-field{display:inline-flex;align-items:center;gap:4px}
.map-field-lbl{font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase}
.map-num,.map-select{
width:54px;padding:4px 5px;border:1px solid var(--input-border);border-radius:5px;
background:var(--input-bg);color:var(--ink);font-size:12px;
font-family:var(--mono);font-variant-numeric:tabular-nums;
}
.map-row.dup-conflict .map-num,.map-row.dup-conflict .map-select{border-color:var(--danger)}
.btn-rev-toggle{
padding:5px 8px;font-size:11px;font-weight:700;border-radius:5px;
border:1px solid var(--line);background:var(--surface);color:var(--muted);cursor:pointer;
}
.btn-rev-toggle.active{background:var(--warn);color:#111;border-color:var(--warn)}
.btn-detect-row{
min-width:74px;padding:6px 10px;font-size:11px;font-weight:700;
border-radius:5px;border:1px solid var(--info);
background:rgba(37,99,235,.1);color:var(--info);cursor:pointer;
}
.btn-detect-row:hover:not(:disabled){background:var(--info);color:#fff}
.btn-detect-row:disabled{opacity:.35;cursor:default}
.btn-detect-row.detect-active{background:var(--danger);color:#fff;border-color:var(--danger)}

@media(max-width:720px){
.map-row{
grid-template-columns:1fr auto;grid-template-rows:auto auto;gap:6px 8px;padding:10px 12px;
}
.map-row-main{grid-column:1;grid-row:1}
.map-live-meter{grid-column:2;grid-row:1;width:72px;justify-self:end}
.map-row-fields{grid-column:1;grid-row:2;flex-wrap:wrap}
.map-row-actions{grid-column:2;grid-row:2;display:flex;gap:6px;justify-self:end}
}
@media(min-width:721px){
.map-row-actions{display:contents}
}

.map-io-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:12px}
.map-io-card{margin-bottom:0}
.map-io-list{display:flex;flex-direction:column;gap:8px}
.map-io-row{
display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;
padding:8px 10px;background:var(--surface);border:1px solid var(--line-soft);border-radius:8px;
}
.map-io-row.dup-conflict{border-color:var(--danger);background:rgba(220,38,38,.08)}
.map-io-label{font-size:12px;font-weight:700;color:var(--ink);min-width:86px}
.map-io-fields{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-left:auto}
.map-io-fields input[type=text]{
width:64px;padding:4px 6px;border:1px solid var(--input-border);border-radius:5px;
background:var(--input-bg);color:var(--ink);font-size:12px;font-family:var(--mono);
}
.map-io-check{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:var(--ink-soft);cursor:pointer}
.map-io-check input{width:15px;height:15px;accent-color:var(--accent);cursor:pointer}

.map-ign-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.map-ign-list{display:flex;flex-direction:column;gap:6px}
.map-ign-row{
display:flex;align-items:center;gap:8px;flex-wrap:wrap;
padding:7px 10px;background:var(--surface);border:1px solid var(--line-soft);border-radius:6px;
}
.map-ign-row.dup-conflict{border-color:var(--danger);background:rgba(220,38,38,.08)}
.map-ign-status{font-size:12px;color:var(--muted);flex:1;min-width:120px}
.map-ign-status.mapped{color:var(--warn);font-weight:600;font-family:var(--mono);font-size:11px}
.btn-del-ign{
padding:4px 8px;background:rgba(220,38,38,.12);color:var(--danger);
border:1px solid rgba(220,38,38,.3);border-radius:5px;font-size:11px;font-weight:700;cursor:pointer;
}
.map-hw-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:8px}
.map-hw-item{
padding:8px 10px;background:var(--surface);border:1px solid var(--line-soft);border-radius:6px;
}
.map-hw-k{font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted)}
.map-hw-v{font-size:13px;font-weight:700;font-family:var(--mono);font-variant-numeric:tabular-nums;color:var(--ink);margin-top:2px}
.map-empty{padding:16px;text-align:center;font-size:12px;color:var(--muted)}

.map-clip-list{display:flex;flex-direction:column;gap:8px}
.map-clip-row{
display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;
padding:8px 10px;background:var(--surface);border:1px solid var(--line-soft);border-radius:8px;
}
.map-clip-row.is-disabled .map-io-fields{opacity:.5}
.map-clip-row.dup-conflict{border-color:var(--danger);background:rgba(220,38,38,.08)}
.map-clip-name{min-width:90px;font-size:12px;font-weight:700;color:var(--ink)}
.map-boot-row{padding:4px 0 10px;border-bottom:1px solid var(--line-soft)}
.map-boot-check{font-size:13px;font-weight:600;color:var(--ink)}
.map-system-row{
display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
padding-top:12px;
}
.map-system-hint{font-size:12px;color:var(--muted);flex:1;min-width:200px}

.map-modal-backdrop{
position:fixed;inset:0;z-index:calc(var(--z-popup) + 20);
background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;
}
.map-modal-panel{
width:min(440px,100%);background:var(--bg-elev);border:1px solid var(--line);
border-radius:var(--radius);box-shadow:var(--shadow);padding:18px;
}
.map-modal-title{font-size:15px;font-weight:700;color:var(--ink);margin-bottom:8px}
.map-modal-body{font-size:13px;line-height:1.5;color:var(--ink-soft);margin-bottom:16px}
.map-modal-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}

@media(max-width:580px){
#tab-content{padding:10px;padding-bottom:calc(14px + env(safe-area-inset-bottom))}
#gui-header{padding:6px 12px}
#gui-logo{height:28px}
.tab-btn{padding:10px 12px;font-size:12px}
.theme-btn-lbl,.gear-btn-lbl{display:none}
.map-search{width:100%}
.fx-matrix-row{flex-direction:column;align-items:stretch;gap:6px;padding:8px 10px}
.fx-matrix-ch-label{min-width:0;padding-top:0}
.fx-trig-btn{padding:4px 7px}
}

@media(pointer:coarse){
.dev-pot-slider::-webkit-slider-thumb,.fx-range-slider::-webkit-slider-thumb{width:20px;height:20px}
.fx-route-select,.fx-trig-btn,.btn-detect-row,.btn-rev-toggle{min-height:32px}
}

@media(prefers-reduced-motion:reduce){
*,*::before,*::after{
transition-duration:.01ms!important;
animation-duration:.01ms!important;
}
}
    `;
    document.head.appendChild(s);
}
