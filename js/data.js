window.Data = {
    isDataLoaded: false,

    // --- IndexedDB ---
    initDB: function() {
        return idb.openDB('PrimeDashboardDB_V2', 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('data_store')) {
                    db.createObjectStore('data_store');
                }
            },
        });
    },

    getFromCache: async function(key) {
        try {
            const db = await this.initDB();
            return await db.get('data_store', key);
        } catch (e) {
            console.warn('Erro cache:', e);
            return null;
        }
    },

    saveToCache: async function(key, value) {
        try {
            const db = await this.initDB();
            await db.put('data_store', value, key);
        } catch (e) {
            console.warn('Erro salvar cache:', e);
        }
    },

    // --- Parsers ---
    clientMap: {
        'CODIGO_CLIENTE': 'Código',
        'RCA1': 'RCA 1',
        'RCA2': 'RCA 2',
        'NOMECLIENTE': 'Cliente',
        'RAZAOSOCIAL': 'razaoSocial',
        'ULTIMACOMPRA': 'Data da Última Compra',
        'DATACADASTRO': 'Data e Hora de Cadastro',
        'INSCRICAOESTADUAL': 'Insc. Est. / Produtor',
        'CNPJ_CPF': 'CNPJ/CPF',
        'ENDERECO': 'Endereço Comercial',
        'TELEFONE': 'Telefone Comercial',
        'RCAS': 'rcas',
        'PROMOTOR': 'PROMOTOR'
    },

    parseCSVToObjects: function(text, type) {
        const result = [];
        let headers = null;
        let currentVal = '';
        let currentLine = [];
        let inQuote = false;

        const pushLine = (lineValues) => {
            if (!headers) {
                headers = lineValues;
                return;
            }
            if (lineValues.length !== headers.length) return;

            const obj = {};
            for (let j = 0; j < headers.length; j++) {
                let header = headers[j].trim().toUpperCase();
                let val = lineValues[j];

                if (type === 'clients' && this.clientMap[header]) header = this.clientMap[header];
                if (type === 'orders' && ['VLVENDA', 'TOTPESOLIQ', 'VLBONIFIC', 'QTVENDA'].includes(header)) val = val === '' ? 0 : Number(val);

                if (['CODCLI', 'CODIGO_CLIENTE', 'Código'].includes(header)) {
                     val = window.Utils.normalizeKey(val);
                }

                if (val && typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
                    val = val.slice(1, -1).split(',').map(s => s.replace(/^"|"$/g, ''));
                }

                obj[header] = val;
            }
            result.push(obj);
        };

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (inQuote) {
                if (char === '"') {
                    if (i + 1 < text.length && text[i + 1] === '"') { currentVal += '"'; i++; }
                    else { inQuote = false; }
                } else { currentVal += char; }
            } else {
                if (char === '"') { inQuote = true; }
                else if (char === ',') { currentLine.push(currentVal); currentVal = ''; }
                else if (char === '\n' || char === '\r') {
                    if (char === '\r' && i + 1 < text.length && text[i+1] === '\n') i++;
                    currentLine.push(currentVal); currentVal = '';
                    pushLine(currentLine); currentLine = [];
                } else { currentVal += char; }
            }
        }
        if (currentLine.length > 0 || currentVal !== '') { currentLine.push(currentVal); pushLine(currentLine); }
        return result;
    },

    parseCSVToColumnar: function(text, type, existingColumnar = null) {
        const columnar = existingColumnar || { columns: [], values: {}, length: 0 };
        const hasExistingColumns = columnar.columns.length > 0;
        let headers = hasExistingColumns ? columnar.columns : null;
        let currentVal = '';
        let currentLine = [];
        let inQuote = false;
        let skipFirstLine = hasExistingColumns;
        let isFirstLine = true;

        const pushLine = (lineValues) => {
            if (lineValues.length === 0 || (lineValues.length === 1 && lineValues[0] === '')) return;

            if (isFirstLine) {
                isFirstLine = false;
                if (skipFirstLine) return;

                headers = lineValues.map(h => {
                    let header = h.trim().toUpperCase();
                    if (type === 'clients' && this.clientMap[header]) header = this.clientMap[header];
                    return header;
                });
                columnar.columns = headers;
                headers.forEach(h => { if (!columnar.values[h]) columnar.values[h] = []; });
                return;
            }

            if (headers && lineValues.length === headers.length) {
                for (let j = 0; j < headers.length; j++) {
                    const header = headers[j];
                    let val = lineValues[j];

                    if (type === 'sales' || type === 'history') {
                        if (['QTVENDA', 'VLVENDA', 'VLBONIFIC', 'TOTPESOLIQ', 'ESTOQUECX', 'ESTOQUEUNIT', 'QTVENDA_EMBALAGEM_MASTER'].includes(header)) {
                            val = val === '' ? 0 : Number(val);
                        }
                    }
                    if (['CODCLI', 'CODIGO_CLIENTE', 'Código'].includes(header)) {
                         val = window.Utils.normalizeKey(val);
                    }
                    if (type === 'stock' && header === 'STOCK_QTY') val = val === '' ? 0 : Number(val);
                    if (type === 'clients' && header === 'rcas') {
                        if (typeof val === 'string') {
                            val = val.trim();
                            if (val.startsWith('{')) {
                                val = val.slice(1, -1).split(',').map(s => s.replace(/^"|"$/g, ''));
                            } else if (val.startsWith('[')) {
                                try { val = JSON.parse(val); } catch(e) { val = [val]; }
                            } else if (val === '') {
                                val = [];
                            } else {
                                val = [val];
                            }
                        } else if (!val) val = [];
                        else if (!Array.isArray(val)) val = [val];
                    }

                    columnar.values[header].push(val);
                }
                columnar.length++;
            }
        };

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (inQuote) {
                if (char === '"') {
                    if (i + 1 < text.length && text[i + 1] === '"') { currentVal += '"'; i++; }
                    else { inQuote = false; }
                } else { currentVal += char; }
            } else {
                if (char === '"') { inQuote = true; }
                else if (char === ',') { currentLine.push(currentVal); currentVal = ''; }
                else if (char === '\n' || char === '\r') {
                    if (char === '\r' && i + 1 < text.length && text[i+1] === '\n') i++;
                    currentLine.push(currentVal); currentVal = '';
                    pushLine(currentLine); currentLine = [];
                } else { currentVal += char; }
            }
        }
        if (currentLine.length > 0 || currentVal !== '') { currentLine.push(currentVal); pushLine(currentLine); }
        return columnar;
    },

    fetchAll: async function(table, columns = null, type = null, format = 'object', pkCol = 'id', filterFunc = null) {
        const pageSize = 20000;
        let result = format === 'columnar' ? { columns: [], values: {}, length: 0 } : [];
        let hasMore = true;
        let lastId = null;
        let pageIndex = 0;

        return new Promise((resolve, reject) => {
            const processNextPage = async () => {
                const fetchWithRetry = async (attempt = 1) => {
                    try {
                        let query = window.supabaseClient.from(table).select(columns || '*').order(pkCol, { ascending: true }).limit(pageSize);
                        if (lastId !== null) query.gt(pkCol, lastId);
                        if (filterFunc) query = filterFunc(query);

                        const promise = columns ? query.csv() : query;
                        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000));
                        const response = await Promise.race([promise, timeoutPromise]);

                        if (response.error) throw response.error;
                        return response.data;
                    } catch (err) {
                        if (attempt < 4) {
                            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
                            return fetchWithRetry(attempt + 1);
                        }
                        throw err;
                    }
                };

                try {
                    const data = await fetchWithRetry();
                    let chunkLength = 0;
                    let newObjects = [];

                    if (columns) {
                        if (!data || data.length < 5) hasMore = false;
                        else {
                            if (format === 'columnar') {
                                const preLen = result.length;
                                result = this.parseCSVToColumnar(data, type, result);
                                chunkLength = result.length - preLen;
                                if (chunkLength === 0) hasMore = false;
                            } else {
                                newObjects = this.parseCSVToObjects(data, type);
                                chunkLength = newObjects.length;
                                result = result.concat(newObjects);
                                if (chunkLength === 0) hasMore = false;
                            }
                        }
                    } else {
                        if (!data || data.length === 0) hasMore = false;
                        else {
                            chunkLength = data.length;
                            result = result.concat(data);
                        }
                    }

                    if (chunkLength < pageSize) hasMore = false;

                    if (hasMore) {
                        if (columns) {
                            let lookupKey = pkCol.toUpperCase();
                            if (format === 'columnar') {
                                const colData = result.values[lookupKey];
                                if (colData && colData.length > 0) lastId = colData[colData.length - 1];
                                else hasMore = false;
                            } else {
                                const lastItem = result[result.length - 1];
                                if (lastItem && lastItem[lookupKey] !== undefined) lastId = lastItem[lookupKey];
                                else if (lastItem && lastItem[pkCol] !== undefined) lastId = lastItem[pkCol];
                                else hasMore = false;
                            }
                        } else {
                            const lastItem = result[result.length - 1];
                            lastId = lastItem[pkCol];
                        }
                    }

                    pageIndex++;
                    if (hasMore) processNextPage();
                    else resolve(result);

                } catch (err) {
                    console.error(`Fetch error ${table}:`, err);
                    resolve(result);
                }
            };
            processNextPage();
        });
    },

    load: async function(supabaseClient) {
        window.Auth.isAppReady = true;
        const loader = document.getElementById('loader');
        const loaderText = document.getElementById('loader-text');

        loader.classList.remove('hidden');
        loaderText.textContent = 'Verificando dados...';

        try {
            // Metadata
            let metadataRemote = null;
            let metadataRemoteRaw = null;
            try {
                const { data, error } = await supabaseClient.from('data_metadata').select('*');
                if (!error && data) {
                    metadataRemoteRaw = data;
                    metadataRemote = {};
                    data.forEach(item => metadataRemote[item.key] = item.value);
                }
            } catch (e) { console.warn(e); }

            let cachedData = await this.getFromCache('dashboardData');
            let useCache = false;
            let hierarchy = null;
            let isPromoter = false;

            // Fetch Hierarchy
            if (cachedData && cachedData.hierarchy && cachedData.hierarchy.length > 0) {
                hierarchy = cachedData.hierarchy;
            } else {
                const { data } = await supabaseClient.from('data_hierarchy').select('*');
                hierarchy = data;
            }

            const role = window.userRole;
            if (role && role !== 'adm' && hierarchy) {
                const norm = role.trim().toLowerCase();
                const entry = hierarchy.find(h => (h.cod_promotor || '').trim().toLowerCase() === norm);
                const isCoord = hierarchy.some(h => (h.cod_coord || '').trim().toLowerCase() === norm);
                const isCocoord = hierarchy.some(h => (h.cod_cocoord || '').trim().toLowerCase() === norm);

                if (entry && !isCoord && !isCocoord) {
                    isPromoter = true;
                }
            }

            if (isPromoter) useCache = false;

            // Co-Coord Email Resolution
            if (hierarchy && role) {
                const normRole = role.trim().toUpperCase();
                const myEntry = hierarchy.find(h => (h.cod_promotor || '').trim().toUpperCase() === normRole);
                if (myEntry && myEntry.cod_cocoord) {
                    window.userCoCoordCode = myEntry.cod_cocoord.trim();
                    const { data } = await supabaseClient.from('profiles').select('email').ilike('role', window.userCoCoordCode).limit(1).maybeSingle();
                    if(data) window.userCoCoordEmail = data.email;
                }
            }

            // Cache Check
            const tablesToFetch = new Set();
            if (!isPromoter && cachedData && metadataRemote) {
                const check = (name, hashKey, dataKey) => {
                    const r = metadataRemote[hashKey];
                    const l = cachedData.metadata ? cachedData.metadata.find(m => m.key === hashKey)?.value : null;
                    if (!r || r !== l || !cachedData[dataKey]) tablesToFetch.add(name);
                };
                check('data_detailed', 'hash_detailed', 'detailed');
                check('data_history', 'hash_history', 'history');
                check('data_clients', 'hash_clients', 'clients');
                check('data_orders', 'hash_orders', 'orders');
                check('data_stock', 'hash_stock', 'stock');
                check('data_active_products', 'hash_active_products', 'activeProds');
                check('data_product_details', 'hash_product_details', 'products');
                check('data_innovations', 'hash_innovations', 'innovations');
                check('data_hierarchy', 'hash_hierarchy', 'hierarchy');

                if (tablesToFetch.size === 0) useCache = true;
            } else if (!cachedData) {
                ['data_detailed', 'data_history', 'data_clients', 'data_orders', 'data_stock', 'data_active_products', 'data_product_details', 'data_innovations', 'data_hierarchy'].forEach(t => tablesToFetch.add(t));
            }

            loaderText.textContent = useCache ? 'Processando cache...' : 'Buscando dados...';

            const colsDetailed = 'id,pedido,codcli,nome,superv,codsupervisor,produto,descricao,fornecedor,observacaofor,codfor,codusur,qtvenda,vlvenda,vlbonific,totpesoliq,dtped,dtsaida,posicao,estoqueunit,tipovenda,filial,qtvenda_embalagem_master';
            const colsClients = 'id,codigo_cliente,rca1,rca2,rcas,cidade,nomecliente,bairro,razaosocial,fantasia,cnpj_cpf,endereco,numero,cep,telefone,email,ramo,ultimacompra,datacadastro,bloqueio,inscricaoestadual';
            const colsStock = 'id,product_code,filial,stock_qty';
            const colsOrders = 'id,pedido,codcli,cliente_nome,cidade,nome,superv,fornecedores_str,dtped,dtsaida,posicao,vlvenda,totpesoliq,filial,tipovenda,fornecedores_list,codfors_list';

            let detailed, history, clients, products, activeProds, stock, innovations, metadata, orders, clientPromoters, clientCoordinates;

            if (useCache) {
                detailed = cachedData.detailed;
                history = cachedData.history;
                clients = cachedData.clients;
                products = cachedData.products;
                activeProds = cachedData.activeProds;
                stock = cachedData.stock;
                innovations = cachedData.innovations;
                metadata = metadataRemoteRaw || cachedData.metadata;
                orders = cachedData.orders;
                hierarchy = cachedData.hierarchy;
                clientPromoters = cachedData.clientPromoters || [];
                clientCoordinates = cachedData.clientCoordinates || [];
            } else {
                let clientFilterCodes = null;
                if (isPromoter) {
                    const myPromoterData = await this.fetchAll('data_client_promoters', null, null, 'object', 'client_code', (q) => q.ilike('promoter_code', role.trim()));
                    if (myPromoterData) clientFilterCodes = myPromoterData.map(p => window.Utils.normalizeKey(p.client_code)).filter(c => c);
                    else clientFilterCodes = [];
                }

                const applyClientFilter = (q) => {
                    if (isPromoter && clientFilterCodes !== null) {
                        if (clientFilterCodes.length === 0) return q.eq('id', '00000000-0000-0000-0000-000000000000');
                        return q.in('codcli', clientFilterCodes);
                    }
                    return q;
                };
                const applyClientTableFilter = (q) => {
                     if (isPromoter && clientFilterCodes !== null) {
                        if (clientFilterCodes.length === 0) return q.eq('id', '00000000-0000-0000-0000-000000000000');
                        return q.in('codigo_cliente', clientFilterCodes);
                     }
                     return q;
                };

                const getOrFetch = (tableName, cols, type, format, pk, filter, cacheKey) => {
                    if (tablesToFetch.has(tableName) || isPromoter) {
                        return this.fetchAll(tableName, cols, type, format, pk, filter);
                    } else {
                        return Promise.resolve(cachedData[cacheKey]);
                    }
                };

                const results = await Promise.all([
                    getOrFetch('data_detailed', colsDetailed, 'sales', 'columnar', 'id', applyClientFilter, 'detailed'),
                    getOrFetch('data_history', colsDetailed, 'history', 'columnar', 'id', applyClientFilter, 'history'),
                    getOrFetch('data_clients', colsClients, 'clients', 'columnar', 'id', applyClientTableFilter, 'clients'),
                    getOrFetch('data_product_details', null, null, 'object', 'code', null, 'products'),
                    getOrFetch('data_active_products', null, null, 'object', 'code', null, 'activeProds'),
                    getOrFetch('data_stock', colsStock, 'stock', 'columnar', 'id', null, 'stock'),
                    getOrFetch('data_innovations', null, null, 'object', 'id', null, 'innovations'),
                    this.fetchAll('data_metadata', null, null, 'object', 'key'),
                    getOrFetch('data_orders', colsOrders, 'orders', 'object', 'id', applyClientFilter, 'orders'),
                    this.fetchAll('data_client_coordinates', null, null, 'object', 'client_code'),
                    getOrFetch('data_hierarchy', null, null, 'object', 'id', null, 'hierarchy'),
                    this.fetchAll('data_client_promoters', null, null, 'object', 'client_code')
                ]);

                [detailed, history, clients, products, activeProds, stock, innovations, metadata, orders, clientCoordinates, hierarchy, clientPromoters] = results;

                if (!isPromoter) {
                    const dataToCache = { detailed, history, clients, products, activeProds, stock, innovations, metadata, orders, clientCoordinates, hierarchy, clientPromoters };
                    this.saveToCache('dashboardData', dataToCache);
                }
            }

            loaderText.textContent = 'Processando...';

            // Populate Global State
            window.AppState.allSalesData = (detailed && detailed.columns) ? new window.Utils.ColumnarDataset(detailed) : detailed;
            window.AppState.allHistoryData = (history && history.columns) ? new window.Utils.ColumnarDataset(history) : history;
            window.AppState.allClientsData = (clients && clients.columns) ? new window.Utils.ColumnarDataset(clients) : clients;
            window.AppState.aggregatedOrders = orders;
            window.AppState.allProductsData = products; // Available for Products View

            // Map Stock
            if (stock && stock.values) {
                const pCodes = stock.values['PRODUCT_CODE'];
                const filials = stock.values['FILIAL'];
                const qtys = stock.values['STOCK_QTY'];
                for(let i = 0; i < stock.length; i++) {
                    const c = pCodes[i];
                    if (filials[i] === '05') window.AppState.stockData05.set(c, qtys[i]);
                    if (filials[i] === '08') window.AppState.stockData08.set(c, qtys[i]);
                }
            }

            window.AppState.innovationsMonthData = innovations;
            window.AppState.clientPromoters = clientPromoters || [];
            window.AppState.clientCoordinatesMap.clear();

            if (clientCoordinates) {
                clientCoordinates.forEach(c => {
                    const code = window.Utils.normalizeKey(c.client_code);
                    window.AppState.clientCoordinatesMap.set(code, {
                        lat: parseFloat(c.lat),
                        lng: parseFloat(c.lng),
                        address: c.address
                    });
                });
            }

            // Expose for Legacy Compatibility (if anything still references it directly)
            window.embeddedData = {
                detailed, history, clients, byOrder: orders,
                stockMap05: Object.fromEntries(window.AppState.stockData05),
                stockMap08: Object.fromEntries(window.AppState.stockData08),
                products, activeProds, innovations, metadata, hierarchy, clientPromoters, clientCoordinates,
                isColumnar: true
            };

            this.isDataLoaded = true;

            // Trigger App Logic
            this.loadAppModules();

        } catch (e) {
            console.error(e);
            loaderText.textContent = 'Erro: ' + e.message;
        }
    },

    loadAppModules: function() {
        // Dynamic loading of the split modules
        // Order matters: Charts -> Filters -> Others -> App (Main)
        const scripts = [
            'js/app/charts.js',
            'js/app/filters.js',
            'js/app/map.js',
            'js/app/visitas.js',
            'js/app/goals.js',
            'js/app/wallet.js',
            'js/app/comparison.js',
            'js/app/city.js',
            'js/app/coverage.js',
            'js/app/mix.js',
            'js/app/innovations.js',
            'js/app/clients.js',
            'js/app/products.js',
            'js/app/history.js',
            'js/app/dashboard.js',
            'js/app/app.js' // The main controller
        ];

        let loadedCount = 0;
        const loadNext = () => {
            if (loadedCount >= scripts.length) {
                document.getElementById('loader').classList.add('hidden');
                document.getElementById('content-wrapper').classList.remove('hidden');
                const topNav = document.getElementById('top-navbar');
                if (topNav) topNav.classList.remove('hidden');

                // Initialize App
                if (window.App && window.App.init) {
                    window.App.init();
                }
                return;
            }

            const src = scripts[loadedCount];
            const s = document.createElement('script');
            s.src = `${src}?v=${Date.now()}`;
            s.onload = () => {
                loadedCount++;
                loadNext();
            };
            document.body.appendChild(s);
        };

        loadNext();
    }
};
