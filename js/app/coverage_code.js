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
