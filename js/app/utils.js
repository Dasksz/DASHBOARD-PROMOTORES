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

    window.normalizeCity = function(c) {
        if (!c) return '';
        return c.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
    };

    window.normalizeResearcherCode = function(c) {
        if (!c) return '';
        return String(c).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, '');
    };

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


    /**
     * Reusable generic function to render a supplier filter dropdown.
     */
    window.updateGenericSupplierFilter = function(dropdown, filterText, selectedArray, dataSource, filterType = 'comparison', skipRender = false) {
        const forbiddenSuppliers = new Set(['CODFOR', 'FORNECEDOR', 'COD FOR', 'NOME DO FORNECEDOR', 'FORNECEDOR_NOME']);

            if (!dropdown || !filterText) return selectedArray;
            const suppliers = new Map();
            // OPTIMIZATION: Use traditional for-loop instead of forEach. Avoid .get(i) proxy overhead inside loop for ColumnarDataset.
            const len = dataSource.length;
            const isCol = typeof ColumnarDataset !== 'undefined' && dataSource instanceof ColumnarDataset;

            if (isCol && dataSource._data['CODFOR']) {
                const codForCol = dataSource._data['CODFOR'];
                for (let i = 0; i < len; i++) {
                    const codFor = codForCol[i];
                    if (codFor && !forbiddenSuppliers.has(String(codFor).toUpperCase())) {
                        const name = window.resolveDim('fornecedores', codFor);
                        if (name && name !== 'N/A') {
                            suppliers.set(codFor, name);
                        }
                    }
                }
            } else if (isCol) {
                for (let i = 0; i < len; i++) {
                    const s = dataSource.get(i);
                    const codFor = s ? s.CODFOR : null;
                    if (codFor && !forbiddenSuppliers.has(String(codFor).toUpperCase())) {
                        const name = window.resolveDim('fornecedores', codFor);
                        if (name && name !== 'N/A') {
                            suppliers.set(codFor, name);
                        }
                    }
                }
            } else {
                for (let i = 0; i < len; i++) {
                    const s = dataSource[i];
                    const codFor = s ? s.CODFOR : null;
                    if (codFor && !forbiddenSuppliers.has(String(codFor).toUpperCase())) {
                        const name = window.resolveDim('fornecedores', codFor);
                        if (name && name !== 'N/A') {
                            suppliers.set(codFor, name);
                        }
                    }
                }
            }

            // Inject Virtual Categories for ALL filter types
            if (suppliers.has(window.SUPPLIER_CODES.ELMA[0])) suppliers.set(window.SUPPLIER_CODES.ELMA[0], 'EXTRUSADOS');
            if (suppliers.has(window.SUPPLIER_CODES.ELMA[1])) suppliers.set(window.SUPPLIER_CODES.ELMA[1], 'NÃO EXTRUSADOS');
            if (suppliers.has(window.SUPPLIER_CODES.ELMA[2])) suppliers.set(window.SUPPLIER_CODES.ELMA[2], 'TORCIDA');

            if (suppliers.has(window.SUPPLIER_CODES.FOODS[0])) {
                suppliers.delete(window.SUPPLIER_CODES.FOODS[0]);
                suppliers.set(window.SUPPLIER_CODES.VIRTUAL.TODDYNHO, 'TODDYNHO');
                suppliers.set(window.SUPPLIER_CODES.VIRTUAL.TODDY, 'TODDY');
                suppliers.set(window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO, 'QUAKER/KEROCOCO');
            }

            const sortedSuppliers = [...suppliers.entries()].sort((a, b) => a[1].localeCompare(b[1]));

            selectedArray = selectedArray.filter(cod => suppliers.has(cod));

            if (!skipRender) {
                const htmlParts = [];
                for (let i = 0; i < sortedSuppliers.length; i++) {
                    let [cod, name] = sortedSuppliers[i];
                    const isChecked = selectedArray.includes(cod);

                    let displayName = name;

                    htmlParts.push(`<label class="flex items-center p-2 hover:bg-slate-600 cursor-pointer"><input type="checkbox" data-filter-type="${filterType}" class="form-checkbox h-4 w-4 glass-panel-heavy border-slate-500 rounded text-teal-500 focus:ring-teal-500" value="${window.escapeHtml(cod)}" ${isChecked ? 'checked' : ''}><span class="ml-2 text-xs">${window.escapeHtml(displayName)}</span></label>`);
                }
                dropdown.innerHTML = htmlParts.join('');
            }

            if (selectedArray.length === 0 || selectedArray.length === sortedSuppliers.length) {
                filterText.textContent = 'Todos Fornecedores';
            } else if (selectedArray.length === 1) {
                filterText.textContent = suppliers.get(selectedArray[0]) || '1 selecionado';
            } else {
                filterText.textContent = `${selectedArray.length} fornecedores selecionados`;
            }
            return selectedArray;
    };



    /**
     * Reusable generic function to render a product filter dropdown.
     */
    window.updateGenericProductFilter = function(dropdown, filterText, selectedArray, dataSource, filterType = 'comparison', skipRender = false) {

            if (!dropdown) return selectedArray;
            const forbidden = new Set(['PRODUTO', 'DESCRICAO', 'CODIGO', 'CÓDIGO', 'DESCRIÇÃO']);
            // FIX: Support type="search" which is used in HTML
            const searchInput = dropdown.querySelector('input[type="text"], input[type="search"]');
            const listContainer = dropdown.querySelector('div[id$="-list"]');
            const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

            // Extract unique codes first
            const uniqueCodes = new Set();
            // OPTIMIZATION: Use traditional for-loop instead of forEach. Avoid .get(i) proxy overhead inside loop for ColumnarDataset.
            const len = dataSource.length;
            const isCol = typeof ColumnarDataset !== 'undefined' && dataSource instanceof ColumnarDataset;
            if (isCol && dataSource._data['PRODUTO']) {
                const prodCol = dataSource._data['PRODUTO'];
                for (let i = 0; i < len; i++) {
                    const p = prodCol[i];
                    if (p) uniqueCodes.add(String(p).trim());
                }
            } else if (isCol) {
                for (let i = 0; i < len; i++) {
                    const s = dataSource.get(i);
                    if (s && s.PRODUTO) uniqueCodes.add(String(s.PRODUTO).trim());
                }
            } else {
                for (let i = 0; i < len; i++) {
                    const s = dataSource[i];
                    if (s && s.PRODUTO) uniqueCodes.add(String(s.PRODUTO).trim());
                }
            }

            let products = Array.from(uniqueCodes)
                .filter(code => code && !forbidden.has(code.toUpperCase()))
                .map(code => {
                    const resolved = window.resolveDim('produtos', code);
                    return [code, resolved.descricao || code];
                });



            // Filter selectedArray to keep only items present in the current dataSource
            // ⚡ Bolt Optimization: Replaced intermediate array allocation from .map() with a direct Set insertion for performance.
            const availableProductCodes = new Set(); for(let i=0; i<products.length; i++) availableProductCodes.add(products[i][0]);
            selectedArray = selectedArray.filter(code => availableProductCodes.has(code));

            // Logic:
            // 1. If Searching: Filter by matches. Sort by: Relevance (Exact > StartsWith > Contains) > Alpha
            // 2. If Not Searching: Sort by: Selected -> Alpha

            if (searchTerm.length > 0) {
                products = products.filter(([code, name]) => {
                    const codeMatch = code.toLowerCase().includes(searchTerm);
                    const nameMatch = name.toLowerCase().includes(searchTerm);
                    return codeMatch || nameMatch;
                });


            }

            products.sort((a, b) => {
                const codeA = a[0];
                const nameA = a[1];
                const codeB = b[0];
                const nameB = b[1];

                if (searchTerm.length > 0) {
                    // Priority 1: Relevance (Searching)
                    const nameALower = nameA.toLowerCase();
                    const nameBLower = nameB.toLowerCase();
                    const codeALower = codeA.toLowerCase();
                    const codeBLower = codeB.toLowerCase();

                    // Exact Match
                    const exactA = nameALower === searchTerm || codeALower === searchTerm;
                    const exactB = nameBLower === searchTerm || codeBLower === searchTerm;
                    if (exactA && !exactB) return -1;
                    if (!exactA && exactB) return 1;

                    // Starts With Name
                    const startNameA = nameALower.startsWith(searchTerm);
                    const startNameB = nameBLower.startsWith(searchTerm);
                    if (startNameA && !startNameB) return -1;
                    if (!startNameA && startNameB) return 1;

                    // Starts With Code
                    const startCodeA = codeALower.startsWith(searchTerm);
                    const startCodeB = codeBLower.startsWith(searchTerm);
                    if (startCodeA && !startCodeB) return -1;
                    if (!startCodeA && startCodeB) return 1;

                    // Fallback to Alpha
                    return nameA.localeCompare(nameB);
                }

                // If NOT searching, prioritize selected items
                const isSelA = selectedArray.includes(codeA);
                const isSelB = selectedArray.includes(codeB);

                if (isSelA && !isSelB) return -1;
                if (!isSelA && isSelB) return 1;

                // Priority 3: Alphabetical
                return nameA.localeCompare(nameB);
            });

            if (!skipRender && listContainer) {
                const htmlParts = [];
                // Use a Set for fast lookup inside loop (optimization)
                const selectedSet = new Set(selectedArray);

                for (let i = 0; i < products.length; i++) {
                    const [code, name] = products[i];
                    const isChecked = selectedSet.has(code);
                    htmlParts.push(`
                        <label class="flex items-center p-2 hover:bg-slate-600 cursor-pointer">
                            <input type="checkbox" data-filter-type="${filterType}" class="form-checkbox h-4 w-4 glass-panel-heavy border-slate-500 rounded text-teal-500 focus:ring-teal-500" value="${code}" ${isChecked ? 'checked' : ''}>
                            <span class="ml-2 text-xs">(${code}) ${name}</span>
                        </label>`);
                }
                listContainer.innerHTML = htmlParts.join('');
            }

            if (selectedArray.length === 0) {
                filterText.textContent = 'Todos os Produtos';
            } else if (selectedArray.length === 1) {
                const productsInfo = new Map(products);
                filterText.textContent = productsInfo.get(selectedArray[0]) || '1 selecionado';
            } else {
                filterText.textContent = `${selectedArray.length} produtos selecionados`;
            }
            return selectedArray;
    };

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


    /**
     * Reusable generic filter handler for Supervisor & Vendedor views
     * This avoids duplicating the DOM handler boilerplate across different views.
     */
        /**
     * Reusable logic for configuring filial filter event handlers.
     * Encapsulates duplicated toggling, selecting, and closing logic.
     */

    /**
     * Reusable generic function to setup TipoVenda filter handlers.
     */
    window.setupGenericTipoVendaFilterHandlers = function(prefix, stateObj, updateTipoVendaFilterFn, dataSourceFn, updateCallbackFn) {
        let btnPrefix = prefix;
        if (prefix === 'main') {
            btnPrefix = ''; // for main view
        } else if (prefix === 'mix') {
            btnPrefix = 'mix';
        }

        const btnId = prefix === 'main' ? 'tipo-venda-filter-btn' : `${prefix}-tipo-venda-filter-btn`;
        const dropdownId = prefix === 'main' ? 'tipo-venda-filter-dropdown' : `${prefix}-tipo-venda-filter-dropdown`;
        const textId = prefix === 'main' ? 'tipo-venda-filter-text' : `${prefix}-tipo-venda-filter-text`;
        const wrapperId = prefix === 'main' ? 'tipo-venda-filter-wrapper' : `${prefix}-tipo-venda-filter-wrapper`;

        // Special case for Mix
        const actualBtnId = prefix === 'mix' ? 'mix-tipo-venda-filter-btn' : btnId;

        const btn = document.getElementById(actualBtnId);
        const dropdown = document.getElementById(dropdownId);
        const textSpan = document.getElementById(textId);
        const wrapper = document.getElementById(wrapperId);

        if (btn && dropdown) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            const newDropdown = dropdown.cloneNode(true);
            dropdown.parentNode.replaceChild(newDropdown, dropdown);

            newBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                newDropdown.classList.toggle('hidden');
                if (wrapper) {
                    if (!newDropdown.classList.contains('hidden')) {
                        wrapper.classList.add('z-50');
                    } else {
                        wrapper.classList.remove('z-50');
                    }
                }
            });

            newDropdown.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox') {
                    const val = e.target.value;
                    let currentSelected = stateObj.selectedTiposVenda || [];
                    if (e.target.checked) {
                         if (!currentSelected.includes(val)) currentSelected.push(val);
                    } else {
                         currentSelected = currentSelected.filter(v => v !== val);
                    }
                    stateObj.selectedTiposVenda = currentSelected;

                    const dataSource = typeof dataSourceFn === 'function' ? dataSourceFn() : (dataSourceFn || []);

                    if (typeof updateTipoVendaFilterFn === 'function') {
                        stateObj.selectedTiposVenda = updateTipoVendaFilterFn(newDropdown, textSpan, stateObj.selectedTiposVenda, dataSource);
                    } else if (typeof window.updateGenericTipoVendaFilter === 'function') {
                        stateObj.selectedTiposVenda = window.updateGenericTipoVendaFilter(newDropdown, textSpan, stateObj.selectedTiposVenda, dataSource);
                    }

                    if (typeof updateCallbackFn === 'function') {
                        updateCallbackFn();
                    }
                }
            });

            document.addEventListener('click', (e) => {
                if (!newBtn.contains(e.target) && !newDropdown.contains(e.target)) {
                    newDropdown.classList.add('hidden');
                    if(wrapper) wrapper.classList.remove('z-50');
                }
            });

            newDropdown._hasListener = true;
        }
    };


    window.setupGenericSingleDropdownFilterHandlers = function(prefix, updateCallbackFn) {
        const btn = document.getElementById(prefix + '-filter-btn');
        const dropdown = document.getElementById(prefix + '-filter-dropdown');
        const hiddenInput = document.getElementById(prefix + '-filter');
        const textSpan = document.getElementById(prefix + '-filter-text');
        const wrapper = document.getElementById(prefix + '-filter-wrapper');

        if (btn && dropdown && hiddenInput) {
            // Prevent attaching multiple identical listeners
            if (btn._hasSingleDropdownListener) return;

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('hidden');
                if (wrapper) {
                    if (dropdown.classList.contains('hidden')) wrapper.classList.remove('z-50');
                    else wrapper.classList.add('z-50');
                }
            });

            // Selection logic is dynamic since options might be added dynamically.
            dropdown.addEventListener('click', (e) => {
                const item = e.target.closest('.dropdown-item');
                if (item) {
                    const val = item.dataset.value;
                    const label = item.textContent.trim();

                    hiddenInput.value = val;
                    if (textSpan) textSpan.textContent = label;

                    dropdown.classList.add('hidden');
                    if (wrapper) wrapper.classList.remove('z-50');

                    // Trigger Update
                    if (typeof updateCallbackFn === 'function') {
                        updateCallbackFn();
                    }
                }
            });

            document.addEventListener('click', (e) => {
                if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.add('hidden');
                    if (wrapper) wrapper.classList.remove('z-50');
                }
            });

            btn._hasSingleDropdownListener = true;
        }
    };

    window.setupGenericFilialFilterHandlers = function(prefix, updateCallbackFn, customCloseLogic) {
        const btn = document.getElementById(`${prefix}-filial-filter-btn`);
        const dropdown = document.getElementById(`${prefix}-filial-filter-dropdown`);
        const hiddenInput = document.getElementById(`${prefix}-filial-filter`);
        const textSpan = document.getElementById(`${prefix}-filial-filter-text`);
        const wrapper = document.getElementById(`${prefix}-filial-filter-wrapper`);

        if (btn && dropdown && hiddenInput) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('hidden');

                if (typeof customCloseLogic === 'function') {
                    customCloseLogic();
                }

                if (wrapper) {
                    if (dropdown.classList.contains('hidden')) wrapper.classList.remove('z-50');
                    else wrapper.classList.add('z-50');
                }
            });

            dropdown.addEventListener('change', (e) => {
                if (e.target.type === 'radio') {
                    const val = e.target.value;
                    const labelSpan = e.target.closest('label').querySelector('span');
                    const label = labelSpan ? labelSpan.textContent : '';

                    hiddenInput.value = val;
                    if (textSpan) textSpan.textContent = label;

                    dropdown.classList.add('hidden');
                    if (wrapper) wrapper.classList.remove('z-50');

                    if (typeof updateCallbackFn === 'function') {
                        updateCallbackFn();
                    }
                }
            });

            document.addEventListener('click', (e) => {
                if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.add('hidden');
                    if (wrapper) wrapper.classList.remove('z-50');
                }
            });
        }
    };

    window.setupGenericFilterHandlers = function(prefix, selectedSupervisorsSet, selectedVendedoresSet, updateSupervisorFilterFn, updateVendedorFilterFn, filterChangeCallback, customCloseLogic, isSellerFilter = false, updateFilterButtonTextFn = null) {
        const supWrapperId = `${prefix}-supervisor-filter-wrapper`;
        const vendSuffix = isSellerFilter ? 'seller' : 'vendedor';
        const vendWrapperId = `${prefix}-${vendSuffix}-filter-wrapper`;

        const supBtn = document.getElementById(`${prefix}-supervisor-filter-btn`);
        const supDropdown = document.getElementById(`${prefix}-supervisor-filter-dropdown`);

        const vendBtn = document.getElementById(`${prefix}-${vendSuffix}-filter-btn`);
        const vendDropdown = document.getElementById(`${prefix}-${vendSuffix}-filter-dropdown`);

        const supTextId = `${prefix}-supervisor-filter-text`;
        const vendTextId = `${prefix}-${vendSuffix}-filter-text`;

        // If updateFilterButtonText is available locally or globally, use it
        const updateText = updateFilterButtonTextFn || (typeof window.updateFilterButtonText === 'function' ? window.updateFilterButtonText : null);

        if (supBtn && supDropdown) {
            const newBtn = supBtn.cloneNode(true);
            supBtn.parentNode.replaceChild(newBtn, supBtn);

            newBtn.onclick = (e) => {
                e.stopPropagation();
                const isHidden = supDropdown.classList.contains('hidden');

                // Close others
                const currentVendDd = document.getElementById(`${prefix}-${vendSuffix}-filter-dropdown`);
                if (currentVendDd) currentVendDd.classList.add('hidden');

                const vendWrapper = document.getElementById(vendWrapperId);
                if(vendWrapper) vendWrapper.classList.remove('z-50');

                if (typeof customCloseLogic === 'function') customCloseLogic();

                if(isHidden) {
                    supDropdown.classList.remove('hidden');
                    const supWrapper = document.getElementById(supWrapperId);
                    if(supWrapper) supWrapper.classList.add('z-50');
                } else {
                    supDropdown.classList.add('hidden');
                    const supWrapper = document.getElementById(supWrapperId);
                    if(supWrapper) supWrapper.classList.remove('z-50');
                }
            };

            supDropdown.onchange = (e) => {
                if (e.target.type === 'checkbox') {
                    const val = e.target.value;
                    if (e.target.checked) selectedSupervisorsSet.add(val);
                    else selectedSupervisorsSet.delete(val);

                    if (typeof updateText === 'function') {
                        updateText(document.getElementById(supTextId), selectedSupervisorsSet, 'Todos');
                    }

                    selectedVendedoresSet.clear();
                    if (typeof updateVendedorFilterFn === 'function') updateVendedorFilterFn();

                    if (typeof filterChangeCallback === 'function') {
                        filterChangeCallback({ excludeFilter: 'supervisor' });
                    }
                }
            };
        }

        if (vendBtn && vendDropdown) {
            const newBtn = vendBtn.cloneNode(true);
            vendBtn.parentNode.replaceChild(newBtn, vendBtn);

            newBtn.onclick = (e) => {
                e.stopPropagation();
                const isHidden = vendDropdown.classList.contains('hidden');

                // Close others
                const currentSupDd = document.getElementById(`${prefix}-supervisor-filter-dropdown`);
                if (currentSupDd) currentSupDd.classList.add('hidden');
                const supWrapper = document.getElementById(supWrapperId);
                if(supWrapper) supWrapper.classList.remove('z-50');

                if (typeof customCloseLogic === 'function') customCloseLogic();

                if(isHidden) {
                    vendDropdown.classList.remove('hidden');
                    const vendWrapper = document.getElementById(vendWrapperId);
                    if(vendWrapper) vendWrapper.classList.add('z-50');
                } else {
                    vendDropdown.classList.add('hidden');
                    const vendWrapper = document.getElementById(vendWrapperId);
                    if(vendWrapper) vendWrapper.classList.remove('z-50');
                }
            };

            vendDropdown.onchange = (e) => {
                if (e.target.type === 'checkbox') {
                    const val = e.target.value;
                    if (e.target.checked) selectedVendedoresSet.add(val);
                    else selectedVendedoresSet.delete(val);

                    if (typeof updateText === 'function') {
                        updateText(document.getElementById(vendTextId), selectedVendedoresSet, 'Todos');
                    }

                    if (typeof filterChangeCallback === 'function') {
                        filterChangeCallback({ excludeFilter: 'seller' });
                    }
                }
            };
        }

        const listenerKey = `_${prefix}FilterListener`;
        if (!document[listenerKey]) {
            document.addEventListener('click', (e) => {
                if (!e.target.closest(`#${supWrapperId}`)) {
                    const currentSupDd = document.getElementById(`${prefix}-supervisor-filter-dropdown`);
                    if (currentSupDd) currentSupDd.classList.add('hidden');
                    const supWrapper = document.getElementById(supWrapperId);
                    if(supWrapper) supWrapper.classList.remove('z-50');
                }
                if (!e.target.closest(`#${vendWrapperId}`)) {
                    const currentVendDd = document.getElementById(`${prefix}-${vendSuffix}-filter-dropdown`);
                    if (currentVendDd) currentVendDd.classList.add('hidden');
                    const vendWrapper = document.getElementById(vendWrapperId);
                    if(vendWrapper) vendWrapper.classList.remove('z-50');
                }
            });
            document[listenerKey] = true;
        }

        if (typeof updateSupervisorFilterFn === 'function') updateSupervisorFilterFn();
        if (typeof updateVendedorFilterFn === 'function') updateVendedorFilterFn();
    };

})();

    window.setupGenericRedeFilterHandlers = function(prefix, stateObj, getFilteredDataFn, updateViewFn, updateRedeFilterFn) {
        const redeGroupContainer = document.getElementById(prefix + '-rede-group-container');
        const dropdown = document.getElementById(prefix + '-rede-filter-dropdown');
        const comRedeBtn = document.getElementById(prefix + '-com-rede-btn');
        const comRedeBtnText = document.getElementById(prefix + '-com-rede-btn-text');

        if (redeGroupContainer) {
            redeGroupContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;

                const group = btn.dataset.group;
                stateObj.groupFilter = group;

                // UI Update
                redeGroupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (group === 'com_rede') {
                    dropdown.classList.remove('hidden');
                    const data = getFilteredDataFn({ excludeFilter: 'rede' });
                    const clients = data ? (data.clients || data) : []; // Handle both { clients } and array
                    if (typeof updateRedeFilterFn === 'function') {
                        stateObj.selectedRedes = updateRedeFilterFn(dropdown, comRedeBtnText, stateObj.selectedRedes, clients);
                    } else if (typeof window.updateGenericRedeFilter === 'function') {
                        stateObj.selectedRedes = window.updateGenericRedeFilter(dropdown, comRedeBtnText, stateObj.selectedRedes, clients);
                    }
                } else {
                    dropdown.classList.add('hidden');
                    if (group !== 'com_rede' && comRedeBtnText) comRedeBtnText.textContent = 'C/Rede';
                    if (typeof updateViewFn === 'function') updateViewFn();
                }
            });

            if (dropdown) {
                dropdown.addEventListener('change', (e) => {
                    if (e.target.type === 'checkbox') {
                        const val = e.target.value;
                        if (e.target.checked) {
                            stateObj.selectedRedes.push(val);
                        } else {
                            stateObj.selectedRedes = stateObj.selectedRedes.filter(v => v !== val);
                        }

                        const data = getFilteredDataFn({ excludeFilter: 'rede' });
                        const clients = data ? (data.clients || data) : [];
                        if (typeof updateRedeFilterFn === 'function') {
                        stateObj.selectedRedes = updateRedeFilterFn(dropdown, comRedeBtnText, stateObj.selectedRedes, clients);
                    } else if (typeof window.updateGenericRedeFilter === 'function') {
                        stateObj.selectedRedes = window.updateGenericRedeFilter(dropdown, comRedeBtnText, stateObj.selectedRedes, clients);
                    }

                        if (typeof updateViewFn === 'function') updateViewFn();
                    }
                });
            }

            document.addEventListener('click', (e) => {
                if (comRedeBtn && dropdown && !comRedeBtn.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.add('hidden');
                }
            });
        }
    };
