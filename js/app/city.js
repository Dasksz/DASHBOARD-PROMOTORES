window.App = window.App || {};
window.App.City = {
    init: function() {
        window.App.Filters.setupHierarchyFilters('city', () => this.render());
        const toggleMap = document.getElementById('toggle-city-map-btn');
        if (toggleMap) {
            toggleMap.addEventListener('click', () => {
                const mapContainer = document.getElementById('city-map-container');
                mapContainer.classList.toggle('hidden');
                if (!mapContainer.classList.contains('hidden')) {
                    // Initialize Map Lazily
                    if (window.App.Map) {
                        window.App.Map.initLeafletMap();
                        if (window.App.Map.leafletMap) {
                            setTimeout(() => window.App.Map.leafletMap.invalidateSize(), 100);
                        }
                    }
                    this.render(); // Trigger map update
                }
            });
        }
    },

    render: function() {
        const clients = window.App.Filters.getHierarchyFilteredClients('city', window.AppState.allClientsData);
        // Calculate filtered sales...
        // For map, we pass clients and ALL sales (map logic filters internally or we pass filtered sales).
        // Map.updateCityMap expects (clients, sales).
        
        // Filter sales for this set of clients
        const validClientCodes = new Set();
        clients.forEach(c => validClientCodes.add(window.Utils.normalizeKey(c['Código'] || c['codigo_cliente'])));
        
        const filteredSales = []; // This requires iterating allSalesData.
        // Optimization: Use indices if available
        // Or Map.updateCityMap accepts full dataset and does intersection?
        // Map.updateCityMap currently iterates 'sales' and checks if client is in... wait.
        // Map.updateCityMap(clients, sales).
        // It iterates sales. If sales list is HUGE, filtering here is better.
        
        if (window.AppState.allSalesData instanceof window.Utils.ColumnarDataset) {
            // Columnar filtering
            const d = window.AppState.allSalesData;
            const len = d.length;
            const cods = d._data['CODCLI'];
            
            // Build subset of sales (indices or objects)
            // Just pass the full dataset if Map handles it efficiently?
            // Map.updateCityMap: "runAsyncChunked(sales, (s) => ...)"
            // It builds tempSalesMap.
            // It assumes 's' is a sale object.
            // If we pass ColumnarDataset, runAsyncChunked handles .get(i).
            
            // Map logic sums sales for ALL clients in the list.
            // If we pass ALL sales, it will sum for ALL clients.
            // But we only want sales for the `clients` list passed in arg 1?
            // Map logic:
            // "clients.forEach... heatData.push..."
            // "runAsyncChunked(sales, (s) => { const cod = s.CODCLI; ... tempSalesMap.set(cod, ... + val) })"
            // Then "updateMarkersVisibility" uses `tempSalesMap.get(codCli)`.
            // So if `tempSalesMap` contains sales for clients NOT in `clients`, it doesn't matter because `updateMarkersVisibility` iterates `this.currentFilteredClients` (which is `clients`).
            // So we can pass ALL sales safely.
            
            window.App.Map.updateCityMap(clients, window.AppState.allSalesData);
        } else {
            window.App.Map.updateCityMap(clients, window.AppState.allSalesData);
        }
        
        // Update Tables (Active/Inactive)
        // ... (Logic to populate city-active-detail-table-body)
        this.renderTables(clients);
    },

    renderTables: function(clients) {
        // Simple render of counts
        const activeTbody = document.getElementById('city-active-detail-table-body');
        const inactiveTbody = document.getElementById('city-inactive-detail-table-body');
        if(activeTbody) activeTbody.innerHTML = '';
        if(inactiveTbody) inactiveTbody.innerHTML = '';
        
        // Split by active status (sales > 0)
        // Need to know which clients have sales.
        // We can check window.AppState.optimizedData.indices.current.byClient.has(cod)
        // optimizedData.indices.current.byClient is Map<Cod, Set<IDs>>.
        
        const salesIndex = window.AppState.optimizedData.indices.current.byClient;
        
        let activeCount = 0;
        let inactiveCount = 0;
        const LIMIT = 100; // Limit rendering for perf

        clients.forEach(c => {
            const cod = window.Utils.normalizeKey(c['Código'] || c['codigo_cliente']);
            const hasSales = salesIndex.has(cod);
            
            if (hasSales) {
                if (activeCount < LIMIT) {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-slate-800';
                    tr.innerHTML = `<td class="px-4 py-2">${c.fantasia || c.nomeCliente}</td>`;
                    if(activeTbody) activeTbody.appendChild(tr);
                    activeCount++;
                }
            } else {
                if (inactiveCount < LIMIT) {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-slate-800';
                    tr.innerHTML = `<td class="px-4 py-2">${c.fantasia || c.nomeCliente}</td>`;
                    if(inactiveTbody) inactiveTbody.appendChild(tr);
                    inactiveCount++;
                }
            }
        });
        
        document.getElementById('total-clientes-cidade').textContent = clients.length;
        // Total Faturamento needs aggregation
        // ...
    }
};
