const fs = require('fs');

window = { ColumnarDataset: class ColumnarDataset {
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
                const baseKeys = columns;
                if (!ov) return baseKeys;
                return Array.from(new Set([...baseKeys, ...Object.keys(ov)]));
            },

            getOwnPropertyDescriptor(target, prop) {
                return {
                    enumerable: true,
                    configurable: true,
                };
            }
        });
    }

    // Generator for iteration (e.g., for...of)
    *[Symbol.iterator]() {
        for (let i = 0; i < this.length; i++) {
            yield this.get(i);
        }
    }

    // Array-like map implementation
    map(callback) {
        const result = [];
        for (let i = 0; i < this.length; i++) {
            result.push(callback(this.get(i), i, this));
        }
        return result;
    }

    // Array-like forEach implementation
    forEach(callback) {
        for (let i = 0; i < this.length; i++) {
            callback(this.get(i), i, this);
        }
    }

    // Array-like filter implementation
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
}
};
const ColumnarDataset = window.ColumnarDataset;

// Create some dummy data
const len = 50000;
const columns = {
    'TIPOVENDA': new Array(len).fill(1).map((_, i) => (i % 5) + 1),
    'CODCLI': new Array(len).fill(1).map((_, i) => i)
};

const data = {
    columns: ['TIPOVENDA', 'CODCLI'],
    values: columns,
    length: len
};

const allSalesData = new ColumnarDataset(data);
const allHistoryData = new ColumnarDataset(data);

const t0 = performance.now();
const availableTypes1 = new Set([...allSalesData.map(s => String(s.TIPOVENDA)), ...allHistoryData.map(s => String(s.TIPOVENDA))]);
const t1 = performance.now();
console.log("Original map chain took: " + (t1 - t0) + " ms");
console.log("Original sizes: ", availableTypes1.size);

const t2 = performance.now();
const availableTypes2 = new Set();
// optimize with direct access
let isColSales = typeof allSalesData.get === 'function';
let isColHist = typeof allHistoryData.get === 'function';

let salesTV = isColSales ? allSalesData._data['TIPOVENDA'] : null;
let histTV = isColHist ? allHistoryData._data['TIPOVENDA'] : null;

if (isColSales && salesTV) {
    for(let i = 0; i < allSalesData.length; i++) availableTypes2.add(String(salesTV[i]));
} else {
    for(let i = 0; i < allSalesData.length; i++) availableTypes2.add(String(allSalesData[i].TIPOVENDA));
}

if (isColHist && histTV) {
    for(let i = 0; i < allHistoryData.length; i++) availableTypes2.add(String(histTV[i]));
} else {
     for(let i = 0; i < allHistoryData.length; i++) availableTypes2.add(String(allHistoryData[i].TIPOVENDA));
}
const t3 = performance.now();
console.log("Optimized loop took: " + (t3 - t2) + " ms");
console.log("Optimized sizes: ", availableTypes2.size);
