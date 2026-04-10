(function() {
    // --- CONFIGURATION ---
    window.SUPPLIER_CODES = {
        ELMA: ['707', '708', '752'],
        FOODS: ['1119'],
        PEPSICO: ['707', '708', '752', '1119'],
        EXTRUSADOS: '707',
        VIRTUAL: {
            TODDYNHO: '1119_TODDYNHO',
            TODDY: '1119_TODDY',
            QUAKER_KEROCOCO: '1119_QUAKER_KEROCOCO'
        }
    };
    window.SUPPLIER_CODES.VIRTUAL_LIST = [
        window.SUPPLIER_CODES.VIRTUAL.TODDYNHO,
        window.SUPPLIER_CODES.VIRTUAL.TODDY,
        window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO
    ];
    window.SUPPLIER_CODES.ALL_GOALS = [
        ...window.SUPPLIER_CODES.ELMA,
        ...window.SUPPLIER_CODES.VIRTUAL_LIST
    ];

    window.SUPPLIER_CONFIG = {
        inference: {
            triggerKeywords: ['PEPSICO'],
            matchValue: 'PEPSICO',
            defaultValue: 'MULTIMARCAS'
        },
        metaRealizado: {
            requiredPasta: 'PEPSICO'
        }
    };

    window.getUserRoleContext = function() {
        const role = (window.userRole || '').trim().toLowerCase();
        const hierarchyRole = typeof window.userHierarchyContext !== 'undefined' && window.userHierarchyContext ? window.userHierarchyContext.role : '';
        const isPromoter = window.userIsPromoter || role === 'promotor' || hierarchyRole === 'promotor' || (typeof window.optimizedData !== 'undefined' && window.optimizedData.promotorMap && window.optimizedData.promotorMap.has((window.userRole || '').trim().toUpperCase()));
        const isAdmin = role === 'adm';
        const isCoord = (hierarchyRole === 'coord' || hierarchyRole === 'cocoord') && !isPromoter;
        const isSup = window.userIsSupervisor || hierarchyRole === 'supervisor' || role === 'supervisor';
        const isManager = isAdmin || isCoord || isSup;
        return { isManager, isAdmin, isCoord, isSup, isPromoter, role, hierarchyRole };
    };


    window.isElma = function(code) {
        return window.SUPPLIER_CODES.ELMA.includes(String(code));
    };

    window.isFoods = function(code) {
        return window.SUPPLIER_CODES.FOODS.includes(String(code));
    };

    window.escapeHtml = function(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    window.resolveSupplierPasta = function(rowPasta, fornecedorName) {
        if (!rowPasta || rowPasta === '0' || rowPasta === '00' || rowPasta === 'N/A') {
            const rawFornecedor = String(fornecedorName || '').toUpperCase();
            const match = window.SUPPLIER_CONFIG.inference.triggerKeywords.some(k => rawFornecedor.includes(k));
            return match ? window.SUPPLIER_CONFIG.inference.matchValue : window.SUPPLIER_CONFIG.inference.defaultValue;
        }
        return rowPasta;
    };

    window.GARBAGE_SELLER_KEYWORDS = ['TOTAL', 'GERAL', 'SUPERVISOR', 'BALCAO'];
    window.GARBAGE_SELLER_EXACT = ['INATIVOS', 'N/A'];

    window.isGarbageSeller = function(name) {
        if (!name) return true;
        // Normalize: Remove accents (NFD + Replace), Uppercase, Trim
        const upper = String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
        if (window.GARBAGE_SELLER_EXACT.includes(upper)) return true;
        return window.GARBAGE_SELLER_KEYWORDS.some(k => upper.includes(k));
    };

    // Helper to normalize keys (remove leading zeros) to ensure consistent joins
    window.normalizeKey = function(key) {
        if (!key) return '';
        if (typeof key === 'number') return String(key);

        const s = String(key).trim();
        if (s.length === 0) return '';

        // Optimization: avoid regex for numeric check
        let isNumeric = true;
        for (let i = 0; i < s.length; i++) {
            const c = s.charCodeAt(i);
            if (c < 48 || c > 57) {
                isNumeric = false;
                break;
            }
        }

        if (isNumeric) {
            // Only parse if it has leading zeros that matter (length > 1 and starts with 0)
            if (s.length > 1 && s.charCodeAt(0) === 48) {
                return String(parseInt(s, 10));
            }
            return s;
        }
        return s;
    };

    // --- OPTIMIZATION: Lazy Columnar Accessor with Write-Back Support ---
    window.ColumnarDataset = class ColumnarDataset {
        constructor(columnarData) {
            this.columns = columnarData.columns;
            this._data = columnarData.values; // Renamed to avoid shadowing values() method
            this.length = columnarData.length;
            this._overrides = new Map(); // Stores mutations: Map<index, Object>
        }

        get(index) {
            if (index < 0 || index >= this.length) return undefined;

            const overrides = this._overrides;
            const values = this._data;
            const columns = this.columns;

            // Return a Lazy Proxy that constructs properties only on access
            // and supports write-back for mutations (e.g. seller remapping)
            return new Proxy({}, {
                get(target, prop) {
                    if (prop === 'toJSON') return () => "ColumnarRowProxy"; // Debug help

                    // 1. Check overrides first (mutations)
                    const ov = overrides.get(index);
                    if (ov && prop in ov) {
                        return ov[prop];
                    }

                    // 2. Check columnar data (lazy read)
                    // Note: values[prop] is the array for that column
                    if (values && values[prop]) {
                        return values[prop][index];
                    }

                    return target[prop]; // Fallback (e.g. prototype methods)
                },

                set(target, prop, value) {
                    let ov = overrides.get(index);
                    if (!ov) {
                        ov = {};
                        overrides.set(index, ov);
                    }
                    ov[prop] = value;
                    return true;
                },

                ownKeys(target) {
                    // Return all original columns plus any new keys added via mutation
                    const ov = overrides.get(index);
                    if (ov) {
                        // Create a set of keys to ensure uniqueness
                        const keys = new Set(columns);
                        Object.keys(ov).forEach(k => keys.add(k));
                        return Array.from(keys);
                    }
                    return columns;
                },

                getOwnPropertyDescriptor(target, prop) {
                    // Check overrides or values to confirm existence
                    const ov = overrides.get(index);
                    if ((ov && prop in ov) || (values && values[prop])) {
                        return { enumerable: true, configurable: true, writable: true };
                    }
                    return undefined;
                },

                has(target, prop) {
                    const ov = overrides.get(index);
                    return (ov && prop in ov) || (values && prop in values);
                }
            });
        }

        // Implement basic Array methods to behave like an array
        map(callback) {
            const result = new Array(this.length);
            for (let i = 0; i < this.length; i++) {
                result[i] = callback(this.get(i), i, this);
            }
            return result;
        }

        filter(callback) {
            const result = [];
            for (let i = 0; i < this.length; i++) {
                const item = this.get(i);
                if (callback(item, i, this)) {
                    result.push(item);
                }
            }
            return result;
        }

        forEach(callback) {
            for (let i = 0; i < this.length; i++) {
                callback(this.get(i), i, this);
            }
        }

        reduce(callback, initialValue) {
            let accumulator = initialValue;
            for (let i = 0; i < this.length; i++) {
                if (i === 0 && initialValue === undefined) {
                    accumulator = this.get(i);
                } else {
                    accumulator = callback(accumulator, this.get(i), i, this);
                }
            }
            return accumulator;
        }

        values() {
            // Returns all items as Proxies (expensive if iterated fully, but needed for 'no filter' cases)
            const result = new Array(this.length);
            for (let i = 0; i < this.length; i++) {
                result[i] = this.get(i);
            }
            return result;
        }

        some(callback) {
            for (let i = 0; i < this.length; i++) {
                if (callback(this.get(i), i)) return true;
            }
            return false;
        }

        every(callback) {
            for (let i = 0; i < this.length; i++) {
                if (!callback(this.get(i), i)) return false;
            }
            return true;
        }

        find(callback) {
            for (let i = 0; i < this.length; i++) {
                const item = this.get(i);
                if (callback(item, i)) return item;
            }
            return undefined;
        }

        [Symbol.iterator]() {
            let index = 0;
            return {
                next: () => {
                    if (index < this.length) {
                        return { value: this.get(index++), done: false };
                    } else {
                        return { done: true };
                    }
                }
            };
        }
    };

    // Custom Map implementation for Index-based storage
    window.IndexMap = class IndexMap {
        constructor(dataSource) {
            this._indices = new Map();
            this._source = dataSource;
        }

        set(key, index) {
            this._indices.set(key, index);
        }

        get(key) {
            const index = this._indices.get(key);
            if (index === undefined) return undefined;
            return this._source.get(index);
        }

        getIndex(key) {
            return this._indices.get(key);
        }

        has(key) {
            return this._indices.has(key);
        }

        values() {
            // Warning: Heavy operation
            const objects = [];
            for (const index of this._indices.values()) {
                objects.push(this._source.get(index));
            }
            return objects;
        }

        forEach(callback) {
            this._indices.forEach((index, key) => {
                callback(this._source.get(index), key);
            });
        }
    };

    const dateCache = new Map();
    window.parseDate = function(dateString) {
        if (!dateString) return null;

        if (dateString instanceof Date) {
            return isNaN(dateString.getTime()) ? null : dateString;
        }

        const type = typeof dateString;
        if (type === 'string' || type === 'number') {
            const cached = dateCache.get(dateString);
            if (cached !== undefined) {
                return cached === null ? null : new Date(cached);
            }
        } else {
            return null;
        }

        let result = null;

        if (type === 'number') {
            if (dateString > 1000000) {
                result = new Date(dateString);
            } else {
                result = new Date(Math.round((dateString - 25569) * 86400 * 1000));
            }
        } else {
            const len = dateString.length;

            // Tentativa de parse para 'DD/MM/YYYY'
            if (len === 10 && dateString[2] === '/' && dateString[5] === '/') {
                const day = (dateString.charCodeAt(0) - 48) * 10 + (dateString.charCodeAt(1) - 48);
                const month = (dateString.charCodeAt(3) - 48) * 10 + (dateString.charCodeAt(4) - 48);
                const year = (dateString.charCodeAt(6) - 48) * 1000 + (dateString.charCodeAt(7) - 48) * 100 + (dateString.charCodeAt(8) - 48) * 10 + (dateString.charCodeAt(9) - 48);

                if (day > 0 && day <= 31 && month > 0 && month <= 12 && year > 1900) {
                    const utcDate = new Date(Date.UTC(year, month - 1, day));
                    if (!isNaN(utcDate.getTime())) {
                        result = utcDate;
                    }
                }
            }

            if (!result && (dateString.includes('T') || dateString.includes('-'))) {
                 // Adiciona 'Z' se não tiver informação de fuso horário para forçar UTC
                const isoDate = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
                if (!isNaN(isoDate.getTime())) {
                    result = isoDate;
                }
            }

            if (!result) {
                const genericDate = new Date(dateString);
                if (!isNaN(genericDate.getTime())) {
                    result = genericDate;
                }
            }
        }

        dateCache.set(dateString, result !== null ? result.getTime() : null);

        return result;
    };

    // --- OPTIMIZATION: Chunked Processor to prevent UI Freeze ---
    window.runAsyncChunked = function(items, processItemFn, onComplete, isCancelled) {
        let index = 0;
        const total = items.length;

        // Check if items is a ColumnarDataset and access by index directly to avoid overhead
        const isColumnar = items instanceof window.ColumnarDataset;

        function nextChunk() {
            if (isCancelled && isCancelled()) return;

            const start = performance.now();
            // Process in batches (50 items) to reduce overhead of time checks and loop condition
            const BATCH_SIZE = 50;

            while (index < total) {
                const limit = Math.min(index + BATCH_SIZE, total);

                if (isColumnar) {
                    for (; index < limit; index++) {
                        processItemFn(items.get(index), index);
                    }
                } else {
                    for (; index < limit; index++) {
                        processItemFn(items[index], index);
                    }
                }

                if (performance.now() - start >= 12) { // Check budget (12ms)
                    break;
                }
            }

            if (index < total) {
                requestAnimationFrame(nextChunk); // Yield to main thread
            } else {
                if(onComplete) onComplete();
            }
        }

        requestAnimationFrame(nextChunk);
    };

    window.formatDate = function(date) {
        if (!date) return '';
        const d = window.parseDate(date);
        if (!d || isNaN(d.getTime())) return '';
        const userTimezoneOffset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() + userTimezoneOffset).toLocaleDateString('pt-BR');
    };



    /**
     * Reusable generic function to render a supervisor filter dropdown.
     */
    window.updateGenericSupervisorFilter = function(dropdownId, textId, selectedSet, sellerDetailsMap, updateTextFn, defaultLabel = 'Todos', checkboxColorClass = 'text-teal-500', filterFn = null) {
        const dropdown = document.getElementById(dropdownId);
        if(!dropdown) return;

        const supervisors = new Set();
        if (sellerDetailsMap) {
            sellerDetailsMap.forEach(d => {
                if (filterFn) {
                    if (filterFn(d)) supervisors.add(d.supervisor);
                } else {
                    if (d.supervisor) supervisors.add(d.supervisor);
                }
            });
        }

        let html = '';
        Array.from(supervisors).sort().forEach(s => {
            const checked = selectedSet.has(s) ? 'checked' : '';
            html += `<label class="flex items-center p-2 hover:bg-slate-700 rounded cursor-pointer"><input type="checkbox" value="${window.escapeHtml(s)}" ${checked} class="form-checkbox h-4 w-4 ${checkboxColorClass} rounded bg-slate-700 border-slate-600"><span class="ml-2 text-sm text-slate-300">${window.escapeHtml(s)}</span></label>`;
        });
        dropdown.innerHTML = html;

        if (typeof updateTextFn === 'function') {
            updateTextFn(document.getElementById(textId), selectedSet, defaultLabel);
        }
    };

    /**
     * Reusable generic function to render a seller filter dropdown.
     */
    window.updateGenericVendedorFilter = function(dropdownId, textId, supervisorsSet, vendedoresSet, sellerDetailsMap, updateTextFn, defaultLabel = 'Todos', checkboxColorClass = 'text-orange-500') {
        const dropdown = document.getElementById(dropdownId);
        if(!dropdown) return;

        const validRcas = new Set();
        if (supervisorsSet.size > 0) {
            sellerDetailsMap.forEach((d, code) => {
                if (supervisorsSet.has(d.supervisor)) validRcas.add(code);
            });
        } else {
            sellerDetailsMap.forEach((d, code) => validRcas.add(code));
        }

        let options = [];
        validRcas.forEach(rca => {
            const details = sellerDetailsMap.get(rca);
            options.push({ value: rca, label: details ? (details.name || rca) : rca });
        });
        options.sort((a,b) => a.label.localeCompare(b.label));

        let html = '';
        options.forEach(opt => {
            const checked = vendedoresSet.has(opt.value) ? 'checked' : '';
            html += `<label class="flex items-center p-2 hover:bg-slate-700 rounded cursor-pointer"><input type="checkbox" value="${window.escapeHtml(opt.value)}" ${checked} class="form-checkbox h-4 w-4 ${checkboxColorClass} rounded bg-slate-700 border-slate-600"><span class="ml-2 text-sm text-slate-300 truncate">${window.escapeHtml(opt.label)}</span></label>`;
        });
        dropdown.innerHTML = html;

        if (typeof updateTextFn === 'function') {
            updateTextFn(document.getElementById(textId), vendedoresSet, defaultLabel);
        }
    };


    /**
     * Reusable generic function to render a Tipo Venda filter dropdown.
     */
    window.updateGenericTipoVendaFilter = function(dropdownId, textId, selectedArray, dataSource, skipRender = false) {
        const dropdown = typeof dropdownId === 'string' ? document.getElementById(dropdownId) : dropdownId;
        const filterText = typeof textId === 'string' ? document.getElementById(textId) : textId;
        if (!dropdown || !filterText) return selectedArray;

        const forbiddenTiposVenda = new Set(['TIPOVENDA', 'TIPO VENDA', 'TIPO', 'CODUSUR', 'CODCLI', 'SUPERV', 'NOME']);
        const uniqueTypes = new Set();

        // Fast columnar access
        if (typeof dataSource.get === 'function' && dataSource._data && dataSource._data['TIPOVENDA']) {
            const arr = dataSource._data['TIPOVENDA'];
            for(let i=0; i<dataSource.length; i++) {
                const t = arr[i];
                if (t && !forbiddenTiposVenda.has(String(t).toUpperCase())) uniqueTypes.add(String(t));
            }
        } else {
            for(let i=0; i<dataSource.length; i++) {
                const item = typeof dataSource.get === 'function' ? dataSource.get(i) : dataSource[i];
                const t = item.TIPOVENDA;
                if (t && !forbiddenTiposVenda.has(String(t).toUpperCase())) uniqueTypes.add(String(t));
            }
        }

        selectedArray.forEach(type => uniqueTypes.add(type));
        const tiposVendaToShow = [...uniqueTypes].sort((a, b) => parseInt(a) - parseInt(b));
        selectedArray = selectedArray.filter(tipo => tiposVendaToShow.includes(tipo));

        if (!skipRender) {
            let html = '';
            for (let i = 0; i < tiposVendaToShow.length; i++) {
                const s = tiposVendaToShow[i];
                const isChecked = selectedArray.includes(s);
                html += `<label class="flex items-center p-2 hover:bg-slate-600 cursor-pointer"><input type="checkbox" class="form-checkbox h-4 w-4 glass-panel-heavy border-slate-500 rounded text-teal-500 focus:ring-teal-500" value="${window.escapeHtml(s)}" ${isChecked ? 'checked' : ''}><span class="ml-2">${window.escapeHtml(s)}</span></label>`;
            }
            dropdown.innerHTML = html;
        }

        if (selectedArray.length === 0 || selectedArray.length === tiposVendaToShow.length) filterText.textContent = 'Todos os Tipos';
        else if (selectedArray.length === 1) filterText.textContent = selectedArray[0];
        else filterText.textContent = `${selectedArray.length} tipos selecionados`;
        return selectedArray;
    };

    /**
     * Reusable generic function to render a Rede filter dropdown.
     */
    window.updateGenericRedeFilter = function(dropdownId, textId, selectedArray, dataSource, baseText = 'C/Rede') {
        const dropdown = typeof dropdownId === 'string' ? document.getElementById(dropdownId) : dropdownId;
        const buttonTextElement = typeof textId === 'string' ? document.getElementById(textId) : textId;
        if (!dropdown || !buttonTextElement) return selectedArray;

        const forbiddenRedes = new Set(['RAMO', 'RAMO DE ATIVIDADE', 'RAMO_ATIVIDADE', 'DESCRICAO', 'ATIVIDADE']);
        const uniqueRedes = new Set();

        // Fast columnar access
        if (typeof dataSource.get === 'function' && dataSource._data && dataSource._data['ramo']) {
            const arr = dataSource._data['ramo'];
            for(let i=0; i<dataSource.length; i++) {
                const r = arr[i];
                if (r && r !== 'N/A' && !forbiddenRedes.has(String(r).toUpperCase())) uniqueRedes.add(String(r));
            }
        } else {
            for(let i=0; i<dataSource.length; i++) {
                const item = typeof dataSource.get === 'function' ? dataSource.get(i) : dataSource[i];
                const r = item.ramo;
                if (r && r !== 'N/A' && !forbiddenRedes.has(String(r).toUpperCase())) uniqueRedes.add(String(r));
            }
        }

        const redesToShow = [...uniqueRedes].sort();
        const validSelected = selectedArray.filter(rede => redesToShow.includes(rede));

        let html = '';
        for (let i = 0; i < redesToShow.length; i++) {
            const r = redesToShow[i];
            const isChecked = validSelected.includes(r);
            html += `<label class="flex items-center p-2 hover:bg-slate-600 cursor-pointer"><input type="checkbox" class="form-checkbox h-4 w-4 glass-panel-heavy border-slate-500 rounded text-teal-500 focus:ring-teal-500" value="${window.escapeHtml(r)}" ${isChecked ? 'checked' : ''}><span class="ml-2 text-sm">${window.escapeHtml(r)}</span></label>`;
        }
        dropdown.innerHTML = html;

        if (validSelected.length === 0) {
            buttonTextElement.textContent = baseText;
        } else {
            buttonTextElement.textContent = `${baseText} (${validSelected.length})`;
        }
        return validSelected;
    };

})();
