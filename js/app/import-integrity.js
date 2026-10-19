(function (root) {
    'use strict';
    const contentTables = new Set(['data_detailed', 'data_history', 'data_nota_perfeita']);
    const technical = new Set(['id', 'import_fingerprint', 'created_at', 'updated_at']);
    function network(values) {
        for (const value of values) {
            const text = String(value ?? '').trim();
            if (text && !/^[\d.,]+$/.test(text) && !/^(?:N\/A|N\/D|S\/ REDE|SEM REDE|--|-|NULL)$/i.test(text)) return text;
        }
        return 'N/A';
    }
    function contentKey(row) {
        return JSON.stringify(Object.keys(row).filter(k => !technical.has(k)).sort().map(k => [k, row[k] ?? null]));
    }
    function rowsForUpload(table, data, columnar, formatValue) {
        const rows = [], seen = new Set();
        for (let i = 0; i < data.length; i++) {
            const source = columnar ? Object.fromEntries(data.columns.map(k => [k, data.values[k][i]])) : data[i];
            const row = {};
            for (const [key, value] of Object.entries(source)) {
                const lower = key.toLowerCase();
                if (lower !== 'import_fingerprint') row[lower] = formatValue(lower, value);
            }
            if (contentTables.has(table)) {
                const key = contentKey(row);
                if (seen.has(key)) continue;
                seen.add(key);
                delete row.id;
            }
            rows.push(row);
        }
        return rows;
    }
    async function assignStableIds(table, rows, cryptoApi) {
        if (!contentTables.has(table)) return;
        await Promise.all(rows.map(async row => {
            const bytes = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(table + ':' + contentKey(row)));
            const hash = Array.from(new Uint8Array(bytes).slice(0, 16), b => b.toString(16).padStart(2, '0'));
            hash[6] = '5' + hash[6][1];
            hash[8] = ((parseInt(hash[8], 16) & 63) | 128).toString(16).padStart(2, '0');
            const hex = hash.join('');
            row.id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        }));
    }
    const api = { network, contentKey, rowsForUpload, assignStableIds };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.PrimeImportIntegrity = api;
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {});
