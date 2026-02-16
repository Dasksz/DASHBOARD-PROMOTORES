(function() {
    // --- CONFIGURATION ---
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
        const s = String(key).trim();
        if (/^\d+$/.test(s)) {
            return String(parseInt(s, 10));
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

        // Se já for um objeto Date, retorna diretamente
        if (dateString instanceof Date) {
            return !isNaN(dateString.getTime()) ? dateString : null;
        }

        // Se for uma string, verifica o cache
        if (typeof dateString === 'string') {
            const cached = dateCache.get(dateString);
            if (cached !== undefined) {
                return cached !== null ? new Date(cached) : null;
            }
        } else if (typeof dateString === 'number') {
            // Se for um número (formato Excel ou Timestamp)
            // Excel Serial Date (approx < 50000 for current dates, Timestamp is > 1000000000000)
            if (dateString < 100000) return new Date(Math.round((dateString - 25569) * 86400 * 1000));
            // Timestamp
            return new Date(dateString);
        } else {
            return null;
        }

        let result = null;

        // Tentativa de parse para 'YYYY-MM-DDTHH:mm:ss.sssZ' ou 'YYYY-MM-DD'
        // O construtor do Date já lida bem com isso, mas vamos garantir o UTC.
        if (dateString.includes('T') || dateString.includes('-')) {
             // Adiciona 'Z' se não tiver informação de fuso horário para forçar UTC
            const isoString = dateString.endsWith('Z') ? dateString : dateString + 'Z';
            const isoDate = new Date(isoString);
            if (!isNaN(isoDate.getTime())) {
                result = isoDate;
            }
        }

        // Tentativa de parse para 'DD/MM/YYYY'
        if (!result && dateString.length === 10 && dateString.charAt(2) === '/' && dateString.charAt(5) === '/') {
            const [day, month, year] = dateString.split('/');
            if (year && month && day && year.length === 4) {
                // Cria a data em UTC para evitar problemas de fuso horário
                const utcDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
                if (!isNaN(utcDate.getTime())) {
                    result = utcDate;
                }
            }
        }

        // Fallback para outros formatos que o `new Date()` consegue interpretar
        if (!result) {
            const genericDate = new Date(dateString);
            if (!isNaN(genericDate.getTime())) {
                result = genericDate;
            }
        }

        // Armazena no cache (apenas strings)
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

})();
