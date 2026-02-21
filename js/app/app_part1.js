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
        function exportToExcel(sheets, fileName) {
            if (typeof XLSX === 'undefined') {
                alert('Biblioteca XLSX não carregada.');
                return;
            }
            const wb = XLSX.utils.book_new();
            let hasData = false;

            for (const [name, data] of Object.entries(sheets)) {
                if (data && data.length > 0) {
                    // Sanitize data for Excel if needed (e.g. remove internal keys)
                    const cleanData = data.map(row => {
                        const newRow = {};
                        Object.keys(row).forEach(k => {
                            if (k !== 'raw' && k !== 'meta' && typeof row[k] !== 'function') {
                                newRow[k] = row[k];
                            }
                        });
                        return newRow;
                    });
                    const ws = XLSX.utils.json_to_sheet(cleanData);
                    XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31)); // Sheet names max 31 chars
                    hasData = true;
                }
            }

            if (!hasData) {
                alert('Sem dados para exportar.');
                return;
            }

            XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
        }

        function setupFab(containerId, pdfHandler, excelHandler) {
            const container = document.getElementById(containerId);
            if (!container) return;
            const mainBtn = container.querySelector('.fab-btn');
            const pdfBtn = container.querySelector('.fab-item[data-action="pdf"]');
            const excelBtn = container.querySelector('.fab-item[data-action="excel"]');

            if (mainBtn) {
                // Remove old listeners just in case
                const newMain = mainBtn.cloneNode(true);
                mainBtn.parentNode.replaceChild(newMain, mainBtn);

                newMain.addEventListener('click', (e) => {
                    e.stopPropagation();
                    container.classList.toggle('active');
                });
            }

            // Global click to close
            document.addEventListener('click', (e) => {
                if (!container.contains(e.target)) {
                    container.classList.remove('active');
                }
            });

            if (pdfBtn && pdfHandler) {
                const newPdf = pdfBtn.cloneNode(true);
                pdfBtn.parentNode.replaceChild(newPdf, pdfBtn);
                newPdf.addEventListener('click', (e) => {
                    e.stopPropagation();
                    container.classList.remove('active');
                    pdfHandler();
                });
            }

            if (excelBtn && excelHandler) {
                const newExcel = excelBtn.cloneNode(true);
                excelBtn.parentNode.replaceChild(newExcel, excelBtn);
                newExcel.addEventListener('click', (e) => {
                    e.stopPropagation();
                    container.classList.remove('active');
                    excelHandler();
                });
            }
        }

        const QUARTERLY_DIVISOR = 3;

        // Optimized lastSaleDate calculation to avoid mapping huge array
        let maxDateTs = 0;
        for(let i=0; i<allSalesData.length; i++) {
            const s = allSalesData instanceof ColumnarDataset ? allSalesData.get(i) : allSalesData[i];
            let ts = 0;
            if (typeof s.DTPED === 'number' && s.DTPED > 1000000) {
                 ts = s.DTPED;
            } else {
                 const d = parseDate(s.DTPED);
                 if(d && !isNaN(d)) ts = d.getTime();
            }

            if(ts > maxDateTs) maxDateTs = ts;
        }
        if (!lastSaleDate) {
            lastSaleDate = maxDateTs > 0 ? new Date(maxDateTs) : new Date();
        }
        lastSaleDate.setUTCHours(0,0,0,0);
        let maxWorkingDaysStock = 0;
        let sortedWorkingDays = [];
        let customWorkingDaysStock = 0;

        // --- Geolocation Logic (Leaflet + Heatmap + Nominatim) ---
        let leafletMap = null;
        let heatLayer = null;
        let clientMarkersLayer = null;
        let clientCoordinatesMap = new Map(); // Map<ClientCode, {lat, lng, address}>
        let nominatimQueue = [];
        let isProcessingQueue = false;
        let currentFilteredClients = [];
        let currentFilteredSalesMap = new Map();
        let currentClientMixStatus = new Map(); // Map<ClientCode, {elma: bool, foods: bool}>
        let areMarkersGenerated = false;
        let cityMapJobId = 0;
        let isCityMapCalculating = false;

        // Load cached coordinates from embeddedData
        if (embeddedData.clientCoordinates) {
            // Robust check: Handle both Array and Object (if keys are used)
            const coords = Array.isArray(embeddedData.clientCoordinates) ? embeddedData.clientCoordinates : Object.values(embeddedData.clientCoordinates);
            coords.forEach(c => {
                let code = String(c.client_code).trim();
                // Normalize keys (remove leading zeros)
                if (/^\d+$/.test(code)) {
                    code = String(parseInt(code, 10));
                }

                clientCoordinatesMap.set(code, {
                    lat: parseFloat(c.lat),
                    lng: parseFloat(c.lng),
                    address: c.address
                });
            });
        }

        function initLeafletMap() {
            if (leafletMap) return;
            const mapContainer = document.getElementById('leaflet-map');
            if (!mapContainer) return;

            // Default center (Bahia/Salvador approx)
            const defaultCenter = [-12.9714, -38.5014];

            leafletMap = L.map(mapContainer).setView(defaultCenter, 7);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(leafletMap);

            // Initialize empty heat layer with increased transparency
            heatLayer = L.heatLayer([], {
                radius: 15,
                blur: 15,
                maxZoom: 10,
                minOpacity: 0.05, // More transparent
                max: 20.0, // Increased max to prevent saturation and allow transparency
                gradient: {
                    0.2: 'rgba(0, 0, 255, 0.35)',
                    0.5: 'rgba(0, 255, 0, 0.35)',
                    1.0: 'rgba(255, 0, 0, 0.35)'
                }
            }).addTo(leafletMap);

            // Initialize Markers Layer (Hidden by default, shown on zoom)
            clientMarkersLayer = L.layerGroup();

            leafletMap.on('zoomend', () => {
                const zoom = leafletMap.getZoom();

                // Dynamic Heatmap Settings based on Zoom
                if (heatLayer) {
                    if (zoom >= 14) {
                        // High Zoom: Hide Heatmap completely, show Markers
                        if (leafletMap.hasLayer(heatLayer)) {
                            leafletMap.removeLayer(heatLayer);
                        }
                    } else {
                        // Low/Mid Zoom: Show Heatmap, Hide Markers (handled by updateMarkersVisibility)
                        if (!leafletMap.hasLayer(heatLayer)) {
                            leafletMap.addLayer(heatLayer);
                        }

                        let newOptions = {};
                        if (zoom >= 12) {
                            // Transition Zoom
                            newOptions = {
                                radius: 12,
                                blur: 12,
                                max: 5.0,
                                minOpacity: 0.2
                            };
                        } else {
                            // Low Zoom: Heatmap clouds (Current settings for density)
                            newOptions = {
                                radius: 15,
                                blur: 15,
                                max: 20.0, // High max to prevent saturation in clusters
                                minOpacity: 0.05
                            };
                        }
                        heatLayer.setOptions(newOptions);
                    }
                }

                updateMarkersVisibility();
            });
        }

        async function saveCoordinateToSupabase(clientCode, lat, lng, address) {
            if (window.userRole !== 'adm') return;

            try {
                const { error } = await window.supabaseClient
                    .from('data_client_coordinates')
                    .upsert({
                        client_code: String(clientCode),
                        lat: lat,
                        lng: lng,
                        address: address
                    });

                if (error) console.error("Error saving coordinate:", error);
                else {
                    clientCoordinatesMap.set(String(clientCode), { lat, lng, address });
                }
            } catch (e) {
                console.error("Error saving coordinate:", e);
            }
        }

        function buildAddress(client, level) {
            // Priority: Key 'Endereço Comercial' (from init.js map) > lowercase > UPPERCASE
            const endereco = client['Endereço Comercial'] || client.endereco || client.ENDERECO || '';
            const numero = client.numero || client.NUMERO || '';
            const bairro = client.bairro || client.BAIRRO || '';
            const cidade = client.cidade || client.CIDADE || '';
            const nome = client.nomeCliente || client.nome || '';

            const parts = [];
            const isValid = (s) => s && s !== 'N/A' && s !== '0' && String(s).toUpperCase() !== 'S/N' && String(s).trim() !== '';

            // Level 0 (POI - Business Name): Name + Bairro + City
            if (level === 0) {
                if(isValid(nome)) parts.push(nome);
                if(isValid(bairro)) parts.push(bairro);
                if(isValid(cidade)) parts.push(cidade);
            }
            // Level 1 (Address Full - Street + Number): Street + Number + Bairro + City
            else if (level === 1) {
                if(isValid(endereco)) parts.push(endereco);
                if(isValid(numero)) parts.push(numero);
                if(isValid(bairro)) parts.push(bairro);
                if(isValid(cidade)) parts.push(cidade);
            }
            // Level 2 (Street): Street + Bairro + City
            else if (level === 2) {
                if(isValid(endereco)) parts.push(endereco);
                if(isValid(bairro)) parts.push(bairro);
                if(isValid(cidade)) parts.push(cidade);
            }
            // Level 3 (Neighborhood): Bairro + City
            else if (level === 3) {
                if(isValid(bairro)) parts.push(bairro);
                if(isValid(cidade)) parts.push(cidade);
            }
            // Level 4 (City): City only
            else if (level === 4) {
                if(isValid(cidade)) parts.push(cidade);
            }

            if (parts.length === 0) return null;

            // Append Context if not CEP only - Enforce Bahia
            parts.push("Bahia");
            parts.push("Brasil");
            return parts.join(', ');
        }

        // Rate-limited Queue Processor for Nominatim (1 req/1.2s)
        async function processNominatimQueue() {
            if (isProcessingQueue || nominatimQueue.length === 0) return;
            isProcessingQueue = true;

            const processNext = async () => {
                if (nominatimQueue.length === 0) {
                    isProcessingQueue = false;
                    console.log("[GeoSync] Fila de download finalizada.");
                    return;
                }

                const item = nominatimQueue.shift();
                const client = item.client;
                // Determine level (default 0)
                let level = item.level !== undefined ? item.level : 0;

                // Construct address or use legacy
                let address = item.address;
                if (!address) {
                    address = buildAddress(client, level);

                    // If address is null (e.g. invalid level data), auto-advance
                    if (!address && level < 4) {
                        nominatimQueue.unshift({ client, level: level + 1 });
                        setTimeout(processNext, 0);
                        return;
                    }
                }

                if (!address) {
                     console.log(`[GeoSync] Endereço inválido para ${client.nomeCliente} (L${level}), falha definitiva.`);
                     setTimeout(processNext, 100);
                     return;
                }

                console.log(`[GeoSync] Baixando (L${level}): ${client.nomeCliente} [${address}] (${nominatimQueue.length} restantes)...`);

                try {
                    const result = await geocodeAddressNominatim(address);
                    if (result) {
                        console.log(`[GeoSync] Sucesso: ${client.nomeCliente} -> Salvo.`);
                        const codCli = String(client['Código'] || client['codigo_cliente']);
                        await saveCoordinateToSupabase(codCli, result.lat, result.lng, result.formatted_address);

                        const cityMapContainer = document.getElementById('city-map-container');
                        if (heatLayer && cityMapContainer && !cityMapContainer.classList.contains('hidden')) {
                            // Fix: Check if layer is active on map to avoid "Cannot read properties of null (reading '_animating')"
                            if (heatLayer._map) {
                                heatLayer.addLatLng([result.lat, result.lng, 1]);
                            } else {
                                // If layer is hidden (e.g. high zoom), just update data source without redraw
                                heatLayer._latlngs.push([result.lat, result.lng, 1]);
                            }
                        }
                    } else {
                        // Retry Logic: If failed, try next level of fallback
                        if (level < 4) {
                             console.log(`[GeoSync] Falha L${level} para ${client.nomeCliente}. Tentando nível ${level+1}...`);
                             // Push back to front with incremented level
                             nominatimQueue.unshift({ client, level: level + 1 });
                        } else {
                             console.log(`[GeoSync] Falha Definitiva (Não encontrado): ${client.nomeCliente}`);
                        }
                    }
                } catch (e) {
                    console.error(`[GeoSync] Erro API: ${client.nomeCliente}`, e);
                }

                // Respect Rate Limit: 1200ms
                setTimeout(processNext, 1200);
            };

            processNext();
        }

        async function syncGlobalCoordinates() {
            if (window.userRole !== 'adm') {
                console.log("[GeoSync] Sincronização em segundo plano ignorada (Requer permissão 'adm').");
                return;
            }

            console.log("[GeoSync] Iniciando verificação de coordenadas em segundo plano...");

            const activeClientsList = getActiveClientsData();
            const activeClientCodes = new Set();
            for (const c of activeClientsList) {
                activeClientCodes.add(String(c['Código'] || c['codigo_cliente']));
            }

            // 1. Cleanup Orphans
            const orphanedCodes = [];
            for (const [code, coord] of clientCoordinatesMap) {
                if (!activeClientCodes.has(code)) {
                    orphanedCodes.push(code);
                }
            }

            if (orphanedCodes.length > 0) {
                console.log(`Cleaning up ${orphanedCodes.length} orphaned coordinates...`);
                const { error } = await window.supabaseClient
                    .from('data_client_coordinates')
                    .delete()
                    .in('client_code', orphanedCodes);

                if (!error) {
                    orphanedCodes.forEach(c => clientCoordinatesMap.delete(c));
                }
            }

            // 2. Queue All Missing
            let queuedCount = 0;

            // Optimization: Use Set for O(1) lookup
            const queuedClientCodes = new Set();
            nominatimQueue.forEach(item => {
                queuedClientCodes.add(String(item.client['Código'] || item.client['codigo_cliente']));
            });

            activeClientsList.forEach(client => {
                const code = String(client['Código'] || client['codigo_cliente']);
                if (clientCoordinatesMap.has(code)) return;

                // Validate minimal info (City)
                const cidade = client.cidade || client.CIDADE || '';
                const cep = client.cep || client.CEP || '';

                // CEP Validation: Must be Bahia (40xxx to 48xxx)
                const cleanCep = cep.replace(/\D/g, '');
                const cepVal = parseInt(cleanCep);
                const isBahia = !isNaN(cepVal) && cepVal >= 40000000 && cepVal <= 48999999;

                if (!isBahia) {
                    // console.log(`[GeoSync] Ignorado: CEP fora da Bahia (${cep}) - ${client.nomeCliente}`);
                    return;
                }

                if (cidade && cidade !== 'N/A') {
                    // Check for duplicates
                    if (!queuedClientCodes.has(code)) {
                        nominatimQueue.push({ client, level: 0 });
                        queuedClientCodes.add(code);
                        queuedCount++;
                    }
                }
            });

            if (queuedCount > 0) {
                console.log(`[GeoSync] Identificados ${queuedCount} clientes sem coordenadas. Iniciando download...`);
                processNominatimQueue();
            } else {
                console.log("[GeoSync] Todos os clientes ativos já possuem coordenadas.");
            }
        }

        function renderMetaRealizadoPosChart(data) {
            const container = document.getElementById('metaRealizadoPosChartContainer');
            if (!container) return;

            let canvas = container.querySelector('canvas');
            if (!canvas) {
                canvas = document.createElement('canvas');
                container.appendChild(canvas);
            }

            const chartId = 'metaRealizadoPosChartInstance';

            // Aggregate Totals for Positivação
            const totalGoal = data.reduce((sum, d) => sum + (d.posGoal || 0), 0);
            const totalReal = data.reduce((sum, d) => sum + (d.posRealized || 0), 0);

            if (charts[chartId]) {
                charts[chartId].data.datasets[0].data = [totalGoal];
                charts[chartId].data.datasets[1].data = [totalReal];
                charts[chartId].update('none');
            } else {
                charts[chartId] = new Chart(canvas, {
                    type: 'bar',
                    data: {
                        labels: ['Positivação'],
                        datasets: [
                            {
                                label: 'Meta',
                                data: [totalGoal],
                                backgroundColor: '#a855f7', // Purple
                                barPercentage: 0.6,
                                categoryPercentage: 0.8
                            },
                            {
                                label: 'Realizado',
                                data: [totalReal],
                                backgroundColor: '#22c55e', // Green
                                barPercentage: 0.6,
                                categoryPercentage: 0.8
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: {
                            padding: {
                                top: 50
                            }
                        },
                        plugins: {
                            legend: { position: 'top', labels: { color: '#cbd5e1' } },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        return `${context.dataset.label}: ${context.parsed.y} Clientes`;
                                    }
                                }
                            },
                            datalabels: {
                                color: '#fff',
                                anchor: 'end',
                                align: 'top',
                                formatter: (value) => value,
                                font: { weight: 'bold' }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grace: '10%',
                                grid: { color: '#334155' },
                                ticks: { color: '#94a3b8' }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { color: '#94a3b8' }
                            }
                        }
                    }
                });
            }

        }

        async function geocodeAddressNominatim(address) {
            if (!address) return null;
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;

            try {
                const response = await fetch(url, {
                    headers: { 'User-Agent': 'PrimeDashboardApp/1.0' }
                });
                if (!response.ok) return null;
                const data = await response.json();
                if (data && data.length > 0) {
                    return {
                        lat: parseFloat(data[0].lat),
                        lng: parseFloat(data[0].lon),
                        formatted_address: data[0].display_name
                    };
                }
            } catch (e) {
                console.warn("Nominatim fetch failed:", e);
            }
            return null;
        }

        async function updateCityMap() {
            const cityMapContainer = document.getElementById('city-map-container');
            if (!leafletMap || (cityMapContainer && cityMapContainer.classList.contains('hidden'))) return;

            const { clients, sales } = getCityFilteredData();
            if (!clients || clients.length === 0) return;

            const jobId = ++cityMapJobId;
            isCityMapCalculating = true;

            // Cache for Async Marker Generation
            currentFilteredClients = clients;
            areMarkersGenerated = false;
            if (clientMarkersLayer) clientMarkersLayer.clearLayers();

            const heatData = [];
            const missingCoordsClients = [];
            const validBounds = [];

            // Heatmap Loop (Sync - Fast) - Update UI immediately
            clients.forEach(client => {
                const codCli = String(client['Código'] || client['codigo_cliente']);
                const coords = clientCoordinatesMap.get(codCli);

                if (coords) {
                    heatData.push([coords.lat, coords.lng, 1.0]);
                    validBounds.push([coords.lat, coords.lng]);
                } else {
                    missingCoordsClients.push(client);
                }
            });

            // Update Heatmap
            if (heatLayer) {
                heatLayer.setLatLngs(heatData);
            }

            // Fit Bounds
            if (validBounds.length > 0) {
                leafletMap.fitBounds(validBounds);
            }

            // Sales Aggregation (Async Chunked)
            const tempSalesMap = new Map();
            const tempMixStatus = new Map();

            if (sales) {
                runAsyncChunked(sales, (s) => {
                    const cod = s.CODCLI;
                    const val = Number(s.VLVENDA) || 0;
                    tempSalesMap.set(cod, (tempSalesMap.get(cod) || 0) + val);

                    // Mix Logic
                    let mix = tempMixStatus.get(cod);
                    if (!mix) {
                        mix = { elma: false, foods: false };
                        tempMixStatus.set(cod, mix);
                    }

                    const codFor = String(s.CODFOR);
                    // Elma: 707, 708, 752
                    if (window.isElma(codFor)) {
                        mix.elma = true;
                    }
                    // Foods: 1119
                    else if (window.isFoods(codFor)) {
                        mix.foods = true;
                    }
                }, () => {
                    // On Complete
                    if (jobId !== cityMapJobId) return; // Cancelled by newer request

                    currentFilteredSalesMap = tempSalesMap;
                    currentClientMixStatus = tempMixStatus;
                    areMarkersGenerated = false;
                    isCityMapCalculating = false;

                    // Trigger Marker Logic (Now that data is ready)
                    updateMarkersVisibility();

                }, () => jobId !== cityMapJobId); // isCancelled check
            } else {
                // No sales, clear maps
                if (jobId === cityMapJobId) {
                    currentFilteredSalesMap = new Map();
                    currentClientMixStatus = new Map();
                    areMarkersGenerated = false;
                    isCityMapCalculating = false;
                    updateMarkersVisibility();
                }
            }
        }

        function updateMarkersVisibility() {
            if (!leafletMap || !clientMarkersLayer) return;
            const zoom = leafletMap.getZoom();

            if (zoom >= 14) {
                if (!areMarkersGenerated) {
                    generateMarkersAsync();
                } else {
                    if (!leafletMap.hasLayer(clientMarkersLayer)) leafletMap.addLayer(clientMarkersLayer);
                }
            } else {
                if (leafletMap.hasLayer(clientMarkersLayer)) leafletMap.removeLayer(clientMarkersLayer);
            }
        }

        function generateMarkersAsync() {
            if (areMarkersGenerated || isCityMapCalculating) return;

            // Use local reference to avoid race conditions if filter changes mid-process
            const clientsToProcess = currentFilteredClients;

            runAsyncChunked(clientsToProcess, (client) => {
                const codCli = String(client['Código'] || client['codigo_cliente']);
                const coords = clientCoordinatesMap.get(codCli);

                if (coords) {
                    const val = currentFilteredSalesMap.get(codCli) || 0;
                    const formattedVal = val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                    const rcaCode = client.rca1 || 'N/A';
                    const rcaName = (optimizedData.rcaNameByCode && optimizedData.rcaNameByCode.get(rcaCode)) || rcaCode;

                    // Color Logic
                    // Default: Red (No purchase or <= 0)
                    let markerColor = '#ef4444'; // red-500
                    let statusText = 'Não comprou';

                    if (val > 0) {
                        const mix = currentClientMixStatus.get(codCli) || { elma: false, foods: false };
                        if (mix.elma && mix.foods) {
                            markerColor = '#3b82f6'; // blue-500 (Elma & Foods)
                            statusText = 'Comprou Elma e Foods';
                        } else if (mix.elma) {
                            markerColor = '#22c55e'; // green-500 (Only Elma)
                            statusText = 'Apenas Elma';
                        } else if (mix.foods) {
                            markerColor = '#eab308'; // yellow-500 (Only Foods)
                            statusText = 'Apenas Foods';
                        } else {
                            markerColor = '#9ca3af'; // gray-400 (Other/Unknown)
                            statusText = 'Outros';
                        }
                    }

                    const tooltipContent = `
                        <div class="text-xs">
                            <b>${codCli} - ${client.nomeCliente || 'Cliente'}</b><br>
                            <span class="text-blue-500 font-semibold">RCA: ${rcaName}</span><br>
                            <span class="text-green-600 font-bold">Venda: ${formattedVal}</span><br>
                            <span style="color: ${markerColor}; font-weight: bold;">Status: ${statusText}</span><br>
                            ${client.bairro || ''}, ${client.cidade || ''}
                        </div>
                    `;

                    // Canvas Circle Marker (Performance Optimization)
                    const marker = L.circleMarker([coords.lat, coords.lng], {
                        radius: 6,
                        fillColor: markerColor,
                        color: "#ffffff",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    });

                    marker.bindTooltip(tooltipContent, { direction: 'top', offset: [0, 0] });
                    clientMarkersLayer.addLayer(marker);
                }
            }, () => {
                areMarkersGenerated = true;
                updateMarkersVisibility();
            });
        }

        let sellerDetailsMap = new Map();

        // --- HIERARCHY FILTER SYSTEM ---
        const hierarchyState = {}; // Map<viewPrefix, { coords: Set, cocoords: Set, promotors: Set }>

        function getHierarchyFilteredClients(viewPrefix, sourceClients = allClientsData) {
            const state = hierarchyState[viewPrefix];
            if (!state) return sourceClients;

            const { coords, cocoords, promotors } = state;

            let effectiveCoords = new Set(coords);
            let effectiveCoCoords = new Set(cocoords);
            let effectivePromotors = new Set(promotors);

            // Apply User Context Constraints implicitly?
            if (userHierarchyContext.role === 'coord') effectiveCoords.add(userHierarchyContext.coord);
            if (userHierarchyContext.role === 'cocoord') {
                effectiveCoords.add(userHierarchyContext.coord);
                effectiveCoCoords.add(userHierarchyContext.cocoord);
            }
            if (userHierarchyContext.role === 'promotor') {
                effectiveCoords.add(userHierarchyContext.coord);
                effectiveCoCoords.add(userHierarchyContext.cocoord);
                effectivePromotors.add(userHierarchyContext.promotor);
            }

            const isColumnar = sourceClients instanceof ColumnarDataset;
            const result = [];
            const len = sourceClients.length;

            if (viewPrefix === 'main') {
            }

            let missingNodeCount = 0;

            for(let i=0; i<len; i++) {
                const client = isColumnar ? sourceClients.get(i) : sourceClients[i];
                const codCli = normalizeKey(client['Código'] || client['codigo_cliente']);
                const node = optimizedData.clientHierarchyMap.get(codCli);

                if (!node) {
                    missingNodeCount++;
                    // FIX: Allow Orphans for Admins if no filters are active
                    if (userHierarchyContext.role === 'adm') {
                        const hasFilters = effectiveCoords.size > 0 || effectiveCoCoords.size > 0 || effectivePromotors.size > 0;
                        if (!hasFilters) {
                            result.push(client);
                        }
                    }
                    continue;
                }

                // Check Coord
                if (effectiveCoords.size > 0 && !effectiveCoords.has(node.coord.code)) continue;
                // Check CoCoord
                if (effectiveCoCoords.size > 0 && !effectiveCoCoords.has(node.cocoord.code)) continue;
                // Check Promotor
                if (effectivePromotors.size > 0 && !effectivePromotors.has(node.promotor.code)) continue;

                result.push(client);
            }

            if (viewPrefix === 'main') {
            }
            return result;
        }

        function updateFilterButtonText(element, selectedSet, defaultLabel) {
            if (!element) return;
            if (selectedSet.size === 0) {
                element.textContent = defaultLabel;
            } else if (selectedSet.size === 1) {
                // Find the label for the single selected value?
                // We don't have the label map easily accessible here without passing it.
                // For simplicity, showing count or generic text.
                // Or if we want the label, we'd need to lookup in optimizedData maps.
                // Let's iterate the set to get the value.
                const val = selectedSet.values().next().value;
                // Try to resolve name
                let name = val;
                if (optimizedData.coordMap.has(val)) name = optimizedData.coordMap.get(val);
                else if (optimizedData.cocoordMap.has(val)) name = optimizedData.cocoordMap.get(val);
                else if (optimizedData.promotorMap.has(val)) name = optimizedData.promotorMap.get(val);

                element.textContent = name;
            } else {
                element.textContent = `${selectedSet.size} selecionados`;
            }
        }

        function updateHierarchyDropdown(viewPrefix, level) {
            const state = hierarchyState[viewPrefix];
            const els = {
                coord: { dd: document.getElementById(`${viewPrefix}-coord-filter-dropdown`), text: document.getElementById(`${viewPrefix}-coord-filter-text`) },
                cocoord: { dd: document.getElementById(`${viewPrefix}-cocoord-filter-dropdown`), text: document.getElementById(`${viewPrefix}-cocoord-filter-text`) },
                promotor: { dd: document.getElementById(`${viewPrefix}-promotor-filter-dropdown`), text: document.getElementById(`${viewPrefix}-promotor-filter-text`) }
            };

            const target = els[level];
            if (!target.dd) return;

            let options = [];
            // Determine available options based on parent selection
            if (level === 'coord') {
                // Show all Coords (or restricted)
                if (userHierarchyContext.role === 'adm') {
                    options = Array.from(optimizedData.coordMap.entries()).map(([k, v]) => ({ value: k, label: v }));
                } else {
                    // Restricted: Only show own
                    if (userHierarchyContext.coord) {
                        options = [{ value: userHierarchyContext.coord, label: optimizedData.coordMap.get(userHierarchyContext.coord) || userHierarchyContext.coord }];
                    }
                }
            } else if (level === 'cocoord') {
                // Show CoCoords belonging to selected Coords
                let parentCoords = state.coords;
                // If no parent selected, and ADM, show ALL. If restricted, show allowed.
                // If restricted, state.coords might be empty initially, but user context implies restriction.

                let allowedCoords = parentCoords;
                if (allowedCoords.size === 0) {
                    if (userHierarchyContext.role === 'adm') {
                        // All coords
                        allowedCoords = new Set(optimizedData.coordMap.keys());
                    } else if (userHierarchyContext.coord) {
                        allowedCoords = new Set([userHierarchyContext.coord]);
                    }
                }

                const validCodes = new Set();
                allowedCoords.forEach(c => {
                    const children = optimizedData.cocoordsByCoord.get(c);
                    if(children) children.forEach(child => validCodes.add(child));
                });

                // Apply User Context Restriction for CoCoord level
                if (userHierarchyContext.role === 'cocoord' || userHierarchyContext.role === 'promotor') {
                    // Restrict to own cocoord
                    if (userHierarchyContext.cocoord && validCodes.has(userHierarchyContext.cocoord)) {
                        validCodes.clear();
                        validCodes.add(userHierarchyContext.cocoord);
                    } else {
                        validCodes.clear(); // Should not happen if data consistent
                    }
                }

                options = Array.from(validCodes).map(c => ({ value: c, label: optimizedData.cocoordMap.get(c) || c }));
            } else if (level === 'promotor') {
                // Show Promotors belonging to selected CoCoords
                let parentCoCoords = state.cocoords;

                let allowedCoCoords = parentCoCoords;
                if (allowedCoCoords.size === 0) {
                    // Need to resolve relevant CoCoords from relevant Coords
                    let relevantCoords = state.coords;
                    if (relevantCoords.size === 0) {
                         if (userHierarchyContext.role === 'adm') relevantCoords = new Set(optimizedData.coordMap.keys());
                         else if (userHierarchyContext.coord) relevantCoords = new Set([userHierarchyContext.coord]);
                    }

                    const validCoCoords = new Set();
                    relevantCoords.forEach(c => {
                        const children = optimizedData.cocoordsByCoord.get(c);
                        if(children) children.forEach(child => validCoCoords.add(child));
                    });

                    // Filter by User Context
                    if (userHierarchyContext.role === 'cocoord' || userHierarchyContext.role === 'promotor') {
                         if (userHierarchyContext.cocoord) {
                             // Only keep own
                             if (validCoCoords.has(userHierarchyContext.cocoord)) {
                                 validCoCoords.clear();
                                 validCoCoords.add(userHierarchyContext.cocoord);
                             }
                         }
                    }
                    allowedCoCoords = validCoCoords;
                }

                const validCodes = new Set();
                allowedCoCoords.forEach(c => {
                    const children = optimizedData.promotorsByCocoord.get(c);
                    if(children) children.forEach(child => validCodes.add(child));
                });

                // Apply User Context Restriction for Promotor level
                if (userHierarchyContext.role === 'promotor') {
                    if (userHierarchyContext.promotor && validCodes.has(userHierarchyContext.promotor)) {
                        validCodes.clear();
                        validCodes.add(userHierarchyContext.promotor);
                    }
                }

                options = Array.from(validCodes).map(c => ({ value: c, label: optimizedData.promotorMap.get(c) || c }));
            }

            // Sort
            if (options) options.sort((a, b) => a.label.localeCompare(b.label));
            else options = [];

            // Render
            let html = '';
            const selectedSet = state[level + 's']; // coords, cocoords, promotors
            options.forEach(opt => {
                const checked = selectedSet.has(opt.value) ? 'checked' : '';
                html += `
                    <label class="flex items-center justify-between p-2 hover:bg-slate-700 rounded cursor-pointer">
                        <span class="text-xs text-slate-300 truncate mr-2">${opt.label}</span>
                        <input type="checkbox" value="${opt.value}" ${checked} class="form-checkbox h-4 w-4 text-[#FF5E00] bg-slate-700 border-slate-600 rounded focus:ring-[#FF5E00] focus:ring-offset-slate-800">
                    </label>
                `;
            });
            target.dd.innerHTML = html;

            // Update Text Label
            let label = 'Todos';
            if (level === 'coord') label = 'Coordenador';
            if (level === 'cocoord') label = 'Co-Coord';
            if (level === 'promotor') label = 'Promotor';

            updateFilterButtonText(target.text, selectedSet, label);
        }

        function setupHierarchyFilters(viewPrefix, onUpdate) {
            // Init State
            if (!hierarchyState[viewPrefix]) {
                hierarchyState[viewPrefix] = { coords: new Set(), cocoords: new Set(), promotors: new Set() };
            }
            const state = hierarchyState[viewPrefix];

            const els = {
                coord: { btn: document.getElementById(`${viewPrefix}-coord-filter-btn`), dd: document.getElementById(`${viewPrefix}-coord-filter-dropdown`) },
                cocoord: { btn: document.getElementById(`${viewPrefix}-cocoord-filter-btn`), dd: document.getElementById(`${viewPrefix}-cocoord-filter-dropdown`) },
                promotor: { btn: document.getElementById(`${viewPrefix}-promotor-filter-btn`), dd: document.getElementById(`${viewPrefix}-promotor-filter-dropdown`) }
            };

            const bindToggle = (el) => {
                if (el.btn && el.dd) {
                    el.btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        // Close others
                        Object.values(els).forEach(x => { if(x.dd && x !== el) x.dd.classList.add('hidden'); });
                        el.dd.classList.toggle('hidden');
                    });
                }
            };
            bindToggle(els.coord);
            bindToggle(els.cocoord);
            bindToggle(els.promotor);

            // Close dropdowns when clicking outside
            document.addEventListener('click', (e) => {
                Object.values(els).forEach(x => {
                    if (x.dd && !x.dd.classList.contains('hidden')) {
                        if (x.btn && !x.btn.contains(e.target) && !x.dd.contains(e.target)) {
                            x.dd.classList.add('hidden');
                        }
                    }
                });
            });

            const bindChange = (level, nextLevel, nextNextLevel) => {
                const el = els[level];
                if (el && el.dd) {
                    el.dd.addEventListener('change', (e) => {
                        if (e.target.type === 'checkbox') {
                            const val = e.target.value;
                            const set = state[level + 's'];
                            if (e.target.checked) set.add(val); else set.delete(val);

                            // Update Button Text
                            updateHierarchyDropdown(viewPrefix, level); // Re-render self? No, just text. But re-rendering handles text.

                            // Cascade Clear
                            if (nextLevel) {
                                state[nextLevel + 's'].clear();
                                updateHierarchyDropdown(viewPrefix, nextLevel);
                            }
                            if (nextNextLevel) {
                                state[nextNextLevel + 's'].clear();
                                updateHierarchyDropdown(viewPrefix, nextNextLevel);
                            }

                            if (onUpdate) onUpdate();
                        }
                    });
                }
            };

            bindChange('coord', 'cocoord', 'promotor');
            bindChange('cocoord', 'promotor', null);
            bindChange('promotor', null, null);

            // Initial Population
            updateHierarchyDropdown(viewPrefix, 'coord');
            updateHierarchyDropdown(viewPrefix, 'cocoord');
            updateHierarchyDropdown(viewPrefix, 'promotor');

            // Auto-select for restricted users?
            // If I am Coord, my Coord ID is userHierarchyContext.coord.
            // Should I pre-select it?
            // If I pre-select it, `getHierarchyFilteredClients` uses it.
            // If I DON'T pre-select it (empty set), `getHierarchyFilteredClients` applies it anyway via context.
            // Visually, it's better if it shows "My Name" instead of "Coordenador" (which implies All/None).
            // So yes, let's pre-select.

            if (userHierarchyContext.role !== 'adm') {
                if (userHierarchyContext.coord) state.coords.add(userHierarchyContext.coord);
                if (userHierarchyContext.cocoord) state.cocoords.add(userHierarchyContext.cocoord);
                if (userHierarchyContext.promotor) state.promotors.add(userHierarchyContext.promotor);

                // Refresh UI to show checkmarks and text
                updateHierarchyDropdown(viewPrefix, 'coord');
                updateHierarchyDropdown(viewPrefix, 'cocoord');
                updateHierarchyDropdown(viewPrefix, 'promotor');
            }
        }

        function initializeOptimizedDataStructures() {
            sellerDetailsMap = new Map();
            const sellerLastSaleDateMap = new Map(); // Track latest date per seller
            const clientToCurrentSellerMap = new Map();
            let americanasCodCli = null;

            // Use History AND Current Data for identifying Supervisor (Optimized)
            // Identify Supervisor for each Seller based on the *Latest* sale
            const sources = [allHistoryData, allSalesData];

            for (const source of sources) {
                if (!source) continue;
                for (let i = 0; i < source.length; i++) {
                    const s = source instanceof ColumnarDataset ? source.get(i) : source[i];
                    const codUsur = s.CODUSUR;
                    // Ignorar 'INATIVOS' e 'AMERICANAS' para evitar poluição do mapa de supervisores com lógica de fallback
                    if (codUsur && s.NOME !== 'INATIVOS' && s.NOME !== 'AMERICANAS') {
                        const dt = parseDate(s.DTPED);
                        const ts = dt ? dt.getTime() : 0;
                        const lastTs = sellerLastSaleDateMap.get(codUsur) || 0;

                        if (ts >= lastTs || !sellerDetailsMap.has(codUsur)) {
                            sellerLastSaleDateMap.set(codUsur, ts);
                            sellerDetailsMap.set(codUsur, { name: s.NOME, supervisor: s.SUPERV });
                        }
                    }
                }
            }

            optimizedData.clientsByRca = new Map();
            optimizedData.searchIndices.clients = new Array(allClientsData.length);
            optimizedData.rcasBySupervisor = new Map();
            optimizedData.productsBySupplier = new Map();
            optimizedData.salesByProduct = { current: new Map(), history: new Map() };
            optimizedData.rcaCodeByName = new Map();
            optimizedData.rcaNameByCode = new Map();
            optimizedData.supervisorCodeByName = new Map();
            optimizedData.productPastaMap = new Map();

            // --- HIERARCHY LOGIC START ---
            optimizedData.hierarchyMap = new Map(); // Promotor Code -> Hierarchy Node
            optimizedData.clientHierarchyMap = new Map(); // Client Code -> Hierarchy Node
            optimizedData.coordMap = new Map(); // Coord Code -> Name
            optimizedData.cocoordMap = new Map(); // CoCoord Code -> Name
            optimizedData.promotorMap = new Map(); // Promotor Code -> Name
            optimizedData.coordsByCocoord = new Map(); // CoCoord Code -> Coord Code
            optimizedData.cocoordsByCoord = new Map(); // Coord Code -> Set<CoCoord Code>
            optimizedData.promotorsByCocoord = new Map(); // CoCoord Code -> Set<Promotor Code>

            if (embeddedData.hierarchy) {
                embeddedData.hierarchy.forEach(h => {
                    // Robust key access (Handle lowercase/uppercase/mapped variations)
                    const getVal = (keys) => {
                        for (const k of keys) {
                            if (h[k] !== undefined && h[k] !== null) return String(h[k]);
                        }
                        return '';
                    };

                    const coordCode = getVal(['cod_coord', 'COD_COORD', 'COD COORD.']).trim().toUpperCase();
                    const coordName = (getVal(['nome_coord', 'NOME_COORD', 'COORDENADOR']) || coordCode).toUpperCase();

                    const cocoordCode = getVal(['cod_cocoord', 'COD_COCOORD', 'COD CO-COORD.']).trim().toUpperCase();
                    const cocoordName = (getVal(['nome_cocoord', 'NOME_COCOORD', 'CO-COORDENADOR']) || cocoordCode).toUpperCase();

                    const promotorCode = getVal(['cod_promotor', 'COD_PROMOTOR', 'COD PROMOTOR']).trim().toUpperCase();
                    const promotorName = (getVal(['nome_promotor', 'NOME_PROMOTOR', 'PROMOTOR']) || promotorCode).toUpperCase();

                    if (coordCode) {
                        optimizedData.coordMap.set(coordCode, coordName);
                        if (!optimizedData.cocoordsByCoord.has(coordCode)) optimizedData.cocoordsByCoord.set(coordCode, new Set());
                        if (cocoordCode) optimizedData.cocoordsByCoord.get(coordCode).add(cocoordCode);
                    }
                    if (cocoordCode) {
                        optimizedData.cocoordMap.set(cocoordCode, cocoordName);
                        if (coordCode) optimizedData.coordsByCocoord.set(cocoordCode, coordCode);
                        if (!optimizedData.promotorsByCocoord.has(cocoordCode)) optimizedData.promotorsByCocoord.set(cocoordCode, new Set());
                        if (promotorCode) optimizedData.promotorsByCocoord.get(cocoordCode).add(promotorCode);
                    }
                    if (promotorCode) optimizedData.promotorMap.set(promotorCode, promotorName);

                    if (promotorCode) {
                        optimizedData.hierarchyMap.set(promotorCode, {
                            coord: { code: coordCode, name: coordName },
                            cocoord: { code: cocoordCode, name: cocoordName },
                            promotor: { code: promotorCode, name: promotorName }
                        });
                    }
                });
            }

            optimizedData.clientPromotersMap = new Map(); // Fast lookup for modal

            if (embeddedData.clientPromoters) {
                let matchCount = 0;
                let sampleLogged = false;
                embeddedData.clientPromoters.forEach(cp => {
                    let clientCode = String(cp.client_code).trim();
                    // Normalize client code to match dataset (remove leading zeros)
                    if (/^\d+$/.test(clientCode)) {
                        clientCode = String(parseInt(clientCode, 10));
                    }

                    // Populate Map for O(1) Access
                    optimizedData.clientPromotersMap.set(normalizeKey(clientCode), cp);

                    const promotorCode = String(cp.promoter_code).trim().toUpperCase();
                    const hierarchyNode = optimizedData.hierarchyMap.get(promotorCode);
                    if (hierarchyNode) {
                        optimizedData.clientHierarchyMap.set(clientCode, hierarchyNode);
                        matchCount++;
                    } else if (!sampleLogged) {
                        console.warn(`[DEBUG] Hierarchy Node Not Found for Promotor: ${promotorCode} (Client: ${clientCode})`);
                        sampleLogged = true;
                    }
                });
            } else {
                console.warn("[DEBUG] embeddedData.clientPromoters is missing or empty.");
            }
            // --- HIERARCHY LOGIC END ---

            // Access via accessor method for potential ColumnarDataset
            const getClient = (i) => allClientsData instanceof ColumnarDataset ? allClientsData.get(i) : allClientsData[i];

            for (let i = 0; i < allClientsData.length; i++) {
                const client = getClient(i); // Hydrate object for processing
                const codCli = normalizeKey(client['Código'] || client['codigo_cliente']);

                // Sanitize: Skip header rows if present
                if (!codCli || codCli === 'Código' || codCli === 'codigo_cliente' || codCli === 'CODCLI' || codCli === 'CODIGO') continue;

                // Normalize keys from Supabase (Upper) or Local/Legacy (Lower/Camel)
                // mapKeysToUpper might have transformed 'cidade' -> 'CIDADE', 'ramo' -> 'RAMO', etc.
                client.cidade = client.cidade || client.CIDADE || 'N/A';
                client.bairro = client.bairro || client.BAIRRO || 'N/A';
                client.ramo = client.ramo || client.RAMO || 'N/A';

                // Name Normalization
                // mapKeysToUpper maps 'NOMECLIENTE' -> 'Cliente'. Local/Worker might produce 'nomeCliente'.
                // Verified: Include razaoSocial and RAZAOSOCIAL in naming priority
                client.nomeCliente = client.nomeCliente || client.razaoSocial || client.RAZAOSOCIAL || client.Cliente || client.CLIENTE || client.NOMECLIENTE || 'N/A';

                // RCA Handling
                // mapKeysToUpper maps 'RCA1' -> 'RCA 1'. Local might use 'rca1'.
                const rca1 = client.rca1 || client['RCA 1'] || client.RCA1;
                // Normalize access for rest of the code
                client.rca1 = rca1;

                const razaoSocial = client.razaoSocial || client.RAZAOSOCIAL || client.Cliente || ''; // Fallback

                if (razaoSocial.toUpperCase().includes('AMERICANAS')) {
                    client.rca1 = '1001';
                    client.rcas = ['1001'];
                    americanasCodCli = codCli;
                    // Ensure global mapping for Import/Analysis lookup
                    optimizedData.rcaCodeByName.set('AMERICANAS', '1001');
                    sellerDetailsMap.set('1001', { name: 'AMERICANAS', supervisor: 'BALCAO' });
                }
                // Removed INATIVOS logic as per request

                if (client.rca1) clientToCurrentSellerMap.set(codCli, String(client.rca1));
                clientRamoMap.set(codCli, client.ramo);

                // Handle RCAS array (could be 'rcas' or 'RCAS')
                let rcas = client.rcas || client.RCAS;

                // Sanitize RCAS: Filter out invalid values like "rcas" (header leak)
                if (Array.isArray(rcas)) {
                    rcas = rcas.filter(r => r && String(r).toLowerCase() !== 'rcas');
                } else if (typeof rcas === 'string' && rcas.toLowerCase() === 'rcas') {
                    rcas = [];
                }

                client.rcas = rcas; // Normalize for later use if needed

                if (rcas) {
                    for (let j = 0; j < rcas.length; j++) {
                        const rca = rcas[j];
                        if (rca) {
                            if (!optimizedData.clientsByRca.has(rca)) optimizedData.clientsByRca.set(rca, []);
                            optimizedData.clientsByRca.get(rca).push(client);
                        }
                    }
                }

                const rawCnpj = client['CNPJ/CPF'] || client.cnpj_cpf || client.CNPJ || '';
                const cleanCnpj = String(rawCnpj).replace(/[^0-9]/g, '');

                // Calculate isActive status for search optimization
                // Logic: Americanas OR (Not Balcão AND Not Inactive) OR Has Sales
                const isAmericanas = (client.razaoSocial || '').toUpperCase().includes('AMERICANAS');
                const rca1Val = String(client.rca1 || '').trim();
                const isActive = (isAmericanas || rca1Val !== '53' || clientsWithSalesThisMonth.has(codCli));

                optimizedData.searchIndices.clients[i] = {
                    i: i, // Store index for O(1) retrieval
                    code: codCli,
                    name: client.nomeCliente || '', // Store original name for sorting
                    nameLower: (client.nomeCliente || '').toLowerCase(),
                    cityLower: (client.cidade || '').toLowerCase(),
                    bairroLower: (client.bairro || '').toLowerCase(),
                    cnpj: cleanCnpj,
                    isActive: isActive
                };
            }

            const supervisorToRcaMap = new Map();
            const workingDaysSet = new Set();

            const processDatasetForIndices = (data, indexSet, dataMap, isHistory) => {
                const { bySupervisor, byRca, byPasta, bySupplier, byClient, byPosition, byRede, byTipoVenda, byProduct, byCity, byFilial } = indexSet;

                const isColumnar = data instanceof ColumnarDataset;
                // Use _data because .values is now a method
                const colValues = isColumnar ? data._data : null;

                // Optimization: Helper to read values without creating Proxy
                const getVal = (i, prop) => {
                    if (isColumnar && colValues && colValues[prop]) {
                        return colValues[prop][i];
                    }
                    // Fallback for non-columnar or missing columns
                    if (isColumnar) {
                         // If column missing in _data, try safe access via get() but this creates proxy
                         // Better: assume if not in _data, it's not there or handled by overrides (which are rare here)
                         // But if we MUST fallback:
                         const item = data.get(i);
                         return item ? item[prop] : undefined;
                    }
                    return data[i] ? data[i][prop] : undefined;
                };

                // Cache for parsed dates to avoid repeated parsing of same timestamp/string
                const dateCache = new Map();

                for (let i = 0; i < data.length; i++) {
                    // Optimized: Use Integer Index as ID
                    const id = i;

                    // Note: dataMap is now the dataset itself, we don't need to set anything into it.
                    // We just index the position 'i'.

                    const supervisor = getVal(i, 'SUPERV') || 'N/A';
                    const rca = getVal(i, 'NOME') || 'N/A';

                    // Use pre-normalized PASTA
                    let pasta = getVal(i, 'OBSERVACAOFOR');

                    const supplier = getVal(i, 'CODFOR');
                    const client = normalizeKey(getVal(i, 'CODCLI'));
                    const position = getVal(i, 'POSICAO') || 'N/A';
                    const rede = clientRamoMap.get(client) || 'N/A';
                    const tipoVenda = getVal(i, 'TIPOVENDA');
                    const product = getVal(i, 'PRODUTO');
                    // Optimized: Lookup City from Client Map (Removed from Sales Data to save space)
                    const clientObj = clientMapForKPIs.get(String(client));
                    const city = (clientObj ? (clientObj.cidade || clientObj['Nome da Cidade']) : 'N/A').toLowerCase();
                    const filial = getVal(i, 'FILIAL');
                    const codUsur = getVal(i, 'CODUSUR');
                    const codSupervisor = getVal(i, 'CODSUPERVISOR');

                    if (!bySupervisor.has(supervisor)) bySupervisor.set(supervisor, new Set()); bySupervisor.get(supervisor).add(id);
                    if (!byRca.has(rca)) byRca.set(rca, new Set()); byRca.get(rca).add(id);
                    if (!byPasta.has(pasta)) byPasta.set(pasta, new Set()); byPasta.get(pasta).add(id);
                    if (supplier) {
                        if (!bySupplier.has(supplier)) bySupplier.set(supplier, new Set());
                        bySupplier.get(supplier).add(id);

                        // Virtual Categories Logic (Shared with Meta vs Realizado)
                        // 1119 Split: TODDYNHO, TODDY, QUAKER/KEROCOCO
                        if (window.isFoods(supplier)) {
                            const desc = String(getVal(i, 'DESCRICAO') || '').toUpperCase();
                            let virtualKey = null;
                            if (desc.includes('TODDYNHO')) virtualKey = window.SUPPLIER_CODES.VIRTUAL.TODDYNHO;
                            else if (desc.includes('TODDY')) virtualKey = window.SUPPLIER_CODES.VIRTUAL.TODDY;
                            else if (desc.includes('QUAKER') || desc.includes('KEROCOCO')) virtualKey = window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO;

                            if (virtualKey) {
                                if (!bySupplier.has(virtualKey)) bySupplier.set(virtualKey, new Set());
                                bySupplier.get(virtualKey).add(id);
                            }
                        }
                    }
                    if (client) { if (!byClient.has(client)) byClient.set(client, new Set()); byClient.get(client).add(id); }
                    if (tipoVenda) { if (!byTipoVenda.has(tipoVenda)) byTipoVenda.set(tipoVenda, new Set()); byTipoVenda.get(tipoVenda).add(id); }
                    if (position) { if (!byPosition.has(position)) byPosition.set(position, new Set()); byPosition.get(position).add(id); }
                    if (rede) { if (!byRede.has(rede)) byRede.set(rede, new Set()); byRede.get(rede).add(id); }
                    if (product) { if (!byProduct.has(product)) byProduct.set(product, new Set()); byProduct.get(product).add(id); }
                    if (city) { if (!byCity.has(city)) byCity.set(city, new Set()); byCity.get(city).add(id); }
                    if (filial) { if (!byFilial.has(filial)) byFilial.set(filial, new Set()); byFilial.get(filial).add(id); }

                    if (codUsur && supervisor) { if (!supervisorToRcaMap.has(supervisor)) supervisorToRcaMap.set(supervisor, new Set()); supervisorToRcaMap.get(supervisor).add(codUsur); }
                    if (supplier && product) { if (!optimizedData.productsBySupplier.has(supplier)) optimizedData.productsBySupplier.set(supplier, new Set()); optimizedData.productsBySupplier.get(supplier).add(product); }
                    if (rca && codUsur && rca !== 'INATIVOS') { optimizedData.rcaCodeByName.set(rca, codUsur); optimizedData.rcaNameByCode.set(codUsur, rca); }
                    if (supervisor && codSupervisor) { optimizedData.supervisorCodeByName.set(supervisor, codSupervisor); }
                    if (client && filial) { clientLastBranch.set(client, filial); }
                    if (product && pasta && !optimizedData.productPastaMap.has(product)) { optimizedData.productPastaMap.set(product, pasta); }

                    const dtPed = getVal(i, 'DTPED');
                    if (dtPed) {
                        // Check cache
                        if (dateCache.has(dtPed)) {
                            const cached = dateCache.get(dtPed);
                            if (cached) workingDaysSet.add(cached);
                        } else {
                            // dtPed is likely a number (timestamp).
                            // If it's a number, new Date(dtPed) works.
                            // If it's a string, parseDate(dtPed) (from local function or global?)
                            // Global parseDate handles numbers too.
                            const dateObj = (typeof dtPed === 'number') ? new Date(dtPed) : parseDate(dtPed);
                            let result = null;

                            if(dateObj && !isNaN(dateObj.getTime())) {
                                const dayOfWeek = dateObj.getUTCDay();
                                if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                                    result = dateObj.toISOString().split('T')[0];
                                    workingDaysSet.add(result);
                                }
                            }
                            dateCache.set(dtPed, result);
                        }
                    }

                    if (product) {
                        const targetMap = isHistory ? optimizedData.salesByProduct.history : optimizedData.salesByProduct.current;
                        if (!targetMap.has(product)) targetMap.set(product, []);
                        // Here we still push the item object because consumers expect it.
                        // Ideally we would store indices, but that requires larger refactor.
                        // Since this is subset by product, it might be acceptable, or we create Proxy on demand.
                        targetMap.get(product).push(isColumnar ? data.get(i) : data[i]);
                    }
                }
            };

            processDatasetForIndices(allSalesData, optimizedData.indices.current, optimizedData.salesById, false);
            processDatasetForIndices(allHistoryData, optimizedData.indices.history, optimizedData.historyById, true);

            // --- POPULATE MISSING PASTA FOR UNSOLD PRODUCTS ---
            // Build a map of CODFOR -> PASTA using sold products
            const codforToPastaMap = new Map();
            optimizedData.productPastaMap.forEach((pasta, productCode) => {
                const details = productDetailsMap.get(productCode);
                if (details && details.codfor) {
                    if (!codforToPastaMap.has(details.codfor)) {
                        codforToPastaMap.set(details.codfor, pasta);
                    }
                }
            });

            // Backfill Pasta for products that have no sales (and thus no entry in productPastaMap yet)
            productDetailsMap.forEach((details, productCode) => {
                if (!optimizedData.productPastaMap.has(productCode) && details.codfor) {
                    const inferredPasta = codforToPastaMap.get(details.codfor);
                    if (inferredPasta) {
                        optimizedData.productPastaMap.set(productCode, inferredPasta);
                    }
                }
            });
            // --- END BACKFILL ---

            supervisorToRcaMap.forEach((rcas, supervisor) => {
                optimizedData.rcasBySupervisor.set(supervisor, Array.from(rcas));
            });

            // Process Aggregated Orders (Remap only)
            for(let i = 0; i < aggregatedOrders.length; i++) {
                const sale = aggregatedOrders[i];
                // Convert to Date using robust parser
                sale.DTPED = parseDate(sale.DTPED);
                sale.DTSAIDA = parseDate(sale.DTSAIDA);

                if (sale.CODCLI !== americanasCodCli) {
                    const currentSellerCode = clientToCurrentSellerMap.get(sale.CODCLI);
                    if (currentSellerCode) {
                        const sellerDetails = sellerDetailsMap.get(currentSellerCode);
                        if (sellerDetails) {
                            sale.CODUSUR = currentSellerCode;
                            sale.NOME = sellerDetails.name;
                            sale.SUPERV = sellerDetails.supervisor;
                        }
                    }
                }
            }

            sortedWorkingDays = Array.from(workingDaysSet).sort((a, b) => new Date(a) - new Date(b));
            maxWorkingDaysStock = workingDaysSet.size > 0 ? workingDaysSet.size : 1;
            customWorkingDaysStock = maxWorkingDaysStock;

            setTimeout(() => {
                const maxDaysLabel = document.getElementById('max-working-days-label');
                if (maxDaysLabel) maxDaysLabel.textContent = `(Máx: ${maxWorkingDaysStock})`;
                const daysInput = document.getElementById('stock-working-days-input');
                if(daysInput) daysInput.value = customWorkingDaysStock;
            }, 0);
        }

        aggregatedOrders.sort((a, b) => {
            const dateA = a.DTPED;
            const dateB = b.DTPED;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateB - dateA;
        });

        // --- GLOBAL NAVIGATION HISTORY ---
        let currentActiveView = 'dashboard';
        let viewHistory = [];

        function setupGlobalEsc() {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    // Priority 1: Check Open Modals
                    const openModal = document.querySelector('.modal-overlay:not(.hidden)');
                    if (openModal) {
                        // Check for Modal Internal History (Tabs)
                        if (openModal._tabHistory && openModal._tabHistory.length > 0) {
                            const prevTab = openModal._tabHistory.pop();
                            // Find switchTab function context?
                            // Since switchTab is closure-scoped inside openWalletClientModal, we can't call it directly unless we exposed it or stored it.
                            // Better approach: Store the 'restore' callback in the history.

                            // Re-evaluating: 'switchTab' is inside 'openWalletClientModal'.
                            // We need to expose switchTab or make _tabHistory store functions.
                            // Let's assume _tabHistory stores { callback: () => ... }
                            if (prevTab && typeof prevTab.restore === 'function') {
                                prevTab.restore();
                                return;
                            }
                        }

                        // Default: Close Modal
                        // Find the close button and click it to ensure cleanup logic runs
                        const closeBtn = openModal.querySelector('button[id$="close-btn"]');
                        if (closeBtn) closeBtn.click();
                        else openModal.classList.add('hidden'); // Fallback
                        return;
                    }

                    // Priority 2: View Navigation
                    if (viewHistory.length > 0) {
                        const prevView = viewHistory.pop();
                        renderView(prevView, { skipHistory: true });
                    }
                }
            });
        }
        setupGlobalEsc();

        Chart.register(ChartDataLabels);

        const mainDashboard = document.getElementById('main-dashboard');
        const cityView = document.getElementById('city-view');
        const positivacaoView = document.getElementById('positivacao-view');
        const comparisonView = document.getElementById('comparison-view');
        const stockView = document.getElementById('stock-view');

        const showCityBtn = document.getElementById('show-city-btn');
        const backToMainFromCityBtn = document.getElementById('back-to-main-from-city-btn');
        const backToMainFromComparisonBtn = document.getElementById('back-to-main-from-comparison-btn');
        const backToMainFromStockBtn = document.getElementById('back-to-main-from-stock-btn');

        const totalVendasEl = document.getElementById('total-vendas');
        const totalPesoEl = document.getElementById('total-peso');
        const kpiSkuPdVEl = document.getElementById('kpi-sku-pdv');
        const kpiPositivacaoEl = document.getElementById('kpi-positivacao');
        const kpiPositivacaoPercentEl = document.getElementById('kpi-positivacao-percent');


        const viewComparisonBtn = document.getElementById('viewComparisonBtn');
        const viewStockBtn = document.getElementById('viewStockBtn');
        const chartView = document.getElementById('chartView');
        const faturamentoBtn = document.getElementById('faturamentoBtn');
        const pesoBtn = document.getElementById('pesoBtn');

        const supervisorFilter = document.getElementById('supervisor-filter');
        const fornecedorFilter = document.getElementById('fornecedor-filter');
        const vendedorFilterBtn = document.getElementById('vendedor-filter-btn');
        const vendedorFilterText = document.getElementById('vendedor-filter-text');
        const vendedorFilterDropdown = document.getElementById('vendedor-filter-dropdown');

        const tipoVendaFilterBtn = document.getElementById('tipo-venda-filter-btn');
        const tipoVendaFilterText = document.getElementById('tipo-venda-filter-text');
        const tipoVendaFilterDropdown = document.getElementById('tipo-venda-filter-dropdown');

        const mainRedeGroupContainer = document.getElementById('main-rede-group-container');
        const mainComRedeBtn = document.getElementById('main-com-rede-btn');
        const mainComRedeBtnText = document.getElementById('main-com-rede-btn-text');
        const mainRedeFilterDropdown = document.getElementById('main-rede-filter-dropdown');

        const posicaoFilter = document.getElementById('posicao-filter');
        const codcliFilter = document.getElementById('codcli-filter');
        const clearFiltersBtn = document.getElementById('clear-filters-btn');
        const salesByPersonTitle = document.getElementById('sales-by-person-title');
        const fornecedorToggleContainerEl = document.getElementById('fornecedor-toggle-container');

        const citySupervisorFilter = document.getElementById('city-supervisor-filter');
        const cityVendedorFilterText = document.getElementById('city-vendedor-filter-text');
        const citySupplierFilterBtn = document.getElementById('city-supplier-filter-btn');
        const citySupplierFilterText = document.getElementById('city-supplier-filter-text');
        const citySupplierFilterDropdown = document.getElementById('city-supplier-filter-dropdown');
        // cityNameFilter removed
        function getActiveClientsData() {
            try {
                // Optimized path for ColumnarDataset to avoid Proxy creation overhead during filtering
                if (allClientsData instanceof ColumnarDataset) {
                    const results = [];
                    const data = allClientsData._data;
                    const len = allClientsData.length;

                    // Resolve columns efficiently
                    const colCode = data['Código'] || data['codigo_cliente'] || [];
                    const colRca1 = data['rca1'] || data['RCA 1'] || data['RCA1'] || [];
                    const colRazao = data['razaoSocial'] || data['RAZAOSOCIAL'] || data['Cliente'] || data['CLIENTE'] || [];

                    for (let i = 0; i < len; i++) {
                        const codcli = String(colCode[i] || '');
                        const rca1 = String(colRca1[i] || '').trim();

                        let isAmericanas = false;
                        const razao = colRazao[i];
                        if (razao && typeof razao === 'string' && razao.toUpperCase().includes('AMERICANAS')) {
                            isAmericanas = true;
                        }

                        // Use the exact same logic as original
                        const keep = (isAmericanas || rca1 !== '53' || clientsWithSalesThisMonth.has(codcli));

                        if (keep) {
                            results.push(allClientsData.get(i));
                        }
                    }
                    return results;
                }

                const res = allClientsData.filter(c => {
                    const codcli = String(c['Código'] || c['codigo_cliente']);
                    const rca1 = String(c.rca1 || '').trim();
                    const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');
                    const keep = (isAmericanas || rca1 !== '53' || clientsWithSalesThisMonth.has(codcli));
                    return keep;
                });
                return res;
            } catch (e) {
                console.error("[ActiveClients] Error:", e);
                return [];
            }
        }
        const cityCodCliFilter = document.getElementById('city-codcli-filter');
        const cityCodCliFilterSuggestions = document.getElementById('city-codcli-filter-suggestions');
        const clearCityFiltersBtn = document.getElementById('clear-city-filters-btn');
        const totalFaturamentoCidadeEl = document.getElementById('total-faturamento-cidade');
        const totalClientesCidadeEl = document.getElementById('total-clientes-cidade');
        // cityActiveDetailTableBody removed
        // cityInactiveDetailTableBody removed

        const cityRedeGroupContainer = document.getElementById('city-rede-group-container');
        const cityComRedeBtn = document.getElementById('city-com-rede-btn');
        const cityComRedeBtnText = document.getElementById('city-com-rede-btn-text');
        const cityRedeFilterDropdown = document.getElementById('city-rede-filter-dropdown');

        const cityTipoVendaFilterBtn = document.getElementById('city-tipo-venda-filter-btn');
        const cityTipoVendaFilterText = document.getElementById('city-tipo-venda-filter-text');
        const cityTipoVendaFilterDropdown = document.getElementById('city-tipo-venda-filter-dropdown');

        const positivacaoActiveDetailTableBody = document.getElementById('positivacao-active-detail-table-body');
        const positivacaoInactiveDetailTableBody = document.getElementById('positivacao-inactive-detail-table-body');
        const positivacaoRedeGroupContainer = document.getElementById('positivacao-rede-group-container');
        const positivacaoComRedeBtn = document.getElementById('positivacao-com-rede-btn');
        const positivacaoComRedeBtnText = document.getElementById('positivacao-com-rede-btn-text');
        const positivacaoRedeFilterDropdown = document.getElementById('positivacao-rede-filter-dropdown');
        const positivacaoTipoVendaFilterBtn = document.getElementById('positivacao-tipo-venda-filter-btn');
        const positivacaoTipoVendaFilterText = document.getElementById('positivacao-tipo-venda-filter-text');
        const positivacaoTipoVendaFilterDropdown = document.getElementById('positivacao-tipo-venda-filter-dropdown');
        const positivacaoSupplierFilterBtn = document.getElementById('positivacao-supplier-filter-btn');
        const positivacaoSupplierFilterText = document.getElementById('positivacao-supplier-filter-text');
        const positivacaoSupplierFilterDropdown = document.getElementById('positivacao-supplier-filter-dropdown');
        const positivacaoCodCliFilter = document.getElementById('positivacao-codcli-filter');
        const positivacaoCodCliFilterSuggestions = document.getElementById('positivacao-codcli-filter-suggestions');
        const clearPositivacaoFiltersBtn = document.getElementById('clear-positivacao-filters-btn');

        const comparisonSupervisorFilter = document.getElementById('comparison-supervisor-filter');
        const comparisonVendedorFilterText = document.getElementById('comparison-vendedor-filter-text');
        const comparisonFornecedorToggleContainer = document.getElementById('comparison-fornecedor-toggle-container');
        const comparisonFilialFilter = document.getElementById('comparison-filial-filter');

        const comparisonSupplierFilterBtn = document.getElementById('comparison-supplier-filter-btn');
        const comparisonSupplierFilterText = document.getElementById('comparison-supplier-filter-text');
        const comparisonSupplierFilterDropdown = document.getElementById('comparison-supplier-filter-dropdown');

        const comparisonCityFilter = document.getElementById('comparison-city-filter');
        const comparisonCitySuggestions = document.getElementById('comparison-city-suggestions');
        const comparisonProductFilterBtn = document.getElementById('comparison-product-filter-btn');
        const comparisonProductFilterText = document.getElementById('comparison-product-filter-text');
        const comparisonProductFilterDropdown = document.getElementById('comparison-product-filter-dropdown');

        const comparisonRedeGroupContainer = document.getElementById('comparison-rede-group-container');
        const comparisonComRedeBtn = document.getElementById('comparison-com-rede-btn');
        const comparisonComRedeBtnText = document.getElementById('comparison-com-rede-btn-text');
        const comparisonRedeFilterDropdown = document.getElementById('comparison-rede-filter-dropdown');

        const comparisonTipoVendaFilterBtn = document.getElementById('comparison-tipo-venda-filter-btn');
        const comparisonTipoVendaFilterText = document.getElementById('comparison-tipo-venda-filter-text');
        const comparisonTipoVendaFilterDropdown = document.getElementById('comparison-tipo-venda-filter-dropdown');

        const clearComparisonFiltersBtn = document.getElementById('clear-comparison-filters-btn');
        const comparisonTendencyToggle = document.getElementById('comparison-tendency-toggle');

        const comparisonChartTitle = document.getElementById('comparison-chart-title');
        const toggleDailyBtn = document.getElementById('toggle-daily-btn');
        const toggleWeeklyBtn = document.getElementById('toggle-weekly-btn');
        const toggleMonthlyBtn = document.getElementById('toggle-monthly-btn');
        const weeklyComparisonChartContainer = document.getElementById('weeklyComparisonChartContainer');
        const monthlyComparisonChartContainer = document.getElementById('monthlyComparisonChartContainer');

        const newProductsTableBody = document.getElementById('new-products-table-body');
        const lostProductsTableBody = document.getElementById('lost-products-table-body');


        const innovationsMonthView = document.getElementById('innovations-month-view');
        const innovationsMonthChartContainer = document.getElementById('innovations-month-chartContainer');
        const innovationsMonthTableBody = document.getElementById('innovations-month-table-body');
        const innovationsMonthCategoryFilter = document.getElementById('innovations-month-category-filter');
        const innovationsMonthSupervisorFilter = document.getElementById('innovations-month-supervisor-filter');
        const innovationsMonthVendedorFilterText = document.getElementById('innovations-month-vendedor-filter-text');
        const innovationsMonthCityFilter = document.getElementById('innovations-month-city-filter');
        const innovationsMonthCitySuggestions = document.getElementById('innovations-month-city-suggestions');
        const clearInnovationsMonthFiltersBtn = document.getElementById('clear-innovations-month-filters-btn');
        const innovationsMonthFilialFilter = document.getElementById('innovations-month-filial-filter');
        const innovationsMonthActiveClientsKpi = document.getElementById('innovations-month-active-clients-kpi');
        const innovationsMonthTopCoverageKpi = document.getElementById('innovations-month-top-coverage-kpi');
        const innovationsMonthTopCoverageValueKpi = document.getElementById('innovations-month-top-coverage-value-kpi');
        const innovationsMonthTopCoverageCountKpi = document.getElementById('innovations-month-top-coverage-count-kpi');
        const innovationsMonthSelectionCoverageValueKpi = document.getElementById('innovations-month-selection-coverage-value-kpi');
        const innovationsMonthSelectionCoverageCountKpi = document.getElementById('innovations-month-selection-coverage-count-kpi');
        const innovationsMonthSelectionCoverageValueKpiPrevious = document.getElementById('innovations-month-selection-coverage-value-kpi-previous');
        const innovationsMonthSelectionCoverageCountKpiPrevious = document.getElementById('innovations-month-selection-coverage-count-kpi-previous');
        const innovationsMonthBonusCoverageValueKpi = document.getElementById('innovations-month-bonus-coverage-value-kpi');
        const innovationsMonthBonusCoverageCountKpi = document.getElementById('innovations-month-bonus-coverage-count-kpi');
        const innovationsMonthBonusCoverageValueKpiPrevious = document.getElementById('innovations-month-bonus-coverage-value-kpi-previous');
        const innovationsMonthBonusCoverageCountKpiPrevious = document.getElementById('innovations-month-bonus-coverage-count-kpi-previous');
        const exportInnovationsMonthPdfBtn = document.getElementById('export-innovations-month-pdf-btn');
        const innovationsMonthTipoVendaFilterBtn = document.getElementById('innovations-month-tipo-venda-filter-btn');
        const innovationsMonthTipoVendaFilterText = document.getElementById('innovations-month-tipo-venda-filter-text');
        const innovationsMonthTipoVendaFilterDropdown = document.getElementById('innovations-month-tipo-venda-filter-dropdown');

        const coverageView = document.getElementById('coverage-view');
        const viewCoverageBtn = document.getElementById('viewCoverageBtn');
        const backToMainFromCoverageBtn = document.getElementById('back-to-main-from-coverage-btn');
        const coverageSupervisorFilter = document.getElementById('coverage-supervisor-filter');
        const coverageVendedorFilterText = document.getElementById('coverage-vendedor-filter-text');
        const coverageSupplierFilterBtn = document.getElementById('coverage-supplier-filter-btn');
        const coverageSupplierFilterText = document.getElementById('coverage-supplier-filter-text');
        const coverageSupplierFilterDropdown = document.getElementById('coverage-supplier-filter-dropdown');
        const coverageCityFilter = document.getElementById('coverage-city-filter');
        const coverageCitySuggestions = document.getElementById('coverage-city-suggestions');
        const coverageProductFilterBtn = document.getElementById('coverage-product-filter-btn');
        const coverageProductFilterText = document.getElementById('coverage-product-filter-text');
        const coverageProductFilterDropdown = document.getElementById('coverage-product-filter-dropdown');
        const clearCoverageFiltersBtn = document.getElementById('clear-coverage-filters-btn');
        const coverageFilialFilter = document.getElementById('coverage-filial-filter');
        const coverageIncludeBonusCheckbox = document.getElementById('coverage-include-bonus');

        const coverageActiveClientsKpi = document.getElementById('coverage-active-clients-kpi');
        const coverageSelectionCoverageValueKpiPrevious = document.getElementById('coverage-selection-coverage-value-kpi-previous');
        const coverageSelectionCoverageCountKpiPrevious = document.getElementById('coverage-selection-coverage-count-kpi-previous');
        const coverageSelectionCoverageValueKpi = document.getElementById('coverage-selection-coverage-value-kpi');
        const coverageSelectionCoverageCountKpi = document.getElementById('coverage-selection-coverage-count-kpi');
        const coverageTopCoverageValueKpi = document.getElementById('coverage-top-coverage-value-kpi');
        const coverageTopCoverageProductKpi = document.getElementById('coverage-top-coverage-product-kpi');
        const coverageTopCoverageCountKpi = document.getElementById('coverage-top-coverage-count-kpi');
        const coverageTotalBoxesEl = document.getElementById('coverage-total-boxes');

        const coverageTableBody = document.getElementById('coverage-table-body');

        // --- Goals View Elements ---
        const goalsView = document.getElementById('goals-view');
        const goalsGvContent = document.getElementById('goals-gv-content');
        const goalsSvContent = document.getElementById('goals-sv-content');
        const goalsGvTableBody = document.getElementById('goals-gv-table-body');
        const goalsGvTotalValueEl = document.getElementById('goals-gv-total-value');

        const goalsGvSupervisorFilterText = document.getElementById('goals-gv-supervisor-filter-text');

        const goalsGvSellerFilterText = document.getElementById('goals-gv-seller-filter-text');

        const goalsGvCodcliFilter = document.getElementById('goals-gv-codcli-filter');
        const clearGoalsGvFiltersBtn = document.getElementById('clear-goals-gv-filters-btn');

        const goalsSvSupervisorFilterText = document.getElementById('goals-sv-supervisor-filter-text');

        // --- FAB Management ---
        const viewFabMap = {
            'cidades': null,
            'positivacao': 'positivacao-fab-container',
            'inovacoes-mes': 'innovations-fab-container',
            'mix': 'mix-fab-container',
            'meta-realizado': 'meta-realizado-fab-container',
            'cobertura': 'coverage-fab-container'
        };

        function updateFabVisibility(viewName) {
            // Hide all first
            Object.values(viewFabMap).forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });

            const activeFabId = viewFabMap[viewName];
            if (activeFabId) {
                const el = document.getElementById(activeFabId);
                if (el) el.classList.remove('hidden');
            }
        }

        const modal = document.getElementById('order-details-modal');
        const modalCloseBtn = document.getElementById('modal-close-btn');
        const modalPedidoId = document.getElementById('modal-pedido-id');
        const modalHeaderInfo = document.getElementById('modal-header-info');
        const modalTableBody = document.getElementById('modal-table-body');
        const modalFooterTotal = document.getElementById('modal-footer-total');

        const clientModal = document.getElementById('client-details-modal');
        const clientModalCloseBtn = document.getElementById('client-modal-close-btn');
        const clientModalContent = document.getElementById('client-modal-content');

        const holidayModal = document.getElementById('holiday-modal');
        const holidayModalCloseBtn = document.getElementById('holiday-modal-close-btn');
        const holidayModalDoneBtn = document.getElementById('holiday-modal-done-btn');
        const mainHolidayPickerBtn = document.getElementById('main-holiday-picker-btn');
        const comparisonHolidayPickerBtn = document.getElementById('comparison-holiday-picker-btn');
        const calendarContainer = document.getElementById('calendar-container');


        // --- View State Management ---
        const viewState = {
            dashboard: { dirty: true, rendered: false },
            comparativo: { dirty: true, rendered: false },
            cobertura: { dirty: true, rendered: false },
            cidades: { dirty: true, rendered: false },
            inovacoes: { dirty: true, rendered: false, cache: null, lastTypesKey: '' },
            mix: { dirty: true, rendered: false },
            goals: { dirty: true, rendered: false },
            metaRealizado: { dirty: true, rendered: false },
            clientes: { dirty: true, rendered: false },
            produtos: { dirty: true, rendered: false },
            consultas: { dirty: true, rendered: false },
            history: { dirty: true, rendered: false },
            wallet: { dirty: true, rendered: false },
            positivacao: { dirty: true, rendered: false }
        };

        // Render IDs for Race Condition Guard
        let mixRenderId = 0;
        let coverageRenderId = 0;
        let cityRenderId = 0;
        let positivacaoRenderId = 0;
        let comparisonRenderId = 0;
        let goalsRenderId = 0;
        let goalsSvRenderId = 0;

        let charts = {};
        let weeklyAmChartRoot = null;
        let monthlyAmChartRoot = null;
        let innovationsAmChartRoot = null;
        let currentProductMetric = 'faturamento';
        let currentFornecedor = '';
        let currentComparisonFornecedor = 'PEPSICO';
        let useTendencyComparison = false;
        let comparisonChartType = 'daily';
        let comparisonMonthlyMetric = 'faturamento';
        let activeClientsForExport = [];
        let positivacaoDataForExport = { active: [], inactive: [] };
        let positivacaoActiveState = { page: 1, limit: 80, data: [] };
        let positivacaoInactiveState = { page: 1, limit: 80, data: [] };
        let selectedMainCoords = [];
        let selectedMainCoCoords = [];
        let selectedMainPromotors = [];
        let selectedCityCoords = [];
        let selectedCityCoCoords = [];
        let selectedCityPromotors = [];
        let selectedPositivacaoCoords = [];
        let selectedPositivacaoCoCoords = [];
        let selectedPositivacaoPromotors = [];
        let selectedComparisonCoords = [];
        let selectedComparisonCoCoords = [];
        let selectedComparisonPromotors = [];
        let selectedInnovationsCoords = [];
        let selectedInnovationsCoCoords = [];
        let selectedInnovationsPromotors = [];
        let selectedMixCoords = [];
        let selectedMixCoCoords = [];
        let selectedMixPromotors = [];
        let selectedCoverageCoords = [];
        let selectedCoverageCoCoords = [];
        let selectedCoveragePromotors = [];
        let selectedGoalsGvCoords = [];
        let selectedGoalsGvCoCoords = [];
        let selectedGoalsGvPromotors = [];
        let selectedGoalsSvCoords = [];
        let selectedGoalsSvCoCoords = [];
        let selectedGoalsSvPromotors = [];
        let selectedGoalsSummaryCoords = [];
        let selectedGoalsSummaryCoCoords = [];
        let selectedGoalsSummaryPromotors = [];
        let selectedMetaRealizadoCoords = [];
        let selectedMetaRealizadoCoCoords = [];
        let selectedMetaRealizadoPromotors = [];
        let inactiveClientsForExport = [];
        let selectedMainSuppliers = [];
        let selectedTiposVenda = [];
        var selectedCitySuppliers = [];
        let selectedPositivacaoSuppliers = [];
        let selectedComparisonSuppliers = [];
        let selectedComparisonProducts = [];
        let selectedCoverageTiposVenda = [];
        let selectedComparisonTiposVenda = [];
        let selectedCityTiposVenda = [];
        let selectedPositivacaoTiposVenda = [];
        let historicalBests = {};
        let selectedHolidays = [];

        let selectedMainRedes = [];
        let selectedCityRedes = [];
        let selectedPositivacaoRedes = [];
        let selectedComparisonRedes = [];

        let mainRedeGroupFilter = '';
        let cityRedeGroupFilter = '';
        let positivacaoRedeGroupFilter = '';
        let comparisonRedeGroupFilter = '';

        let selectedInnovationsMonthTiposVenda = [];

        let selectedMixRedes = [];
        let mixRedeGroupFilter = '';
        let selectedMixTiposVenda = [];
        let mixTableDataForExport = [];
        let mixKpiMode = 'total'; // 'total' ou 'atendidos'

        let currentGoalsSupplier = 'PEPSICO_ALL';
        let currentGoalsBrand = null;
        let currentGoalsSvSupplier = window.SUPPLIER_CODES.EXTRUSADOS; // Default window.SUPPLIER_CODES.ELMA[0]
        let currentGoalsSvBrand = null;
        let currentGoalsSvData = [];
        let goalsTableState = {
            currentPage: 1,
            itemsPerPage: 100,
            filteredData: [],
            totalPages: 1
        };
        let goalsTargets = {
            [window.SUPPLIER_CODES.ELMA[0]]: { fat: 0, vol: 0 },
            [window.SUPPLIER_CODES.ELMA[1]]: { fat: 0, vol: 0 },
            [window.SUPPLIER_CODES.ELMA[2]]: { fat: 0, vol: 0 },
            [window.SUPPLIER_CODES.VIRTUAL.TODDYNHO]: { fat: 0, vol: 0 },
            [window.SUPPLIER_CODES.VIRTUAL.TODDY]: { fat: 0, vol: 0 },
            [window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO]: { fat: 0, vol: 0 }
        };
        window.goalsTargets = goalsTargets;

        let globalGoalsMetrics = {};
        let globalGoalsTotalsCache = {};
        let globalClientGoals = new Map();
        window.globalClientGoals = globalClientGoals;

        let goalsPosAdjustments = {
            'ELMA_ALL': new Map(), 'FOODS_ALL': new Map(), 'PEPSICO_ALL': new Map(),
            [window.SUPPLIER_CODES.ELMA[0]]: new Map(),
            [window.SUPPLIER_CODES.ELMA[1]]: new Map(),
            [window.SUPPLIER_CODES.ELMA[2]]: new Map(),
            [window.SUPPLIER_CODES.VIRTUAL.TODDYNHO]: new Map(),
            [window.SUPPLIER_CODES.VIRTUAL.TODDY]: new Map(),
            [window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO]: new Map()
        }; // Map<CodCli, Map<Key, {fat: 0, vol: 0}>>

        let goalsMixSaltyAdjustments = { 'PEPSICO_ALL': new Map(), 'ELMA_ALL': new Map(), 'FOODS_ALL': new Map() }; // Map<SellerName, adjustment>
        let goalsMixFoodsAdjustments = { 'PEPSICO_ALL': new Map(), 'ELMA_ALL': new Map(), 'FOODS_ALL': new Map() }; // Map<SellerName, adjustment>
        let quarterMonths = [];

        function identifyQuarterMonths() {
            const months = new Set();
            allHistoryData.forEach(s => {
                const d = parseDate(s.DTPED);
                if(d) {
                    months.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}`);
                }
            });
            const sorted = Array.from(months).sort((a, b) => {
                const [y1, m1] = a.split('-').map(Number);
                const [y2, m2] = b.split('-').map(Number);
                return (y1 * 12 + m1) - (y2 * 12 + m2);
            });
            // Take last 3
            const last3 = sorted.slice(-3);

            const monthNames = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

            quarterMonths = last3.map(k => {
                const [y, m] = k.split('-');
                return { key: k, label: monthNames[parseInt(m)] };
            });
        }

        function calculateGoalsMetrics() {
            if (quarterMonths.length === 0) identifyQuarterMonths();

            // Helper to init metrics structure
            const createMetric = () => ({
                fat: 0, vol: 0, prevFat: 0, prevVol: 0,
                prevClientsSet: new Set(),
                quarterlyPosClientsSet: new Set(), // New Set for Quarter Active
                monthlyClientsSets: new Map() // Map<MonthKey, Set<CodCli>>
            });

            globalGoalsMetrics = {
                [window.SUPPLIER_CODES.ELMA[0]]: createMetric(),
                [window.SUPPLIER_CODES.ELMA[1]]: createMetric(),
                [window.SUPPLIER_CODES.ELMA[2]]: createMetric(),
                [window.SUPPLIER_CODES.VIRTUAL.TODDYNHO]: createMetric(),
                [window.SUPPLIER_CODES.VIRTUAL.TODDY]: createMetric(),
                [window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO]: createMetric(),
                'ELMA_ALL': createMetric(),
                'FOODS_ALL': createMetric(),
                'PEPSICO_ALL': createMetric()
            };
            globalClientGoals.clear();

            const currentDate = lastSaleDate;
            const prevMonthDate = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() - 1, 1));
            const prevMonthIndex = prevMonthDate.getUTCMonth();
            const prevMonthYear = prevMonthDate.getUTCFullYear();

            // Filter clients to match the "Active Structure" definition (Same as Coverage/Goals Table)
            const activeClients = allClientsData.filter(c => {
                const rca1 = String(c.rca1 || '').trim();
                const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');
                if (isAmericanas) return true;
                // STRICT FILTER: Exclude RCA 53 (Balcão) and INATIVOS (Empty RCA1)
                if (rca1 === '53') return false;
                if (rca1 === '') return false; // Exclude INATIVOS
                return true;
            });

            // Optimization: Detect if history is columnar and IndexMap is available
            const isHistoryColumnar = optimizedData.historyById instanceof IndexMap && optimizedData.historyById._source.values;
            const historyValues = isHistoryColumnar ? optimizedData.historyById._source.values : null;

            activeClients.forEach(client => {
                const codCli = String(client['Código'] || client['codigo_cliente']);
                const clientHistoryIds = optimizedData.indices.history.byClient.get(normalizeKey(codCli));

                // Temp accumulation for this client to ensure Positive Balance check
                const clientTotals = {}; // key -> { prevFat: 0, monthlyFat: Map<MonthKey, val> }

                if (clientHistoryIds) {
                    if (isHistoryColumnar) {
                        // Optimized Path: Use indices
                        clientHistoryIds.forEach(id => {
                            const idx = optimizedData.historyById.getIndex(id);
                            if (idx === undefined) return;

                            const codUsur = historyValues['CODUSUR'][idx];
                             // EXCEPTION: Exclude Balcão (53) sales for Client 9569 from Summary Metrics
                            if (String(codCli).trim() === '9569' && (String(codUsur).trim() === '53' || String(codUsur).trim() === '053')) return;

                            let key = null;
                            const codFor = String(historyValues['CODFOR'][idx]);

                            if (codFor === window.SUPPLIER_CODES.ELMA[0]) key = window.SUPPLIER_CODES.ELMA[0];
                            else if (codFor === window.SUPPLIER_CODES.ELMA[1]) key = window.SUPPLIER_CODES.ELMA[1];
                            else if (codFor === window.SUPPLIER_CODES.ELMA[2]) key = window.SUPPLIER_CODES.ELMA[2];
                            else if (window.isFoods(codFor)) {
                                const desc = normalize(historyValues['DESCRICAO'][idx] || '');
                                if (desc.includes('TODDYNHO')) key = window.SUPPLIER_CODES.VIRTUAL.TODDYNHO;
                                else if (desc.includes('TODDY')) key = window.SUPPLIER_CODES.VIRTUAL.TODDY;
                                else if (desc.includes('QUAKER') || desc.includes('KEROCOCO')) key = window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO;
                            }

                            if (key && globalGoalsMetrics[key]) {
                                const dtPed = historyValues['DTPED'][idx];
                                const d = typeof dtPed === 'number' ? new Date(dtPed) : parseDate(dtPed);
                                const isPrevMonth = d && d.getUTCMonth() === prevMonthIndex && d.getUTCFullYear() === prevMonthYear;

                                // 1. Revenue/Volume metrics (Types 1 & 9) - Global Sums
                                const tipoVenda = historyValues['TIPOVENDA'][idx];
                                if (tipoVenda === '1' || tipoVenda === '9') {
                                    const vlVenda = Number(historyValues['VLVENDA'][idx]) || 0;
                                    const totPeso = Number(historyValues['TOTPESOLIQ'][idx]) || 0;

                                    globalGoalsMetrics[key].fat += vlVenda;
                                    globalGoalsMetrics[key].vol += totPeso;

                                    if (isPrevMonth) {
                                        globalGoalsMetrics[key].prevFat += vlVenda;
                                        globalGoalsMetrics[key].prevVol += totPeso;

                                        // Initialize Client Goal with Prev Month Value
                                        if (!globalClientGoals.has(codCli)) globalClientGoals.set(codCli, new Map());
                                        const cGoals = globalClientGoals.get(codCli);
                                        if (!cGoals.has(key)) cGoals.set(key, { fat: 0, vol: 0 });
                                        const g = cGoals.get(key);
                                        g.fat += vlVenda;
                                        g.vol += totPeso; // Kg
                                    }

                                    // 2. Accumulate for Client Count Check (Balance per period)
                                    if (d) {
                                    if (!clientTotals[key]) clientTotals[key] = { prevFat: 0, monthlyFat: new Map() };

                                    if (isPrevMonth) clientTotals[key].prevFat += vlVenda;

                                    const monthKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
                                    const currentMVal = clientTotals[key].monthlyFat.get(monthKey) || 0;
                                    clientTotals[key].monthlyFat.set(monthKey, currentMVal + vlVenda);
                                    }
                                }
                            }
                        });
                    } else {
                        // Fallback: Original Logic
                        clientHistoryIds.forEach(id => {
                            const sale = optimizedData.historyById.get(id);
                            // EXCEPTION: Exclude Balcão (53) sales for Client 9569 from Summary Metrics
                            if (String(codCli).trim() === '9569' && (String(sale.CODUSUR).trim() === '53' || String(sale.CODUSUR).trim() === '053')) return;

                            let key = null;
                            const codFor = String(sale.CODFOR);

                            if (codFor === window.SUPPLIER_CODES.ELMA[0]) key = window.SUPPLIER_CODES.ELMA[0];
                            else if (codFor === window.SUPPLIER_CODES.ELMA[1]) key = window.SUPPLIER_CODES.ELMA[1];
                            else if (codFor === window.SUPPLIER_CODES.ELMA[2]) key = window.SUPPLIER_CODES.ELMA[2];
                            else if (window.isFoods(codFor)) {
                                const desc = normalize(sale.DESCRICAO || '');
                                if (desc.includes('TODDYNHO')) key = window.SUPPLIER_CODES.VIRTUAL.TODDYNHO;
                                else if (desc.includes('TODDY')) key = window.SUPPLIER_CODES.VIRTUAL.TODDY;
                                else if (desc.includes('QUAKER') || desc.includes('KEROCOCO')) key = window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO;
                            }

                            if (key && globalGoalsMetrics[key]) {
                                const d = parseDate(sale.DTPED);
                                const isPrevMonth = d && d.getUTCMonth() === prevMonthIndex && d.getUTCFullYear() === prevMonthYear;

                                // 1. Revenue/Volume metrics (Types 1 & 9) - Global Sums
                                if (sale.TIPOVENDA === '1' || sale.TIPOVENDA === '9') {
                                    globalGoalsMetrics[key].fat += sale.VLVENDA;
                                    globalGoalsMetrics[key].vol += sale.TOTPESOLIQ;

                                    if (isPrevMonth) {
                                        globalGoalsMetrics[key].prevFat += sale.VLVENDA;
                                        globalGoalsMetrics[key].prevVol += sale.TOTPESOLIQ;

                                        // Initialize Client Goal with Prev Month Value
                                        if (!globalClientGoals.has(codCli)) globalClientGoals.set(codCli, new Map());
                                        const cGoals = globalClientGoals.get(codCli);
                                        if (!cGoals.has(key)) cGoals.set(key, { fat: 0, vol: 0 });
                                        const g = cGoals.get(key);
                                        g.fat += sale.VLVENDA;
                                        g.vol += sale.TOTPESOLIQ; // Kg
                                    }

                                    // 2. Accumulate for Client Count Check (Balance per period)
                                    if (d) {
                                    if (!clientTotals[key]) clientTotals[key] = { prevFat: 0, monthlyFat: new Map() };

                                    if (isPrevMonth) clientTotals[key].prevFat += sale.VLVENDA;

                                    const monthKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
                                    const currentMVal = clientTotals[key].monthlyFat.get(monthKey) || 0;
                                    clientTotals[key].monthlyFat.set(monthKey, currentMVal + sale.VLVENDA);
                                    }
                                }
                            }
                        });
                    }
                }

                // Check thresholds for this client
                for (const key in clientTotals) {
                    const t = clientTotals[key];
                    if (t.prevFat >= 1) {
                        globalGoalsMetrics[key].prevClientsSet.add(codCli);
                    }
                    t.monthlyFat.forEach((val, mKey) => {
                        if (val >= 1) {
                            if (!globalGoalsMetrics[key].monthlyClientsSets.has(mKey)) {
                                globalGoalsMetrics[key].monthlyClientsSets.set(mKey, new Set());
                            }
                            globalGoalsMetrics[key].monthlyClientsSets.get(mKey).add(codCli);
                        }
                    });
                }
            });

            // Calculate Averages and Finalize
            // First calculate basic metrics for leaf keys
            const leafKeys = window.SUPPLIER_CODES.ALL_GOALS;

            // Helper for aggregation
            const aggregateToAll = (targetKey, sourceKeys) => {
                const target = globalGoalsMetrics[targetKey];
                sourceKeys.forEach(key => {
                    const source = globalGoalsMetrics[key];
                    target.fat += source.fat;
                    target.vol += source.vol;
                    target.prevFat += source.prevFat;
                    target.prevVol += source.prevVol; // Already raw, keep raw for now

                    source.prevClientsSet.forEach(c => target.prevClientsSet.add(c));
                    source.quarterlyPosClientsSet.forEach(c => target.quarterlyPosClientsSet.add(c));

                    source.monthlyClientsSets.forEach((set, monthKey) => {
                        if (!target.monthlyClientsSets.has(monthKey)) {
                            target.monthlyClientsSets.set(monthKey, new Set());
                        }
                        const targetSet = target.monthlyClientsSets.get(monthKey);
                        set.forEach(c => targetSet.add(c));
                    });
                });
            };

            aggregateToAll('ELMA_ALL', window.SUPPLIER_CODES.ELMA);
            aggregateToAll('FOODS_ALL', window.SUPPLIER_CODES.VIRTUAL_LIST);
            aggregateToAll('PEPSICO_ALL', window.SUPPLIER_CODES.ALL_GOALS);

            // Finalize calculations for ALL keys
            for (const key in globalGoalsMetrics) {
                const m = globalGoalsMetrics[key];

                m.avgFat = m.fat / QUARTERLY_DIVISOR;
                m.avgVol = m.vol / QUARTERLY_DIVISOR; // Kg (No / 1000)
                m.prevVol = m.prevVol; // Kg (No / 1000)

                m.prevClients = m.prevClientsSet.size;

                let sumClients = 0;
                m.monthlyClientsSets.forEach(set => sumClients += set.size);
                m.avgClients = sumClients / QUARTERLY_DIVISOR;
            }
        }

        let selectedMetaRealizadoSuppliers = [];
        let currentMetaRealizadoPasta = 'PEPSICO'; // Default
        let currentMetaRealizadoMetric = 'valor'; // 'valor' or 'peso'

        // let innovationsIncludeBonus = true; // REMOVED
        // let innovationsMonthIncludeBonus = true; // REMOVED

        let innovationsMonthTableDataForExport = [];
        let innovationsByClientForExport = [];
        let categoryLegendForExport = [];
        let chartLabels = [];
        let globalInnovationCategories = null;
        let globalProductToCategoryMap = null;

        let calendarState = { year: lastSaleDate.getUTCFullYear(), month: lastSaleDate.getUTCMonth() };

        let selectedCoverageSuppliers = [];
        let selectedCoverageProducts = [];
        let coverageUnitPriceFilter = null;
        let customWorkingDaysCoverage = 0;
        let coverageTrendFilter = 'all';
        let coverageTableDataForExport = [];
        let currentCoverageChartMode = 'city';

        const coverageTipoVendaFilterBtn = document.getElementById('coverage-tipo-venda-filter-btn');
        const coverageTipoVendaFilterText = document.getElementById('coverage-tipo-venda-filter-text');
        const coverageTipoVendaFilterDropdown = document.getElementById('coverage-tipo-venda-filter-dropdown');


        let mixTableState = {
            currentPage: 1,
            itemsPerPage: 100,
            filteredData: [],
            totalPages: 1
        };

        const getFirstName = (fullName) => (fullName || '').split(' ')[0];

        // formatDate moved to utils.js

        function buildInnovationSalesMaps(salesData, mainTypes, bonusTypes) {
            const mainMap = new Map(); // Map<CODCLI, Map<PRODUTO, Set<CODUSUR>>>
            const bonusMap = new Map();
            const mainSet = new Set(mainTypes);
            const bonusSet = new Set(bonusTypes);

            salesData.forEach(sale => {
                const isMain = mainSet.has(sale.TIPOVENDA);
                const isBonus = bonusSet.has(sale.TIPOVENDA);

                if (!isMain && !isBonus) return;

                const codCli = sale.CODCLI;
                const prod = sale.PRODUTO;
                const rca = sale.CODUSUR;

                if (isMain) {
                    if (!mainMap.has(codCli)) mainMap.set(codCli, new Map());
                    const clientMap = mainMap.get(codCli);
                    if (!clientMap.has(prod)) clientMap.set(prod, new Set());
                    clientMap.get(prod).add(rca);
                }

                if (isBonus) {
                    if (!bonusMap.has(codCli)) bonusMap.set(codCli, new Map());
                    const clientMap = bonusMap.get(codCli);
                    if (!clientMap.has(prod)) clientMap.set(prod, new Set());
                    clientMap.get(prod).add(rca);
                }
            });
            return { mainMap, bonusMap };
        }

        // --- MIX VIEW LOGIC ---
        const MIX_SALTY_CATEGORIES = ['CHEETOS', 'DORITOS', 'FANDANGOS', 'RUFFLES', 'TORCIDA'];
        const MIX_FOODS_CATEGORIES = ['TODDYNHO', 'TODDY ', 'QUAKER', 'KEROCOCO'];

        function getMixFilteredData(options = {}) {
            const { excludeFilter = null } = options;

            const tiposVendaSet = new Set(selectedMixTiposVenda);
            const city = document.getElementById('mix-city-filter').value.trim().toLowerCase();
            const filial = document.getElementById('mix-filial-filter').value;

            // New Hierarchy Logic
            let clients = getHierarchyFilteredClients('mix', allClientsData);

            // OPTIMIZATION: Combine filters into a single pass
            const checkRede = excludeFilter !== 'rede';
            const isComRede = mixRedeGroupFilter === 'com_rede';
            const isSemRede = mixRedeGroupFilter === 'sem_rede';
            const redeSet = (isComRede && selectedMixRedes.length > 0) ? new Set(selectedMixRedes) : null;

            const checkFilial = filial !== 'ambas';
            const checkCity = excludeFilter !== 'city' && !!city;

            // Removed Supervisor/Seller checks
            // if (excludeFilter !== 'supplier' && selectedCitySuppliers.length > 0) { ... }

            clients = clients.filter(c => {
                // 1. Rede Logic
                if (checkRede) {
                    if (isComRede) {
                        if (!c.ramo || c.ramo === 'N/A') return false;
                        if (redeSet && !redeSet.has(c.ramo)) return false;
                    } else if (isSemRede) {
                        if (c.ramo && c.ramo !== 'N/A') return false;
                    }
                }

                // 2. Filial Logic
                if (checkFilial) {
                    if (clientLastBranch.get(c['Código']) !== filial) return false;
                }

                // 3. City Logic
                if (checkCity) {
                    if (!c.cidade || c.cidade.toLowerCase() !== city) return false;
                }

                // 4. Active Logic
                const rca1 = String(c.rca1 || '').trim();
                const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');
                // Keep if Americanas OR Not 53 OR Has Sales
                if (!isAmericanas && rca1 === '53' && !clientsWithSalesThisMonth.has(c['Código'])) return false;

                return true;
            });

            const clientCodes = new Set();
            for (const c of clients) {
                clientCodes.add(c['Código']);
            }

            const filters = {
                city: city,
                filial: filial,
                tipoVenda: tiposVendaSet,
                clientCodes: clientCodes
            };

            const sales = getFilteredDataFromIndices(optimizedData.indices.current, optimizedData.salesById, filters, excludeFilter);

            return { clients, sales };
        }

        function updateAllMixFilters(options = {}) {
            const { skipFilter = null } = options;

            // Supervisor/Seller filters managed by setupHierarchyFilters

            const { sales: salesTV } = getMixFilteredData({ excludeFilter: 'tipoVenda' });
            selectedMixTiposVenda = updateTipoVendaFilter(document.getElementById('mix-tipo-venda-filter-dropdown'), document.getElementById('mix-tipo-venda-filter-text'), selectedMixTiposVenda, salesTV, skipFilter === 'tipoVenda');

            if (skipFilter !== 'rede') {
                 const { clients: clientsRede } = getMixFilteredData({ excludeFilter: 'rede' });
                 if (mixRedeGroupFilter === 'com_rede') {
                     selectedMixRedes = updateRedeFilter(document.getElementById('mix-rede-filter-dropdown'), document.getElementById('mix-com-rede-btn-text'), selectedMixRedes, clientsRede);
                 }
            }
        }

        function handleMixFilterChange(options = {}) {
            if (window.mixUpdateTimeout) clearTimeout(window.mixUpdateTimeout);
            window.mixUpdateTimeout = setTimeout(() => {
                updateAllMixFilters(options);
                updateMixView();
            }, 10);
        }

        function resetMixFilters() {
            selectedMixTiposVenda = [];
            selectedMixRedes = [];
            mixRedeGroupFilter = '';

            const redeGroupContainer = document.getElementById('mix-rede-group-container');
            redeGroupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            redeGroupContainer.querySelector('button[data-group=""]').classList.add('active');
            document.getElementById('mix-rede-filter-dropdown').classList.add('hidden');

            updateAllMixFilters();
            updateMixView();
        }


        function getSkeletonRows(cols, rows = 5) {
            let html = '';
            for (let i = 0; i < rows; i++) {
                html += `<tr class="border-b border-white/10/50">`;
                for (let j = 0; j < cols; j++) {
                    // Empty data-label for skeleton to prevent "null" text on mobile, just shows bar
                    html += `<td class="p-4" data-label=""><div class="skeleton h-4 w-full"></div></td>`;
                }
                html += `</tr>`;
            }
            return html;
        }

        function updateMixView() {
            mixRenderId++;
            const currentRenderId = mixRenderId;

            const { clients, sales } = getMixFilteredData();
            // const activeClientCodes = new Set(clients.map(c => c['Código'])); // Not used if iterating clients array

            // Show Loading
            document.getElementById('mix-table-body').innerHTML = getSkeletonRows(13, 10);

            // 1. Agregar Valor Líquido por Produto por Cliente (Sync - O(Sales))
            const clientProductNetValues = new Map(); // Map<CODCLI, Map<PRODUTO, NetValue>>
            const clientProductDesc = new Map(); // Map<PRODUTO, Descricao> (Cache)

            sales.forEach(s => {
                if (!s.CODCLI || !s.PRODUTO) return;
                if (!isAlternativeMode(selectedMixTiposVenda) && s.TIPOVENDA !== '1' && s.TIPOVENDA !== '9') return;

                if (!clientProductNetValues.has(s.CODCLI)) {
                    clientProductNetValues.set(s.CODCLI, new Map());
                }
                const clientMap = clientProductNetValues.get(s.CODCLI);
                const currentVal = clientMap.get(s.PRODUTO) || 0;
                const val = getValueForSale(s, selectedMixTiposVenda);
                clientMap.set(s.PRODUTO, currentVal + val);

                if (!clientProductDesc.has(s.PRODUTO)) {
                    clientProductDesc.set(s.PRODUTO, s.DESCRICAO);
                }
            });

            // 2. Determinar Categorias Positivadas por Cliente
            // Uma categoria é positivada se o cliente comprou Pelo MENOS UM produto dela com valor líquido > 1
            const clientPositivatedCategories = new Map(); // Map<CODCLI, Set<CategoryName>>

            // Sync Loop for Map aggregation is fast enough
            clientProductNetValues.forEach((productsMap, codCli) => {
                const positivatedCats = new Set();

                productsMap.forEach((netValue, prodCode) => {
                    if (netValue >= 1) {
                        const desc = normalize(clientProductDesc.get(prodCode) || '');

                        // Checar Salty
                        MIX_SALTY_CATEGORIES.forEach(cat => {
                            if (desc.includes(cat)) positivatedCats.add(cat);
                        });
                        // Checar Foods
                        MIX_FOODS_CATEGORIES.forEach(cat => {
                            if (desc.includes(cat)) positivatedCats.add(cat);
                        });
                    }
                });
                clientPositivatedCategories.set(codCli, positivatedCats);
            });

            let positivadosSalty = 0;
            let positivadosFoods = 0;
            let positivadosBoth = 0;

            const tableData = [];

            // ASYNC CHUNKED PROCESSING for Clients
            runAsyncChunked(clients, (client) => {
                const codcli = client['Código'];
                const positivatedCats = clientPositivatedCategories.get(codcli) || new Set();

                // Determine Status based on "Buying ALL" (Strict Positive)
                const hasSalty = MIX_SALTY_CATEGORIES.every(b => positivatedCats.has(b));
                const hasFoods = MIX_FOODS_CATEGORIES.every(b => positivatedCats.has(b));

                if (hasSalty) positivadosSalty++;
                if (hasFoods) positivadosFoods++;
                if (hasSalty && hasFoods) positivadosBoth++;

                const missing = [];
                // Detailed missing analysis for Salty
                MIX_SALTY_CATEGORIES.forEach(b => { if(!positivatedCats.has(b)) missing.push(b); });
                // Detailed missing analysis for Foods
                MIX_FOODS_CATEGORIES.forEach(b => { if(!positivatedCats.has(b)) missing.push(b); });

                const missingText = missing.length > 0 ? missing.join(', ') : '';

                // Resolve Vendor Name
                const rcaCode = (client.rcas && client.rcas.length > 0) ? client.rcas[0] : null;
                let vendorName = 'N/A';
                if (rcaCode) {
                    vendorName = optimizedData.rcaNameByCode.get(rcaCode) || rcaCode;
                } else {
                    vendorName = 'INATIVOS';
                }

                const rowData = {
                    codcli: codcli,
                    name: client.fantasia || client.razaoSocial,
                    city: client.cidade || client.CIDADE || client['Nome da Cidade'] || 'N/A',
                    vendedor: vendorName,
                    hasSalty: hasSalty,
                    hasFoods: hasFoods,
                    brands: positivatedCats,
                    missingText: missingText,
                    score: missing.length
                };
                tableData.push(rowData);
            }, () => {
                // --- ON COMPLETE (Render) ---
                if (currentRenderId !== mixRenderId) return;

                let baseClientCount;
                const kpiTitleEl = document.getElementById('mix-kpi-title');

                if (mixKpiMode === 'atendidos') {
                    baseClientCount = getPositiveClientsWithNewLogic(sales);
                    if (kpiTitleEl) kpiTitleEl.textContent = 'POSIIVADOS';
                } else {
                    baseClientCount = clients.length;
                    if (kpiTitleEl) kpiTitleEl.textContent = 'BASE';
                }

                const saltyPct = baseClientCount > 0 ? (positivadosSalty / baseClientCount) * 100 : 0;
                const foodsPct = baseClientCount > 0 ? (positivadosFoods / baseClientCount) * 100 : 0;
                const bothPct = baseClientCount > 0 ? (positivadosBoth / baseClientCount) * 100 : 0;

                // Update KPIs
                document.getElementById('mix-total-clients-kpi').textContent = baseClientCount.toLocaleString('pt-BR');
                document.getElementById('mix-salty-kpi').textContent = `${saltyPct.toFixed(1)}%`;
                document.getElementById('mix-salty-count-kpi').textContent = `${positivadosSalty} clientes`;
                document.getElementById('mix-foods-kpi').textContent = `${foodsPct.toFixed(1)}%`;
                document.getElementById('mix-foods-count-kpi').textContent = `${positivadosFoods} clientes`;
                document.getElementById('mix-both-kpi').textContent = `${bothPct.toFixed(1)}%`;
                document.getElementById('mix-both-count-kpi').textContent = `${positivadosBoth} clientes`;

                // Charts
                const distributionData = [
                    positivadosBoth,
                    positivadosSalty - positivadosBoth,
                    positivadosFoods - positivadosBoth,
                    baseClientCount - (positivadosSalty + positivadosFoods - positivadosBoth)
                ];

                createChart('mixDistributionChart', 'doughnut', ['Mix Ideal (Ambos)', 'Só Salty', 'Só Foods', 'Nenhum'], distributionData, {
                    maintainAspectRatio: false, // Fix layout issue
                    backgroundColor: ['#a855f7', '#14b8a6', '#f59e0b', '#475569'],
                    plugins: { legend: { position: 'right' } }
                });

                // Seller Efficiency Chart
                const sellerStats = {};
                tableData.forEach(row => {
                    const seller = row.vendedor;
                    if (!sellerStats[seller]) sellerStats[seller] = { total: 0, both: 0, salty: 0, foods: 0 };
                    sellerStats[seller].total++;
                    if (row.hasSalty && row.hasFoods) sellerStats[seller].both++;
                    if (row.hasSalty) sellerStats[seller].salty++;
                    if (row.hasFoods) sellerStats[seller].foods++;
                });

                const sortedSellers = Object.entries(sellerStats)
                    .sort(([,a], [,b]) => b.both - a.both)
                    .slice(0, 10);

                createChart('mixSellerChart', 'bar', sortedSellers.map(([name]) => getFirstName(name)),
                    [
                        { label: 'Mix Ideal', data: sortedSellers.map(([,s]) => s.both), backgroundColor: '#a855f7' },
                        { label: 'Salty Total', data: sortedSellers.map(([,s]) => s.salty), backgroundColor: '#14b8a6', hidden: true },
                        { label: 'Foods Total', data: sortedSellers.map(([,s]) => s.foods), backgroundColor: '#f59e0b', hidden: true }
                    ],
                    { scales: { x: { stacked: false }, y: { stacked: false } } }
                );

                // Render Table with Detailed Columns
                tableData.sort((a, b) => {
                    // Sort by City (Alphabetical), then by Client Name
                    const cityA = (a.city || '').toLowerCase();
                    const cityB = (b.city || '').toLowerCase();
                    if (cityA < cityB) return -1;
                    if (cityA > cityB) return 1;
                    return (a.name || '').localeCompare(b.name || '');
                });

                mixTableDataForExport = tableData;

                mixTableState.filteredData = tableData;
                mixTableState.totalPages = Math.ceil(tableData.length / mixTableState.itemsPerPage);
                if (mixTableState.currentPage > mixTableState.totalPages && mixTableState.totalPages > 0) {
                    mixTableState.currentPage = mixTableState.totalPages;
                } else if (mixTableState.totalPages === 0) {
                     mixTableState.currentPage = 1;
                }

                const startIndex = (mixTableState.currentPage - 1) * mixTableState.itemsPerPage;
                const endIndex = startIndex + mixTableState.itemsPerPage;
                const pageData = tableData.slice(startIndex, endIndex);

                const checkIcon = `<svg class="w-4 h-4 text-green-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
                const dashIcon = `<span class="text-slate-600 text-xs">-</span>`;

                const xIcon = `<svg class="w-3 h-3 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;

                let tableHTML = pageData.map(row => {
                    let saltyCols = MIX_SALTY_CATEGORIES.map(b => `<td data-label="${b}" class="px-1 py-2 text-center border-l border-slate-500">${row.brands.has(b) ? checkIcon : xIcon}</td>`).join('');
                    let foodsCols = MIX_FOODS_CATEGORIES.map(b => `<td data-label="${b}" class="px-1 py-2 text-center border-l border-slate-500">${row.brands.has(b) ? checkIcon : xIcon}</td>`).join('');

                    return `
                    <tr class="hover:bg-slate-700/50 border-b border-slate-500 last:border-0">
                        <td data-label="Cód" class="px-2 py-2 md:px-4 md:py-2 font-medium text-slate-300 text-[10px] md:text-xs">${escapeHtml(row.codcli)}</td>
                        <td data-label="Cliente" class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-xs truncate max-w-[100px] md:max-w-[200px]" title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</td>
                        <td data-label="Cidade" class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-xs text-slate-300 truncate max-w-[80px] hidden md:table-cell">${escapeHtml(row.city)}</td>
                        <td data-label="Vendedor" class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-xs text-slate-400 truncate max-w-[80px] hidden md:table-cell">${escapeHtml(getFirstName(row.vendedor))}</td>
                        ${saltyCols}
                        ${foodsCols}
                    </tr>
                `}).join('');

                // Append Footer with Totals
                tableHTML += `
                    <tr class="glass-panel-heavy font-bold border-t-2 border-slate-500 text-xs sticky bottom-0 z-20">
                        <td colspan="4" class="px-2 py-3 text-right text-white">TOTAL POSITIVADOS:</td>
                        <td colspan="${MIX_SALTY_CATEGORIES.length}" class="px-2 py-3 text-center text-teal-400 text-sm border-l border-slate-500">${positivadosSalty}</td>
                        <td colspan="${MIX_FOODS_CATEGORIES.length}" class="px-2 py-3 text-center text-yellow-400 text-sm border-l border-slate-500">${positivadosFoods}</td>
                    </tr>
                `;

                document.getElementById('mix-table-body').innerHTML = tableHTML;

                const controls = document.getElementById('mix-pagination-controls');
                const infoText = document.getElementById('mix-page-info-text');
                const prevBtn = document.getElementById('mix-prev-page-btn');
                const nextBtn = document.getElementById('mix-next-page-btn');

                if (tableData.length > 0 && mixTableState.totalPages > 1) {
                    infoText.textContent = `Página ${mixTableState.currentPage} de ${mixTableState.totalPages} (Total: ${tableData.length} clientes)`;
                    prevBtn.disabled = mixTableState.currentPage === 1;
                    nextBtn.disabled = mixTableState.currentPage === mixTableState.totalPages;
                    controls.classList.remove('hidden');
                } else {
                    controls.classList.add('hidden');
                }
            }, () => currentRenderId !== mixRenderId);
        }

        async function exportMixPDF() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape');

            const coord = document.getElementById('mix-coord-filter-text')?.textContent || 'Todos';
            const cocoord = document.getElementById('mix-cocoord-filter-text')?.textContent || 'Todos';
            const promotor = document.getElementById('mix-promotor-filter-text')?.textContent || 'Todos';
            const city = document.getElementById('mix-city-filter').value.trim();
            const generationDate = new Date().toLocaleString('pt-BR');

            doc.setFontSize(18);
            doc.text('Relatório de Detalhado - Mix Salty & Foods', 14, 22);
            doc.setFontSize(10);
            doc.setTextColor(10);
            doc.text(`Data de Emissão: ${generationDate}`, 14, 30);
            doc.text(`Filtros: Coordenador: ${coord} | Co-Coordenador: ${cocoord} | Promotor: ${promotor} | Cidade: ${city || 'Todas'}`, 14, 36);

            // Determine dynamic columns
            const saltyCols = MIX_SALTY_CATEGORIES.map(c => c.substring(0, 8)); // Truncate headers
            const foodsCols = MIX_FOODS_CATEGORIES.map(c => c.substring(0, 8));

            const head = [['Cód', 'Cliente', 'Cidade', 'Vendedor', ...saltyCols, ...foodsCols]];

            const body = mixTableDataForExport.map(row => {
                const saltyCells = MIX_SALTY_CATEGORIES.map(b => row.brands.has(b) ? 'OK' : 'X');
                const foodsCells = MIX_FOODS_CATEGORIES.map(b => row.brands.has(b) ? 'OK' : 'X');
                return [
                    row.codcli,
                    row.name,
                    row.city || '',
                    getFirstName(row.vendedor),
                    ...saltyCells,
                    ...foodsCells
                ];
            });

            // Calculate Totals for Footer
            let totalSalty = 0;
            let totalFoods = 0;
            mixTableDataForExport.forEach(row => {
                if(row.hasSalty) totalSalty++;
                if(row.hasFoods) totalFoods++;
            });

            const footerRow = [
                { content: 'TOTAL POSITIVADOS:', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fontSize: 12, textColor: [255, 255, 255], fillColor: [50, 50, 50] } },
                { content: String(totalSalty), colSpan: MIX_SALTY_CATEGORIES.length, styles: { halign: 'center', fontStyle: 'bold', fontSize: 12, textColor: [45, 212, 191], fillColor: [50, 50, 50] } }, // Teal-400
                { content: String(totalFoods), colSpan: MIX_FOODS_CATEGORIES.length, styles: { halign: 'center', fontStyle: 'bold', fontSize: 12, textColor: [250, 204, 21], fillColor: [50, 50, 50] } } // Yellow-400
            ];

            body.push(footerRow);

            doc.autoTable({
                head: head,
                body: body,
                startY: 45,
                theme: 'grid',
                styles: { fontSize: 6, cellPadding: 1, textColor: [0, 0, 0], halign: 'center' },
                headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                columnStyles: {
                    0: { halign: 'left', cellWidth: 15 },
                    1: { halign: 'left', cellWidth: 40 },
                    2: { halign: 'left', cellWidth: 25 },
                    3: { halign: 'left', cellWidth: 20 },
                },
                didParseCell: function(data) {
                    if (data.section === 'body') {
                        // Colorize OK/X cells
                        if (data.cell.raw === 'OK') {
                            data.cell.styles.textColor = [0, 128, 0]; // Stronger Green
                            data.cell.styles.fontStyle = 'bold';
                        }
                        if (data.cell.raw === 'X') {
                            data.cell.styles.textColor = [220, 0, 0]; // Stronger Red
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                }
            });

            const pageCount = doc.internal.getNumberOfPages();
            for(let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(9);
                doc.setTextColor(10);
                doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
            }

            let fileNameParam = 'geral';
            if (hierarchyState['mix'] && hierarchyState['mix'].promotors.size === 1) {
            } else if (city) {
                fileNameParam = city;
            }
            const safeFileNameParam = fileNameParam.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            doc.save(`relatorio_mix_detalhado_${safeFileNameParam}_${new Date().toISOString().slice(0,10)}.pdf`);
        }

        // --- GOALS VIEW LOGIC ---

        // --- GOALS REDISTRIBUTION LOGIC ---
        let goalsSellerTargets = new Map(); // Stores Seller-Level Targets (Positivation, etc.)
        window.goalsSellerTargets = goalsSellerTargets; // Export for init.js

        async function saveGoalsToSupabase() {
            try {
                const monthKey = new Date().toISOString().slice(0, 7);

                // Serialize globalClientGoals (Map<CodCli, Map<Key, {fat: 0, vol: 0}>>)
                const clientsObj = {};
                for (const [clientId, clientMap] of globalClientGoals) {
                    clientsObj[clientId] = Object.fromEntries(clientMap);
                }

                // Serialize goalsSellerTargets (Map<Seller, Targets>)
                const sellerTargetsObj = {};
                for (const [seller, targets] of goalsSellerTargets) {
                    sellerTargetsObj[seller] = targets;
                }

                const payload = {
                    clients: clientsObj,
                    targets: goalsTargets,
                    seller_targets: sellerTargetsObj
                };

                const { error } = await window.supabaseClient
                    .from('goals_distribution')
                    .upsert({
                        month_key: monthKey,
                        supplier: 'ALL',
                        brand: 'GENERAL',
                        goals_data: payload
                    });

                if (error) {
                    console.error('Erro ao salvar metas:', error);
                    alert('Erro ao salvar metas no banco de dados. Verifique o console.');
                    return false;
                }
                console.log('Metas salvas com sucesso.');
                return true;
            } catch (err) {
                console.error('Exceção ao salvar metas:', err);
                alert('Erro inesperado ao salvar metas.');
                return false;
            }
        }

        function distributeSellerGoal(sellerName, categoryId, newTotalValue, metric = 'fat') {
            // metric: 'fat' or 'vol'
            // categoryId: window.SUPPLIER_CODES.ELMA[0], window.SUPPLIER_CODES.VIRTUAL.TODDY, 'tonelada_elma', etc.

            const sellerCode = optimizedData.rcaCodeByName.get(sellerName);
            if (!sellerCode) { console.warn(`[Goals] Seller not found: ${sellerName}`); return; }

            const clients = optimizedData.clientsByRca.get(sellerCode) || [];
            const activeClients = clients.filter(c => {
                const cod = String(c['Código'] || c['codigo_cliente']);
                const rca1 = String(c.rca1 || '').trim();
                const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');
                return (isAmericanas || rca1 !== '53' || clientsWithSalesThisMonth.has(cod));
            });

            if (activeClients.length === 0) return;

            // Define Sub-Categories for Cascade Logic
            let targetCategories = [categoryId];
            if (categoryId === 'tonelada_elma') targetCategories = window.SUPPLIER_CODES.ELMA;
            else if (categoryId === 'tonelada_foods') targetCategories = window.SUPPLIER_CODES.VIRTUAL_LIST;

            // 1. Calculate Total History for the Seller (All sub-cats combined)
            // AND Calculate individual client-subcat history to determine specific shares.
            const clientSubCatHistory = new Map(); // Map<Client, Map<SubCat, Value>>
            let totalSellerHistory = 0;

            activeClients.forEach(client => {
                const codCli = String(client['Código'] || client['codigo_cliente']);
                const historyIds = optimizedData.indices.history.byClient.get(normalizeKey(codCli));

                if (!clientSubCatHistory.has(codCli)) clientSubCatHistory.set(codCli, new Map());
                const subCatMap = clientSubCatHistory.get(codCli);

                if (historyIds) {
                    historyIds.forEach(id => {
                        const sale = optimizedData.historyById.get(id);
                        const codFor = String(sale.CODFOR);
                        const desc = normalize(sale.DESCRICAO || '');

                        // Check against all target categories
                        targetCategories.forEach(subCat => {
                            let isMatch = false;
                            if (subCat === window.SUPPLIER_CODES.ELMA[0] && codFor === window.SUPPLIER_CODES.ELMA[0]) isMatch = true;
                            else if (subCat === window.SUPPLIER_CODES.ELMA[1] && codFor === window.SUPPLIER_CODES.ELMA[1]) isMatch = true;
                            else if (subCat === window.SUPPLIER_CODES.ELMA[2] && codFor === window.SUPPLIER_CODES.ELMA[2]) isMatch = true;
                            else if (codFor === window.SUPPLIER_CODES.FOODS[0]) {
                                if (subCat === window.SUPPLIER_CODES.VIRTUAL.TODDYNHO && desc.includes('TODDYNHO')) isMatch = true;
                                else if (subCat === window.SUPPLIER_CODES.VIRTUAL.TODDY && desc.includes('TODDY')) isMatch = true;
                                else if (subCat === window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO && (desc.includes('QUAKER') || desc.includes('KEROCOCO'))) isMatch = true;
                            }

                            if (isMatch) {
                                const val = metric === 'fat' ? (Number(sale.VLVENDA) || 0) : (Number(sale.TOTPESOLIQ) || 0);
                                if (val > 0) {
                                    subCatMap.set(subCat, (subCatMap.get(subCat) || 0) + val);
                                    totalSellerHistory += val;
                                }
                            }
                        });
                    });
                }
            });

            // 2. Distribute
            // NewGoal(Client, SubCat) = NewTotalValue * (ClientSubCatHistory / TotalSellerHistory)

            const clientCount = activeClients.length;
            const subCatCount = targetCategories.length;

            activeClients.forEach(client => {
                const codCli = String(client['Código'] || client['codigo_cliente']);
                const subCatMap = clientSubCatHistory.get(codCli);

                targetCategories.forEach(subCat => {
                    let share = 0;
                    if (totalSellerHistory > 0) {
                        share = (subCatMap.get(subCat) || 0) / totalSellerHistory;
                    } else {
                        // Fallback: Even split across all clients and subcats?
                        share = 1 / (clientCount * subCatCount);
                    }

                    const goalVal = newTotalValue * share;

                    // Update Global
                    if (!globalClientGoals.has(codCli)) globalClientGoals.set(codCli, new Map());
                    const cGoals = globalClientGoals.get(codCli);

                    if (!cGoals.has(subCat)) cGoals.set(subCat, { fat: 0, vol: 0 });
                    const target = cGoals.get(subCat);

                    if (metric === 'fat') target.fat = goalVal;
                    else if (metric === 'vol') target.vol = goalVal;
                });
            });
            console.log(`[Goals] Distributed ${newTotalValue} (${metric}) for ${sellerName} / ${categoryId} (Cascade: ${targetCategories.join(',')})`);
        }

        function exportGoalsSvXLSX() {
            if (typeof XLSX === 'undefined') {
                window.showToast('error', "Erro: Biblioteca XLSX não carregada. Verifique sua conexão com a internet.");
                return;
            }

            if (!currentGoalsSvData || currentGoalsSvData.length === 0) {
                try { updateGoalsSvView(); } catch (e) { console.error(e); }
                if (!currentGoalsSvData || currentGoalsSvData.length === 0) {
                    window.showToast('warning', "Sem dados para exportar.");
                    return;
                }
            }

            const wb = XLSX.utils.book_new();
            const ws_data = [];

            // Estilos
            const headerStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "0F172A" } }, alignment: { horizontal: "center", vertical: "center" }, border: { bottom: { style: "thin", color: { rgb: "475569" } } } };
            const subHeaderStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1E293B" } }, alignment: { horizontal: "center", vertical: "center" }, border: { bottom: { style: "thin", color: { rgb: "334155" } } } };
            const editableStyle = { fill: { fgColor: { rgb: "FEF9C3" } }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } }; // Light Yellow
            const readOnlyStyle = { fill: { fgColor: { rgb: "F1F5F9" } } }; // Light Slate
            const totalRowStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "334155" } }, border: { top: { style: "thick" } } };
            const grandTotalStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "0F172A" } }, border: { top: { style: "thick" } } };

            // Format Strings
            const fmtMoney = "\"R$ \"#,##0.00";
            const fmtVol = "0.00 \"Kg\"";
            const fmtInt = "0";
            const fmtDec1 = "0.0";

            // Cores de Grupo
            const colorMap = {
                'total_elma': { fgColor: { rgb: "14B8A6" } }, // Teal
                'total_foods': { fgColor: { rgb: "F59E0B" } }, // Amber/Yellow
                'tonelada_elma': { fgColor: { rgb: "F97316" } }, // Orange
                'tonelada_foods': { fgColor: { rgb: "F97316" } },
                'mix_salty': { fgColor: { rgb: "14B8A6" } },
                'mix_foods': { fgColor: { rgb: "F59E0B" } },
                'geral': { fgColor: { rgb: "3B82F6" } }, // Blue
                'pedev': { fgColor: { rgb: "EC4899" } } // Pink
            };

            const createCell = (v, s = {}, z = null) => {
                const cell = { v, t: 'n' };
                if (z) {
                    cell.z = z;
                    cell.s = { ...s, numFmt: z };
                } else {
                    cell.s = s;
                }
                if (typeof v === 'string') cell.t = 's';
                return cell;
            };

            // --- 1. Headers ---
            const row1 = [createCell("CÓD", headerStyle), createCell("VENDEDOR", headerStyle)];
            const merges = [{ s: { r: 0, c: 0 }, e: { r: 2, c: 0 } }, { s: { r: 0, c: 1 }, e: { r: 2, c: 1 } }];
            let colIdx = 2;

            const svColumns = [
                { id: 'total_elma', label: 'TOTAL ELMA', type: 'standard', isAgg: true },
                { id: window.SUPPLIER_CODES.ELMA[0], label: 'EXTRUSADOS', type: 'standard' },
                { id: window.SUPPLIER_CODES.ELMA[1], label: 'NÃO EXTRUSADOS', type: 'standard' },
                { id: window.SUPPLIER_CODES.ELMA[2], label: 'TORCIDA', type: 'standard' },
                { id: 'tonelada_elma', label: 'KG ELMA', type: 'tonnage', isAgg: true },
                { id: 'mix_salty', label: 'MIX SALTY', type: 'mix', isAgg: true },
                { id: 'total_foods', label: 'TOTAL FOODS', type: 'standard', isAgg: true },
                { id: window.SUPPLIER_CODES.VIRTUAL.TODDYNHO, label: 'TODDYNHO', type: 'standard' },
                { id: window.SUPPLIER_CODES.VIRTUAL.TODDY, label: 'TODDY', type: 'standard' },
                { id: window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO, label: 'QUAKER / KEROCOCO', type: 'standard' },
                { id: 'tonelada_foods', label: 'KG FOODS', type: 'tonnage', isAgg: true },
                { id: 'mix_foods', label: 'MIX FOODS', type: 'mix', isAgg: true },
                { id: 'geral', label: 'GERAL', type: 'geral', isAgg: true },
                { id: 'pedev', label: 'AUDITORIA PEDEV', type: 'pedev', isAgg: true }
            ];

            const colMap = {};

            svColumns.forEach(col => {
                colMap[col.id] = colIdx;
                const style = { ...headerStyle };
                if (colorMap[col.id]) style.fill = colorMap[col.id]; // Apply Group Color

                row1.push(createCell(col.label, style));
                let span = 0;
                if (col.type === 'standard') span = 4;
                else if (col.type === 'tonnage' || col.type === 'mix') span = 3;
                else if (col.type === 'geral') span = 4;
                else if (col.type === 'pedev') span = 1;

                merges.push({ s: { r: 0, c: colIdx }, e: { r: 0, c: colIdx + span - 1 } });
                for (let k = 1; k < span; k++) row1.push(createCell("", style));
                colIdx += span;
            });
            ws_data.push(row1);

            // Row 2: Metric Names
            const row2 = [createCell("", headerStyle), createCell("", headerStyle)];
            svColumns.forEach(col => {
                const style = { ...subHeaderStyle, font: { bold: true, color: { rgb: "FFFFFF" } } };
                if (col.type === 'standard') {
                    row2.push(createCell("FATURAMENTO", style), createCell("", style), createCell("POSITIVAÇÃO", style), createCell("", style));
                    merges.push({ s: { r: 1, c: colMap[col.id] }, e: { r: 1, c: colMap[col.id] + 1 } });
                    merges.push({ s: { r: 1, c: colMap[col.id] + 2 }, e: { r: 1, c: colMap[col.id] + 3 } });
                } else if (col.type === 'tonnage') {
                    row2.push(createCell("MÉDIA TRIM.", style), createCell("META KG", style), createCell("", style));
                    merges.push({ s: { r: 1, c: colMap[col.id] + 1 }, e: { r: 1, c: colMap[col.id] + 2 } });
                } else if (col.type === 'mix') {
                    row2.push(createCell("MÉDIA TRIM.", style), createCell("META MIX", style), createCell("", style));
                    merges.push({ s: { r: 1, c: colMap[col.id] + 1 }, e: { r: 1, c: colMap[col.id] + 2 } });
                } else if (col.type === 'geral') {
                    row2.push(createCell("FATURAMENTO", style), createCell("", style), createCell("TONELADA", style), createCell("POSITIVAÇÃO", style));
                    merges.push({ s: { r: 1, c: colMap[col.id] }, e: { r: 1, c: colMap[col.id] + 1 } });
                } else {
                    row2.push(createCell("META", style));
                }
            });
            ws_data.push(row2);

            // Row 3: Subtitles
            const row3 = [createCell("", subHeaderStyle), createCell("", subHeaderStyle)];
            svColumns.forEach(col => {
                if (col.type === 'standard') {
                    row3.push(createCell("Meta", subHeaderStyle), createCell("Ajuste", subHeaderStyle), createCell("Meta", subHeaderStyle), createCell("Ajuste", subHeaderStyle));
                } else if (col.type === 'tonnage') {
                    row3.push(createCell("Volume", subHeaderStyle), createCell("Volume", subHeaderStyle), createCell("Ajuste", subHeaderStyle));
                } else if (col.type === 'mix') {
                    row3.push(createCell("Qtd", subHeaderStyle), createCell("Meta", subHeaderStyle), createCell("Ajuste", subHeaderStyle));
                } else if (col.type === 'geral') {
                    row3.push(createCell("Média Trim.", subHeaderStyle), createCell("Meta", subHeaderStyle), createCell("Meta", subHeaderStyle), createCell("Meta", subHeaderStyle));
                } else {
                    row3.push(createCell("", subHeaderStyle));
                }
            });
            ws_data.push(row3);

            // --- 2. Data Rows ---
            let currentRow = 3;
            const colCellsForGrandTotal = {};
            svColumns.forEach(c => colCellsForGrandTotal[c.id] = { fat: [], pos: [], vol: [], mix: [], avg: [], metaFat: [], ajusteFat: [], metaPos: [], ajustePos: [] });

            currentGoalsSvData.forEach(sup => {
                const sellers = sup.sellers;
                const colCellsForSupTotal = {};
                svColumns.forEach(c => colCellsForSupTotal[c.id] = { fat: [], pos: [], vol: [], mix: [], avg: [], metaFat: [], ajusteFat: [], metaPos: [], ajustePos: [] });

                sellers.forEach(seller => {
                    const rowData = [createCell(seller.code), createCell(seller.name)];

                    svColumns.forEach(col => {
                        const d = seller.data[col.id] || { metaFat: 0, metaVol: 0, metaPos: 0, avgVol: 0, avgMix: 0, metaMix: 0, avgFat: 0 };
                        const cIdx = colMap[col.id];
                        const excelRow = currentRow + 1;
                        const getColLet = (idx) => XLSX.utils.encode_col(idx);

                        // Highlight Logic
                        const isEditable = !col.isAgg; // Base columns are editable (Yellow)
                        const cellStyle = isEditable ? editableStyle : readOnlyStyle;
                        const aggCellStyle = readOnlyStyle; // Aggregated columns (Light Grey)

                        if (col.type === 'standard') {
                            rowData.push(createCell(d.metaFat, readOnlyStyle, fmtMoney));

                            // Formula for Aggregate Logic
                            if (col.id === 'total_elma' || col.id === 'total_foods') {
                                const ids = col.id === 'total_elma' ? window.SUPPLIER_CODES.ELMA : window.SUPPLIER_CODES.VIRTUAL_LIST;
                                const compCols = ids.map(id => colMap[id] + 1);
                                const compColsPos = ids.map(id => colMap[id] + 3);
                                const formulaFat = compCols.map(c => `${getColLet(c)}${excelRow}`).join("+");

                                rowData.push({ t: 'n', v: d.metaFat, f: formulaFat, s: { ...aggCellStyle, numFmt: fmtMoney }, z: fmtMoney });
                                rowData.push(createCell(d.metaPos, readOnlyStyle, fmtInt));

                                // Positivation (Aggregate): Use Stored Target
                                let posVal = d.metaPos;
                                if (goalsSellerTargets.has(seller.name)) {
                                    const t = goalsSellerTargets.get(seller.name);
                                    if (t && t[col.id] !== undefined) posVal = t[col.id];
                                }
                                // Make Editable (cellStyle instead of aggCellStyle)
                                rowData.push(createCell(posVal, editableStyle, fmtInt));
                            } else {
                                // Editable Cells
                                rowData.push(createCell(d.metaFat, cellStyle, fmtMoney));
                                rowData.push(createCell(d.metaPos, readOnlyStyle, fmtInt));

                                // Positivation (Standard): Use Stored Target
                                let posVal = d.metaPos;
                                if (goalsSellerTargets.has(seller.name)) {
                                    const t = goalsSellerTargets.get(seller.name);
                                    if (t && t[col.id] !== undefined) posVal = t[col.id];
                                }
                                rowData.push(createCell(posVal, cellStyle, fmtInt));
                            }

                            colCellsForSupTotal[col.id].metaFat.push(`${getColLet(cIdx)}${excelRow}`);
                            colCellsForSupTotal[col.id].ajusteFat.push(`${getColLet(cIdx + 1)}${excelRow}`);
                            colCellsForSupTotal[col.id].metaPos.push(`${getColLet(cIdx + 2)}${excelRow}`);
                            colCellsForSupTotal[col.id].ajustePos.push(`${getColLet(cIdx + 3)}${excelRow}`);

                        } else if (col.type === 'tonnage') {
                            rowData.push(createCell(d.avgVol, readOnlyStyle, fmtVol));
                            rowData.push(createCell(d.metaVol, readOnlyStyle, fmtVol));
                            rowData.push(createCell(d.metaVol, isEditable ? cellStyle : aggCellStyle, fmtVol));
                            colCellsForSupTotal[col.id].vol.push(`${getColLet(cIdx + 2)}${excelRow}`);
                            colCellsForSupTotal[col.id].avg.push(`${getColLet(cIdx)}${excelRow}`);

                        } else if (col.type === 'mix') {
                            rowData.push(createCell(d.avgMix, readOnlyStyle, fmtDec1));
                            rowData.push(createCell(d.metaMix, readOnlyStyle, fmtInt));
                            rowData.push(createCell(d.metaMix, isEditable ? cellStyle : aggCellStyle, fmtInt));
                            colCellsForSupTotal[col.id].mix.push(`${getColLet(cIdx + 2)}${excelRow}`);
                            colCellsForSupTotal[col.id].avg.push(`${getColLet(cIdx)}${excelRow}`);

                        } else if (col.type === 'geral') {
                            const elmaIdx = colMap['total_elma'];
                            const foodsIdx = colMap['total_foods'];
                            const elmaTonIdx = colMap['tonelada_elma'];
                            const foodsTonIdx = colMap['tonelada_foods'];

                            const fFat = `${getColLet(elmaIdx + 1)}${excelRow}+${getColLet(foodsIdx + 1)}${excelRow}`;
                            const fTon = `${getColLet(elmaTonIdx + 2)}${excelRow}+${getColLet(foodsTonIdx + 2)}${excelRow}`;

                            // REMOVED Formula for Positivation. Used static value instead.
                            // const fPos = `${getColLet(elmaIdx + 3)}${excelRow}+${getColLet(foodsIdx + 3)}${excelRow}`;

                            rowData.push(createCell(d.avgFat, readOnlyStyle, fmtMoney));
                            rowData.push({ t: 'n', v: d.metaFat, f: fFat, s: { ...aggCellStyle, numFmt: fmtMoney }, z: fmtMoney });
                            rowData.push({ t: 'n', v: d.metaVol, f: fTon, s: { ...aggCellStyle, numFmt: fmtVol }, z: fmtVol });
                            // Use static adjusted value for Positivation (PEPSICO_ALL)
                            let posVal = d.metaPos;
                            if (goalsSellerTargets.has(seller.name)) {
                                const t = goalsSellerTargets.get(seller.name);
                                if (t && t['GERAL'] !== undefined) posVal = t['GERAL'];
                            }
                            rowData.push(createCell(posVal, editableStyle, fmtInt));

                            colCellsForSupTotal[col.id].fat.push(`${getColLet(cIdx + 1)}${excelRow}`);
                            colCellsForSupTotal[col.id].vol.push(`${getColLet(cIdx + 2)}${excelRow}`);
                            colCellsForSupTotal[col.id].pos.push(`${getColLet(cIdx + 3)}${excelRow}`);
                            colCellsForSupTotal[col.id].avg.push(`${getColLet(cIdx)}${excelRow}`);

                        } else if (col.type === 'pedev') {
                            const elmaIdx = colMap['total_elma'];
                            const fPedev = `ROUND(${getColLet(elmaIdx + 3)}${excelRow}*0.9, 0)`;
                            rowData.push({ t: 'n', v: d.metaPos, f: fPedev, s: { ...aggCellStyle, numFmt: fmtInt }, z: fmtInt });
                            colCellsForSupTotal[col.id].pos.push(`${getColLet(cIdx)}${excelRow}`);
                        }
                    });
                    ws_data.push(rowData);
                    currentRow++;
                });

                // Supervisor Total Row
                const supRowData = [createCell(sup.code, totalRowStyle), createCell(sup.name.toUpperCase(), totalRowStyle)];
                const excelSupRow = currentRow + 1;

                svColumns.forEach(col => {
                    const cIdx = colMap[col.id];
                    const getColLet = (idx) => XLSX.utils.encode_col(idx);

                    if (col.type === 'standard') {
                        // 1. Meta Fat Total
                        const rangeMetaFat = colCellsForSupTotal[col.id].metaFat;
                        const fMetaFat = rangeMetaFat.length > 0 ? `SUM(${rangeMetaFat[0]}:${rangeMetaFat[rangeMetaFat.length-1]})` : "0";
                        supRowData.push({ t: 'n', v: 0, f: fMetaFat, s: { ...totalRowStyle, numFmt: fmtMoney }, z: fmtMoney });

                        // 2. Ajuste Fat Total
                        const rangeAjusteFat = colCellsForSupTotal[col.id].ajusteFat;
                        const fAjusteFat = rangeAjusteFat.length > 0 ? `SUM(${rangeAjusteFat[0]}:${rangeAjusteFat[rangeAjusteFat.length-1]})` : "0";
                        supRowData.push({ t: 'n', v: 0, f: fAjusteFat, s: { ...totalRowStyle, numFmt: fmtMoney }, z: fmtMoney });

                        // 3. Meta Pos Total
                        const rangeMetaPos = colCellsForSupTotal[col.id].metaPos;
                        const fMetaPos = rangeMetaPos.length > 0 ? `SUM(${rangeMetaPos[0]}:${rangeMetaPos[rangeMetaPos.length-1]})` : "0";
                        supRowData.push({ t: 'n', v: 0, f: fMetaPos, s: { ...totalRowStyle, numFmt: fmtInt }, z: fmtInt });

                        // 4. Ajuste Pos Total
                        const rangeAjustePos = colCellsForSupTotal[col.id].ajustePos;
                        const fAjustePos = rangeAjustePos.length > 0 ? `SUM(${rangeAjustePos[0]}:${rangeAjustePos[rangeAjustePos.length-1]})` : "0";
                        supRowData.push({ t: 'n', v: 0, f: fAjustePos, s: { ...totalRowStyle, numFmt: fmtInt }, z: fmtInt });

                        // Push to Grand Total Arrays
                        colCellsForGrandTotal[col.id].metaFat.push(`${getColLet(cIdx)}${excelSupRow}`);
                        colCellsForGrandTotal[col.id].ajusteFat.push(`${getColLet(cIdx+1)}${excelSupRow}`);
                        colCellsForGrandTotal[col.id].metaPos.push(`${getColLet(cIdx+2)}${excelSupRow}`);
                        colCellsForGrandTotal[col.id].ajustePos.push(`${getColLet(cIdx+3)}${excelSupRow}`);

                    } else if (col.type === 'tonnage') {
                        const rangeAvg = colCellsForSupTotal[col.id].avg;
                        const fAvgRange = rangeAvg.length > 0 ? `SUM(${rangeAvg[0]}:${rangeAvg[rangeAvg.length-1]})` : "0";
                        supRowData.push({ t: 'n', v: 0, f: fAvgRange, s: { ...totalRowStyle, numFmt: fmtVol }, z: fmtVol });

                        const rangeVol = colCellsForSupTotal[col.id].vol;
                        const fVolRange = rangeVol.length > 0 ? `SUM(${rangeVol[0]}:${rangeVol[rangeVol.length-1]})` : "0";
                        supRowData.push({ t: 'n', v: 0, f: fVolRange, s: { ...totalRowStyle, numFmt: fmtVol }, z: fmtVol });
                        supRowData.push({ t: 'n', v: 0, f: fVolRange, s: { ...totalRowStyle, numFmt: fmtVol }, z: fmtVol });

                        colCellsForGrandTotal[col.id].vol.push(`${getColLet(cIdx+2)}${excelSupRow}`);
                        colCellsForGrandTotal[col.id].avg.push(`${getColLet(cIdx)}${excelSupRow}`);

                    } else if (col.type === 'mix') {
                        const rangeAvg = colCellsForSupTotal[col.id].avg;
                        const fAvgRange = rangeAvg.length > 0 ? `SUM(${rangeAvg[0]}:${rangeAvg[rangeAvg.length-1]})` : "0";
                        supRowData.push({ t: 'n', v: 0, f: fAvgRange, s: { ...totalRowStyle, numFmt: fmtDec1 }, z: fmtDec1 });

                        const rangeMix = colCellsForSupTotal[col.id].mix;
                        const fMixRange = rangeMix.length > 0 ? `SUM(${rangeMix[0]}:${rangeMix[rangeMix.length-1]})` : "0";
                        supRowData.push({ t: 'n', v: 0, f: fMixRange, s: { ...totalRowStyle, numFmt: fmtInt }, z: fmtInt });
                        supRowData.push({ t: 'n', v: 0, f: fMixRange, s: { ...totalRowStyle, numFmt: fmtInt }, z: fmtInt });

                        colCellsForGrandTotal[col.id].mix.push(`${getColLet(cIdx+2)}${excelSupRow}`);
                        colCellsForGrandTotal[col.id].avg.push(`${getColLet(cIdx)}${excelSupRow}`);

                    } else if (col.type === 'geral') {
                        const rangeAvg = colCellsForSupTotal[col.id].avg;
                        const fAvgRange = rangeAvg.length > 0 ? `SUM(${rangeAvg[0]}:${rangeAvg[rangeAvg.length-1]})` : "0";
                        supRowData.push({ t: 'n', v: 0, f: fAvgRange, s: { ...totalRowStyle, numFmt: fmtMoney }, z: fmtMoney });

                        const rangeFat = colCellsForSupTotal[col.id].fat;
                        const fFatRange = rangeFat.length > 0 ? `SUM(${rangeFat[0]}:${rangeFat[rangeFat.length-1]})` : "0";
                        supRowData.push({ t: 'n', v: 0, f: fFatRange, s: { ...totalRowStyle, numFmt: fmtMoney }, z: fmtMoney });

                        const rangeVol = colCellsForSupTotal[col.id].vol;
                        const fVolRange = rangeVol.length > 0 ? `SUM(${rangeVol[0]}:${rangeVol[rangeVol.length-1]})` : "0";
                        supRowData.push({ t: 'n', v: 0, f: fVolRange, s: { ...totalRowStyle, numFmt: fmtVol }, z: fmtVol });

                        const rangePos = colCellsForSupTotal[col.id].pos;
                        const fPosRange = rangePos.length > 0 ? `SUM(${rangePos[0]}:${rangePos[rangePos.length-1]})` : "0";
                        supRowData.push({ t: 'n', v: 0, f: fPosRange, s: { ...totalRowStyle, numFmt: fmtInt }, z: fmtInt });

                        colCellsForGrandTotal[col.id].fat.push(`${getColLet(cIdx+1)}${excelSupRow}`);
                        colCellsForGrandTotal[col.id].vol.push(`${getColLet(cIdx+2)}${excelSupRow}`);
                        colCellsForGrandTotal[col.id].pos.push(`${getColLet(cIdx+3)}${excelSupRow}`);
                        colCellsForGrandTotal[col.id].avg.push(`${getColLet(cIdx)}${excelSupRow}`);

                    } else if (col.type === 'pedev') {
                        const elmaIdx = colMap['total_elma'];
                        const fPedev = `ROUND(${getColLet(elmaIdx + 3)}${excelSupRow}*0.9, 0)`;
                        supRowData.push({ t: 'n', v: 0, f: fPedev, s: { ...totalRowStyle, numFmt: fmtInt }, z: fmtInt });
                        colCellsForGrandTotal[col.id].pos.push(`${getColLet(cIdx)}${excelSupRow}`);
                    }
                });

                ws_data.push(supRowData);
                currentRow++;
            });

            // Grand Total Row
            const grandRowData = [createCell("GV", grandTotalStyle), createCell("GERAL PRIME", grandTotalStyle)];
            svColumns.forEach(col => {
                if (col.type === 'standard') {
                    // 1. Meta Fat Grand Total
                    const rangeMetaFat = colCellsForGrandTotal[col.id].metaFat;
                    const fMetaFat = rangeMetaFat.length > 0 ? rangeMetaFat.join("+") : "0";
                    grandRowData.push({ t: 'n', v: 0, f: fMetaFat, s: { ...grandTotalStyle, numFmt: fmtMoney }, z: fmtMoney });

                    // 2. Ajuste Fat Grand Total
                    const rangeAjusteFat = colCellsForGrandTotal[col.id].ajusteFat;
                    const fAjusteFat = rangeAjusteFat.length > 0 ? rangeAjusteFat.join("+") : "0";
                    grandRowData.push({ t: 'n', v: 0, f: fAjusteFat, s: { ...grandTotalStyle, numFmt: fmtMoney }, z: fmtMoney });

                    // 3. Meta Pos Grand Total
                    const rangeMetaPos = colCellsForGrandTotal[col.id].metaPos;
                    const fMetaPos = rangeMetaPos.length > 0 ? rangeMetaPos.join("+") : "0";
                    grandRowData.push({ t: 'n', v: 0, f: fMetaPos, s: { ...grandTotalStyle, numFmt: fmtInt }, z: fmtInt });

                    // 4. Ajuste Pos Grand Total
                    const rangeAjustePos = colCellsForGrandTotal[col.id].ajustePos;
                    const fAjustePos = rangeAjustePos.length > 0 ? rangeAjustePos.join("+") : "0";
                    grandRowData.push({ t: 'n', v: 0, f: fAjustePos, s: { ...grandTotalStyle, numFmt: fmtInt }, z: fmtInt });

                } else if (col.type === 'tonnage') {
                    const rangeAvg = colCellsForGrandTotal[col.id].avg;
                    const fAvg = rangeAvg.length > 0 ? rangeAvg.join("+") : "0";
                    grandRowData.push({ t: 'n', v: 0, f: fAvg, s: { ...grandTotalStyle, numFmt: fmtVol }, z: fmtVol });

                    const rangeVol = colCellsForGrandTotal[col.id].vol;
                    const fVol = rangeVol.length > 0 ? rangeVol.join("+") : "0";
                    grandRowData.push({ t: 'n', v: 0, f: fVol, s: { ...grandTotalStyle, numFmt: fmtVol }, z: fmtVol });
                    grandRowData.push({ t: 'n', v: 0, f: fVol, s: { ...grandTotalStyle, numFmt: fmtVol }, z: fmtVol });

                } else if (col.type === 'mix') {
                    const rangeAvg = colCellsForGrandTotal[col.id].avg;
                    const fAvg = rangeAvg.length > 0 ? rangeAvg.join("+") : "0";
                    grandRowData.push({ t: 'n', v: 0, f: fAvg, s: { ...grandTotalStyle, numFmt: fmtDec1 }, z: fmtDec1 });

                    const rangeMix = colCellsForGrandTotal[col.id].mix;
                    const fMix = rangeMix.length > 0 ? rangeMix.join("+") : "0";
                    grandRowData.push({ t: 'n', v: 0, f: fMix, s: { ...grandTotalStyle, numFmt: fmtInt }, z: fmtInt });
                    grandRowData.push({ t: 'n', v: 0, f: fMix, s: { ...grandTotalStyle, numFmt: fmtInt }, z: fmtInt });

                } else if (col.type === 'geral') {
                    const rangeAvg = colCellsForGrandTotal[col.id].avg;
                    const fAvg = rangeAvg.length > 0 ? rangeAvg.join("+") : "0";
                    grandRowData.push({ t: 'n', v: 0, f: fAvg, s: { ...grandTotalStyle, numFmt: fmtMoney }, z: fmtMoney });

                    const rangeFat = colCellsForGrandTotal[col.id].fat;
                    const fFat = rangeFat.length > 0 ? rangeFat.join("+") : "0";
                    grandRowData.push({ t: 'n', v: 0, f: fFat, s: { ...grandTotalStyle, numFmt: fmtMoney }, z: fmtMoney });

                    const rangeVol = colCellsForGrandTotal[col.id].vol;
                    const fVol = rangeVol.length > 0 ? rangeVol.join("+") : "0";
                    grandRowData.push({ t: 'n', v: 0, f: fVol, s: { ...grandTotalStyle, numFmt: fmtVol }, z: fmtVol });

                    const rangePos = colCellsForGrandTotal[col.id].pos;
                    const fPos = rangePos.length > 0 ? rangePos.join("+") : "0";
                    grandRowData.push({ t: 'n', v: 0, f: fPos, s: { ...grandTotalStyle, numFmt: fmtInt }, z: fmtInt });

                } else if (col.type === 'pedev') {
                    const rangePos = colCellsForGrandTotal[col.id].pos;
                    const fPos = rangePos.length > 0 ? rangePos.join("+") : "0";
                    grandRowData.push({ t: 'n', v: 0, f: fPos, s: { ...grandTotalStyle, numFmt: fmtInt }, z: fmtInt });
                }
            });
            ws_data.push(grandRowData);

            // Create Sheet
            const ws = XLSX.utils.aoa_to_sheet(ws_data);
            ws['!merges'] = merges;

            // Auto-width
            const wscols = [{ wch: 10 }, { wch: 20 }];
            for(let i = 2; i < 50; i++) wscols.push({ wch: 12 });
            ws['!cols'] = wscols;

            // Add Sheet to Workbook
            XLSX.utils.book_append_sheet(wb, ws, "Metas SV");
            XLSX.writeFile(wb, "Metas_Fechamento_SV.xlsx");
        }

        function isActiveClient(c) {
            const rca1 = String(c.rca1 || '').trim();
            const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');
            if (isAmericanas) return true;
            // STRICT FILTER: Exclude RCA 53 (Balcão) and INATIVOS
            if (rca1 === '53') return false;
            if (rca1 === '') return false; // Exclude INATIVOS
            return true;
        }

        function getGoalsFilteredData() {
            const codCli = goalsGvCodcliFilter.value.trim();

            // Apply Hierarchy Filter + "Active" Filter logic
            let clients = getHierarchyFilteredClients('goals-gv', allClientsData).filter(c => isActiveClient(c));

            // Filter by Client Code
            if (codCli) {
                clients = clients.filter(c => String(c['Código']) === codCli);
            }

            return clients;
        }

        function getHistoricalMix(sellerName, type) {
            const sellerCode = optimizedData.rcaCodeByName.get(sellerName);
            if (!sellerCode) return 0;

            const clients = optimizedData.clientsByRca.get(sellerCode) || [];
            // Filter active clients same as main view
            const activeClients = clients.filter(c => {
                const cod = String(c['Código'] || c['codigo_cliente']);
                const rca1 = String(c.rca1 || '').trim();
                const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');
                return (isAmericanas || rca1 !== '53' || clientsWithSalesThisMonth.has(cod));
            });

            // Iterate Active Clients
            let totalMixMonths = 0;
            const targetCategories = type === 'salty' ? MIX_SALTY_CATEGORIES : MIX_FOODS_CATEGORIES;

            activeClients.forEach(client => {
                const codCli = String(client['Código'] || client['codigo_cliente']);
                const historyIds = optimizedData.indices.history.byClient.get(normalizeKey(codCli));

                if (historyIds) {
                    // Bucket by Month
                    const monthlySales = new Map(); // Map<MonthKey, Set<Brand>>

                    historyIds.forEach(id => {
                        const sale = optimizedData.historyById.get(id);
                        // Using same date parsing as elsewhere
                        let dateObj = null;
                        if (typeof sale.DTPED === 'number') dateObj = new Date(sale.DTPED);
                        else dateObj = parseDate(sale.DTPED);

                        if (dateObj) {
                            const monthKey = `${dateObj.getUTCFullYear()}-${dateObj.getUTCMonth()}`;
                            if (!monthlySales.has(monthKey)) monthlySales.set(monthKey, new Set());

                            // Check brand/category match
                            const desc = normalize(sale.DESCRICAO || '');
                            targetCategories.forEach(cat => {
                                if (desc.includes(cat)) {
                                    monthlySales.get(monthKey).add(cat);
                                }
                            });
                        }
                    });

                    // Count Successful Months
                    monthlySales.forEach(brandsSet => {
                        const achieved = targetCategories.every(cat => brandsSet.has(cat));
                        if (achieved) totalMixMonths++;
                    });
                }
            });

            // Return Average (Total Mix Months / 3)
            // Assuming Quarter History is 3 months.
            return totalMixMonths / 3;
        }

        function parseInputMoney(id) {
            const el = document.getElementById(id);
            if (!el) return 0;
            let val = el.value.replace(/\./g, '').replace(',', '.');
            return parseFloat(val) || 0;
        }

        function getMonthWeeksDistribution(date) {
            const year = date.getUTCFullYear();
            const month = date.getUTCMonth();

            // Start of Month
            const startDate = new Date(Date.UTC(year, month, 1));
            // End of Month
            const endDate = new Date(Date.UTC(year, month + 1, 0));
            const totalDays = endDate.getUTCDate();

            let currentWeekStart = new Date(startDate);
            const weeks = [];
            let totalWorkingDays = 0;

            // Loop through weeks
            while (currentWeekStart <= endDate) {
                // Get end of this week (Sunday or End of Month)
                // getUTCDay: 0 (Sun) to 6 (Sat).
                // We want weeks to be Calendar Weeks (Mon-Sun or Sun-Sat).
                // Standard: ISO weeks start on Monday. But JS getDay 0 is Sunday.
                // Let's assume standard calendar week view where Sunday breaks the week.
                // However, user said "reconhecer as semanas pelo calendário... De segunda a sexta".
                // Let's define week chunks.
                // Logic: A week ends on Saturday (or Sunday).

                // Find next Sunday (or End of Month)
                let dayOfWeek = currentWeekStart.getUTCDay(); // 0=Sun, 1=Mon...
                let daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

                let currentWeekEnd = new Date(currentWeekStart);
                currentWeekEnd.setUTCDate(currentWeekStart.getUTCDate() + daysToSunday);

                if (currentWeekEnd > endDate) currentWeekEnd = new Date(endDate);

                // Count Working Days in this chunk
                let workingDaysInWeek = 0;
                let tempDate = new Date(currentWeekStart);
                while (tempDate <= currentWeekEnd) {
                    const dow = tempDate.getUTCDay();
                    if (dow >= 1 && dow <= 5) {
                        workingDaysInWeek++;
                        totalWorkingDays++;
                    }
                    tempDate.setUTCDate(tempDate.getUTCDate() + 1);
                }

                if (workingDaysInWeek > 0 || weeks.length === 0 || currentWeekStart <= endDate) {
                     // Only push if valid week or just start
                     weeks.push({
                         start: new Date(currentWeekStart),
                         end: new Date(currentWeekEnd),
                         workingDays: workingDaysInWeek
                     });
                }

                // Next week starts day after currentWeekEnd
                currentWeekStart = new Date(currentWeekEnd);
                currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() + 1);
            }

            return { weeks, totalWorkingDays };
        }

        function getMetaRealizadoFilteredData() {
            // New Hierarchy:
            const suppliersSet = new Set(selectedMetaRealizadoSuppliers);
            const pasta = currentMetaRealizadoPasta;

            const supervisorsSet = new Set();
            const sellersSet = new Set();

            const hState = hierarchyState['meta-realizado'];
            if (hState) {
                const validCodes = new Set();

                // 1. Promotors (Leaf)
                if (hState.promotors.size > 0) {
                    hState.promotors.forEach(p => validCodes.add(p));
                }
                // 2. CoCoords
                else if (hState.cocoords.size > 0) {
                     hState.cocoords.forEach(cc => {
                         const children = optimizedData.promotorsByCocoord.get(cc);
                         if (children) children.forEach(p => validCodes.add(p));
                     });
                }
                // 3. Coords
                else if (hState.coords.size > 0) {
                    hState.coords.forEach(c => {
                         const cocoords = optimizedData.cocoordsByCoord.get(c);
                         if (cocoords) {
                             cocoords.forEach(cc => {
                                 const children = optimizedData.promotorsByCocoord.get(cc);
                                 if (children) children.forEach(p => validCodes.add(p));
                             });
                         }
                    });
                }

                // Map Codes to Names
                if (validCodes.size > 0) {
                    validCodes.forEach(code => {
                        const name = optimizedData.promotorMap.get(code);
                        if (name) sellersSet.add(name);
                         // Also try mapping via rcaNameByCode if the code is RCA code (fallback)
                        const rcaName = optimizedData.rcaNameByCode.get(code);
                        if (rcaName) sellersSet.add(rcaName);
                    });
                }
            }

            // Determine Goal Keys based on Pasta (Moved to top level scope)
            let goalKeys = [];

            // If Supplier Filter is Active, restricting goals to selected supplier ONLY
            if (suppliersSet.size > 0) {
                // Map selections to goal keys
                suppliersSet.forEach(sup => {
                    // Filter validation: Ensure they belong to current Pasta
                    let valid = false;
                    if (pasta === 'PEPSICO') valid = true;
                    else if (pasta === 'ELMA') valid = window.SUPPLIER_CODES.ELMA.includes(sup);
                    else if (pasta === 'FOODS') valid = window.SUPPLIER_CODES.VIRTUAL_LIST.includes(sup) || sup === window.SUPPLIER_CODES.FOODS[0];

                    if (valid) {
                        if (sup === window.SUPPLIER_CODES.FOODS[0]) {
                            goalKeys.push(window.SUPPLIER_CODES.VIRTUAL.TODDYNHO, window.SUPPLIER_CODES.VIRTUAL.TODDY, window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO);
                        } else {
                            goalKeys.push(sup);
                        }
                    }
                });
            } else {
                // Default Pasta Groups
                if (pasta === 'PEPSICO') {
                    goalKeys = window.SUPPLIER_CODES.ALL_GOALS;
                } else if (pasta === 'ELMA') {
                    goalKeys = window.SUPPLIER_CODES.ELMA;
                } else if (pasta === 'FOODS') {
                    goalKeys = window.SUPPLIER_CODES.VIRTUAL_LIST;
                }
            }

            // 1. Clients Filter
            // Apply Hierarchy Logic + "Active" Filter logic
            let clients = getHierarchyFilteredClients('meta-realizado', allClientsData).filter(c => {
                const rca1 = String(c.rca1 || '').trim();
                const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');
                // Same active logic as Goals
                if (isAmericanas) return true;
                if (rca1 === '53') return false;
                if (rca1 === '') return false;
                return true;
            });

            // Implement Supplier Filter Logic (Virtual IDs for Foods) - Step 7
            // Goals are derived from `globalClientGoals` and manual overrides.
            // To ensure consistency, both the base client list and the goal calculation must respect all active filters.

            const filteredClientCodes = new Set(clients.map(c => String(c['Código'] || c['codigo_cliente'])));

            // 2. Goals Aggregation (By Seller)
            // Structure: Map<SellerName, TotalGoal>
            // 2. Goals Aggregation (By Seller)
            // Structure: Map<SellerName, { totalFat: 0, totalVol: 0, totalPos: 0 }>
            const goalsBySeller = new Map();

            clients.forEach(client => {
                const codCli = String(client['Código'] || client['codigo_cliente']);
                const rcaCode = String(client.rca1 || '');
                const rcaName = optimizedData.rcaNameByCode.get(rcaCode) || rcaCode; // Map code to name for grouping

                // Filtering "Garbage" Sellers to fix Total Positivação (1965 vs 1977)
                if (isGarbageSeller(rcaName)) return;

                // Goal Keys are now determined at function scope (hoisted)

                if (globalClientGoals.has(codCli)) {
                    const clientGoals = globalClientGoals.get(codCli);
                    let clientTotalFatGoal = 0;
                    let clientTotalVolGoal = 0;
                    let hasGoal = false;

                    goalKeys.forEach(k => {
                        if (clientGoals.has(k)) {
                            const g = clientGoals.get(k);
                            clientTotalFatGoal += (g.fat || 0);
                            clientTotalVolGoal += (g.vol || 0);
                            if ((g.fat || 0) > 0) hasGoal = true;
                        }
                    });

                    if (!goalsBySeller.has(rcaName)) {
                        goalsBySeller.set(rcaName, { totalFat: 0, totalVol: 0, totalPos: 0 });
                    }
                    const sellerGoals = goalsBySeller.get(rcaName);

                    if (clientTotalFatGoal > 0) sellerGoals.totalFat += clientTotalFatGoal;
                    if (clientTotalVolGoal > 0) sellerGoals.totalVol += clientTotalVolGoal;
                    if (hasGoal) sellerGoals.totalPos += 1; // Count client as 1 target
                }
            });

            // Apply Positivation Overrides from goalsSellerTargets (Imported Absolute Values)
            // Apply Overrides from goalsSellerTargets (Imported Absolute Values for Pos, Fat, Vol)

            // --- FIX: Ensure all sellers with Manual Targets are present in goalsBySeller ---
            goalsSellerTargets.forEach((targets, sellerName) => {
                // Add to map if missing
                if (!goalsBySeller.has(sellerName)) {
                    goalsBySeller.set(sellerName, { totalFat: 0, totalVol: 0, totalPos: 0 });
                }
            });
            // ---------------------------------------------------------------------------------

            goalsBySeller.forEach((goals, sellerName) => {
                const targets = goalsSellerTargets.get(sellerName);
                if (targets) {
                    // 1. Positivação Overrides
                    let overrideKey = null;

                    // Improved Override Logic: Only apply aggregate pasta targets if NO specific supplier filter is active,
                    // or if all suppliers of that pasta are selected.
                    const elmaKeys = window.SUPPLIER_CODES.ELMA;
                    const foodsKeys = window.SUPPLIER_CODES.VIRTUAL_LIST;
                    const allElmaSelected = elmaKeys.every(k => goalKeys.includes(k));
                    const allFoodsSelected = foodsKeys.every(k => goalKeys.includes(k));

                    if (suppliersSet.size === 0) {
                        if (pasta === 'PEPSICO') {
                            overrideKey = targets['pepsico_all'] !== undefined ? 'pepsico_all' : 'GERAL';
                        } else if (pasta === 'ELMA') {
                            overrideKey = 'total_elma';
                        } else if (pasta === 'FOODS') {
                            overrideKey = 'total_foods';
                        }
                    } else if (suppliersSet.size === 1) {
                        const sup = [...suppliersSet][0];
                        if (sup === window.SUPPLIER_CODES.VIRTUAL.TODDYNHO) overrideKey = window.SUPPLIER_CODES.VIRTUAL.TODDYNHO;
                        else if (sup === window.SUPPLIER_CODES.VIRTUAL.TODDY) overrideKey = window.SUPPLIER_CODES.VIRTUAL.TODDY;
                        else if (sup === '1119_QUAKER' || sup === window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO) overrideKey = window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO;
                        else if (sup === window.SUPPLIER_CODES.FOODS[0]) {
                             if (allFoodsSelected) overrideKey = 'total_foods';
                        }
                        else overrideKey = sup;
                    } else {
                        // Multiple suppliers selected - Only use aggregate if it matches the selection
                        if (pasta === 'ELMA' && allElmaSelected) {
                            overrideKey = 'total_elma';
                        } else if (pasta === 'FOODS' && allFoodsSelected) {
                            overrideKey = 'total_foods';
                        } else if (pasta === 'PEPSICO' && allElmaSelected && allFoodsSelected) {
                            overrideKey = targets['pepsico_all'] !== undefined ? 'pepsico_all' : 'GERAL';
                        }
                    }

                    if (overrideKey && targets[overrideKey] !== undefined) {
                        goals.totalPos = targets[overrideKey];
                    }

                    // 2. Revenue (FAT) and Volume (VOL) Overrides
                    let overrideFat = 0;
                    let overrideVol = 0;
                    let hasOverrideFat = false;
                    let hasOverrideVol = false;

                    // Strategy:
                    // 1. Sum individual targets for all selected goalKeys
                    goalKeys.forEach(k => {
                        if (targets[`${k}_FAT`] !== undefined) {
                            overrideFat += targets[`${k}_FAT`];
                            hasOverrideFat = true;
                        }
                        if (targets[`${k}_VOL`] !== undefined) {
                            overrideVol += targets[`${k}_VOL`];
                            hasOverrideVol = true;
                        }
                    });

                    // 2. Aggregate fallbacks: If individual targets are missing, check for aggregate keys
                    // but ONLY if the current selection matches the aggregate (full pasta or no filter)
                    const noSupplierFilter = suppliersSet.size === 0;

                    // Pepsico / Elma Fallbacks
                    if (noSupplierFilter || allElmaSelected) {
                        const hasIndividualElmaFat = elmaKeys.some(k => targets[`${k}_FAT`] !== undefined);
                        if (!hasIndividualElmaFat && targets['total_elma_FAT'] !== undefined) {
                            overrideFat += targets['total_elma_FAT'];
                            hasOverrideFat = true;
                        }
                        const hasIndividualElmaVol = elmaKeys.some(k => targets[`${k}_VOL`] !== undefined);
                        if (!hasIndividualElmaVol && targets['tonelada_elma_VOL'] !== undefined) {
                            overrideVol += targets['tonelada_elma_VOL'];
                            hasOverrideVol = true;
                        }
                    }

                    // Pepsico / Foods Fallbacks
                    if (noSupplierFilter || allFoodsSelected) {
                        const hasIndividualFoodsFat = foodsKeys.some(k => targets[`${k}_FAT`] !== undefined);
                        if (!hasIndividualFoodsFat && targets['total_foods_FAT'] !== undefined) {
                            overrideFat += targets['total_foods_FAT'];
                            hasOverrideFat = true;
                        }
                        const hasIndividualFoodsVol = foodsKeys.some(k => targets[`${k}_VOL`] !== undefined);
                        if (!hasIndividualFoodsVol && targets['tonelada_foods_VOL'] !== undefined) {
                            overrideVol += targets['tonelada_foods_VOL'];
                            hasOverrideVol = true;
                        }
                    }

                    if (hasOverrideFat) goals.totalFat = overrideFat;
                    if (hasOverrideVol) goals.totalVol = overrideVol;
                }
            });

            // 3. Sales Aggregation (By Seller & Week)
            // Structure: Map<SellerName, { totalFat: 0, totalVol: 0, weeksFat: [], weeksVol: [] }>
            const salesBySeller = new Map();
            const { weeks } = getMonthWeeksDistribution(lastSaleDate); // Use current global date context

            // Helper to find week index
            const getWeekIndex = (date) => {
                const d = typeof date === 'number' ? new Date(date) : parseDate(date);
                if (!d) return -1;
                // Check against ranges
                for(let i=0; i<weeks.length; i++) {
                    // Week range is inclusive start, inclusive end
                    if (d >= weeks[i].start && d <= weeks[i].end) return i;
                }
                return -1;
            };

            // Iterate Sales
            // Optimized: Use indices if needed, or simple iteration.
            // Filter: Month, Types != 5,11, Pasta, Supervisor/Seller/Supplier
            const currentMonthIndex = lastSaleDate.getUTCMonth();
            const currentYear = lastSaleDate.getUTCFullYear();

            // Cache for Positivação Logic (Unique Clients per Seller)
            const sellerClients = new Map(); // Map<SellerName, Set<CodCli>>

            for(let i=0; i<allSalesData.length; i++) {
                const s = allSalesData instanceof ColumnarDataset ? allSalesData.get(i) : allSalesData[i];

                // Date Filter
                const d = typeof s.DTPED === 'number' ? new Date(s.DTPED) : parseDate(s.DTPED);
                if (!d || d.getUTCMonth() !== currentMonthIndex || d.getUTCFullYear() !== currentYear) continue;

                // Type Filter (Types 5 and 11 excluded)
                const tipo = String(s.TIPOVENDA);
                if (tipo === '5' || tipo === '11') continue;

                // Pasta Filter (OBSERVACAOFOR) logic for Pepsico/Elma/Foods
                // 1. Determine if row is PEPSICO/MULTIMARCAS
                let rowPasta = s.OBSERVACAOFOR;
                if (!rowPasta || rowPasta === '0' || rowPasta === '00' || rowPasta === 'N/A') {
                     const rawFornecedor = String(s.FORNECEDOR || '').toUpperCase();
                     rowPasta = rawFornecedor.includes('PEPSICO') ? 'PEPSICO' : 'MULTIMARCAS';
                }

                // "Meta Vs. Realizado" only cares about PEPSICO data
                if (rowPasta !== 'PEPSICO') continue;

                // 2. Check Sub-pasta logic (ELMA vs FOODS) based on CODFOR
                // If filter is PEPSICO, we include everything (since we already filtered for PEPSICO above)
                // If filter is ELMA, we check CODFOR 707, 708, 752
                // If filter is FOODS, we check CODFOR 1119 (or specific sub-brands if needed, but usually 1119 is Foods)

                const codFor = String(s.CODFOR);
                if (pasta === 'ELMA') {
                    if (!window.SUPPLIER_CODES.ELMA.includes(codFor)) continue;
                } else if (pasta === 'FOODS') {
                    if (codFor !== window.SUPPLIER_CODES.FOODS[0]) continue;
                }
                // If pasta === 'PEPSICO', we include all (already filtered for PEPSICO rowPasta)

                // Client Filter (Must be in the filtered list of clients? Or just match filters?)
                // If we filtered clients by Supervisor/Seller, we should only count sales for those clients?
                // Or sales where the sale's Supervisor/Seller matches?
                // Usually Sales view filters by Sale attributes. Goals view filters by Client attributes.
                // "Meta Vs Realizado" implies comparing the same entity.
                // If I filter Supervisor "X", I show Seller Goals for X and Seller Sales for X.
                // Let's use the standard filter logic:

                if (supervisorsSet.size > 0 && !supervisorsSet.has(s.SUPERV)) continue;
                if (sellersSet.size > 0 && !sellersSet.has(s.NOME)) continue;

                // Client Filter: Ensure sale belongs to the same set of clients used for goals
                if (!filteredClientCodes.has(String(s.CODCLI))) continue;

                // Enhanced Supplier Logic to handle Virtual Foods Categories
                if (suppliersSet.size > 0) {
                    let supplierMatch = false;
                    const codFor = String(s.CODFOR);

                    // 1. Direct Match (Regular Suppliers)
                    if (suppliersSet.has(codFor)) {
                        supplierMatch = true;
                    }
                    // 2. Virtual Category Logic for 1119 (Foods)
                    else if (codFor === window.SUPPLIER_CODES.FOODS[0]) {
                        const desc = normalize(s.DESCRICAO || '');
                        if (suppliersSet.has(window.SUPPLIER_CODES.VIRTUAL.TODDYNHO) && desc.includes('TODDYNHO')) supplierMatch = true;
                        else if (suppliersSet.has(window.SUPPLIER_CODES.VIRTUAL.TODDY) && desc.includes('TODDY') && !desc.includes('TODDYNHO')) supplierMatch = true;
                        else if (suppliersSet.has(window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO) && (desc.includes('QUAKER') || desc.includes('KEROCOCO'))) supplierMatch = true;
                    }

                    if (!supplierMatch) continue;
                }

                const sellerName = s.NOME;
                const valFat = Number(s.VLVENDA) || 0;
                const valVol = Number(s.TOTPESOLIQ) || 0;
                const weekIdx = getWeekIndex(d);

                if (!salesBySeller.has(sellerName)) {
                    salesBySeller.set(sellerName, { totalFat: 0, totalVol: 0, weeksFat: [0, 0, 0, 0, 0], weeksVol: [0, 0, 0, 0, 0], totalPos: 0 });
                }
                const entry = salesBySeller.get(sellerName);

                entry.totalFat += valFat;
                entry.totalVol += valVol;

                if (weekIdx !== -1 && weekIdx < 5) {
                    entry.weeksFat[weekIdx] += valFat;
                    entry.weeksVol[weekIdx] += valVol;
                }

                // Positivação Logic (Accumulate Clients)
                if (!sellerClients.has(sellerName)) sellerClients.set(sellerName, new Set());
                sellerClients.get(sellerName).add(String(s.CODCLI));
            }

            // Finalize Positivação Counts
            sellerClients.forEach((clientSet, sel) => {
                if (salesBySeller.has(sel)) {
                    salesBySeller.get(sel).totalPos = clientSet.size;
                }
            });

            return { goalsBySeller, salesBySeller, weeks };
        }

        function renderMetaRealizadoTable(data, weeks, totalWorkingDays) {
            const tableHead = document.getElementById('meta-realizado-table-head');
            const tableBody = document.getElementById('meta-realizado-table-body');

            // Build Headers
            let headerHTML = `
                <tr>
                    <th rowspan="2" class="px-3 py-2 text-left glass-panel-heavy z-50 sticky left-0 border-r border-b border-slate-700 w-32 shadow-lg hidden md:table-cell">VENDEDOR</th>
                    <th colspan="2" class="px-2 py-1 text-center bg-blue-900/30 text-blue-400 border-r border-slate-700 border-b-0 hidden md:table-cell">GERAL</th>
            `;

            // Week Headers (Top Row)
            weeks.forEach((week, i) => {
                headerHTML += `<th colspan="2" class="px-2 py-1 text-center border-r border-slate-700 border-b-0 text-slate-300 hidden md:table-cell">SEMANA ${i + 1} (${week.workingDays}d)</th>`;
            });
            headerHTML += `</tr><tr>`;

            // Sub-headers Row
            // Geral Sub-headers
            headerHTML += `
                <th class="px-2 py-2 text-right bg-blue-900/20 text-blue-300 border-r border-b border-slate-700/50 text-[10px] hidden md:table-cell">META</th>
                <th class="px-2 py-2 text-right bg-blue-900/20 text-blue-100 font-bold border-r border-b border-slate-700 text-[10px] hidden md:table-cell">REALIZADO</th>
            `;

            // Week Sub-headers
            weeks.forEach(() => {
                headerHTML += `
                    <th class="px-2 py-2 text-right border-r border-b border-slate-700/50 text-slate-400 text-[10px] hidden md:table-cell">META</th>
                    <th class="px-2 py-2 text-right border-r border-b border-slate-700 text-white font-bold text-[10px] hidden md:table-cell">REAL.</th>
                `;
            });
            headerHTML += `</tr>`;

            tableHead.innerHTML = headerHTML;

            // Build Body
            // data is Array of { name, metaTotal, realTotal, weeks: [{meta, real}] }
            const rowsHTML = data.map((row, index) => {
                const metaTotalStr = row.metaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const realTotalStr = row.realTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                // Achievement Color Logic
                const percent = row.metaTotal > 0 ? (row.realTotal / row.metaTotal) * 100 : 0;
                let colorClass = 'text-green-500';
                if (percent <= 30) colorClass = 'text-red-500';
                else if (percent <= 50) colorClass = 'text-yellow-300';
                else if (percent <= 80) colorClass = 'text-blue-400';
                else if (percent < 100) colorClass = 'text-green-500';
                else colorClass = 'text-yellow-400 font-bold text-glow'; // Gold

                // Desktop Cells
                let desktopCells = `
                    <td class="px-3 py-2 font-medium text-slate-200 border-r border-b border-slate-700 sticky left-0 glass-panel-heavy z-30 truncate hidden md:table-cell" title="${row.name}">${getFirstName(row.name)}</td>
                    <td class="px-2 py-2 text-right bg-blue-900/10 text-teal-400 border-r border-b border-slate-700/50 text-xs hidden md:table-cell" title="Meta Contratual Mensal">${metaTotalStr}</td>
                    <td class="px-2 py-2 text-right bg-blue-900/10 text-yellow-400 font-bold border-r border-b border-slate-700 text-xs hidden md:table-cell">${realTotalStr}</td>
                `;

                row.weekData.forEach(w => {
                    const wMetaStr = w.meta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    const wRealStr = w.real.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                    const realClass = w.real >= w.meta ? 'text-green-400' : 'text-slate-300';
                    const metaClass = w.isPast ? 'text-red-500' : 'text-slate-400';

                    desktopCells += `
                        <td class="px-2 py-3 text-right ${metaClass} text-xs border-r border-b border-slate-700 hidden md:table-cell">${wMetaStr}</td>
                        <td class="px-2 py-3 text-right ${realClass} text-xs font-medium border-r border-b border-slate-700 hidden md:table-cell">${wRealStr}</td>
                    `;
                });

                // Mobile Content (Compact List)
                const mobileContent = `
                    <div class="md:hidden w-full py-3 border-b border-slate-800" onclick="openMetaRealizadoDetailsModal(${index}, 'seller')">
                        <div class="font-bold text-sm text-slate-200 mb-1 truncate">${row.codusur || ''} - ${row.name}</div>
                        <div class="flex justify-between items-center text-xs">
                            <div class="text-slate-400">Meta: <span class="text-slate-200 font-medium">${metaTotalStr}</span></div>
                            <div class="text-slate-400">Real: <span class="${colorClass} font-bold">${realTotalStr}</span></div>
                        </div>
                    </div>
                `;

                return `<tr class="hover:bg-slate-700/30 transition-colors group">${mobileContent}${desktopCells}</tr>`;
            }).join('');

            tableBody.innerHTML = rowsHTML;
            // Store data for modal access
            window.currentMetaRealizadoData = data;
        }

        window.openMetaRealizadoDetailsModal = function(index, type) {
            let item;
            if (type === 'seller') {
                item = window.currentMetaRealizadoData ? window.currentMetaRealizadoData[index] : null;
            } else {
                 item = metaRealizadoClientsTableState.filteredData ? metaRealizadoClientsTableState.filteredData[index] : null;
                 // Pagination adjustment handled below if needed, but filteredData is usually the full set?
                 // Wait, renderMetaRealizadoClientsTable renders a slice.
                 // We need to pass the correct index or object.
                 // Let's pass the index relative to the rendered page in HTML onclick,
                 // and map it back using currentPage logic.
                 // Actually, simpler: render passes the object directly? No, HTML onclick needs primitive.
                 // Let's fix the logic in renderMetaRealizadoClientsTable to pass 'pageIndex'.
                 // Here we expect index to be the index in the *current page* array (0 to itemsPerPage-1)
                 // OR we pass the absolute index?
                 // Let's assume 'item' lookup is handled in the render function context or data is attached to DOM.
                 // Better: Use a global or attached data.
            }

            // Re-lookup correctly based on context (Seller vs Client)
            // Seller table is full list (no pagination usually).
            // Client table IS paginated.
            if (type === 'client') {
                 // For clients, index passed is index in 'pageData' array
                 const startIndex = (metaRealizadoClientsTableState.currentPage - 1) * metaRealizadoClientsTableState.itemsPerPage;
                 // But wait, if I render rows with onclick="open...(i)", 'i' is the loop index of pageData.
                 // So item = pageData[i].
                 // We need to reconstruct pageData here or access it.
                 const endIndex = startIndex + metaRealizadoClientsTableState.itemsPerPage;
                 const pageData = metaRealizadoClientsTableState.filteredData.slice(startIndex, endIndex);
                 item = pageData[index];
            }

            if (!item) return;

            const modal = document.getElementById('meta-realizado-details-modal');
            const title = document.getElementById('meta-realizado-modal-title');
            const subtitle = document.getElementById('meta-realizado-modal-subtitle');
            const metaVal = document.getElementById('meta-realizado-modal-meta-val');
            const realVal = document.getElementById('meta-realizado-modal-real-val');
            const percentBadge = document.getElementById('meta-realizado-modal-percent');
            const weeksBody = document.getElementById('meta-realizado-modal-weeks-body');

            // Populate Content
            title.textContent = `${item.codcli || item.codusur || ''} - ${item.razaoSocial || item.name || 'Nome Indisponível'}`;

            let subText = '';
            if (type === 'client') {
                subText = `${item.cidade || 'N/A'} • ${item.vendedor ? getFirstName(item.vendedor) : 'N/A'}`;
            } else {
                subText = 'Vendedor'; // Or hierarchy info if available
            }
            subtitle.textContent = subText;

            // Big Numbers
            const metaTotal = item.metaTotal || 0;
            const realTotal = item.realTotal || 0;
            const percent = metaTotal > 0 ? (realTotal / metaTotal) * 100 : 0;

            metaVal.textContent = metaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            realVal.textContent = realTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            percentBadge.textContent = `${percent.toFixed(1)}%`;

            // Color Logic (Same as List)
            let colorClass = 'text-green-500';
            let badgeBg = 'bg-green-900/50';
            if (percent <= 30) { colorClass = 'text-red-500'; badgeBg = 'bg-red-900/50'; }
            else if (percent <= 50) { colorClass = 'text-yellow-300'; badgeBg = 'bg-yellow-900/50'; }
            else if (percent <= 80) { colorClass = 'text-blue-400'; badgeBg = 'bg-blue-900/50'; }
            else if (percent < 100) { colorClass = 'text-green-500'; badgeBg = 'bg-green-900/50'; }
            else { colorClass = 'text-yellow-400'; badgeBg = 'bg-yellow-900/50'; } // Gold

            realVal.className = `text-lg sm:text-2xl font-bold truncate w-full relative z-10 ${colorClass}`;
            percentBadge.className = `text-[10px] font-bold px-2 py-0.5 rounded-full text-white mt-1 relative z-10 ${badgeBg}`;

            // Weeks List (Compact)
            weeksBody.innerHTML = item.weekData.map((w, i) => {
                 const wPercent = w.meta > 0 ? (w.real / w.meta) * 100 : 0;
                 let wColor = 'text-green-400';
                 if (wPercent < 100 && w.isPast) wColor = 'text-red-400';
                 else if (wPercent < 100) wColor = 'text-slate-400';

                 return `
                    <div class="flex items-center justify-between py-3 px-4 hover:bg-white/5 transition-colors border-b border-slate-800 last:border-0">
                        <span class="text-slate-500 font-mono text-xs font-bold w-8">S${i + 1}</span>
                        <div class="flex items-center gap-3 text-xs">
                             <div class="hidden sm:block text-slate-500">Meta: <span class="text-slate-400">${w.meta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                             <div class="sm:hidden text-slate-500"><span class="text-slate-400">${w.meta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>

                             <div class="text-slate-500">Real: <span class="${wColor} font-bold">${w.real.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                             <span class="${wColor} font-bold min-w-[35px] text-right bg-slate-800/50 px-1.5 py-0.5 rounded">${wPercent.toFixed(0)}%</span>
                        </div>
                    </div>
                 `;
            }).join('');

            modal.classList.remove('hidden');

            // Close Handler
            const closeBtn = document.getElementById('meta-realizado-modal-close-btn');
            closeBtn.onclick = () => {
                modal.classList.add('hidden');
            };
        };

        function renderMetaRealizadoChart(data) {
            const ctx = document.getElementById('metaRealizadoChartContainer');
            if (!ctx) return;

            // Destroy previous chart if exists (assume we store it in charts object)
            // Wait, createChart helper handles destruction if we pass ID. But here we have container ID.
            // Let's use a canvas inside the container.

            let canvas = ctx.querySelector('canvas');
            if (!canvas) {
                canvas = document.createElement('canvas');
                ctx.appendChild(canvas);
            }

            const chartId = 'metaRealizadoChartInstance';

            // Aggregate totals for the chart (Total Meta vs Total Realizado)
            const totalMeta = data.reduce((sum, d) => sum + d.metaTotal, 0);
            const totalReal = data.reduce((sum, d) => sum + d.realTotal, 0);

            // Adjust formatting based on metric
            const isVolume = currentMetaRealizadoMetric === 'peso';

            // If Volume, display in Tons (input was Kg)
            const displayTotalMeta = isVolume ? totalMeta / 1000 : totalMeta;
            const displayTotalReal = isVolume ? totalReal / 1000 : totalReal;

            const formatValue = (val) => {
                if (isVolume) {
                    return val.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' Ton';
                }
                return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            };

            if (charts[chartId]) {
                charts[chartId].data.datasets[0].data = [displayTotalMeta];
                charts[chartId].data.datasets[1].data = [displayTotalReal];
                // Update formatters closure
                charts[chartId].options.plugins.tooltip.callbacks.label = function(context) {
                    let label = context.dataset.label || '';
                    if (label) label += ': ';
                    if (context.parsed.y !== null) label += formatValue(context.parsed.y);
                    return label;
                };
                charts[chartId].options.plugins.datalabels.formatter = formatValue;
                charts[chartId].update('none');
            } else {
                charts[chartId] = new Chart(canvas, {
                    type: 'bar',
                    data: {
                        labels: ['Total'],
                        datasets: [
                            {
                                label: 'Meta',
                                data: [displayTotalMeta],
                                backgroundColor: '#14b8a6', // Teal
                                barPercentage: 0.6,
                                categoryPercentage: 0.8
                            },
                            {
                                label: 'Realizado',
                                data: [displayTotalReal],
                                backgroundColor: '#f59e0b', // Amber/Yellow
                                barPercentage: 0.6,
                                categoryPercentage: 0.8
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: {
                            padding: {
                                top: 50
                            }
                        },
                        plugins: {
                            legend: { position: 'top', labels: { color: '#cbd5e1' } },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        let label = context.dataset.label || '';
                                        if (label) {
                                            label += ': ';
                                        }
                                        if (context.parsed.y !== null) {
                                            label += formatValue(context.parsed.y);
                                        }
                                        return label;
                                    }
                                }
                            },
                            datalabels: {
                                display: true,
                                color: '#fff',
                                anchor: 'end',
                                align: 'top',
                                formatter: formatValue,
                                font: { weight: 'bold' }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grace: '10%',
                                grid: { color: '#334155' },
                                ticks: { color: '#94a3b8' }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { color: '#94a3b8' }
                            }
                        }
                    }
                });
            }
        }

        let metaRealizadoClientsTableState = {
            currentPage: 1,
            itemsPerPage: 50,
            filteredData: [],
            totalPages: 1
        };

        function updateMetaRealizadoView() {
            // 1. Get Data
            const { goalsBySeller, salesBySeller, weeks } = getMetaRealizadoFilteredData();

            // Re-calculate Total Working Days
            let totalWorkingDays = weeks.reduce((sum, w) => sum + w.workingDays, 0);
            if (totalWorkingDays === 0) totalWorkingDays = 1;

            // 2. Combine Data for Rendering (Sellers)
            const allSellers = new Set([...goalsBySeller.keys(), ...salesBySeller.keys()]);
            const rowData = [];

            allSellers.forEach(sellerName => {
                const goals = goalsBySeller.get(sellerName) || { totalFat: 0, totalVol: 0, totalPos: 0 };
                const sales = salesBySeller.get(sellerName) || { totalFat: 0, totalVol: 0, weeksFat: [], weeksVol: [], totalPos: 0 };

                // Determine which metric to use for the main chart/table
                // Note: The Table logic (renderMetaRealizadoTable) seems built for ONE metric (previously just Revenue).
                // If we want the Table to also toggle or show both, we need to adjust it.
                // Given the requirement "toggle button for R$/Ton", let's make the Table adhere to that too.

                let targetTotalGoal = 0;
                let targetRealizedTotal = 0;
                let targetRealizedWeeks = [];

                if (currentMetaRealizadoMetric === 'valor') {
                    targetTotalGoal = goals.totalFat;
                    targetRealizedTotal = sales.totalFat;
                    targetRealizedWeeks = sales.weeksFat || [];
                } else {
                    targetTotalGoal = goals.totalVol; // Kg
                    targetRealizedTotal = sales.totalVol; // Kg
                    targetRealizedWeeks = sales.weeksVol || [];
                }

                // Positivação Data
                const posGoal = goals.totalPos;
                const posRealized = sales.totalPos;

                // Calculate Dynamic Weekly Goals (For the selected metric)
                const adjustedGoals = calculateAdjustedWeeklyGoals(targetTotalGoal, targetRealizedWeeks, weeks);

                const weekData = weeks.map((w, i) => {
                    const wMeta = adjustedGoals[i];
                    const wReal = targetRealizedWeeks[i] || 0;
                    const isPast = w.end < lastSaleDate;
                    return { meta: wMeta, real: wReal, isPast: isPast };
                });

                rowData.push({
                    name: sellerName,
                    metaTotal: targetTotalGoal,
                    realTotal: targetRealizedTotal,
                    weekData: weekData,
                    // Additional Data for Positivação Chart
                    posGoal: posGoal,
                    posRealized: posRealized
                });
            });

            // Sort by Meta Total Descending
            rowData.sort((a, b) => b.metaTotal - a.metaTotal);

            // 3. Render Sellers Table & Chart
            renderMetaRealizadoTable(rowData, weeks, totalWorkingDays);
            renderMetaRealizadoChart(rowData); // Chart 1 (Selected Metric)
            renderMetaRealizadoPosChart(rowData); // Chart 2 (Positivação)

            // 4. Clients Table Processing
            const clientsData = getMetaRealizadoClientsData(weeks);

            // 5. Save Data for Export
            metaRealizadoDataForExport = {
                sellers: rowData,
                clients: clientsData,
                weeks: weeks
            };

            metaRealizadoClientsTableState.filteredData = clientsData;
            metaRealizadoClientsTableState.totalPages = Math.ceil(clientsData.length / metaRealizadoClientsTableState.itemsPerPage);

            // Validate Current Page
            if (metaRealizadoClientsTableState.currentPage > metaRealizadoClientsTableState.totalPages) {
                metaRealizadoClientsTableState.currentPage = metaRealizadoClientsTableState.totalPages > 0 ? metaRealizadoClientsTableState.totalPages : 1;
            }
            if (metaRealizadoClientsTableState.totalPages === 0) metaRealizadoClientsTableState.currentPage = 1;

            renderMetaRealizadoClientsTable(clientsData, weeks);
        }

        function getMetaRealizadoClientsData(weeks) {
            // New Hierarchy Logic
            const currentMonthIndex = lastSaleDate.getUTCMonth();
            const currentYear = lastSaleDate.getUTCFullYear();
            const suppliersSet = new Set(selectedMetaRealizadoSuppliers);
            const pasta = currentMetaRealizadoPasta;

            // --- Fix: Define Filter Sets from Hierarchy State ---
            const supervisorsSet = new Set();
            const sellersSet = new Set();

            const hState = hierarchyState['meta-realizado'];
            if (hState) {
                // 1. Always try to populate supervisorsSet if Coords are selected (Direct Supervisor Filter)
                if (hState.coords.size > 0) {
                    hState.coords.forEach(c => {
                        const name = optimizedData.coordMap.get(c);
                        if(name) supervisorsSet.add(name);
                    });
                }

                // 2. Resolve Promotor codes for sellersSet (Leaf Filter)
                // Use drill-down logic: Promotor > Co-coord > Coord
                const validCodes = new Set();
                if (hState.promotors.size > 0) {
                    hState.promotors.forEach(p => validCodes.add(p));
                } else if (hState.cocoords.size > 0) {
                    hState.cocoords.forEach(cc => {
                        const children = optimizedData.promotorsByCocoord.get(cc);
                        if (children) children.forEach(p => validCodes.add(p));
                    });
                } else if (hState.coords.size > 0) {
                    hState.coords.forEach(c => {
                        const cocoords = optimizedData.cocoordsByCoord.get(c);
                        if (cocoords) {
                            cocoords.forEach(cc => {
                                const children = optimizedData.promotorsByCocoord.get(cc);
                                if (children) children.forEach(p => validCodes.add(p));
                            });
                        }
                    });
                }

                // 3. Map codes to names in sellersSet
                if (validCodes.size > 0) {
                    validCodes.forEach(code => {
                        const name = optimizedData.promotorMap.get(code);
                        if (name) sellersSet.add(name);

                        // Also try mapping via rcaNameByCode (fallback)
                        const rcaName = optimizedData.rcaNameByCode.get(code);
                        if (rcaName) sellersSet.add(rcaName);
                    });
                }
            }
            // ----------------------------------------------------

            // 1. Identify Target Clients (Active/Americanas/etc + Filtered)
            // Apply Hierarchy Logic + "Active" Filter logic
            let clients = getHierarchyFilteredClients('meta-realizado', allClientsData).filter(c => {
                const rca1 = String(c.rca1 || '').trim();
                const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');
                if (isAmericanas) return true;
                if (rca1 === '53') return false;
                if (rca1 === '') return false;
                return true;
            });

            // Optimization: Create Set of Client Codes
            const allowedClientCodes = new Set(clients.map(c => String(c['Código'] || c['codigo_cliente'])));

            // 2. Aggregate Data per Client
            const clientMap = new Map(); // Map<CodCli, { clientObj, goal: 0, salesTotal: 0, salesWeeks: [] }>

            // Determine Goal Keys based on Pasta (Copy logic)
            let goalKeys = [];
            if (pasta === 'PEPSICO') goalKeys = window.SUPPLIER_CODES.ALL_GOALS;
            else if (pasta === 'ELMA') goalKeys = window.SUPPLIER_CODES.ELMA;
            else if (pasta === 'FOODS') goalKeys = window.SUPPLIER_CODES.VIRTUAL_LIST;

            // A. Populate Goals
            clients.forEach(client => {
                const codCli = String(client['Código'] || client['codigo_cliente']);
                if (!clientMap.has(codCli)) {
                    clientMap.set(codCli, { clientObj: client, goal: 0, salesTotal: 0, salesWeeks: new Array(weeks.length).fill(0) });
                }
                const entry = clientMap.get(codCli);

                if (globalClientGoals.has(codCli)) {
                    const cGoals = globalClientGoals.get(codCli);
                    goalKeys.forEach(k => {
                        if (cGoals.has(k)) entry.goal += (cGoals.get(k).fat || 0);
                    });
                }
            });

            // B. Populate Sales (Iterate ALL Sales to catch those without Meta)
            // Filter Logic matches 'getMetaRealizadoFilteredData'

            // Helper for week index (Copied from getMetaRealizadoFilteredData scope, need to redefine or reuse)
            const getWeekIndex = (date) => {
                const d = typeof date === 'number' ? new Date(date) : parseDate(date);
                if (!d) return -1;
                for(let i=0; i<weeks.length; i++) {
                    if (d >= weeks[i].start && d <= weeks[i].end) return i;
                }
                return -1;
            };

            for(let i=0; i<allSalesData.length; i++) {
                const s = allSalesData instanceof ColumnarDataset ? allSalesData.get(i) : allSalesData[i];
                const d = typeof s.DTPED === 'number' ? new Date(s.DTPED) : parseDate(s.DTPED);

                // Basic Filters
                if (!d || d.getUTCMonth() !== currentMonthIndex || d.getUTCFullYear() !== currentYear) continue;
                const tipo = String(s.TIPOVENDA);
                if (tipo === '5' || tipo === '11') continue;

                // Pasta Filter
                let rowPasta = s.OBSERVACAOFOR;
                if (!rowPasta || rowPasta === '0' || rowPasta === '00' || rowPasta === 'N/A') {
                     const rawFornecedor = String(s.FORNECEDOR || '').toUpperCase();
                     rowPasta = rawFornecedor.includes('PEPSICO') ? 'PEPSICO' : 'MULTIMARCAS';
                }
                if (rowPasta !== 'PEPSICO') continue;

                const codFor = String(s.CODFOR);
                if (pasta === 'ELMA' && !window.SUPPLIER_CODES.ELMA.includes(codFor)) continue;
                if (pasta === 'FOODS' && codFor !== window.SUPPLIER_CODES.FOODS[0]) continue;

                // Supervisor/Seller/Supplier Filter on SALE row
                if (supervisorsSet.size > 0 && !supervisorsSet.has(s.SUPERV)) continue;
                if (sellersSet.size > 0 && !sellersSet.has(s.NOME)) continue;
                if (suppliersSet.size > 0 && !suppliersSet.has(s.CODFOR)) continue;

                const codCli = String(s.CODCLI);
                // Check if client is in allowed list (Active/Filtered)
                // Note: User said "todos os clientes que possuírem metas OU vendas".
                // If a client has sales but was filtered out by "Active" check (e.g. Inactive RCA), should they appear?
                // Usually yes, sales override status.
                // However, we are filtering by Supervisor/Seller above.

                // Logic: If I filtered by Supervisor X, and Sale is by Supervisor X, I include it.
                // But do I include the Client Object?
                // If the client wasn't in 'clients' array (e.g. RCA 53?), we might miss metadata.
                // We should fetch client metadata from allClientsData map if missing.

                if (!clientMap.has(codCli)) {
                    // Try to find client object
                    const clientObj = clientMapForKPIs.get(codCli) || { 'Código': codCli, nomeCliente: 'DESCONHECIDO', cidade: 'N/A', rca1: 'N/A' };
                    // If we apply STRICT Supervisor/Seller filter, we should check if this sale matches.
                    // We already checked sale attributes above. So this sale is valid for the view.
                    clientMap.set(codCli, { clientObj: clientObj, goal: 0, salesTotal: 0, salesWeeks: new Array(weeks.length).fill(0) });
                }

                const entry = clientMap.get(codCli);
                const val = Number(s.VLVENDA) || 0;
                const weekIdx = getWeekIndex(d);

                entry.salesTotal += val;
                if (weekIdx !== -1) entry.salesWeeks[weekIdx] += val;
            }

            // 3. Transform to Array and Calculate Dynamic Goals
            const results = [];
            clientMap.forEach((data, codCli) => {
                // Filter out if No Goal AND No Sales (Clean up empty active clients)
                if (data.goal === 0 && data.salesTotal === 0) return;

                const adjustedGoals = calculateAdjustedWeeklyGoals(data.goal, data.salesWeeks, weeks);

                const weekData = weeks.map((w, i) => {
                    const isPast = w.end < lastSaleDate;
                    return { meta: adjustedGoals[i], real: data.salesWeeks[i], isPast: isPast };
                });

                // Resolve Vendor Name
                let vendorName = 'N/A';
                const rcaCode = (data.clientObj.rcas && data.clientObj.rcas.length > 0) ? data.clientObj.rcas[0] : (data.clientObj.rca1 || 'N/A');
                if (rcaCode !== 'N/A') {
                    vendorName = optimizedData.rcaNameByCode.get(String(rcaCode)) || rcaCode;
                }

                let nomeExibicao = data.clientObj.nomeCliente || data.clientObj.razaoSocial || 'N/A';
                if (nomeExibicao.toUpperCase().includes('AMERICANAS')) {
                    const fantasia = data.clientObj.fantasia || data.clientObj.FANTASIA || data.clientObj['Nome Fantasia'];
                    if (fantasia) {
                        nomeExibicao = fantasia;
                    }
                }

                results.push({
                    codcli: codCli,
                    razaoSocial: nomeExibicao,
                    cidade: data.clientObj.cidade || 'N/A',
                    vendedor: vendorName,
                    metaTotal: data.goal,
                    realTotal: data.salesTotal,
                    weekData: weekData
                });
            });

            // Sort: High Potential? High Sales?
            // Default: Meta Descending, then Sales Descending
            results.sort((a, b) => b.metaTotal - a.metaTotal || b.realTotal - a.realTotal);

            return results;
        }

        function renderMetaRealizadoClientsTable(data, weeks) {
            const tableHead = document.getElementById('meta-realizado-clients-table-head');
            const tableBody = document.getElementById('meta-realizado-clients-table-body');
            const controls = document.getElementById('meta-realizado-clients-pagination-controls');
            const infoText = document.getElementById('meta-realizado-clients-page-info-text');
            const prevBtn = document.getElementById('meta-realizado-clients-prev-page-btn');
            const nextBtn = document.getElementById('meta-realizado-clients-next-page-btn');

            // 1. Build Headers (Same logic as Seller Table but with Client Info)
            let headerHTML = `
                <tr>
                    <th rowspan="2" class="px-2 py-2 text-center glass-panel-heavy border-r border-b border-slate-700 w-16 hidden md:table-cell">CÓD</th>
                    <th rowspan="2" class="px-3 py-2 text-left glass-panel-heavy border-r border-b border-slate-700 min-w-[200px] hidden md:table-cell">CLIENTE</th>
                    <th rowspan="2" class="px-3 py-2 text-left glass-panel-heavy border-r border-b border-slate-700 w-32 hidden md:table-cell">VENDEDOR</th>
                    <th rowspan="2" class="px-3 py-2 text-left glass-panel-heavy border-r border-b border-slate-700 w-32 hidden md:table-cell">CIDADE</th>
                    <th colspan="2" class="px-2 py-1 text-center bg-blue-900/30 text-blue-400 border-r border-slate-700 border-b-0 hidden md:table-cell">GERAL</th>
            `;

            weeks.forEach((week, i) => {
                headerHTML += `<th colspan="2" class="px-2 py-1 text-center border-r border-slate-700 border-b-0 text-slate-300 hidden md:table-cell">SEMANA ${i + 1}</th>`;
            });
            headerHTML += `</tr><tr>`;

            headerHTML += `
                <th class="px-2 py-2 text-right bg-blue-900/20 text-blue-300 border-r border-b border-slate-700/50 text-[10px] hidden md:table-cell">META</th>
                <th class="px-2 py-2 text-right bg-blue-900/20 text-blue-100 font-bold border-r border-b border-slate-700 text-[10px] hidden md:table-cell">REALIZADO</th>
            `;

            weeks.forEach(() => {
                headerHTML += `
                    <th class="px-2 py-2 text-right border-r border-b border-slate-700/50 text-slate-400 text-[10px] hidden md:table-cell">META</th>
                    <th class="px-2 py-2 text-right border-r border-b border-slate-700 text-white font-bold text-[10px] hidden md:table-cell">REAL.</th>
                `;
            });
            headerHTML += `</tr>`;

            tableHead.innerHTML = headerHTML;

            // 2. Pagination Logic
            const startIndex = (metaRealizadoClientsTableState.currentPage - 1) * metaRealizadoClientsTableState.itemsPerPage;
            const endIndex = startIndex + metaRealizadoClientsTableState.itemsPerPage;
            const pageData = metaRealizadoClientsTableState.filteredData.slice(startIndex, endIndex);

            // 3. Build Body
            if (pageData.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="${6 + (weeks.length * 2)}" class="px-4 py-8 text-center text-slate-500">Nenhum cliente encontrado com os filtros atuais.</td></tr>`;
            } else {
                const rowsHTML = pageData.map((row, i) => {
                    const metaTotalStr = row.metaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    const realTotalStr = row.realTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                    // Achievement Color Logic
                    const percent = row.metaTotal > 0 ? (row.realTotal / row.metaTotal) * 100 : 0;
                    let colorClass = 'text-green-500';
                    if (percent <= 30) colorClass = 'text-red-500';
                    else if (percent <= 50) colorClass = 'text-yellow-300';
                    else if (percent <= 80) colorClass = 'text-blue-400';
                    else if (percent < 100) colorClass = 'text-green-500';
                    else colorClass = 'text-yellow-400 font-bold text-glow'; // Gold

                    let desktopCells = `
                        <td class="px-2 py-2 text-center text-slate-400 text-xs border-r border-b border-slate-700 hidden md:table-cell">${row.codcli}</td>
                        <td class="px-3 py-2 text-xs font-medium text-slate-200 border-r border-b border-slate-700 truncate hidden md:table-cell" title="${escapeHtml(row.razaoSocial)}">${escapeHtml(row.razaoSocial)}</td>
                        <td class="px-3 py-2 text-xs text-slate-400 border-r border-b border-slate-700 truncate hidden md:table-cell">${escapeHtml(getFirstName(row.vendedor))}</td>
                        <td class="px-3 py-2 text-xs text-slate-400 border-r border-b border-slate-700 truncate hidden md:table-cell">${escapeHtml(row.cidade)}</td>
                        <td class="px-2 py-2 text-right bg-blue-900/10 text-teal-400 border-r border-b border-slate-700/50 text-xs hidden md:table-cell" title="Meta Contratual Mensal">${metaTotalStr}</td>
                        <td class="px-2 py-2 text-right bg-blue-900/10 text-yellow-400 font-bold border-r border-b border-slate-700 text-xs hidden md:table-cell">${realTotalStr}</td>
                    `;

                    row.weekData.forEach(w => {
                        const wMetaStr = w.meta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        const wRealStr = w.real.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        const realClass = w.real >= w.meta && w.meta > 0 ? 'text-green-400' : 'text-slate-300';
                        const metaClass = w.isPast ? 'text-red-500' : 'text-slate-400';

                        desktopCells += `
                            <td class="px-2 py-3 text-right ${metaClass} text-xs border-r border-b border-slate-700 hidden md:table-cell">${wMetaStr}</td>
                            <td class="px-2 py-3 text-right ${realClass} text-xs font-medium border-r border-b border-slate-700 hidden md:table-cell">${wRealStr}</td>
                        `;
                    });

                    // Mobile Content (Compact List)
                    const mobileContent = `
                        <div class="md:hidden w-full py-3 border-b border-slate-800" onclick="openMetaRealizadoDetailsModal(${i}, 'client')">
                            <div class="font-bold text-sm text-slate-200 mb-1 truncate">${row.codcli || ''} - ${escapeHtml(row.razaoSocial || '')}</div>
                            <div class="flex justify-between items-center text-xs">
                                <div class="text-slate-400">Meta: <span class="text-slate-200 font-medium">${metaTotalStr}</span></div>
                                <div class="text-slate-400">Real: <span class="${colorClass} font-bold">${realTotalStr}</span></div>
                            </div>
                        </div>
                    `;

                    return `<tr class="hover:bg-slate-700/30 transition-colors">${mobileContent}${desktopCells}</tr>`;
                }).join('');
                tableBody.innerHTML = rowsHTML;
            }

            // 4. Update Pagination Controls
            if (metaRealizadoClientsTableState.filteredData.length > 0) {
                infoText.textContent = `Página ${metaRealizadoClientsTableState.currentPage} de ${metaRealizadoClientsTableState.totalPages} (Total: ${metaRealizadoClientsTableState.filteredData.length} clientes)`;
                prevBtn.disabled = metaRealizadoClientsTableState.currentPage === 1;
                nextBtn.disabled = metaRealizadoClientsTableState.currentPage === metaRealizadoClientsTableState.totalPages;
                controls.classList.remove('hidden');
            } else {
                controls.classList.add('hidden');
            }
        }

        function calculateMetricsForClients(clientsList) {
            // Helper to init metrics structure
            const createMetric = () => ({
                fat: 0, vol: 0, prevFat: 0, prevVol: 0,
                prevClientsSet: new Set(),
                quarterlyPosClientsSet: new Set(),
                monthlyClientsSets: new Map()
            });

            const metricsMap = {
                [window.SUPPLIER_CODES.ELMA[0]]: createMetric(),
                [window.SUPPLIER_CODES.ELMA[1]]: createMetric(),
                [window.SUPPLIER_CODES.ELMA[2]]: createMetric(),
                [window.SUPPLIER_CODES.VIRTUAL.TODDYNHO]: createMetric(),
                [window.SUPPLIER_CODES.VIRTUAL.TODDY]: createMetric(),
                [window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO]: createMetric(),
                'ELMA_ALL': createMetric(),
                'FOODS_ALL': createMetric(),
                'PEPSICO_ALL': createMetric()
            };

            const currentDate = lastSaleDate;
            const prevMonthDate = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() - 1, 1));
            const prevMonthIndex = prevMonthDate.getUTCMonth();
            const prevMonthYear = prevMonthDate.getUTCFullYear();

            const clientCodes = new Set(clientsList.map(c => String(c['Código'] || c['codigo_cliente'])));

            clientCodes.forEach(codCli => {
                const historyIds = optimizedData.indices.history.byClient.get(normalizeKey(codCli));
                const clientTotals = {};

                if (historyIds) {
                    historyIds.forEach(id => {
                        const sale = optimizedData.historyById.get(id);
                        if (String(codCli).trim() === '9569' && (String(sale.CODUSUR).trim() === '53' || String(sale.CODUSUR).trim() === '053')) return;

                        let key = null;
                        const codFor = String(sale.CODFOR);

                        if (codFor === window.SUPPLIER_CODES.ELMA[0]) key = window.SUPPLIER_CODES.ELMA[0];
                        else if (codFor === window.SUPPLIER_CODES.ELMA[1]) key = window.SUPPLIER_CODES.ELMA[1];
                        else if (codFor === window.SUPPLIER_CODES.ELMA[2]) key = window.SUPPLIER_CODES.ELMA[2];
                        else if (codFor === window.SUPPLIER_CODES.FOODS[0]) {
                            const desc = normalize(sale.DESCRICAO || '');
                            if (desc.includes('TODDYNHO')) key = window.SUPPLIER_CODES.VIRTUAL.TODDYNHO;
                            else if (desc.includes('TODDY')) key = window.SUPPLIER_CODES.VIRTUAL.TODDY;
                            else if (desc.includes('QUAKER') || desc.includes('KEROCOCO')) key = window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO;
                        }

                        const keysToProcess = [];
                        if (key && metricsMap[key]) keysToProcess.push(key);

                        if (window.SUPPLIER_CODES.ELMA.includes(codFor)) keysToProcess.push('ELMA_ALL');
                        if (codFor === window.SUPPLIER_CODES.FOODS[0]) keysToProcess.push('FOODS_ALL');
                        if (window.SUPPLIER_CODES.PEPSICO.includes(codFor)) keysToProcess.push('PEPSICO_ALL');

                        keysToProcess.forEach(procKey => {
                            const d = parseDate(sale.DTPED);
                            const isPrevMonth = d && d.getUTCMonth() === prevMonthIndex && d.getUTCFullYear() === prevMonthYear;

                            if (sale.TIPOVENDA === '1' || sale.TIPOVENDA === '9') {
                                metricsMap[procKey].fat += sale.VLVENDA;
                                metricsMap[procKey].vol += sale.TOTPESOLIQ;

                                if (isPrevMonth) {
                                    metricsMap[procKey].prevFat += sale.VLVENDA;
                                    metricsMap[procKey].prevVol += sale.TOTPESOLIQ;
                                }

                                if (!clientTotals[procKey]) clientTotals[procKey] = { prevFat: 0, monthlyFat: new Map(), globalFat: 0 };
                                clientTotals[procKey].globalFat += sale.VLVENDA;

                                if (d) {
                                    if (isPrevMonth) clientTotals[procKey].prevFat += sale.VLVENDA;
                                    const monthKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
                                    const currentMVal = clientTotals[procKey].monthlyFat.get(monthKey) || 0;
                                    clientTotals[procKey].monthlyFat.set(monthKey, currentMVal + sale.VLVENDA);
                                }
                            }
                        });
                    });
                }

                for (const key in clientTotals) {
                    const t = clientTotals[key];
                    if (t.globalFat >= 1) metricsMap[key].quarterlyPosClientsSet.add(codCli);
                    if (t.prevFat >= 1) metricsMap[key].prevClientsSet.add(codCli);
                    t.monthlyFat.forEach((val, mKey) => {
                        if (val >= 1) {
                            if (!metricsMap[key].monthlyClientsSets.has(mKey)) metricsMap[key].monthlyClientsSets.set(mKey, new Set());
                            metricsMap[key].monthlyClientsSets.get(mKey).add(codCli);
                        }
                    });
                }
            });

            const finalMetrics = {};
            for (const key in metricsMap) {
                const m = metricsMap[key];
                let sumClients = 0;
                m.monthlyClientsSets.forEach(set => sumClients += set.size);

                finalMetrics[key] = {
                    avgFat: m.fat / QUARTERLY_DIVISOR,
                    avgVol: m.vol / QUARTERLY_DIVISOR,
                    prevFat: m.prevFat,
                    prevVol: m.prevVol,
                    prevClients: m.prevClientsSet.size,
                    avgClients: sumClients / QUARTERLY_DIVISOR
                };
            }
            return finalMetrics;
        }

        // Wrapper for compatibility
        function getMetricsForSupervisors(supervisorsList) {
             let clients = allClientsData;
             if (supervisorsList && supervisorsList.length > 0) {
                 const rcas = new Set();
                 supervisorsList.forEach(sup => {
                     (optimizedData.rcasBySupervisor.get(sup) || []).forEach(r => rcas.add(r));
                 });
                 clients = clients.filter(c => c.rcas.some(r => rcas.has(r)));
             }
             clients = clients.filter(c => isActiveClient(c));
             return calculateMetricsForClients(clients);
        }

        function getSellerNaturalCount(sellerName, category) {
            const sellerCode = optimizedData.rcaCodeByName.get(sellerName);
            if (!sellerCode) return 0;

            const clients = optimizedData.clientsByRca.get(sellerCode) || [];
            const activeClients = clients.filter(c => {
                const cod = String(c['Código'] || c['codigo_cliente']);
                const rca1 = String(c.rca1 || '').trim();
                const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');
                return (isAmericanas || rca1 !== '53' || clientsWithSalesThisMonth.has(cod));
            });

            let count = 0;

            activeClients.forEach(client => {
                const codCli = String(client['Código'] || client['codigo_cliente']);

                // For Mix Salty/Foods, we exclude Americanas from the base count (Seller 1001)
                const rca1 = String(client.rca1 || '').trim();
                if ((category === 'mix_salty' || category === 'mix_foods') && rca1 === '1001') return;

                const historyIds = optimizedData.indices.history.byClient.get(normalizeKey(codCli));
                if (historyIds) {
                    let hasSale = false;

                    for (const id of historyIds) {
                        if (hasSale) break;
                        const sale = optimizedData.historyById.get(id);
                        // Exclude 9569 / 53 case
                        if (String(codCli).trim() === '9569' && (String(sale.CODUSUR).trim() === '53' || String(sale.CODUSUR).trim() === '053')) continue;

                        const isRev = (sale.TIPOVENDA === '1' || sale.TIPOVENDA === '9');
                        if (!isRev) continue;

                        const codFor = String(sale.CODFOR);
                        const desc = (sale.DESCRICAO || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

                        if (category === 'pepsico_all') {
                             if (window.SUPPLIER_CODES.ELMA.includes(codFor) || (codFor === window.SUPPLIER_CODES.FOODS[0] && (desc.includes('TODDYNHO') || desc.includes('TODDY') || desc.includes('QUAKER') || desc.includes('KEROCOCO')))) {
                                 hasSale = true;
                             }
                        } else if (category === 'total_elma') {
                             if (window.SUPPLIER_CODES.ELMA.includes(codFor)) hasSale = true;
                        } else if (category === 'total_foods') {
                             if (codFor === window.SUPPLIER_CODES.FOODS[0] && (desc.includes('TODDYNHO') || desc.includes('TODDY') || desc.includes('QUAKER') || desc.includes('KEROCOCO'))) hasSale = true;
                        } else if (category === window.SUPPLIER_CODES.ELMA[0] && codFor === window.SUPPLIER_CODES.ELMA[0]) hasSale = true;
                        else if (category === window.SUPPLIER_CODES.ELMA[1] && codFor === window.SUPPLIER_CODES.ELMA[1]) hasSale = true;
                        else if (category === window.SUPPLIER_CODES.ELMA[2] && codFor === window.SUPPLIER_CODES.ELMA[2]) hasSale = true;
                        else if (category === window.SUPPLIER_CODES.VIRTUAL.TODDYNHO && window.isFoods(codFor) && desc.includes('TODDYNHO')) hasSale = true;
                        else if (category === window.SUPPLIER_CODES.VIRTUAL.TODDY && window.isFoods(codFor) && desc.includes('TODDY') && !desc.includes('TODDYNHO')) hasSale = true;
                        else if (category === window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO && window.isFoods(codFor) && (desc.includes('QUAKER') || desc.includes('KEROCOCO'))) hasSale = true;
                    }

                    if (hasSale) count++;
                }
            });
            return count;
        }

        function updateGoalsSummaryView() {
            const container = document.getElementById('goals-summary-grid');
            if (!container) return;

            // 1. Identify active sellers in the current summary filter
            let filteredSummaryClients = getHierarchyFilteredClients('goals-summary', allClientsData);

            // Apply "Active" Filter logic
            filteredSummaryClients = filteredSummaryClients.filter(c => {
                const rca1 = String(c.rca1 || '').trim();
                const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');
                if (isAmericanas) return true;
                if (rca1 === '53') return false;
                if (rca1 === '') return false;
                return true;
            });

            // Calculate Metrics based on filtered clients
            // Since getMetricsForSupervisors only handles supervisor list, we need to rebuild metrics from scratch for arbitrary client list?
            // Or adapt getMetricsForSupervisors to accept client list?
            // getMetricsForSupervisors is a helper function I assume exists nearby? No, I don't see it in the grep.
            // Let's check if `getMetricsForSupervisors` exists. If not, the previous code block might have been hallucinated or I missed it.
            // Ah, line 4103: `const displayMetrics = getMetricsForSupervisors(selectedGoalsSummarySupervisors);`
            // Since I am modifying the filtering logic, I should likely implement a `getMetricsForClients(filteredSummaryClients)` or similar.
            // But let's look at `getMetricsForSupervisors` implementation first. It likely iterates `globalGoalsMetrics`?
            // No, `globalGoalsMetrics` is keyed by Product Category (707, etc.), NOT by Supervisor.
            // So `getMetricsForSupervisors` must be aggregating `globalClientGoals` for the filtered clients.

            // Let's assume we need to calculate display metrics from the filtered client list.
            const displayMetrics = calculateMetricsForClients(filteredSummaryClients);

            const activeSellersInSummary = new Set();
            filteredSummaryClients.forEach(c => {
                const rcaCode = String(c.rca1 || '').trim();
                if (rcaCode) {
                    const name = optimizedData.rcaNameByCode.get(rcaCode);
                    if (name) {
                        const upper = name.toUpperCase();
                        if (upper !== 'INATIVOS' && upper !== 'N/A' && !upper.includes('TOTAL') && !upper.includes('GERAL')) {
                            activeSellersInSummary.add(name);
                        }
                    }
                }
            });

            // 2. Sum up Revenue/Volume targets from `globalClientGoals` (Standard logic)
            const summaryGoalsSums = {
                [window.SUPPLIER_CODES.ELMA[0]]: { fat: 0, vol: 0 },
                [window.SUPPLIER_CODES.ELMA[1]]: { fat: 0, vol: 0 },
                [window.SUPPLIER_CODES.ELMA[2]]: { fat: 0, vol: 0 },
                [window.SUPPLIER_CODES.VIRTUAL.TODDYNHO]: { fat: 0, vol: 0 },
                [window.SUPPLIER_CODES.VIRTUAL.TODDY]: { fat: 0, vol: 0 },
                [window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO]: { fat: 0, vol: 0 }
            };

            filteredSummaryClients.forEach(c => {
                const codCli = c['Código'];
                const rcaCode = String(c.rca1 || '').trim();
                let sellerName = null;
                if (rcaCode) sellerName = optimizedData.rcaNameByCode.get(rcaCode);

                if (sellerName && activeSellersInSummary.has(sellerName)) {
                    if (globalClientGoals.has(codCli)) {
                        const cGoals = globalClientGoals.get(codCli);
                        cGoals.forEach((val, key) => {
                            if (summaryGoalsSums[key]) {
                                summaryGoalsSums[key].fat += val.fat;
                                summaryGoalsSums[key].vol += val.vol;
                            }
                        });
                    }
                }
            });

            // 3. Helper to calculate Total Positivation Target for a Category
            // Checks if a manual target exists for the seller; otherwise, calculates default (Natural + Adjustment)
            const calcTotalPosTarget = (category) => {
                let total = 0;
                activeSellersInSummary.forEach(sellerName => {
                    // Check for explicit target in `goalsSellerTargets`
                    const targets = goalsSellerTargets.get(sellerName);

                    // If target exists (and is not null/undefined), use it.
                    // Note: Import logic sets targets.
                    if (targets && targets[category] !== undefined && targets[category] !== null) {
                        total += targets[category];
                    } else {
                        // Fallback: Default Calculation
                        // Logic mirrors calculateSellerDefaults but handles specific categories
                        // Special handling for Mix
                        if (category === 'mix_salty') {
                            const defaults = calculateSellerDefaults(sellerName);
                            // defaults.mixSalty already includes adjustments
                            total += defaults.mixSalty;
                        } else if (category === 'mix_foods') {
                            const defaults = calculateSellerDefaults(sellerName);
                            total += defaults.mixFoods;
                        } else {
                            // Standard Category
                            const natural = getSellerNaturalCount(sellerName, category);
                            const adjMap = goalsPosAdjustments[category];
                            const adj = adjMap ? (adjMap.get(sellerName) || 0) : 0;
                            total += Math.max(0, natural + adj);
                        }
                    }
                });
                return total;
            };

            const summaryItems = [
                { title: 'Extrusados', supplier: window.SUPPLIER_CODES.ELMA[0], brand: null, color: 'teal' },
                { title: 'Não Extrusados', supplier: window.SUPPLIER_CODES.ELMA[1], brand: null, color: 'blue' },
                { title: 'Torcida', supplier: window.SUPPLIER_CODES.ELMA[2], brand: null, color: 'purple' },
                { title: 'Toddynho', supplier: window.SUPPLIER_CODES.FOODS[0], brand: 'TODDYNHO', color: 'orange' },
                { title: 'Toddy', supplier: window.SUPPLIER_CODES.FOODS[0], brand: 'TODDY', color: 'amber' },
                { title: 'Quaker / Kerococo', supplier: window.SUPPLIER_CODES.FOODS[0], brand: 'QUAKER_KEROCOCO', color: 'cyan' }
            ];

            let totalFat = 0;
            let totalVol = 0;

            const cardsHTML = summaryItems.map(item => {
                const key = item.supplier + (item.brand ? `_${item.brand}` : '');
                const target = summaryGoalsSums[key] || { fat: 0, vol: 0 };
                const metrics = displayMetrics[key] || { avgFat: 0, prevFat: 0 };

                let displayFat = target.fat;
                let displayVol = target.vol;

                if (displayFat < 0.01) displayFat = metrics.prevFat;
                if (displayVol < 0.001) displayVol = metrics.prevVol;

                totalFat += displayFat;
                totalVol += displayVol;

                // Calculate Pos Target using new Logic
                const posTarget = calcTotalPosTarget(key);

                const colorMap = {
                    teal: 'border-teal-500 text-teal-400 bg-teal-900/10',
                    blue: 'border-blue-500 text-blue-400 bg-blue-900/10',
                    purple: 'border-purple-500 text-purple-400 bg-purple-900/10',
                    orange: 'border-orange-500 text-orange-400 bg-orange-900/10',
                    amber: 'border-amber-500 text-amber-400 bg-amber-900/10',
                    cyan: 'border-cyan-500 text-cyan-400 bg-cyan-900/10'
                };

                const styleClass = colorMap[item.color] || colorMap.teal;
                const textColor = styleClass.split(' ')[1];

                return `
                    <div class="glass-panel border-l-4 ${styleClass.split(' ')[0]} rounded-r-lg p-4 shadow-md transition hover:-translate-y-1">
                        <h3 class="font-bold text-lg text-white mb-3 border-b border-slate-700 pb-2">${item.title}</h3>
                        <div class="space-y-4">
                            <div>
                                <div class="flex justify-between items-baseline mb-1">
                                    <p class="text-xs text-slate-300 uppercase font-semibold">Meta Faturamento</p>
                                </div>
                                <p class="text-xl font-bold ${textColor} mb-2">
                                    ${displayFat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                                <div class="flex justify-between text-[10px] text-slate-300 border-t border-slate-700/50 pt-1">
                                    <span>Trim: <span class="text-slate-300">${metrics.avgFat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></span>
                                    <span>Ant: <span class="text-slate-300">${metrics.prevFat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></span>
                                </div>
                            </div>

                            <div>
                                <div class="flex justify-between items-baseline mb-1">
                                    <p class="text-xs text-slate-300 uppercase font-semibold">Meta Volume (Kg)</p>
                                </div>
                                <p class="text-xl font-bold ${textColor} mb-2">
                                    ${displayVol.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                                </p>
                                <div class="flex justify-between text-[10px] text-slate-300 border-t border-slate-700/50 pt-1">
                                    <span>Trim: <span class="text-slate-300">${metrics.avgVol.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</span></span>
                                    <span>Ant: <span class="text-slate-300">${metrics.prevVol.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</span></span>
                                </div>
                            </div>

                            <div>
                                <div class="flex justify-between items-baseline mb-1">
                                    <p class="text-xs text-slate-300 uppercase font-semibold">Meta Pos. (Clientes)</p>
                                </div>
                                <p class="text-xl font-bold ${textColor} mb-2">
                                    ${posTarget.toLocaleString('pt-BR')}
                                </p>
                                <div class="flex justify-between text-[10px] text-slate-300 border-t border-slate-700/50 pt-1">
                                    <span>Ativos no Trimestre</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            container.innerHTML = cardsHTML;

            // Update Totals
            const totalFatEl = document.getElementById('summary-total-fat');
            const totalVolEl = document.getElementById('summary-total-vol');
            const totalPosEl = document.getElementById('summary-total-pos');
            const mixSaltyEl = document.getElementById('summary-mix-salty');
            const mixFoodsEl = document.getElementById('summary-mix-foods');

            if(totalFatEl) totalFatEl.textContent = totalFat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            if(totalVolEl) totalVolEl.textContent = totalVol.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

            // Top Bar KPIs using same calculation logic
            const totalPosTarget = calcTotalPosTarget('pepsico_all'); // Use generic 'pepsico_all' key for Total Pos?
            // Note: Imported target for Total Pos usually comes as 'pepsico_all'.
            // If individual categories are set but not pepsico_all, what happens?
            // The user imports 'GERAL' which maps to 'pepsico_all'.
            if(totalPosEl) totalPosEl.textContent = totalPosTarget.toLocaleString('pt-BR');

            const mixSaltyTarget = calcTotalPosTarget('mix_salty');
            if(mixSaltyEl) mixSaltyEl.textContent = mixSaltyTarget.toLocaleString('pt-BR');

            const mixFoodsTarget = calcTotalPosTarget('mix_foods');
            if(mixFoodsEl) mixFoodsEl.textContent = mixFoodsTarget.toLocaleString('pt-BR');
        }

        function getElmaTargetBase(displayMetrics, goalsPosAdjustments, activeSellersSet) {
            // MATCH LOGIC WITH "RELATÓRIO" (SV): Base is "Total ELMA" (707, 708, 752)
            // Logic derived from `updateGoalsSvView`:
            // - The Grand Total for Mix Salty/Foods EXCLUDES Americanas (Seller 1001) from the base.
            // - It INCLUDES normal clients.

            // 1. Iterate ALL valid clients (Active Structure)
            // 2. EXCLUDE Americanas (RCA 1001) for this specific KPI base (matches SV footer logic)
            // 3. Exclude Balcão (53) and Inativos
            // 4. Check if Client has > 1 Total Sales in History (Elma: 707, 708, 752)
            // 5. Match Active Sellers

            let naturalCount = 0;

            // Iterate all clients (global allClientsData)
            // Use standard loop for performance
            for (let i = 0; i < allClientsData.length; i++) {
                const client = allClientsData instanceof ColumnarDataset ? allClientsData.get(i) : allClientsData[i];
                const codCli = String(client['Código'] || client['codigo_cliente']);

                // 1. Exclusions (Structure)
                const rca1 = String(client.rca1 || '').trim();
                const isAmericanas = (client.razaoSocial || '').toUpperCase().includes('AMERICANAS');

                // Exclude Americanas (Specific Rule for Mix Base)
                if (rca1 === '1001' || isAmericanas) continue;

                // Exclude Balcão (53) and Inativos
                if (rca1 === '53' || rca1 === '') continue;

                // 2. Active Seller Check
                let belongsToActiveSeller = true;
                if (activeSellersSet && activeSellersSet.size > 0) {
                    let sellerName = 'N/A';
                    // In SV, we map rcas[0] to Name.
                    const rcaCode = (client.rcas && client.rcas.length > 0) ? client.rcas[0] : '';
                    if (rcaCode) {
                         sellerName = optimizedData.rcaNameByCode.get(rcaCode) || rcaCode;
                    } else {
                        sellerName = 'INATIVOS';
                    }

                    // Strict Exclusion of INATIVOS from Base Calculation
                    if (sellerName === 'INATIVOS') continue;

                    if (!activeSellersSet.has(sellerName)) belongsToActiveSeller = false;
                }

                if (!belongsToActiveSeller) continue;

                // 3. Check History (Positive ELMA: 707, 708, 752)
                const hIds = optimizedData.indices.history.byClient.get(normalizeKey(codCli));
                let totalFat = 0;
                if (hIds) {
                    // hIds is Set<string> (id)
                    for (const id of hIds) {
                        const s = optimizedData.historyById.get(id);
                        const codFor = String(s.CODFOR);
                         if (window.SUPPLIER_CODES.ELMA.includes(codFor)) {
                            if (s.TIPOVENDA === '1' || s.TIPOVENDA === '9') totalFat += s.VLVENDA;
                        }
                    }
                }

                if (totalFat >= 1) {
                    naturalCount++;
                }
            }

            // 2. Adjustments (Meta Pos) - Preserve Logic
            let adjustment = 0;
            const elmaAdj = goalsPosAdjustments['ELMA_ALL'];
            if (elmaAdj) {
                elmaAdj.forEach((val, sellerName) => {
                    // Check if seller is in current view (activeSellersSet)
                    if (!activeSellersSet || activeSellersSet.has(sellerName)) {
                        adjustment += val;
                    }
                });
            }

            return naturalCount + adjustment;
        }

                function calculateDistributedGoals(filteredClients, currentGoalsSupplier, currentGoalsBrand, goalFat, goalVol) {
            const cacheKey = currentGoalsSupplier + (currentGoalsBrand ? `_${currentGoalsBrand}` : '');

            if (quarterMonths.length === 0) identifyQuarterMonths();

            // Determine dates for Previous Month calc
            const currentDate = lastSaleDate;
            const prevMonthDate = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() - 1, 1));
            const prevMonthIndex = prevMonthDate.getUTCMonth();
            const prevMonthYear = prevMonthDate.getUTCFullYear();

            // --- CÁLCULO DOS TOTAIS GLOBAIS (EMPRESA) PARA O FORNECEDOR/MARCA ATUAL ---
            let globalTotalAvgFat = 0;
            let globalTotalAvgVol = 0;

            const shouldIncludeSale = (sale, supplier, brand) => {
                const codFor = String(sale.CODFOR);
                if (supplier === 'PEPSICO_ALL') {
                    // Includes everything
                    if (!window.SUPPLIER_CODES.PEPSICO.includes(codFor)) return false;
                } else if (supplier === 'ELMA_ALL') {
                    if (!window.SUPPLIER_CODES.ELMA.includes(codFor)) return false;
                } else if (supplier === 'FOODS_ALL') {
                    // Include all brands of 1119 that are in sub-tabs
                    if (codFor !== window.SUPPLIER_CODES.FOODS[0]) return false;
                    // No brand filtering here, assuming 1119 contains mostly Foods
                } else {
                    if (codFor !== supplier) return false;
                    if (brand) {
                        const desc = normalize(sale.DESCRICAO || '');
                        if (brand === 'TODDYNHO') {
                            if (!desc.includes('TODDYNHO')) return false;
                        } else if (brand === 'TODDY') {
                            if (!desc.includes('TODDY') || desc.includes('TODDYNHO')) return false;
                        } else if (brand === 'QUAKER_KEROCOCO') {
                            if (!desc.includes('QUAKER') && !desc.includes('KEROCOCO')) return false;
                        }
                    }
                }
                return true;
            };

            if (globalGoalsTotalsCache[cacheKey]) {
                globalTotalAvgFat = globalGoalsTotalsCache[cacheKey].fat;
                globalTotalAvgVol = globalGoalsTotalsCache[cacheKey].vol;
            } else {
                const allActiveClients = allClientsData.filter(c => {
                    const rca1 = String(c.rca1 || '').trim();
                    const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');
                    if (isAmericanas) return true;
                // STRICT FILTER: Exclude RCA 53 (Balcão) and INATIVOS
                    if (rca1 === '53') return false;
                if (rca1 === '') return false; // Exclude INATIVOS
                    return true;
                });

                allActiveClients.forEach(client => {
                    const codCli = String(client['Código'] || client['codigo_cliente']);
                    const clientHistoryIds = optimizedData.indices.history.byClient.get(normalizeKey(codCli));
                    if (clientHistoryIds) {
                        let sumFat = 0;
                        let sumVol = 0;
                        clientHistoryIds.forEach(id => {
                            const sale = optimizedData.historyById.get(id);
                            // EXCEPTION: Exclude Balcão (53) sales for Client 9569 from Global Portfolio Totals
                            if (String(codCli).trim() === '9569' && (String(sale.CODUSUR).trim() === '53' || String(sale.CODUSUR).trim() === '053')) return;

                            if (shouldIncludeSale(sale, currentGoalsSupplier, currentGoalsBrand)) {
                                if (sale.TIPOVENDA === '1' || sale.TIPOVENDA === '9') {
                                    sumFat += sale.VLVENDA;
                                    sumVol += sale.TOTPESOLIQ;
                                }
                            }
                        });

                        // NEW LOGIC: Simple Average (Sum / 3) regardless of active months
                        globalTotalAvgFat += (sumFat / QUARTERLY_DIVISOR);
                        globalTotalAvgVol += (sumVol / QUARTERLY_DIVISOR); // Kg (No / 1000)
                    }
                });

                globalGoalsTotalsCache[cacheKey] = { fat: globalTotalAvgFat, vol: globalTotalAvgVol };
            }

            const clientMetrics = [];

            filteredClients.forEach(client => {
                const codCli = String(client['Código'] || client['codigo_cliente']);
                const clientHistoryIds = optimizedData.indices.history.byClient.get(normalizeKey(codCli));

                let sumFat = 0;
                let sumVol = 0;
                let prevFat = 0;
                let prevVol = 0;
                const monthlyActivity = new Map(); // MonthKey -> Fat

                // Initialize monthly values for breakdown
                const monthlyValues = {};
                quarterMonths.forEach(m => monthlyValues[m.key] = 0);

                if (clientHistoryIds) {
                    clientHistoryIds.forEach(id => {
                        const sale = optimizedData.historyById.get(id);
                        // EXCEPTION: Exclude Balcão (53) sales for Client 9569 from Portfolio Average
                        if (String(codCli).trim() === '9569' && (String(sale.CODUSUR).trim() === '53' || String(sale.CODUSUR).trim() === '053')) return;

                        if (shouldIncludeSale(sale, currentGoalsSupplier, currentGoalsBrand)) {
                            if (sale.TIPOVENDA === '1' || sale.TIPOVENDA === '9') {
                                sumFat += sale.VLVENDA;
                                sumVol += sale.TOTPESOLIQ;

                                const d = parseDate(sale.DTPED);
                                if (d) {
                                    // Previous Month Calc
                                    if (d.getUTCMonth() === prevMonthIndex && d.getUTCFullYear() === prevMonthYear) {
                                        prevFat += sale.VLVENDA;
                                        prevVol += sale.TOTPESOLIQ;
                                    }

                                    // Activity per Month Calc
                                    const monthKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
                                    monthlyActivity.set(monthKey, (monthlyActivity.get(monthKey) || 0) + sale.VLVENDA);

                                    if (monthlyValues.hasOwnProperty(monthKey)) {
                                        monthlyValues[monthKey] += sale.VLVENDA;
                                    }
                                }
                            }
                        }
                    });
                }

                // NEW LOGIC: Simple Average (Sum / 3) regardless of active months
                const avgFat = sumFat / QUARTERLY_DIVISOR;
                const avgVol = sumVol / QUARTERLY_DIVISOR; // Kg (No / 1000)

                let activeMonthsCount = 0;
                monthlyActivity.forEach(val => { if(val >= 1) activeMonthsCount++; });

                const isActivePrevMonth = prevFat >= 1 ? 1 : 0;

                let sellerName = 'N/A';
                const rcaCode = client.rcas[0];
                if (rcaCode) sellerName = optimizedData.rcaNameByCode.get(rcaCode) || rcaCode;
                else if (client.rcas.length === 0 || client.rcas[0] === '') sellerName = 'INATIVOS';

                // Retrieve Stored Goal
                let metaFat = 0;
                let metaVol = 0;

                if (currentGoalsSupplier === 'ELMA_ALL' || currentGoalsSupplier === 'FOODS_ALL' || currentGoalsSupplier === 'PEPSICO_ALL') {
                    if (globalClientGoals.has(codCli)) {
                        const cGoals = globalClientGoals.get(codCli);
                        let keysToSum = [];
                        if (currentGoalsSupplier === 'ELMA_ALL') keysToSum = window.SUPPLIER_CODES.ELMA;
                        else if (currentGoalsSupplier === 'FOODS_ALL') keysToSum = window.SUPPLIER_CODES.VIRTUAL_LIST;
                        else if (currentGoalsSupplier === 'PEPSICO_ALL') keysToSum = window.SUPPLIER_CODES.ALL_GOALS;

                        keysToSum.forEach(k => {
                            if (cGoals.has(k)) {
                                const g = cGoals.get(k);
                                metaFat += g.fat;
                                metaVol += g.vol;
                            }
                        });
                    }
                } else {
                    if (globalClientGoals.has(codCli)) {
                        const cGoals = globalClientGoals.get(codCli);
                        if (cGoals.has(cacheKey)) {
                            const g = cGoals.get(cacheKey);
                            metaFat = g.fat;
                            metaVol = g.vol;
                        }
                    }
                }

                const metaPos = (sumFat >= 1 && avgFat > 0) ? 1 : 0; // Positivado se venda >= 1 (threshold padrão)

                clientMetrics.push({
                    cod: codCli,
                    name: client.fantasia || client.razaoSocial,
                    seller: sellerName,
                    avgFat,
                    avgVol, // Now Kg
                    prevFat,
                    prevVol: prevVol, // Now Kg (removed / 1000)
                    activeMonthsCount,
                    isActivePrevMonth,
                    shareFat: (globalTotalAvgFat > 0 && avgFat > 0) ? (avgFat / globalTotalAvgFat) : 0,
                    shareVol: (globalTotalAvgVol > 0 && avgVol > 0) ? (avgVol / globalTotalAvgVol) : 0,
                    metaFat: metaFat,
                    metaVol: metaVol,
                    metaPos: metaPos,
                    monthlyBreakdown: monthlyValues
                });
            });

            // Calculate auto distribution if goal is set but individual goals are zero (first run)
            const totalShareFat = clientMetrics.reduce((sum, c) => sum + c.shareFat, 0);
            const totalShareVol = clientMetrics.reduce((sum, c) => sum + c.shareVol, 0);

            // If we have input goals, we can distribute them proportionally (Visual only, not saved unless clicked)
            // But here we just return the metrics. The view uses these metrics.

            return { clientMetrics, globalTotalAvgFat, globalTotalAvgVol };
        }

        function recalculateTotalGoals() {
            // Reset goalsTargets sums
            for (const key in goalsTargets) {
                goalsTargets[key] = { fat: 0, vol: 0 };
            }

            globalClientGoals.forEach((goalsMap, codCli) => {
                goalsMap.forEach((val, key) => {
                    if (goalsTargets[key]) {
                        goalsTargets[key].fat += val.fat;
                        goalsTargets[key].vol += val.vol;
                    }
                });
            });
        }

        function distributeGoals(type) {
            const inputId = type === 'fat' ? 'goal-global-fat' : 'goal-global-vol';
            const inputValue = parseInputMoney(inputId);

            const filteredClients = getGoalsFilteredData();
            if (filteredClients.length === 0) return;

            let keysToProcess = [];
            if (currentGoalsSupplier === 'PEPSICO_ALL') {
                keysToProcess = window.SUPPLIER_CODES.ALL_GOALS;
            } else if (currentGoalsSupplier === 'ELMA_ALL') {
                keysToProcess = window.SUPPLIER_CODES.ELMA;
            } else if (currentGoalsSupplier === 'FOODS_ALL') {
                keysToProcess = window.SUPPLIER_CODES.VIRTUAL_LIST;
            } else {
                const cacheKey = currentGoalsSupplier + (currentGoalsBrand ? `_${currentGoalsBrand}` : '');
                keysToProcess = [cacheKey];
            }

            // 1. Calculate Total Denominator (Sum of Averages of all target keys for all filtered clients)
            let totalDenominator = 0;
            const distributionMap = new Map(); // Map<ClientCod, Map<Key, AvgValue>>

            filteredClients.forEach(client => {
                const codCli = String(client['Código'] || client['codigo_cliente']);
                const clientHistoryIds = optimizedData.indices.history.byClient.get(normalizeKey(codCli));

                if (!distributionMap.has(codCli)) distributionMap.set(codCli, new Map());
                const clientMap = distributionMap.get(codCli);

                keysToProcess.forEach(targetKey => {
                    let sumVal = 0;
                    if (clientHistoryIds) {
                        clientHistoryIds.forEach(id => {
                            const sale = optimizedData.historyById.get(id);

                            // Check if sale belongs to targetKey
                            let saleKey = String(sale.CODFOR);
                            const codFor = String(sale.CODFOR);

                            // Special handling for broken down categories (FOODS)
                            if (codFor === window.SUPPLIER_CODES.FOODS[0]) {
                                const desc = normalize(sale.DESCRICAO || '');
                                if (desc.includes('TODDYNHO')) saleKey = window.SUPPLIER_CODES.VIRTUAL.TODDYNHO;
                                else if (desc.includes('TODDY')) saleKey = window.SUPPLIER_CODES.VIRTUAL.TODDY;
                                else if (desc.includes('QUAKER') || desc.includes('KEROCOCO')) saleKey = window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO;
                                else if (targetKey.startsWith('1119_')) saleKey = null; // If targeting a sub-brand but this product doesn't match, exclude it
                            }

                            if (saleKey === targetKey) {
                                if (sale.TIPOVENDA === '1' || sale.TIPOVENDA === '9') {
                                    if (type === 'fat') sumVal += sale.VLVENDA;
                                    else sumVal += sale.TOTPESOLIQ;
                                }
                            }
                        });
                    }

                    // Apply divisor
                    let avg = sumVal / QUARTERLY_DIVISOR;
                    if (type === 'vol') avg = avg / 1000; // Tons

                    clientMap.set(targetKey, avg);
                    totalDenominator += avg;
                });
            });

            // 2. Distribute
            filteredClients.forEach(client => {
                const codCli = String(client['Código'] || client['codigo_cliente']);
                const clientMap = distributionMap.get(codCli);

                if (!globalClientGoals.has(codCli)) globalClientGoals.set(codCli, new Map());
                const cGoals = globalClientGoals.get(codCli);

                keysToProcess.forEach(key => {
                    const avg = clientMap.get(key) || 0;
                    let share = totalDenominator > 0 ? (avg / totalDenominator) : 0;

                    if (totalDenominator === 0) {
                         const totalItems = filteredClients.length * keysToProcess.length;
                         if (totalItems > 0) share = 1 / totalItems;
                    }

                    const newGoal = share * inputValue;

                    if (!cGoals.has(key)) cGoals.set(key, { fat: 0, vol: 0 });
                    const g = cGoals.get(key);

                    if (type === 'fat') g.fat = newGoal;
                    else g.vol = newGoal;
                });
            });

            recalculateTotalGoals();
            updateGoalsView();
        }

        function showConfirmationModal(message, onConfirm) {
            const modal = document.getElementById('confirmation-modal');
            const msgEl = document.getElementById('confirmation-message');
            const confirmBtn = document.getElementById('confirmation-confirm-btn');
            const cancelBtn = document.getElementById('confirmation-cancel-btn');

            msgEl.textContent = message;
            modal.classList.remove('hidden');

            // Clean up old listeners to avoid duplicates
            const newConfirmBtn = confirmBtn.cloneNode(true);
            const newCancelBtn = cancelBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

            newConfirmBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
                onConfirm();
            });

            newCancelBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }

        function getFilterDescription() {
            if (hierarchyState['goals-gv'] && (hierarchyState['goals-gv'].coords.size > 0 || hierarchyState['goals-gv'].promotors.size > 0)) {
                 // return 'filtro hierarquia';
            }
            if (goalsGvCodcliFilter.value) {
                return `Cliente "${goalsGvCodcliFilter.value}"`;
            }

            // Default to Tab Name
            if (currentGoalsSupplier === window.SUPPLIER_CODES.ELMA[0]) return 'EXTRUSADOS';
            if (currentGoalsSupplier === window.SUPPLIER_CODES.ELMA[1]) return 'NÃO EXTRUSADOS';
            if (currentGoalsSupplier === window.SUPPLIER_CODES.ELMA[2]) return 'TORCIDA';
            if (currentGoalsBrand) return currentGoalsBrand;

            return 'filtro atual';
        }

        function saveMixAdjustment(type, value, sellerName) {
            // Find natural base for this seller based on ELMA metrics (excluding Americanas)
            const sellerCode = optimizedData.rcaCodeByName.get(sellerName);

            // Re-use logic for Active Clients counting
            const sellerClients = allClientsData.filter(c => {
                const rca1 = String(c.rca1 || '').trim();
                if (!sellerCode) return false;

                // Is client active check (Same as others)
                // Exclude Americanas explicitly from this calculation as per requirement
                const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');
                if (isAmericanas || (rca1 === '53' || rca1 === '053' || rca1 === '' || rca1 === 'INATIVOS')) return false;

                // Does client belong to seller? (Current Hierarchy)
                return c.rcas.includes(sellerCode);
            });

            let naturalCount = 0;
            // Count "Meta Pos" (Revenue > 1 in ELMA_ALL: 707, 708, 752) for these clients
            sellerClients.forEach(c => {
                const codCli = c['Código'];
                const hIds = optimizedData.indices.history.byClient.get(normalizeKey(codCli));
                let sumFat = 0;
                if (hIds) {
                    hIds.forEach(id => {
                        const s = optimizedData.historyById.get(id);
                        if (window.SUPPLIER_CODES.ELMA.includes(String(s.CODFOR))) {
                            if (s.TIPOVENDA === '1' || s.TIPOVENDA === '9') sumFat += s.VLVENDA;
                        }
                    });
                }
                if (sumFat >= 1) naturalCount++;
            });

            // Check if seller has specific adjustment for ELMA_ALL (Meta Pos)
            let adjustmentPos = 0;
            if (goalsPosAdjustments['ELMA_ALL'] && goalsPosAdjustments['ELMA_ALL'].has(sellerName)) {
                adjustmentPos = goalsPosAdjustments['ELMA_ALL'].get(sellerName);
            }

            // Base = Natural Elma Count + Elma Adjustment
            const totalElmaBase = naturalCount + adjustmentPos;

            // Apply 50% / 30% rule
            const base = type === 'salty' ? Math.round(totalElmaBase * 0.50) : Math.round(totalElmaBase * 0.30);
            const adjustment = value - base;

            // ALWAYS STORE IN PEPSICO_ALL (Unify Inputs)
            if (type === 'salty') {
                if (!goalsMixSaltyAdjustments['PEPSICO_ALL']) goalsMixSaltyAdjustments['PEPSICO_ALL'] = new Map();
                goalsMixSaltyAdjustments['PEPSICO_ALL'].set(sellerName, adjustment);
            } else {
                if (!goalsMixFoodsAdjustments['PEPSICO_ALL']) goalsMixFoodsAdjustments['PEPSICO_ALL'] = new Map();
                goalsMixFoodsAdjustments['PEPSICO_ALL'].set(sellerName, adjustment);
            }

            updateGoalsView();
        }


        function exportGoalsGvPDF() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape');
            const data = goalsTableState.filteredData;

            if (!data || data.length === 0) {
                window.showToast('warning', 'Sem dados para exportar.');
                return;
            }

            const generationDate = new Date().toLocaleString('pt-BR');
            const supervisor = document.getElementById('goals-gv-supervisor-filter-text').textContent;
            const seller = document.getElementById('goals-gv-seller-filter-text').textContent;

            doc.setFontSize(18);
            doc.text('Relatório Rateio de Metas (GV)', 14, 22);
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Data de Emissão: ${generationDate}`, 14, 30);
            doc.text(`Filtros: Supervisor: ${supervisor} | Vendedor: ${seller}`, 14, 36);

            const monthLabels = quarterMonths.map(m => m.label);
            const head = [[
                'CÓD', 'CLIENTE', 'VEND',
                ...monthLabels,
                'MÉDIA R$', 'SHARE %', 'META R$',
                'META KG', 'MIX PDV'
            ]];

            const body = data.map(item => [
                item.cod,
                (item.name || '').substring(0, 25),
                getFirstName(item.seller),
                ...quarterMonths.map(m => (item.monthlyValues[m.key] || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})),
                item.avgFat.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
                (item.shareFat * 100).toFixed(2) + '%',
                item.metaFat.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
                item.metaVol.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3}),
                (item.mixPdv || 0).toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})
            ]);

            doc.autoTable({
                head: head,
                body: body,
                startY: 45,
                theme: 'grid',
                styles: { fontSize: 7, cellPadding: 1, textColor: [0, 0, 0], halign: 'right' },
                headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center' },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 12 },
                    1: { halign: 'left', cellWidth: 40 },
                    2: { halign: 'left', cellWidth: 20 },
                    // Dynamic styling for months?
                },
                didParseCell: function(data) {
                    if (data.section === 'body' && data.column.index === head[0].length - 1) { // Mix PDV Column
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.textColor = [128, 0, 128]; // Purple
                    }
                }
            });

            let nameParam = '';
            // Simplified name param for now

            const safeFileNameParam = currentGoalsSupplier.replace(/[^a-z0-9]/gi, '_').toUpperCase();
            doc.save(`Metas_GV_${safeFileNameParam}${nameParam}.pdf`);
        }

        function exportGoalsCurrentTabXLSX() {
            const data = goalsTableState.filteredData;
            if (!data || data.length === 0) {
                window.showToast('warning', 'Sem dados para exportar.');
                return;
            }

            const wb = XLSX.utils.book_new();

            // 1. Headers
            const monthLabels = quarterMonths.map(m => m.label);
            const flatHeaders = [
                'CÓD', 'CLIENTE', 'VENDEDOR',
                ...monthLabels.map(m => `${m} (FAT)`),
                'MÉDIA FAT', '% SHARE FAT', 'META FAT',
                'MÉDIA VOL (KG)', '% SHARE VOL', 'META VOL (KG)', 'MIX PDV'
            ];

            const ws_data_flat = [flatHeaders];
             data.forEach(item => {
                const row = [
                    parseInt(item.cod),
                    item.name,
                    getFirstName(item.seller),
                    ...quarterMonths.map(m => item.monthlyValues[m.key] || 0),
                    item.avgFat,
                    item.shareFat,
                    item.metaFat,
                    item.avgVol,
                    item.shareVol,
                    item.metaVol,
                    item.mixPdv // Export calculated Mix PDV
                ];
                ws_data_flat.push(row);
            });

            const ws_flat = XLSX.utils.aoa_to_sheet(ws_data_flat);

             // Style Header
            if (ws_flat['!ref']) {
                const range = XLSX.utils.decode_range(ws_flat['!ref']);
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
                    if (!ws_flat[addr]) continue;
                    if (!ws_flat[addr].s) ws_flat[addr].s = {};
                    ws_flat[addr].s.fill = { fgColor: { rgb: "1E293B" } };
                    ws_flat[addr].s.font = { color: { rgb: "FFFFFF" }, bold: true };
                    ws_flat[addr].s.alignment = { horizontal: "center" };
                }

                // Number formats
                for (let R = 1; R <= range.e.r; ++R) {
                     // Month Cols start at 3
                     const monthStart = 3;
                     const monthEnd = 3 + quarterMonths.length - 1;

                     for (let C = monthStart; C <= range.e.c; ++C) {
                          const addr = XLSX.utils.encode_cell({ r: R, c: C });
                          if (!ws_flat[addr]) continue;
                          if (!ws_flat[addr].s) ws_flat[addr].s = {};
                          ws_flat[addr].t = 'n';

                          // Percentages (Indices relative to monthEnd)
                          // Header: [COD, CLI, VEND, M1, M2, M3, AVG, SHARE, META, AVG_V, SHARE, META_V, POS]
                          // M3 is monthEnd.
                          // AVG is monthEnd+1
                          // SHARE is monthEnd+2
                          // META is monthEnd+3
                          // AVG_V is monthEnd+4
                          // SHARE_V is monthEnd+5
                          // META_V is monthEnd+6
                          // POS is monthEnd+7

                          if (C === monthEnd + 2 || C === monthEnd + 5) {
                              ws_flat[addr].z = '0.00%';
                          }
                          // Volumes (TON)
                          else if (C === monthEnd + 4 || C === monthEnd + 6) {
                              ws_flat[addr].z = '#,##0.000';
                          }
                          // Currency/Values
                          else if (C <= monthEnd + 3) {
                              ws_flat[addr].z = '#,##0.00';
                          }
                     }
                }

                ws_flat['!cols'] = [
                    { wch: 8 }, { wch: 35 }, { wch: 15 },
                    ...quarterMonths.map(_ => ({ wch: 15 })),
                    { wch: 15 }, { wch: 10 }, { wch: 15 },
                    { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 8 }
                ];
            }

            XLSX.utils.book_append_sheet(wb, ws_flat, "Metas GV");

            let nameParam = '';
            // Simplified name param for now

            const safeFileNameParam = currentGoalsSupplier.replace(/[^a-z0-9]/gi, '_').toUpperCase();
            XLSX.writeFile(wb, `Metas_GV_${safeFileNameParam}${nameParam}.xlsx`);
        }

        function getSellerTargetOverride(sellerName, metricType, context) {
            if (!goalsSellerTargets || !goalsSellerTargets.has(sellerName)) return null;
            const targets = goalsSellerTargets.get(sellerName);

            if (metricType === 'mix_salty') return targets['mix_salty'] !== undefined ? targets['mix_salty'] : null;
            if (metricType === 'mix_foods') return targets['mix_foods'] !== undefined ? targets['mix_foods'] : null;

            if (metricType === 'pos') {
                if (context === 'ELMA_ALL' || context === 'ELMA') return targets['total_elma'] !== undefined ? targets['total_elma'] : null;
                if (context === 'FOODS_ALL' || context === 'FOODS') return targets['total_foods'] !== undefined ? targets['total_foods'] : null;
                if (context === 'PEPSICO_ALL' || context === 'PEPSICO') {
                    // Check pepsico_all first (new standard) then GERAL (legacy)
                    if (targets['pepsico_all'] !== undefined) return targets['pepsico_all'];
                    if (targets['GERAL'] !== undefined) return targets['GERAL'];
                    return null;
                }
                // Check direct key match (e.g. 707, 708, 1119_TODDYNHO)
                if (targets[context] !== undefined) return targets[context];
            }
            return null;
        }

        // Helper to get historical positivation count for a seller/category
        function getHistoricalPositivation(sellerName, category) {
            const sellerCode = optimizedData.rcaCodeByName.get(sellerName);
            if (!sellerCode) return 0;

            const clients = optimizedData.clientsByRca.get(sellerCode) || [];
            // Filter active clients same as main view
            const activeClients = clients.filter(c => {
                const cod = String(c['Código'] || c['codigo_cliente']);
                const rca1 = String(c.rca1 || '').trim();
                const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');
                return (isAmericanas || rca1 !== '53' || clientsWithSalesThisMonth.has(cod));
            });

            let count = 0;
            // Identify which products belong to this category
            // Reuse logic from 'shouldIncludeSale' or similar but specific to categories
            // Mapping Category -> Condition
            const checkSale = (codFor, desc) => {
                if (category === 'pepsico_all') return window.SUPPLIER_CODES.PEPSICO.includes(codFor);
                if (category === 'total_elma') return window.SUPPLIER_CODES.ELMA.includes(codFor);
                if (category === 'total_foods') return codFor === window.SUPPLIER_CODES.FOODS[0];

                // Specifics
                if (category === window.SUPPLIER_CODES.ELMA[0]) return codFor === window.SUPPLIER_CODES.ELMA[0];
                if (category === window.SUPPLIER_CODES.ELMA[1]) return codFor === window.SUPPLIER_CODES.ELMA[1];
                if (category === window.SUPPLIER_CODES.ELMA[2]) return codFor === window.SUPPLIER_CODES.ELMA[2];
                if (category === window.SUPPLIER_CODES.VIRTUAL.TODDYNHO) return window.isFoods(codFor) && desc.includes('TODDYNHO');
                if (category === window.SUPPLIER_CODES.VIRTUAL.TODDY) return window.isFoods(codFor) && desc.includes('TODDY') && !desc.includes('TODDYNHO');
                if (category === window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO) return window.isFoods(codFor) && (desc.includes('QUAKER') || desc.includes('KEROCOCO'));

                return false;
            };

            activeClients.forEach(client => {
                const codCli = String(client['Código'] || client['codigo_cliente']);
                const historyIds = optimizedData.indices.history.byClient.get(normalizeKey(codCli));
                if (historyIds) {
                    // Check if client bought ANY product in category
                    for (let id of historyIds) {
                        const sale = optimizedData.historyById.get(id);
                        const codFor = String(sale.CODFOR);
                        const desc = normalize(sale.DESCRICAO || '');

                        // Check Rev Type only? Usually yes for Positivação.
                        if ((sale.TIPOVENDA === '1' || sale.TIPOVENDA === '9') && checkSale(codFor, desc)) {
                            count++;
                            break; // Counted this client
                        }
                    }
                }
            });
            return count;
        }

        function distributeDown(sellerName, parentCategory, parentTargetValue) {
            // Recursive Cascade
            let children = [];
            if (parentCategory === 'pepsico_all') children = ['total_elma', 'total_foods'];
            else if (parentCategory === 'total_elma') children = window.SUPPLIER_CODES.ELMA;
            else if (parentCategory === 'total_foods') children = window.SUPPLIER_CODES.VIRTUAL_LIST;

            if (children.length === 0) return;

            // 1. Get History for Children
            const childHistories = children.map(child => ({
                cat: child,
                hist: getHistoricalPositivation(sellerName, child)
            }));

            const parentHistory = getHistoricalPositivation(sellerName, parentCategory);

            childHistories.forEach(item => {
                let ratio = 0;
                if (parentHistory > 0) {
                    ratio = item.hist / parentHistory;
                }

                // New Target
                const childTarget = Math.round(parentTargetValue * ratio);

                // Update Seller Targets
                if (!goalsSellerTargets.has(sellerName)) goalsSellerTargets.set(sellerName, {});
                const t = goalsSellerTargets.get(sellerName);
                t[item.cat] = childTarget;

                // Recurse
                distributeDown(sellerName, item.cat, childTarget);
            });
        }

        function handleDistributePositivation(totalGoal, contextKey, filteredClientMetrics) {
            // filteredClientMetrics contains the list of sellers currently visible/active
            // We should distribute ONLY to them.

            // Map Context Key (Tab) to Target Key
            let targetKey = contextKey;
            if (contextKey === 'PEPSICO_ALL') targetKey = 'pepsico_all';
            if (contextKey === 'ELMA_ALL') targetKey = 'total_elma';
            if (contextKey === 'FOODS_ALL') targetKey = 'total_foods';

            // 1. Calculate Total History for THESE sellers in THIS context
            let totalHistoryPos = 0;
            const sellersHistory = [];

            // Group by Seller to avoid duplicates if clientMetrics has multiple rows per seller?
            // clientMetrics is PER CLIENT. So we need to aggregate unique sellers first.
            const uniqueSellers = new Set(filteredClientMetrics.map(c => c.seller));

            uniqueSellers.forEach(seller => {
                const hist = getHistoricalPositivation(seller, targetKey);
                sellersHistory.push({ seller, hist });
                totalHistoryPos += hist;
            });

            // 2. Distribute Total Goal
            // We use Largest Remainder Method or simple rounding? Simple rounding for now.

            sellersHistory.forEach(item => {
                let share = 0;
                if (totalHistoryPos > 0) {
                    share = item.hist / totalHistoryPos;
                }

                // If totalHistory is 0 but we have a Goal, distribute evenly?
                // Or leave 0? User said "proporcional". 0 history -> 0 share seems fair.

                const sellerTarget = Math.round(totalGoal * share);

                // Update Primary Target
                if (!goalsSellerTargets.has(item.seller)) goalsSellerTargets.set(item.seller, {});
                const t = goalsSellerTargets.get(item.seller);
                t[targetKey] = sellerTarget;

                // 3. Cascade Down
                distributeDown(item.seller, targetKey, sellerTarget);
            });

            // Auto-Redistribute Mix for PEPSICO_ALL context
            if (contextKey === 'PEPSICO_ALL') {
                const newSalty = Math.round(totalGoal * 0.50);
                const newFoods = Math.round(totalGoal * 0.30);

                // Update UI Inputs
                const inputSalty = document.getElementById('goal-global-mix-salty');
                const inputFoods = document.getElementById('goal-global-mix-foods');
                if(inputSalty) inputSalty.value = newSalty.toLocaleString('pt-BR');
                if(inputFoods) inputFoods.value = newFoods.toLocaleString('pt-BR');

                // Distribute Mix Targets
                // Note: handleDistributeMix calls updateGoalsView at the end.
                handleDistributeMix(newSalty, 'salty', contextKey, filteredClientMetrics);
                handleDistributeMix(newFoods, 'foods', contextKey, filteredClientMetrics);
            } else {
                // Trigger View Update normally
                updateGoalsView();
            }
        }

        function handleDistributeMix(totalGoal, type, contextKey, filteredClientMetrics) {
            let targetKey = type === 'salty' ? 'mix_salty' : 'mix_foods';

            // 1. Calculate Total History for THESE sellers in THIS context
            let totalHistoryMix = 0;
            const sellersHistory = [];

            const uniqueSellers = new Set(filteredClientMetrics.map(c => c.seller));

            uniqueSellers.forEach(seller => {
                const hist = getHistoricalMix(seller, type);
                sellersHistory.push({ seller, hist });
                totalHistoryMix += hist;
            });

            // 2. Distribute Total Goal
            sellersHistory.forEach(item => {
                let share = 0;
                if (totalHistoryMix > 0) {
                    share = item.hist / totalHistoryMix;
                }

                const sellerTarget = Math.round(totalGoal * share);

                // Update Primary Target
                if (!goalsSellerTargets.has(item.seller)) goalsSellerTargets.set(item.seller, {});
                const t = goalsSellerTargets.get(item.seller);
                t[targetKey] = sellerTarget;
            });

            // Trigger View Update
            updateGoalsView();
        }

        function updateGoalsView() {
            // Fix Autofill Garbage
            const codCliFilter = document.getElementById('goals-gv-codcli-filter');
            if (codCliFilter && (codCliFilter.value.includes('http') || codCliFilter.value.includes('supabase'))) {
                codCliFilter.value = '';
            }

            // Ensure Data is Calculated
            // Only recalculate if globalClientGoals is empty to avoid overwriting loaded Supabase data
            if (!globalClientGoals || globalClientGoals.size === 0) {
                calculateGoalsMetrics();
            }

            goalsRenderId++;
            const currentRenderId = goalsRenderId;

            // Check if we are in Summary Mode
            if (document.getElementById('goals-summary-content') && !document.getElementById('goals-summary-content').classList.contains('hidden')) {
                updateGoalsSummaryView();
                return;
            }

            if (quarterMonths.length === 0) identifyQuarterMonths();

            // Calculate Metrics for Current View (Supervisor Filter)
            // Use hierarchy state to filter clients for metrics calculation
            let filteredMetricsClients = getHierarchyFilteredClients('goals-gv', allClientsData);
            filteredMetricsClients = filteredMetricsClients.filter(c => isActiveClient(c));
            const displayMetrics = calculateMetricsForClients(filteredMetricsClients);

            // Update Header (Dynamic) - Same as before
            const thead = document.querySelector('#goals-table-container table thead');
            if (thead) {
                const monthHeaders = quarterMonths.map(m => `<th class="px-2 py-2 text-right w-20 bg-blue-900/10 text-blue-300 border-r border-b border-slate-700/50 text-[10px]">${m.label}</th>`).join('');
                const monthsCount = quarterMonths.length;
                thead.innerHTML = `<tr><th rowspan="2" class="px-2 py-2 text-center w-16 border-r border-b border-slate-700">CÓD</th><th rowspan="2" class="px-3 py-2 text-left w-48 border-r border-b border-slate-700">CLIENTE</th><th rowspan="2" class="px-3 py-2 text-left w-24 border-r border-b border-slate-700">VENDEDOR</th><th colspan="${3 + monthsCount}" class="px-2 py-1 text-center bg-blue-900/30 text-blue-400 border-r border-slate-700 border-b-0">FATURAMENTO (R$)</th><th colspan="3" class="px-2 py-1 text-center bg-orange-900/30 text-orange-400 border-r border-slate-700 border-b-0">VOLUME (KG)</th><th rowspan="2" class="px-2 py-2 text-center w-16 bg-purple-900/20 text-purple-300 font-bold border-b border-slate-700">Mix PDV</th></tr><tr>${monthHeaders}<th class="px-2 py-2 text-right w-24 bg-blue-900/20 text-blue-300 border-r border-b border-slate-700/50 text-[10px]">MÉDIA</th><th class="px-2 py-2 text-center w-16 bg-blue-900/20 text-blue-300 border-r border-b border-slate-700/50 text-[10px]">% SHARE</th><th class="px-2 py-2 text-right w-24 bg-blue-900/20 text-blue-100 font-bold border-r border-b border-slate-700 text-[10px]">META AUTO</th><th class="px-2 py-2 text-right w-24 bg-orange-900/20 text-orange-300 border-r border-b border-slate-700/50 text-[10px]">MÉDIA KG</th><th class="px-2 py-2 text-center w-16 bg-orange-900/20 text-orange-300 border-r border-b border-slate-700/50 text-[10px]">% SHARE</th><th class="px-2 py-2 text-right w-24 bg-orange-900/20 text-orange-100 font-bold border-r border-b border-slate-700 text-[10px]">META KG</th></tr>`;
            }

            const filteredClients = getGoalsFilteredData();
            goalsGvTableBody.innerHTML = getSkeletonRows(15, 10);

            // Cache Key for Global Totals
            const cacheKey = currentGoalsSupplier + (currentGoalsBrand ? `_${currentGoalsBrand}` : '');
            const contextKey = cacheKey;

            if (!globalGoalsTotalsCache[cacheKey]) {
                 calculateDistributedGoals([], currentGoalsSupplier, currentGoalsBrand, 0, 0);
            }

            const currentDate = lastSaleDate;
            const prevMonthDate = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() - 1, 1));
            const prevMonthIndex = prevMonthDate.getUTCMonth();
            const prevMonthYear = prevMonthDate.getUTCFullYear();

            // Helper for inclusion check
            const shouldIncludeSale = (sale, supplier, brand) => {
                const codFor = String(sale.CODFOR);
                if (supplier === 'PEPSICO_ALL') { if (!window.SUPPLIER_CODES.PEPSICO.includes(codFor)) return false; }
                else if (supplier === 'ELMA_ALL') { if (!window.SUPPLIER_CODES.ELMA.includes(codFor)) return false; }
                else if (supplier === 'FOODS_ALL') { if (codFor !== window.SUPPLIER_CODES.FOODS[0]) return false; }
                else {
                    if (codFor !== supplier) return false;
                    if (brand) {
                        const desc = normalize(sale.DESCRICAO || '');
                        if (brand === 'TODDYNHO') { if (!desc.includes('TODDYNHO')) return false; }
                        else if (brand === 'TODDY') { if (!desc.includes('TODDY') || desc.includes('TODDYNHO')) return false; }
                        else if (brand === 'QUAKER_KEROCOCO') { if (!desc.includes('QUAKER') && !desc.includes('KEROCOCO')) return false; }
                    }
                }
                return true;
            };

            const globalTotalAvgFat = globalGoalsTotalsCache[cacheKey].fat;
            const globalTotalAvgVol = globalGoalsTotalsCache[cacheKey].vol;

            const clientMetrics = [];
            let sumFat = 0; let sumVol = 0;
            let totalAvgFat = 0; let totalPrevFat = 0; let totalAvgVol = 0; let totalPrevVol = 0; let sumActiveMonths = 0; let totalPrevClients = 0;

            runAsyncChunked(filteredClients, (client) => {
                const codCli = String(client['Código'] || client['codigo_cliente']);
                const clientHistoryIds = optimizedData.indices.history.byClient.get(normalizeKey(codCli));

                let cSumFat = 0; let cSumVol = 0; let cPrevFat = 0; let cPrevVol = 0;
                const monthlyActivity = new Map();
                const monthlyValues = {};
                const mixProducts = new Set(); // For Mix PDV Calc
                quarterMonths.forEach(m => { monthlyValues[m.key] = 0; });

                if (clientHistoryIds) {
                    clientHistoryIds.forEach(id => {
                        const sale = optimizedData.historyById.get(id);
                        // EXCEPTION: Exclude Balcão (53) sales for Client 9569 from Portfolio Average
                        if (String(codCli).trim() === '9569' && (String(sale.CODUSUR).trim() === '53' || String(sale.CODUSUR).trim() === '053')) return;

                        if (shouldIncludeSale(sale, currentGoalsSupplier, currentGoalsBrand)) {
                            if (sale.TIPOVENDA === '1' || sale.TIPOVENDA === '9') {
                                cSumFat += sale.VLVENDA;
                                cSumVol += sale.TOTPESOLIQ;
                                const d = parseDate(sale.DTPED);
                                if (d) {
                                    if (d.getUTCMonth() === prevMonthIndex && d.getUTCFullYear() === prevMonthYear) {
                                        cPrevFat += sale.VLVENDA;
                                        cPrevVol += sale.TOTPESOLIQ;
                                    }
                                    const monthKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
                                    monthlyActivity.set(monthKey, (monthlyActivity.get(monthKey) || 0) + sale.VLVENDA);
                                    if (monthlyValues.hasOwnProperty(monthKey)) monthlyValues[monthKey] += sale.VLVENDA;

                                    // Mix Logic: Add Product Code + Month Key
                                    // ELMA Constraint: If ELMA_ALL, only 707 and 708 are counted for Mix. 752 (Torcida) is excluded.
                                    let includeInMix = true;
                                    const codFor = String(sale.CODFOR);

                                    if (currentGoalsSupplier === 'ELMA_ALL') {
                                        if (codFor !== window.SUPPLIER_CODES.ELMA[0] && codFor !== window.SUPPLIER_CODES.ELMA[1]) includeInMix = false;
                                    }

                                    if (includeInMix) {
                                        mixProducts.add(`${sale.PRODUTO}_${monthKey}`);
                                    }
                                }
                            }
                        }
                    });
                }

                // Mix Calculation: Average Unique Products per Month
                const monthKeys = Object.keys(monthlyValues); // Assumes last 3 months populated
                let sumUniqueProducts = 0;
                monthKeys.forEach(mKey => {
                    let uniqueCount = 0;
                    mixProducts.forEach(k => {
                        if (k.endsWith(mKey)) uniqueCount++;
                    });
                    sumUniqueProducts += uniqueCount;
                });
                const mixPdvAvg = monthKeys.length > 0 ? sumUniqueProducts / 3 : 0; // Using 3 as quarterly divisor

                let activeMonthsCount = 0;
                monthlyActivity.forEach(val => { if(val >= 1) activeMonthsCount++; });
                const divisor = QUARTERLY_DIVISOR;
                const avgFat = cSumFat / divisor;
                const avgVol = cSumVol / divisor;
                const isActivePrevMonth = cPrevFat >= 1 ? 1 : 0;

                let sellerName = 'N/A';
                const rcaCode = client.rcas[0];
                if (rcaCode) sellerName = optimizedData.rcaNameByCode.get(rcaCode) || rcaCode;

                // Retrieve Stored Goal
                let metaFat = 0; let metaVol = 0;
                if (currentGoalsSupplier === 'ELMA_ALL' || currentGoalsSupplier === 'FOODS_ALL' || currentGoalsSupplier === 'PEPSICO_ALL') {
                    if (globalClientGoals.has(codCli)) {
                        const cGoals = globalClientGoals.get(codCli);
                        let keysToSum = [];
                        if (currentGoalsSupplier === 'ELMA_ALL') keysToSum = window.SUPPLIER_CODES.ELMA;
                        else if (currentGoalsSupplier === 'FOODS_ALL') keysToSum = window.SUPPLIER_CODES.VIRTUAL_LIST;
                        else if (currentGoalsSupplier === 'PEPSICO_ALL') keysToSum = window.SUPPLIER_CODES.ALL_GOALS;

                        keysToSum.forEach(k => { if (cGoals.has(k)) { const g = cGoals.get(k); metaFat += g.fat; metaVol += g.vol; } });
                    }
                } else {
                    if (globalClientGoals.has(codCli)) {
                        const cGoals = globalClientGoals.get(codCli);
                        if (cGoals.has(cacheKey)) { const g = cGoals.get(cacheKey); metaFat = g.fat; metaVol = g.vol; }
                    }
                }

                const metaPos = cSumFat >= 1 ? 1 : 0;

                const metric = {
                    cod: codCli, name: client.nomeCliente || client.fantasia || client.razaoSocial || 'Cliente Sem Nome', seller: sellerName,
                    avgFat, avgVol, prevFat: cPrevFat, prevVol: cPrevVol,
                    activeMonthsCount, isActivePrevMonth,
                    shareFat: (globalTotalAvgFat > 0 && avgFat > 0) ? (avgFat / globalTotalAvgFat) : 0,
                    shareVol: (globalTotalAvgVol > 0 && avgVol > 0) ? (avgVol / globalTotalAvgVol) : 0,
                    metaFat, metaVol, metaPos, monthlyValues
                };
                // Add Mix PDV to Metric Object
                metric.mixPdv = mixPdvAvg;

                clientMetrics.push(metric);

                // Accumulate totals
                sumFat += metaFat; sumVol += metaVol;
                totalAvgFat += avgFat; totalPrevFat += cPrevFat;
                totalAvgVol += avgVol; totalPrevVol += cPrevVol;
                sumActiveMonths += activeMonthsCount; totalPrevClients += isActivePrevMonth;

            }, () => {
                if (currentRenderId !== goalsRenderId) return;

                // Finalize Render
                const totalAvgClients = sumActiveMonths / QUARTERLY_DIVISOR;

                const fatInput = document.getElementById('goal-global-fat');
                const volInput = document.getElementById('goal-global-vol');
                const btnDistributeFat = document.getElementById('btn-distribute-fat');
                const btnDistributeVol = document.getElementById('btn-distribute-vol');
                const isAggregatedTab = currentGoalsSupplier === 'ELMA_ALL' || currentGoalsSupplier === 'FOODS_ALL' || currentGoalsSupplier === 'PEPSICO_ALL';

                if (fatInput) {
                    if (document.activeElement !== fatInput) {
                        const displayFat = (sumFat === 0 && totalPrevFat > 0) ? totalPrevFat : sumFat;
                        fatInput.value = displayFat.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    }
                    fatInput.readOnly = false; fatInput.classList.remove('opacity-50', 'cursor-not-allowed');
                }
                if (volInput) {
                    if (document.activeElement !== volInput) {
                        const displayVol = (sumVol === 0 && totalPrevVol > 0) ? totalPrevVol : sumVol;
                        volInput.value = displayVol.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                    }
                    volInput.readOnly = false; volInput.classList.remove('opacity-50', 'cursor-not-allowed');
                }
                if (btnDistributeFat) btnDistributeFat.style.display = '';
                if (btnDistributeVol) btnDistributeVol.style.display = '';

                // KPIs
                const refAvgFat = document.getElementById('ref-avg-fat'); if(refAvgFat) refAvgFat.textContent = totalAvgFat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const refPrevFat = document.getElementById('ref-prev-fat'); if(refPrevFat) refPrevFat.textContent = totalPrevFat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const refAvgVol = document.getElementById('ref-avg-vol'); if(refAvgVol) refAvgVol.textContent = totalAvgVol.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kg';
                const refPrevVol = document.getElementById('ref-prev-vol'); if(refPrevVol) refPrevVol.textContent = totalPrevVol.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kg';
                const refAvgClients = document.getElementById('ref-avg-clients'); if(refAvgClients) refAvgClients.textContent = totalAvgClients.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
                const refPrevClients = document.getElementById('ref-prev-clients'); if(refPrevClients) refPrevClients.textContent = totalPrevClients.toLocaleString('pt-BR');

                clientMetrics.sort((a, b) => b.metaFat - a.metaFat);

                const goalMixInput = document.getElementById('goal-global-mix');
                const btnDistributeMix = document.getElementById('btn-distribute-mix');
                const naturalTotalPos = clientMetrics.reduce((sum, item) => sum + item.metaPos, 0);
                const isSingleSeller = hierarchyState['goals-gv'] && hierarchyState['goals-gv'].promotors.size === 1;

                if (goalMixInput) {
                    const newMixInput = goalMixInput.cloneNode(true);
                    goalMixInput.parentNode.replaceChild(newMixInput, goalMixInput);

                    // Calculate Total Adjustment for Current View Context
                    let contextAdjustment = 0;
                    const adjustmentMap = goalsPosAdjustments[contextKey];
                    let absoluteOverride = null;

                    if (isSingleSeller) {
                        // Check for Absolute Override from Import

                        if (absoluteOverride === null && adjustmentMap) {
                            // Specific Seller Context (Fallback)
                        }
                    } else {
                        // Aggregate Logic for Multiple Sellers (Supervisor/Global)
                        const visibleSellers = new Set(clientMetrics.map(c => c.seller));
                        const naturalPosBySeller = new Map();

                        // 1. Calculate Natural Pos per Seller
                        clientMetrics.forEach(c => {
                            if (c.metaPos > 0) {
                                naturalPosBySeller.set(c.seller, (naturalPosBySeller.get(c.seller) || 0) + c.metaPos);
                            }
                        });

                        // 2. Sum (Override OR (Natural + Adjustment))
                        let sumTotal = 0;
                        visibleSellers.forEach(seller => {
                            const override = getSellerTargetOverride(seller, 'pos', contextKey);
                            if (override !== null) {
                                sumTotal += override;
                            } else {
                                const nat = naturalPosBySeller.get(seller) || 0;
                                const adj = adjustmentMap ? (adjustmentMap.get(seller) || 0) : 0;
                                sumTotal += (nat + adj);
                            }
                        });

                        // Override the standard calculation
                        absoluteOverride = sumTotal;
                    }

                    const displayPos = absoluteOverride !== null ? absoluteOverride : (naturalTotalPos + contextAdjustment);
                    newMixInput.value = displayPos.toLocaleString('pt-BR');

                    if (isSingleSeller || isAggregatedTab) {
                        newMixInput.readOnly = false;
                        newMixInput.classList.remove('opacity-50', 'cursor-not-allowed');

                        if(btnDistributeMix) {
                            const newBtnDistributeMix = btnDistributeMix.cloneNode(true);
                            btnDistributeMix.parentNode.replaceChild(newBtnDistributeMix, btnDistributeMix);
                            newBtnDistributeMix.style.display = '';

                            newBtnDistributeMix.onclick = () => {
                                const valStr = newMixInput.value;
                                const val = parseFloat(valStr.replace(/\./g, '').replace(',', '.')) || 0;

                                if (isAggregatedTab) {
                                    const contextName = currentGoalsSupplier.replace('_ALL', '');
                                    showConfirmationModal(`Confirmar distribuição Top-Down de Positivação (${val}) para ${contextName}?`, () => {
                                        handleDistributePositivation(val, contextKey, clientMetrics);
                                    });
                                } else {
                                    const filterDesc = getFilterDescription();
                                    // Validation: Check against PEPSICO Limit
                                    let pepsicoNaturalPos = 0;
                                    // Calculate Natural PEPSICO Positivação for this seller
                                    const len = allClientsData.length;
                                    for(let i=0; i<len; i++) {
                                        const c = allClientsData instanceof ColumnarDataset ? allClientsData.get(i) : allClientsData[i];

                                        const rca = c.rcas[0];
                                        const sName = optimizedData.rcaNameByCode.get(rca) || rca;
                                        if (sName === sellerName) {
                                            const historyIds = optimizedData.indices.history.byClient.get(normalizeKey(c['Código']));
                                            if (historyIds) {
                                                for (let id of historyIds) {
                                                    const sale = optimizedData.historyById.get(id);
                                                    if ((sale.TIPOVENDA === '1' || sale.TIPOVENDA === '9') &&
                                                        window.SUPPLIER_CODES.PEPSICO.includes(String(sale.CODFOR))) {
                                                        pepsicoNaturalPos++;
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    const pepsicoAdj = goalsPosAdjustments['PEPSICO_ALL'].get(sellerName) || 0;
                                    const pepsicoLimit = pepsicoNaturalPos + pepsicoAdj;
                                    if (currentGoalsSupplier !== 'PEPSICO_ALL' && val > pepsicoLimit) {
                                        window.showToast('warning', `O valor não pode ultrapassar a Meta de Positivação PEPSICO definida (${pepsicoLimit.toLocaleString('pt-BR')}).\n(Natural: ${pepsicoNaturalPos}, Ajuste PEPSICO: ${pepsicoAdj})`);
                                        return;
                                    }
                                    showConfirmationModal(`Confirmar ajuste de Meta Positivação para ${valStr} (Cliente: ${filterDesc})?`, () => {
                                        const newAdjustment = val - naturalTotalPos;
                                        if (adjustmentMap) {
                                            updateGoalsView();
                                        }
                                    });
                                }
                            };
                        }
                    } else {
                        newMixInput.readOnly = true;
                        newMixInput.classList.add('opacity-50', 'cursor-not-allowed');
                        if(btnDistributeMix) btnDistributeMix.style.display = 'none';
                    }
                }

                // --- MIX SALTY & FOODS CARDS LOGIC (PEPSICO ONLY) ---
                const cardMixSalty = document.getElementById('card-mix-salty');
                const cardMixFoods = document.getElementById('card-mix-foods');

                if (currentGoalsSupplier === 'PEPSICO_ALL' || currentGoalsSupplier === 'ELMA_ALL' || currentGoalsSupplier === 'FOODS_ALL') {
                    if(cardMixSalty) cardMixSalty.classList.remove('hidden');
                    if(cardMixFoods) cardMixFoods.classList.remove('hidden');

                    // Logic to populate values and handle edit
                    let naturalMixBase = 0;
                    clientMetrics.forEach(c => {
                        // Check if not seller 1001 (Americanas)
                        const sellerCode = optimizedData.rcaCodeByName.get(c.seller) || '';
                        if (sellerCode !== '1001') {
                            if (c.metaPos > 0) naturalMixBase++; // Count positivations in PEPSICO_ALL (Total Pos)
                        }
                    });

                    const naturalSaltyTarget = Math.round(naturalMixBase * 0.50);
                    const naturalFoodsTarget = Math.round(naturalMixBase * 0.30);

                    const handleMixCard = (type, naturalTarget, adjustmentsMap, inputId, btnId) => {
                        let adj = 0;
                        let absOverride = null;

                        if (isSingleSeller) {
                            if (absOverride === null) {
                            }
                        } else {
                            // Aggregate Logic for Multiple Sellers (Mix)
                            const visibleSellers = new Set(clientMetrics.map(c => c.seller));
                            const naturalBaseBySeller = new Map();

                            // 1. Calculate Natural Base per Seller
                            clientMetrics.forEach(c => {
                                const sellerCode = optimizedData.rcaCodeByName.get(c.seller) || '';
                                if (sellerCode !== '1001') {
                                    if (c.metaPos > 0) {
                                        naturalBaseBySeller.set(c.seller, (naturalBaseBySeller.get(c.seller) || 0) + 1);
                                    }
                                }
                            });

                            // 2. Sum
                            let sumTotal = 0;
                            visibleSellers.forEach(seller => {
                                const override = getSellerTargetOverride(seller, type === 'salty' ? 'mix_salty' : 'mix_foods', contextKey);
                                if (override !== null) {
                                    sumTotal += override;
                                } else {
                                    const base = naturalBaseBySeller.get(seller) || 0;
                                    const nat = Math.round(base * (type === 'salty' ? 0.5 : 0.3));
                                    const adj = adjustmentsMap ? (adjustmentsMap.get(seller) || 0) : 0;
                                    sumTotal += (nat + adj);
                                }
                            });
                            absOverride = sumTotal;
                        }

                        const displayVal = absOverride !== null ? absOverride : (naturalTarget + adj);
                        const input = document.getElementById(inputId);
                        const btn = document.getElementById(btnId);

                        if(input) {
                            input.value = displayVal.toLocaleString('pt-BR');

                            if (isSingleSeller || isAggregatedTab) {
                                input.readOnly = false;
                                input.classList.remove('opacity-50', 'cursor-not-allowed');
                                if(btn) {
                                    const newBtn = btn.cloneNode(true);
                                    btn.parentNode.replaceChild(newBtn, btn);
                                    newBtn.style.display = '';

                                    newBtn.onclick = () => {
                                        const valStr = input.value;
                                        const val = parseFloat(valStr.replace(/\./g, '').replace(',', '.')) || 0;

                                        if (isAggregatedTab) {
                                            const contextName = currentGoalsSupplier.replace('_ALL', '');
                                            showConfirmationModal(`Confirmar distribuição Proporcional de Mix ${type === 'salty' ? 'Salty' : 'Foods'} (${val}) para ${contextName}? (Base: Histórico)`, () => {
                                                handleDistributeMix(val, type, contextKey, clientMetrics);
                                            });
                                        } else {
                                            showConfirmationModal(`Confirmar ajuste de Meta Mix ${type === 'salty' ? 'Salty' : 'Foods'} para ${valStr} (Vendedor: ${getFirstName(sellerName)})?`, () => {
                                                saveMixAdjustment(type, val, sellerName);
                                            });
                                        }
                                    };
                                }
                            } else {
                                input.readOnly = true;
                                input.classList.add('opacity-50', 'cursor-not-allowed');
                                if(btn) btn.style.display = 'none';
                            }
                        }
                    };

                    // FORCE READ FROM PEPSICO_ALL KEY for Mix Cards
                    // Calculate Natural Base using ELMA metrics (excluding Americanas) for consistency

                    // Determine visible sellers set for filtering adjustments in helper
                    let visibleSellersSet = new Set(clientMetrics.map(c => c.seller));

                    // Bugfix: If table is empty (e.g. no active clients) but we have a specific seller filter,
                    // use the filter to prevent getElmaTargetBase from returning global counts (empty set bypass).
                    if (visibleSellersSet.size === 0 && hierarchyState['goals-gv'] && hierarchyState['goals-gv'].promotors.size > 0) {
                         visibleSellersSet = new Set(hierarchyState['goals-gv'].promotors);
                    }

                    const elmaTargetBase = getElmaTargetBase(displayMetrics, goalsPosAdjustments, visibleSellersSet);

                    // Card Natural Targets (Based on ELMA: 50% Salty / 30% Foods)
                    const globalNaturalSalty = Math.round(elmaTargetBase * 0.50);
                    const globalNaturalFoods = Math.round(elmaTargetBase * 0.30);

                    if (goalsMixSaltyAdjustments['PEPSICO_ALL']) {
                        handleMixCard('salty', globalNaturalSalty, goalsMixSaltyAdjustments['PEPSICO_ALL'], 'goal-global-mix-salty', 'btn-distribute-mix-salty');
                    }
                    if (goalsMixFoodsAdjustments['PEPSICO_ALL']) {
                        handleMixCard('foods', globalNaturalFoods, goalsMixFoodsAdjustments['PEPSICO_ALL'], 'goal-global-mix-foods', 'btn-distribute-mix-foods');
                    }

                } else {
                    if(cardMixSalty) cardMixSalty.classList.add('hidden');
                    if(cardMixFoods) cardMixFoods.classList.add('hidden');
                }

                goalsTableState.filteredData = clientMetrics;
                goalsTableState.totalPages = Math.ceil(clientMetrics.length / goalsTableState.itemsPerPage);
                if (goalsTableState.currentPage > goalsTableState.totalPages && goalsTableState.totalPages > 0) goalsTableState.currentPage = goalsTableState.totalPages;
                else if (goalsTableState.totalPages === 0) goalsTableState.currentPage = 1;

                const startIndex = (goalsTableState.currentPage - 1) * goalsTableState.itemsPerPage;
                const endIndex = startIndex + goalsTableState.itemsPerPage;
                const pageData = clientMetrics.slice(startIndex, endIndex);
                const paginationControls = document.getElementById('goals-pagination-controls');
                const pageInfo = document.getElementById('goals-page-info-text');
                const prevBtn = document.getElementById('goals-prev-page-btn');
                const nextBtn = document.getElementById('goals-next-page-btn');

                if (clientMetrics.length === 0) {
                    goalsGvTableBody.innerHTML = `<tr><td colspan="${12 + quarterMonths.length}" class="text-center p-4 text-slate-500">Nenhum cliente encontrado nos filtros para este fornecedor.</td></tr>`;
                    if (paginationControls) paginationControls.classList.add('hidden');
                } else {
                    const rows = pageData.map(item => {
                        const monthCells = quarterMonths.map(m => `<td class="px-2 py-2 text-right text-slate-400 border-r border-white/10/50 text-[10px] bg-blue-900/5">${(item.monthlyValues[m.key] || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>`).join('');
                        return `<tr class="hover:bg-white/5 group transition-colors border-b border-white/10"><td class="px-2 py-2 text-center border-r border-white/10 bg-glass text-xs text-slate-300">${item.cod}</td><td class="px-2 py-2 text-left border-r border-white/10 bg-glass text-xs font-bold text-white truncate max-w-[200px]" title="${item.name}">${(item.name || '').substring(0, 30)}</td><td class="px-2 py-2 text-left border-r border-white/10 bg-glass text-[10px] text-slate-400 uppercase">${getFirstName(item.seller)}</td>${monthCells}<td class="px-2 py-2 text-right text-slate-300 font-medium bg-blue-900/10 border-r border-white/10/50 text-xs">${item.avgFat.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td class="px-2 py-2 text-center text-blue-400 text-xs bg-blue-900/10 border-r border-white/10/50">${(item.shareFat * 100).toFixed(2)}%</td><td class="px-2 py-2 text-right font-bold text-blue-200 bg-blue-900/20 border-r border-white/10 text-xs">${item.metaFat.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td class="px-2 py-2 text-right text-slate-300 font-medium bg-orange-900/10 border-r border-white/10/50 text-xs">${item.avgVol.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Kg</td><td class="px-2 py-2 text-center text-orange-400 text-xs bg-orange-900/10 border-r border-white/10/50">${(item.shareVol * 100).toFixed(2)}%</td><td class="px-2 py-2 text-right font-bold text-orange-200 bg-orange-900/20 border-r border-white/10 text-xs">${item.metaVol.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Kg</td><td class="px-2 py-2 text-center font-bold text-purple-300 bg-purple-900/10 text-xs">${(item.mixPdv || 0).toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}</td></tr>`;
                    }).join('');
                    goalsGvTableBody.innerHTML = rows;
                    if (paginationControls) {
                        paginationControls.classList.remove('hidden');

                        let exportBtn = document.getElementById('btn-export-goals-gv');
                        if (!exportBtn) {
                             const btnContainer = document.createElement('div');
                             btnContainer.className = "flex items-center ml-4";
                             btnContainer.innerHTML = `<button id="btn-export-goals-gv" class="flex items-center space-x-1 text-xs font-bold text-green-400 hover:text-green-300 border border-green-500/30 hover:border-green-500/50 bg-green-500/10 hover:bg-green-500/20 px-3 py-1.5 rounded transition-colors" title="Exportar tabela completa (XLSX)">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span>XLSX</span>
                                </button>`;
                             pageInfo.parentNode.insertBefore(btnContainer, pageInfo.nextSibling);
                             document.getElementById('btn-export-goals-gv').addEventListener('click', exportGoalsCurrentTabXLSX);
                        }

                        pageInfo.textContent = `Página ${goalsTableState.currentPage} de ${goalsTableState.totalPages} (Total: ${clientMetrics.length})`;
                        prevBtn.disabled = goalsTableState.currentPage === 1;
                        nextBtn.disabled = goalsTableState.currentPage === goalsTableState.totalPages;
                    }
                }
            }, () => currentRenderId !== goalsRenderId);
        }

        function getGoalsSvFilteredData() {
            // Apply Hierarchy Logic
            let clients = getHierarchyFilteredClients('goals-sv', allClientsData);

            clients = clients.filter(c => {
                const rca1 = String(c.rca1 || '').trim();
                const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');
                if (isAmericanas) return true;
                // STRICT FILTER: Exclude RCA 53 (Balcão) and INATIVOS
                if (rca1 === '53') return false;
                if (rca1 === '') return false; // Exclude INATIVOS
                return true;
            });


            return clients;
        }

        function recalculateGoalsSvTotals(input) {
            const { supId, colId, field, sellerId } = input.dataset;

            // Helper to parse input value
            const parseVal = (str) => {
                let val = parseFloat(str.replace(/\./g, '').replace(',', '.'));
                return isNaN(val) ? 0 : val;
            };

            // Helper to calculate and update column totals (Supervisor and Grand)
            const updateColumnTotals = (cId, fld) => {
                // 1. Supervisor Total
                // For 'geral', the values are in spans (text), for others inputs.
                let supSum = 0;
                if (cId === 'geral') {
                    const supCells = document.querySelectorAll(`.goals-sv-text[data-sup-id="${supId}"][data-col-id="${cId}"][data-field="${fld}"]`);
                    supCells.forEach(el => supSum += parseVal(el.textContent));
                } else {
                    const supInputs = document.querySelectorAll(`.goals-sv-input[data-sup-id="${supId}"][data-col-id="${cId}"][data-field="${fld}"]`);
                    supInputs.forEach(inp => supSum += parseVal(inp.value));
                }

                const supTotalEl = document.getElementById(`total-sup-${supId}-${cId}-${fld}`);
                if (supTotalEl) {
                    if (fld === 'fat') supTotalEl.textContent = supSum.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    else if (fld === 'vol' || fld === 'ton') supTotalEl.textContent = supSum.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3});
                    else supTotalEl.textContent = supSum;
                }

                // 2. Grand Total
                let grandSum = 0;
                if (cId === 'geral') {
                    const allCells = document.querySelectorAll(`.goals-sv-text[data-col-id="${cId}"][data-field="${fld}"]`);
                    allCells.forEach(el => grandSum += parseVal(el.textContent));
                } else {
                    const allInputs = document.querySelectorAll(`.goals-sv-input[data-col-id="${cId}"][data-field="${fld}"]`);
                    allInputs.forEach(inp => grandSum += parseVal(inp.value));
                }

                const grandTotalEl = document.getElementById(`total-grand-${cId}-${fld}`);
                if (grandTotalEl) {
                    if (fld === 'fat') grandTotalEl.textContent = grandSum.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    else if (fld === 'vol' || fld === 'ton') grandTotalEl.textContent = grandSum.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3});
                    else grandTotalEl.textContent = grandSum;
                }
            };

            // A. Update Current Column Totals
            updateColumnTotals(colId, field);

            // B. Row Aggregation Logic (Update Total Elma/Foods and Geral)
            const elmaIds = window.SUPPLIER_CODES.ELMA;
            const foodsIds = window.SUPPLIER_CODES.VIRTUAL_LIST;

            let groupTotalId = null;
            let components = [];

            if (elmaIds.includes(colId)) {
                groupTotalId = 'total_elma';
                components = elmaIds;
            } else if (foodsIds.includes(colId)) {
                groupTotalId = 'total_foods';
                components = foodsIds;
            }

            // Only aggregate if we are editing a base column (not changing mix or tonnage directly if those were editable)
            if (groupTotalId) {
                // 1. Recalculate Group Total (Row)
                let groupSum = 0;
                components.forEach(cId => {
                    const el = document.querySelector(`.goals-sv-input[data-seller-id="${sellerId}"][data-col-id="${cId}"][data-field="${field}"]`);
                    if (el) groupSum += parseVal(el.value);
                });

                // Update Group Total Input (Read-only)
                const groupInput = document.querySelector(`.goals-sv-input[data-seller-id="${sellerId}"][data-col-id="${groupTotalId}"][data-field="${field}"]`);
                if (groupInput) {
                    if (field === 'fat') groupInput.value = groupSum.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    else if (field === 'vol') groupInput.value = groupSum.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3});
                    else groupInput.value = groupSum; // Pos

                    // Update Column Totals for the Group Column
                    updateColumnTotals(groupTotalId, field);

                    // Special Logic: If updating TOTAL ELMA POS, update PEDEV
                    if (groupTotalId === 'total_elma' && field === 'pos') {
                        const pedevVal = Math.round(groupSum * 0.9);
                        const pedevCell = document.getElementById(`pedev-${sellerId}-pos`);
                        if (pedevCell) {
                            pedevCell.textContent = pedevVal;
                            updateColumnTotals('pedev', 'pos');
                        }
                    }
                }
            }

            // 2. Recalculate GERAL Total (Row) - Only for Fat and Vol/Ton
            // Geral Pos is static (Active Clients), so we don't update it on input change
            if (field === 'fat' || field === 'vol') {
                const elmaInput = document.querySelector(`.goals-sv-input[data-seller-id="${sellerId}"][data-col-id="total_elma"][data-field="${field}"]`);
                const foodsInput = document.querySelector(`.goals-sv-input[data-seller-id="${sellerId}"][data-col-id="total_foods"][data-field="${field}"]`);

                let elmaVal = elmaInput ? parseVal(elmaInput.value) : 0;
                let foodsVal = foodsInput ? parseVal(foodsInput.value) : 0;
                let geralSum = elmaVal + foodsVal;

                // Map field 'vol' to 'ton' for Geral if needed, or keep consistent
                // In column definitions: 'tonelada_elma' is type 'tonnage' (field 'vol'). 'geral' is type 'geral'.
                // Geral uses field 'fat' and 'ton'.
                const geralField = field === 'vol' ? 'ton' : field;

                const geralCell = document.getElementById(`geral-${sellerId}-${geralField}`);
                if (geralCell) {
                    if (geralField === 'fat') geralCell.textContent = geralSum.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    else geralCell.textContent = geralSum.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3});

                    // Update Column Totals for Geral
                    updateColumnTotals('geral', geralField);
                }
            }
        }

        function updateGoalsSvView() {
            goalsSvRenderId++;
            const currentRenderId = goalsSvRenderId;

            if (quarterMonths.length === 0) identifyQuarterMonths();
            const filteredClients = getGoalsSvFilteredData();

            // Define Column Blocks (Metrics Config)
            const svColumns = [
                { id: 'total_elma', label: 'TOTAL ELMA', type: 'standard', isAgg: true, colorClass: 'text-teal-400', components: window.SUPPLIER_CODES.ELMA },
                { id: window.SUPPLIER_CODES.ELMA[0], label: 'EXTRUSADOS', type: 'standard', supplier: window.SUPPLIER_CODES.ELMA[0], brand: null, colorClass: 'text-slate-300' },
                { id: window.SUPPLIER_CODES.ELMA[1], label: 'NÃO EXTRUSADOS', type: 'standard', supplier: window.SUPPLIER_CODES.ELMA[1], brand: null, colorClass: 'text-slate-300' },
                { id: window.SUPPLIER_CODES.ELMA[2], label: 'TORCIDA', type: 'standard', supplier: window.SUPPLIER_CODES.ELMA[2], brand: null, colorClass: 'text-slate-300' },
                { id: 'tonelada_elma', label: 'KG ELMA', type: 'tonnage', isAgg: true, colorClass: 'text-orange-400', components: window.SUPPLIER_CODES.ELMA },
                { id: 'mix_salty', label: 'MIX SALTY', type: 'mix', isAgg: true, colorClass: 'text-teal-400', components: [] },
                { id: 'total_foods', label: 'TOTAL FOODS', type: 'standard', isAgg: true, colorClass: 'text-yellow-400', components: window.SUPPLIER_CODES.VIRTUAL_LIST },
                { id: window.SUPPLIER_CODES.VIRTUAL.TODDYNHO, label: 'TODDYNHO', type: 'standard', supplier: window.SUPPLIER_CODES.FOODS[0], brand: 'TODDYNHO', colorClass: 'text-slate-300' },
                { id: window.SUPPLIER_CODES.VIRTUAL.TODDY, label: 'TODDY', type: 'standard', supplier: window.SUPPLIER_CODES.FOODS[0], brand: 'TODDY', colorClass: 'text-slate-300' },
                { id: window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO, label: 'QUAKER / KEROCOCO', type: 'standard', supplier: window.SUPPLIER_CODES.FOODS[0], brand: 'QUAKER_KEROCOCO', colorClass: 'text-slate-300' },
                { id: 'tonelada_foods', label: 'KG FOODS', type: 'tonnage', isAgg: true, colorClass: 'text-orange-400', components: window.SUPPLIER_CODES.VIRTUAL_LIST },
                { id: 'mix_foods', label: 'MIX FOODS', type: 'mix', isAgg: true, colorClass: 'text-yellow-400', components: [] },
                { id: 'geral', label: 'GERAL', type: 'geral', isAgg: true, colorClass: 'text-white', components: ['total_elma', 'total_foods'] },
                { id: 'pedev', label: 'AUDITORIA PEDEV', type: 'pedev', isAgg: true, colorClass: 'text-pink-400', components: ['total_elma'] }
            ];

            const baseCategories = svColumns.filter(c => c.type === 'standard' && !c.isAgg);
            const mainTable = document.getElementById('goals-sv-main-table');
            if (mainTable) mainTable.innerHTML = `<tbody>${getSkeletonRows(12, 10)}</tbody>`;

            // Ensure Global Totals are cached (Sync operation, but fast enough for initialization)
            baseCategories.forEach(cat => {
                const cacheKey = cat.supplier + (cat.brand ? `_${cat.brand}` : '');
                if (!globalGoalsTotalsCache[cacheKey]) calculateDistributedGoals([], cat.supplier, cat.brand, 0, 0);
            });

            // Prepare Aggregation Structures
            const sellerMap = new Map();
            const initSeller = (sellerName) => {
                if (!sellerMap.has(sellerName)) {
                    let sellerCode = optimizedData.rcaCodeByName.get(sellerName) || '';
                    let supervisorName = 'N/A';
                    if (sellerCode) {
                        for (const [sup, rcas] of optimizedData.rcasBySupervisor) {
                            if (rcas.includes(sellerCode)) { supervisorName = sup; break; }
                        }
                    }
                    sellerMap.set(sellerName, { name: sellerName, code: sellerCode, supervisor: supervisorName, data: {}, metaPosTotal: 0, elmaPos: 0, foodsPos: 0 });
                }
                return sellerMap.get(sellerName);
            };

            const currentDate = lastSaleDate;
            const prevMonthDate = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() - 1, 1));
            const prevMonthIndex = prevMonthDate.getUTCMonth();
            const prevMonthYear = prevMonthDate.getUTCFullYear();

            // Optimization: Normalize functions outside loop
            const norm = (str) => str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase() : '';

            // ASYNC LOOP
            runAsyncChunked(filteredClients, (client) => {
                const codCli = String(client['Código'] || client['codigo_cliente']);
                const clientHistoryIds = optimizedData.indices.history.byClient.get(normalizeKey(codCli));

                let sellerName = 'N/A';
                const rcaCode = client.rcas[0];
                if (rcaCode) sellerName = optimizedData.rcaNameByCode.get(rcaCode) || rcaCode;
                else if (client.rcas.length === 0 || client.rcas[0] === '') sellerName = 'INATIVOS';

                // EXCLUSION: Skip INATIVOS and N/A from Goals View to prevent ghost totals
                if (sellerName === 'INATIVOS' || sellerName === 'N/A') return;

                const sellerObj = initSeller(sellerName);

                // Initialize client totals for each category
                const clientCatTotals = {};
                baseCategories.forEach(c => clientCatTotals[c.id] = { fat: 0, vol: 0, pos: 0, prevFat: 0, monthly: {} });

                // Single Pass over History for this Client
                if (clientHistoryIds) {
                    clientHistoryIds.forEach(id => {
                        const sale = optimizedData.historyById.get(id);
                        // EXCEPTION: Exclude Balcão (53) sales for Client 9569 from Portfolio Analysis
                        if (String(codCli).trim() === '9569' && (String(sale.CODUSUR).trim() === '53' || String(sale.CODUSUR).trim() === '053')) return;

                        const isRev = (sale.TIPOVENDA === '1' || sale.TIPOVENDA === '9');
                        if (!isRev) return;

                        const codFor = String(sale.CODFOR);
                        let matchedCats = [];

                        // Determine which categories this sale belongs to
                        if (codFor === window.SUPPLIER_CODES.ELMA[0]) matchedCats.push(window.SUPPLIER_CODES.ELMA[0]);
                        else if (codFor === window.SUPPLIER_CODES.ELMA[1]) matchedCats.push(window.SUPPLIER_CODES.ELMA[1]);
                        else if (codFor === window.SUPPLIER_CODES.ELMA[2]) matchedCats.push(window.SUPPLIER_CODES.ELMA[2]);
                        else if (codFor === window.SUPPLIER_CODES.FOODS[0]) {
                            const desc = norm(sale.DESCRICAO || '');
                            if (desc.includes('TODDYNHO')) matchedCats.push(window.SUPPLIER_CODES.VIRTUAL.TODDYNHO);
                            else if (desc.includes('TODDY')) matchedCats.push(window.SUPPLIER_CODES.VIRTUAL.TODDY);
                            else if (desc.includes('QUAKER') || desc.includes('KEROCOCO')) matchedCats.push(window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO);
                        }

                        if (matchedCats.length > 0) {
                            const d = parseDate(sale.DTPED);
                            const isPrev = d && d.getUTCMonth() === prevMonthIndex && d.getUTCFullYear() === prevMonthYear;
                            const monthKey = d ? `${d.getUTCFullYear()}-${d.getUTCMonth()}` : null;

                            matchedCats.forEach(catId => {
                                const t = clientCatTotals[catId];
                                t.fat += sale.VLVENDA;
                                t.vol += sale.TOTPESOLIQ;
                                if (isPrev) t.prevFat += sale.VLVENDA;
                                if (monthKey) t.monthly[monthKey] = (t.monthly[monthKey] || 0) + sale.VLVENDA;
                            });
                        }
                    });
                }

                // Aggregate to Seller
                baseCategories.forEach(cat => {
                    const t = clientCatTotals[cat.id];
                    if (!sellerObj.data[cat.id]) sellerObj.data[cat.id] = { metaFat: 0, metaVol: 0, metaPos: 0, avgVol: 0, avgFat: 0, monthlyValues: {} };
                    const sData = sellerObj.data[cat.id];

                    const avgFat = t.fat / QUARTERLY_DIVISOR;
                    const avgVol = t.vol / QUARTERLY_DIVISOR;
                    const metaPos = t.fat >= 1 ? 1 : 0;

                    // Fetch Stored Goal
                    let metaFat = 0; let metaVol = 0;
                    if (globalClientGoals.has(codCli)) {
                        const cacheKey = cat.supplier + (cat.brand ? `_${cat.brand}` : '');
                        const cGoals = globalClientGoals.get(codCli);
                        if (cGoals.has(cacheKey)) { const g = cGoals.get(cacheKey); metaFat = g.fat; metaVol = g.vol; }
                    }

                    sData.metaFat += metaFat;
                    sData.metaVol += metaVol;
                    sData.metaPos += metaPos;
                    sData.avgVol += avgVol;
                    sData.avgFat += avgFat;

                    // Monthly Breakdown
                    quarterMonths.forEach(m => {
                        if (!sData.monthlyValues[m.key]) sData.monthlyValues[m.key] = 0;
                        sData.monthlyValues[m.key] += (t.monthly[m.key] || 0);
                    });
                });

                // Calculate Aggregate Positivation for Client (Unique Client Count)
                let clientElmaFat = (clientCatTotals[window.SUPPLIER_CODES.ELMA[0]]?.fat || 0) + (clientCatTotals[window.SUPPLIER_CODES.ELMA[1]]?.fat || 0) + (clientCatTotals[window.SUPPLIER_CODES.ELMA[2]]?.fat || 0);
                if (clientElmaFat >= 1) sellerObj.elmaPos++;

                let clientFoodsFat = (clientCatTotals[window.SUPPLIER_CODES.VIRTUAL.TODDYNHO]?.fat || 0) + (clientCatTotals[window.SUPPLIER_CODES.VIRTUAL.TODDY]?.fat || 0) + (clientCatTotals[window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO]?.fat || 0);
                if (clientFoodsFat >= 1) sellerObj.foodsPos++;

            }, () => {
                if (currentRenderId !== goalsSvRenderId) return;

                // --- FINALIZE AGGREGATION & RENDER ---

                // 1. Calculate Aggregates (Mix, Geral, etc.)
                sellerMap.forEach(sellerObj => {
                    // Component Aggregates
                    svColumns.filter(c => c.isAgg && c.type !== 'mix' && c.type !== 'geral' && c.type !== 'pedev').forEach(aggCol => {
                        let sumFat = 0, sumVol = 0, sumPos = 0, sumAvgVol = 0, sumAvgFat = 0;
                        const monthlySum = {}; quarterMonths.forEach(m => monthlySum[m.key] = 0);
                        aggCol.components.forEach(compId => {
                            if (sellerObj.data[compId]) {
                                sumFat += sellerObj.data[compId].metaFat; sumVol += sellerObj.data[compId].metaVol;
                                sumPos += sellerObj.data[compId].metaPos; sumAvgVol += sellerObj.data[compId].avgVol;
                                sumAvgFat += sellerObj.data[compId].avgFat || 0;
                                quarterMonths.forEach(m => monthlySum[m.key] += (sellerObj.data[compId].monthlyValues[m.key] || 0));
                            }
                        });

                        // Use calculated unique client count for Total Elma/Foods
                        if (aggCol.id === 'total_elma') sumPos = sellerObj.elmaPos || 0;
                        else if (aggCol.id === 'total_foods') sumPos = sellerObj.foodsPos || 0;

                        sellerObj.data[aggCol.id] = { metaFat: sumFat, metaVol: sumVol, metaPos: sumPos, avgVol: sumAvgVol, avgFat: sumAvgFat, monthlyValues: monthlySum };
                    });

                    // Mix Metrics
                    const historyIds = optimizedData.indices.history.byRca.get(sellerObj.name) || [];
                    let activeClientsCount = 0;

                    // Logic for Active Clients (Positivados Geral > 1)
                    // We need to check if ANY sale > 1 for this client in history
                    // Optimized: Reuse indices
                    // We iterate filteredClients to find active ones for this seller?
                    // No, "Meta Pos Total" is defined as unique active clients for the seller in the filtered list.
                    // We can re-iterate filteredClients? No, slow.
                    // We can aggregate during the main loop.
                    // Let's do it simply:
                    const sellerClients = filteredClients.filter(c => {
                        const code = c.rcas[0];
                        const name = optimizedData.rcaNameByCode.get(code) || code;
                        return name === sellerObj.name;
                    });
                    sellerClients.forEach(c => {
                        // Check if active (Total Fat > 1 in history)
                        const hIds = optimizedData.indices.history.byClient.get(normalizeKey(c['Código']));
                        let totalFat = 0;
                        if(hIds) {
                            for (const id of hIds) {
                                const s = optimizedData.historyById.get(id);
                                const codFor = String(s.CODFOR);
                                if (window.SUPPLIER_CODES.PEPSICO.includes(codFor)) {
                                    if (s.TIPOVENDA === '1' || s.TIPOVENDA === '9') totalFat += s.VLVENDA;
                                }
                            }
                        }
                        if (totalFat >= 1) activeClientsCount++;
                    });

                    // Mix Calc (re-implement or optimize?)
                    // Mix calculation requires detailed product analysis per client.
                    // For speed, let's assume we can do it sync here for 1 seller's history (smaller dataset).
                    const monthlyData = new Map();
                    historyIds.forEach(id => {
                        const sale = optimizedData.historyById.get(id);
                        if (sale.TIPOVENDA !== '1' && sale.TIPOVENDA !== '9') return; // Strict Type Check
                        const d = parseDate(sale.DTPED);
                        if (!d) return;
                        const mKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
                        if (!monthlyData.has(mKey)) monthlyData.set(mKey, new Map());
                        const cMap = monthlyData.get(mKey);
                        if (!cMap.has(sale.CODCLI)) cMap.set(sale.CODCLI, { salty: new Set(), foods: new Set() });
                        const cData = cMap.get(sale.CODCLI);
                        if (sale.VLVENDA >= 1) {
                            const desc = norm(sale.DESCRICAO);
                            MIX_SALTY_CATEGORIES.forEach(cat => { if (desc.includes(cat)) cData.salty.add(cat); });
                            MIX_FOODS_CATEGORIES.forEach(cat => { if (desc.includes(cat)) cData.foods.add(cat); });
                        }
                    });
                    let sumSalty = 0; let sumFoods = 0;
                    const months = Array.from(monthlyData.keys()).sort().slice(-3);
                    const divisor = months.length > 0 ? months.length : 1;
                    months.forEach(m => {
                        const cMap = monthlyData.get(m);
                        let mSalty = 0; let mFoods = 0;
                        cMap.forEach(d => {
                            if (d.salty.size >= MIX_SALTY_CATEGORIES.length) mSalty++;
                            if (d.foods.size >= MIX_FOODS_CATEGORIES.length) mFoods++;
                        });
                        sumSalty += mSalty; sumFoods += mFoods;
                    });

                    // Calculate Mix Targets using ELMA Base (Natural + Adjustment) to match GV 'RESUMO' Logic
                    // Base logic: Active Elma Clients (elmaPos) + ELMA Adjustments
                    const elmaAdjForMix = goalsPosAdjustments['ELMA_ALL'] ? (goalsPosAdjustments['ELMA_ALL'].get(sellerObj.name) || 0) : 0;
                    const elmaBaseForMix = (sellerObj.elmaPos || 0) + elmaAdjForMix;

                    let mixSaltyMeta = Math.round(elmaBaseForMix * 0.50);
                    let mixFoodsMeta = Math.round(elmaBaseForMix * 0.30);

                    if (sellerObj.code === '1001') { mixSaltyMeta = 0; mixFoodsMeta = 0; }

                    sellerObj.data['mix_salty'] = { avgMix: sumSalty / divisor, metaMix: mixSaltyMeta };
                    sellerObj.data['mix_foods'] = { avgMix: sumFoods / divisor, metaMix: mixFoodsMeta };

                    // Geral & Pedev
                    const totalElma = sellerObj.data['total_elma'];
                    const totalFoods = sellerObj.data['total_foods'];

                    // Note: 'activeClientsCount' here is the Pepsico Natural Active Count.
                    // The 'geral' column will receive the 'PEPSICO_ALL' adjustment in the loop below.

                    sellerObj.data['geral'] = {
                        avgFat: (totalElma.avgFat || 0) + (totalFoods.avgFat || 0),
                        metaFat: totalElma.metaFat + totalFoods.metaFat,
                        metaVol: totalElma.metaVol + totalFoods.metaVol,
                        metaPos: activeClientsCount
                    };
                    // Pedev uses Total Elma (Natural). We'll update it after adjustment loop to be safe.
                    sellerObj.data['pedev'] = { metaPos: Math.round(totalElma.metaPos * 0.9) };
                });

                // Group Supervisors

                // --- APPLY ADJUSTMENTS TO SELLERS ---
                sellerMap.forEach(seller => {
                    const sellerName = seller.name;

                    // 1. Positivation Adjustments
                    // Map Column ID -> Adjustment Key
                    // IDs: 'total_elma'->'ELMA_ALL', 'total_foods'->'FOODS_ALL', 'geral'->'PEPSICO_ALL'
                    //      window.SUPPLIER_CODES.ELMA[0]->window.SUPPLIER_CODES.ELMA[0], etc.

                    const posKeys = {
                        'total_elma': 'ELMA_ALL',
                        'total_foods': 'FOODS_ALL',
                        'geral': 'PEPSICO_ALL', // GERAL uses PEPSICO_ALL for Positivação
                        [window.SUPPLIER_CODES.ELMA[0]]: window.SUPPLIER_CODES.ELMA[0], [window.SUPPLIER_CODES.ELMA[1]]: window.SUPPLIER_CODES.ELMA[1], [window.SUPPLIER_CODES.ELMA[2]]: window.SUPPLIER_CODES.ELMA[2],
                        [window.SUPPLIER_CODES.VIRTUAL.TODDYNHO]: window.SUPPLIER_CODES.VIRTUAL.TODDYNHO,
                        [window.SUPPLIER_CODES.VIRTUAL.TODDY]: window.SUPPLIER_CODES.VIRTUAL.TODDY, // Check keys in globalGoalsMetrics
                        [window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO]: window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO
                    };

                    for (const [colId, data] of Object.entries(seller.data)) {
                        // Priority Check: Explicit Target from Import/Supabase (goalsSellerTargets)
                        let explicitTarget = undefined;
                        if (goalsSellerTargets && goalsSellerTargets.has(sellerName)) {
                            const targets = goalsSellerTargets.get(sellerName);
                            // Check exact key or upper case key
                            if (targets[colId] !== undefined) explicitTarget = targets[colId];
                            else if (targets[colId.toUpperCase()] !== undefined) explicitTarget = targets[colId.toUpperCase()];
                        }

                        if (explicitTarget !== undefined) {
                            // Apply Explicit Target
                            if (colId.startsWith('mix_')) {
                                data.metaMix = explicitTarget;
                            } else {
                                data.metaPos = explicitTarget;
                            }
                        } else {
                            // Fallback: Legacy Adjustment Logic (Session only)

                            // Apply Pos Adjustment
                            const adjKey = posKeys[colId] || colId; // Fallback to ID
                            if (goalsPosAdjustments[adjKey]) {
                                const adj = goalsPosAdjustments[adjKey].get(sellerName) || 0;
                                // Update Meta Pos: Natural (Summed from clients) + Adjustment
                                data.metaPos = data.metaPos + adj;
                            }

                            // Apply Mix Adjustment (Only for Mix Cols)
                            if (colId === 'mix_salty') {
                                const adj = goalsMixSaltyAdjustments['PEPSICO_ALL']?.get(sellerName) || 0;
                                data.metaMix = data.metaMix + adj;
                            }
                            if (colId === 'mix_foods') {
                                const adj = goalsMixFoodsAdjustments['PEPSICO_ALL']?.get(sellerName) || 0;
                                data.metaMix = data.metaMix + adj;
                            }
                        }

                        // Apply Pedev Adjustment? (Calculated as 90% of Total Elma)
                        // This is calculated LATER in the supervisor loop?
                        // "sellerObj.data['pedev'] = { metaPos: Math.round(totalElma.metaPos * 0.9) };"
                        // This line exists inside the client loop (aggregating).
                        // Since we just updated total_elma.metaPos, we should re-calculate pedev here.
                    }

                    // Re-calculate PEDEV based on updated TOTAL ELMA
                    if (seller.data['total_elma'] && seller.data['pedev']) {
                         seller.data['pedev'].metaPos = Math.round(seller.data['total_elma'].metaPos * 0.9);
                    }

                    // Re-calculate GERAL based on updated components?
                    // GERAL components: total_elma, total_foods.
                    // "sellerObj.data['geral'] = { ... metaPos: activeClientsCount }"
                    // The 'activeClientsCount' in the loop was based on (Total Fat > 1).
                    // This is 'PEPSICO NATURAL'.
                    // So 'geral' key maps to PEPSICO_ALL adjustment.
                    // Handled above via posKeys['geral'] = 'PEPSICO_ALL'.
                });

const supervisorGroups = new Map();
                sellerMap.forEach(seller => {
                    const supName = seller.supervisor;
                    if (!supervisorGroups.has(supName)) supervisorGroups.set(supName, { name: supName, id: supName.replace(/[^a-zA-Z0-9]/g, '_'), code: optimizedData.supervisorCodeByName.get(supName) || '', sellers: [], totals: {} });
                    supervisorGroups.get(supName).sellers.push(seller);
                });

                // Aggregate Totals
                supervisorGroups.forEach(group => {
                    svColumns.forEach(col => {
                        if (!group.totals[col.id]) group.totals[col.id] = { metaFat: 0, metaVol: 0, metaPos: 0, avgVol: 0, avgMix: 0, metaMix: 0, avgFat: 0, monthlyValues: {} };
                        quarterMonths.forEach(m => group.totals[col.id].monthlyValues[m.key] = 0);
                        group.sellers.forEach(seller => {
                            if (seller.data[col.id]) {
                                const s = seller.data[col.id]; const t = group.totals[col.id];
                                t.metaFat += s.metaFat || 0; t.metaVol += s.metaVol || 0; t.metaPos += s.metaPos || 0;
                                t.avgVol += s.avgVol || 0; t.avgMix += s.avgMix || 0; t.metaMix += s.metaMix || 0; t.avgFat += s.avgFat || 0;
                                if (s.monthlyValues) quarterMonths.forEach(m => t.monthlyValues[m.key] += s.monthlyValues[m.key]);
                            }
                        });
                    });

                    // Recalculate Mix Targets for Supervisor using Group Aggregates to match Global Logic
                    // 1. Calculate Group Natural Base (Sum of sellers' natural bases)
                    // Note: 'metaPos' in 'geral' is the Natural PEPSICO Base (unique clients per seller)
                    // Must exclude Americanas (Code 1001) from Base Calculation
                    let groupPepsicoNatural = 0;
                    group.sellers.forEach(seller => {
                        if (seller.code !== '1001') {
                            groupPepsicoNatural += (seller.data['geral'] ? seller.data['geral'].metaPos : 0);
                        }
                    });

                    // 2. Calculate Group Adjustments
                    let groupPepsicoAdj = 0;
                    if (goalsPosAdjustments['PEPSICO_ALL']) {
                        group.sellers.forEach(seller => {
                            groupPepsicoAdj += (goalsPosAdjustments['PEPSICO_ALL'].get(seller.name) || 0);
                        });
                    }

                    const groupPepsicoBase = groupPepsicoNatural + groupPepsicoAdj;

                    // 3. Calculate Mix Targets
                    let groupMixSaltyMeta = Math.round(groupPepsicoBase * 0.50);
                    let groupMixFoodsMeta = Math.round(groupPepsicoBase * 0.30);

                    // 4. Add Mix Adjustments
                    let groupMixSaltyAdj = 0;
                    let groupMixFoodsAdj = 0;
                    if (goalsMixSaltyAdjustments['PEPSICO_ALL']) {
                        group.sellers.forEach(seller => groupMixSaltyAdj += (goalsMixSaltyAdjustments['PEPSICO_ALL'].get(seller.name) || 0));
                    }
                    if (goalsMixFoodsAdjustments['PEPSICO_ALL']) {
                        group.sellers.forEach(seller => groupMixFoodsAdj += (goalsMixFoodsAdjustments['PEPSICO_ALL'].get(seller.name) || 0));
                    }

                    // Override summed totals with recalculated totals
                    // DISABLED: We trust the sum of seller targets (which might be overridden)
                    // if (group.totals['mix_salty']) group.totals['mix_salty'].metaMix = groupMixSaltyMeta + groupMixSaltyAdj;
                    // if (group.totals['mix_foods']) group.totals['mix_foods'].metaMix = groupMixFoodsMeta + groupMixFoodsAdj;
                });

                // Recalculate Grand Total (Geral PRIME) using Global Aggregates
                // We can sum the recalculated Group totals which are now consistent, or redo Global.
                // Let's redo Global to be absolutely sure "A = B".
                const grandTotalRow = { totals: {} };
                svColumns.forEach(col => grandTotalRow.totals[col.id] = { metaFat: 0, metaVol: 0, metaPos: 0, avgVol: 0, avgMix: 0, metaMix: 0, avgFat: 0 });

                // Sum standard metrics from groups
                supervisorGroups.forEach(group => {
                    svColumns.forEach(col => {
                        const s = group.totals[col.id]; const t = grandTotalRow.totals[col.id];
                        t.metaFat += s.metaFat; t.metaVol += s.metaVol; t.metaPos += s.metaPos;
                        t.avgVol += s.avgVol; t.avgMix += s.avgMix; t.avgFat += s.avgFat;
                        // Sum metaMix
                        t.metaMix += s.metaMix || 0;
                    });
                });

                // Recalculate Grand Total Mix - DISABLED (Use Sum)
                // grandTotalRow.totals['mix_salty'].metaMix = Math.round(globalElmaBase * 0.50) + globalMixSaltyAdj;
                // grandTotalRow.totals['mix_foods'].metaMix = Math.round(globalElmaBase * 0.30) + globalMixFoodsAdj;

                // We inject this fake Grand Total row logic into the sortedSupervisors array or handle it in rendering?
                // The rendering logic likely expects sortedSupervisors to contain only supervisors.
                // The "Geral PRIME" row is usually rendered separately in the footer.
                // Let's check the rendering loop below.

                const sortedSupervisors = Array.from(supervisorGroups.values()).sort((a, b) => (b.totals['total_elma']?.metaFat || 0) - (a.totals['total_elma']?.metaFat || 0));
                currentGoalsSvData = sortedSupervisors;

                // Render HTML
                if (!mainTable) return;
                const monthsCount = quarterMonths.length;
                let headerHTML = `<thead class="text-[10px] uppercase sticky top-0 z-20 glass-panel text-slate-400"><tr><th rowspan="3" class="px-2 py-2 text-center w-16 border-r border-b border-slate-700">CÓD</th><th rowspan="3" class="px-3 py-2 text-left w-48 border-r border-b border-slate-700">VENDEDOR</th>`;
                svColumns.forEach(col => {
                    let colspan = 2;
                    if (col.type === 'standard') colspan = monthsCount + 1 + 4;
                    if (col.type === 'tonnage') colspan = 3; if (col.type === 'mix') colspan = 3; if (col.type === 'geral') colspan = 4;
                    headerHTML += `<th colspan="${colspan}" class="px-2 py-2 text-center font-bold border-r border-b border-slate-700 ${col.colorClass}">${col.label}</th>`;
                });
                headerHTML += `</tr><tr>`;
                svColumns.forEach(col => {
                    if (col.type === 'standard') headerHTML += `<th colspan="${monthsCount + 1}" class="px-1 py-1 text-center border-r border-slate-700/50 bg-glass">HISTÓRICO FAT.</th><th colspan="2" class="px-1 py-1 text-center border-r border-slate-700/50 bg-glass">FATURAMENTO</th><th colspan="2" class="px-1 py-1 text-center border-r border-slate-700 bg-glass">POSITIVAÇÃO</th>`;
                    else if (col.type === 'tonnage') headerHTML += `<th class="px-1 py-1 text-right border-r border-slate-700/50 bg-glass">MÉDIA TRIM.</th><th colspan="2" class="px-1 py-1 text-center border-r border-slate-700 bg-glass">META KG</th>`;
                    else if (col.type === 'mix') headerHTML += `<th class="px-1 py-1 text-right border-r border-slate-700/50 bg-glass">MÉDIA TRIM.</th><th colspan="2" class="px-1 py-1 text-center border-r border-slate-700 bg-glass">META MIX</th>`;
                    else if (col.type === 'geral') headerHTML += `<th colspan="2" class="px-1 py-1 text-center border-r border-slate-700/50 bg-glass">FATURAMENTO</th><th class="px-1 py-1 text-center border-r border-slate-700/50 bg-glass">KG</th><th class="px-1 py-1 text-center border-r border-slate-700 bg-glass">POSITIVAÇÃO</th>`;
                    else if (col.type === 'pedev') headerHTML += `<th class="px-1 py-1 text-center border-r border-slate-700/50 bg-glass">META</th>`;
                });
                headerHTML += `</tr><tr>`;
                const gearIcon = ``; /* Removed Icon as per request to remove editing option, but kept column structure */
                svColumns.forEach(col => {
                    if (col.type === 'standard') {
                        quarterMonths.forEach(m => headerHTML += `<th class="px-1 py-1 text-right border-r border-b border-slate-700 text-slate-500 font-normal w-12">${m.label}</th>`);
                        headerHTML += `<th class="px-1 py-1 text-right border-r border-b border-slate-700 text-slate-500 font-normal">Média</th><th class="px-1 py-1 text-right border-r border-b border-slate-700 text-slate-500 font-normal">Meta</th><th class="px-1 py-1 text-center border-r border-b border-slate-700 text-slate-500 font-normal">Aj.</th><th class="px-1 py-1 text-center border-r border-b border-slate-700 text-slate-500 font-normal">Meta</th><th class="px-1 py-1 text-center border-r border-b border-slate-700 text-slate-500 font-normal">Aj.</th>`;
                    } else if (col.type === 'tonnage') headerHTML += `<th class="px-1 py-1 text-right border-r border-b border-slate-700 text-slate-500 font-normal">Volume</th><th class="px-1 py-1 text-right border-r border-b border-slate-700 text-slate-500 font-normal">Volume</th><th class="px-1 py-1 text-center border-r border-b border-slate-700 text-slate-500 font-normal">Aj.</th>`;
                    else if (col.type === 'mix') headerHTML += `<th class="px-1 py-1 text-right border-r border-b border-slate-700 text-slate-500 font-normal">Qtd</th><th class="px-1 py-1 text-right border-r border-b border-slate-700 text-slate-500 font-normal">Meta</th><th class="px-1 py-1 text-center border-r border-b border-slate-700 text-slate-500 font-normal">Aj.</th>`;
                    else if (col.type === 'geral') headerHTML += `<th class="px-1 py-1 text-right border-r border-b border-slate-700 text-slate-500 font-normal">Média Trim.</th><th class="px-1 py-1 text-right border-r border-b border-slate-700 text-slate-500 font-normal">Meta</th><th class="px-1 py-1 text-right border-r border-b border-slate-700 text-slate-500 font-normal">Meta</th><th class="px-1 py-1 text-center border-r border-b border-slate-700 text-slate-500 font-normal">Meta</th>`;
                    else if (col.type === 'pedev') headerHTML += `<th class="px-1 py-1 text-center border-r border-b border-slate-700 text-slate-500 font-normal">Meta</th>`;
                });
                headerHTML += `</tr></thead>`;

                let bodyHTML = `<tbody class="divide-y divide-slate-800 bg-glass">`;
                // Grand Totals calc
                const grandTotals = {}; svColumns.forEach(col => { grandTotals[col.id] = { metaFat: 0, metaVol: 0, metaPos: 0, avgVol: 0, avgMix: 0, metaMix: 0, avgFat: 0, monthlyValues: {} }; quarterMonths.forEach(m => grandTotals[col.id].monthlyValues[m.key] = 0); });

                sortedSupervisors.forEach((sup, index) => {
                    sup.id = `sup-${index}`;
                    svColumns.forEach(col => {
                        grandTotals[col.id].metaFat += sup.totals[col.id].metaFat; grandTotals[col.id].metaVol += sup.totals[col.id].metaVol; grandTotals[col.id].metaPos += sup.totals[col.id].metaPos;
                        grandTotals[col.id].avgVol += sup.totals[col.id].avgVol; grandTotals[col.id].avgMix += sup.totals[col.id].avgMix; grandTotals[col.id].metaMix += sup.totals[col.id].metaMix;
                        grandTotals[col.id].avgFat += sup.totals[col.id].avgFat;
                        if (sup.totals[col.id].monthlyValues) quarterMonths.forEach(m => grandTotals[col.id].monthlyValues[m.key] += sup.totals[col.id].monthlyValues[m.key]);
                    });

                    sup.sellers.sort((a, b) => (b.data['total_elma']?.metaFat || 0) - (a.data['total_elma']?.metaFat || 0));
                    sup.sellers.forEach(seller => {
                        bodyHTML += `<tr class="hover:bg-white/5 border-b border-white/10"><td class="px-2 py-1 text-center text-slate-400 font-mono">${seller.code}</td><td class="px-2 py-1 text-left text-white font-medium truncate max-w-[200px]" title="${seller.name}">${getFirstName(seller.name)}</td>`;
                        svColumns.forEach(col => {
                            const d = seller.data[col.id] || { metaFat: 0, metaVol: 0, metaPos: 0, avgVol: 0, avgMix: 0, metaMix: 0, avgFat: 0, monthlyValues: {} };
                            if (col.type === 'standard') {
                                const isReadOnly = col.isAgg; const inputClass = isReadOnly ? 'text-slate-400 font-bold opacity-70' : 'text-yellow-300'; const readonlyAttr = 'readonly disabled'; const cellBg = isReadOnly ? 'bg-glass' : 'bg-glass';
                                quarterMonths.forEach(m => bodyHTML += `<td class="px-1 py-1 text-right text-slate-400 border-r border-white/10/50 text-[10px] bg-blue-900/5">${(d.monthlyValues[m.key] || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>`);
                                bodyHTML += `<td class="px-1 py-1 text-right text-slate-300 border-r border-white/10/50 bg-blue-900/10 font-medium">${d.avgFat.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td class="px-1 py-1 text-right ${col.colorClass} border-r border-white/10/50 text-xs font-mono">${d.metaFat.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td class="px-1 py-1 ${cellBg} border-r border-white/10/50"><input type="text" value="${d.metaFat.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}" class="goals-sv-input bg-transparent text-right w-full outline-none ${inputClass} text-xs font-mono" ${readonlyAttr}></td><td class="px-1 py-1 text-center text-slate-300 border-r border-white/10/50">${d.metaPos}</td><td class="px-1 py-1 ${cellBg} border-r border-white/10/50"><input type="text" value="${d.metaPos}" class="goals-sv-input bg-transparent text-center w-full outline-none ${inputClass} text-xs font-mono" ${readonlyAttr}></td>`;
                            } else if (col.type === 'tonnage') {
                                bodyHTML += `<td class="px-1 py-1 text-right text-slate-300 border-r border-white/10/50 font-mono text-xs">${d.avgVol.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Kg</td><td class="px-1 py-1 text-right text-slate-300 border-r border-white/10/50 font-bold font-mono text-xs">${d.metaVol.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Kg</td><td class="px-1 py-1 bg-glass border-r border-white/10/50"><input type="text" value="${d.metaVol.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}" class="goals-sv-input bg-transparent text-right w-full outline-none text-yellow-300 text-xs font-mono" readonly disabled></td>`;
                            } else if (col.type === 'mix') {
                                bodyHTML += `<td class="px-1 py-1 text-right text-slate-300 border-r border-white/10/50">${d.avgMix.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}</td><td class="px-1 py-1 text-right text-slate-300 border-r border-white/10/50 font-bold">${d.metaMix}</td><td class="px-1 py-1 bg-glass border-r border-white/10/50"><input type="text" value="${d.metaMix}" class="goals-sv-input bg-transparent text-right w-full outline-none text-yellow-300 text-xs font-mono" readonly disabled></td>`;
                            } else if (col.type === 'geral') {
                                bodyHTML += `<td class="px-1 py-1 text-right text-slate-400 border-r border-white/10/50 font-mono text-xs">${d.avgFat.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td class="px-1 py-1 text-right text-white font-bold border-r border-white/10/50 font-mono text-xs goals-sv-text" data-sup-id="${sup.id}" data-col-id="geral" data-field="fat" id="geral-${seller.id || seller.name.replace(/\s+/g,'_')}-fat">${d.metaFat.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td class="px-1 py-1 text-right text-white font-bold border-r border-white/10/50 font-mono text-xs goals-sv-text" data-sup-id="${sup.id}" data-col-id="geral" data-field="ton" id="geral-${seller.id || seller.name.replace(/\s+/g,'_')}-ton">${d.metaVol.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Kg</td><td class="px-1 py-1 text-center text-white font-bold border-r border-white/10/50 font-mono text-xs goals-sv-text" data-sup-id="${sup.id}" data-col-id="geral" data-field="pos" id="geral-${seller.id || seller.name.replace(/\s+/g,'_')}-pos">${d.metaPos}</td>`;
                            } else if (col.type === 'pedev') {
                                bodyHTML += `<td class="px-1 py-1 text-center text-pink-400 font-bold border-r border-white/10/50 font-mono text-xs goals-sv-text" data-sup-id="${sup.id}" data-col-id="pedev" data-field="pos" id="pedev-${seller.id || seller.name.replace(/\s+/g,'_')}-pos">${d.metaPos}</td>`;
                            }
                        });
                        bodyHTML += `</tr>`;
                    });

                    bodyHTML += `<tr class="glass-panel-heavy font-bold border-b border-slate-600"><td class="px-2 py-2 text-center text-slate-400 font-mono">${sup.code}</td><td class="px-2 py-2 text-left text-white uppercase tracking-wider">${sup.name}</td>`;
                    svColumns.forEach(col => {
                        const d = sup.totals[col.id]; const color = col.id.includes('total') || col.type === 'tonnage' || col.type === 'mix' ? 'text-white' : 'text-slate-300';
                        if (col.type === 'standard') {
                            quarterMonths.forEach(m => bodyHTML += `<td class="px-1 py-1 text-right text-slate-400 border-r border-slate-700 text-[10px] bg-blue-900/5">${(d.monthlyValues[m.key] || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>`);
                            bodyHTML += `<td class="px-1 py-1 text-right text-slate-300 border-r border-slate-700 bg-blue-900/10 font-medium">${d.avgFat.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td class="px-1 py-1 text-right ${color} border-r border-slate-700">${d.metaFat.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td class="px-1 py-1 text-right text-yellow-500/70 border-r border-slate-700" id="total-sup-${sup.id}-${col.id}-fat">${d.metaFat.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td class="px-1 py-1 text-center ${color} border-r border-slate-700">${d.metaPos}</td><td class="px-1 py-1 text-center text-yellow-500/70 border-r border-slate-700" id="total-sup-${sup.id}-${col.id}-pos">${d.metaPos}</td>`;
                        } else if (col.type === 'tonnage') bodyHTML += `<td class="px-1 py-1 text-right text-slate-300 border-r border-slate-700">${d.avgVol.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Kg</td><td class="px-1 py-1 text-right ${color} border-r border-slate-700">${d.metaVol.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Kg</td><td class="px-1 py-1 text-right text-yellow-500/70 border-r border-slate-700" id="total-sup-${sup.id}-${col.id}-vol">${d.metaVol.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Kg</td>`;
                        else if (col.type === 'mix') bodyHTML += `<td class="px-1 py-1 text-right text-slate-300 border-r border-slate-700">${d.avgMix.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}</td><td class="px-1 py-1 text-right ${color} border-r border-slate-700">${d.metaMix}</td><td class="px-1 py-1 text-right text-yellow-500/70 border-r border-slate-700" id="total-sup-${sup.id}-${col.id}-mix">${d.metaMix}</td>`;
                        else if (col.type === 'geral') bodyHTML += `<td class="px-1 py-1 text-right text-slate-400 border-r border-slate-700">${d.avgFat.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td class="px-1 py-1 text-right text-white border-r border-slate-700" id="total-sup-${sup.id}-geral-fat">${d.metaFat.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td class="px-1 py-1 text-right text-white border-r border-slate-700" id="total-sup-${sup.id}-geral-ton">${d.metaVol.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Kg</td><td class="px-1 py-1 text-center text-white border-r border-slate-700" id="total-sup-${sup.id}-geral-pos">${d.metaPos}</td>`;
                        else if (col.type === 'pedev') bodyHTML += `<td class="px-1 py-1 text-center text-pink-400 border-r border-slate-700" id="total-sup-${sup.id}-pedev-pos">${Math.round(sup.totals['total_elma']?.metaPos * 0.9)}</td>`;
                    });
                    bodyHTML += `</tr>`;
                });

                // Grand Total
                bodyHTML += `<tr class="glass-panel font-bold text-white border-t-2 border-slate-500 sticky bottom-0 z-20"><td class="px-2 py-3 text-center uppercase tracking-wider">GV</td><td class="px-2 py-3 text-left uppercase tracking-wider">Geral PRIME</td>`;
                svColumns.forEach(col => {
                    // Use recalculated grandTotalRow.totals instead of summed grandTotals
                    const d = grandTotalRow.totals[col.id] || { metaFat: 0, metaVol: 0, metaPos: 0, avgVol: 0, avgMix: 0, metaMix: 0, avgFat: 0 };
                    // Fallback to monthlyValues from original summation if needed (recalculation didn't handle it, but it's not critical for Meta Mix/Pos)
                    // Actually, let's use grandTotals for monthly/avgs and grandTotalRow for Metas if recalculated.
                    const dOrig = grandTotals[col.id];
                    const monthlyVals = dOrig ? dOrig.monthlyValues : {};
                    const avgFat = dOrig ? dOrig.avgFat : 0;
                    const avgVol = dOrig ? dOrig.avgVol : 0;
                    const avgMix = dOrig ? dOrig.avgMix : 0;

                    if (col.type === 'standard') {
                        quarterMonths.forEach(m => bodyHTML += `<td class="px-1 py-2 text-right text-slate-400 border-r border-slate-700 text-[10px] bg-blue-900/5">${(monthlyVals[m.key] || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>`);
                        bodyHTML += `<td class="px-1 py-2 text-right text-teal-400 border-r border-slate-700 bg-blue-900/10">${avgFat.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td class="px-1 py-2 text-right text-teal-400 border-r border-slate-700">${d.metaFat.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td class="px-1 py-2 text-right text-teal-600/70 border-r border-slate-700" id="total-grand-${col.id}-fat">${d.metaFat.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td class="px-1 py-2 text-center text-purple-400 border-r border-slate-700">${d.metaPos}</td><td class="px-1 py-2 text-center text-purple-600/70 border-r border-slate-700" id="total-grand-${col.id}-pos">${d.metaPos}</td>`;
                    } else if (col.type === 'tonnage') bodyHTML += `<td class="px-1 py-2 text-right text-slate-400 border-r border-slate-700">${avgVol.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td class="px-1 py-2 text-right text-orange-400 border-r border-slate-700">${d.metaVol.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td class="px-1 py-2 text-right text-orange-600/70 border-r border-slate-700" id="total-grand-${col.id}-vol">${d.metaVol.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>`;
                    else if (col.type === 'mix') bodyHTML += `<td class="px-1 py-2 text-right text-slate-400 border-r border-slate-700">${avgMix.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}</td><td class="px-1 py-2 text-right text-cyan-400 border-r border-slate-700">${d.metaMix}</td><td class="px-1 py-2 text-right text-cyan-600/70 border-r border-slate-700" id="total-grand-${col.id}-mix">${d.metaMix}</td>`;
                    else if (col.type === 'geral') bodyHTML += `<td class="px-1 py-2 text-right text-slate-500 border-r border-slate-700">${avgFat.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td class="px-1 py-2 text-right text-white border-r border-slate-700" id="total-grand-geral-fat">${d.metaFat.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td class="px-1 py-2 text-right text-white border-r border-slate-700" id="total-grand-geral-ton">${d.metaVol.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td class="px-1 py-2 text-center text-white border-r border-slate-700" id="total-grand-geral-pos">${d.metaPos}</td>`;
                    else if (col.type === 'pedev') bodyHTML += `<td class="px-1 py-2 text-center text-pink-400 border-r border-slate-700" id="total-grand-pedev-pos">${Math.round(grandTotalRow.totals['total_elma']?.metaPos * 0.9)}</td>`;
                });
                bodyHTML += `</tr></tbody>`;
                mainTable.innerHTML = headerHTML + bodyHTML;
            }, () => currentRenderId !== goalsSvRenderId);
        }

        function handleGoalsFilterChange() {
            // Update Dropdown Lists based on available data?
            // Standard pattern: Update filter lists based on selection of others?
            // For now, simpler: Just update the view.
            if (window.goalsUpdateTimeout) clearTimeout(window.goalsUpdateTimeout);
            window.goalsUpdateTimeout = setTimeout(() => {
                // Update Seller Filter options based on Supervisor
                // Get all clients matching supervisor filter, extract sellers.
                // This is slightly different from sales-based filtering.
                // Let's use allSalesData for consistency with other views to populate seller lists.

                updateGoalsView();
            }, 50);
        }

        function resetGoalsGvFilters() {
            if (hierarchyState['goals-gv']) {
                hierarchyState['goals-gv'].coords.clear();
                hierarchyState['goals-gv'].cocoords.clear();
                hierarchyState['goals-gv'].promotors.clear();

                if (userHierarchyContext.role !== 'adm') {
                    if (userHierarchyContext.coord) hierarchyState['goals-gv'].coords.add(userHierarchyContext.coord);
                    if (userHierarchyContext.cocoord) hierarchyState['goals-gv'].cocoords.add(userHierarchyContext.cocoord);
                    if (userHierarchyContext.promotor) hierarchyState['goals-gv'].promotors.add(userHierarchyContext.promotor);
                }

                updateHierarchyDropdown('goals-gv', 'coord');
                updateHierarchyDropdown('goals-gv', 'cocoord');
                updateHierarchyDropdown('goals-gv', 'promotor');
            }

            const codcli = document.getElementById('goals-gv-codcli-filter');
            if(codcli) codcli.value = '';

            updateGoalsView();
        }

        // <!-- INÍCIO DO CÓDIGO RESTAURADO -->

        function getCoverageFilteredData(options = {}) {
            const { excludeFilter = null } = options;
            const isExcluded = (f) => excludeFilter === f || (Array.isArray(excludeFilter) && excludeFilter.includes(f));

            const city = coverageCityFilter.value.trim().toLowerCase();
            const filial = coverageFilialFilter.value;
            const suppliersSet = new Set(selectedCoverageSuppliers);
            const productsSet = new Set(selectedCoverageProducts);
            const tiposVendaSet = new Set(selectedCoverageTiposVenda);

            // New Hierarchy Logic applied to Active Clients
            let clients = getHierarchyFilteredClients('coverage', getActiveClientsData());

            if (filial !== 'ambas' || city) {
                clients = clients.filter(c => {
                    let pass = true;
                    if (filial !== 'ambas') {
                        if (clientLastBranch.get(c['Código']) !== filial) pass = false;
                    }
                    if (pass && !isExcluded('city') && city) {
                        if ((c.cidade || '').toLowerCase() !== city) pass = false;
                    }
                    return pass;
                });
            }

            const clientCodes = new Set(clients.map(c => c['Código']));

            const filters = {
                filial,
                city,
                tipoVenda: tiposVendaSet,
                supplier: suppliersSet,
                product: productsSet,
                clientCodes
            };

            let sales = getFilteredDataFromIndices(optimizedData.indices.current, optimizedData.salesById, filters, excludeFilter);
            let history = getFilteredDataFromIndices(optimizedData.indices.history, optimizedData.historyById, filters, excludeFilter);

            const unitPriceInput = document.getElementById('coverage-unit-price-filter');
            const unitPrice = unitPriceInput && unitPriceInput.value ? parseFloat(unitPriceInput.value) : null;
            if (unitPrice !== null) {
                const unitPriceFilter = s => (s.QTVENDA > 0 && Math.abs((s.VLVENDA / s.QTVENDA) - unitPrice) < 0.01);
                sales = sales.filter(unitPriceFilter);
                history = history.filter(unitPriceFilter);
            }

            return { sales, history, clients };
        }

        function updateAllCoverageFilters(options = {}) {
            const { skipFilter = null } = options;

            const { sales: salesSupplier, history: historySupplier } = getCoverageFilteredData({ excludeFilter: ['supplier', 'product'] });
            selectedCoverageSuppliers = updateSupplierFilter(coverageSupplierFilterDropdown, coverageSupplierFilterText, selectedCoverageSuppliers, [...salesSupplier, ...historySupplier], 'coverage', skipFilter === 'supplier');

            const { sales: salesProd, history: historyProd } = getCoverageFilteredData({ excludeFilter: 'product' });
            selectedCoverageProducts = updateProductFilter(coverageProductFilterDropdown, coverageProductFilterText, selectedCoverageProducts, [...salesProd, ...historyProd], 'coverage', skipFilter === 'product');

            const { sales: salesTV, history: historyTV } = getCoverageFilteredData({ excludeFilter: 'tipoVenda' });
            selectedCoverageTiposVenda = updateTipoVendaFilter(coverageTipoVendaFilterDropdown, coverageTipoVendaFilterText, selectedCoverageTiposVenda, [...salesTV, ...historyTV], skipFilter === 'tipoVenda');
        }

        function handleCoverageFilterChange(options = {}) {
            // Debounce update to prevent UI freezing during rapid selection
            if (window.coverageUpdateTimeout) clearTimeout(window.coverageUpdateTimeout);
            window.coverageUpdateTimeout = setTimeout(() => {
                 updateAllCoverageFilters(options);
                 updateCoverageView();
            }, 10);
        }

        function resetCoverageFilters() {
            coverageCityFilter.value = '';
            coverageFilialFilter.value = 'ambas';

            const unitPriceInput = document.getElementById('coverage-unit-price-filter');
            if(unitPriceInput) unitPriceInput.value = '';

            const workingDaysInput = document.getElementById('coverage-working-days-input');
            if(workingDaysInput) workingDaysInput.value = customWorkingDaysCoverage;

            selectedCoverageSuppliers = [];
            selectedCoverageProducts = [];
            selectedCoverageTiposVenda = [];

            updateAllCoverageFilters();
            updateCoverageView();
        }

        function updateCoverageView() {
            coverageRenderId++;
            const currentRenderId = coverageRenderId;

            const { clients, sales, history } = getCoverageFilteredData();
            const productsToAnalyze = [...new Set([...sales.map(s => s.PRODUTO), ...history.map(s => s.PRODUTO)])];

            const activeClientsForCoverage = clients;
            const activeClientsCount = activeClientsForCoverage.length;
            // Normalize keys for robust Set matching
            const activeClientCodes = new Set(activeClientsForCoverage.map(c => normalizeKey(c['Código'] || c['codigo_cliente'])));

            coverageActiveClientsKpi.textContent = activeClientsCount.toLocaleString('pt-BR');

            // Show Loading State in Table
            coverageTableBody.innerHTML = getSkeletonRows(8, 10);

            if (productsToAnalyze.length === 0) {
                coverageSelectionCoverageValueKpi.textContent = '0%';
                coverageSelectionCoverageCountKpi.textContent = `0 de ${activeClientsCount.toLocaleString('pt-BR')} clientes`;
                coverageSelectionCoverageValueKpiPrevious.textContent = '0%';
                coverageSelectionCoverageCountKpiPrevious.textContent = `0 de ${activeClientsCount.toLocaleString('pt-BR')} clientes`;
                coverageTopCoverageValueKpi.textContent = '0%';
                coverageTopCoverageProductKpi.textContent = '-';
                coverageTableBody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-slate-500">Nenhum produto selecionado ou encontrado para os filtros.</td></tr>';
                showNoDataMessage('coverageCityChart', 'Sem dados para exibir.');
                return;
            }

            const tableData = [];
            const clientSelectionValueCurrent = new Map(); // Map<CODCLI, Value>
            const clientSelectionValuePrevious = new Map(); // Map<CODCLI, Value>
            let topCoverageItem = { name: '-', coverage: 0, clients: 0 };
            const activeStockMap = getActiveStockMap(coverageFilialFilter.value);

            const currentMonth = lastSaleDate.getUTCMonth();
            const currentYear = lastSaleDate.getUTCFullYear();
            const prevMonthIdx = (currentMonth === 0) ? 11 : currentMonth - 1;
            const prevMonthYear = (currentMonth === 0) ? currentYear - 1 : currentYear;

            // --- CRITICAL OPTIMIZATION: Pre-aggregate everything ---

            // Maps for Box Quantities: Map<PRODUTO, Number>
            const boxesSoldCurrentMap = new Map();
            const boxesSoldPreviousMap = new Map();

            // Index for Trend Calculation: Map<PRODUTO, Array<Sale>>
            // We group all sales (current + history) by product to calculate trend efficiently
            const trendSalesMap = new Map();

            // Process Current Sales (O(N))
            // --- OTIMIZAÇÃO: Mapa invertido para performance O(1) no cálculo de cobertura ---
            const productClientsCurrent = new Map(); // Map<PRODUTO, Map<CODCLI, Value>>
            const productClientsPrevious = new Map(); // Map<PRODUTO, Map<CODCLI, Value>>

            // Use synchronous loops for initial map building as iterating sales (linear) is generally fast enough
            // (e.g. 50k sales ~ 50ms). Splitting this would require complex state management.
            // The bottleneck is the nested Product * Client check loop later.

            sales.forEach(s => {
                if (!isAlternativeMode(selectedCoverageTiposVenda) && s.TIPOVENDA !== '1' && s.TIPOVENDA !== '9') return;
                const val = getValueForSale(s, selectedCoverageTiposVenda);

                // Coverage Map (Inverted for Performance)
                if (!productClientsCurrent.has(s.PRODUTO)) productClientsCurrent.set(s.PRODUTO, new Map());
                const clientMap = productClientsCurrent.get(s.PRODUTO);
                // Use normalized key for consistency
                const buyerKey = normalizeKey(s.CODCLI);
                clientMap.set(buyerKey, (clientMap.get(buyerKey) || 0) + val);

                // Box Quantity Map
                boxesSoldCurrentMap.set(s.PRODUTO, (boxesSoldCurrentMap.get(s.PRODUTO) || 0) + s.QTVENDA_EMBALAGEM_MASTER);

                // Trend Map
                if (!trendSalesMap.has(s.PRODUTO)) trendSalesMap.set(s.PRODUTO, []);
                trendSalesMap.get(s.PRODUTO).push(s);
            });

            // Process History Sales (O(N))
            history.forEach(s => {
                const d = parseDate(s.DTPED);
                const isPrevMonth = d && d.getUTCMonth() === prevMonthIdx && d.getUTCFullYear() === prevMonthYear;

                if (!isAlternativeMode(selectedCoverageTiposVenda) && s.TIPOVENDA !== '1' && s.TIPOVENDA !== '9') return;
                const val = getValueForSale(s, selectedCoverageTiposVenda);

                // Coverage Map (only if prev month)
                if (isPrevMonth) {
                    // Coverage Map (Inverted for Performance)
                    if (!productClientsPrevious.has(s.PRODUTO)) productClientsPrevious.set(s.PRODUTO, new Map());
                    const clientMap = productClientsPrevious.get(s.PRODUTO);
                    // Use normalized key for consistency
                    const buyerKey = normalizeKey(s.CODCLI);
                    clientMap.set(buyerKey, (clientMap.get(buyerKey) || 0) + val);

                    // Box Quantity Map (only if prev month)
                    boxesSoldPreviousMap.set(s.PRODUTO, (boxesSoldPreviousMap.get(s.PRODUTO) || 0) + s.QTVENDA_EMBALAGEM_MASTER);
                }

                // Trend Map (All history)
                if (!trendSalesMap.has(s.PRODUTO)) trendSalesMap.set(s.PRODUTO, []);
                trendSalesMap.get(s.PRODUTO).push(s);
            });

            // Pre-calculate global dates for Trend
            const endDate = parseDate(sortedWorkingDays[sortedWorkingDays.length - 1]);

            // --- ASYNC CHUNKED PROCESSING ---
            runAsyncChunked(productsToAnalyze, (productCode) => {
                const productInfo = productDetailsMap.get(productCode) || { descricao: `Produto ${productCode}`};

                let clientsWhoGotProductCurrent = 0;
                let clientsWhoGotProductPrevious = 0;

                // --- OTIMIZAÇÃO CRÍTICA: Iterar apenas os compradores do produto em vez de todos os clientes ativos ---

                // Check Current
                const buyersCurrentMap = productClientsCurrent.get(productCode);
                if (buyersCurrentMap) {
                    buyersCurrentMap.forEach((val, buyer) => {
                        if (activeClientCodes.has(buyer)) {
                            if (val >= 1) clientsWhoGotProductCurrent++;
                            clientSelectionValueCurrent.set(buyer, (clientSelectionValueCurrent.get(buyer) || 0) + val);
                        }
                    });
                }

                // Check Previous
                const buyersPreviousMap = productClientsPrevious.get(productCode);
                if (buyersPreviousMap) {
                    buyersPreviousMap.forEach((val, buyer) => {
                        if (activeClientCodes.has(buyer)) {
                            if (val >= 1) clientsWhoGotProductPrevious++;
                            clientSelectionValuePrevious.set(buyer, (clientSelectionValuePrevious.get(buyer) || 0) + val);
                        }
                    });
                }

                const coverageCurrent = activeClientsCount > 0 ? (clientsWhoGotProductCurrent / activeClientsCount) * 100 : 0;

                if (coverageCurrent > topCoverageItem.coverage) {
                    topCoverageItem = {
                        name: `(${productCode}) ${productInfo.descricao}`,
                        coverage: coverageCurrent,
                        clients: clientsWhoGotProductCurrent
                    };
                }

                const stockQty = activeStockMap.get(productCode) || 0;

                // Trend Calculation
                const productAllSales = trendSalesMap.get(productCode) || [];

                const productCadastroDate = parseDate(productInfo.dtCadastro);
                let productFirstWorkingDayIndex = 0;
                if (productCadastroDate) {
                    const cadastroDateString = productCadastroDate.toISOString().split('T')[0];
                    productFirstWorkingDayIndex = sortedWorkingDays.findIndex(d => d >= cadastroDateString);
                    if (productFirstWorkingDayIndex === -1) productFirstWorkingDayIndex = sortedWorkingDays.length;
                }
                const productMaxLifeInWorkingDays = sortedWorkingDays.length - productFirstWorkingDayIndex;

                const hasHistory = productAllSales.some(s => {
                    const d = parseDate(s.DTPED);
                    return d && (d.getUTCFullYear() < currentYear || (d.getUTCFullYear() === currentYear && d.getUTCMonth() < currentMonth));
                });
                const soldThisMonth = (boxesSoldCurrentMap.get(productCode) || 0) > 0;
                const isFactuallyNewOrReactivated = (!hasHistory && soldThisMonth);

                const daysFromBox = customWorkingDaysCoverage;
                let effectiveDaysToCalculate;

                if (isFactuallyNewOrReactivated) {
                    const daysToConsider = (daysFromBox > 0) ? daysFromBox : passedWorkingDaysCurrentMonth;
                    effectiveDaysToCalculate = Math.min(passedWorkingDaysCurrentMonth, daysToConsider);
                } else {
                    if (daysFromBox > 0) {
                        effectiveDaysToCalculate = Math.min(daysFromBox, productMaxLifeInWorkingDays);
                    } else {
                        effectiveDaysToCalculate = productMaxLifeInWorkingDays;
                    }
                }

                const daysDivisor = effectiveDaysToCalculate > 0 ? effectiveDaysToCalculate : 1;
                const targetIndex = Math.max(0, sortedWorkingDays.length - daysDivisor);
                const startDate = parseDate(sortedWorkingDays[targetIndex]);

                let totalQtySoldInRange = 0;
                // Optimized loop: only iterating relevant sales for this product
                productAllSales.forEach(sale => {
                    const saleDate = parseDate(sale.DTPED);
                    if (saleDate && saleDate >= startDate && saleDate <= endDate) {
                        totalQtySoldInRange += (sale.QTVENDA_EMBALAGEM_MASTER || 0);
                    }
                });

                const dailyAvgSale = totalQtySoldInRange / daysDivisor;
                const trendDays = dailyAvgSale > 0 ? (stockQty / dailyAvgSale) : (stockQty > 0 ? Infinity : 0);

                // Box Quantities (Pre-calculated)
                const boxesSoldCurrentMonth = boxesSoldCurrentMap.get(productCode) || 0;
                const boxesSoldPreviousMonth = boxesSoldPreviousMap.get(productCode) || 0;

                const boxesVariation = boxesSoldPreviousMonth > 0
                    ? ((boxesSoldCurrentMonth - boxesSoldPreviousMonth) / boxesSoldPreviousMonth) * 100
                    : (boxesSoldCurrentMonth > 0 ? Infinity : 0);

                const pdvVariation = clientsWhoGotProductPrevious > 0
                    ? ((clientsWhoGotProductCurrent - clientsWhoGotProductPrevious) / clientsWhoGotProductPrevious) * 100
                    : (clientsWhoGotProductCurrent > 0 ? Infinity : 0);

                tableData.push({
                    descricao: `(${productCode}) ${productInfo.descricao}`,
                    stockQty: stockQty,
                    boxesSoldCurrentMonth: boxesSoldCurrentMonth,
                    boxesSoldPreviousMonth: boxesSoldPreviousMonth,
                    boxesVariation: boxesVariation,
                    pdvVariation: pdvVariation,
                    trendDays: trendDays,
                    clientsPreviousCount: clientsWhoGotProductPrevious,
                    clientsCurrentCount: clientsWhoGotProductCurrent,
                    coverageCurrent: coverageCurrent
                });
            }, () => {
                // --- ON COMPLETE CALLBACK (Render UI) ---
                if (currentRenderId !== coverageRenderId) return;

                coverageTopCoverageValueKpi.textContent = `${topCoverageItem.coverage.toFixed(2)}%`;
                coverageTopCoverageProductKpi.textContent = topCoverageItem.name;
                coverageTopCoverageProductKpi.title = topCoverageItem.name;
                if (coverageTopCoverageCountKpi) {
                    coverageTopCoverageCountKpi.textContent = `${topCoverageItem.clients.toLocaleString('pt-BR')} PDVs`;
                    coverageTopCoverageCountKpi.classList.remove('hidden');
                }

                let selectionCoveredCountCurrent = 0;
                clientSelectionValueCurrent.forEach(val => { if (val >= 1) selectionCoveredCountCurrent++; });
                const selectionCoveragePercentCurrent = activeClientsCount > 0 ? (selectionCoveredCountCurrent / activeClientsCount) * 100 : 0;
                coverageSelectionCoverageValueKpi.textContent = `${selectionCoveragePercentCurrent.toFixed(2)}%`;
                coverageSelectionCoverageCountKpi.textContent = `${selectionCoveredCountCurrent.toLocaleString('pt-BR')} de ${activeClientsCount.toLocaleString('pt-BR')} clientes`;

                let selectionCoveredCountPrevious = 0;
                clientSelectionValuePrevious.forEach(val => { if (val >= 1) selectionCoveredCountPrevious++; });
                const selectionCoveragePercentPrevious = activeClientsCount > 0 ? (selectionCoveredCountPrevious / activeClientsCount) * 100 : 0;
                coverageSelectionCoverageValueKpiPrevious.textContent = `${selectionCoveragePercentPrevious.toFixed(2)}%`;
                coverageSelectionCoverageCountKpiPrevious.textContent = `${selectionCoveredCountPrevious.toLocaleString('pt-BR')} de ${activeClientsCount.toLocaleString('pt-BR')} clientes`;

                tableData.sort((a, b) => {
                    return b.stockQty - a.stockQty;
                });

                let filteredTableData = tableData.filter(item => item.boxesSoldCurrentMonth > 0);

                if (coverageTrendFilter !== 'all') {
                    filteredTableData = filteredTableData.filter(item => {
                        const trend = item.trendDays;
                        if (coverageTrendFilter === 'low') return isFinite(trend) && trend < 15;
                        if (coverageTrendFilter === 'medium') return isFinite(trend) && trend >= 15 && trend < 30;
                        if (coverageTrendFilter === 'good') return isFinite(trend) && trend >= 30;
                        return false;
                    });
                }

                const totalBoxesFiltered = filteredTableData.reduce((sum, item) => sum + item.boxesSoldCurrentMonth, 0);
                if (coverageTotalBoxesEl) {
                    coverageTotalBoxesEl.textContent = totalBoxesFiltered.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
                }

                coverageTableDataForExport = filteredTableData;

                coverageTableBody.innerHTML = filteredTableData.slice(0, 500).map(item => {
                    let boxesVariationContent;
                    if (isFinite(item.boxesVariation)) {
                        const colorClass = item.boxesVariation >= 0 ? 'text-green-400' : 'text-red-400';
                        boxesVariationContent = `<span class="${colorClass}">${item.boxesVariation.toFixed(1)}%</span>`;
                    } else if (item.boxesVariation === Infinity) {
                        boxesVariationContent = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/30 text-purple-300">Novo</span>`;
                    } else {
                        boxesVariationContent = `<span>-</span>`;
                    }

                    let pdvVariationContent;
                    if (isFinite(item.pdvVariation)) {
                        const colorClass = item.pdvVariation >= 0 ? 'text-green-400' : 'text-red-400';
                        pdvVariationContent = `<span class="${colorClass}">${item.pdvVariation.toFixed(1)}%</span>`;
                    } else if (item.pdvVariation === Infinity) {
                        pdvVariationContent = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/30 text-purple-300">Novo</span>`;
                    } else {
                        pdvVariationContent = `<span>-</span>`;
                    }

                    return `
                        <tr class="hover:bg-slate-700/50">
                            <td data-label="Produto" class="px-2 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs truncate max-w-[120px] md:max-w-xs" title="${item.descricao}">${item.descricao}</td>
                            <td data-label="Estoque" class="px-2 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs text-right hidden md:table-cell">${item.stockQty.toLocaleString('pt-BR')}</td>
                            <td data-label="Vol Ant (Cx)" class="px-2 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs text-right hidden md:table-cell">${item.boxesSoldPreviousMonth.toLocaleString('pt-BR', {maximumFractionDigits: 2})}</td>
                            <td data-label="Vol Atual (Cx)" class="px-2 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs text-right">${item.boxesSoldCurrentMonth.toLocaleString('pt-BR', {maximumFractionDigits: 2})}</td>
                            <td data-label="Var Vol" class="px-2 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs text-right">${boxesVariationContent}</td>
                            <td data-label="PDV Ant" class="px-2 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs text-right hidden md:table-cell">${item.clientsPreviousCount.toLocaleString('pt-BR')}</td>
                            <td data-label="PDV Atual" class="px-2 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs text-right hidden md:table-cell">${item.clientsCurrentCount.toLocaleString('pt-BR')}</td>
                            <td data-label="Var PDV" class="px-2 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs text-right">${pdvVariationContent}</td>
                        </tr>
                    `;
                }).join('');

                // Render Top 10 Cities Chart
                const salesByCity = {};
                const salesBySeller = {};

                sales.forEach(s => {
                    const client = clientMapForKPIs.get(String(s.CODCLI));
                    const city = client ? (client.cidade || client['Nome da Cidade'] || 'N/A') : 'N/A';
                    salesByCity[city] = (salesByCity[city] || 0) + s.QTVENDA_EMBALAGEM_MASTER;

                    const seller = s.NOME || 'N/A';
                    salesBySeller[seller] = (salesBySeller[seller] || 0) + s.QTVENDA_EMBALAGEM_MASTER;
                });

                // 1. Chart Data for Cities
                const sortedCities = Object.entries(salesByCity)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 10);

                // 2. Chart Data for Sellers
                const sortedSellers = Object.entries(salesBySeller)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 10);

                const commonChartOptions = {
                    indexAxis: 'x',
                    plugins: {
                        datalabels: {
                            align: 'end',
                            anchor: 'end',
                            color: '#cbd5e1',
                            font: { weight: 'bold', size: 14 },
                            formatter: (value) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += context.parsed.y.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' caixas';
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                };

                if (sortedCities.length > 0) {
                    createChart('coverageCityChart', 'bar', sortedCities.map(([city]) => city), sortedCities.map(([, qty]) => qty), commonChartOptions);
                } else {
                    showNoDataMessage('coverageCityChart', 'Sem dados para exibir.');
                }

                if (sortedSellers.length > 0) {
                    createChart('coverageSellerChart', 'bar', sortedSellers.map(([seller]) => getFirstName(seller)), sortedSellers.map(([, qty]) => qty), commonChartOptions);
                } else {
                    showNoDataMessage('coverageSellerChart', 'Sem dados para exibir.');
                }

                // Visibility Toggle Logic
                const cityContainer = document.getElementById('coverageCityChartContainer');
                const sellerContainer = document.getElementById('coverageSellerChartContainer');
                const toggleBtn = document.getElementById('coverage-chart-toggle-btn');
                const chartTitle = document.getElementById('coverage-chart-title');

                if (currentCoverageChartMode === 'city') {
                    if (cityContainer) cityContainer.classList.remove('hidden');
                    if (sellerContainer) sellerContainer.classList.add('hidden');
                    if (toggleBtn) toggleBtn.textContent = 'Ver Vendedores';
                    if (chartTitle) chartTitle.textContent = 'Top 10 Cidades (Quantidade de Caixas)';
                } else {
                    if (cityContainer) cityContainer.classList.add('hidden');
                    if (sellerContainer) sellerContainer.classList.remove('hidden');
                    if (toggleBtn) toggleBtn.textContent = 'Ver Cidades';
                    if (chartTitle) chartTitle.textContent = 'Top 10 Vendedores (Quantidade de Caixas)';
                }
            }, () => currentRenderId !== coverageRenderId);
        }

        // <!-- FIM DO CÓDIGO RESTAURADO -->

        function getUniqueMonthCount(data) {
            const months = new Set();
            data.forEach(sale => {
                const saleDate = parseDate(sale.DTPED);
                if (saleDate) {
                    const monthKey = `${saleDate.getUTCFullYear()}-${saleDate.getUTCMonth()}`;
                    months.add(monthKey);
                }
            });
            return months.size > 0 ? months.size : 1;
        }

        function calculateSummaryFromData(data, isFiltered, clientBaseForPositivacao) {
            const summary = {
                totalFaturamento: 0, totalPeso: 0, vendasPorVendedor: {}, vendasPorSupervisor: {},
                vendasPorCoord: {}, vendasPorCoCoord: {}, vendasPorPromotor: {}, // New Hierarchy Aggregation
                top10ProdutosFaturamento: [], top10ProdutosPeso: [], faturamentoPorFornecedor: {},
                skuPdv: 0, positivacaoCount: 0, positivacaoPercent: 0
            };
            const salesByProduct = {};
            const faturamentoMap = new Map();

            // --- INÍCIO DA MODIFICAÇÃO: KPIs de Cobertura e SKU ---

            // 1. Lógica de Positivação (Cobertura)
            // Registar clientes que tiveram *qualquer* operação (Venda OU Bonificação)
            const positiveClients = new Set();
            const clientUniqueSkus = new Map(); // Map<CodCli, Set<Produto>>

            // 1. Lógica de Positivação (Cobertura) - Alinhada com Comparativo
            // Agrega valor total por cliente para verificar threshold >= 1
            const clientTotalSales = new Map();

            data.forEach(sale => {
                if (!isAlternativeMode(selectedTiposVenda) && sale.TIPOVENDA !== '1' && sale.TIPOVENDA !== '9') return;
                if (sale.CODCLI) {
                    const currentVal = clientTotalSales.get(sale.CODCLI) || 0;
                    // Considera apenas VLVENDA para consistência com o KPI "Clientes Atendidos" do Comparativo
                    // Se a regra de bonificação mudar lá, deve mudar aqui também.
                    // Atualmente Comparativo usa: (s.TIPOVENDA === '1' || s.TIPOVENDA === '9') -> VLVENDA
                    // Note que 'data' aqui já vem filtrado, mas precisamos checar se o valor agregado passa do threshold
                    const val = getValueForSale(sale, selectedTiposVenda);
                    clientTotalSales.set(sale.CODCLI, currentVal + val);

                    // Rastrear SKUs únicos (mantendo lógica existente para SKU/PDV)
                    // Mas apenas se o cliente for considerado "positivo" no final?
                    // Não, SKU/PDV geralmente considera tudo que foi movimentado.
                    // Porém, para consistência, se o cliente não conta como "Atendido", seus SKUs deveriam contar?
                    // Normalmente SKU/PDV é (Total SKUs Movimentados) / (Total Clientes Atendidos).
                    // Vamos manter o rastreamento aqui, mas usar o denominador corrigido.
                    if (!clientUniqueSkus.has(sale.CODCLI)) {
                        clientUniqueSkus.set(sale.CODCLI, new Set());
                    }
                    clientUniqueSkus.get(sale.CODCLI).add(sale.PRODUTO);
                }
            });

            clientTotalSales.forEach((total, codCli) => {
                if (total >= 1) {
                    positiveClients.add(codCli);
                }
            });
            summary.positivacaoCount = positiveClients.size;

            let totalSkus = 0;
            // Somar a quantidade de SKUs ÚNICOS por cliente
            clientUniqueSkus.forEach(skus => {
                totalSkus += skus.size;
            });

            data.forEach(item => {
                if (!isAlternativeMode(selectedTiposVenda) && item.TIPOVENDA !== '1' && item.TIPOVENDA !== '9') return;
                const vlVenda = getValueForSale(item, selectedTiposVenda);
                const totPesoLiq = Number(item.TOTPESOLIQ) || 0;

                summary.totalFaturamento += vlVenda;
                summary.totalPeso += totPesoLiq;

                const isForbidden = (str) => !str || FORBIDDEN_KEYS.includes(str.trim().toUpperCase());

                const vendedor = item.NOME || 'N/A';
                if (!isForbidden(vendedor)) {
                    summary.vendasPorVendedor[vendedor] = (summary.vendasPorVendedor[vendedor] || 0) + vlVenda;
                }

                const supervisor = item.SUPERV || 'N/A';
                if (!isForbidden(supervisor)) {
                    summary.vendasPorSupervisor[supervisor] = (summary.vendasPorSupervisor[supervisor] || 0) + vlVenda;
                }

                // New Hierarchy Aggregation
                const hierarchy = optimizedData.clientHierarchyMap.get(item.CODCLI);
                if (hierarchy) {
                    const c = hierarchy.coord.name;
                    const cc = hierarchy.cocoord.name;
                    const p = hierarchy.promotor.name;
                    if (c) summary.vendasPorCoord[c] = (summary.vendasPorCoord[c] || 0) + vlVenda;
                    if (cc) summary.vendasPorCoCoord[cc] = (summary.vendasPorCoCoord[cc] || 0) + vlVenda;
                    if (p) summary.vendasPorPromotor[p] = (summary.vendasPorPromotor[p] || 0) + vlVenda;
                } else {
                    const unk = 'Sem Estrutura';
                    summary.vendasPorCoord[unk] = (summary.vendasPorCoord[unk] || 0) + vlVenda;
                    summary.vendasPorCoCoord[unk] = (summary.vendasPorCoCoord[unk] || 0) + vlVenda;
                    summary.vendasPorPromotor[unk] = (summary.vendasPorPromotor[unk] || 0) + vlVenda;
                }

                const produto = item.DESCRICAO || 'N/A';
                const codigo = item.PRODUTO || 'N/A';
                if (!salesByProduct[produto]) salesByProduct[produto] = { faturamento: 0, peso: 0, codigo: codigo };
                salesByProduct[produto].faturamento += vlVenda;
                salesByProduct[produto].peso += totPesoLiq;

                let fornecedorLabel;
                // Sempre usar a lógica detalhada de categoria para manter consistência do gráfico
                // Lógica de "Faturamento por Categoria" detalhada para PEPSICO
                const rowPasta = item.OBSERVACAOFOR;
                if (rowPasta === 'PEPSICO') {
                    const codFor = String(item.CODFOR);
                    const desc = normalize(item.DESCRICAO || '');

                    if (codFor === window.SUPPLIER_CODES.ELMA[0]) {
                        fornecedorLabel = 'Extrusados';
                    } else if (codFor === window.SUPPLIER_CODES.ELMA[1]) {
                        fornecedorLabel = 'Não Extrusados';
                    } else if (codFor === window.SUPPLIER_CODES.ELMA[2]) {
                        fornecedorLabel = 'Torcida';
                    } else if (codFor === window.SUPPLIER_CODES.FOODS[0]) {
                        if (desc.includes('TODDYNHO')) fornecedorLabel = 'Toddynho';
                        else if (desc.includes('TODDY')) fornecedorLabel = 'Toddy';
                        else if (desc.includes('QUAKER')) fornecedorLabel = 'Quaker';
                        else if (desc.includes('KEROCOCO')) fornecedorLabel = 'Kero Coco';
                        else fornecedorLabel = 'Outros Foods';
                    } else {
                        fornecedorLabel = 'Outros Pepsico';
                    }
                } else {
                    fornecedorLabel = rowPasta || 'N/A';
                }

                if (!isForbidden(fornecedorLabel)) {
                    const currentTotal = faturamentoMap.get(fornecedorLabel) || 0;
                    faturamentoMap.set(fornecedorLabel, currentTotal + vlVenda);
                }
            });

            const totalRelevantClients = clientBaseForPositivacao.length;
            summary.positivacaoPercent = totalRelevantClients > 0 ? (summary.positivacaoCount / totalRelevantClients) * 100 : 0;
            // O cálculo do SKU/PDV agora usa a nova contagem de SKUs e a nova contagem de positivação
            summary.skuPdv = summary.positivacaoCount > 0 ? totalSkus / summary.positivacaoCount : 0;
            // --- FIM DA MODIFICAÇÃO ---

            summary.faturamentoPorFornecedor = Object.fromEntries(faturamentoMap);
            summary.top10ProdutosFaturamento = Object.entries(salesByProduct).sort(([,a],[,b]) => b.faturamento - a.faturamento).slice(0, 10).map(([p, d]) => ({ produto: p, ...d }));
            summary.top10ProdutosPeso = Object.entries(salesByProduct).sort(([,a],[,b]) => b.peso - a.peso).slice(0, 10).map(([p, d]) => ({ produto: p, ...d }));
            return summary;
        }

        const isObject = obj => obj && typeof obj === 'object' && !Array.isArray(obj);
        const mergeDeep = (...objects) => {
            return objects.reduce((prev, obj) => {
                Object.keys(obj).forEach(key => {
                    const pVal = prev[key];
                    const oVal = obj[key];
                    if (isObject(pVal) && isObject(oVal)) prev[key] = mergeDeep(pVal, oVal);
                    else prev[key] = oVal;
                });
                return prev;
            }, {});
        };

        function createChart(canvasId, type, labels, chartData, optionsOverrides = {}, pluginsToRegister = []) {
            const container = document.getElementById(canvasId + 'Container');
            if (!container) {
                console.error(`Chart container not found for id: ${canvasId}Container`);
                return;
            }

            if (pluginsToRegister.length > 0) {
                try { Chart.register(...pluginsToRegister); } catch (e) {}
            }

            const isLightMode = document.documentElement.classList.contains('light');
            const textColor = isLightMode ? '#1e293b' : '#cbd5e1'; // slate-800 vs slate-300
            const tickColor = isLightMode ? '#475569' : '#94a3b8'; // slate-600 vs slate-400
            const gridColor = isLightMode ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';

            // Semantic Palette: Green (Success), Blue (Good), Purple (Neutral/Meta), Amber (Warning), Red (Danger)
            const professionalPalette = ['#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#64748b', '#06b6d4', '#ec4899'];

            // Shades of Blue Palette for Sales Chart (Matches Performance)
            const bluePalette = [
                '#3b82f6', // blue-500 (Primary)
                '#2563eb', // blue-600
                '#60a5fa', // blue-400
                '#1d4ed8', // blue-700
                '#93c5fd', // blue-300
                '#1e40af', // blue-800
                '#bfdbfe', // blue-200
                '#1e3a8a', // blue-900
                '#dbeafe', // blue-100
                '#eff6ff'  // blue-50
            ];

            let finalDatasets;
            if (Array.isArray(chartData) && chartData.length > 0 && typeof chartData[0] === 'object' && chartData[0].hasOwnProperty('label')) {
                finalDatasets = chartData.map((dataset, index) => ({ ...dataset, backgroundColor: dataset.backgroundColor || professionalPalette[index % professionalPalette.length], borderColor: dataset.borderColor || professionalPalette[index % professionalPalette.length] }));
            } else {
                 let bgColor = professionalPalette;
                 if (canvasId === 'customerStatusChart') bgColor = ['#2dd4bf', '#f59e0b'];
                 else if (canvasId === 'salesByProductBarChart') bgColor = bluePalette;

                 finalDatasets = [{ data: chartData || [], backgroundColor: bgColor }];
            }

            let baseOptions = {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 25 } },
                plugins: {
                    legend: { display: false, labels: {color: textColor} },
                    datalabels: { display: false },
                    tooltip: {
                        backgroundColor: isLightMode ? '#ffffff' : '#1e293b',
                        titleColor: isLightMode ? '#0f172a' : '#f1f5f9',
                        bodyColor: isLightMode ? '#334155' : '#cbd5e1',
                        borderColor: isLightMode ? '#e2e8f0' : '#334155',
                        borderWidth: 1,
                    }
                },
                scales: {
                    y: { beginAtZero: true, grace: '5%', ticks: { color: tickColor }, grid: { color: gridColor} },
                    x: { ticks: { color: tickColor }, grid: { color: gridColor} }
                }
            };

            let typeDefaults = {};
            if (type === 'bar') typeDefaults = { layout: { padding: { right: 30, top: 30 } }, plugins: { datalabels: { display: true, anchor: 'end', align: 'end', offset: -4, color: textColor, font: { size: 10 }, formatter: (v) => (v > 1000 ? (v/1000).toFixed(1) + 'k' : v.toFixed(0)) } } };
            if (type === 'doughnut') typeDefaults = { maintainAspectRatio: true, scales: { y: { display: false }, x: { display: false } }, plugins: { legend: { position: 'top', labels: { color: textColor } }, datalabels: { display: true, color: '#fff', font: { size: 11, weight: 'bold' }, formatter: (v, ctx) => { const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0); if(total === 0 || v === 0) return ''; const p = (v / total) * 100; return p > 5 ? p.toFixed(0) + '%' : ''; } } } };

            // 1. Sempre construir um objeto de opções novo e limpo
            const options = mergeDeep({}, baseOptions, typeDefaults, optionsOverrides);

            if (charts[canvasId]) {
                charts[canvasId].data.labels = labels;
                charts[canvasId].data.datasets = finalDatasets;
                // 2. Substituir as opções antigas pelas novas, em vez de tentar um merge
                charts[canvasId].options = options;
                charts[canvasId].update('none');
                return;
            }

            container.innerHTML = '';
            const newCanvas = document.createElement('canvas');
            newCanvas.id = canvasId;
            container.appendChild(newCanvas);
            container.style.display = ''; container.style.alignItems = ''; container.style.justifyContent = '';
            const ctx = newCanvas.getContext('2d');

            charts[canvasId] = new Chart(ctx, { type, data: { labels, datasets: finalDatasets }, options });
        }

        function showNoDataMessage(canvasId, message) {
            if (charts[canvasId]) {
                charts[canvasId].destroy();
                delete charts[canvasId];
            }
            const container = document.getElementById(canvasId + 'Container');
            if(container) {
                container.style.display = 'flex'; container.style.alignItems = 'center'; container.style.justifyContent = 'center';
                container.innerHTML = `<p class="text-slate-500">${message}</p>`;
            }
        }

        function calculateProductVariation(currentData, historyData) {
            const currentMetric = currentProductMetric || 'faturamento';

            let maxDate = 0;
            // Find most recent history date (Previous Month Logic)
            for(let i=0; i<historyData.length; i++) {
                const s = historyData[i];
                const d = parseDate(s.DTPED);
                if(d && d.getTime() > maxDate) maxDate = d.getTime();
            }

            if (maxDate === 0) return [];

            const prevMonthDate = new Date(maxDate);
            const prevMonthIndex = prevMonthDate.getUTCMonth();
            const prevMonthYear = prevMonthDate.getUTCFullYear();

            // --- PROPORTIONAL RATIO CALCULATION (Current Month vs Previous Month) ---
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();

            // Calculate Current Month Progress
            const totalWDCurrent = getWorkingDaysInMonth(currentYear, currentMonth, selectedHolidays);
            // Use 'now' (Local) which getPassedWorkingDaysInMonth will interpret as UTC components to match check
            const passedWDCurrent = getPassedWorkingDaysInMonth(currentYear, currentMonth, selectedHolidays, now);

            const ratio = totalWDCurrent > 0 ? (passedWDCurrent / totalWDCurrent) : 1;

            // Calculate Target Cutoff for Previous Month
            const totalWDPrev = getWorkingDaysInMonth(prevMonthYear, prevMonthIndex, selectedHolidays);
            const targetWDPrev = Math.round(totalWDPrev * ratio);

            // Helper to find the day corresponding to target working days
            const getDayForWorkingDays = (year, month, targetCount, holidays) => {
                let count = 0;
                // Iterate from 1st
                const date = new Date(Date.UTC(year, month, 1));
                while (date.getUTCMonth() === month) {
                    const dayOfWeek = date.getUTCDay();
                    if (dayOfWeek >= 1 && dayOfWeek <= 5 && !isHoliday(date, holidays)) {
                        count++;
                    }
                    if (count >= targetCount) return date.getUTCDate();
                    date.setUTCDate(date.getUTCDate() + 1);
                }
                return date.getUTCDate(); // Fallback to end of month
            };

            const cutoffDayPrev = getDayForWorkingDays(prevMonthYear, prevMonthIndex, targetWDPrev, selectedHolidays);
            // ------------------------------------------------------------------------

            const currentMap = new Map();

            const getCategory = (code, supplier) => {
                if (optimizedData.productPastaMap.has(code)) return optimizedData.productPastaMap.get(code);
                return resolveSupplierPasta(null, supplier);
            };

            const getStockFromMap = (map, code) => {
                let s = map.get(code);
                if (s !== undefined) return s;
                const num = parseInt(code, 10);
                if (!isNaN(num)) {
                    const sNoZeros = map.get(String(num));
                    if (sNoZeros !== undefined) return sNoZeros;
                }
                const sString = String(code);
                if (map.has(sString)) return map.get(sString);
                return 0;
            };

            // Aggregate Current Data (Already filtered)
            currentData.forEach(item => {
                if (!isAlternativeMode(selectedTiposVenda) && item.TIPOVENDA !== '1' && item.TIPOVENDA !== '9') return;

                const code = String(item.PRODUTO);
                const val = getValueForSale(item, selectedTiposVenda);
                const weight = Number(item.TOTPESOLIQ) || 0;
                const qty = Number(item.QTVENDA) || 0;

                if (!currentMap.has(code)) {
                    const cat = getCategory(code, item.FORNECEDOR || item.CODFOR);
                    currentMap.set(code, {
                        code: code,
                        name: item.DESCRICAO,
                        category: cat,
                        currentVal: 0,
                        currentWeight: 0,
                        currentQty: 0,
                        prevVal: 0,
                        prevWeight: 0,
                        prevQty: 0
                    });
                }
                const entry = currentMap.get(code);
                entry.currentVal += val;
                entry.currentWeight += weight;
                entry.currentQty += qty;
            });

            // Aggregate History Data (Filtered to Previous Month AND Cutoff Day)
            historyData.forEach(item => {
                if (!isAlternativeMode(selectedTiposVenda) && item.TIPOVENDA !== '1' && item.TIPOVENDA !== '9') return;

                const d = parseDate(item.DTPED);
                if (!d) return;

                if (d.getUTCMonth() === prevMonthIndex && d.getUTCFullYear() === prevMonthYear) {
                    // APPLY CUTOFF FILTER
                    if (d.getUTCDate() > cutoffDayPrev) return;

                    const code = String(item.PRODUTO);
                    const val = getValueForSale(item, selectedTiposVenda);
                    const weight = Number(item.TOTPESOLIQ) || 0;
                    const qty = Number(item.QTVENDA) || 0;

                    if (!currentMap.has(code)) {
                        const cat = getCategory(code, item.FORNECEDOR || item.CODFOR);
                        currentMap.set(code, {
                            code: code,
                            name: item.DESCRICAO,
                            category: cat,
                            currentVal: 0,
                            currentWeight: 0,
                            currentQty: 0,
                            prevVal: 0,
                            prevWeight: 0,
                            prevQty: 0
                        });
                    }
                    const entry = currentMap.get(code);
                    entry.prevVal += val;
                    entry.prevWeight += weight;
                    entry.prevQty += qty;
                }
            });

            const results = [];
            currentMap.forEach(item => {
                // Check Stock > 1 Box (Strict)
                const s05 = getStockFromMap(stockData05, item.code);
                const s08 = getStockFromMap(stockData08, item.code);
                const totalStock = s05 + s08;

                if (totalStock <= 1) return; // Skip products with low stock

                const curr = currentMetric === 'faturamento' ? item.currentVal : item.currentWeight;
                const prev = currentMetric === 'faturamento' ? item.prevVal : item.prevWeight;

                let variation = 0;
                if (prev > 0) {
                    variation = ((curr - prev) / prev) * 100;
                } else if (curr > 0) {
                    variation = 100;
                } else {
                    variation = 0;
                }

                if (curr === 0 && prev === 0) return;

                results.push({
                    ...item,
                    variation: variation,
                    absVariation: Math.abs(variation),
                    metricValue: curr
                });
            });

            // Sort by Absolute Variation Descending
            results.sort((a, b) => b.absVariation - a.absVariation);

            return results.slice(0, 50);
        }

        function renderTopProductsVariationTable(data) {
            const container = document.getElementById('top-products-variation-table-body');
            if (!container) return;
            container.innerHTML = '';

            const maxVariation = Math.max(...data.map(d => d.absVariation)) || 100;

            data.forEach((item, index) => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-white/10 hover:bg-white/5 transition-colors group cursor-pointer';
                tr.onclick = () => openProductPerformanceModal(item);

                // Rank
                const tdRank = document.createElement('td');
                // Hide rank cell on mobile (will be inside product cell)
                tdRank.className = 'py-1 px-1 md:py-3 md:px-4 text-center text-slate-500 font-mono text-[10px] md:text-xs font-bold hidden md:table-cell';
                tdRank.setAttribute('data-label', 'Rank');
                tdRank.textContent = index + 1;
                tr.appendChild(tdRank);

                // Produto
                const tdProduct = document.createElement('td');
                tdProduct.className = 'py-1 px-1 md:py-3 md:px-4';
                tdProduct.setAttribute('data-label', 'Produto');

                // Custom truncation for mobile (Use CSS truncate instead of hard limit to maximize space)
                const fullName = item.name || 'Desconhecido';

                // Variation Badge Data
                const badgeBg = item.variation >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20';
                const arrow = item.variation >= 0 ? '▲' : '▼';
                const sign = item.variation > 0 ? '+' : '';
                const variationBadgeHtml = `
                    <span class="inline-flex items-center justify-end px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-md text-[10px] md:text-xs font-bold border ${badgeBg} min-w-[50px] md:min-w-[80px]">
                        ${sign}${item.variation.toFixed(1)}% ${arrow}
                    </span>
                `;

                tdProduct.innerHTML = `
                    <div class="flex flex-col min-w-0">
                        <!-- Mobile View (Compact Row: Rank - Code - Name ... Variation) -->
                        <div class="md:hidden flex items-center justify-between w-full leading-tight">
                            <div class="flex items-center overflow-hidden min-w-0 flex-1 mr-2">
                                <!-- Rank -->
                                <span class="text-slate-500 font-mono text-[10px] font-bold mr-2 w-4 text-center flex-shrink-0">${index + 1}</span>

                                <!-- Product Info -->
                                <span class="text-[10px] font-bold text-white group-hover:text-[#FF5E00] transition-colors truncate">
                                    ${item.code} - ${fullName}
                                </span>
                            </div>

                            <!-- Variation Badge (Right Aligned) -->
                            <div class="flex-shrink-0">
                                ${variationBadgeHtml}
                            </div>
                        </div>

                        <!-- Mobile Manufacturer/Category (Secondary Line) -->
                        <div class="md:hidden text-[9px] text-slate-500 uppercase tracking-wide ml-6 truncate leading-none mt-0.5">
                            ${item.category || ''}
                        </div>

                        <!-- Desktop View (Original) -->
                        <div class="hidden md:block">
                            <span class="text-sm font-bold text-white group-hover:text-[#FF5E00] transition-colors truncate block" title="${fullName}">
                                ${item.code} - ${fullName}
                            </span>
                            <span class="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5 truncate leading-none block">${item.category || ''}</span>
                        </div>
                    </div>
                `;
                tr.appendChild(tdProduct);

                // Performance (Bar)
                const tdPerf = document.createElement('td');
                tdPerf.className = 'py-1 px-1 md:py-3 md:px-4 w-1/4 md:w-1/3 align-middle hidden md:table-cell';
                tdPerf.setAttribute('data-label', 'Perf.');
                const barWidth = Math.min((item.absVariation / maxVariation) * 100, 100);
                const barColor = item.variation >= 0 ? 'bg-emerald-500' : 'bg-red-500';

                // Refined HTML for simple magnitude bar:
                tdPerf.innerHTML = `
                    <div class="h-1 md:h-1.5 w-full glass-panel-heavy rounded-full overflow-hidden">
                        <div class="h-full ${barColor} rounded-full transition-all duration-500" style="width: ${barWidth}%"></div>
                    </div>
                `;
                tr.appendChild(tdPerf);

                // Variation Badge (Desktop Only)
                const tdVar = document.createElement('td');
                tdVar.className = 'py-1 px-1 md:py-3 md:px-4 text-right hidden md:table-cell';
                tdVar.setAttribute('data-label', 'Var.');

                tdVar.innerHTML = variationBadgeHtml;
                tr.appendChild(tdVar);

                container.appendChild(tr);
            });
        }

        function openProductPerformanceModal(item) {
            const modal = document.getElementById('product-performance-modal');
            if (!modal) return;

            // Get Elements
            const titleEl = document.getElementById('product-performance-title');
            const codeEl = document.getElementById('product-performance-code');
            const stockEl = document.getElementById('product-performance-stock');
            const metricLabelEl = document.getElementById('product-performance-metric-label');
            const prevEl = document.getElementById('product-performance-prev');
            const currEl = document.getElementById('product-performance-curr');
            const varEl = document.getElementById('product-performance-var');
            const closeBtn = document.getElementById('product-performance-modal-close-btn');

            // Populate
            if (titleEl) titleEl.textContent = item.name || 'Produto Desconhecido';
            if (codeEl) codeEl.textContent = `Cód: ${item.code}`;

            // Stock Logic (Robust Lookup)
            const getStockFromMap = (map, code) => {
                let s = map.get(code);
                if (s !== undefined) return s;
                // Try number string (remove leading zeros)
                const num = parseInt(code, 10);
                if (!isNaN(num)) {
                    const sNoZeros = map.get(String(num));
                    if (sNoZeros !== undefined) return sNoZeros;
                }
                // Try as-is string (in case code passed as number)
                const sString = String(code);
                if (map.has(sString)) return map.get(sString);

                return 0;
            };

            const s05 = getStockFromMap(stockData05, item.code);
            const s08 = getStockFromMap(stockData08, item.code);
            const totalStock = s05 + s08;

            const isFat = currentProductMetric === 'faturamento';

            // Always display Stock as Quantity (Units/Boxes) to match Coverage view
            // and avoid confusion with "R$ 0,00" if price is missing or zero.
            let stockDisplay = totalStock.toLocaleString('pt-BR');

            if (stockEl) {
                stockEl.textContent = stockDisplay;
                // Update unit sibling if present (Always show unit 'cx' or similar for stock)
                if (stockEl.nextElementSibling) {
                    stockEl.nextElementSibling.textContent = 'cx';
                }
            }

            // Sales Logic
            // If Fat -> Show Value. If Weight -> Show Qty (Boxes) as per user request
            if (metricLabelEl) metricLabelEl.textContent = isFat ? 'Valor' : 'Caixas';

            const prevVal = isFat ? item.prevVal : item.prevQty;
            const currVal = isFat ? item.currentVal : item.currentQty;

            const format = (v) => isFat
                ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                : v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' cx';

            if (prevEl) prevEl.textContent = format(prevVal);
            if (currEl) currEl.textContent = format(currVal);

            // Variation Logic
            const variation = item.variation;
            const sign = variation > 0 ? '+' : '';
            const arrow = variation >= 0 ? '▲' : '▼';
            const colorClass = variation >= 0 ? 'text-emerald-400' : 'text-red-400';

            if (varEl) {
                varEl.textContent = `${sign}${variation.toFixed(1)}% ${arrow}`;
                varEl.className = `px-3 py-1 rounded-lg text-sm font-bold bg-slate-700 ${colorClass}`;
            }

            // Show
            modal.classList.remove('hidden');

            // Close Logic
            const close = () => {
                modal.classList.add('hidden');
            };
            if (closeBtn) closeBtn.onclick = close;

            // Close on outside click (Generic Modal Logic handles this via setupGlobalEsc or similar, but explicit here helps)
            modal.onclick = (e) => {
                if (e.target === modal) close();
            };
        }

        // Renamed/Wrapper for compatibility if needed, or update updateAllVisuals directly
        // updateProductBarChart was replaced.

        function isHoliday(date, holidays) {
            if (!holidays || !Array.isArray(holidays)) return false;
            // Assuming holidays are stored as 'YYYY-MM-DD' strings (from UTC date)
            const dateString = date.toISOString().split('T')[0];
            return holidays.includes(dateString);
        }

        function getWorkingDaysInMonth(year, month, holidays) {
            let count = 0;
            const date = new Date(Date.UTC(year, month, 1));
            while (date.getUTCMonth() === month) {
                const dayOfWeek = date.getUTCDay();
                if (dayOfWeek >= 1 && dayOfWeek <= 5 && !isHoliday(date, holidays)) {
                    count++;
                }
                date.setUTCDate(date.getUTCDate() + 1);
            }
            return count;
        }

        function getPassedWorkingDaysInMonth(year, month, holidays, today) {
            let count = 0;
            const date = new Date(Date.UTC(year, month, 1));
            // Ensure today is treated as UTC for comparison
            const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

            while (date <= todayUTC && date.getUTCMonth() === month) {
                const dayOfWeek = date.getUTCDay();
                if (dayOfWeek >= 1 && dayOfWeek <= 5 && !isHoliday(date, holidays)) {
                    count++;
                }
                date.setUTCDate(date.getUTCDate() + 1);
            }
            return count > 0 ? count : 1;
        }

        function isWorkingDay(date, holidays) {
            const dayOfWeek = date.getUTCDay();
            return dayOfWeek >= 1 && dayOfWeek <= 5 && !isHoliday(date, holidays);
        }

        function getWorkingDayIndex(date, holidays) {
            if (!isWorkingDay(date, holidays)) return -1;

            const month = date.getUTCMonth();
            const year = date.getUTCFullYear();
            let index = 0;
            const d = new Date(Date.UTC(year, month, 1));

            while (d <= date) {
                if (isWorkingDay(d, holidays)) {
                    index++;
                }
                d.setUTCDate(d.getUTCDate() + 1);
            }
            return index;
        }



        function updateAllVisuals() {
            const posicao = posicaoFilter.value;
            const codcli = codcliFilter.value.trim();

            let clientBaseForCoverage = allClientsData.filter(c => {
                const rca1 = String(c.rca1 || '').trim();

                const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');

                // Regra de inclusão (Americanas ou RCA 1 diferente de 53)
                return (isAmericanas || rca1 !== '53' || clientsWithSalesThisMonth.has(c['Código']));
            });

            if (mainRedeGroupFilter === 'com_rede') {
                clientBaseForCoverage = clientBaseForCoverage.filter(c => c.ramo && c.ramo !== 'N/A');
                if (selectedMainRedes.length > 0) {
                    clientBaseForCoverage = clientBaseForCoverage.filter(c => selectedMainRedes.includes(c.ramo));
                }
            } else if (mainRedeGroupFilter === 'sem_rede') {
                clientBaseForCoverage = clientBaseForCoverage.filter(c => !c.ramo || c.ramo === 'N/A');
            }
            const clientCodesInRede = new Set(clientBaseForCoverage.map(c => c['Código']));

            const intersectSets = (sets) => {
                if (sets.length === 0) return new Set();

                // --- OPTIMIZATION START ---
                // Sort sets by size to intersect the smallest sets first.
                sets.sort((a, b) => a.size - b.size);

                let result = new Set(sets[0]);
                for (let i = 1; i < sets.length; i++) {
                    if (result.size === 0) break; // Stop early if the result is already empty

                    const currentSet = sets[i];
                    for (const id of result) {
                        if (!currentSet.has(id)) {
                            result.delete(id);
                        }
                    }
                }
                // --- OPTIMIZATION END ---
                return result;
            };

            const getFilteredIds = (indices, dataset) => {
                let setsToIntersect = [];
                let hasFilter = false;

                if (codcli) {
                    hasFilter = true;
                    if (indices.byClient.has(codcli)) {
                        setsToIntersect.push(indices.byClient.get(normalizeKey(codcli)));
                    } else {
                        return [];
                    }
                }

                // Hierarchy Filter
                const hierarchyClients = getHierarchyFilteredClients('main');
                if (hierarchyClients.length < allClientsData.length) {
                    hasFilter = true;
                    const hierarchyIds = new Set();
                    hierarchyClients.forEach(c => {
                        const code = String(c['Código'] || c['codigo_cliente']);
                        const ids = indices.byClient.get(normalizeKey(code));
                        if (ids) ids.forEach(id => hierarchyIds.add(id));
                    });
                    setsToIntersect.push(hierarchyIds);
                }

                if (selectedTiposVenda.length > 0) {
                    hasFilter = true;
                    const tipoVendaIds = new Set();
                    selectedTiposVenda.forEach(tipo => {
                        (indices.byTipoVenda.get(tipo) || []).forEach(id => tipoVendaIds.add(id));
                    });
                    setsToIntersect.push(tipoVendaIds);
                }

                if (currentFornecedor) {
                    hasFilter = true;
                    if (indices.byPasta.has(currentFornecedor)) {
                        setsToIntersect.push(indices.byPasta.get(currentFornecedor));
                    } else {
                        return [];
                    }
                }
                if (selectedMainSuppliers.length > 0) {
                    hasFilter = true;
                    const supplierIds = new Set();
                    selectedMainSuppliers.forEach(sup => {
                        if (indices.bySupplier.has(sup)) {
                            (indices.bySupplier.get(sup) || []).forEach(id => supplierIds.add(id));
                        }
                    });
                    setsToIntersect.push(supplierIds);
                }

                if (indices.byPosition && posicao) {
                    hasFilter = true;
                    if (indices.byPosition.has(posicao)) {
                        setsToIntersect.push(indices.byPosition.get(posicao));
                    } else {
                        return [];
                    }
                }

                if (mainRedeGroupFilter) {
                    hasFilter = true;
                    const redeIds = new Set();
                    clientCodesInRede.forEach(clientCode => {
                         (indices.byClient.get(normalizeKey(clientCode)) || []).forEach(id => redeIds.add(id));
                    });
                    setsToIntersect.push(redeIds);
                }

                if (setsToIntersect.length === 0 && hasFilter) {
                    return [];
                }

                // Helper to retrieve item from dataset (ColumnarDataset or Array)
                const getItem = (idx) => (dataset.get ? dataset.get(idx) : dataset[idx]);

                if (setsToIntersect.length === 0 && !hasFilter) {
                    // No filters: return all items
                    // Check if it is a ColumnarDataset specifically to avoid calling .values() on native Array (which returns iterator)
                    if (dataset instanceof ColumnarDataset) {
                        return dataset.values();
                    }
                    if (Array.isArray(dataset)) return dataset;

                    // Fallback iteration (safe for array-like objects)
                    const all = [];
                    for(let i=0; i<dataset.length; i++) all.push(getItem(i));
                    return all;
                }

                const finalIds = intersectSets(setsToIntersect);
                // finalIds are indices (integers). Use getItem to retrieve the object/proxy.
                return Array.from(finalIds).map(id => getItem(id));
            };

            const filteredSalesData = getFilteredIds(optimizedData.indices.current, optimizedData.salesById);
            const filteredHistoryData = getFilteredIds(optimizedData.indices.history, optimizedData.historyById);

            const hierarchyClientsForTable = getHierarchyFilteredClients('main');
            const hierarchyClientCodes = new Set(hierarchyClientsForTable.map(c => String(c['Código'] || c['codigo_cliente'])));
            const isHierarchyFiltered = hierarchyClientsForTable.length < allClientsData.length;

            const filteredTableData = aggregatedOrders.filter(order => {
                let matches = true;
                if (mainRedeGroupFilter) {
                    matches = matches && clientCodesInRede.has(order.CODCLI);
                }
                if (codcli) matches = matches && order.CODCLI === codcli;
                else {
                    if (isHierarchyFiltered) matches = matches && hierarchyClientCodes.has(order.CODCLI);
                }
                // Robust filtering with existence checks
                if (selectedTiposVenda.length > 0) matches = matches && order.TIPOVENDA && selectedTiposVenda.includes(order.TIPOVENDA);
                if (currentFornecedor) matches = matches && order.FORNECEDORES_LIST && order.FORNECEDORES_LIST.includes(currentFornecedor);
                if (selectedMainSuppliers.length > 0) matches = matches && order.CODFORS_LIST && order.CODFORS_LIST.some(c => selectedMainSuppliers.includes(c));
                if (posicao) matches = matches && order.POSICAO === posicao;
                return matches;
            });

            const isFiltered = isHierarchyFiltered || !!codcli || !!currentFornecedor || !!mainRedeGroupFilter || selectedMainSuppliers.length > 0 || !!posicao || selectedTiposVenda.length > 0;

            const summary = calculateSummaryFromData(filteredSalesData, isFiltered, clientBaseForCoverage);

            totalVendasEl.textContent = summary.totalFaturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            totalPesoEl.textContent = `${(summary.totalPeso / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
            kpiSkuPdVEl.textContent = summary.skuPdv.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            kpiPositivacaoEl.textContent = `${summary.positivacaoPercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
            kpiPositivacaoPercentEl.textContent = `${summary.positivacaoCount.toLocaleString('pt-BR')} PDVs`;



            if (!chartView.classList.contains('hidden')) {
                let chartData = summary.vendasPorCoord;
                const mainState = hierarchyState['main'];

                if (mainState.cocoords.size > 0) {
                    chartData = summary.vendasPorPromotor;
                } else if (mainState.coords.size > 0) {
                    chartData = summary.vendasPorCoCoord;
                }

                // Determine Title (Dynamic Logic)
                let chartTitle = 'Performance';
                const role = window.userRole || 'promotor';
                const getName = (map, code) => (map && map.get(code)) || code;

                if (role === 'promotor') {
                    chartTitle = 'Performance';
                } else if (mainState.promotors && mainState.promotors.size > 0) {
                    if (mainState.promotors.size === 1) {
                        const code = mainState.promotors.values().next().value;
                        chartTitle = `Performance ${getName(optimizedData.promotorMap, code)}`;
                    } else {
                        chartTitle = 'Performance Promotores';
                    }
                } else if (mainState.cocoords && mainState.cocoords.size > 0) {
                    if (role === 'cocoord') {
                        chartTitle = 'Performance';
                    } else {
                        if (mainState.cocoords.size === 1) {
                            const code = mainState.cocoords.values().next().value;
                            chartTitle = `Performance ${getName(optimizedData.cocoordMap, code)}`;
                        } else {
                            chartTitle = 'Performance Co-coordenadores';
                        }
                    }
                } else if (mainState.coords && mainState.coords.size > 0) {
                    if (role === 'coord') {
                        chartTitle = 'Performance';
                    } else {
                        if (mainState.coords.size === 1) {
                            const code = mainState.coords.values().next().value;
                            chartTitle = `Performance ${getName(optimizedData.coordMap, code)}`;
                        } else {
                            chartTitle = 'Performance Coordenadores';
                        }
                    }
                } else {
                    chartTitle = 'Performance';
                }

                salesByPersonTitle.textContent = chartTitle;

                // Always use Liquid Gauge for Hierarchy Performance Charts (Coord, Co-Coord, Promotor)
                // This aggregates performance for the current view scope
                if (true) {
                    // Destroy existing Chart.js instance if any, to prevent conflict or memory leak
                    if (window.charts && window.charts['salesByPersonChart']) {
                        window.charts['salesByPersonChart'].destroy();
                        delete window.charts['salesByPersonChart'];
                    }
                    // Also check Chart registry directly
                    const chartInstance = Chart.getChart('salesByPersonChart');
                    if (chartInstance) chartInstance.destroy();

                    // Calculate Total Realized (Sum of all entities in chartData)
                    const totalRealized = Object.values(chartData).reduce((a, b) => a + b, 0);

                    // Calculate Goal for the visible clients
                    let totalGoal = 0;
                    // Apply hierarchy filter first
                    let goalClients = getHierarchyFilteredClients('main', allClientsData);

                    // Apply Rede/Active Filter (Intersect with Universe)
                    if (clientCodesInRede) {
                         goalClients = goalClients.filter(c => clientCodesInRede.has(c['Código']));
                    }

                    // Apply Client Filter (Single)
                    if (codcli) {
                         const searchKey = normalizeKey(codcli);
                         goalClients = goalClients.filter(c => normalizeKey(String(c['Código'] || c['codigo_cliente'])) === searchKey);
                    }

                    // Determine Goal Keys based on Supplier Filters
                    const activeGoalKeys = new Set();

                    const mapSupplierToKey = (s) => {
                        const sup = String(s).toUpperCase();
                        if (sup === 'PEPSICO') return ['PEPSICO_ALL'];
                        if (sup === 'ELMA CHIPS' || sup === 'ELMA') return ['ELMA_ALL'];
                        if (sup === 'FOODS') return ['FOODS_ALL'];

                        // Mappings for Descriptive Names (Virtual Categories)
                        if (sup === 'EXTRUSADOS') return [window.SUPPLIER_CODES.ELMA[0]];
                        if (sup === 'NÃO EXTRUSADOS' || sup === 'NAO EXTRUSADOS') return [window.SUPPLIER_CODES.ELMA[1]];
                        if (sup === 'TORCIDA') return [window.SUPPLIER_CODES.ELMA[2]];
                        if (sup === 'TODDYNHO') return [window.SUPPLIER_CODES.VIRTUAL.TODDYNHO];
                        if (sup === 'TODDY') return [window.SUPPLIER_CODES.VIRTUAL.TODDY];
                        if (sup === 'QUAKER' || sup === 'KEROCOCO' || sup.includes('QUAKER')) return [window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO];

                        if (window.globalGoalsMetrics && window.globalGoalsMetrics[sup]) return [sup];
                        if (window.SUPPLIER_CODES.ALL_GOALS.includes(sup)) return [sup];
                        if (sup === window.SUPPLIER_CODES.FOODS[0]) return ['FOODS_ALL'];
                        return [];
                    };

                    // Prioritize specific selected suppliers (Drill-down) over global folder filter
                    if (selectedMainSuppliers && selectedMainSuppliers.length > 0) {
                        selectedMainSuppliers.forEach(s => {
                            mapSupplierToKey(s).forEach(k => activeGoalKeys.add(k));
                        });
                    } else if (currentFornecedor) {
                        mapSupplierToKey(currentFornecedor).forEach(k => activeGoalKeys.add(k));
                    }

                    // Default to PEPSICO_ALL if no specific keys found
                    if (activeGoalKeys.size === 0) {
                        activeGoalKeys.add('PEPSICO_ALL');
                    }

                    if (window.globalClientGoals) {
                        goalClients.forEach(c => {
                            const codCli = normalizeKey(String(c['Código'] || c['codigo_cliente']));
                            const clientGoals = window.globalClientGoals.get(codCli);
                            if (clientGoals) {
                                activeGoalKeys.forEach(key => {
                                    if (clientGoals.has(key)) {
                                        totalGoal += (clientGoals.get(key).fat || 0);
                                    }
                                });
                            }
                        });
                    }

                    renderLiquidGauge('salesByPersonChartContainer', totalRealized, totalGoal, 'Meta Geral');
                }

                // --- New Radar Chart Logic ---
                document.getElementById('faturamentoPorFornecedorTitle').textContent = 'Share por Categoria';

                // 1. Calculate Goals for Visible Clients
                const categoryGoals = {
                    [window.SUPPLIER_CODES.ELMA[0]]: 0, [window.SUPPLIER_CODES.ELMA[1]]: 0, [window.SUPPLIER_CODES.ELMA[2]]: 0,
                    [window.SUPPLIER_CODES.VIRTUAL.TODDYNHO]: 0, [window.SUPPLIER_CODES.VIRTUAL.TODDY]: 0, [window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO]: 0
                };

                const visibleClientsForGoals = getHierarchyFilteredClients('main', allClientsData);
                if (window.globalClientGoals) {
                    visibleClientsForGoals.forEach(c => {
                        const codCli = normalizeKey(String(c['Código'] || c['codigo_cliente']));
                        const clientGoals = window.globalClientGoals.get(codCli);
                        if (clientGoals) {
                            for (const key in categoryGoals) {
                                if (clientGoals.has(key)) {
                                    categoryGoals[key] += (clientGoals.get(key).fat || 0);
                                }
                            }
                        }
                    });
                }

                // 2. Map Actuals (from summary.faturamentoPorFornecedor)
                const actualsMap = {
                    [window.SUPPLIER_CODES.ELMA[0]]: summary.faturamentoPorFornecedor['Extrusados'] || 0,
                    [window.SUPPLIER_CODES.ELMA[1]]: summary.faturamentoPorFornecedor['Não Extrusados'] || 0,
                    [window.SUPPLIER_CODES.ELMA[2]]: summary.faturamentoPorFornecedor['Torcida'] || 0,
                    [window.SUPPLIER_CODES.VIRTUAL.TODDYNHO]: summary.faturamentoPorFornecedor['Toddynho'] || 0,
                    [window.SUPPLIER_CODES.VIRTUAL.TODDY]: summary.faturamentoPorFornecedor['Toddy'] || 0,
                    [window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO]: (summary.faturamentoPorFornecedor['Quaker'] || 0) + (summary.faturamentoPorFornecedor['Kero Coco'] || 0)
                };

                // 3. Prepare Data for Chart
                const radarData = [];
                const categoryLabels = {
                    [window.SUPPLIER_CODES.ELMA[0]]: 'Extrusados',
                    [window.SUPPLIER_CODES.ELMA[1]]: 'Não Extrusados',
                    [window.SUPPLIER_CODES.ELMA[2]]: 'Torcida',
                    [window.SUPPLIER_CODES.VIRTUAL.TODDYNHO]: 'Toddynho',
                    [window.SUPPLIER_CODES.VIRTUAL.TODDY]: 'Toddy',
                    [window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO]: 'Quaker / Kero Coco'
                };

                // Color Palette (Pepsico Brand Colors approximation or distinct colors)
                const colors = [
                    0xeab308, // Yellow/Gold
                    0xf97316, // Orange
                    0xef4444, // Red
                    0x3b82f6, // Blue
                    0x8b5cf6, // Purple
                    0x10b981  // Emerald
                ];

                const orderedKeys = window.SUPPLIER_CODES.ALL_GOALS;

                orderedKeys.forEach((key, index) => {
                    const goal = categoryGoals[key];
                    const actual = actualsMap[key];
                    let pct = 0;
                    if (goal > 0) {
                        pct = (actual / goal) * 100;
                    } else if (actual > 0) {
                        pct = 100;
                    }

                    if (window.am5) {
                        radarData.push({
                            category: categoryLabels[key],
                            value: pct,
                            full: 100,
                            columnSettings: { fill: window.am5.color(colors[index % colors.length]) }
                        });
                    }
                });

                renderCategoryRadarChart(radarData);

                // Variation Table Logic
                const variationData = calculateProductVariation(filteredSalesData, filteredHistoryData);
                renderTopProductsVariationTable(variationData);
            }
        }


        function updateTipoVendaFilter(dropdown, filterText, selectedArray, dataSource, skipRender = false) {
            if (!dropdown || !filterText) return selectedArray;
            // Collect unique types from data source
            const forbidden = ['TIPOVENDA', 'TIPO VENDA', 'TIPO', 'CODUSUR', 'CODCLI', 'SUPERV', 'NOME'];
            const uniqueTypes = new Set(dataSource.map(item => item.TIPOVENDA).filter(t => t && !forbidden.includes(t.toUpperCase())));

            // Ensure currently selected items are kept in the list (Safety Net)
            selectedArray.forEach(type => uniqueTypes.add(type));

            const tiposVendaToShow = [...uniqueTypes].sort((a, b) => parseInt(a) - parseInt(b));

            // Re-filter selectedArray ensures we don't have stale data if we wanted strictness,
            // but here we just ensured they are IN the list, so this line effectively does nothing
            // except ordering or removing truly invalid ones if we didn't add them above.
            // Since we added them above, this is redundant but harmless.
            selectedArray = selectedArray.filter(tipo => tiposVendaToShow.includes(tipo));

            if (!skipRender) {
                const htmlParts = [];
                for (let i = 0; i < tiposVendaToShow.length; i++) {
                    const s = tiposVendaToShow[i];
                    const isChecked = selectedArray.includes(s);
                    htmlParts.push(`<label class="flex items-center p-2 hover:bg-slate-600 cursor-pointer"><input type="checkbox" class="form-checkbox h-4 w-4 glass-panel-heavy border-slate-500 rounded text-teal-500 focus:ring-teal-500" value="${s}" ${isChecked ? 'checked' : ''}><span class="ml-2">${s}</span></label>`);
                }
                dropdown.innerHTML = htmlParts.join('');
            }

            if (selectedArray.length === 0 || selectedArray.length === tiposVendaToShow.length) filterText.textContent = 'Todos os Tipos';
            else if (selectedArray.length === 1) filterText.textContent = selectedArray[0];
            else filterText.textContent = `${selectedArray.length} tipos selecionados`;
            return selectedArray;
        }

        function updateRedeFilter(dropdown, buttonTextElement, selectedArray, dataSource, baseText = 'C/Rede') {
            if (!dropdown || !buttonTextElement) return selectedArray;
            const forbidden = ['RAMO', 'RAMO DE ATIVIDADE', 'RAMO_ATIVIDADE', 'DESCRICAO', 'ATIVIDADE'];
            const redesToShow = [...new Set(dataSource.map(item => item.ramo).filter(r => r && r !== 'N/A' && !forbidden.includes(r.toUpperCase())))].sort();
            const validSelected = selectedArray.filter(rede => redesToShow.includes(rede));

            const htmlParts = [];
            for (let i = 0; i < redesToShow.length; i++) {
                const r = redesToShow[i];
                const isChecked = validSelected.includes(r);
                htmlParts.push(`<label class="flex items-center p-2 hover:bg-slate-600 cursor-pointer"><input type="checkbox" class="form-checkbox h-4 w-4 glass-panel-heavy border-slate-500 rounded text-teal-500 focus:ring-teal-500" value="${r}" ${isChecked ? 'checked' : ''}><span class="ml-2 text-sm">${r}</span></label>`);
            }
            dropdown.innerHTML = htmlParts.join('');

            if (validSelected.length === 0) {
                buttonTextElement.textContent = baseText;
            } else {
                buttonTextElement.textContent = `${baseText} (${validSelected.length})`;
            }
            return validSelected;
        }

        function resetMainFilters() {
            selectedMainSuppliers = [];
            selectedTiposVenda = [];
            selectedMainRedes = [];
            mainRedeGroupFilter = '';

            const codcliFilter = document.getElementById('codcli-filter');
            if (codcliFilter) codcliFilter.value = '';

            selectedMainSuppliers = updateSupplierFilter(document.getElementById('fornecedor-filter-dropdown'), document.getElementById('fornecedor-filter-text'), selectedMainSuppliers, [...allSalesData, ...allHistoryData], 'main');
            updateTipoVendaFilter(tipoVendaFilterDropdown, tipoVendaFilterText, selectedTiposVenda, allSalesData);
            updateRedeFilter(mainRedeFilterDropdown, mainComRedeBtnText, selectedMainRedes, allClientsData);

            if (mainRedeGroupContainer) {
                mainRedeGroupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                const defaultBtn = mainRedeGroupContainer.querySelector('button[data-group=""]');
                if (defaultBtn) defaultBtn.classList.add('active');
                if (mainRedeFilterDropdown) mainRedeFilterDropdown.classList.add('hidden');
            }

            const fornecedorToggleContainerEl = document.getElementById('fornecedor-toggle-container');
            if (fornecedorToggleContainerEl) {
                fornecedorToggleContainerEl.querySelectorAll('.fornecedor-btn').forEach(b => b.classList.remove('active'));
            }
            currentFornecedor = '';

            if (hierarchyState['main']) {
                hierarchyState['main'].coords.clear();
                hierarchyState['main'].cocoords.clear();
                hierarchyState['main'].promotors.clear();

                if (userHierarchyContext.role !== 'adm') {
                    if (userHierarchyContext.coord) hierarchyState['main'].coords.add(userHierarchyContext.coord);
                    if (userHierarchyContext.cocoord) hierarchyState['main'].cocoords.add(userHierarchyContext.cocoord);
                    if (userHierarchyContext.promotor) hierarchyState['main'].promotors.add(userHierarchyContext.promotor);
                }

                updateHierarchyDropdown('main', 'coord');
                updateHierarchyDropdown('main', 'cocoord');
                updateHierarchyDropdown('main', 'promotor');
            }

            updateDashboard();
        }


        function getCityFilteredData(options = {}) {
            const { excludeFilter = null } = options;

            const clientFilter = cityCodCliFilter.value.trim().toLowerCase();
            const tiposVendaSet = new Set(selectedCityTiposVenda);

            // New Hierarchy Logic
            let clients = getHierarchyFilteredClients('city', allClientsData);

            if (excludeFilter !== 'rede') {
                 if (cityRedeGroupFilter === 'com_rede') {
                    clients = clients.filter(c => c.ramo && c.ramo !== 'N/A');
                    if (selectedCityRedes.length > 0) {
                        const redeSet = new Set(selectedCityRedes);
                        clients = clients.filter(c => redeSet.has(c.ramo));
                    }
                } else if (cityRedeGroupFilter === 'sem_rede') {
                    clients = clients.filter(c => !c.ramo || c.ramo === 'N/A');
                }
            }

            if (excludeFilter !== 'supplier' && selectedCitySuppliers.length > 0) {
                 // No filtering of clients list based on supplier for now.
            }

            if (excludeFilter !== 'client' && clientFilter) {
                 clients = clients.filter(c => {
                    const code = String(c['Código'] || c['codigo_cliente']).toLowerCase();
                    if (code.includes(clientFilter)) return true;

                    const name = (c.nomeCliente || '').toLowerCase();
                    const city = (c.cidade || '').toLowerCase();
                    const bairro = (c.bairro || '').toLowerCase();
                    const cnpj = String(c['CNPJ/CPF'] || c.cnpj_cpf || '').replace(/\D/g, '');

                    return name.includes(clientFilter) || city.includes(clientFilter) || bairro.includes(clientFilter) || cnpj.includes(clientFilter);
                 });
            }

            // Normalize keys for robust filtering against normalized indices
            const clientCodes = new Set(clients.map(c => normalizeKey(c['Código'] || c['codigo_cliente'])));

            const filters = {
                city: null, // Relies on clientCodes
                tipoVenda: tiposVendaSet,
                clientCodes: clientCodes,
                supplier: new Set(selectedCitySuppliers)
            };

            const sales = getFilteredDataFromIndices(optimizedData.indices.current, optimizedData.salesById, filters, excludeFilter);

            return { clients, sales };
        }

        function updateAllCityFilters(options = {}) {
            const { skipFilter = null } = options;

            // Supervisor/Seller filters managed by setupHierarchyFilters

            const { sales: salesTV } = getCityFilteredData({ excludeFilter: 'tipoVenda' });
            selectedCityTiposVenda = updateTipoVendaFilter(cityTipoVendaFilterDropdown, cityTipoVendaFilterText, selectedCityTiposVenda, salesTV, skipFilter === 'tipoVenda');

            const { sales: salesSupplier } = getCityFilteredData({ excludeFilter: 'supplier' });
            selectedCitySuppliers = updateSupplierFilter(document.getElementById('city-supplier-filter-dropdown'), document.getElementById('city-supplier-filter-text'), selectedCitySuppliers, salesSupplier, 'city');

            if (skipFilter !== 'rede') {
                 const { clients: clientsRede } = getCityFilteredData({ excludeFilter: 'rede' });
                 if (cityRedeGroupFilter === 'com_rede') {
                     selectedCityRedes = updateRedeFilter(cityRedeFilterDropdown, cityComRedeBtnText, selectedCityRedes, clientsRede);
                 }
            }
        }

        function handleCityFilterChange(options = {}) {
            if (window.cityUpdateTimeout) clearTimeout(window.cityUpdateTimeout);
            window.cityUpdateTimeout = setTimeout(() => {
                updateAllCityFilters(options);
                updateCityView();
            }, 10);
        }

        function updateCitySuggestions(filterInput, suggestionsContainer, dataSource) {
            const forbidden = ['CIDADE', 'MUNICIPIO', 'CIDADE_CLIENTE', 'NOME DA CIDADE', 'CITY'];
            const inputValue = filterInput.value.toLowerCase();

            if (!inputValue) {
                suggestionsContainer.classList.add('hidden');
                return;
            }

            const uniqueCities = new Set();
            const suggestionsFragment = document.createDocumentFragment();
            let count = 0;
            const LIMIT = 50;

            for (let i = 0; i < dataSource.length; i++) {
                if (count >= LIMIT) break;

                const item = dataSource instanceof ColumnarDataset ? dataSource.get(i) : dataSource[i];
                let city = 'N/A';

                if (item.CIDADE) city = item.CIDADE;
                else if (item.cidade || item.CIDADE) city = item.cidade || item.CIDADE;
                else if (item.CODCLI) {
                    const c = clientMapForKPIs.get(String(item.CODCLI));
                    if (c) city = c.cidade || c.CIDADE || c['Nome da Cidade'];
                }

                if (city && city !== 'N/A' && !forbidden.includes(city.toUpperCase()) && city.toLowerCase().includes(inputValue)) {
                    if (!uniqueCities.has(city)) {
                        uniqueCities.add(city);
                        const div = document.createElement('div');
                        div.className = 'p-2 hover:bg-slate-600 cursor-pointer';
                        div.textContent = city;
                        suggestionsFragment.appendChild(div);
                        count++;
                    }
                }
            }

            if (uniqueCities.size > 0 && (document.activeElement === filterInput || !suggestionsContainer.classList.contains('manual-hide'))) {
                suggestionsContainer.innerHTML = '';
                suggestionsContainer.appendChild(suggestionsFragment);
                suggestionsContainer.classList.remove('hidden');
            } else {
                suggestionsContainer.classList.add('hidden');
            }
        }

        function updateCityView() {
            cityRenderId++;
            const currentRenderId = cityRenderId;

            updateCityMap();

            let { clients: clientsForAnalysis, sales: salesForAnalysis } = getCityFilteredData();
            const clientFilter = cityCodCliFilter.value.trim();

            const referenceDate = lastSaleDate;
            const currentMonth = referenceDate.getUTCMonth();
            const currentYear = referenceDate.getUTCFullYear();

            const selectedTiposVendaSet = new Set(selectedCityTiposVenda);

            // Pre-aggregate "Sales This Month" for Status Classification
            const clientTotalsThisMonth = new Map();
            // Sync Pre-aggregation (O(N) is fast)
            for(let i=0; i<allSalesData.length; i++) {
                const s = (allSalesData instanceof ColumnarDataset) ? allSalesData.get(i) : allSalesData[i];
                if (selectedTiposVendaSet.size > 0 && !selectedTiposVendaSet.has(s.TIPOVENDA)) continue;
                if (!isAlternativeMode(selectedCityTiposVenda) && s.TIPOVENDA !== '1' && s.TIPOVENDA !== '9') continue;

                const d = parseDate(s.DTPED);
                if (d && d.getUTCFullYear() === currentYear && d.getUTCMonth() === currentMonth) {
                    const val = getValueForSale(s, selectedCityTiposVenda);
                    clientTotalsThisMonth.set(s.CODCLI, (clientTotalsThisMonth.get(s.CODCLI) || 0) + val);
                }
            }

            const detailedDataByClient = new Map(); // Map<CODCLI, { total, pepsico, multimarcas, maxDate }>

            // Pre-aggregate Sales Data for Analysis (Sync)
            salesForAnalysis.forEach(s => {
                const d = parseDate(s.DTPED);
                if (d) {
                    if (!isAlternativeMode(selectedCityTiposVenda) && s.TIPOVENDA !== '1' && s.TIPOVENDA !== '9') return;
                    if (!detailedDataByClient.has(s.CODCLI)) {
                        detailedDataByClient.set(s.CODCLI, { total: 0, pepsico: 0, multimarcas: 0, maxDate: 0 });
                    }
                    const entry = detailedDataByClient.get(s.CODCLI);
                    const ts = d.getTime();

                    if (ts > entry.maxDate) entry.maxDate = ts;

                    if (d.getUTCFullYear() === currentYear && d.getUTCMonth() === currentMonth) {
                        const val = getValueForSale(s, selectedCityTiposVenda);
                        entry.total += val;
                        if (s.OBSERVACAOFOR === 'PEPSICO') entry.pepsico += val;
                        else if (s.OBSERVACAOFOR === 'MULTIMARCAS') entry.multimarcas += val;
                    }
                }
            });

            // Filter clients universe
            clientsForAnalysis = clientsForAnalysis.filter(c => {
                const rca1 = String(c.rca1 || '').trim();
                const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');
                return (isAmericanas || rca1 !== '53' || clientsWithSalesThisMonth.has(c['Código']));
            });

            // Show Loading

            const activeClientsList = [];
            const inactiveClientsList = [];
            const salesByActiveClient = {}; // Map for export/rendering

            // ASYNC CHUNKED PROCESSING
            runAsyncChunked(clientsForAnalysis, (client) => {
                const codcli = String(client['Código']);

                const registrationDate = parseDate(client.dataCadastro);
                client.isNew = registrationDate && registrationDate.getUTCMonth() === currentMonth && registrationDate.getUTCFullYear() === currentYear;

                const totalFaturamentoMes = clientTotalsThisMonth.get(codcli) || 0;

                if (totalFaturamentoMes >= 1) {
                    activeClientsList.push(client);

                    // Detailed Data check
                    const details = detailedDataByClient.get(codcli);
                    if (details && details.total >= 1) {
                        const outrosTotal = details.total - details.pepsico - details.multimarcas;
                        salesByActiveClient[codcli] = {
                            // Explicit copy to avoid Spread issues with Proxy
                            'Código': client['Código'],
                            fantasia: client.fantasia || client.FANTASIA || client['Nome Fantasia'],
                            razaoSocial: client.razaoSocial || client.RAZAOSOCIAL || client.Cliente,
                            cidade: client.cidade || client.CIDADE || client['Nome da Cidade'],
                            bairro: client.bairro || client.BAIRRO || client['Bairro'],
                            ultimaCompra: details.maxDate || client.ultimaCompra || client['Data da Última Compra'] || client.ULTIMACOMPRA,
                            rcas: client.rcas,
                            isNew: client.isNew,
                            // Metrics
                            total: details.total,
                            pepsico: details.pepsico,
                            multimarcas: details.multimarcas,
                            outros: outrosTotal
                        };
                    }
                } else {
                    if (totalFaturamentoMes < 0) {
                        client.isReturn = true;
                    }
                    client.isNewForInactiveLabel = client.isNew && !parseDate(client.ultimaCompra);
                    inactiveClientsList.push(client);
                }
            }, () => {
                // --- ON COMPLETE (Render) ---
                if (currentRenderId !== cityRenderId) return;

                inactiveClientsForExport = inactiveClientsList;

                if (clientsForAnalysis.length > 0) {
                     const statusChartOptions = { maintainAspectRatio: false, animation: { duration: 800, easing: 'easeOutQuart' }, plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1' } }, tooltip: { callbacks: { label: function(context) { return context.label; } } }, datalabels: { formatter: (value, ctx) => { const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0); if (total === 0 || value === 0) return ''; const percentage = (value * 100 / total).toFixed(1) + "%"; return `${value}\n(${percentage})`; }, color: '#fff', backgroundColor: 'rgba(0, 0, 0, 0.6)', borderRadius: 4, padding: 4, font: { weight: 'bold', size: 12 }, textAlign: 'center' } } };
                    createChart('customerStatusChart', 'doughnut', ['Ativos no Mês', 'S/ Vendas no Mês'], [activeClientsList.length, inactiveClientsList.length], statusChartOptions);
                } else showNoDataMessage('customerStatusChart', 'Sem clientes no filtro para exibir o status.');

                const sortedActiveClients = Object.values(salesByActiveClient).sort((a, b) => b.total - a.total);
                activeClientsForExport = sortedActiveClients;

                inactiveClientsList.sort((a, b) => {
                    if (a.isReturn && !b.isReturn) return -1;
                    if (!a.isReturn && b.isReturn) return 1;
                    if (a.isNewForInactiveLabel && !b.isNewForInactiveLabel) return -1;
                    if (!a.isNewForInactiveLabel && b.isNewForInactiveLabel) return 1;
                    return (parseDate(b.ultimaCompra) || 0) - (parseDate(a.ultimaCompra) || 0);
                });


                const cityChartTitleEl = document.getElementById('city-chart-title');
                const cityChartOptions = { indexAxis: 'y', scales: { x: { grace: '15%' } }, plugins: { datalabels: { align: 'end', anchor: 'end', color: '#cbd5e1', font: { size: 14, weight: 'bold' }, formatter: (value) => (value / 1000).toFixed(1) + 'k', offset: 8 } } };
                const totalFaturamentoCidade = salesForAnalysis.reduce((sum, item) => sum + item.VLVENDA, 0);
                totalFaturamentoCidadeEl.textContent = totalFaturamentoCidade.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                if (totalClientesCidadeEl) {
                    totalClientesCidadeEl.textContent = clientsForAnalysis.length.toLocaleString('pt-BR');
                }

                // Always show Top 10 Cities logic (simplified)
                cityChartTitleEl.textContent = 'Top 10 Cidades';
                const salesByCity = {};
                salesForAnalysis.forEach(sale => {
                    let cidade = sale.CIDADE;
                    if (!cidade && sale.CODCLI) {
                        const c = clientMapForKPIs.get(String(sale.CODCLI));
                        if (c) cidade = c.cidade || c.CIDADE || c['Nome da Cidade'];
                    }
                    cidade = cidade || 'N/A';
                    salesByCity[cidade] = (salesByCity[cidade] || 0) + sale.VLVENDA;
                });
                const sortedCidades = Object.entries(salesByCity).sort(([, a], [, b]) => b - a).slice(0, 10);
                createChart('salesByClientInCityChart', 'bar', sortedCidades.map(([name]) => name), sortedCidades.map(([, total]) => total), cityChartOptions);
            }, () => currentRenderId !== cityRenderId);
        }

        function getWeekOfMonth(date) {
            const d = new Date(date);
            const day = d.getUTCDate();
            return Math.ceil(day / 7);
        }

        function getWorkingMonthWeeks(year, month) {
            const weeks = [];
            const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
            lastDayOfMonth.setUTCHours(23, 59, 59, 999);

            // Start looking from Day 1
            let currentDate = new Date(Date.UTC(year, month, 1));

            // Advance to first working day (Mon-Fri)
            // 0=Sun, 6=Sat
            while (currentDate.getUTCDay() === 0 || currentDate.getUTCDay() === 6) {
                currentDate.setUTCDate(currentDate.getUTCDate() + 1);
                // Safety: if month has no working days (impossible usually)
                if (currentDate > lastDayOfMonth) return [];
            }

            // Now currentDate is the start of Week 1
            let weekCount = 1;

            while (currentDate <= lastDayOfMonth) {
                // Determine End of this week bucket
                // Standard: Ends on Sunday.

                let weekEnd = new Date(currentDate);
                const day = weekEnd.getUTCDay(); // 1=Mon ... 5=Fri

                // Distance to next Sunday (0)
                // If Mon(1), need +6. If Sun(0), need +0.
                // (7 - 1) % 7 = 6. (7 - 0) % 7 = 0.
                const distToSunday = (7 - day) % 7;

                weekEnd.setUTCDate(weekEnd.getUTCDate() + distToSunday);
                weekEnd.setUTCHours(23, 59, 59, 999);

                // Cap at end of month
                if (weekEnd > lastDayOfMonth) weekEnd = new Date(lastDayOfMonth);

                weeks.push({
                    start: new Date(currentDate),
                    end: weekEnd,
                    id: weekCount++
                });

                // Next week starts day after weekEnd
                currentDate = new Date(weekEnd);
                currentDate.setUTCDate(currentDate.getUTCDate() + 1);
                currentDate.setUTCHours(0, 0, 0, 0);
            }

            return weeks;
        }

        function calculateHistoricalBests() {
            const salesBySupervisorByDay = {};
            const mostRecentSaleDate = allSalesData.map(s => parseDate(s.DTPED)).filter(Boolean).reduce((a, b) => a > b ? a : b, new Date(0));
            const previousMonthDate = new Date(Date.UTC(mostRecentSaleDate.getUTCFullYear(), mostRecentSaleDate.getUTCMonth() - 1, 1));
            const previousMonth = previousMonthDate.getUTCMonth();
            const previousMonthYear = previousMonthDate.getUTCFullYear();
            const historyLastMonthData = allHistoryData.filter(sale => { const saleDate = parseDate(sale.DTPED); return saleDate && saleDate.getUTCMonth() === previousMonth && saleDate.getUTCFullYear() === previousMonthYear; });
            historyLastMonthData.forEach(sale => {
                if (!sale.SUPERV || sale.SUPERV === 'BALCAO' || !sale.DTPED) return;
                const saleDate = parseDate(sale.DTPED); if (!saleDate) return;
                const supervisor = sale.SUPERV.toUpperCase(); const dateString = saleDate.toISOString().split('T')[0];
                if (!salesBySupervisorByDay[supervisor]) salesBySupervisorByDay[supervisor] = {};
                if (!salesBySupervisorByDay[supervisor][dateString]) salesBySupervisorByDay[supervisor][dateString] = 0;
                salesBySupervisorByDay[supervisor][dateString] += sale.VLVENDA;
            });
            const bestDayByWeekdayBySupervisor = {};
            for (const supervisor in salesBySupervisorByDay) {
                const salesByDay = salesBySupervisorByDay[supervisor];
                const bests = {};
                for (const dateString in salesByDay) {
                    const date = new Date(dateString + 'T00:00:00Z');
                    const dayOfWeek = date.getUTCDay();
                    const total = salesByDay[dateString];
                    if (dayOfWeek >= 1 && dayOfWeek <= 5) { if (!bests[dayOfWeek] || total > bests[dayOfWeek]) bests[dayOfWeek] = total; }
                }
                bestDayByWeekdayBySupervisor[supervisor] = bests;
            }
            historicalBests = bestDayByWeekdayBySupervisor;
        }


        function updateSupplierFilter(dropdown, filterText, selectedArray, dataSource, filterType = 'comparison', skipRender = false) {
            if (!dropdown || !filterText) return selectedArray;
            const forbidden = ['CODFOR', 'FORNECEDOR', 'COD FOR', 'NOME DO FORNECEDOR', 'FORNECEDOR_NOME'];
            const suppliers = new Map();
            dataSource.forEach(s => {
                if(s.CODFOR && s.FORNECEDOR && !forbidden.includes(s.CODFOR.toUpperCase()) && !forbidden.includes(s.FORNECEDOR.toUpperCase())) {
                    suppliers.set(s.CODFOR, s.FORNECEDOR);
                }
            });

            // Special Handling for Meta Realizado: Inject Virtual Categories
            if (filterType === 'metaRealizado' || filterType === 'main') {
                if (suppliers.has(window.SUPPLIER_CODES.ELMA[0])) suppliers.set(window.SUPPLIER_CODES.ELMA[0], 'EXTRUSADOS');
                if (suppliers.has(window.SUPPLIER_CODES.ELMA[1])) suppliers.set(window.SUPPLIER_CODES.ELMA[1], 'NÃO EXTRUSADOS');
                if (suppliers.has(window.SUPPLIER_CODES.ELMA[2])) suppliers.set(window.SUPPLIER_CODES.ELMA[2], 'TORCIDA');

                if (suppliers.has(window.SUPPLIER_CODES.FOODS[0])) {
                    suppliers.delete(window.SUPPLIER_CODES.FOODS[0]);
                    suppliers.set(window.SUPPLIER_CODES.VIRTUAL.TODDYNHO, 'TODDYNHO');
                    suppliers.set(window.SUPPLIER_CODES.VIRTUAL.TODDY, 'TODDY');
                    suppliers.set(window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO, 'QUAKER/KEROCOCO');
                }
            }

            const sortedSuppliers = [...suppliers.entries()].sort((a, b) => a[1].localeCompare(b[1]));

            selectedArray = selectedArray.filter(cod => suppliers.has(cod));

            if (!skipRender) {
                const htmlParts = [];
                for (let i = 0; i < sortedSuppliers.length; i++) {
                    let [cod, name] = sortedSuppliers[i];
                    const isChecked = selectedArray.includes(cod);

                    let displayName = name;
                    // For all pages except 'Meta Vs. Realizado', prefix Code to Name
                    // Request: Main (Visão Geral) should match Meta vs Realizado nomenclature (No Prefix, Split 1119)
                    if (filterType !== 'metaRealizado' && filterType !== 'main') {
                        // Ensure we don't double prefix if name already starts with code (rare but possible in data)
                        if (!name.startsWith(cod)) {
                            displayName = `${cod} ${name}`;
                        }
                    }

                    htmlParts.push(`<label class="flex items-center p-2 hover:bg-slate-600 cursor-pointer"><input type="checkbox" data-filter-type="${filterType}" class="form-checkbox h-4 w-4 glass-panel-heavy border-slate-500 rounded text-teal-500 focus:ring-teal-500" value="${cod}" ${isChecked ? 'checked' : ''}><span class="ml-2 text-xs">${displayName}</span></label>`);
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
        }

        function updateComparisonCitySuggestions(dataSource) {
            const forbidden = ['CIDADE', 'MUNICIPIO', 'CIDADE_CLIENTE', 'NOME DA CIDADE', 'CITY'];
            const inputValue = comparisonCityFilter.value.toLowerCase();
            // Optimized Lookup
            const allAvailableCities = [...new Set(dataSource.map(item => {
                if (item.CIDADE) return item.CIDADE;
                if (item.CODCLI) {
                    const c = clientMapForKPIs.get(String(item.CODCLI));
                    if (c) return c.cidade || c['Nome da Cidade'];
                }
                return 'N/A';
            }).filter(c => c && c !== 'N/A' && !forbidden.includes(c.toUpperCase())))].sort();
            const filteredCities = inputValue ? allAvailableCities.filter(c => c.toLowerCase().includes(inputValue)) : allAvailableCities;
            if (filteredCities.length > 0 && document.activeElement === comparisonCityFilter) {
                comparisonCitySuggestions.innerHTML = filteredCities.map(c => `<div class="p-2 hover:bg-slate-600 cursor-pointer">${c}</div>`).join('');
                comparisonCitySuggestions.classList.remove('hidden');
            } else {
                comparisonCitySuggestions.classList.add('hidden');
            }
        }

        function getMonthWeeks(year, month) {
            const weeks = [];
            // Find the first day of the month
            const firstOfMonth = new Date(Date.UTC(year, month, 1));

            // Find the Sunday on or before the 1st
            const dayOfWeek = firstOfMonth.getUTCDay(); // 0 (Sun) to 6 (Sat)
            let currentStart = new Date(firstOfMonth);
            currentStart.setUTCDate(firstOfMonth.getUTCDate() - dayOfWeek);

            // Find the last day of the month
            const lastOfMonth = new Date(Date.UTC(year, month + 1, 0));

            // Iterate weeks until we cover the last day of the month
            while (currentStart <= lastOfMonth) {
                const currentEnd = new Date(currentStart);
                currentEnd.setUTCDate(currentStart.getUTCDate() + 6);
                currentEnd.setUTCHours(23, 59, 59, 999);

                weeks.push({ start: new Date(currentStart), end: currentEnd });

                // Move to next Sunday
                currentStart.setUTCDate(currentStart.getUTCDate() + 7);
            }
            return weeks;
        }

        function normalize(str) {
            return str
                ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase()
                : '';
        }

        function getPositiveClientsWithNewLogic(salesData) {
            const salesByClient = new Map();
            salesData.forEach(sale => {
                if (!sale.CODCLI) return;
                const clientTotal = salesByClient.get(sale.CODCLI) || 0;
                salesByClient.set(sale.CODCLI, clientTotal + sale.VLVENDA);
            });

            let positiveClients = 0;
            const threshold = 1;

            for (const total of salesByClient.values()) {
                if (total > threshold) {
                    positiveClients++;
                }
            }
            return positiveClients;
        }

        const formatValue = (val, format) => {
            if (format === 'currency') return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            if (format === 'decimal') return val.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
            if (format === 'mix') return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return val.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
        };

        const formatAbbreviated = (val, format) => {
            let prefix = format === 'currency' ? 'R$ ' : '';
            if (val >= 1000000) {
                return prefix + (val / 1000000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Mi';
            } else if (val >= 1000) {
                 return prefix + (val / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' K';
            }
            return null;
        };

        function renderKpiCards(kpis) {
            const container = document.getElementById('comparison-kpi-container');

            container.innerHTML = kpis.map(kpi => {
                const variation = kpi.history > 0 ? ((kpi.current - kpi.history) / kpi.history) * 100 : (kpi.current > 0 ? 100 : 0);
                const colorClass = variation > 0 ? 'text-green-400' : variation < 0 ? 'text-red-400' : 'text-slate-400';

                let displayValue;
                if (kpi.title === 'Faturamento Total') {
                    displayValue = formatAbbreviated(kpi.current, kpi.format) || formatValue(kpi.current, kpi.format);
                } else {
                    displayValue = formatValue(kpi.current, kpi.format);
                }

                let glowClass = 'kpi-glow-blue';
                if (kpi.title.includes('Faturamento')) glowClass = 'kpi-glow-green';
                else if (kpi.title.includes('Volume')) glowClass = 'kpi-glow-blue';
                else if (kpi.title.includes('Positivação') || kpi.title.includes('Cobertura')) glowClass = 'kpi-glow-purple';
                else if (kpi.title.includes('SKU') || kpi.title.includes('Mix')) glowClass = 'kpi-glow-yellow';

                return `<div class="kpi-card p-4 rounded-lg text-center kpi-glow-base ${glowClass} transition transform hover:-translate-y-1 duration-200">
                            <p class="text-slate-300 text-sm">${kpi.title}</p>
                            <p class="text-2xl font-bold text-white my-2">${displayValue}</p>
                            <p class="text-sm ${colorClass}">${variation.toFixed(2)}% vs Média do Trimestre</p>
                            <p class="text-xs text-slate-300">Média Trim.: ${formatValue(kpi.history, kpi.format)}</p>
                        </div>`;
            }).join('');
        }

        function calculateAverageMixComDevolucao(salesData, targetCodfors) {
             if (!salesData || salesData.length === 0 || !targetCodfors || targetCodfors.length === 0) return 0;

            const clientProductNetValue = new Map();

            for (const sale of salesData) {
                if (!targetCodfors.includes(String(sale.CODFOR))) continue;
                if (!sale.CODCLI || !sale.PRODUTO) continue;

                if (!clientProductNetValue.has(sale.CODCLI)) {
                    clientProductNetValue.set(sale.CODCLI, new Map());
                }
                const clientProducts = clientProductNetValue.get(sale.CODCLI);

                const currentValue = clientProducts.get(sale.PRODUTO) || 0;
                clientProducts.set(sale.PRODUTO, currentValue + (Number(sale.VLVENDA) || 0));
            }

            const mixValues = [];
            for (const products of clientProductNetValue.values()) {
                let positiveProductCount = 0;
                for (const netValue of products.values()) {
                    if (netValue >= 1) {
                        positiveProductCount++;
                    }
                }
                if (positiveProductCount > 0) {
                    mixValues.push(positiveProductCount);
                }
            }

            if (mixValues.length === 0) return 0;

            return mixValues.reduce((a, b) => a + b, 0) / mixValues.length;
        }

        function calculatePositivacaoPorCestaComDevolucao(salesData, requiredCategories) {
            if (!salesData || salesData.length === 0 || !requiredCategories || requiredCategories.length === 0) return 0;

            const normalizedCategories = requiredCategories.map(normalize);
            const clientProductNetSales = new Map();

            for (const sale of salesData) {
                if (!sale.CODCLI || !sale.PRODUTO) continue;

                if (!clientProductNetSales.has(sale.CODCLI)) {
                    clientProductNetSales.set(sale.CODCLI, new Map());
                }
                const clientProducts = clientProductNetSales.get(sale.CODCLI);

                if (!clientProducts.has(sale.PRODUTO)) {
                    clientProducts.set(sale.PRODUTO, { netValue: 0, description: sale.DESCRICAO });
                }
                const productData = clientProducts.get(sale.PRODUTO);
                productData.netValue += (Number(sale.VLVENDA) || 0);
            }

            const clientPurchasedCategories = new Map();

            for (const [codcli, products] of clientProductNetSales.entries()) {
                for (const data of products.values()) {
                    if (data.netValue >= 1) {
                        const normalizedDescription = normalize(data.description);
                        for (const category of normalizedCategories) {
                            if (normalizedDescription.includes(category)) {
                                if (!clientPurchasedCategories.has(codcli)) {
                                    clientPurchasedCategories.set(codcli, new Set());
                                }
                                clientPurchasedCategories.get(codcli).add(category);
                                break;
                            }
                        }
                    }
                }
            }

            let positivadosCount = 0;
            const requiredCategoryCount = normalizedCategories.length;
            for (const categoriesPurchased of clientPurchasedCategories.values()) {
                if (categoriesPurchased.size >= requiredCategoryCount) {
                    positivadosCount++;
                }
            }

            return positivadosCount;
        }


        function groupSalesByMonth(salesData) {
            const salesByMonth = {};
            salesData.forEach(sale => {
                const date = parseDate(sale.DTPED);
                if (!date || isNaN(date.getTime())) return;
                const monthKey = date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0');
                if (!salesByMonth[monthKey]) salesByMonth[monthKey] = [];
                salesByMonth[monthKey].push(sale);
            });
            return salesByMonth;
        }

                        function calculateUnifiedMetrics(currentSales, historySales) {
            // 1. Setup Data Structures
            const currentYear = lastSaleDate.getUTCFullYear();
            const currentMonth = lastSaleDate.getUTCMonth();
            const currentMonthWeeks = getMonthWeeks(currentYear, currentMonth);

            const metrics = {
                current: {
                    fat: 0, peso: 0, clients: 0,
                    mixPepsico: 0, positivacaoSalty: 0, positivacaoFoods: 0
                },
                history: {
                    fat: 0, peso: 0,
                    avgFat: 0, avgPeso: 0, avgClients: 0,
                    avgMixPepsico: 0, avgPositivacaoSalty: 0, avgPositivacaoFoods: 0
                },
                charts: {
                    weeklyCurrent: new Array(currentMonthWeeks.length).fill(0),
                    weeklyHistory: new Array(currentMonthWeeks.length).fill(0),
                    monthlyData: [], // { label, value (fat/clients) }
                    supervisorData: {} // { sup: { current, history } }
                },
                overlapSales: []
            };

            const firstWeekStart = currentMonthWeeks[0].start;
            const firstOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
            const hasOverlap = firstWeekStart < firstOfMonth;

            const pepsicoCodfors = new Set([window.SUPPLIER_CODES.ELMA[0], window.SUPPLIER_CODES.ELMA[1]]);
            const saltyCategories = ['CHEETOS', 'DORITOS', 'FANDANGOS', 'RUFFLES', 'TORCIDA'];
            const foodsCategories = ['TODDYNHO', 'TODDY ', 'QUAKER', 'KEROCOCO'];

            // Helper to normalize strings
            const norm = (s) => s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase() : '';

            // --- FILTER: Foods Description Logic (Same as Metas) ---
            const isValidFoodsProduct = (codFor, desc) => {
                // Apply strict description check ONLY for Supplier 1119 (Foods)
                if (codFor !== window.SUPPLIER_CODES.FOODS[0]) return true;

                const d = norm(desc || '');
                // Check if it matches ANY of the Foods sub-brands (Toddynho, Toddy, Quaker/Kerococo)
                // Note: Metas logic separates them. Here we just want to know if it belongs to "Foods Group".
                // If it contains NONE of the keywords, it is excluded from "Foods" metrics.
                if (d.includes('TODDYNHO')) return true;
                if (d.includes('TODDY ')) return true; // Note the space
                if (d.includes('QUAKER')) return true;
                if (d.includes('KEROCOCO')) return true;

                return false;
            };

            // --- 2. Process Current Sales (Single Pass) ---
            const currentClientProductMap = new Map(); // Client -> Product -> { val, desc, codfor }
            const currentClientsSet = new Map(); // Client -> Total Value (for Positive check)

            currentSales.forEach(s => {
                // Filter: Only Type 1 and 9 count for Metrics (Fat/Peso/Charts)
                const isValidType = (s.TIPOVENDA === '1' || s.TIPOVENDA === '9');

                // Filter: Strict Foods Definition
                if (!isValidFoodsProduct(String(s.CODFOR), s.DESCRICAO)) return;

                if (isValidType) {
                    metrics.current.fat += s.VLVENDA;
                    metrics.current.peso += s.TOTPESOLIQ;
                }

                if (s.CODCLI) {
                    // Accumulate for Positive Check (using VLVENDA which is 0 for non-1/9 anyway, but keeping consistent)
                    currentClientsSet.set(s.CODCLI, (currentClientsSet.get(s.CODCLI) || 0) + s.VLVENDA);

                    if (!currentClientProductMap.has(s.CODCLI)) currentClientProductMap.set(s.CODCLI, new Map());
                    const cMap = currentClientProductMap.get(s.CODCLI);
                    if (!cMap.has(s.PRODUTO)) cMap.set(s.PRODUTO, { val: 0, desc: s.DESCRICAO, codfor: String(s.CODFOR) });
                    cMap.get(s.PRODUTO).val += s.VLVENDA;
                }

                // Supervisor Data
                if (s.SUPERV && isValidType) {
                    if (!metrics.charts.supervisorData[s.SUPERV]) metrics.charts.supervisorData[s.SUPERV] = { current: 0, history: 0 };
                    metrics.charts.supervisorData[s.SUPERV].current += s.VLVENDA;
                }

                // Weekly Chart (Current)
                const d = parseDate(s.DTPED);
                if (d && isValidType) {
                    const wIdx = currentMonthWeeks.findIndex(w => d >= w.start && d <= w.end);
                    if (wIdx !== -1) metrics.charts.weeklyCurrent[wIdx] += s.VLVENDA;
                }
            });

            // Calculate Current KPIs from Maps
            let currentPositiveClients = 0;
            currentClientsSet.forEach(val => { if (val >= 1) currentPositiveClients++; });
            metrics.current.clients = currentPositiveClients;

            // Mix/Positivacao Current
            let sumMix = 0;
            let countMixClients = 0;
            let countSalty = 0;
            let countFoods = 0;

            currentClientProductMap.forEach((prods, codcli) => {
                // Mix Pepsico
                let pepsicoCount = 0;
                const boughtCatsSalty = new Set();
                const boughtCatsFoods = new Set();

                prods.forEach(pData => {
                    if (pData.val >= 1) {
                        if (pepsicoCodfors.has(pData.codfor)) pepsicoCount++;

                        const desc = norm(pData.desc);
                        saltyCategories.forEach(cat => { if (desc.includes(cat)) boughtCatsSalty.add(cat); });
                        foodsCategories.forEach(cat => { if (desc.includes(cat)) boughtCatsFoods.add(cat); });
                    }
                });

                if (pepsicoCount > 0) {
                    sumMix += pepsicoCount;
                    countMixClients++;
                }
                if (boughtCatsSalty.size >= saltyCategories.length) countSalty++;
                if (boughtCatsFoods.size >= foodsCategories.length) countFoods++;
            });

            metrics.current.mixPepsico = countMixClients > 0 ? sumMix / countMixClients : 0;
            metrics.current.positivacaoSalty = countSalty;
            metrics.current.positivacaoFoods = countFoods;


            // --- 3. Process History Sales (Single Pass) ---
            const historyMonths = new Map(); // MonthKey -> { fat, clientMap, weekSales: [] }

            // Cache week ranges for history months to avoid recalculating
            const monthWeeksCache = new Map();

            historySales.forEach(s => {
                const d = parseDate(s.DTPED);
                if (!d) return;

                const monthKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;

                // Filter: Strict Foods Definition (Apply here too)
                if (!isValidFoodsProduct(String(s.CODFOR), s.DESCRICAO)) return;

                // Filter: Only Type 1 and 9 count for Metrics (Fat/Peso/Charts)
                const isValidType = (s.TIPOVENDA === '1' || s.TIPOVENDA === '9');

                if (isValidType) {
                    metrics.history.fat += s.VLVENDA;
                    metrics.history.peso += s.TOTPESOLIQ;
                }

                if (!historyMonths.has(monthKey)) {
                    historyMonths.set(monthKey, {
                        fat: 0,
                        clients: new Map(), // Client -> Total
                        productMap: new Map() // Client -> Product -> Data
                    });
                }
                const mData = historyMonths.get(monthKey);

                if (isValidType) {
                    mData.fat += s.VLVENDA;
                }

                if (s.CODCLI) {
                    mData.clients.set(s.CODCLI, (mData.clients.get(s.CODCLI) || 0) + s.VLVENDA);

                    if (!mData.productMap.has(s.CODCLI)) mData.productMap.set(s.CODCLI, new Map());
                    const cMap = mData.productMap.get(s.CODCLI);
                    if (!cMap.has(s.PRODUTO)) cMap.set(s.PRODUTO, { val: 0, desc: s.DESCRICAO, codfor: String(s.CODFOR) });
                    cMap.get(s.PRODUTO).val += s.VLVENDA;
                }

                // Supervisor History
                if (s.SUPERV && isValidType) {
                    if (!metrics.charts.supervisorData[s.SUPERV]) metrics.charts.supervisorData[s.SUPERV] = { current: 0, history: 0 };
                    metrics.charts.supervisorData[s.SUPERV].history += s.VLVENDA;
                }

                // Weekly History (Average logic)
                if (!monthWeeksCache.has(monthKey)) {
                    monthWeeksCache.set(monthKey, getMonthWeeks(d.getUTCFullYear(), d.getUTCMonth()));
                }
                const weeks = monthWeeksCache.get(monthKey);
                const wIdx = weeks.findIndex(w => d >= w.start && d <= w.end);

                // Map to Current Month's structure (0..4)
                if (wIdx !== -1 && wIdx < metrics.charts.weeklyHistory.length && isValidType) {
                    metrics.charts.weeklyHistory[wIdx] += s.VLVENDA;
                }

                // Handle Overlap for Current Chart (Single Pass)
                if (hasOverlap && d >= firstWeekStart && d < firstOfMonth && isValidType) {
                    metrics.charts.weeklyCurrent[0] += s.VLVENDA;
                    metrics.overlapSales.push(s);
                }
            });

            // Calculate History Averages
            metrics.history.avgFat = metrics.history.fat / QUARTERLY_DIVISOR;
            metrics.history.avgPeso = metrics.history.peso / QUARTERLY_DIVISOR;
            metrics.charts.weeklyHistory = metrics.charts.weeklyHistory.map(v => v / QUARTERLY_DIVISOR);

            // Normalize Supervisor History
            Object.values(metrics.charts.supervisorData).forEach(d => d.history /= QUARTERLY_DIVISOR);

            // Process Monthly KPIs (Clients, Mix)
            // Sort months to ensure we take the last 3 if there are more
            const sortedMonths = Array.from(historyMonths.keys()).sort();

            // Take last 3 months
            const monthsToProcess = sortedMonths.slice(-3);

            let sumClients = 0;
            let sumMixPep = 0;
            let sumPosSalty = 0;
            let sumPosFoods = 0;

            monthsToProcess.forEach(mKey => {
                const mData = historyMonths.get(mKey);

                // Clients
                let posClients = 0;
                mData.clients.forEach(v => { if(v >= 1) posClients++; });
                sumClients += posClients;

                // Mix
                let mSumMix = 0;
                let mCountMixClients = 0;
                let mCountSalty = 0;
                let mCountFoods = 0;

                mData.productMap.forEach((prods, codcli) => {
                    let pepsicoCount = 0;
                    const boughtCatsSalty = new Set();
                    const boughtCatsFoods = new Set();

                    prods.forEach(pData => {
                        if (pData.val >= 1) {
                            if (pepsicoCodfors.has(pData.codfor)) pepsicoCount++;
                            const desc = norm(pData.desc);
                            saltyCategories.forEach(cat => { if (desc.includes(cat)) boughtCatsSalty.add(cat); });
                            foodsCategories.forEach(cat => { if (desc.includes(cat)) boughtCatsFoods.add(cat); });
                        }
                    });

                    if (pepsicoCount > 0) {
                        mSumMix += pepsicoCount;
                        mCountMixClients++;
                    }
                    if (boughtCatsSalty.size >= saltyCategories.length) mCountSalty++;
                    if (boughtCatsFoods.size >= foodsCategories.length) mCountFoods++;
                });

                sumMixPep += (mCountMixClients > 0 ? mSumMix / mCountMixClients : 0);
                sumPosSalty += mCountSalty;
                sumPosFoods += mCountFoods;

                // For Monthly Chart (Labels and Values)
                const [y, m] = mKey.split('-');
                const monthName = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"][parseInt(m)];

                metrics.charts.monthlyData.push({
                    label: monthName,
                    fat: mData.fat,
                    clients: posClients,
                    key: mKey
                });
            });

            // Finish History Averages
            metrics.history.avgClients = sumClients / QUARTERLY_DIVISOR;
            metrics.history.avgMixPepsico = sumMixPep / QUARTERLY_DIVISOR;
            metrics.history.avgPositivacaoSalty = sumPosSalty / QUARTERLY_DIVISOR;
            metrics.history.avgPositivacaoFoods = sumPosFoods / QUARTERLY_DIVISOR;

            return metrics;
        }


        function monthlyKpiAverage(dataInput, kpiFn, isGrouped = false, ...kpiArgs) {
            let salesByMonth;
            if (isGrouped) {
                salesByMonth = dataInput;
            } else {
                salesByMonth = groupSalesByMonth(dataInput);
            }

            let sortedMonths = Object.keys(salesByMonth).sort();

            if (sortedMonths.length > 0) {
                const firstMonthKey = sortedMonths[0];
                const firstSaleInFirstMonth = salesByMonth[firstMonthKey].reduce((earliest, sale) => {
                    const saleDate = parseDate(sale.DTPED);
                    return (!earliest || (saleDate && saleDate < earliest)) ? saleDate : earliest;
                }, null);

                if (firstSaleInFirstMonth && firstSaleInFirstMonth.getUTCDate() > 20) {
                    sortedMonths.shift();
                }
            }

            const monthsToAverage = sortedMonths.slice(-3);

            const kpiValues = monthsToAverage.map(monthKey => {
                const salesForMonth = salesByMonth[monthKey];
                return kpiFn(salesForMonth, ...kpiArgs);
            });

            if (kpiValues.length === 0) return 0;
            return kpiValues.reduce((a, b) => a + b, 0) / QUARTERLY_DIVISOR;
        }

        const getFilteredDataFromIndices = (indices, dataset, filters, excludeFilter = null) => {
            const isExcluded = (f) => excludeFilter === f || (Array.isArray(excludeFilter) && excludeFilter.includes(f));
            const setsToIntersect = [];
            let hasFilter = false;

            // Helper to get item
            const getItem = (idx) => (dataset.get ? dataset.get(idx) : dataset[idx]);

            if (filters.filial && filters.filial !== 'ambas') {
                hasFilter = true;
                if (indices.byFilial && indices.byFilial.has(filters.filial)) {
                    setsToIntersect.push(indices.byFilial.get(filters.filial));
                } else {
                    return [];
                }
            }

            if (!isExcluded('supervisor') && filters.supervisor) {
                if (typeof filters.supervisor === 'string') {
                    hasFilter = true;
                    if (indices.bySupervisor && indices.bySupervisor.has(filters.supervisor)) {
                        setsToIntersect.push(indices.bySupervisor.get(filters.supervisor));
                    } else {
                        return [];
                    }
                } else if (filters.supervisor.size > 0) {
                    hasFilter = true;
                    const unionIds = new Set();
                    let foundAny = false;
                    filters.supervisor.forEach(sup => {
                        if (indices.bySupervisor && indices.bySupervisor.has(sup)) {
                            indices.bySupervisor.get(sup).forEach(id => unionIds.add(id));
                            foundAny = true;
                        }
                    });
                    if (foundAny) setsToIntersect.push(unionIds);
                    else return [];
                }
            }

            if (!isExcluded('pasta') && filters.pasta) {
                hasFilter = true;
                if (indices.byPasta && indices.byPasta.has(filters.pasta)) {
                    setsToIntersect.push(indices.byPasta.get(filters.pasta));
                } else {
                    return [];
                }
            }

            if (!isExcluded('tipoVenda') && filters.tipoVenda && filters.tipoVenda.size > 0) {
                hasFilter = true;
                const ids = new Set();
                let foundAny = false;
                filters.tipoVenda.forEach(t => {
                    if (indices.byTipoVenda && indices.byTipoVenda.has(t)) {
                        indices.byTipoVenda.get(t).forEach(id => ids.add(id));
                        foundAny = true;
                    }
                });
                if (foundAny) setsToIntersect.push(ids);
                else return [];
            }

            if (!isExcluded('seller') && filters.seller && filters.seller.size > 0) {
                hasFilter = true;
                const ids = new Set();
                let foundAny = false;
                filters.seller.forEach(s => {
                    if (indices.byRca && indices.byRca.has(s)) {
                        indices.byRca.get(s).forEach(id => ids.add(id));
                        foundAny = true;
                    }
                });
                if (foundAny) setsToIntersect.push(ids);
                else return [];
            }

            if (!isExcluded('supplier') && filters.supplier && filters.supplier.size > 0) {
                hasFilter = true;
                const ids = new Set();
                let foundAny = false;
                filters.supplier.forEach(s => {
                    if (indices.bySupplier && indices.bySupplier.has(s)) {
                        indices.bySupplier.get(s).forEach(id => ids.add(id));
                        foundAny = true;
                    }
                });
                if (foundAny) setsToIntersect.push(ids);
                else return [];
            }

            if (!isExcluded('product') && filters.product && filters.product.size > 0) {
                hasFilter = true;
                const ids = new Set();
                let foundAny = false;
                filters.product.forEach(p => {
                    if (indices.byProduct && indices.byProduct.has(p)) {
                        indices.byProduct.get(p).forEach(id => ids.add(id));
                        foundAny = true;
                    }
                });
                if (foundAny) setsToIntersect.push(ids);
                else return [];
            }

            if (!isExcluded('city') && filters.city) {
                hasFilter = true;
                if (indices.byCity && indices.byCity.has(filters.city)) {
                    setsToIntersect.push(indices.byCity.get(filters.city));
                } else {
                    return [];
                }
            }

            if (setsToIntersect.length === 0 && !hasFilter && !filters.clientCodes) {
                if (dataset.values && typeof dataset.values === 'function') {
                    return dataset.values();
                }
                if (Array.isArray(dataset)) return dataset;

                const all = [];
                for(let i=0; i<dataset.length; i++) all.push(getItem(i));
                return all;
            }

            let resultIds;
            if (setsToIntersect.length > 0) {
                // --- OPTIMIZATION START ---
                // Sort sets by size to intersect the smallest sets first.
                setsToIntersect.sort((a, b) => a.size - b.size);

                // Start with the smallest set.
                resultIds = new Set(setsToIntersect[0]);

                // Intersect with the rest of the sets.
                for (let i = 1; i < setsToIntersect.length; i++) {
                    // Stop early if the result is already empty.
                    if (resultIds.size === 0) break;

                    const currentSet = setsToIntersect[i];
                    for (const id of resultIds) {
                        if (!currentSet.has(id)) {
                            resultIds.delete(id);
                        }
                    }
                }
                // --- OPTIMIZATION END ---
            } else if (filters.clientCodes) {
                 const allData = [];
                 // Use iteration if values() unavailable
                 if (Array.isArray(dataset)) {
                     for(let i=0; i<dataset.length; i++) {
                         if(filters.clientCodes.has(normalizeKey(dataset[i].CODCLI))) allData.push(dataset[i]);
                     }
                 } else if (dataset.values && typeof dataset.values === 'function') {
                     const vals = dataset.values();
                     for(let i=0; i<vals.length; i++) if(filters.clientCodes.has(normalizeKey(vals[i].CODCLI))) allData.push(vals[i]);
                 } else {
                     for(let i=0; i<dataset.length; i++) {
                         const item = getItem(i);
                         if(filters.clientCodes.has(normalizeKey(item.CODCLI))) allData.push(item);
                     }
                 }
                 return allData;
            } else {
                // Should be unreachable due to first check, but safe fallback
                if (dataset.values && typeof dataset.values === 'function') return dataset.values();
                if (Array.isArray(dataset)) return dataset;
                const all = [];
                for(let i=0; i<dataset.length; i++) all.push(getItem(i));
                return all;
            }

            const result = [];
            for (const id of resultIds) {
                const item = getItem(id);
                if (!filters.clientCodes || filters.clientCodes.has(normalizeKey(item.CODCLI))) {
                    result.push(item);
                }
            }
            return result;
        };

        function getComparisonFilteredData(options = {}) {
            const { excludeFilter = null } = options;

            const suppliersSet = new Set(selectedComparisonSuppliers);
            const productsSet = new Set(selectedComparisonProducts);
            const tiposVendaSet = new Set(selectedComparisonTiposVenda);
            const redeSet = new Set(selectedComparisonRedes);

            const pasta = currentComparisonFornecedor;
            const city = comparisonCityFilter.value.trim().toLowerCase();
            const filial = comparisonFilialFilter.value;

            let clients = getHierarchyFilteredClients('comparison', allClientsData);

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

        function updateProductFilter(dropdown, filterText, selectedArray, dataSource, filterType = 'comparison', skipRender = false) {
            if (!dropdown) return selectedArray;
            const forbidden = ['PRODUTO', 'DESCRICAO', 'CODIGO', 'CÓDIGO', 'DESCRIÇÃO'];
            const searchInput = dropdown.querySelector('input[type="text"]');
            const listContainer = dropdown.querySelector('div[id$="-list"]');
            const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

            const products = [...new Map(dataSource.map(s => [s.PRODUTO, s.DESCRICAO]))
                .entries()]
                .filter(([code, desc]) => code && desc && !forbidden.includes(code.toUpperCase()) && !forbidden.includes(desc.toUpperCase()))
                .sort((a,b) => a[1].localeCompare(b[1]));

            // Filter selectedArray to keep only items present in the current dataSource
            const availableProductCodes = new Set(products.map(p => p[0]));
            selectedArray = selectedArray.filter(code => availableProductCodes.has(code));

            const filteredProducts = searchTerm.length > 0
                ? products.filter(([code, name]) =>
                    name.toLowerCase().includes(searchTerm) || code.toLowerCase().includes(searchTerm)
                  )
                : products;

            if (!skipRender && listContainer) {
                const htmlParts = [];
                for (let i = 0; i < filteredProducts.length; i++) {
                    const [code, name] = filteredProducts[i];
                    const isChecked = selectedArray.includes(code);
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
        }

        function updateComparisonProductFilter() {
            const { currentSales, historySales } = getComparisonFilteredData({ excludeFilter: 'product' });
            selectedComparisonProducts = updateProductFilter(comparisonProductFilterDropdown, comparisonProductFilterText, selectedComparisonProducts, [...currentSales, ...historySales], 'comparison');
        }

        function getActiveStockMap(filial) {
            const filterValue = filial || 'ambas';
            if (filterValue === '05') {
                return stockData05;
            }
            if (filterValue === '08') {
                return stockData08;
            }
            const combinedStock = new Map(stockData05);
            stockData08.forEach((qty, code) => {
                combinedStock.set(code, (combinedStock.get(code) || 0) + qty);
            });
            return combinedStock;
        }


        function updateComparisonView() {
            comparisonRenderId++;
            const currentRenderId = comparisonRenderId;
            const { currentSales, historySales, perdasSales, perdasHistory } = getComparisonFilteredData();

            // Show Loading State on Charts (only if no chart exists)
            const chartContainers = ['weeklyComparisonChart', 'monthlyComparisonChart', 'dailyWeeklyComparisonChart'];
            chartContainers.forEach(id => {
                if (!charts[id]) {
                    const el = document.getElementById(id + 'Container');
                    if(el) el.innerHTML = '<div class="flex h-full items-center justify-center"><svg class="animate-spin h-8 w-8 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>';
                }
            });

            const currentYear = lastSaleDate.getUTCFullYear();
            const currentMonth = lastSaleDate.getUTCMonth();
            const currentMonthWeeks = getMonthWeeks(currentYear, currentMonth);

            const metrics = {
                current: { fat: 0, peso: 0, clients: 0, mixPepsico: 0, positivacaoSalty: 0, positivacaoFoods: 0 },
                history: { fat: 0, peso: 0, avgFat: 0, avgPeso: 0, avgClients: 0, avgMixPepsico: 0, avgPositivacaoSalty: 0, avgPositivacaoFoods: 0 },
                charts: {
                    weeklyCurrent: new Array(currentMonthWeeks.length).fill(0),
                    weeklyHistory: new Array(currentMonthWeeks.length).fill(0),
                    monthlyData: [],
                    supervisorData: {}
                },
                historicalDayTotals: new Array(7).fill(0), // 0=Sun, 6=Sat
                currentDayTotals: new Array(7).fill(0), // 0=Sun, 6=Sat
                overlapSales: []
            };

            const firstWeekStart = currentMonthWeeks[0].start;
            const firstOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
            const hasOverlap = firstWeekStart < firstOfMonth;
            const pepsicoCodfors = new Set([window.SUPPLIER_CODES.ELMA[0], window.SUPPLIER_CODES.ELMA[1]]);
            const saltyCategories = ['CHEETOS', 'DORITOS', 'FANDANGOS', 'RUFFLES', 'TORCIDA'];
            const foodsCategories = ['TODDYNHO', 'TODDY ', 'QUAKER', 'KEROCOCO'];
            const norm = (s) => s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase() : '';

            // Temp structures for Current processing
            const currentClientProductMap = new Map();
            const currentClientsSet = new Map();

            // Temp structures for History processing
            const historyMonths = new Map();
            const monthWeeksCache = new Map();

            // --- Async Pipeline ---

            // 1. Process Current Sales
            runAsyncChunked(currentSales, (s) => {
                if (!isAlternativeMode(selectedComparisonTiposVenda) && s.TIPOVENDA !== '1' && s.TIPOVENDA !== '9') return;
                const val = getValueForSale(s, selectedComparisonTiposVenda);

                metrics.current.fat += val;
                metrics.current.peso += s.TOTPESOLIQ;

                if (s.CODCLI) {
                    currentClientsSet.set(s.CODCLI, (currentClientsSet.get(s.CODCLI) || 0) + val);
                    if (!currentClientProductMap.has(s.CODCLI)) currentClientProductMap.set(s.CODCLI, new Map());
                    const cMap = currentClientProductMap.get(s.CODCLI);
                    if (!cMap.has(s.PRODUTO)) cMap.set(s.PRODUTO, { val: 0, desc: s.DESCRICAO, codfor: String(s.CODFOR) });
                    cMap.get(s.PRODUTO).val += val;
                }
                if (s.SUPERV) {
                    if (!metrics.charts.supervisorData[s.SUPERV]) metrics.charts.supervisorData[s.SUPERV] = { current: 0, history: 0 };
                    metrics.charts.supervisorData[s.SUPERV].current += val;
                }
                const d = parseDate(s.DTPED);
                if (d) {
                    const wIdx = currentMonthWeeks.findIndex(w => d >= w.start && d <= w.end);
                    if (wIdx !== -1) metrics.charts.weeklyCurrent[wIdx] += val;
                    metrics.currentDayTotals[d.getUTCDay()] += val;
                }
            }, () => {
                // 1.1 Finalize Current KPIs
                let currentPositiveClients = 0;
                currentClientsSet.forEach(val => { if (val >= 1) currentPositiveClients++; });
                metrics.current.clients = currentPositiveClients;

                let sumMix = 0; let countMixClients = 0; let countSalty = 0; let countFoods = 0;
                currentClientProductMap.forEach((prods) => {
                    let pepsicoCount = 0;
                    const boughtCatsSalty = new Set();
                    const boughtCatsFoods = new Set();
                    prods.forEach(pData => {
                        if (pData.val >= 1) {
                            if (pepsicoCodfors.has(pData.codfor)) pepsicoCount++;
                            const desc = norm(pData.desc);
                            saltyCategories.forEach(cat => { if (desc.includes(cat)) boughtCatsSalty.add(cat); });
                            foodsCategories.forEach(cat => { if (desc.includes(cat)) boughtCatsFoods.add(cat); });
                        }
                    });
                    if (pepsicoCount > 0) { sumMix += pepsicoCount; countMixClients++; }
                    if (boughtCatsSalty.size >= saltyCategories.length) countSalty++;
                    if (boughtCatsFoods.size >= foodsCategories.length) countFoods++;
                });
                metrics.current.mixPepsico = countMixClients > 0 ? sumMix / countMixClients : 0;
                metrics.current.positivacaoSalty = countSalty;
                metrics.current.positivacaoFoods = countFoods;

                if (currentRenderId !== comparisonRenderId) return;

                // 2. Process History Sales
                runAsyncChunked(historySales, (s) => {
                    if (!isAlternativeMode(selectedComparisonTiposVenda) && s.TIPOVENDA !== '1' && s.TIPOVENDA !== '9') return;
                    const val = getValueForSale(s, selectedComparisonTiposVenda);

                    metrics.history.fat += val;
                    metrics.history.peso += s.TOTPESOLIQ;

                    const d = parseDate(s.DTPED);
                    if (!d) return;

                    const monthKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
                    if (!historyMonths.has(monthKey)) historyMonths.set(monthKey, { fat: 0, clients: new Map(), productMap: new Map() });
                    const mData = historyMonths.get(monthKey);

                    mData.fat += val;

                    if (s.CODCLI) {
                        mData.clients.set(s.CODCLI, (mData.clients.get(s.CODCLI) || 0) + val);
                        if (!mData.productMap.has(s.CODCLI)) mData.productMap.set(s.CODCLI, new Map());
                        const cMap = mData.productMap.get(s.CODCLI);
                        if (!cMap.has(s.PRODUTO)) cMap.set(s.PRODUTO, { val: 0, desc: s.DESCRICAO, codfor: String(s.CODFOR) });
                        cMap.get(s.PRODUTO).val += val;
                    }

                    if (s.SUPERV) {
                        if (!metrics.charts.supervisorData[s.SUPERV]) metrics.charts.supervisorData[s.SUPERV] = { current: 0, history: 0 };
                        metrics.charts.supervisorData[s.SUPERV].history += val;
                    }

                    // Accumulate Day Totals for Day Weight Calculation
                    metrics.historicalDayTotals[d.getUTCDay()] += val;

                    if (!monthWeeksCache.has(monthKey)) monthWeeksCache.set(monthKey, getMonthWeeks(d.getUTCFullYear(), d.getUTCMonth()));
                    const weeks = monthWeeksCache.get(monthKey);
                    const wIdx = weeks.findIndex(w => d >= w.start && d <= w.end);
                    if (wIdx !== -1 && wIdx < metrics.charts.weeklyHistory.length) {
                        metrics.charts.weeklyHistory[wIdx] += val;
                    }
                    if (hasOverlap && d >= firstWeekStart && d < firstOfMonth) {
                        metrics.charts.weeklyCurrent[0] += val;
                        metrics.overlapSales.push(s);
                    }
                }, () => {
                    if (currentRenderId !== comparisonRenderId) return;

                    // 2.1 Finalize History Metrics
                    metrics.history.avgFat = metrics.history.fat / QUARTERLY_DIVISOR;
                    metrics.history.avgPeso = metrics.history.peso / QUARTERLY_DIVISOR;
                    metrics.charts.weeklyHistory = metrics.charts.weeklyHistory.map(v => v / QUARTERLY_DIVISOR);
                    Object.values(metrics.charts.supervisorData).forEach(d => d.history /= QUARTERLY_DIVISOR);

                    // Calculate Day Weights
                    const totalHistoryDays = metrics.historicalDayTotals.reduce((a, b) => a + b, 0);
                    metrics.dayWeights = metrics.historicalDayTotals.map(v => totalHistoryDays > 0 ? v / totalHistoryDays : 0);

                    const sortedMonths = Array.from(historyMonths.keys()).sort((a, b) => {
                        const [y1, m1] = a.split('-').map(Number);
                        const [y2, m2] = b.split('-').map(Number);
                        return (y1 * 12 + m1) - (y2 * 12 + m2);
                    }).slice(-3);
                    let sumClients = 0; let sumMixPep = 0; let sumPosSalty = 0; let sumPosFoods = 0;

                    sortedMonths.forEach(mKey => {
                        const mData = historyMonths.get(mKey);
                        let posClients = 0;
                        mData.clients.forEach(v => { if(v >= 1) posClients++; });
                        sumClients += posClients;

                        let mSumMix = 0; let mCountMixClients = 0; let mCountSalty = 0; let mCountFoods = 0;
                        mData.productMap.forEach((prods) => {
                            let pepsicoCount = 0;
                            const boughtCatsSalty = new Set();
                            const boughtCatsFoods = new Set();
                            prods.forEach(pData => {
                                if (pData.val >= 1) {
                                    if (pepsicoCodfors.has(pData.codfor)) pepsicoCount++;
                                    const desc = norm(pData.desc);
                                    saltyCategories.forEach(cat => { if (desc.includes(cat)) boughtCatsSalty.add(cat); });
                                    foodsCategories.forEach(cat => { if (desc.includes(cat)) boughtCatsFoods.add(cat); });
                                }
                            });
                            if (pepsicoCount > 0) { mSumMix += pepsicoCount; mCountMixClients++; }
                            if (boughtCatsSalty.size >= saltyCategories.length) mCountSalty++;
                            if (boughtCatsFoods.size >= foodsCategories.length) mCountFoods++;
                        });
                        sumMixPep += (mCountMixClients > 0 ? mSumMix / mCountMixClients : 0);
                        sumPosSalty += mCountSalty;
                        sumPosFoods += mCountFoods;

                        const [y, m] = mKey.split('-');
                        const label = new Date(Date.UTC(parseInt(y), parseInt(m), 1)).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
                        metrics.charts.monthlyData.push({ label, fat: mData.fat, clients: posClients });
                    });

                    metrics.history.avgClients = sumClients / QUARTERLY_DIVISOR;
                    metrics.history.avgMixPepsico = sumMixPep / QUARTERLY_DIVISOR;
                    metrics.history.avgPositivacaoSalty = sumPosSalty / QUARTERLY_DIVISOR;
                    metrics.history.avgPositivacaoFoods = sumPosFoods / QUARTERLY_DIVISOR;

                    // Calculate Perdas KPI
                    let currentPerdas = 0;
                    if (perdasSales && perdasSales.length > 0) {
                        for(let i=0; i<perdasSales.length; i++) {
                            // Force Alternative Mode (VLBONIFIC) for Perdas (Type 5)
                            currentPerdas += getValueForSale(perdasSales[i], ['5']);
                        }
                    }
                    metrics.current.perdas = currentPerdas;

                    let historyPerdas = 0;
                    if (perdasHistory && perdasHistory.length > 0) {
                        for(let i=0; i<perdasHistory.length; i++) {
                            historyPerdas += getValueForSale(perdasHistory[i], ['5']);
                        }
                    }
                    metrics.history.avgPerdas = historyPerdas / QUARTERLY_DIVISOR;

                    // 3. Render Views
                    const m = metrics;
                    renderKpiCards([
                        { title: 'Faturamento Total', current: m.current.fat, history: m.history.avgFat, format: 'currency' },
                        { title: 'Peso Total (Ton)', current: m.current.peso / 1000, history: m.history.avgPeso / 1000, format: 'decimal' },
                        { title: 'Clientes Atendidos', current: m.current.clients, history: m.history.avgClients, format: 'integer' },
                        { title: 'Ticket Médio', current: m.current.clients > 0 ? m.current.fat / m.current.clients : 0, history: m.history.avgClients > 0 ? m.history.avgFat / m.history.avgClients : 0, format: 'currency' },
                        { title: 'Mix por PDV (Pepsico)', current: m.current.mixPepsico, history: m.history.avgMixPepsico, format: 'mix' },
                        { title: 'Mix Salty', current: m.current.positivacaoSalty, history: m.history.avgPositivacaoSalty, format: 'integer' },
                        { title: 'Mix Foods', current: m.current.positivacaoFoods, history: m.history.avgPositivacaoFoods, format: 'integer' },
                        { title: 'Perdas', current: m.current.perdas, history: m.history.avgPerdas, format: 'currency' }
                    ]);

                    // Weekly Chart Logic with Tendency
                    let weeklyCurrentData = [...m.charts.weeklyCurrent];
                    if (useTendencyComparison) {
                        const today = lastSaleDate;
                        const currentWeekIndex = currentMonthWeeks.findIndex(w => today >= w.start && today <= w.end);
                        const totalWeeks = currentMonthWeeks.length;
                        for (let i = 0; i < totalWeeks; i++) {
                            if (i === currentWeekIndex) {
                                const currentWeek = currentMonthWeeks[i];
                                let workingDaysPassed = 0; let totalWorkingDays = 0;
                                for (let d = new Date(currentWeek.start); d <= currentWeek.end; d.setUTCDate(d.getUTCDate() + 1)) {
                                    const dayOfWeek = d.getUTCDay();
                                    if (dayOfWeek >= 1 && dayOfWeek <= 5 && !isHoliday(d, selectedHolidays)) {
                                        totalWorkingDays++;
                                        if (d <= today) workingDaysPassed++;
                                    }
                                }
                                const salesSoFar = weeklyCurrentData[i];
                                if (workingDaysPassed > 0 && totalWorkingDays > 0) {
                                    weeklyCurrentData[i] = (salesSoFar / workingDaysPassed) * totalWorkingDays;
                                } else {
                                    weeklyCurrentData[i] = m.charts.weeklyHistory[i] || 0;
                                }
                            } else if (i > currentWeekIndex) {
                                weeklyCurrentData[i] = m.charts.weeklyHistory[i] || 0;
                            }
                        }
                    }

                    // Render Charts logic (Reusing existing drawing code)
                    if (comparisonChartType === 'weekly') {
                        monthlyComparisonChartContainer.classList.add('hidden');
                        weeklyComparisonChartContainer.classList.remove('hidden');
                        comparisonChartTitle.textContent = 'Comparativo de Faturamento Semanal';
                        const weekLabels = currentMonthWeeks.map((w, i) => `Semana ${i + 1}`);

                        // Destroy Legacy Chart if exists
                        if (charts['weeklyComparisonChart']) {
                            charts['weeklyComparisonChart'].destroy();
                            delete charts['weeklyComparisonChart'];
                        }

                        renderWeeklyComparisonAmChart(weekLabels, weeklyCurrentData, m.charts.weeklyHistory, useTendencyComparison);
                    } else if (comparisonChartType === 'monthly') {
                        weeklyComparisonChartContainer.classList.add('hidden');
                        monthlyComparisonChartContainer.classList.remove('hidden');
                        const metricToggle = document.getElementById('comparison-monthly-metric-container');
                        if (metricToggle) metricToggle.classList.remove('hidden');
                        const isFat = comparisonMonthlyMetric === 'faturamento';
                        comparisonChartTitle.textContent = isFat ? 'Comparativo de Faturamento Mensal' : 'Comparativo de Clientes Atendidos Mensal';
                        const monthLabels = m.charts.monthlyData.map(d => d.label);
                        const monthValues = m.charts.monthlyData.map(d => isFat ? d.fat : d.clients);
                        let currentMonthLabel = 'Mês Atual';
                        if (currentSales.length > 0) {
                            const firstSaleDate = parseDate(currentSales[0].DTPED) || new Date();
                            currentMonthLabel = firstSaleDate.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
                        }
                        let currentVal = isFat ? m.current.fat : m.current.clients;
                        if (isFat && useTendencyComparison) {
                            const totalDays = getWorkingDaysInMonth(currentYear, currentMonth, selectedHolidays);
                            const passedDays = getPassedWorkingDaysInMonth(currentYear, currentMonth, selectedHolidays, lastSaleDate);
                            if (totalDays > 0 && passedDays > 0) { currentVal = (currentVal / passedDays) * totalDays; }
                        }
                        monthLabels.push(currentMonthLabel);
                        monthValues.push(currentVal);
                        // Destroy Legacy Chart if exists
                        if (charts['monthlyComparisonChart']) {
                            charts['monthlyComparisonChart'].destroy();
                            delete charts['monthlyComparisonChart'];
                        }

                        renderMonthlyComparisonAmChart(
                            monthLabels,
                            monthValues,
                            isFat ? 'Faturamento' : 'Clientes Atendidos',
                            isFat ? 0x3b82f6 : 0x10b981
                        );
                    } else if (comparisonChartType === 'daily') {
                        weeklyComparisonChartContainer.classList.remove('hidden');
                        monthlyComparisonChartContainer.classList.add('hidden');
                        comparisonChartTitle.textContent = 'Comparativo de Faturamento Diário';

                        // --- NEW DAILY CHART LOGIC ---

                        // 1. Prepare Current Month Data (Chronological)
                        const daysInMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();
                        const currentDailyTimeline = []; // { dayLabel, value, isWorkingDay, workingDayIndex, dateObj }

                        // We iterate all days to determine the axis
                        for (let d = 1; d <= daysInMonth; d++) {
                            const dateObj = new Date(Date.UTC(currentYear, currentMonth, d));
                            const isWDay = isWorkingDay(dateObj, selectedHolidays);

                            // Check if sales exist for this specific day
                            // We can check metrics.charts.weeklyCurrent but that's aggregated.
                            // We need per-day sales. We calculated m.currentDayTotals (aggregated by weekday), not by date.
                            // Let's re-scan currentSales for daily totals (or we could have done it in the main loop).
                            // Optimization: Do it in main loop or here? Main loop didn't store by date.
                            // Since we have currentSales available, let's filter/reduce efficiently or use a map.

                            // Let's build a map for current month sales by Day (1-31)
                            // Ideally this should be in the main loop, but refactoring that is risky.
                            // We can do a quick pass here.
                        }

                        const currentSalesByDay = new Array(daysInMonth + 1).fill(0);
                        currentSales.forEach(s => {
                            if (!isAlternativeMode(selectedComparisonTiposVenda) && s.TIPOVENDA !== '1' && s.TIPOVENDA !== '9') return;
                            const d = parseDate(s.DTPED);
                            if (d && d.getUTCMonth() === currentMonth && d.getUTCFullYear() === currentYear) {
                                currentSalesByDay[d.getUTCDate()] += getValueForSale(s, selectedComparisonTiposVenda);
                            }
                        });

                        // 2. Prepare History Averages by Working Day Index
                        // We need average for 1st WD, 2nd WD, etc.
                        const historyWorkingDaySums = new Map(); // Index -> Sum
                        const historyWorkingDayCounts = new Map(); // Index -> Count of Months contributing

                        // Also need M-1 (Previous Month) data specifically for Overflow logic
                        const prevMonthDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
                        const prevMonthIndex = prevMonthDate.getUTCMonth();
                        const prevMonthYear = prevMonthDate.getUTCFullYear();
                        const prevMonthSalesByWDIndex = new Map(); // WDIndex -> Value
                        let prevMonthMaxWDIndex = 0;

                        // Process History Sales again? Or use the existing loop data?
                        // Existing loop aggregated to `metrics.history.fat` etc. but not granular enough.
                        // We need to re-scan historySales.

                        // Scan History
                        const historySalesByMonthDay = new Map(); // "YYYY-MM-DD" -> Value
                        historySales.forEach(s => {
                            if (!isAlternativeMode(selectedComparisonTiposVenda) && s.TIPOVENDA !== '1' && s.TIPOVENDA !== '9') return;
                            const d = parseDate(s.DTPED);
                            if (d) {
                                const key = d.toISOString().split('T')[0];
                                const val = getValueForSale(s, selectedComparisonTiposVenda);
                                historySalesByMonthDay.set(key, (historySalesByMonthDay.get(key) || 0) + val);
                            }
                        });

                        // Now iterate months in history (last 3) to map to Working Day Indices
                        // Identify unique months in history
                        const uniqueMonths = new Set();
                        historySalesByMonthDay.forEach((v, k) => uniqueMonths.add(k.substring(0, 7)));

                        uniqueMonths.forEach(mKey => {
                            const [yStr, mStr] = mKey.split('-');
                            const y = parseInt(yStr);
                            const m = parseInt(mStr) - 1; // 0-indexed

                            const isPrevMonth = (y === prevMonthYear && m === prevMonthIndex);

                            const daysInM = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
                            let wdIndex = 0;

                            for (let d = 1; d <= daysInM; d++) {
                                const dateObj = new Date(Date.UTC(y, m, d));
                                if (isWorkingDay(dateObj, selectedHolidays)) {
                                    wdIndex++;
                                    const val = historySalesByMonthDay.get(dateObj.toISOString().split('T')[0]) || 0;

                                    historyWorkingDaySums.set(wdIndex, (historyWorkingDaySums.get(wdIndex) || 0) + val);
                                    historyWorkingDayCounts.set(wdIndex, (historyWorkingDayCounts.get(wdIndex) || 0) + 1);

                                    if (isPrevMonth) {
                                        prevMonthSalesByWDIndex.set(wdIndex, val);
                                        prevMonthMaxWDIndex = Math.max(prevMonthMaxWDIndex, wdIndex);
                                    }
                                }
                            }
                        });

                        // 3. Construct Axis and Datasets
                        let currentWDCounter = 0;
                        const labels = [];
                        const currentData = [];
                        const historyData = [];

                        for (let d = 1; d <= daysInMonth; d++) {
                            const dateObj = new Date(Date.UTC(currentYear, currentMonth, d));
                            const isWDay = isWorkingDay(dateObj, selectedHolidays);
                            const val = currentSalesByDay[d];
                            const hasSales = val > 0;

                            if (isWDay) {
                                currentWDCounter++;
                            }

                            // Rule: Show if Working Day OR Has Sales
                            // Note: "começar no primeiro dia útil". We enforce this by filtering?
                            // User said: "esse 'diário' irá começar no primeiro dia útil do mês".
                            // But also "caso tenha venda em algum dia que não seja um dia útil, esse dia deve aparecer".
                            // If day 1 is Sat (non-working) and has sales, it appears.
                            // If day 1 is Sat (non-working) and NO sales, it is skipped.
                            // If day 1 is Mon (working), it appears.

                            // What if Day 1/2 are weekends without sales? They are skipped.
                            // The chart naturally starts at the first added point.

                            if (isWDay || hasSales) {
                                labels.push(d.toString());
                                currentData.push(val);

                                // History Value Logic
                                if (isWDay) {
                                    // It is the Nth working day. Get average.
                                    let avg = 0;
                                    if (historyWorkingDayCounts.has(currentWDCounter)) {
                                        avg = historyWorkingDaySums.get(currentWDCounter) / historyWorkingDayCounts.get(currentWDCounter);
                                    } else {
                                        // OVERFLOW LOGIC
                                        // "repetir o valor feito nos últimos dias uteis do mês anterior"
                                        // Calculate offset from max available in M-1
                                        // If M-1 had 20 days. We are at 21.
                                        // We want 19th of M-1? User said: "no caso seria o dia 19º e dia 20º útil." for 2 extra days.
                                        // It implies using the tail of M-1.
                                        // Let's assume we map backwards from end.

                                        if (prevMonthMaxWDIndex > 0) {
                                            const overflowAmount = currentWDCounter - prevMonthMaxWDIndex;
                                            // If overflow is 1 (21st day, max 20), we want 19th? (Max - 1)
                                            // If overflow is 2 (22nd day, max 20), we want 20th? (Max)
                                            // Wait, the example: "o mês atual tem 22... a 'média' para esses dois dias será na verdade o que foi realizado nos últimos dois dias uteis do mês anterior"
                                            // Days 21 and 22.
                                            // "últimos dois dias uteis": 19 and 20.
                                            // So 21 -> 19, 22 -> 20.
                                            // Formula: targetIndex = PrevMax - (TotalOverflow - CurrentOverflowIndex) ?? No.
                                            // Let TotalCurrentWD = estimated total? No we are iterating.

                                            // Simpler Interpretation:
                                            // Just repeat the last few values?
                                            // Let's look at the mapping:
                                            // 21 -> 19
                                            // 22 -> 20
                                            // It seems we map the overflow window [21, 22] to [19, 20].
                                            // This is `Index - 2`. Where 2 is the difference?
                                            // Or is it dynamic based on how many extra days?
                                            // "se acontecer de o mês atual ter mais dias uteis... iremos repetir o valor feito nos últimos dias uteis"

                                            // Implementation Strategy:
                                            // We don't know total days yet in the loop. But we know `currentWDCounter`.
                                            // We assume the overflowing days are contiguous at the end.
                                            // BUT we are processing day by day.
                                            // If we are at index 21, and max was 20.
                                            // We need to look back.
                                            // Maybe just use `PrevMax - 1` for odd overflow and `PrevMax` for even? No.

                                            // Let's try to map strictly to the *end* of the previous series.
                                            // But we don't know how many *more* days we will have total.
                                            // Actually we do: `getWorkingDaysInMonth` for current month.
                                            const totalCurrentWorkingDays = getWorkingDaysInMonth(currentYear, currentMonth, selectedHolidays);
                                            const overflowCount = totalCurrentWorkingDays - prevMonthMaxWDIndex;

                                            if (overflowCount > 0) {
                                                // We are in the overflow zone?
                                                // Only if currentWDCounter > prevMonthMaxWDIndex.
                                                // Map index:
                                                // We want to map range [PrevMax+1 ... TotalCurr] -> [PrevMax - OverflowCount + 1 ... PrevMax]
                                                // Let's check example:
                                                // PrevMax=20. TotalCurr=22. Overflow=2.
                                                // Range [21, 22] -> [19, 20].
                                                // 21 -> 20 - 2 + (21 - 20) = 18 + 1 = 19. Correct.
                                                // 22 -> 20 - 2 + (22 - 20) = 18 + 2 = 20. Correct.

                                                const mappedIndex = prevMonthMaxWDIndex - overflowCount + (currentWDCounter - prevMonthMaxWDIndex);

                                                if (mappedIndex > 0) {
                                                    // Use M-1 value
                                                    avg = prevMonthSalesByWDIndex.get(mappedIndex) || 0;
                                                }
                                            }
                                        }
                                    }
                                    historyData.push(avg);
                                } else {
                                    // Non-working day (e.g. Saturday with sales)
                                    // Average line should not exist or be 0.
                                    // Setting to null breaks the line in Chart.js/AmCharts usually.
                                    // If we put 0, it dips.
                                    // "o gráfico ainda deve trazer essa linha de média trimestral, que será calculada por dia..."
                                    // I'll put null to imply no goal/average for off-days.
                                    historyData.push(null);
                                }
                            }
                        }

                        // Destroy Legacy Chart if exists
                        if (charts['weeklyComparisonChart']) {
                            charts['weeklyComparisonChart'].destroy();
                            delete charts['weeklyComparisonChart'];
                        }

                        renderWeeklyComparisonAmChart(labels, currentData, historyData, false);
                    }

                    // Daily Chart (Simplified re-calc for now, or could optimize further)
                    const salesByWeekAndDay = {};
                    currentMonthWeeks.forEach((w, i) => { salesByWeekAndDay[i + 1] = new Array(7).fill(0); });
                    currentSales.forEach(s => { const d = parseDate(s.DTPED); if(d) { const wIdx = currentMonthWeeks.findIndex(w => d >= w.start && d <= w.end); if(wIdx !== -1) salesByWeekAndDay[wIdx+1][d.getUTCDay()] += s.VLVENDA; } });
                    if (m.overlapSales && m.overlapSales.length > 0) { m.overlapSales.forEach(s => { const d = parseDate(s.DTPED); if (d) salesByWeekAndDay[1][d.getUTCDay()] += s.VLVENDA; }); }

                    // --- INICIO DA MODIFICAÇÃO: Tendência no Gráfico Diário ---
                    if (useTendencyComparison) {
                        const today = lastSaleDate;
                        const currentWeekIndex = currentMonthWeeks.findIndex(w => today >= w.start && today <= w.end);

                        // 1. Project Current Week
                        if (currentWeekIndex !== -1) {
                            const currentWeek = currentMonthWeeks[currentWeekIndex];
                            let workingDaysPassed = 0; let totalWorkingDays = 0;
                            const remainingDaysIndices = [];

                            for (let d = new Date(currentWeek.start); d <= currentWeek.end; d.setUTCDate(d.getUTCDate() + 1)) {
                                const dayOfWeek = d.getUTCDay();
                                if (dayOfWeek >= 1 && dayOfWeek <= 5 && !isHoliday(d, selectedHolidays)) {
                                    totalWorkingDays++;
                                    if (d <= today) workingDaysPassed++;
                                    else remainingDaysIndices.push(dayOfWeek);
                                }
                            }

                            if (workingDaysPassed > 0 && totalWorkingDays > 0) {
                                const weekData = salesByWeekAndDay[currentWeekIndex + 1];
                                const salesSoFar = weekData.reduce((a, b) => a + b, 0);
                                const projectedWeekTotal = (salesSoFar / workingDaysPassed) * totalWorkingDays;
                                const remainder = projectedWeekTotal - salesSoFar;

                                if (remainder > 0 && remainingDaysIndices.length > 0) {
                                    const weightsForRemaining = remainingDaysIndices.map(d => m.dayWeights[d] || 0);
                                    const totalWeightRemaining = weightsForRemaining.reduce((a, b) => a + b, 0);

                                    remainingDaysIndices.forEach(dayIndex => {
                                        const weight = m.dayWeights[dayIndex] || 0;
                                        // If weights are available, use them. Otherwise distribute evenly.
                                        const share = totalWeightRemaining > 0 ? (weight / totalWeightRemaining) : (1 / remainingDaysIndices.length);
                                        weekData[dayIndex] = remainder * share;
                                    });
                                }
                            }
                        }

                        // 2. Fill Future Weeks with Historical Average (Distributed by Day Weights)
                        const weightsMonFri = [1, 2, 3, 4, 5].map(d => m.dayWeights[d] || 0);
                        const totalWeightMonFri = weightsMonFri.reduce((a, b) => a + b, 0);

                        for (let i = currentWeekIndex + 1; i < currentMonthWeeks.length; i++) {
                            const historicalTotal = m.charts.weeklyHistory[i] || 0;
                            if (historicalTotal > 0) {
                                const weekData = salesByWeekAndDay[i + 1];
                                // Fill Mon(1) to Fri(5)
                                for (let d = 1; d <= 5; d++) {
                                    const weight = m.dayWeights[d] || 0;
                                    const share = totalWeightMonFri > 0 ? (weight / totalWeightMonFri) : (1 / 5);
                                    weekData[d] = historicalTotal * share;
                                }
                            }
                        }
                    }
                    // --- FIM DA MODIFICAÇÃO ---

                    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                    const professionalPalette = ['#a855f7', '#6366f1', '#ec4899', '#f97316', '#8b5cf6', '#06b6d4', '#f59e0b'];
                    const dailyBreakdownDatasets = dayNames.map((dayName, dayIndex) => ({ label: dayName, data: currentMonthWeeks.map((week, weekIndex) => salesByWeekAndDay[weekIndex + 1][dayIndex]), backgroundColor: professionalPalette[dayIndex % professionalPalette.length] }));
                    const weekLabelsForDailyChart = currentMonthWeeks.map((week, index) => { const startDateStr = week.start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }); const endDateStr = week.end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }); return `S${index + 1} (${startDateStr} à ${endDateStr})`; });

                    if (dailyBreakdownDatasets.some(ds => ds.data.some(d => d > 0))) {
                        createChart('dailyWeeklyComparisonChart', 'bar', weekLabelsForDailyChart, dailyBreakdownDatasets, {
                            plugins: {
                                legend: { display: true, position: 'top' },
                                tooltip: {
                                    mode: 'point',
                                    intersect: true,
                                    callbacks: {
                                        label: function(context) {
                                            let label = context.dataset.label || '';
                                            if (label) label += ': ';
                                            if (context.parsed.y !== null) {
                                                label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
                                            }
                                            return label;
                                        },
                                        afterBody: function(context) {
                                            // Calculate Week Total
                                            const weekIndex = context[0].dataIndex; // All items in tooltip share same index (if grouped) or point
                                            // Ensure we are accessing the modified salesByWeekAndDay
                                            const weekData = salesByWeekAndDay[weekIndex + 1];
                                            const total = weekData.reduce((a, b) => a + b, 0);
                                            return '\nSemana: ' + new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);
                                        }
                                    }
                                },
                                datalabels: { display: false }
                            },
                            scales: { x: { stacked: false }, y: { stacked: false, ticks: { callback: (v) => (v / 1000).toFixed(0) + 'k' } } }
                        });
                    } else {
                        showNoDataMessage('dailyWeeklyComparisonChart', 'Sem dados para exibir.');
                    }

                    // Weekly Summary Table (Optimized)
                    const weeklySummaryTableBody = document.getElementById('weeklySummaryTableBody');
                    if (weeklySummaryTableBody) {
                         let grandTotal = 0;
                         const weekKeys = Object.keys(salesByWeekAndDay).sort((a,b) => parseInt(a) - parseInt(b));
                         const rowsHTML = weekKeys.map(weekNum => {
                             const weekTotal = Object.values(salesByWeekAndDay[weekNum]).reduce((a, b) => a + b, 0);
                             grandTotal += weekTotal;
                             return `<tr class="hover:bg-slate-700"><td class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-sm">Semana ${weekNum}</td><td class="px-2 py-2 md:px-4 md:py-2 text-right text-[10px] md:text-sm">${weekTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>`;
                         }).join('');

                         weeklySummaryTableBody.innerHTML = rowsHTML + `<tr class="font-bold bg-slate-700/50"><td class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-sm">Total do Mês</td><td class="px-2 py-2 md:px-4 md:py-2 text-right text-[10px] md:text-sm">${grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>`;
                    }

                    // Supervisor Table
                    const supervisorTableBody = document.getElementById('supervisorComparisonTableBody');
                    const supRows = Object.entries(m.charts.supervisorData).map(([sup, data]) => { const variation = data.history > 0 ? ((data.current - data.history) / data.history) * 100 : (data.current > 0 ? 100 : 0); const colorClass = variation > 0 ? 'text-green-400' : variation < 0 ? 'text-red-400' : 'text-slate-400'; return `<tr class="hover:bg-slate-700"><td class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-sm truncate max-w-[100px]">${sup}</td><td class="px-2 py-2 md:px-4 md:py-2 text-right text-[10px] md:text-sm">${data.history.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td class="px-2 py-2 md:px-4 md:py-2 text-right text-[10px] md:text-sm">${data.current.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td class="px-2 py-2 md:px-4 md:py-2 text-right text-[10px] md:text-sm ${colorClass}">${variation.toFixed(2)}%</td></tr>`; }).join('');
                    supervisorTableBody.innerHTML = supRows;
                }, () => currentRenderId !== comparisonRenderId); // Cancel check
            }, () => currentRenderId !== comparisonRenderId); // Cancel check
        }



        function getInnovationsMonthFilteredData(options = {}) {
            const { excludeFilter = null } = options;

            const city = innovationsMonthCityFilter.value.trim().toLowerCase();
            const filial = innovationsMonthFilialFilter.value;

            let clients = getHierarchyFilteredClients('innovations-month', allClientsData);

            if (filial !== 'ambas') {
                clients = clients.filter(c => clientLastBranch.get(c['Código']) === filial);
            }

            if (excludeFilter !== 'city' && city) {
                clients = clients.filter(c => c.cidade && c.cidade.toLowerCase() === city);
            }

            return { clients };
        }

        function resetInnovationsMonthFilters() {
            innovationsMonthCityFilter.value = '';
            innovationsMonthFilialFilter.value = 'ambas';
            innovationsMonthCategoryFilter.value = '';
            selectedInnovationsMonthTiposVenda = [];

            selectedInnovationsMonthTiposVenda = updateTipoVendaFilter(innovationsMonthTipoVendaFilterDropdown, innovationsMonthTipoVendaFilterText, selectedInnovationsMonthTiposVenda, [...allSalesData, ...allHistoryData]);
            updateInnovationsMonthView();
        }

        function updateInnovationsMonthView() {
            const selectedCategory = innovationsMonthCategoryFilter.value;

            // Initialize Global Categories if not already done (Optimization)
            if (!globalInnovationCategories && innovationsMonthData && innovationsMonthData.length > 0) {
                globalInnovationCategories = {};
                globalProductToCategoryMap = new Map();
                innovationsMonthData.forEach(item => {
                    const categoryName = item.Inovacoes || item.inovacoes || item.INOVACOES;
                    if (!categoryName) return;
                    if (!globalInnovationCategories[categoryName]) {
                        globalInnovationCategories[categoryName] = { productCodes: new Set(), products: [] };
                    }
                    const productCode = String(item.Codigo || item.codigo || item.CODIGO).trim();
                    globalInnovationCategories[categoryName].productCodes.add(productCode);
                    globalInnovationCategories[categoryName].products.push({ ...item, Codigo: productCode, Inovacoes: categoryName });
                    globalProductToCategoryMap.set(productCode, categoryName);
                });
            }

            const categories = globalInnovationCategories || {};
            const currentFilterValue = innovationsMonthCategoryFilter.value;
            const allCategories = Object.keys(categories).sort();

            // Only update dropdown if empty or number of items changed significantly (simplistic check)
            if (innovationsMonthCategoryFilter.options.length <= 1 && allCategories.length > 0) {
                let optionsHtml = '<option value="">Todas as Categorias</option>';
                allCategories.forEach(cat => {
                    optionsHtml += `<option value="${cat}">${cat}</option>`;
                });
                innovationsMonthCategoryFilter.innerHTML = optionsHtml;
                if (allCategories.includes(currentFilterValue)) {
                    innovationsMonthCategoryFilter.value = currentFilterValue;
                }
            }

            const { clients: filteredClients } = getInnovationsMonthFilteredData();


            const activeClients = filteredClients.filter(c => {
                const codcli = c['Código'];
                const rca1 = String(c.rca1 || '').trim();
                if (rca1 === '306' || rca1 === '300') return false;
                const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');
                return (isAmericanas || rca1 !== '53' || clientsWithSalesThisMonth.has(codcli));
            });
            const activeClientsCount = activeClients.length;
            const activeClientCodes = new Set(activeClients.map(c => c['Código']));

            // --- OPTIMIZED AGGREGATION LOGIC ---

            // Determine types to use
            const availableTypes = new Set([...allSalesData.map(s => s.TIPOVENDA), ...allHistoryData.map(s => s.TIPOVENDA)]);
            let currentSelection = selectedInnovationsMonthTiposVenda.length > 0 ? selectedInnovationsMonthTiposVenda : Array.from(availableTypes);
            const currentSelectionKey = currentSelection.slice().sort().join(',');

            // Caching Strategy: Reuse maps if Tipo Venda selection hasn't changed
            let mapsCurrent, mapsPrevious, mapsPrevious2;
            if (viewState.inovacoes.lastTypesKey === currentSelectionKey && viewState.inovacoes.cache) {
                mapsCurrent = viewState.inovacoes.cache.mapsCurrent;
                mapsPrevious = viewState.inovacoes.cache.mapsPrevious;
                mapsPrevious2 = viewState.inovacoes.cache.mapsPrevious2;
            } else {
                const mainTypes = currentSelection.filter(t => t !== '5' && t !== '11');
                const bonusTypes = currentSelection.filter(t => t === '5' || t === '11');

                // Optimized Map Building (2 passes instead of 4)
                mapsCurrent = buildInnovationSalesMaps(allSalesData, mainTypes, bonusTypes);

                // Calculate Date Ranges for T-1 (Prev) and T-2 (Prev-Prev)
                const currentYear = lastSaleDate.getUTCFullYear();
                const currentMonth = lastSaleDate.getUTCMonth();

                // T-1: Previous Month
                const prevMonthStart = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
                const prevMonthEnd = new Date(Date.UTC(currentYear, currentMonth, 1));
                const tsPrevStart = prevMonthStart.getTime();
                const tsPrevEnd = prevMonthEnd.getTime();

                // T-2: Previous Previous Month
                const prev2MonthStart = new Date(Date.UTC(currentYear, currentMonth - 2, 1));
                const prev2MonthEnd = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
                const tsPrev2Start = prev2MonthStart.getTime();
                const tsPrev2End = prev2MonthEnd.getTime();

                // Filter History Data
                const filterHistory = (start, end) => {
                    return allHistoryData.filter(item => {
                        const val = item.DTPED;
                        let ts = 0;
                        if (typeof val === 'number') {
                            if (val < 100000) {
                                 ts = Math.round((val - 25569) * 86400 * 1000);
                            } else {
                                 ts = val;
                            }
                        } else {
                            const d = parseDate(val);
                            if(d) ts = d.getTime();
                        }
                        return ts >= start && ts < end;
                    });
                };

                const previousMonthData = filterHistory(tsPrevStart, tsPrevEnd);
                const previousMonthData2 = filterHistory(tsPrev2Start, tsPrev2End);

                mapsPrevious = buildInnovationSalesMaps(previousMonthData, mainTypes, bonusTypes);
                mapsPrevious2 = buildInnovationSalesMaps(previousMonthData2, mainTypes, bonusTypes);

                viewState.inovacoes.lastTypesKey = currentSelectionKey;
                viewState.inovacoes.cache = { mapsCurrent, mapsPrevious, mapsPrevious2 };
            }

            // Structures to hold results
            // categoryResults[catName] = { current: Set, previous: Set, previous2: Set, ... }
            const categoryResults = {};
            const productResults = {};

            for (const cat in categories) {
                categoryResults[cat] = {
                    current: new Set(),
                    previous: new Set(),
                    previous2: new Set(),
                    bonusCurrent: new Set(),
                    bonusPrevious: new Set(),
                    bonusPrevious2: new Set()
                };
                categories[cat].productCodes.forEach(p => {
                    productResults[p] = { current: new Set(), previous: new Set(), previous2: new Set() };
                });
            }

            // Helper to process maps and populate sets
            const processMap = (salesMap, periodType, isBonus) => {
                // periodType: 'current', 'previous', 'previous2'
                salesMap.forEach((productsMap, codCli) => {
                    // Only count if client is in the filtered active list
                    if (!activeClientCodes.has(codCli)) return;

                    productsMap.forEach((rcas, prodCode) => {
                        const category = globalProductToCategoryMap ? globalProductToCategoryMap.get(prodCode) : null;
                        if (!category) return;

                        // Add to Category Set (Normal or Bonus)
                        if (categoryResults[category]) {
                            const targetSet = isBonus
                                ? (periodType === 'current' ? 'bonusCurrent' : (periodType === 'previous' ? 'bonusPrevious' : 'bonusPrevious2'))
                                : periodType;

                            categoryResults[category][targetSet].add(codCli);
                        }

                        // Add to Product Set (For Top Item Logic)
                        if (productResults[prodCode]) {
                            productResults[prodCode][periodType].add(codCli);
                        }
                    });
                });
            };

            // Process all 6 maps efficiently
            processMap(mapsCurrent.mainMap, 'current', false);
            processMap(mapsCurrent.bonusMap, 'current', true);
            processMap(mapsPrevious.mainMap, 'previous', false);
            processMap(mapsPrevious.bonusMap, 'previous', true);
            processMap(mapsPrevious2.mainMap, 'previous2', false);
            processMap(mapsPrevious2.bonusMap, 'previous2', true);

            // Consolidate Results
            const categoryAnalysis = {};
            let topCoverageItem = { name: '-', coverage: 0, clients: 0 };

            if (selectedCategory && categories[selectedCategory]) {
                categories[selectedCategory].products.forEach(product => {
                    const pCode = String(product.Codigo).trim();
                    if (productResults[pCode]) {
                        const count = productResults[pCode].current.size;
                        const coverage = activeClientsCount > 0 ? (count / activeClientsCount) * 100 : 0;
                        if (coverage > topCoverageItem.coverage) {
                            topCoverageItem = { name: `(${pCode}) ${product.produto || product.Produto}`, coverage, clients: count };
                        }
                    }
                });
            } else {
                // Top Category Logic
                for (const cat in categoryResults) {
                    const unionSet = new Set([...categoryResults[cat].current, ...categoryResults[cat].bonusCurrent]);
                    const count = unionSet.size;
                    const coverage = activeClientsCount > 0 ? (count / activeClientsCount) * 100 : 0;

                    if (coverage > topCoverageItem.coverage) {
                        topCoverageItem = { name: cat, coverage, clients: count };
                    }
                }
            }

            // Calculate Global KPIs (Union of all categories selected)
            const clientsWhoGotAnyVisibleProductCurrent = new Set();
            const clientsWhoGotAnyVisibleProductPrevious = new Set();
            const clientsWhoGotBonusAnyVisibleProductCurrent = new Set();
            const clientsWhoGotBonusAnyVisibleProductPrevious = new Set();

            for (const cat in categoryResults) {
                if (selectedCategory && cat !== selectedCategory) continue;

                // Merge sets into global KPI sets (KPIs only track T vs T-1 for now, but we have T-2 data available)
                categoryResults[cat].current.forEach(c => clientsWhoGotAnyVisibleProductCurrent.add(c));
                categoryResults[cat].previous.forEach(c => clientsWhoGotAnyVisibleProductPrevious.add(c));
                categoryResults[cat].bonusCurrent.forEach(c => clientsWhoGotBonusAnyVisibleProductCurrent.add(c));
                categoryResults[cat].bonusPrevious.forEach(c => clientsWhoGotBonusAnyVisibleProductPrevious.add(c));

                // Prepare Analysis Object for Chart/Table
                const currentUnion = new Set([...categoryResults[cat].current, ...categoryResults[cat].bonusCurrent]);
                const previousUnion = new Set([...categoryResults[cat].previous, ...categoryResults[cat].bonusPrevious]);
                const previous2Union = new Set([...categoryResults[cat].previous2, ...categoryResults[cat].bonusPrevious2]);

                const countCurr = currentUnion.size;
                const countPrev = previousUnion.size;
                const countPrev2 = previous2Union.size;

                const covCurr = activeClientsCount > 0 ? (countCurr / activeClientsCount) * 100 : 0;
                const covPrev = activeClientsCount > 0 ? (countPrev / activeClientsCount) * 100 : 0;
                const covPrev2 = activeClientsCount > 0 ? (countPrev2 / activeClientsCount) * 100 : 0;

                const varPct = covPrev > 0 ? ((covCurr - covPrev) / covPrev) * 100 : (covCurr > 0 ? Infinity : 0);

                categoryAnalysis[cat] = {
                    coverageCurrent: covCurr,
                    coveragePrevious: covPrev,
                    coveragePrevious2: covPrev2,
                    variation: varPct,
                    clientsCount: countCurr,
                    clientsPreviousCount: countPrev
                };
            }

            // Total KPI calculations (Union of Sets)
            // Note: Original code did:
            // clientsWhoGotAnyVisibleProductCurrent -> Sales
            // clientsWhoGotBonusAnyVisibleProductCurrent -> Bonus
            // It kept them separate for the KPI cards at the top.
            // "Innovations Month Selection Coverage" -> Sales
            // "Innovations Month Bonus Coverage" -> Bonus

            const selectionCoveredCountCurrent = clientsWhoGotAnyVisibleProductCurrent.size;
            const selectionCoveragePercentCurrent = activeClientsCount > 0 ? (selectionCoveredCountCurrent / activeClientsCount) * 100 : 0;
            const selectionCoveredCountPrevious = clientsWhoGotAnyVisibleProductPrevious.size;
            const selectionCoveragePercentPrevious = activeClientsCount > 0 ? (selectionCoveredCountPrevious / activeClientsCount) * 100 : 0;

            const bonusCoveredCountCurrent = clientsWhoGotBonusAnyVisibleProductCurrent.size;
            const bonusCoveragePercentCurrent = activeClientsCount > 0 ? (bonusCoveredCountCurrent / activeClientsCount) * 100 : 0;
            const bonusCoveredCountPrevious = clientsWhoGotBonusAnyVisibleProductPrevious.size;
            const bonusCoveragePercentPrevious = activeClientsCount > 0 ? (bonusCoveredCountPrevious / activeClientsCount) * 100 : 0;

            // Update DOM
            innovationsMonthActiveClientsKpi.textContent = activeClientsCount.toLocaleString('pt-BR');
            innovationsMonthTopCoverageValueKpi.textContent = `${topCoverageItem.coverage.toFixed(2)}%`;
            innovationsMonthTopCoverageKpi.textContent = topCoverageItem.name;
            innovationsMonthTopCoverageKpi.title = topCoverageItem.name;
            innovationsMonthTopCoverageCountKpi.textContent = `${topCoverageItem.clients.toLocaleString('pt-BR')} PDVs`;
            document.getElementById('innovations-month-top-coverage-title').textContent = selectedCategory ? 'Produto Maior Cobertura' : 'Categ. Maior Cobertura';

            innovationsMonthSelectionCoverageValueKpi.textContent = `${selectionCoveragePercentCurrent.toFixed(2)}%`;
            innovationsMonthSelectionCoverageCountKpi.textContent = `${selectionCoveredCountCurrent.toLocaleString('pt-BR')} de ${activeClientsCount.toLocaleString('pt-BR')}`;
            innovationsMonthSelectionCoverageValueKpiPrevious.textContent = `${selectionCoveragePercentPrevious.toFixed(2)}%`;
            innovationsMonthSelectionCoverageCountKpiPrevious.textContent = `${selectionCoveredCountPrevious.toLocaleString('pt-BR')} de ${activeClientsCount.toLocaleString('pt-BR')} clientes`;

            innovationsMonthBonusCoverageValueKpi.textContent = `${bonusCoveragePercentCurrent.toFixed(2)}%`;
            innovationsMonthBonusCoverageCountKpi.textContent = `${bonusCoveredCountCurrent.toLocaleString('pt-BR')} de ${activeClientsCount.toLocaleString('pt-BR')} clientes`;
            innovationsMonthBonusCoverageValueKpiPrevious.textContent = `${bonusCoveragePercentPrevious.toFixed(2)}%`;
            innovationsMonthBonusCoverageCountKpiPrevious.textContent = `${bonusCoveredCountPrevious.toLocaleString('pt-BR')} de ${activeClientsCount.toLocaleString('pt-BR')} clientes`;

            // Prepare Data for Chart and Table
            chartLabels = Object.keys(categoryAnalysis).sort((a,b) => categoryAnalysis[b].coverageCurrent - categoryAnalysis[a].coverageCurrent);
            const tableData = [];
            const activeStockMap = getActiveStockMap(innovationsMonthFilialFilter.value);

            chartLabels.forEach(categoryName => {
                const categoryData = categories[categoryName];

                categoryData.products.forEach((product) => {
                    const productCode = product.Codigo;
                    const productName = product.produto || product.Produto;
                    const stock = activeStockMap.get(productCode) || 0;

                    // Re-calculate per product using the Product Results Sets
                    const pRes = productResults[productCode];

                    const clientsCurrentCount = pRes ? pRes.current.size : 0;
                    const clientsPreviousCount = pRes ? pRes.previous.size : 0;

                    const coverageCurrent = activeClientsCount > 0 ? (clientsCurrentCount / activeClientsCount) * 100 : 0;
                    const coveragePrevious = activeClientsCount > 0 ? (clientsPreviousCount / activeClientsCount) * 100 : 0;
                    const variation = coveragePrevious > 0 ? ((coverageCurrent - coveragePrevious) / coveragePrevious) * 100 : (coverageCurrent > 0 ? Infinity : 0);

                    tableData.push({
                        categoryName,
                        productCode,
                        productName,
                        stock,
                        coveragePrevious,
                        clientsPreviousCount,
                        coverageCurrent,
                        clientsCurrentCount,
                        variation
                    });
                });
            });

            tableData.sort((a,b) => b.coverageCurrent - a.coverageCurrent);
            innovationsMonthTableDataForExport = tableData;

            // --- Grouping Logic for Expandable Table ---
            const groupedTableData = {};
            tableData.forEach(item => {
                const cat = item.categoryName;
                if (!groupedTableData[cat]) {
                    groupedTableData[cat] = {
                        name: cat,
                        stock: 0,
                        items: [],
                        metrics: categoryAnalysis[cat] || { coverageCurrent: 0, coveragePrevious: 0, variation: 0, clientsCount: 0, clientsPreviousCount: 0 }
                    };
                }
                groupedTableData[cat].items.push(item);
                groupedTableData[cat].stock += item.stock;
            });

            const sortedCategories = Object.values(groupedTableData).sort((a, b) => b.metrics.coverageCurrent - a.metrics.coverageCurrent);

            // Render Table with Expandable Rows
            innovationsMonthTableBody.innerHTML = sortedCategories.map((catGroup, index) => {
                const catId = `cat-group-${index}`;

                let variationContent;
                if (isFinite(catGroup.metrics.variation)) {
                    const colorClass = catGroup.metrics.variation >= 0 ? 'text-green-400' : 'text-red-400';
                    variationContent = `<span class="${colorClass}">${catGroup.metrics.variation.toFixed(1)}%</span>`;
                } else if (catGroup.metrics.coverageCurrent > 0) {
                    variationContent = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/30 text-purple-300">Novo</span>`;
                } else {
                    variationContent = `<span>-</span>`;
                }

                // Spacer Row (between categories)
                const spacerRow = index > 0 ? `<tr class="h-2 bg-transparent border-none pointer-events-none"><td colspan="6"></td></tr>` : '';

                const catRow = `
                    ${spacerRow}
                    <tr class="glass-panel-heavy hover:bg-slate-700 cursor-pointer transition-colors border border-slate-700 rounded-lg group" data-toggle="${catId}">
                        <td class="px-3 py-3 text-xs font-bold text-white flex items-center gap-2">
                            <svg class="w-4 h-4 transform transition-transform text-slate-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                            <span class="uppercase tracking-wide">${catGroup.name}</span>
                        </td>
                        <td class="px-2 py-3 text-xs text-slate-400 text-left italic hidden md:table-cell">${catGroup.items.length} Produtos</td>
                        <td class="px-2 py-3 text-sm text-center font-mono font-bold text-blue-400 hidden md:table-cell">${catGroup.stock.toLocaleString('pt-BR')}</td>
                        <td class="px-2 py-3 text-xs text-center">
                            <div class="tooltip">${catGroup.metrics.coveragePrevious.toFixed(2)}%<span class="tooltip-text">${catGroup.metrics.clientsPreviousCount} PDVs</span></div>
                        </td>
                        <td class="px-2 py-3 text-xs text-center">
                            <div class="tooltip font-bold text-white">${catGroup.metrics.coverageCurrent.toFixed(2)}%<span class="tooltip-text">${catGroup.metrics.clientsCount} PDVs</span></div>
                        </td>
                        <td class="px-2 py-3 text-xs text-center font-bold">${variationContent}</td>
                    </tr>
                `;

                const productRows = catGroup.items.map((item, pIdx) => {
                    let prodVarContent;
                    if (isFinite(item.variation)) {
                        const colorClass = item.variation >= 0 ? 'text-green-400' : 'text-red-400';
                        prodVarContent = `<span class="${colorClass}">${item.variation.toFixed(1)}%</span>`;
                    } else if (item.coverageCurrent > 0) {
                        prodVarContent = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/30 text-purple-300">Novo</span>`;
                    } else {
                        prodVarContent = `<span>-</span>`;
                    }

                    const isLast = pIdx === catGroup.items.length - 1;
                    const borderClass = isLast ? 'border-b border-slate-700' : 'border-b border-white/10/50';

                    return `
                    <tr class="hidden bg-slate-900/50 hover:bg-glass ${borderClass} border-l border-r border-slate-700" data-parent="${catId}">
                        <td class="hidden md:table-cell"></td> <!-- Spacer for indentation on desktop -->
                        <td class="px-2 py-2 text-[10px] md:text-xs flex items-center">
                             <div class="w-1.5 h-1.5 rounded-full bg-slate-600 mr-2 md:hidden"></div> <!-- Mobile bullet -->
                             <div class="truncate max-w-[200px] md:max-w-none text-slate-300" title="${item.productName}">
                                <span class="font-mono text-slate-500 mr-1 text-[9px] md:text-[10px]">${item.productCode}</span> ${item.productName}
                             </div>
                        </td>
                        <td class="px-2 py-2 text-xs md:text-sm text-center font-mono text-slate-400 hidden md:table-cell">${item.stock.toLocaleString('pt-BR')}</td>
                        <td class="px-2 py-2 text-[10px] md:text-xs text-center text-slate-500">
                            <div class="tooltip">${item.coveragePrevious.toFixed(2)}%<span class="tooltip-text">${item.clientsPreviousCount} PDVs</span></div>
                        </td>
                        <td class="px-2 py-2 text-[10px] md:text-xs text-center text-slate-300">
                            <div class="tooltip">${item.coverageCurrent.toFixed(2)}%<span class="tooltip-text">${item.clientsCurrentCount} PDVs</span></div>
                        </td>
                        <td class="px-2 py-2 text-[10px] md:text-xs text-center">${prodVarContent}</td>
                    </tr>
                    `;
                }).join('');

                return catRow + productRows;
            }).join('');

            // Expand/Collapse Listener (Idempotent)
            if (!innovationsMonthTableBody._hasToggleListener) {
                innovationsMonthTableBody.addEventListener('click', (e) => {
                    const toggleRow = e.target.closest('tr[data-toggle]');
                    if (toggleRow) {
                        const catId = toggleRow.getAttribute('data-toggle');
                        const icon = toggleRow.querySelector('svg');
                        const children = innovationsMonthTableBody.querySelectorAll(`tr[data-parent="${catId}"]`);

                        if (icon) icon.classList.toggle('rotate-90');
                        children.forEach(row => row.classList.toggle('hidden'));
                    }
                });
                innovationsMonthTableBody._hasToggleListener = true;
            }

            // Dynamic Labels
            const monthNames = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
            const currentMonthIdx = lastSaleDate.getUTCMonth();
            const labelT = monthNames[currentMonthIdx];
            const labelT1 = monthNames[(currentMonthIdx - 1 + 12) % 12];
            const labelT2 = monthNames[(currentMonthIdx - 2 + 12) % 12];

            // Chart Update (Bar Chart Replacement - 3 Columns)
            const chartDataCurrent = chartLabels.map(cat => categoryAnalysis[cat].coverageCurrent);
            const chartDataPrevious = chartLabels.map(cat => categoryAnalysis[cat].coveragePrevious);
            const chartDataPrevious2 = chartLabels.map(cat => categoryAnalysis[cat].coveragePrevious2);

            if (chartLabels.length > 0) {
                createChart('innovations-month-chart', 'bar', chartLabels, [
                    { label: labelT2, data: chartDataPrevious2, backgroundColor: '#3b82f6' }, // Blue
                    { label: labelT1, data: chartDataPrevious, backgroundColor: '#eab308' }, // Dark Mustard
                    { label: labelT, data: chartDataCurrent, backgroundColor: '#06b6d4' }   // Cyan
                ], {
                    plugins: {
                        legend: { display: true, position: 'top' },
                        datalabels: {
                            anchor: 'end',
                            align: 'top',
                            offset: 8,
                            formatter: (value) => value > 0 ? value.toFixed(1) + '%' : '',
                            color: '#cbd5e1',
                            font: { size: 10 }
                        },
                         tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    if (context.parsed.y !== null) label += context.parsed.y.toFixed(2) + '%';
                                    return label;
                                }
                            }
                        }
                    },
                    scales: { y: { ticks: { callback: (v) => `${v}%` } } },
                    layout: { padding: { top: 20 } }
                });
            } else {
                showNoDataMessage('innovations-month-chart', 'Sem dados de inovações para exibir com os filtros atuais.');
            }

            // Innovations by Client Table
            const innovationsByClientTableHead = document.getElementById('innovations-by-client-table-head');
            const innovationsByClientTableBody = document.getElementById('innovations-by-client-table-body');
            const innovationsByClientLegend = document.getElementById('innovations-by-client-legend');

            categoryLegendForExport = chartLabels.map((name, index) => `${index + 1} - ${name}`);
            if (innovationsByClientLegend) innovationsByClientLegend.innerHTML = `<strong>Legenda:</strong> ${categoryLegendForExport.join('; ')}`;

            let tableHeadHTML = `
                <tr>
                    <th class="px-2 py-2 text-left">Código</th>
                    <th class="px-2 py-2 text-left">Cliente</th>
                    <th class="px-2 py-2 text-left">Cidade</th>
                    <th class="px-2 py-2 text-left">Bairro</th>
                    <th class="px-2 py-2 text-center">Últ. Compra</th>
            `;
            chartLabels.forEach((name, index) => {
                tableHeadHTML += `<th class="px-2 py-2 text-center">${index + 1}</th>`;
            });
            tableHeadHTML += `</tr>`;
            if (innovationsByClientTableHead) innovationsByClientTableHead.innerHTML = tableHeadHTML;

            // Build Client Status List
            // Optimized: Iterate Active Clients and check sets in categoryResults
            const clientInnovationStatus = activeClients.map(client => {
                const codcli = client['Código'];
                const status = {};

                chartLabels.forEach(catName => {
                    // Check if client exists in Main OR Bonus sets for this category
                    const inMain = categoryResults[catName].current.has(codcli);
                    const inBonus = categoryResults[catName].bonusCurrent.has(codcli);
                    status[catName] = inMain || inBonus;
                });

                // Explicit copy for robustness against Proxies
                return {
                    'Código': client['Código'],
                    fantasia: client.fantasia,
                    razaoSocial: client.razaoSocial,
                    cidade: client.cidade,
                    bairro: client.bairro,
                    ultimaCompra: client.ultimaCompra,
                    innovationStatus: status
                };
            });

            clientInnovationStatus.sort((a, b) => {
                const cidadeA = a.cidade || '';
                const cidadeB = b.cidade || '';
                const bairroA = a.bairro || '';
                const bairroB = b.bairro || '';
                if (cidadeA.localeCompare(cidadeB) !== 0) return cidadeA.localeCompare(cidadeB);
                return bairroA.localeCompare(bairroB);
            });

            innovationsByClientForExport = clientInnovationStatus;

            // Pagination for Innovations Client Table
            const itemsPerPage = 100;
            const totalPages = Math.ceil(clientInnovationStatus.length / itemsPerPage);
            let currentPage = 1;

            const renderInnovationsPage = (page) => {
                const startIndex = (page - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const pageData = clientInnovationStatus.slice(startIndex, endIndex);

                const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-400 mx-auto" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
                const xIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-400 mx-auto" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>`;

                let tableBodyHTML = '';
                pageData.forEach(client => {
                    tableBodyHTML += `
                        <tr class="hover:bg-slate-700/50">
                            <td class="px-2 py-1.5 text-xs">${client['Código']}</td>
                            <td class="px-2 py-1.5 text-xs">${client.fantasia || client.razaoSocial}</td>
                            <td class="px-2 py-1.5 text-xs">${client.cidade}</td>
                            <td class="px-2 py-1.5 text-xs">${client.bairro}</td>
                            <td class="px-2 py-1.5 text-xs text-center">${formatDate(client.ultimaCompra)}</td>
                    `;
                    chartLabels.forEach(catName => {
                        tableBodyHTML += `<td class="px-2 py-1.5 text-center">${client.innovationStatus[catName] ? checkIcon : xIcon}</td>`;
                    });
                    tableBodyHTML += `</tr>`;
                });
                if (innovationsByClientTableBody) innovationsByClientTableBody.innerHTML = tableBodyHTML;

                // Update Pagination Controls
                const prevBtn = document.getElementById('innovations-prev-page-btn');
                const nextBtn = document.getElementById('innovations-next-page-btn');
                const infoText = document.getElementById('innovations-page-info-text');
                const controls = document.getElementById('innovations-pagination-controls');

                if (controls) {
                    if (totalPages > 1) {
                        controls.classList.remove('hidden');
                        infoText.textContent = `Página ${page} de ${totalPages} (${clientInnovationStatus.length} clientes)`;
                        prevBtn.disabled = page === 1;
                        nextBtn.disabled = page === totalPages;

                        // Clone and replace buttons to remove old event listeners
                        const newPrevBtn = prevBtn.cloneNode(true);
                        const newNextBtn = nextBtn.cloneNode(true);
                        prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
                        nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);

                        newPrevBtn.addEventListener('click', () => {
                            if (currentPage > 1) {
                                currentPage--;
                                renderInnovationsPage(currentPage);
                            }
                        });
                        newNextBtn.addEventListener('click', () => {
                            if (currentPage < totalPages) {
                                currentPage++;
                                renderInnovationsPage(currentPage);
                            }
                        });

                    } else {
                        controls.classList.add('hidden');
                    }
                }
            };

            renderInnovationsPage(1);
        }

        async function exportInnovationsMonthPDF() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape');

            const coord = document.getElementById('innovations-month-coord-filter-text')?.textContent || 'Todos';
            const cocoord = document.getElementById('innovations-month-cocoord-filter-text')?.textContent || 'Todos';
            const promotor = document.getElementById('innovations-month-promotor-filter-text')?.textContent || 'Todos';
            const filial = innovationsMonthFilialFilter.options[innovationsMonthFilialFilter.selectedIndex].text;
            const cidade = innovationsMonthCityFilter.value.trim();
            const categoria = innovationsMonthCategoryFilter.value || 'Todas';
            const generationDate = new Date().toLocaleString('pt-BR');

            doc.setFontSize(18);
            doc.text('Relatório de Inovações do Mês', 14, 22);
            doc.setFontSize(10);
            doc.setTextColor(10);
            doc.text(`Data de Emissão: ${generationDate}`, 14, 30);

            let filterText = `Filtros Aplicados: Coordenador: ${coord} | Co-Coordenador: ${cocoord} | Promotor: ${promotor} | Filial: ${filial} | Cidade: ${cidade || 'Todas'} | Categoria: ${categoria}`;
            const splitFilters = doc.splitTextToSize(filterText, 270);
            doc.text(splitFilters, 14, 36);

            const chartCanvas = document.getElementById('innovations-month-chart');
            if (chartCanvas && charts['innovations-month-chart'] && chartLabels.length > 0) {
                try {
                    const chartInstance = charts['innovations-month-chart'];
                    const originalDatalabelsColor = chartInstance.options.plugins.datalabels.color;
                    const originalXColor = chartInstance.options.scales.x.ticks.color;
                    const originalYColor = chartInstance.options.scales.y.ticks.color;
                    const originalLegendColor = chartInstance.options.plugins.legend?.labels?.color;

                    chartInstance.options.plugins.datalabels.color = '#000000';
                    chartInstance.options.scales.x.ticks.color = '#000000';
                    chartInstance.options.scales.y.ticks.color = '#000000';
                    if (chartInstance.options.plugins.legend && chartInstance.options.plugins.legend.labels) {
                        chartInstance.options.plugins.legend.labels.color = '#000000';
                    }

                    chartInstance.update('none');

                    const chartImage = chartCanvas.toDataURL('image/png', 1.0);
                    doc.addImage(chartImage, 'PNG', 14, 50, 270, 100);

                    chartInstance.options.plugins.datalabels.color = originalDatalabelsColor;
                    chartInstance.options.scales.x.ticks.color = originalXColor;
                    chartInstance.options.scales.y.ticks.color = originalYColor;
                    if (chartInstance.options.plugins.legend && chartInstance.options.plugins.legend.labels) {
                        chartInstance.options.plugins.legend.labels.color = originalLegendColor;
                    }
                    chartInstance.update('none');
                } catch (e) {
                    console.error("Erro ao converter o gráfico para imagem:", e);
                    doc.text("Erro ao gerar a imagem do gráfico.", 14, 50);
                }
            } else {
                 doc.text("Gráfico não disponível para os filtros selecionados.", 14, 50);
            }

            const head = [['Categoria', 'Produto', 'Estoque', 'Cob. Mês Ant.', 'Cob. Mês Atual', 'Variação']];
            const body = [];

            innovationsMonthTableDataForExport.forEach(item => {
                let variationContent;
                if (isFinite(item.variation)) {
                    variationContent = `${item.variation.toFixed(1)}%`;
                } else if (item.coverageCurrent > 0) {
                    variationContent = 'Novo';
                } else {
                    variationContent = '-';
                }

                const row = [
                    item.categoryName,
                    `${item.productCode} - ${item.productName}`,
                    item.stock.toLocaleString('pt-BR'),
                    `${item.coveragePrevious.toFixed(2)}% (${item.clientsPreviousCount} PDVs)`,
                    `${item.coverageCurrent.toFixed(2)}% (${item.clientsCurrentCount} PDVs)`,
                    variationContent
                ];
                body.push(row);
            });

            doc.autoTable({
                head: head,
                body: body,
                startY: 155,
                theme: 'grid',
                styles: { fontSize: 7, cellPadding: 1.5, textColor: [0, 0, 0] },
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 7, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [240, 248, 255] },
                didDrawPage: function (data) {
                    doc.setFontSize(12);
                    doc.setTextColor(10);
                    doc.text("Dados do Gráfico", data.settings.margin.left, 152);
                }
            });

            if (innovationsByClientForExport.length > 0) {
                doc.addPage();
                doc.setFontSize(18);
                doc.text('Relatório de Inovações por Cliente', 14, 22);
                doc.setFontSize(10);
                doc.setTextColor(10);
                doc.text(`Data de Emissão: ${generationDate}`, 14, 30);
                doc.text(splitFilters, 14, 36);

                const legendText = `Legenda: ${categoryLegendForExport.join('; ')}`;
                const splitLegend = doc.splitTextToSize(legendText, 270);
                doc.text(splitLegend, 14, 42);

                const clientInnovationsHead = [['Código', 'Cliente', 'Cidade', 'Bairro', 'Últ. Compra', ...categoryLegendForExport.map((_, i) => `${i + 1}`)]];
                const clientInnovationsBody = innovationsByClientForExport.map(client => {
                    const row = [
                        client['Código'],
                        client.fantasia || client.razaoSocial,
                        client.cidade,
                        client.bairro,
                        formatDate(client.ultimaCompra)
                    ];
                    categoryLegendForExport.forEach((cat, index) => {
                        const catName = cat.split(' - ')[1];
                        const status = client.innovationStatus[catName];

                        const cell = {
                            content: status ? 'S' : 'N',
                            styles: {
                                textColor: status ? [34, 139, 34] : [220, 20, 60],
                                fontStyle: 'bold'
                            }
                        };
                        row.push(cell);
                    });
                    return row;
                });

                doc.autoTable({
                    head: clientInnovationsHead,
                    body: clientInnovationsBody,
                    startY: 55,
                    theme: 'grid',
                    styles: { fontSize: 7, cellPadding: 1.5, halign: 'center', textColor: [0, 0, 0] },
                    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 7, fontStyle: 'bold' },
                    columnStyles: {
                        0: { halign: 'left' },
                        1: { halign: 'left' },
                        2: { halign: 'left' },
                        3: { halign: 'left' },
                        4: { halign: 'center' }
                    },
                    alternateRowStyles: { fillColor: [240, 248, 255] },
                });
            }

            const pageCount = doc.internal.getNumberOfPages();
            for(let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(9);
                doc.setTextColor(10);
                doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
            }

            let fileNameParam = 'geral';
            if (hierarchyState['innovations-month'] && hierarchyState['innovations-month'].promotors.size === 1) {
            } else if (cidade) {
                fileNameParam = cidade;
            }
            const safeFileNameParam = fileNameParam.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            doc.save(`relatorio_inovacoes_mes_${safeFileNameParam}_${new Date().toISOString().slice(0,10)}.pdf`);
        }


        async function exportCoveragePDF() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape');

            const coord = document.getElementById('coverage-coord-filter-text')?.textContent || 'Todos';
            const cocoord = document.getElementById('coverage-cocoord-filter-text')?.textContent || 'Todos';
            const promotor = document.getElementById('coverage-promotor-filter-text')?.textContent || 'Todos';
            const filial = coverageFilialFilter.options[coverageFilialFilter.selectedIndex].text;
            const cidade = coverageCityFilter.value.trim();
            const supplierText = document.getElementById('coverage-supplier-filter-text').textContent;
            const generationDate = new Date().toLocaleString('pt-BR');

            doc.setFontSize(18);
            doc.text('Relatório de Cobertura (Estoque x PDVs)', 14, 22);
            doc.setFontSize(10);
            doc.setTextColor(10);
            doc.text(`Data de Emissão: ${generationDate}`, 14, 30);

            let filterText = `Filtros Aplicados: Coordenador: ${coord} | Co-Coordenador: ${cocoord} | Promotor: ${promotor} | Filial: ${filial} | Cidade: ${cidade || 'Todas'} | Fornecedor: ${supplierText}`;
            const splitFilters = doc.splitTextToSize(filterText, 270);
            doc.text(splitFilters, 14, 36);

            // Add Chart if available
            const chartId = currentCoverageChartMode === 'city' ? 'coverageCityChart' : 'coverageSellerChart';
            const chartCanvas = document.getElementById(chartId);
            if (chartCanvas && charts[chartId]) {
                try {
                    const chartInstance = charts[chartId];
                    const originalDatalabelsColor = chartInstance.options.plugins.datalabels.color;
                    const originalXColor = chartInstance.options.scales.x.ticks.color;
                    const originalYColor = chartInstance.options.scales.y.ticks.color;
                    const originalLegendColor = chartInstance.options.plugins.legend?.labels?.color;

                    chartInstance.options.plugins.datalabels.color = '#000000';
                    chartInstance.options.scales.x.ticks.color = '#000000';
                    chartInstance.options.scales.y.ticks.color = '#000000';
                    if (chartInstance.options.plugins.legend && chartInstance.options.plugins.legend.labels) {
                        chartInstance.options.plugins.legend.labels.color = '#000000';
                    }

                    chartInstance.update('none');

                    const chartImage = chartCanvas.toDataURL('image/png', 1.0);
                    doc.addImage(chartImage, 'PNG', 14, 50, 270, 80);

                    chartInstance.options.plugins.datalabels.color = originalDatalabelsColor;
                    chartInstance.options.scales.x.ticks.color = originalXColor;
                    chartInstance.options.scales.y.ticks.color = originalYColor;
                    if (chartInstance.options.plugins.legend && chartInstance.options.plugins.legend.labels) {
                        chartInstance.options.plugins.legend.labels.color = originalLegendColor;
                    }
                    chartInstance.update('none');
                } catch (e) {
                    console.error("Erro ao converter o gráfico para imagem:", e);
                }
            }

            const head = [['Produto', 'Estoque (Cx)', 'Cx. Mês Ant.', 'Cx. Mês Atual', 'Caixas (%)', 'PDVs Ant.', 'PDVs Atual', 'Cobertura (%)']];
            const body = [];

            coverageTableDataForExport.forEach(item => {
                let boxesVariationContent;
                if (isFinite(item.boxesVariation)) {
                    boxesVariationContent = `${item.boxesVariation.toFixed(1)}%`;
                } else if (item.boxesVariation === Infinity) {
                    boxesVariationContent = 'Novo';
                } else {
                    boxesVariationContent = '-';
                }

                let pdvVariationContent;
                if (isFinite(item.pdvVariation)) {
                    pdvVariationContent = `${item.pdvVariation.toFixed(1)}%`;
                } else if (item.pdvVariation === Infinity) {
                    pdvVariationContent = 'Novo';
                } else {
                    pdvVariationContent = '-';
                }

                const row = [
                    item.descricao,
                    item.stockQty.toLocaleString('pt-BR'),
                    item.boxesSoldPreviousMonth.toLocaleString('pt-BR', {maximumFractionDigits: 2}),
                    item.boxesSoldCurrentMonth.toLocaleString('pt-BR', {maximumFractionDigits: 2}),
                    boxesVariationContent,
                    item.clientsPreviousCount.toLocaleString('pt-BR'),
                    item.clientsCurrentCount.toLocaleString('pt-BR'),
                    pdvVariationContent
                ];
                body.push(row);
            });

            doc.autoTable({
                head: head,
                body: body,
                startY: 140,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 1.5, textColor: [0, 0, 0] },
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 8, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [240, 248, 255] },
                 didDrawPage: function (data) {
                    // Footer or Header on new pages
                }
            });

            const pageCount = doc.internal.getNumberOfPages();
            for(let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(9);
                doc.setTextColor(10);
                doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
            }

            let fileNameParam = 'geral';
            if (hierarchyState['coverage'] && hierarchyState['coverage'].promotors.size === 1) {
            } else if (cidade) {
                fileNameParam = cidade;
            }
            const safeFileNameParam = fileNameParam.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            doc.save(`relatorio_cobertura_${safeFileNameParam}_${new Date().toISOString().slice(0,10)}.pdf`);
        }


        function openModal(pedidoId) {
            const orderInfo = aggregatedOrders.find(order => order.PEDIDO == pedidoId);
            const itemsDoPedido = allSalesData.filter(item => item.PEDIDO == pedidoId);
            if (!orderInfo) return;
            modalPedidoId.textContent = pedidoId;
            modalHeaderInfo.innerHTML = `<div><p class="font-bold">Cód. Cliente:</p><p>${window.escapeHtml(orderInfo.CODCLI || 'N/A')}</p></div><div><p class="font-bold">Cliente:</p><p>${window.escapeHtml(orderInfo.CLIENTE_NOME || 'N/A')}</p></div><div><p class="font-bold">Vendedor:</p><p>${window.escapeHtml(orderInfo.NOME || 'N/A')}</p></div><div><p class="font-bold">Data Pedido:</p><p>${formatDate(orderInfo.DTPED)}</p></div><div><p class="font-bold">Data Faturamento:</p><p>${formatDate(orderInfo.DTSAIDA)}</p></div><div><p class="font-bold">Cidade:</p><p>${window.escapeHtml(orderInfo.CIDADE || 'N/A')}</p></div>`;
            modalTableBody.innerHTML = itemsDoPedido.map(item => { const unitPrice = (item.QTVENDA > 0) ? (item.VLVENDA / item.QTVENDA) : 0; return `<tr class="hover:bg-slate-700"><td class="px-4 py-2">(${window.escapeHtml(item.PRODUTO)}) ${window.escapeHtml(item.DESCRICAO)}</td><td class="px-4 py-2 text-right">${item.QTVENDA}</td><td class="px-4 py-2 text-right">${item.TOTPESOLIQ.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} Kg</td><td class="px-4 py-2 text-right"><div class="tooltip">${unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}<span class="tooltip-text" style="width: max-content; left: auto; right: 0; transform: none; margin-left: 0;">Subtotal: ${item.VLVENDA.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div></td></tr>`; }).join('');
            modalFooterTotal.innerHTML = `<p class="text-lg font-bold text-teal-400">Mix de Produtos: ${itemsDoPedido.length}</p><p class="text-lg font-bold text-emerald-400">Total do Pedido: ${orderInfo.VLVENDA.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>`;
            modal.classList.remove('hidden');
        }

        function openClientModal(codcli) {
            const clientData = allClientsData.find(c => String(c['Código']) === String(codcli));
            if (!clientData) return;

            const getVal = (obj, keys) => {
                for (const k of keys) {
                    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== 'N/A' && obj[k] !== '') return obj[k];
                }
                return undefined;
            };

            const endereco = getVal(clientData, ['Endereço Comercial', 'endereco', 'ENDERECO']) || 'N/A';
            const numero = getVal(clientData, ['NUMERO', 'numero', 'Número']) || 'SN';
            let finalAddress = endereco;
            if (numero !== 'SN' && finalAddress !== 'N/A' && !finalAddress.includes(numero)) finalAddress += `, ${numero}`;

            const cnpj = getVal(clientData, ['CNPJ/CPF', 'cnpj_cpf']) || 'N/A';
            const insc = getVal(clientData, ['Insc. Est. / Produtor', 'inscricaoEstadual', 'INSCRICAOESTADUAL']) || 'N/A';
            const razao = getVal(clientData, ['Cliente', 'razaoSocial', 'nomeCliente', 'RAZAOSOCIAL', 'NOMECLIENTE']) || 'N/A';
            const fantasia = getVal(clientData, ['FANTASIA', 'Fantasia', 'fantasia']) || 'N/A';
            const bairro = getVal(clientData, ['BAIRRO', 'Bairro', 'bairro']) || 'N/A';
            const cidade = getVal(clientData, ['CIDADE', 'Cidade', 'cidade', 'Nome da Cidade']) || 'N/A';
            const cep = getVal(clientData, ['CEP', 'cep']) || 'N/A';
            const telefone = getVal(clientData, ['Telefone Comercial', 'telefone', 'TELEFONE']) || 'N/A';
            const email = getVal(clientData, ['EMAIL', 'email', 'E-mail']) || 'N/A';
            const ramo = getVal(clientData, ['Descricao', 'ramo', 'DESCRICAO', 'Descricao']) || 'N/A';
            const ultimaCompra = getVal(clientData, ['Data da Última Compra', 'ultimaCompra', 'ULTIMACOMPRA']);

            clientModalContent.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm"><div><p class="font-bold text-slate-400">Código:</p><p>${window.escapeHtml(clientData['Código'] || 'N/A')}</p></div><div><p class="font-bold text-slate-400">CNPJ/CPF:</p><p>${window.escapeHtml(cnpj)}</p></div><div class="md:col-span-2"><p class="font-bold text-slate-400">Insc. Est. / Produtor:</p><p>${window.escapeHtml(insc)}</p></div><div class="md:col-span-2"><p class="font-bold text-slate-400">Razão Social:</p><p>${window.escapeHtml(razao)}</p></div><div class="md:col-span-2"><p class="font-bold text-slate-400">Nome Fantasia:</p><p>${window.escapeHtml(fantasia)}</p></div><div class="md:col-span-2"><p class="font-bold text-slate-400">Endereço:</p><p>${window.escapeHtml(finalAddress)}</p></div><div><p class="font-bold text-slate-400">Bairro:</p><p>${window.escapeHtml(bairro)}</p></div><div><p class="font-bold text-slate-400">Cidade:</p><p>${window.escapeHtml(cidade)}</p></div><div><p class="font-bold text-slate-400">CEP:</p><p>${window.escapeHtml(cep)}</p></div><div><p class="font-bold text-slate-400">Telefone:</p><p>${window.escapeHtml(telefone)}</p></div><div class="md:col-span-2"><p class="font-bold text-slate-400">E-mail:</p><p>${window.escapeHtml(email)}</p></div><div><p class="font-bold text-slate-400">Ramo de Atividade:</p><p>${window.escapeHtml(ramo)}</p></div><div><p class="font-bold text-slate-400">Última Compra:</p><p>${formatDate(ultimaCompra)}</p></div></div>`;
            clientModal.classList.remove('hidden');
        }

        function exportClientsPDF(clientList, title, filename, includeFaturamento) {
             if (clientList.length === 0) return;
            const { jsPDF } = window.jspdf; const doc = new jsPDF();
            const coord = document.getElementById('city-coord-filter-text')?.textContent || 'Todos';
            const cocoord = document.getElementById('city-cocoord-filter-text')?.textContent || 'Todos';
            const promotor = document.getElementById('city-promotor-filter-text')?.textContent || 'Todos';
            const city = cityNameFilter.value.trim();
            const generationDate = new Date().toLocaleString('pt-BR'); const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('pt-BR');
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toLocaleDateString('pt-BR');
            doc.setFontSize(18); doc.text(title, 14, 22); doc.setFontSize(11); doc.setTextColor(10);
            doc.text(`Período de Análise: ${firstDay} a ${lastDay}`, 14, 32);
            doc.text(`Coordenador: ${coord}`, 14, 38);
            doc.text(`Co-Coordenador: ${cocoord}`, 14, 44);
            doc.text(`Promotor: ${promotor}`, 14, 50);
            doc.text(`Cidade: ${city || 'Todas'}`, 14, 56);
            doc.text(`Data de Emissão: ${generationDate}`, 14, 62);
            const tableColumn = ["Código", "Cliente", "Bairro", "Cidade", "Últ. Compra"];
            if (includeFaturamento) tableColumn.splice(2, 0, "Faturamento");

            clientList.sort((a, b) => {
                if (includeFaturamento) {
                    const valA = a.total || 0;
                    const valB = b.total || 0;
                    if (valB !== valA) return valB - valA;
                }

                const cidadeA = a.cidade || a.CIDADE || a['Nome da Cidade'] || '';
                const cidadeB = b.cidade || b.CIDADE || b['Nome da Cidade'] || '';
                const bairroA = a.bairro || a.BAIRRO || '';
                const bairroB = b.bairro || b.BAIRRO || '';
                if (cidadeA < cidadeB) return -1;
                if (cidadeA > cidadeB) return 1;
                if (bairroA < bairroB) return -1;
                if (bairroA > bairroB) return 1;
                return 0;
            });

            const tableRows = [];
            let totalFaturamento = 0;

            clientList.forEach(client => {
                const fantasia = client.fantasia || client.FANTASIA || client.Fantasia || '';
                const razao = client.razaoSocial || client.Cliente || client.RAZAOSOCIAL || '';
                const nome = fantasia || razao;
                const bairro = client.bairro || client.BAIRRO || client.Bairro || '';
                const cidade = client.cidade || client.CIDADE || client.Cidade || client['Nome da Cidade'] || '';
                const ultCompra = client.ultimaCompra || client['Data da Última Compra'] || client.ULTIMACOMPRA;

                const clientData = [ client['Código'] || '', nome, bairro, cidade, formatDate(ultCompra) || 'N/A' ];
                if (includeFaturamento) {
                    const val = client.total || 0;
                    totalFaturamento += val;
                    clientData.splice(2, 0, val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
                }
                tableRows.push(clientData);
            });

            if (includeFaturamento) {
                const footerRow = [
                    { content: 'TOTAL:', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fontSize: 10, fillColor: [50, 50, 50], textColor: [255, 255, 255] } },
                    { content: totalFaturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), styles: { fontStyle: 'bold', fontSize: 10, fillColor: [50, 50, 50], textColor: [50, 255, 100] } },
                    { content: '', colSpan: 3, styles: { fillColor: [50, 50, 50] } }
                ];
                tableRows.push(footerRow);
            } else {
                const footerRow = [
                    { content: 'TOTAL CLIENTES:', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fontSize: 10, fillColor: [50, 50, 50], textColor: [255, 255, 255] } },
                    { content: String(clientList.length), colSpan: 3, styles: { fontStyle: 'bold', fontSize: 10, fillColor: [50, 50, 50], textColor: [255, 255, 255] } }
                ];
                tableRows.push(footerRow);
            }

            doc.autoTable({ head: [tableColumn], body: tableRows, startY: 60, theme: 'grid', styles: { fontSize: 8, cellPadding: 1.5, textColor: [0, 0, 0] }, headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 8, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [240, 248, 255] }, margin: { top: 10 } });
            const pageCount = doc.internal.getNumberOfPages();
            for(let i = 1; i <= pageCount; i++) { doc.setPage(i); doc.setFontSize(9); doc.setTextColor(10); doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' }); }

            let fileNameParam = 'geral';
            if (hierarchyState['city'] && hierarchyState['city'].promotors.size === 1) {
            } else if (city) {
                fileNameParam = city;
            }
            const safeFileNameParam = fileNameParam.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            doc.save(`${filename}_${safeFileNameParam}_${new Date().toISOString().slice(0,10)}.pdf`);
        }

        function renderCalendar(year, month) {
            const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

            let calendarHTML = `
                <div class="flex justify-between items-center mb-4">
                    <button id="prev-month-btn" class="p-2 rounded-full hover:bg-slate-600">&lt;</button>
                    <h3 class="font-bold text-lg">${monthNames[month]} ${year}</h3>
                    <button id="next-month-btn" class="p-2 rounded-full hover:bg-slate-600">&gt;</button>
                </div>
                <div class="grid grid-cols-7 gap-1 text-center text-xs text-slate-400 mb-2">
                    <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
                </div>
                <div id="calendar-grid" class="grid grid-cols-7 gap-1">
            `;
            const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
            const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

            for (let i = 0; i < firstDay; i++) {
                calendarHTML += `<div></div>`;
            }

            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(Date.UTC(year, month, day));
                const dateString = date.toISOString().split('T')[0];
                const isSelected = selectedHolidays.includes(dateString);
                const isToday = date.getTime() === lastSaleDate.getTime();
                let dayClasses = 'p-2 rounded-full cursor-pointer hover:bg-slate-600 flex items-center justify-center';
                if (isSelected) dayClasses += ' bg-red-500 text-white font-bold';
                if (isToday) dayClasses += ' border-2 border-teal-400';

                calendarHTML += `<div class="${dayClasses}" data-date="${dateString}">${day}</div>`;
            }

            calendarHTML += `</div>`;
            calendarContainer.innerHTML = calendarHTML;
        }

        function initializeRedeFilters() {
            const hasRedeData = allClientsData.some(client => client.ramo && client.ramo !== 'N/A');

            const mainRedeFilterWrapper = document.getElementById('main-rede-filter-wrapper');
            const cityRedeFilterWrapper = document.getElementById('city-rede-filter-wrapper');
            const comparisonRedeFilterWrapper = document.getElementById('comparison-rede-filter-wrapper');
            const stockRedeFilterWrapper = document.getElementById('stock-rede-filter-wrapper');

            if (mainRedeFilterWrapper) mainRedeFilterWrapper.style.display = hasRedeData ? '' : 'none';
            if (cityRedeFilterWrapper) cityRedeFilterWrapper.style.display = hasRedeData ? '' : 'none';
            if (comparisonRedeFilterWrapper) comparisonRedeFilterWrapper.style.display = hasRedeData ? '' : 'none';
            if (stockRedeFilterWrapper) stockRedeFilterWrapper.style.display = hasRedeData ? '' : 'none';
        }
