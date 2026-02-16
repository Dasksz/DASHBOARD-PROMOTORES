(function() {
    window.HierarchySystem = {
        state: {}, // Map<viewPrefix, { coords: Set, cocoords: Set, promotors: Set }>

        maps: {
            hierarchyMap: new Map(), // Promotor Code -> Hierarchy Node
            clientHierarchyMap: new Map(), // Client Code -> Hierarchy Node
            coordMap: new Map(), // Coord Code -> Name
            cocoordMap: new Map(), // CoCoord Code -> Name
            promotorMap: new Map(), // Promotor Code -> Name
            coordsByCocoord: new Map(), // CoCoord Code -> Coord Code
            cocoordsByCoord: new Map(), // Coord Code -> Set<CoCoord Code>
            promotorsByCocoord: new Map() // CoCoord Code -> Set<Promotor Code>
        },

        init: function(hierarchyData, clientPromotersData) {
            // Clear existing maps
            this.maps.hierarchyMap.clear();
            this.maps.clientHierarchyMap.clear();
            this.maps.coordMap.clear();
            this.maps.cocoordMap.clear();
            this.maps.promotorMap.clear();
            this.maps.coordsByCocoord.clear();
            this.maps.cocoordsByCoord.clear();
            this.maps.promotorsByCocoord.clear();

            if (hierarchyData) {
                hierarchyData.forEach(h => {
                    const getVal = (keys) => {
                        for (const k of keys) {
                            if (h[k] !== undefined && h[k] !== null) return String(h[k]);
                        }
                        return '';
                    };

                    const coordCode = getVal(['cod_coord', 'COD_COORD', 'COD COORD.']).trim().toUpperCase();
                    const coordName = (getVal(['nome_coord', 'NOME_COORD', 'COORDENADOR']) || coordCode).toUpperCase();

                    const cocoordCode = getVal(['cod_cocoord', 'COD_COCOORD', 'COD CO-COORD.']).trim().toUpperCase();
                    const cocoordName = (getVal(['nome_cocoord', 'NOME_COCOORD', 'CO-COORDENADOR']) || cocoordCode).toUpperCase();

                    const promotorCode = getVal(['cod_promotor', 'COD_PROMOTOR', 'COD PROMOTOR']).trim().toUpperCase();
                    const promotorName = (getVal(['nome_promotor', 'NOME_PROMOTOR', 'PROMOTOR']) || promotorCode).toUpperCase();

                    if (coordCode) {
                        this.maps.coordMap.set(coordCode, coordName);
                        if (!this.maps.cocoordsByCoord.has(coordCode)) this.maps.cocoordsByCoord.set(coordCode, new Set());
                        if (cocoordCode) this.maps.cocoordsByCoord.get(coordCode).add(cocoordCode);
                    }
                    if (cocoordCode) {
                        this.maps.cocoordMap.set(cocoordCode, cocoordName);
                        if (coordCode) this.maps.coordsByCocoord.set(cocoordCode, coordCode);
                        if (!this.maps.promotorsByCocoord.has(cocoordCode)) this.maps.promotorsByCocoord.set(cocoordCode, new Set());
                        if (promotorCode) this.maps.promotorsByCocoord.get(cocoordCode).add(promotorCode);
                    }
                    if (promotorCode) this.maps.promotorMap.set(promotorCode, promotorName);

                    if (promotorCode) {
                        this.maps.hierarchyMap.set(promotorCode, {
                            coord: { code: coordCode, name: coordName },
                            cocoord: { code: cocoordCode, name: cocoordName },
                            promotor: { code: promotorCode, name: promotorName }
                        });
                    }
                });
            }

            if (clientPromotersData) {
                let matchCount = 0;
                let sampleLogged = false;
                clientPromotersData.forEach(cp => {
                    let clientCode = String(cp.client_code).trim();
                    // Normalize client code (assuming window.normalizeKey exists from utils.js)
                    if (window.normalizeKey) clientCode = window.normalizeKey(clientCode);

                    const promotorCode = String(cp.promoter_code).trim().toUpperCase();
                    const hierarchyNode = this.maps.hierarchyMap.get(promotorCode);
                    if (hierarchyNode) {
                        this.maps.clientHierarchyMap.set(clientCode, hierarchyNode);
                        matchCount++;
                    } else if (!sampleLogged) {
                        // console.warn(`[Hierarchy] Node Not Found for Promotor: ${promotorCode}`);
                        sampleLogged = true;
                    }
                });
            }
        },

        getFilteredClients: function(viewPrefix, sourceClients, userContext) {
            const state = this.state[viewPrefix];
            if (!state) return sourceClients;

            const { coords, cocoords, promotors } = state;

            let effectiveCoords = new Set(coords);
            let effectiveCoCoords = new Set(cocoords);
            let effectivePromotors = new Set(promotors);

            // Apply User Context Constraints implicitly
            if (userContext.role === 'coord') effectiveCoords.add(userContext.coord);
            if (userContext.role === 'cocoord') {
                effectiveCoords.add(userContext.coord);
                effectiveCoCoords.add(userContext.cocoord);
            }
            if (userContext.role === 'promotor') {
                effectiveCoords.add(userContext.coord);
                effectiveCoCoords.add(userContext.cocoord);
                effectivePromotors.add(userContext.promotor);
            }

            const isColumnar = window.ColumnarDataset && sourceClients instanceof window.ColumnarDataset;
            const result = [];
            const len = sourceClients.length;

            for(let i=0; i<len; i++) {
                const client = isColumnar ? sourceClients.get(i) : sourceClients[i];
                const codCli = window.normalizeKey(client['Código'] || client['codigo_cliente']);
                const node = this.maps.clientHierarchyMap.get(codCli);

                if (!node) {
                    // Allow Orphans for Admins if no filters are active
                    if (userContext.role === 'adm') {
                        const hasFilters = effectiveCoords.size > 0 || effectiveCoCoords.size > 0 || effectivePromotors.size > 0;
                        if (!hasFilters) {
                            result.push(client);
                        }
                    }
                    continue;
                }

                // Check Coord
                if (effectiveCoords.size > 0 && !effectiveCoords.has(node.coord.code)) continue;
                // Check CoCoord
                if (effectiveCoCoords.size > 0 && !effectiveCoCoords.has(node.cocoord.code)) continue;
                // Check Promotor
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
                if (this.maps.coordMap.has(val)) name = this.maps.coordMap.get(val);
                else if (this.maps.cocoordMap.has(val)) name = this.maps.cocoordMap.get(val);
                else if (this.maps.promotorMap.has(val)) name = this.maps.promotorMap.get(val);
                element.textContent = name;
            } else {
                element.textContent = `${selectedSet.size} selecionados`;
            }
        },

        updateHierarchyDropdown: function(viewPrefix, level, userContext) {
            const state = this.state[viewPrefix];
            const els = {
                coord: { dd: document.getElementById(`${viewPrefix}-coord-filter-dropdown`), text: document.getElementById(`${viewPrefix}-coord-filter-text`) },
                cocoord: { dd: document.getElementById(`${viewPrefix}-cocoord-filter-dropdown`), text: document.getElementById(`${viewPrefix}-cocoord-filter-text`) },
                promotor: { dd: document.getElementById(`${viewPrefix}-promotor-filter-dropdown`), text: document.getElementById(`${viewPrefix}-promotor-filter-text`) }
            };

            const target = els[level];
            if (!target.dd) return;

            let options = [];

            if (level === 'coord') {
                if (userContext.role === 'adm') {
                    options = Array.from(this.maps.coordMap.entries()).map(([k, v]) => ({ value: k, label: v }));
                } else {
                    if (userContext.coord) {
                        options = [{ value: userContext.coord, label: this.maps.coordMap.get(userContext.coord) || userContext.coord }];
                    }
                }
            } else if (level === 'cocoord') {
                let parentCoords = state.coords;

                let allowedCoords = parentCoords;
                if (allowedCoords.size === 0) {
                    if (userContext.role === 'adm') {
                        allowedCoords = new Set(this.maps.coordMap.keys());
                    } else if (userContext.coord) {
                        allowedCoords = new Set([userContext.coord]);
                    }
                }

                const validCodes = new Set();
                allowedCoords.forEach(c => {
                    const children = this.maps.cocoordsByCoord.get(c);
                    if(children) children.forEach(child => validCodes.add(child));
                });

                if (userContext.role === 'cocoord' || userContext.role === 'promotor') {
                    if (userContext.cocoord && validCodes.has(userContext.cocoord)) {
                        validCodes.clear();
                        validCodes.add(userContext.cocoord);
                    } else {
                        validCodes.clear();
                    }
                }

                options = Array.from(validCodes).map(c => ({ value: c, label: this.maps.cocoordMap.get(c) || c }));
            } else if (level === 'promotor') {
                let parentCoCoords = state.cocoords;

                let allowedCoCoords = parentCoCoords;
                if (allowedCoCoords.size === 0) {
                    let relevantCoords = state.coords;
                    if (relevantCoords.size === 0) {
                         if (userContext.role === 'adm') relevantCoords = new Set(this.maps.coordMap.keys());
                         else if (userContext.coord) relevantCoords = new Set([userContext.coord]);
                    }

                    const validCoCoords = new Set();
                    relevantCoords.forEach(c => {
                        const children = this.maps.cocoordsByCoord.get(c);
                        if(children) children.forEach(child => validCoCoords.add(child));
                    });

                    if (userContext.role === 'cocoord' || userContext.role === 'promotor') {
                         if (userContext.cocoord) {
                             if (validCoCoords.has(userContext.cocoord)) {
                                 validCoCoords.clear();
                                 validCoCoords.add(userContext.cocoord);
                             }
                         }
                    }
                    allowedCoCoords = validCoCoords;
                }

                const validCodes = new Set();
                allowedCoCoords.forEach(c => {
                    const children = this.maps.promotorsByCocoord.get(c);
                    if(children) children.forEach(child => validCodes.add(child));
                });

                if (userContext.role === 'promotor') {
                    if (userContext.promotor && validCodes.has(userContext.promotor)) {
                        validCodes.clear();
                        validCodes.add(userContext.promotor);
                    }
                }

                options = Array.from(validCodes).map(c => ({ value: c, label: this.maps.promotorMap.get(c) || c }));
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

        setupFilters: function(viewPrefix, userContext, onUpdate) {
            if (!this.state[viewPrefix]) {
                this.state[viewPrefix] = { coords: new Set(), cocoords: new Set(), promotors: new Set() };
            }
            const state = this.state[viewPrefix];

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

            // Note: Global click listener to close dropdowns should be in main app init or assumed existing
            document.addEventListener('click', (e) => {
                Object.values(els).forEach(x => {
                    if (x.dd && !x.dd.classList.contains('hidden')) {
                        if (x.btn && !x.btn.contains(e.target) && !x.dd.contains(e.target)) {
                            x.dd.classList.add('hidden');
                        }
                    }
                });
            });

            const bindChange = (level, nextLevel, nextNextLevel) => {
                const el = els[level];
                if (el && el.dd) {
                    el.dd.addEventListener('change', (e) => {
                        if (e.target.type === 'checkbox') {
                            const val = e.target.value;
                            const set = state[level + 's'];
                            if (e.target.checked) set.add(val); else set.delete(val);

                            this.updateHierarchyDropdown(viewPrefix, level, userContext);

                            if (nextLevel) {
                                state[nextLevel + 's'].clear();
                                this.updateHierarchyDropdown(viewPrefix, nextLevel, userContext);
                            }
                            if (nextNextLevel) {
                                state[nextNextLevel + 's'].clear();
                                this.updateHierarchyDropdown(viewPrefix, nextNextLevel, userContext);
                            }

                            if (onUpdate) onUpdate();
                        }
                    });
                }
            };

            bindChange('coord', 'cocoord', 'promotor');
            bindChange('cocoord', 'promotor', null);
            bindChange('promotor', null, null);

            // Initial Population
            this.updateHierarchyDropdown(viewPrefix, 'coord', userContext);
            this.updateHierarchyDropdown(viewPrefix, 'cocoord', userContext);
            this.updateHierarchyDropdown(viewPrefix, 'promotor', userContext);

            if (userContext.role !== 'adm') {
                if (userContext.coord) state.coords.add(userContext.coord);
                if (userContext.cocoord) state.cocoords.add(userContext.cocoord);
                if (userContext.promotor) state.promotors.add(userContext.promotor);

                this.updateHierarchyDropdown(viewPrefix, 'coord', userContext);
                this.updateHierarchyDropdown(viewPrefix, 'cocoord', userContext);
                this.updateHierarchyDropdown(viewPrefix, 'promotor', userContext);
            }
        }
    };
})();
