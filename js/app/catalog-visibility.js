(function(root) {
    function apply(data) {
        const raw = (data.metadata || []).find(row => row.key === 'non_merchandise_codes')?.value;
        const blocked = new Set(raw ? JSON.parse(raw).map(String) : []);
        if (!blocked.size) return data;
        const allowed = code => !blocked.has(String(code ?? '').trim());
        data.products = (data.products || []).filter(p => allowed(p.code));
        data.dim_produtos = (data.dim_produtos || []).filter(p => allowed(p.codigo));
        data.activeProductCodes = (data.activeProductCodes || []).filter(allowed);
        for (const key of ['productDetails','stockMap05','stockMap08']) {
            for (const code of Object.keys(data[key] || {})) if (!allowed(code)) delete data[key][code];
        }
        for (const key of ['detailed','history']) {
            const table = data[key];
            if (!table) continue;
            if (Array.isArray(table)) { data[key] = table.filter(row=>allowed(row.PRODUTO || row.produto)); continue; }
            const codes = table.values?.PRODUTO || table.values?.produto;
            if (!codes) continue;
            let hasBlocked = false;
            for (let i=0;i<table.length;i++) if (!allowed(codes[i])) { hasBlocked = true; break; }
            if (!hasBlocked) continue;
            const keep = [];
            for (let i=0;i<table.length;i++) if (allowed(codes[i])) keep.push(i);
            const values = {};
            for (const column of table.columns) values[column] = keep.map(i=>table.values[column][i]);
            data[key] = {...table,values,length:keep.length};
        }
        data.innovationsMonth = (data.innovationsMonth || []).filter(row=>allowed(row.codigo || row.code));
        return data;
    }
    root.PrimeCatalogVisibility = {apply};
    if (typeof module !== 'undefined' && module.exports) module.exports = {apply};
})(typeof window !== 'undefined' ? window : globalThis);
