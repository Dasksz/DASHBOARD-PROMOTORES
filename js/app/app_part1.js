(function() {
        const embeddedData = window.embeddedData;

        // --- CONFIGURATION MOVED TO utils.js ---
        // SUPPLIER_CONFIG, resolveSupplierPasta, GARBAGE_SELLER_KEYWORDS, isGarbageSeller available globally

        let metaRealizadoDataForExport = { sellers: [], clients: [], weeks: [] };
        let lastSaleDate = null;

        // --- HELPER: Alternative Sales Type Logic ---
        function isAlternativeMode(selectedTypes) {
            if (!selectedTypes || selectedTypes.length === 0) return false;
            // "Alternative Mode" is active ONLY if we have selected types AND none of them are 1 or 9.
            return !selectedTypes.includes('1') && !selectedTypes.includes('9');
        }

        function getValueForSale(sale, selectedTypes) {
            if (isAlternativeMode(selectedTypes)) {
                return Number(sale.VLBONIFIC) || 0;
            }
            return Number(sale.VLVENDA) || 0;
        }
        // ---------------------------------------------

        // --- OPTIMIZATIONS (ColumnarDataset, IndexMap, parseDate, runAsyncChunked) MOVED TO utils.js ---

        const FORBIDDEN_KEYS = ['SUPERV', 'CODUSUR', 'CODSUPERVISOR', 'NOME', 'CODCLI', 'PRODUTO', 'DESCRICAO', 'FORNECEDOR', 'OBSERVACAOFOR', 'CODFOR', 'QTVENDA', 'VLVENDA', 'VLBONIFIC', 'TOTPESOLIQ', 'ESTOQUEUNIT', 'TIPOVENDA', 'FILIAL', 'ESTOQUECX', 'SUPERVISOR', 'PASTA', 'RAMO', 'ATIVIDADE', 'CIDADE', 'MUNICIPIO', 'BAIRRO'];
        let allSalesData, allHistoryData, allClientsData;

        function normalizePastaInData(dataset) {
            // Cache for supplier -> pasta mapping to avoid repeated config lookups
            const supplierCache = new Map();

            const getResolvedPasta = (currentPasta, fornecedor) => {
                // If we already have a valid pasta, return it
                if (currentPasta && currentPasta !== '0' && currentPasta !== '00' && currentPasta !== 'N/A') {
                    return currentPasta;
                }

                // Check cache
                const key = String(fornecedor || '').toUpperCase();
                if (supplierCache.has(key)) {
                    return supplierCache.get(key);
                }

                // Calculate and cache
                const resolved = resolveSupplierPasta(currentPasta, fornecedor);
                supplierCache.set(key, resolved);
                return resolved;
            };

            if (dataset instanceof ColumnarDataset) {
                const data = dataset._data;
                const len = dataset.length;

                // Ensure columns exist or gracefully handle
                const pastaCol = data['OBSERVACAOFOR'] || new Array(len).fill(null);
                const supplierCol = data['FORNECEDOR'] || [];

                // If we created a new array for pasta, we must attach it to _data
                if (!data['OBSERVACAOFOR']) {
                    data['OBSERVACAOFOR'] = pastaCol;
                    if (dataset.columns && !dataset.columns.includes('OBSERVACAOFOR')) {
                        dataset.columns.push('OBSERVACAOFOR');
                    }
                }

                for (let i = 0; i < len; i++) {
                    const originalPasta = pastaCol[i];
                    const fornecedor = supplierCol[i];
                    const newPasta = getResolvedPasta(originalPasta, fornecedor);

                    // Only update if changed (optimization)
                    if (newPasta !== originalPasta) {
                        pastaCol[i] = newPasta;
                    }
                }
            } else if (Array.isArray(dataset)) {
                 for (let i = 0; i < dataset.length; i++) {
                    const item = dataset[i];
                    const originalPasta = item['OBSERVACAOFOR'];
                    const fornecedor = item['FORNECEDOR'];
                    const newPasta = getResolvedPasta(originalPasta, fornecedor);

                    if (newPasta !== originalPasta) {
                        item['OBSERVACAOFOR'] = newPasta;
                    }
                 }
            }
        }

        function sanitizeData(data) {
            if (!data) return [];
            const forbidden = ['SUPERV', 'CODUSUR', 'CODSUPERVISOR', 'NOME', 'CODCLI', 'PRODUTO', 'DESCRICAO', 'FORNECEDOR', 'OBSERVACAOFOR', 'CODFOR', 'QTVENDA', 'VLVENDA', 'VLBONIFIC', 'TOTPESOLIQ', 'ESTOQUEUNIT', 'TIPOVENDA', 'FILIAL', 'ESTOQUECX', 'SUPERVISOR'];

            // Check if it's a ColumnarDataset proxy or regular array.
            // If it's a ColumnarDataset, we can't easily filter in-place without rebuilding.
            // However, ColumnarDataset usually proxies access.
            // Since we're trying to fix garbage, it's safer to check if we can filter.

            if (Array.isArray(data)) {
                return data.filter(item => {
                    const superv = String(item.SUPERV || '').trim().toUpperCase();
                    const nome = String(item.NOME || '').trim().toUpperCase();
                    const codUsur = String(item.CODUSUR || '').trim().toUpperCase();
                    // Check against headers
                    if (forbidden.includes(superv) || forbidden.includes(nome) || forbidden.includes(codUsur)) return false;
                    return true;
                });
            }

            // Handle Columnar Object (Raw)
            if (data.columns && data.values && typeof data.length === 'number') {
                const len = data.length;
                const keepIndices = [];
                const values = data.values;

                // Identify columns to check (case insensitive check usually handled by worker/init, but here we assume keys match)
                // Typically 'SUPERV', 'NOME', 'CODUSUR' are uppercase keys from init.js parser.
                const supervCol = values['SUPERV'] || values['supervisor'] || [];
                const nomeCol = values['NOME'] || values['nome'] || [];
                const codUsurCol = values['CODUSUR'] || values['codusur'] || [];

                // If checking columns are completely missing, we assume data is clean or check is not applicable
                if (!values['SUPERV'] && !values['NOME'] && !values['CODUSUR']) {
                    return data;
                }

                for (let i = 0; i < len; i++) {
                     const superv = String(supervCol[i] || '').trim().toUpperCase();
                     const nome = String(nomeCol[i] || '').trim().toUpperCase();
                     const codUsur = String(codUsurCol[i] || '').trim().toUpperCase();

                     if (forbidden.includes(superv) || forbidden.includes(nome) || forbidden.includes(codUsur)) {
                         continue; // Skip (Garbage)
                     }
                     keepIndices.push(i);
                }

                // If nothing filtered, return original
                if (keepIndices.length === len) return data;

                // Rebuild
                const newValues = {};
                data.columns.forEach(col => {
                    const oldArr = values[col];
                    // Defensive: if column array is missing or length mismatch, handle gracefully?
                    if (!oldArr) {
                        newValues[col] = [];
                        return;
                    }

                    const newArr = new Array(keepIndices.length);
                    for(let j=0; j<keepIndices.length; j++) {
                        newArr[j] = oldArr[keepIndices[j]];
                    }
                    newValues[col] = newArr;
                });

                return {
                    columns: data.columns,
                    values: newValues,
                    length: keepIndices.length
                };
            }

            return data;
        }

        if (embeddedData.isColumnar) {
            allSalesData = new ColumnarDataset(sanitizeData(embeddedData.detailed));
            allHistoryData = new ColumnarDataset(sanitizeData(embeddedData.history));
            allClientsData = new ColumnarDataset(sanitizeData(embeddedData.clients));
        } else {
            allSalesData = sanitizeData(embeddedData.detailed);
            allHistoryData = sanitizeData(embeddedData.history);
            allClientsData = embeddedData.clients;
        }

        // --- PRE-PROCESSING: Normalize PASTA once to avoid repeated logic in loops ---
        normalizePastaInData(allSalesData);
        normalizePastaInData(allHistoryData);
        // -----------------------------------------------------------------------------

        let aggregatedOrders = embeddedData.byOrder;
        const stockData05 = new Map(Object.entries(embeddedData.stockMap05 || {}));
        const stockData08 = new Map(Object.entries(embeddedData.stockMap08 || {}));
        const innovationsMonthData = embeddedData.innovationsMonth;
        let clientMapForKPIs;
        if (allClientsData instanceof ColumnarDataset) {
            clientMapForKPIs = new IndexMap(allClientsData);
            // Optimization: Try to access raw column to avoid Proxy creation loop.
            // Accessing private _data is necessary for performance here to bypass the get() Proxy overhead.
            const rawData = allClientsData._data;
            let idCol = null;
            if (rawData) {
                if (rawData['Código']) idCol = rawData['Código'];
                else if (rawData['codigo_cliente']) idCol = rawData['codigo_cliente'];
            }

            // Check if idCol is an Array or TypedArray (has length and integer indexing)
            if (idCol && typeof idCol.length === 'number') {
                for (let i = 0; i < allClientsData.length; i++) {
                    clientMapForKPIs.set(normalizeKey(idCol[i]), i);
                }
            } else {
                for (let i = 0; i < allClientsData.length; i++) {
                    const c = allClientsData.get(i);
                    clientMapForKPIs.set(normalizeKey(c['Código'] || c['codigo_cliente']), i);
                }
            }
        } else {
            clientMapForKPIs = new Map();
            for (let i = 0; i < allClientsData.length; i++) {
                const c = allClientsData[i];
                clientMapForKPIs.set(normalizeKey(c['Código'] || c['codigo_cliente']), c);
            }
        }

        const activeProductCodesFromCadastro = new Set(embeddedData.activeProductCodes || []);
        const productDetailsMap = new Map(Object.entries(embeddedData.productDetails || {}));
        const passedWorkingDaysCurrentMonth = embeddedData.passedWorkingDaysCurrentMonth || 1;

        const clientsWithSalesThisMonth = new Set();
        // Populate set
        for(let i=0; i<allSalesData.length; i++) {
            const s = allSalesData instanceof ColumnarDataset ? allSalesData.get(i) : allSalesData[i];
            clientsWithSalesThisMonth.add(s.CODCLI);
        }

        // Helper to ensure .get() exists
        const ensureGet = (data) => {
            if (Array.isArray(data) && !data.get) {
                Object.defineProperty(data, 'get', {
                    value: function(i) { return this[i]; },
                    enumerable: false
                });
            }
            return data;
        };

        const optimizedData = {
            salesById: ensureGet(allSalesData), // Use dataset directly to avoid empty IndexMap issues
            historyById: ensureGet(allHistoryData), // Use dataset directly
            indices: {
                current: {
                    bySupervisor: new Map(),
                    byRca: new Map(),
                    byPasta: new Map(),
                    bySupplier: new Map(),
                    byClient: new Map(),
                    byPosition: new Map(),
                    byRede: new Map(),
                    byTipoVenda: new Map(),
                    byProduct: new Map(),
                    byCity: new Map(),
                    byFilial: new Map()
                },
                history: {
                    bySupervisor: new Map(),
                    byRca: new Map(),
                    byPasta: new Map(),
                    bySupplier: new Map(),
                    byClient: new Map(),
                    byPosition: new Map(),
                    byRede: new Map(),
                    byTipoVenda: new Map(),
                    byProduct: new Map(),
                    byCity: new Map(),
                    byFilial: new Map()
                }
            },
            searchIndices: {
                clients: [], // [{ code, nameLower, cityLower }]
                products: [] // [{ code, descLower }]
            }
        };
        let clientLastBranch = new Map();
        let clientRamoMap = new Map();

        // --- EXPORT HELPERS ---
...2005 lines omitted for brevity...
            if (typeof adminViewMode !== 'undefined' && adminViewMode === 'seller') {
                clients = [];
                const hasSup = selectedComparisonSupervisors.size > 0;
                const hasVend = selectedComparisonVendedores.size > 0;
                const source = allClientsData;
                const len = source.length;
                for(let i=0; i<len; i++) {
                    const c = source instanceof ColumnarDataset ? source.get(i) : source[i];
                    const rca1 = String(c.rca1 || '').trim();
                    const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');

                    if (window.userRole === 'adm' && !isAmericanas && rca1 === '') continue; // Skip strictly inactive

                    let keep = true;
                    if (hasSup || hasVend) {
                        const details = sellerDetailsMap.get(rca1);
                        if (hasSup) {
                            if (!details || !selectedComparisonSupervisors.has(details.supervisor)) keep = false;
                        }
                        if (keep && hasVend) {
                            if (!selectedComparisonVendedores.has(rca1)) keep = false;
                        }
                    }
                    if (keep) clients.push(c);
                }
            } else {
                clients = getHierarchyFilteredClients('comparison', allClientsData);

                // --- FIX: Apply Supervisor and Seller Filters in Standard Mode ---
                const hasSup = selectedComparisonSupervisors.size > 0;
                const hasVend = selectedComparisonVendedores.size > 0;

                if (hasSup || hasVend) {
                    const filteredClients = [];
                    const len = clients.length;
                    for (let i = 0; i < len; i++) {
                        const c = clients[i]; // already a proxy or object from getHierarchyFilteredClients
                        const rca1 = String(c.rca1 || '').trim();
                        let keep = true;

                        if (hasSup || hasVend) {
                            const details = sellerDetailsMap.get(rca1);
                            if (hasSup) {
                                if (!details || !selectedComparisonSupervisors.has(details.supervisor)) keep = false;
                            }
                            if (keep && hasVend) {
                                if (!selectedComparisonVendedores.has(rca1)) keep = false;
                            }
                        }
                        if (keep) filteredClients.push(c);
                    }
                    clients = filteredClients;
                }
                // -----------------------------------------------------------------
            }

            if (comparisonRedeGroupFilter) {
                if (comparisonRedeGroupFilter === 'com_rede') {
                    clients = clients.filter(c => c.ramo && c.ramo !== 'N/A');
                     if (redeSet.size > 0) {
                        clients = clients.filter(c => redeSet.has(c.ramo));
                    }
                } else if (comparisonRedeGroupFilter === 'sem_rede') {
                    clients = clients.filter(c => !c.ramo || c.ramo === 'N/A');
                }
            }

            const clientCodes = new Set(clients.map(c => c['Código'] || c['codigo_cliente']));

            const filters = {
                filial,
                pasta,
                tipoVenda: tiposVendaSet,
                supplier: suppliersSet,
                product: productsSet,
                city,
                clientCodes
            };

            const perdasFilters = { ...filters, tipoVenda: new Set(['5']) };

            return {
                currentSales: getFilteredDataFromIndices(optimizedData.indices.current, optimizedData.salesById, filters, excludeFilter),
                historySales: getFilteredDataFromIndices(optimizedData.indices.history, optimizedData.historyById, filters, excludeFilter),
                perdasSales: getFilteredDataFromIndices(optimizedData.indices.current, optimizedData.salesById, perdasFilters, excludeFilter),
                perdasHistory: getFilteredDataFromIndices(optimizedData.indices.history, optimizedData.historyById, perdasFilters, excludeFilter)
            };
        }


        function updateAllComparisonFilters() {
            // Update Supervisor Filter
            if (typeof updateComparisonSupervisorFilter === 'function') updateComparisonSupervisorFilter();
            if (typeof updateComparisonVendedorFilter === 'function') updateComparisonVendedorFilter();

            const { currentSales: supplierCurrent, historySales: supplierHistory } = getComparisonFilteredData({ excludeFilter: 'supplier' });
            const supplierOptionsData = [...supplierCurrent, ...supplierHistory];
            selectedComparisonSuppliers = updateSupplierFilter(comparisonSupplierFilterDropdown, comparisonSupplierFilterText, selectedComparisonSuppliers, supplierOptionsData, 'comparison');

            const { currentSales: tvCurrent, historySales: tvHistory } = getComparisonFilteredData({ excludeFilter: 'tipoVenda' });
            selectedComparisonTiposVenda = updateTipoVendaFilter(comparisonTipoVendaFilterDropdown, comparisonTipoVendaFilterText, selectedComparisonTiposVenda, [...tvCurrent, ...tvHistory]);

            updateComparisonProductFilter();

            const { currentSales: cityCurrent, historySales: cityHistory } = getComparisonFilteredData({ excludeFilter: 'city' });
            const cityOptionsData = [...cityCurrent, ...cityHistory];
            updateComparisonCitySuggestions(cityOptionsData);

            const { currentSales: pastaCurrent, historySales: pastaHistory } = getComparisonFilteredData({ excludeFilter: 'pasta' });
            const pastaOptionsData = [...pastaCurrent, ...pastaHistory];
            const pepsicoBtn = document.querySelector('#comparison-fornecedor-toggle-container button[data-fornecedor="PEPSICO"]');
            const multimarcasBtn = document.querySelector('#comparison-fornecedor-toggle-container button[data-fornecedor="MULTIMARCAS"]');
            const hasPepsico = pastaOptionsData.some(s => s.OBSERVACAOFOR === 'PEPSICO');
            const hasMultimarcas = pastaOptionsData.some(s => s.OBSERVACAOFOR === 'MULTIMARCAS');
            pepsicoBtn.disabled = !hasPepsico;
            multimarcasBtn.disabled = !hasMultimarcas;
            pepsicoBtn.classList.toggle('opacity-50', !hasPepsico);
            multimarcasBtn.classList.toggle('opacity-50', !hasMultimarcas);
        }

        function setupComparisonSupervisorFilterHandlers() {
...7025 lines omitted for brevity...
