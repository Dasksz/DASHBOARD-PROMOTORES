// Generic Utilities

window.Utils = window.Utils || {};

// --- Columnar Dataset Class ---
class ColumnarDataset {
    constructor(columnarData) {
        this.columns = columnarData.columns;
        this._data = columnarData.values;
        this.length = columnarData.length;
        this._overrides = new Map(); // Stores mutations: Map<index, Object>
    }

    get(index) {
        if (index < 0 || index >= this.length) return undefined;

        const overrides = this._overrides;
        const values = this._data;
        const columns = this.columns;

        // Return a Lazy Proxy that constructs properties only on access
        return new Proxy({}, {
            get(target, prop) {
                if (prop === 'toJSON') return () => "ColumnarRowProxy";

                // 1. Check overrides first (mutations)
                const ov = overrides.get(index);
                if (ov && prop in ov) {
                    return ov[prop];
                }

                // 2. Check columnar data (lazy read)
                if (values && values[prop]) {
                    return values[prop][index];
                }

                return target[prop];
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
                const ov = overrides.get(index);
                if (ov) {
                    const keys = new Set(columns);
                    Object.keys(ov).forEach(k => keys.add(k));
                    return Array.from(keys);
                }
                return columns;
            },

            getOwnPropertyDescriptor(target, prop) {
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

    // Helper to behave like an array
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

    find(callback) {
        for (let i = 0; i < this.length; i++) {
            const item = this.get(i);
            if (callback(item, i)) return item;
        }
        return undefined;
    }
}

// --- Index Map Class ---
class IndexMap {
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

    forEach(callback) {
        this._indices.forEach((index, key) => {
            callback(this._source.get(index), key);
        });
    }
}

// Expose classes
window.Utils.ColumnarDataset = ColumnarDataset;
window.Utils.IndexMap = IndexMap;

// --- Helper Functions ---

window.Utils.normalizeKey = function(key) {
    if (!key) return '';
    const s = String(key).trim();
    if (/^\d+$/.test(s)) {
        return String(parseInt(s, 10));
    }
    return s;
};

// Date Parsing with Cache
const dateCache = new Map();
window.Utils.parseDate = function(dateString) {
    if (!dateString) return null;

    if (dateString instanceof Date) {
        return !isNaN(dateString.getTime()) ? dateString : null;
    }

    if (typeof dateString === 'string') {
        const cached = dateCache.get(dateString);
        if (cached !== undefined) {
            return cached !== null ? new Date(cached) : null;
        }
    } else if (typeof dateString === 'number') {
        if (dateString < 100000) return new Date(Math.round((dateString - 25569) * 86400 * 1000));
        return new Date(dateString);
    } else {
        return null;
    }

    let result = null;

    if (dateString.includes('T') || dateString.includes('-')) {
        const isoString = dateString.endsWith('Z') ? dateString : dateString + 'Z';
        const isoDate = new Date(isoString);
        if (!isNaN(isoDate.getTime())) {
            result = isoDate;
        }
    }

    if (!result && dateString.length === 10 && dateString.charAt(2) === '/' && dateString.charAt(5) === '/') {
        const [day, month, year] = dateString.split('/');
        if (year && month && day && year.length === 4) {
            const utcDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
            if (!isNaN(utcDate.getTime())) {
                result = utcDate;
            }
        }
    }

    if (!result) {
        const genericDate = new Date(dateString);
        if (!isNaN(genericDate.getTime())) {
            result = genericDate;
        }
    }

    dateCache.set(dateString, result !== null ? result.getTime() : null);
    return result;
};

window.Utils.formatDate = function(date) {
    if (!date) return '';
    const d = window.Utils.parseDate(date);
    if (!d || isNaN(d.getTime())) return '';
    // Adjust for timezone display if needed, but standard locale string usually fine for visual
    const userTimezoneOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() + userTimezoneOffset).toLocaleDateString('pt-BR');
};

window.Utils.runAsyncChunked = function(items, processItemFn, onComplete, isCancelled) {
    let index = 0;
    const total = items.length;
    const isColumnar = items instanceof ColumnarDataset;

    function nextChunk() {
        if (isCancelled && isCancelled()) return;

        const start = performance.now();
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

            if (performance.now() - start >= 12) {
                break;
            }
        }

        if (index < total) {
            requestAnimationFrame(nextChunk);
        } else {
            if(onComplete) onComplete();
        }
    }

    requestAnimationFrame(nextChunk);
};

window.Utils.showToast = function(type, message, title = '') {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.error('Toast container not found!');
        console.log(`[${type}] ${message}`);
        return;
    }

    const variants = {
        success: {
            class: 'toast-success',
            icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
            defaultTitle: 'Sucesso'
        },
        error: {
            class: 'toast-error',
            icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
            defaultTitle: 'Erro'
        },
        info: {
            class: 'toast-info',
            icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
            defaultTitle: 'Informação'
        },
        warning: {
            class: 'toast-warning',
            icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`,
            defaultTitle: 'Atenção'
        }
    };

    const variant = variants[type] || variants.info;
    const finalTitle = title || variant.defaultTitle;

    const toast = document.createElement('div');
    toast.className = `toast ${variant.class}`;
    toast.innerHTML = `
        <div class="toast-icon">${variant.icon}</div>
        <div class="flex-1 min-w-0">
            <h4 class="toast-title">${finalTitle}</h4>
            <p class="toast-message">${message}</p>
        </div>
        <button class="toast-close-btn" onclick="this.parentElement.remove()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        ${type !== 'error' ? '<div class="toast-progress"></div>' : ''}
    `;

    container.appendChild(toast);

    if (type !== 'error') {
        const timeout = 5000;
        const progress = toast.querySelector('.toast-progress');
        if(progress) progress.style.animationDuration = `${timeout}ms`;

        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('hiding');
                toast.addEventListener('animationend', () => toast.remove());
            }
        }, timeout);
    }
};

window.Utils.getFirstName = function(fullName) {
    return (fullName || '').split(' ')[0];
};
