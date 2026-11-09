/** Console tab: last-change console + switch status tiles. */
import { getContext } from '../context.js';
import {
    SWITCH_GROUPS, SWITCH_NAMES, POT_NAMES,
    CONSOLE_POT_MIN_DELTA_NORMAL, CONSOLE_POT_MIN_DELTA_DETAILED, MAX_CONSOLE,
    MUX_POTS_PER_MUX
} from '../config.js';
import { el, cardTitle } from './utils.js';
import {
    muxRawIndex, getActiveMuxCount, isPotIgnored, isPotMapped, formatUnmappedPotLabel,
    getPotMuxChannel
} from './mapping.js';

/** Builds the console "last change" card.
 * @param {string} [listId='console-list']
 */
export function buildConsoleCard(listId) {
    const card = el('div', { className: 'card live-tile' });
    card.dataset.tile = 'console';
    const consoleHdr = el('div', { className: 'console-header' });
    consoleHdr.appendChild(cardTitle('Console — last change'));
    const filterBar = el('div', { className: 'console-filter' });
    [
        { mode: 'normal', label: 'Normal' },
        { mode: 'detailed', label: 'Détaillé' }
    ].forEach(({ mode, label }) => {
        const btn = el('button', {
            type: 'button',
            className: 'console-filter-btn' +
                (mode === getContext().consoleFilterMode ? ' active' : '')
        });
        btn.textContent = label;
        btn.dataset.mode = mode;
        btn.addEventListener('click', () => setConsoleFilterMode(mode));
        filterBar.appendChild(btn);
    });
    consoleHdr.appendChild(filterBar);
    card.appendChild(consoleHdr);
    const list = el('ul', { id: listId || 'console-list', className: 'console-list' });
    card.appendChild(list);
    if (!getContext().consoleLists)
        getContext().consoleLists = [];
    getContext().consoleLists.push(list);
    renderConsole();
    return card;
}

/** Builds the switches status card. */
export function buildSwitchesCard() {
    const swCard = el('div', { className: 'card live-tile' });
    swCard.dataset.tile = 'switches';
    swCard.appendChild(cardTitle('Switches'));
    const swGrid = el('div', { className: 'sw-grid' });

    SWITCH_GROUPS.forEach(group => {
        const grp = el('div', { className: 'sw-group sw-group-' + group.type });
        const gtitle = el('div', { className: 'sw-group-title' });
        gtitle.textContent = group.label;
        grp.appendChild(gtitle);

        const items = el('div', { className: 'sw-group-items' });
        group.indices.forEach(i => {
            items.appendChild(buildSwitchTile(i, SWITCH_NAMES[i], group.type));
        });
        grp.appendChild(items);
        swGrid.appendChild(grp);
    });

    swCard.appendChild(swGrid);
    return swCard;
}

/** Returns a short display label for a switch name. */
function switchDisplayName(name) {
    if (name.indexOf('KILL_') === 0) return name.slice(5);
    if (name === 'FX_FILTER_MIDS') return 'FX1 MIDS';
    if (name === 'FX_FILTER_TOPS') return 'FX1 TOPS';
    if (name === 'FX2_FILTER_TOPS') return 'FX2 TOPS';
    if (name === 'FX2_FILTER_MIDS') return 'FX2 MIDS';
    if (name === 'SIREN_TRIGGER') return 'GATE';
    return name.replace(/_/g, ' ');
}

/** Builds one switch status tile with LED indicator. */
function buildSwitchTile(index, name, type) {
    const tile = el('div', { className: 'sw-tile sw-tile-' + type });
    tile.dataset.swIndex = String(index);
    const led = el('div', { className: 'sw-led' });
    const lbl = el('span', { className: 'sw-tile-name' });
    lbl.textContent = switchDisplayName(name);
    tile.appendChild(led);
    tile.appendChild(lbl);
    return tile;
}

/** Resyncs pot baselines from current live values. */
function syncConsolePotBaselines() {
    getContext().prevPotValues.set(getContext().potValues);
    getContext().prevPotValuesNormal.set(getContext().potValues);
    if (getContext().muxRawValues && getContext().prevMuxRawValues) {
        getContext().prevMuxRawValues.set(getContext().muxRawValues);
        getContext().prevMuxRawValuesNormal.set(getContext().muxRawValues);
    }
}

/** Switches console filter mode and clears stale entries. */
function setConsoleFilterMode(mode) {
    if (mode !== 'normal' && mode !== 'detailed') return;
    if (mode === getContext().consoleFilterMode) return;
    getContext().consoleFilterMode = mode;
    document.querySelectorAll('.console-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    getContext().recentChanges = [];
    syncConsolePotBaselines();
    renderConsole();
}

const CONSOLE_ACTIVE_HOLD_MS = 1400;

/** Formats a console value according to its type (pot = 0.000, sw = ON/OFF). */
function formatVal(v, type) {
    if (v === undefined || v === null) return '\u00a0';
    if (type === 'sw') {
        return v > 0.5 ? 'ON' : 'OFF';
    }
    return Number(v).toFixed(3);
}

/** Finds an existing entry in recentChanges by name. */
function findRecentChange(name) {
    const list = getContext().recentChanges;
    if (!list) return null;
    return list.find(e => e.name === name) || null;
}

/** Builds one console row — filled from entry or empty placeholder slot. */
function buildConsoleRow(entry, slot) {
    const isSw = entry && entry.type === 'sw';
    const isEmpty = !entry;
    const key = entry ? entry.name : ('__empty_' + slot);
    const li = el('li', { className: 'crow' + (isEmpty ? ' empty' : (isSw ? ' sw' : '')) });
    li.dataset.key = key;
    if (isEmpty) li.style.setProperty('--slot', String(slot));

    const pct = entry ? Math.min(100, Math.max(0, entry.value * 100)).toFixed(1) : '0';
    const cname = entry ? entry.name : '\u00a0';
    const fillCls = isEmpty ? 'cfill cfill-loading' : 'cfill';
    const fillStyle = isEmpty ? '' : ` style="width:${pct}%"`;

    const coldval = (!isEmpty && entry.initialValue !== undefined)
        ? formatVal(entry.initialValue, entry.type)
        : '\u00a0';
    const cval = !isEmpty ? formatVal(entry.value, entry.type) : '\u00a0';

    let dirHtml = '&nbsp;';
    let dirCls = 'cdir';
    if (!isEmpty) {
        if (isSw) {
            dirHtml = '●';
            dirCls = 'cdir sw';
        } else if (entry.direction === 'up') {
            dirHtml = '▲';
            dirCls = 'cdir up';
        } else if (entry.direction === 'down') {
            dirHtml = '▼';
            dirCls = 'cdir down';
        }
    }

    li.innerHTML =
        `<span class="cname" title="${cname}">${cname}</span>` +
        `<span class="ctrack"><span class="${fillCls}"${fillStyle}></span></span>` +
        `<span class="cval-group">` +
            `<span class="coldval">${coldval}</span>` +
            `<span class="${dirCls}">${dirHtml}</span>` +
            `<span class="cval">${cval}</span>` +
        `</span>`;

    if (entry && entry.ts && (Date.now() - entry.ts < CONSOLE_ACTIVE_HOLD_MS)) {
        li.classList.add('active');
        const remaining = Math.max(100, CONSOLE_ACTIVE_HOLD_MS - (Date.now() - entry.ts));
        li._activeTimer = setTimeout(() => {
            li.classList.remove('active');
            li._activeTimer = null;
        }, remaining);
    }

    return li;
}

/** Updates an existing row's visual elements and active status without layout destruction. */
function updateRowContent(row, entry, isNew, direction) {
    if (!row || !entry) return;
    const isSw = entry.type === 'sw';
    row.dataset.key = entry.name;
    row.classList.remove('empty');
    row.classList.toggle('sw', isSw);

    const nameEl = row.querySelector('.cname');
    if (nameEl && nameEl.textContent !== entry.name) {
        nameEl.textContent = entry.name;
        nameEl.title = entry.name;
    }

    const fillEl = row.querySelector('.cfill');
    if (fillEl) {
        fillEl.className = 'cfill';
        const pct = Math.min(100, Math.max(0, entry.value * 100)).toFixed(1);
        fillEl.style.width = pct + '%';
    }

    const oldValEl = row.querySelector('.coldval');
    if (oldValEl && entry.initialValue !== undefined) {
        oldValEl.textContent = formatVal(entry.initialValue, entry.type);
    }

    const dirEl = row.querySelector('.cdir');
    if (dirEl) {
        if (isSw) {
            dirEl.textContent = '●';
            dirEl.className = 'cdir sw';
        } else if (direction === 'up') {
            dirEl.textContent = '▲';
            dirEl.className = 'cdir up';
        } else if (direction === 'down') {
            dirEl.textContent = '▼';
            dirEl.className = 'cdir down';
        }
    }

    const valEl = row.querySelector('.cval');
    if (valEl) {
        valEl.textContent = formatVal(entry.value, entry.type);
    }

    // Active state with decay timer
    row.classList.add('active');
    if (row._activeTimer) clearTimeout(row._activeTimer);
    row._activeTimer = setTimeout(() => {
        row.classList.remove('active');
        row._activeTimer = null;
    }, CONSOLE_ACTIVE_HOLD_MS);
}

/** Removes an excess bottom child to keep exact MAX_CONSOLE items. */
function removeExcessBottomSlot(list) {
    if (list.children.length <= MAX_CONSOLE) return;
    for (let i = list.children.length - 1; i >= 0; i--) {
        const child = list.children[i];
        if (child.classList.contains('empty')) {
            list.removeChild(child);
            return;
        }
    }
    if (list.lastElementChild) {
        list.removeChild(list.lastElementChild);
    }
}

/** Applies a console change to a specific UL list using in-place updates or FLIP animation. */
function applyConsoleChangeToList(entry, list, direction) {
    const firstChild = list.firstElementChild;
    // Fast path: if this item is ALREADY at the top, update in place without reordering
    if (firstChild && firstChild.dataset.key === entry.name) {
        updateRowContent(firstChild, entry, false, direction);
        return;
    }

    // Step 1: FIRST — record current screen positions of all children
    const firstTops = new Map();
    for (const child of list.children) {
        firstTops.set(child, child.getBoundingClientRect().top);
    }

    // Step 2: LAST — adjust DOM order
    let targetRow = null;
    for (const child of list.children) {
        if (child.dataset.key === entry.name) {
            targetRow = child;
            break;
        }
    }

    if (targetRow) {
        list.insertBefore(targetRow, list.firstElementChild);
    } else {
        targetRow = buildConsoleRow(entry, 0);
        list.insertBefore(targetRow, list.firstElementChild);
        removeExcessBottomSlot(list);
    }

    updateRowContent(targetRow, entry, true, direction);

    // Step 3: INVERT — compute deltas and apply transform without transition
    for (const child of list.children) {
        const first = firstTops.get(child);
        const last = child.getBoundingClientRect().top;
        if (first !== undefined) {
            const dy = first - last;
            if (Math.abs(dy) > 0.5) {
                child.style.transform = `translateY(${dy}px)`;
                child.style.transition = 'none';
            } else {
                child.style.transform = '';
                child.style.transition = 'none';
            }
        } else {
            // New entering row: slide from slightly above with fade
            child.style.transform = 'translateY(-18px) scale(0.98)';
            child.style.opacity = '0';
            child.style.transition = 'none';
        }
    }

    // Step 4: PLAY — force reflow, then smoothly animate to natural position
    void list.offsetHeight;

    for (const child of list.children) {
        child.style.transition =
            'transform 320ms cubic-bezier(0.16, 1, 0.3, 1), opacity 320ms ease';
        child.style.transform = '';
        child.style.opacity = '';
    }

    clearTimeout(list._animTimer);
    list._animTimer = setTimeout(() => {
        for (const child of list.children) {
            child.style.transition = '';
        }
        list._animTimer = null;
    }, 340);
}

/** Updates recentChanges data model. */
function pushRecentChangeData(entry) {
    if (!getContext().recentChanges) getContext().recentChanges = [];
    getContext().recentChanges =
        getContext().recentChanges.filter(e => e.name !== entry.name);
    getContext().recentChanges.unshift(entry);
    if (getContext().recentChanges.length > MAX_CONSOLE) {
        getContext().recentChanges.length = MAX_CONSOLE;
    }
}

/** Dispatches a single console change to all active lists and updates data model. */
function applyConsoleChange(entry) {
    const lists = (getContext().consoleLists || []).filter(l => l && l.isConnected);
    if (!lists.length) {
        pushRecentChangeData(entry);
        return;
    }

    lists.forEach(list => {
        applyConsoleChangeToList(entry, list, entry.direction);
    });

    pushRecentChangeData(entry);
}

/** Detects changed pots/switches and updates the console with smooth animations. */
export function updateConsole() {
    const now = Date.now();
    const isNormal = getContext().consoleFilterMode === 'normal';
    const potDelta = isNormal ? CONSOLE_POT_MIN_DELTA_NORMAL : CONSOLE_POT_MIN_DELTA_DETAILED;
    const potPrev = isNormal ? getContext().prevPotValuesNormal : getContext().prevPotValues;

    const changes = [];

    // Cache current pot channel coordinates and track all mapped MUX channels
    const mappedChannels = new Set();
    for (let i = 0; i < POT_NAMES.length; i++) {
        const coords = getPotMuxChannel(i);
        if (coords) {
            mappedChannels.add(`${coords.mux}:${coords.pot}`);
        }

        if (coords && isPotIgnored(coords.mux, coords.pot)) continue;

        const v = getContext().potValues[i];
        const prevV = potPrev[i];
        if (Math.abs(v - prevV) >= potDelta) {
            potPrev[i] = v;
            if (coords) {
                const unmappedName = formatUnmappedPotLabel(coords.mux, coords.pot);
                getContext().recentChanges =
                    (getContext().recentChanges || []).filter(e => e.name !== unmappedName);
            }
            const name = POT_NAMES[i];
            const existing = findRecentChange(name);
            const inActiveSession = existing && existing.ts && (now - existing.ts < CONSOLE_ACTIVE_HOLD_MS);
            const initialValue = (inActiveSession && existing.initialValue !== undefined)
                ? existing.initialValue
                : (existing ? existing.value : prevV);

            const dir = (v > prevV + 0.0005) ? 'up' : ((v < prevV - 0.0005) ? 'down' : 'same');
            changes.push({
                name,
                value: v,
                initialValue,
                type: 'pot',
                ts: now,
                direction: dir
            });
        }
    }

    for (let i = 0; i < SWITCH_NAMES.length; i++) {
        const v = getContext().switchStates[i];
        if (v !== getContext().prevSwitchStates[i]) {
            getContext().prevSwitchStates[i] = v;
            const name = SWITCH_NAMES[i];
            const existing = findRecentChange(name);
            const inActiveSession = existing && existing.ts && (now - existing.ts < CONSOLE_ACTIVE_HOLD_MS);
            const initialValue = (inActiveSession && existing.initialValue !== undefined)
                ? existing.initialValue
                : (existing ? existing.value : (v > 0.5 ? 0 : 1));

            changes.push({
                name,
                value: v,
                initialValue,
                type: 'sw',
                ts: now,
                direction: v > 0.5 ? 'on' : 'off'
            });
        }
    }

    if (getContext().muxRawValues && getContext().prevMuxRawValues &&
        getContext().prevMuxRawValuesNormal) {
        const muxPrev = isNormal ? getContext().prevMuxRawValuesNormal
            : getContext().prevMuxRawValues;
        const activeMux = getActiveMuxCount();
        for (let m = 0; m < activeMux; m++) {
            for (let p = 0; p < MUX_POTS_PER_MUX; p++) {
                if (isPotIgnored(m, p) || mappedChannels.has(`${m}:${p}`) || isPotMapped(m, p)) continue;
                const idx = muxRawIndex(m, p);
                const v = getContext().muxRawValues[idx];
                const prevV = muxPrev[idx];
                if (Math.abs(v - prevV) >= potDelta) {
                    muxPrev[idx] = v;
                    const name = formatUnmappedPotLabel(m, p);
                    const existing = findRecentChange(name);
                    const inActiveSession = existing && existing.ts && (now - existing.ts < CONSOLE_ACTIVE_HOLD_MS);
                    const initialValue = (inActiveSession && existing.initialValue !== undefined)
                        ? existing.initialValue
                        : (existing ? existing.value : prevV);

                    const dir = (v > prevV + 0.0005) ? 'up' : ((v < prevV - 0.0005) ? 'down' : 'same');
                    changes.push({
                        name,
                        value: v,
                        initialValue,
                        type: 'pot',
                        ts: now,
                        direction: dir
                    });
                }
            }
        }
    }

    if (changes.length > 0) {
        if (changes.length > 2) {
            // Bulk update (e.g. boot / profile load): update model and full render
            for (const c of changes) pushRecentChangeData(c);
            renderConsole();
        } else {
            // Interactive user tweaks: smooth animated FLIP and in-place updates
            for (let i = changes.length - 1; i >= 0; i--) {
                applyConsoleChange(changes[i]);
            }
        }
    }
}

/** Pushes a console entry, replacing any prior entry for the same name. */
export function pushConsoleEntry(entry) {
    applyConsoleChange(entry);
}

/** Renders all console lists (fixed MAX_CONSOLE slots). */
export function renderConsole() {
    const lists = getContext().consoleLists || [];
    if (!lists.length) return;

    lists.forEach(list => {
        if (!list) return;
        list.innerHTML = '';
        const recent = getContext().recentChanges || [];
        for (let i = 0; i < MAX_CONSOLE; i++) {
            list.appendChild(
                buildConsoleRow(recent[i] || null, i)
            );
        }
    });
}

/** Updates all switch tiles in the document from switchStates. */
export function updateSwitches() {
    document.querySelectorAll('.sw-tile[data-sw-index]').forEach(tile => {
        const i = parseInt(tile.getAttribute('data-sw-index'), 10);
        if (!isNaN(i))
            tile.classList.toggle('on', getContext().switchStates[i] > 0.5);
    });
}
