(function() {
    window.BusinessRules = {
        // --- CONFIGURATION ---
        SUPPLIER_CONFIG: {
            inference: {
                triggerKeywords: ['PEPSICO'],
                matchValue: 'PEPSICO',
                defaultValue: 'MULTIMARCAS'
            },
            metaRealizado: {
                requiredPasta: 'PEPSICO'
            }
        },

        GARBAGE_SELLER_KEYWORDS: ['TOTAL', 'GERAL', 'SUPERVISOR', 'BALCAO'],
        GARBAGE_SELLER_EXACT: ['INATIVOS', 'N/A'],

        // --- CORE RULES ---

        /**
         * Resolves the "Pasta" (Grouping) for a supplier row.
         */
        resolveSupplierPasta: function(rowPasta, fornecedorName) {
            if (!rowPasta || rowPasta === '0' || rowPasta === '00' || rowPasta === 'N/A') {
                const rawFornecedor = String(fornecedorName || '').toUpperCase();
                const match = this.SUPPLIER_CONFIG.inference.triggerKeywords.some(k => rawFornecedor.includes(k));
                return match ? this.SUPPLIER_CONFIG.inference.matchValue : this.SUPPLIER_CONFIG.inference.defaultValue;
            }
            return rowPasta;
        },

        /**
         * Checks if a seller name indicates a non-human/garbage entry.
         */
        isGarbageSeller: function(name) {
            if (!name) return true;
            // Normalize: Remove accents (NFD + Replace), Uppercase, Trim
            const upper = String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
            if (this.GARBAGE_SELLER_EXACT.includes(upper)) return true;
            return this.GARBAGE_SELLER_KEYWORDS.some(k => upper.includes(k));
        },

        /**
         * Determines if "Alternative Mode" (Bonus/Bonificação) is active for sales calculation.
         */
        isAlternativeMode: function(selectedTypes) {
            if (!selectedTypes || selectedTypes.length === 0) return false;
            // "Alternative Mode" is active ONLY if we have selected types AND none of them are 1 or 9.
            return !selectedTypes.includes('1') && !selectedTypes.includes('9');
        },

        /**
         * Gets the value for a sale based on selected types (Venda vs Bonificação).
         */
        getValueForSale: function(sale, selectedTypes) {
            if (this.isAlternativeMode(selectedTypes)) {
                return Number(sale.VLBONIFIC) || 0;
            }
            return Number(sale.VLVENDA) || 0;
        },

        /**
         * Applies specific client overrides (e.g., Americanas -> 1001).
         * @param {Object} client - The client object to modify in-place.
         * @returns {string|null} The forced RCA code if applied, otherwise null.
         */
        applyClientOverrides: function(client) {
            const razaoSocial = client.razaoSocial || client.RAZAOSOCIAL || client.Cliente || '';

            // Rule: AMERICANAS is always RCA 1001 (Balcão Logic)
            if (razaoSocial.toUpperCase().includes('AMERICANAS')) {
                client.rca1 = '1001';
                client.rcas = ['1001'];
                return '1001';
            }
            return null;
        },

        /**
         * Determines if a sale record should be excluded based on specific business rules.
         * @param {Object} sale - The sale/history record (or index proxy).
         * @param {string} clientCode - Normalized client code.
         * @returns {boolean} True if should be excluded.
         */
        shouldExcludeSale: function(sale, clientCode) {
            // Rule: Exclude Balcão (53) sales for Client 9569 from Summary Metrics
            const codUsur = String(sale.CODUSUR || '').trim();
            if (String(clientCode).trim() === '9569' && (codUsur === '53' || codUsur === '053')) {
                return true;
            }
            return false;
        },

        /**
         * Classifies a product/sale into a Goal Category (707, 708, 1119_TODDYNHO, etc.)
         * @param {string} codFor - Supplier Code.
         * @param {string} description - Product Description.
         * @returns {string|null} The category key or null.
         */
        classifyGoalCategory: function(codFor, description) {
            const code = String(codFor);
            const desc = String(description || '').toUpperCase(); // Use simple upper, app used normalize() but basic check is fine

            if (code === '707') return '707';
            if (code === '708') return '708';
            if (code === '752') return '752';
            if (code === '1119') {
                // Normalize locally if needed or assume input is decent
                const normDesc = desc.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
                if (normDesc.includes('TODDYNHO')) return '1119_TODDYNHO';
                if (normDesc.includes('TODDY')) return '1119_TODDY';
                if (normDesc.includes('QUAKER') || normDesc.includes('KEROCOCO')) return '1119_QUAKER_KEROCOCO';
            }
            return null;
        }
    };

    // --- GLOBAL ALIASES (For Backward Compatibility if needed during refactor) ---
    // These match what was previously in utils.js
    window.resolveSupplierPasta = window.BusinessRules.resolveSupplierPasta.bind(window.BusinessRules);
    window.isGarbageSeller = window.BusinessRules.isGarbageSeller.bind(window.BusinessRules);
    window.SUPPLIER_CONFIG = window.BusinessRules.SUPPLIER_CONFIG;
    window.GARBAGE_SELLER_KEYWORDS = window.BusinessRules.GARBAGE_SELLER_KEYWORDS;

})();
