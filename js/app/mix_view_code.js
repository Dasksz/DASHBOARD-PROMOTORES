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
