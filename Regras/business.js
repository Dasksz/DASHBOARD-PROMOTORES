// Pure Business Logic Functions

window.Rules = window.Rules || {};

window.Rules.resolveSupplierPasta = function(rowPasta, fornecedorName) {
    const config = window.Rules.SUPPLIER_CONFIG;
    if (!rowPasta || rowPasta === '0' || rowPasta === '00' || rowPasta === 'N/A') {
        const rawFornecedor = String(fornecedorName || '').toUpperCase();
        const match = config.inference.triggerKeywords.some(k => rawFornecedor.includes(k));
        return match ? config.inference.matchValue : config.inference.defaultValue;
    }
    return rowPasta;
};

window.Rules.isGarbageSeller = function(name) {
    if (!name) return true;
    // Normalize: Remove accents (NFD + Replace), Uppercase, Trim
    const upper = String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    if (window.Rules.GARBAGE_SELLER_EXACT.includes(upper)) return true;
    return window.Rules.GARBAGE_SELLER_KEYWORDS.some(k => upper.includes(k));
};

window.Rules.isAlternativeMode = function(selectedTypes) {
    if (!selectedTypes || selectedTypes.length === 0) return false;
    // "Alternative Mode" is active ONLY if we have selected types AND none of them are 1 or 9.
    return !selectedTypes.includes('1') && !selectedTypes.includes('9');
};

window.Rules.getValueForSale = function(sale, selectedTypes) {
    if (window.Rules.isAlternativeMode(selectedTypes)) {
        return Number(sale.VLBONIFIC) || 0;
    }
    return Number(sale.VLVENDA) || 0;
};
