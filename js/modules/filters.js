import { state, ColumnarDataset } from './data.js';
import { normalizeKey } from './utils.js';

// --- HIERARCHY FILTER SYSTEM ---
export const hierarchyState = {}; // Map<viewPrefix, { coords: Set, cocoords: Set, promotors: Set }>
export const userHierarchyContext = { role: 'adm', coord: null, cocoord: null, promotor: null };

export function resolveUserContext() {
    const role = (window.userRole || '').trim().toUpperCase();
    console.log(`[Filter] Resolving User Context for Role: '${role}'`);

    if (role === 'ADM' || role === 'ADMIN') {
        userHierarchyContext.role = 'adm';
        return;
    }

    if (state.optimizedData.coordMap.has(role)) {
        userHierarchyContext.role = 'coord';
        userHierarchyContext.coord = role;
        return;
    }

    if (state.optimizedData.cocoordMap.has(role)) {
        userHierarchyContext.role = 'cocoord';
        userHierarchyContext.cocoord = role;
        userHierarchyContext.coord = state.optimizedData.coordsByCocoord.get(role);
        return;
    }

    if (state.optimizedData.promotorMap.has(role)) {
        userHierarchyContext.role = 'promotor';
        userHierarchyContext.promotor = role;
        const node = state.optimizedData.hierarchyMap.get(role);
        if (node) {
            userHierarchyContext.cocoord = node.cocoord.code;
            userHierarchyContext.coord = node.coord.code;
        }
        return;
    }

    // Fallback
    userHierarchyContext.role = 'adm';
    console.warn(`[Filter] Role '${role}' not found in Hierarchy Maps. Defaulting to ADM context.`);
}

export function setupHierarchyFilters(viewPrefix, onUpdate) {
    if (!hierarchyState[viewPrefix]) {
        hierarchyState[viewPrefix] = { coords: new Set(), cocoords: new Set(), promotors: new Set() };
    }
    const internalState = hierarchyState[viewPrefix];

    const els = {
        coord: { btn: document.getElementById(`${viewPrefix}-coord-filter-btn`), dd: document.getElementById(`${viewPrefix}-coord-filter-dropdown`) },
        cocoord: { btn: document.getElementById(`${viewPrefix}-cocoord-filter-btn`), dd: document.getElementById(`${viewPrefix}-cocoord-filter-dropdown`) },
        promotor: { btn: document.getElementById(`${viewPrefix}-promotor-filter-btn`), dd: document.getElementById(`${viewPrefix}-promotor-filter-dropdown`) }
    };

    const bindToggle = (el) => {
        if (el.btn && el.dd) {
            el.btn.addEventListener('click', (e) => {
                e.stopPropagation();
                Object.values(els).forEach(x => { if(x.dd && x !== el) x.dd.classList.add('hidden'); });
                el.dd.classList.toggle('hidden');
            });
        }
    };
    bindToggle(els.coord);
    bindToggle(els.cocoord);
    bindToggle(els.promotor);

    const bindChange = (level, nextLevel, nextNextLevel) => {
        const el = els[level];
        if (el && el.dd) {
            el.dd.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox') {
                    const val = e.target.value;
                    const set = internalState[level + 's'];
                    if (e.target.checked) set.add(val); else set.delete(val);

                    updateHierarchyDropdown(viewPrefix, level);

                    if (nextLevel) {
                        internalState[nextLevel + 's'].clear();
                        updateHierarchyDropdown(viewPrefix, nextLevel);
                    }
                    if (nextNextLevel) {
                        internalState[nextNextLevel + 's'].clear();
                        updateHierarchyDropdown(viewPrefix, nextNextLevel);
                    }

                    if (onUpdate) onUpdate();
                }
            });
        }
    };

    bindChange('coord', 'cocoord', 'promotor');
    bindChange('cocoord', 'promotor', null);
    bindChange('promotor', null, null);

    updateHierarchyDropdown(viewPrefix, 'coord');
    updateHierarchyDropdown(viewPrefix, 'cocoord');
    updateHierarchyDropdown(viewPrefix, 'promotor');

    // Auto-select for restricted users
    if (userHierarchyContext.role !== 'adm') {
        if (userHierarchyContext.coord) internalState.coords.add(userHierarchyContext.coord);
        if (userHierarchyContext.cocoord) internalState.cocoords.add(userHierarchyContext.cocoord);
        if (userHierarchyContext.promotor) internalState.promotors.add(userHierarchyContext.promotor);

        updateHierarchyDropdown(viewPrefix, 'coord');
        updateHierarchyDropdown(viewPrefix, 'cocoord');
        updateHierarchyDropdown(viewPrefix, 'promotor');
    }
}

export function updateHierarchyDropdown(viewPrefix, level) {
    const internalState = hierarchyState[viewPrefix];
    const els = {
        coord: { dd: document.getElementById(`${viewPrefix}-coord-filter-dropdown`), text: document.getElementById(`${viewPrefix}-coord-filter-text`) },
        cocoord: { dd: document.getElementById(`${viewPrefix}-cocoord-filter-dropdown`), text: document.getElementById(`${viewPrefix}-cocoord-filter-text`) },
        promotor: { dd: document.getElementById(`${viewPrefix}-promotor-filter-dropdown`), text: document.getElementById(`${viewPrefix}-promotor-filter-text`) }
    };

    const target = els[level];
    if (!target.dd) return;

    let options = [];

    if (level === 'coord') {
        if (userHierarchyContext.role === 'adm') {
            options = Array.from(state.optimizedData.coordMap.entries()).map(([k, v]) => ({ value: k, label: v }));
        } else {
            if (userHierarchyContext.coord) {
                options = [{ value: userHierarchyContext.coord, label: state.optimizedData.coordMap.get(userHierarchyContext.coord) || userHierarchyContext.coord }];
            }
        }
    } else if (level === 'cocoord') {
        let parentCoords = internalState.coords;
        let allowedCoords = parentCoords;
        if (allowedCoords.size === 0) {
            if (userHierarchyContext.role === 'adm') allowedCoords = new Set(state.optimizedData.coordMap.keys());
            else if (userHierarchyContext.coord) allowedCoords = new Set([userHierarchyContext.coord]);
        }

        const validCodes = new Set();
        allowedCoords.forEach(c => {
            const children = state.optimizedData.cocoordsByCoord.get(c);
            if(children) children.forEach(child => validCodes.add(child));
        });

        if (userHierarchyContext.role === 'cocoord' || userHierarchyContext.role === 'promotor') {
            if (userHierarchyContext.cocoord && validCodes.has(userHierarchyContext.cocoord)) {
                validCodes.clear();
                validCodes.add(userHierarchyContext.cocoord);
            }
        }
        options = Array.from(validCodes).map(c => ({ value: c, label: state.optimizedData.cocoordMap.get(c) || c }));
    } else if (level === 'promotor') {
        let parentCoCoords = internalState.cocoords;
        let allowedCoCoords = parentCoCoords;

        if (allowedCoCoords.size === 0) {
            let relevantCoords = internalState.coords;
            if (relevantCoords.size === 0) {
                 if (userHierarchyContext.role === 'adm') relevantCoords = new Set(state.optimizedData.coordMap.keys());
                 else if (userHierarchyContext.coord) relevantCoords = new Set([userHierarchyContext.coord]);
            }

            const validCoCoords = new Set();
            relevantCoords.forEach(c => {
                const children = state.optimizedData.cocoordsByCoord.get(c);
                if(children) children.forEach(child => validCoCoords.add(child));
            });

            if (userHierarchyContext.role === 'cocoord' || userHierarchyContext.role === 'promotor') {
                 if (userHierarchyContext.cocoord && validCoCoords.has(userHierarchyContext.cocoord)) {
                     validCoCoords.clear();
                     validCoCoords.add(userHierarchyContext.cocoord);
                 }
            }
            allowedCoCoords = validCoCoords;
        }

        const validCodes = new Set();
        allowedCoCoords.forEach(c => {
            const children = state.optimizedData.promotorsByCocoord.get(c);
            if(children) children.forEach(child => validCodes.add(child));
        });

        if (userHierarchyContext.role === 'promotor') {
            if (userHierarchyContext.promotor && validCodes.has(userHierarchyContext.promotor)) {
                validCodes.clear();
                validCodes.add(userHierarchyContext.promotor);
            }
        }
        options = Array.from(validCodes).map(c => ({ value: c, label: state.optimizedData.promotorMap.get(c) || c }));
    }

    options.sort((a, b) => a.label.localeCompare(b.label));

    let html = '';
    const selectedSet = internalState[level + 's'];
    options.forEach(opt => {
        const checked = selectedSet.has(opt.value) ? 'checked' : '';
        html += `
            <label class="flex items-center justify-between p-2 hover:bg-slate-700 rounded cursor-pointer">
                <span class="text-xs text-slate-300 truncate mr-2">${opt.label}</span>
                <input type="checkbox" value="${opt.value}" ${checked} class="form-checkbox h-4 w-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-offset-slate-800">
            </label>
        `;
    });
    target.dd.innerHTML = html;

    let label = 'Todos';
    if (level === 'coord') label = 'Coordenador';
    if (level === 'cocoord') label = 'Co-Coord';
    if (level === 'promotor') label = 'Promotor';

    updateFilterButtonText(target.text, selectedSet, label);
}

function updateFilterButtonText(element, selectedSet, defaultLabel) {
    if (!element) return;
    if (selectedSet.size === 0) {
        element.textContent = defaultLabel;
    } else if (selectedSet.size === 1) {
        const val = selectedSet.values().next().value;
        let name = val;
        if (state.optimizedData.coordMap.has(val)) name = state.optimizedData.coordMap.get(val);
        else if (state.optimizedData.cocoordMap.has(val)) name = state.optimizedData.cocoordMap.get(val);
        else if (state.optimizedData.promotorMap.has(val)) name = state.optimizedData.promotorMap.get(val);
        element.textContent = name;
    } else {
        element.textContent = `${selectedSet.size} selecionados`;
    }
}

export function getHierarchyFilteredClients(viewPrefix, sourceClients) {
    const internalState = hierarchyState[viewPrefix];
    if (!internalState) return sourceClients;

    const { coords, cocoords, promotors } = internalState;

    let effectiveCoords = new Set(coords);
    let effectiveCoCoords = new Set(cocoords);
    let effectivePromotors = new Set(promotors);

    if (userHierarchyContext.role === 'coord') effectiveCoords.add(userHierarchyContext.coord);
    if (userHierarchyContext.role === 'cocoord') {
        effectiveCoords.add(userHierarchyContext.coord);
        effectiveCoCoords.add(userHierarchyContext.cocoord);
    }
    if (userHierarchyContext.role === 'promotor') {
        effectiveCoords.add(userHierarchyContext.coord);
        effectiveCoCoords.add(userHierarchyContext.cocoord);
        effectivePromotors.add(userHierarchyContext.promotor);
    }

    const isColumnar = sourceClients instanceof ColumnarDataset;
    const result = [];
    const len = sourceClients.length;

    for(let i=0; i<len; i++) {
        const client = isColumnar ? sourceClients.get(i) : sourceClients[i];
        const codCli = normalizeKey(client['Código'] || client['codigo_cliente']);
        const node = state.optimizedData.clientHierarchyMap.get(codCli);

        if (!node) {
            if (userHierarchyContext.role === 'adm') {
                const hasFilters = effectiveCoords.size > 0 || effectiveCoCoords.size > 0 || effectivePromotors.size > 0;
                if (!hasFilters) result.push(client);
            }
            continue;
        }

        if (effectiveCoords.size > 0 && !effectiveCoords.has(node.coord.code)) continue;
        if (effectiveCoCoords.size > 0 && !effectiveCoCoords.has(node.cocoord.code)) continue;
        if (effectivePromotors.size > 0 && !effectivePromotors.has(node.promotor.code)) continue;

        result.push(client);
    }
    return result;
}
