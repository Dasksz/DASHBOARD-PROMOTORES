window.App = window.App || {};
window.App.Filters = {
    getHierarchyFilteredClients: function(viewPrefix, sourceClients) {
        const state = window.AppState.optimizedData.hierarchyState[viewPrefix];
        if (!state) return sourceClients;

        const { coords, cocoords, promotors } = state;
        const context = window.AppState.userHierarchyContext;

        let effectiveCoords = new Set(coords);
        let effectiveCoCoords = new Set(cocoords);
        let effectivePromotors = new Set(promotors);

        if (context.role === 'coord') effectiveCoords.add(context.coord);
        if (context.role === 'cocoord') {
            effectiveCoords.add(context.coord);
            effectiveCoCoords.add(context.cocoord);
        }
        if (context.role === 'promotor') {
            effectiveCoords.add(context.coord);
            effectiveCoCoords.add(context.cocoord);
            effectivePromotors.add(context.promotor);
        }

        const isColumnar = sourceClients instanceof window.Utils.ColumnarDataset;
        const result = [];
        const len = sourceClients.length;
        const clientMap = window.AppState.optimizedData.clientHierarchyMap;

        for(let i=0; i<len; i++) {
            const client = isColumnar ? sourceClients.get(i) : sourceClients[i];
            const codCli = window.Utils.normalizeKey(client['Código'] || client['codigo_cliente']);
            const node = clientMap.get(codCli);

            if (!node) {
                if (context.role === 'adm') {
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
    },

    updateFilterButtonText: function(element, selectedSet, defaultLabel) {
        if (!element) return;
        if (selectedSet.size === 0) {
            element.textContent = defaultLabel;
        } else if (selectedSet.size === 1) {
            const val = selectedSet.values().next().value;
            let name = val;
            const opt = window.AppState.optimizedData;
            if (opt.coordMap.has(val)) name = opt.coordMap.get(val);
            else if (opt.cocoordMap.has(val)) name = opt.cocoordMap.get(val);
            else if (opt.promotorMap.has(val)) name = opt.promotorMap.get(val);
            element.textContent = name;
        } else {
            element.textContent = `${selectedSet.size} selecionados`;
        }
    },

    updateHierarchyDropdown: function(viewPrefix, level) {
        const state = window.AppState.optimizedData.hierarchyState[viewPrefix];
        const els = {
            coord: { dd: document.getElementById(`${viewPrefix}-coord-filter-dropdown`), text: document.getElementById(`${viewPrefix}-coord-filter-text`) },
            cocoord: { dd: document.getElementById(`${viewPrefix}-cocoord-filter-dropdown`), text: document.getElementById(`${viewPrefix}-cocoord-filter-text`) },
            promotor: { dd: document.getElementById(`${viewPrefix}-promotor-filter-dropdown`), text: document.getElementById(`${viewPrefix}-promotor-filter-text`) }
        };

        const target = els[level];
        if (!target || !target.dd) return;

        let options = [];
        const context = window.AppState.userHierarchyContext;
        const optData = window.AppState.optimizedData;

        if (level === 'coord') {
            if (context.role === 'adm') {
                options = Array.from(optData.coordMap.entries()).map(([k, v]) => ({ value: k, label: v }));
            } else {
                if (context.coord) {
                    options = [{ value: context.coord, label: optData.coordMap.get(context.coord) || context.coord }];
                }
            }
        } else if (level === 'cocoord') {
            let parentCoords = state.coords;
            let allowedCoords = parentCoords;
            if (allowedCoords.size === 0) {
                if (context.role === 'adm') allowedCoords = new Set(optData.coordMap.keys());
                else if (context.coord) allowedCoords = new Set([context.coord]);
            }

            const validCodes = new Set();
            allowedCoords.forEach(c => {
                const children = optData.cocoordsByCoord.get(c);
                if(children) children.forEach(child => validCodes.add(child));
            });

            if (context.role === 'cocoord' || context.role === 'promotor') {
                if (context.cocoord && validCodes.has(context.cocoord)) {
                    validCodes.clear();
                    validCodes.add(context.cocoord);
                } else {
                    validCodes.clear();
                }
            }
            options = Array.from(validCodes).map(c => ({ value: c, label: optData.cocoordMap.get(c) || c }));
        } else if (level === 'promotor') {
            let parentCoCoords = state.cocoords;
            let allowedCoCoords = parentCoCoords;

            if (allowedCoCoords.size === 0) {
                let relevantCoords = state.coords;
                if (relevantCoords.size === 0) {
                     if (context.role === 'adm') relevantCoords = new Set(optData.coordMap.keys());
                     else if (context.coord) relevantCoords = new Set([context.coord]);
                }

                const validCoCoords = new Set();
                relevantCoords.forEach(c => {
                    const children = optData.cocoordsByCoord.get(c);
                    if(children) children.forEach(child => validCoCoords.add(child));
                });

                if (context.role === 'cocoord' || context.role === 'promotor') {
                     if (context.cocoord && validCoCoords.has(context.cocoord)) {
                         validCoCoords.clear();
                         validCoCoords.add(context.cocoord);
                     }
                }
                allowedCoCoords = validCoCoords;
            }

            const validCodes = new Set();
            allowedCoCoords.forEach(c => {
                const children = optData.promotorsByCocoord.get(c);
                if(children) children.forEach(child => validCodes.add(child));
            });

            if (context.role === 'promotor') {
                if (context.promotor && validCodes.has(context.promotor)) {
                    validCodes.clear();
                    validCodes.add(context.promotor);
                }
            }
            options = Array.from(validCodes).map(c => ({ value: c, label: optData.promotorMap.get(c) || c }));
        }

        if (options) options.sort((a, b) => a.label.localeCompare(b.label));
        else options = [];

        let html = '';
        const selectedSet = state[level + 's'];
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

        this.updateFilterButtonText(target.text, selectedSet, label);
    },

    setupHierarchyFilters: function(viewPrefix, onUpdate) {
        if (!window.AppState.optimizedData.hierarchyState[viewPrefix]) {
            window.AppState.optimizedData.hierarchyState[viewPrefix] = { coords: new Set(), cocoords: new Set(), promotors: new Set() };
        }
        const state = window.AppState.optimizedData.hierarchyState[viewPrefix];
        const context = window.AppState.userHierarchyContext;

        const els = {
            coord: { btn: document.getElementById(`${viewPrefix}-coord-filter-btn`), dd: document.getElementById(`${viewPrefix}-coord-filter-dropdown`) },
            cocoord: { btn: document.getElementById(`${viewPrefix}-cocoord-filter-btn`), dd: document.getElementById(`${viewPrefix}-cocoord-filter-dropdown`) },
            promotor: { btn: document.getElementById(`${viewPrefix}-promotor-filter-btn`), dd: document.getElementById(`${viewPrefix}-promotor-filter-dropdown`) }
        };

        const bindToggle = (el) => {
            if (el.btn && el.dd) {
                // Remove old listeners
                const newBtn = el.btn.cloneNode(true);
                el.btn.parentNode.replaceChild(newBtn, el.btn);
                el.btn = newBtn;

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

        // Global click listener is handled once in App.init probably?
        // Or we bind it here specifically for these dropdowns?
        // App.js likely handles closing.

        const bindChange = (level, nextLevel, nextNextLevel) => {
            const el = els[level];
            if (el && el.dd) {
                el.dd.addEventListener('change', (e) => {
                    if (e.target.type === 'checkbox') {
                        const val = e.target.value;
                        const set = state[level + 's'];
                        if (e.target.checked) set.add(val); else set.delete(val);

                        this.updateHierarchyDropdown(viewPrefix, level);

                        if (nextLevel) {
                            state[nextLevel + 's'].clear();
                            this.updateHierarchyDropdown(viewPrefix, nextLevel);
                        }
                        if (nextNextLevel) {
                            state[nextNextLevel + 's'].clear();
                            this.updateHierarchyDropdown(viewPrefix, nextNextLevel);
                        }

                        if (onUpdate) onUpdate();
                    }
                });
            }
        };

        bindChange('coord', 'cocoord', 'promotor');
        bindChange('cocoord', 'promotor', null);
        bindChange('promotor', null, null);

        if (context.role !== 'adm') {
            if (context.coord) state.coords.add(context.coord);
            if (context.cocoord) state.cocoords.add(context.cocoord);
            if (context.promotor) state.promotors.add(context.promotor);
        }

        this.updateHierarchyDropdown(viewPrefix, 'coord');
        this.updateHierarchyDropdown(viewPrefix, 'cocoord');
        this.updateHierarchyDropdown(viewPrefix, 'promotor');
    }
};
