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
