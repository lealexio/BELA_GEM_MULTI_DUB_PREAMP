/** Live tab: siren, console, switches. */
import { getContext } from '../context.js';
import {
    SIREN_PRESETS, SWITCH_GROUPS, SWITCH_NAMES, POT_NAMES,
    CONSOLE_POT_MIN_DELTA_NORMAL, CONSOLE_POT_MIN_DELTA_DETAILED, MAX_CONSOLE,
    MUX_POTS_PER_MUX
} from '../config.js';
import { el, cardTitle } from './utils.js';
import {
    muxRawIndex, getActiveMuxCount, isPotIgnored, isPotMapped, formatUnmappedPotLabel
} from './mapping.js';

export function buildLivePane() {
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
    getContext().sirenPresetPills = [];
    SIREN_PRESETS.forEach((name) => {
        const pill = el('div', {className:'spreset'});
        pill.textContent = name;
        pill.title = name;
        presetsDiv.appendChild(pill);
        getContext().sirenPresetPills.push(pill);
    });
    sirenBody.appendChild(presetsDiv);
    sirenCard.appendChild(sirenBody);

    getContext().sirenNameEl  = hero.querySelector('#siren-name');
    getContext().sirenGateEl  = hero.querySelector('#siren-gate-dot');
    getContext().sirenModFill = hero.querySelector('#siren-mod-fill');
    getContext().sirenModLbl  = hero.querySelector('#siren-mod-lbl');

    // Console card
    const consoleCard = el('div', {className:'card'});
    const consoleHdr = el('div', {className:'console-header'});
    consoleHdr.appendChild(cardTitle('Console — last change'));
    const filterBar = el('div', {className:'console-filter'});
    getContext().consoleFilterBtns = [];
    [
        { mode: 'normal',   label: 'Normal'   },
        { mode: 'detailed', label: 'Détaillé' }
    ].forEach(({ mode, label }) => {
        const btn = el('button', {
            type: 'button',
            className: 'console-filter-btn' + (mode === getContext().consoleFilterMode ? ' active' : '')
        });
        btn.textContent = label;
        btn.dataset.mode = mode;
        btn.addEventListener('click', () => setConsoleFilterMode(mode));
        filterBar.appendChild(btn);
        getContext().consoleFilterBtns.push(btn);
    });
    consoleHdr.appendChild(filterBar);
    consoleCard.appendChild(consoleHdr);
    getContext().consoleList = el('ul', {id:'console-list'});
    consoleCard.appendChild(getContext().consoleList);
    renderConsole();

    grid.appendChild(sirenCard);
    grid.appendChild(consoleCard);
    pane.appendChild(grid);

    // Switches card (full width below grid)
    const swCard = el('div', {className:'card'});
    swCard.appendChild(cardTitle('Switches'));
    const swGrid = el('div', {className:'sw-grid'});
    getContext().switchPills = [];

    SWITCH_GROUPS.forEach(group => {
        const grp = el('div', {className:'sw-group sw-group-' + group.type});
        const gtitle = el('div', {className:'sw-group-title'});
        gtitle.textContent = group.label;
        grp.appendChild(gtitle);

        const items = el('div', {className:'sw-group-items'});
        group.indices.forEach(i => {
            items.appendChild(buildSwitchTile(i, SWITCH_NAMES[i], group.type));
        });
        grp.appendChild(items);
        swGrid.appendChild(grp);
    });

    swCard.appendChild(swGrid);
    pane.appendChild(swCard);

    return pane;
}

/** Returns a short display label for a switch name. */
export function switchDisplayName(name) {
    if(name.indexOf('KILL_') === 0) return name.slice(5);
    if(name === 'FX_FILTER_MIDS')  return 'FX1 MIDS';
    if(name === 'FX_FILTER_TOPS') return 'FX1 TOPS';
    if(name === 'FX2_FILTER_TOPS') return 'FX2 TOPS';
    if(name === 'FX2_FILTER_MIDS') return 'FX2 MIDS';
    if(name === 'SIREN_TRIGGER') return 'GATE';
    return name.replace(/_/g, ' ');
}

/** Builds one switch status tile with LED indicator. */
export function buildSwitchTile(index, name, type) {
    const tile = el('div', {className:'sw-tile sw-tile-' + type});
    const led  = el('div', {className:'sw-led'});
    const lbl  = el('span', {className:'sw-tile-name'});
    lbl.textContent = switchDisplayName(name);
    tile.appendChild(led);
    tile.appendChild(lbl);
    getContext().switchPills[index] = tile;
    return tile;
}

export function updateSiren() {
    const idx  = Math.max(0, Math.min(Math.round(getContext().sirenState[0]), SIREN_PRESETS.length - 1));
    const gate = getContext().sirenState[1] > 0.5;
    const mod  = getContext().sirenState[2];

    getContext().sirenPresetPills.forEach((pill, i) => {
        const isActive = (i === idx);
        pill.className = 'spreset' + (isActive ? ' active' : '') + (isActive && gate ? ' gate' : '');
    });

    if(getContext().sirenNameEl)  getContext().sirenNameEl.textContent  = SIREN_PRESETS[idx];
    if(getContext().sirenGateEl)  getContext().sirenGateEl.className     = gate ? 'on' : '';
    if(getContext().sirenModFill) getContext().sirenModFill.style.width  = (mod * 100).toFixed(1) + '%';
    if(getContext().sirenModLbl)  getContext().sirenModLbl.textContent   = Math.round(mod * 100) + '%';
}

/** Resyncs pot baselines from current live values. */
export function syncConsolePotBaselines() {
    getContext().prevPotValues.set(getContext().potValues);
    getContext().prevPotValuesNormal.set(getContext().potValues);
    if(getContext().muxRawValues && getContext().prevMuxRawValues) {
        getContext().prevMuxRawValues.set(getContext().muxRawValues);
        getContext().prevMuxRawValuesNormal.set(getContext().muxRawValues);
    }
}

/** Switches console filter mode and clears stale entries. */
export function setConsoleFilterMode(mode) {
    if(mode !== 'normal' && mode !== 'detailed') return;
    if(mode === getContext().consoleFilterMode) return;
    getContext().consoleFilterMode = mode;
    getContext().consoleFilterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    getContext().recentChanges = [];
    syncConsolePotBaselines();
    renderConsole();
}

/** Builds one console row — filled from entry or empty placeholder slot. */
export function buildConsoleRow(entry, slot) {
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
export function updateConsole() {
    const now = Date.now();
    let dirty = false;
    const isNormal = getContext().consoleFilterMode === 'normal';
    const potDelta = isNormal ? CONSOLE_POT_MIN_DELTA_NORMAL : CONSOLE_POT_MIN_DELTA_DETAILED;
    const potPrev  = isNormal ? getContext().prevPotValuesNormal : getContext().prevPotValues;

    for(let i = 0; i < POT_NAMES.length; i++) {
        const v = getContext().potValues[i];
        if(Math.abs(v - potPrev[i]) >= potDelta) {
            potPrev[i] = v;
            pushConsoleEntry({name: POT_NAMES[i], value: v, type: 'pot', ts: now});
            dirty = true;
        }
    }
    for(let i = 0; i < SWITCH_NAMES.length; i++) {
        const v = getContext().switchStates[i];
        if(v !== getContext().prevSwitchStates[i]) {
            getContext().prevSwitchStates[i] = v;
            pushConsoleEntry({name: SWITCH_NAMES[i], value: v, type: 'sw', ts: now});
            dirty = true;
        }
    }

    if(getContext().muxRawValues && getContext().prevMuxRawValues && getContext().prevMuxRawValuesNormal) {
        const muxPrev = isNormal ? getContext().prevMuxRawValuesNormal : getContext().prevMuxRawValues;
        const activeMux = getActiveMuxCount();
        for(let m = 0; m < activeMux; m++) {
            for(let p = 0; p < MUX_POTS_PER_MUX; p++) {
                if(isPotIgnored(m, p) || isPotMapped(m, p)) continue;
                const idx = muxRawIndex(m, p);
                const v   = getContext().muxRawValues[idx];
                if(Math.abs(v - muxPrev[idx]) >= potDelta) {
                    muxPrev[idx] = v;
                    pushConsoleEntry({
                        name: formatUnmappedPotLabel(m, p),
                        value: v,
                        type: 'pot',
                        ts: now
                    });
                    dirty = true;
                }
            }
        }
    }

    if(dirty) renderConsole();
}

export function pushConsoleEntry(entry) {
    getContext().recentChanges = getContext().recentChanges.filter(e => e.name !== entry.name);
    getContext().recentChanges.unshift(entry);
    if(getContext().recentChanges.length > MAX_CONSOLE) getContext().recentChanges.length = MAX_CONSOLE;
}

export function renderConsole() {
    if(!getContext().consoleList) return;
    getContext().consoleList.innerHTML = '';
    for(let i = 0; i < MAX_CONSOLE; i++) {
        getContext().consoleList.appendChild(buildConsoleRow(getContext().recentChanges[i] || null, i));
    }
}

/** Updates switch tile states from current getContext().switchStates. */
export function updateSwitches() {
    for(let i = 0; i < SWITCH_NAMES.length; i++) {
        const tile = getContext().switchPills[i];
        if(tile) tile.classList.toggle('on', getContext().switchStates[i] > 0.5);
    }
}
