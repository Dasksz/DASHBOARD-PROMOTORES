                    // Iterate all active sellers to ensure their calculated "Suggestions" are saved if not manually set.
                    // 2. Backfill Defaults Removed
                    // We rely on getSellerCurrentGoal dynamic calculation for unconfigured sellers.
                    // This avoids materializing defaults into overrides, which would prevent strict mode behavior (returning 0 for missing manual targets).

                    // Save to Supabase (SKIPPED - Load to Memory Only)
                    // const success = await saveGoalsToSupabase();

                    window.showToast('success', `Importação realizada! As metas foram carregadas para a aba "Rateio Metas". Verifique e salve manualmente.`);
                    closeModal();

                    // Switch to "Rateio Metas" tab to verify
                    const btnGv = document.querySelector('button[data-tab="gv"]');
                    if (btnGv) btnGv.click();
                } catch (e) {
                    console.error("Erro no processo de confirmação:", e);
                    window.showToast('error', "Erro ao processar/salvar: " + e.message);
                } finally {
                    importConfirmBtn.textContent = originalText;
                    importConfirmBtn.disabled = false;
                    importConfirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            });
        }
        async function exportMetaRealizadoPDF() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape');

            const coord = document.getElementById('meta-realizado-coord-filter-text') ? document.getElementById('meta-realizado-coord-filter-text').textContent : 'N/A';
            const cocoord = document.getElementById('meta-realizado-cocoord-filter-text') ? document.getElementById('meta-realizado-cocoord-filter-text').textContent : 'N/A';
            const promotor = document.getElementById('meta-realizado-promotor-filter-text') ? document.getElementById('meta-realizado-promotor-filter-text').textContent : 'N/A';
            const supplier = document.getElementById('meta-realizado-supplier-filter-text') ? document.getElementById('meta-realizado-supplier-filter-text').textContent : 'N/A';
            const pasta = currentMetaRealizadoPasta;
            const generationDate = new Date().toLocaleString('pt-BR');

            // --- Header ---
            doc.setFontSize(18);
            doc.text('Painel Meta vs Realizado', 14, 22);
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Data de Emissão: ${generationDate}`, 14, 30);
            doc.text(`Filtros: Coord: ${coord} | Co-Coord: ${cocoord} | Promotor: ${promotor} | Fornecedor: ${supplier} | Pasta: ${pasta}`, 14, 36);

            // --- Table 1: Sellers Summary ---
            // Build dynamic headers based on weeks
            const weeksHeaders = [];
            metaRealizadoDataForExport.weeks.forEach((w, i) => {
                weeksHeaders.push({ content: `Semana ${i + 1}`, colSpan: 2, styles: { halign: 'center' } });
            });

            const weeksSubHeaders = [];
            metaRealizadoDataForExport.weeks.forEach(() => {
                weeksSubHeaders.push('Meta');
                weeksSubHeaders.push('Real.');
            });

            const sellersHead = [
                [
                    { content: 'Vendedor', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
                    { content: 'Geral', colSpan: 2, styles: { halign: 'center' } },
                    ...weeksHeaders,
                    { content: 'Positivação', colSpan: 2, styles: { halign: 'center' } }
                ],
                [
                    'Meta Total', 'Real. Total',
                    ...weeksSubHeaders,
                    'Meta', 'Real.'
                ]
            ];

            const sellersBody = metaRealizadoDataForExport.sellers.map(row => {
                const weekCells = [];
                row.weekData.forEach(w => {
                    weekCells.push(w.meta.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
                    weekCells.push(w.real.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
                });
                return [
                    getFirstName(row.name),
                    row.metaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                    row.realTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                    ...weekCells,
                    row.posGoal,
                    row.posRealized
                ];
            });

            doc.autoTable({
                head: sellersHead,
                body: sellersBody,
                startY: 45,
                theme: 'grid',
                styles: { fontSize: 7, cellPadding: 1, textColor: [0, 0, 0], halign: 'center' },
                headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', lineWidth: 0.1, lineColor: [200, 200, 200] },
                alternateRowStyles: { fillColor: [240, 240, 240] },
                columnStyles: {
                    0: { halign: 'left', fontStyle: 'bold' } // Vendedor Name
                },
                didParseCell: function(data) {
                    if (data.section === 'body' && data.column.index > 2) {
                        // Highlight Logic if needed (e.g. Red for Past weeks deficit)
                    }
                }
            });

            // --- Table 2: Clients Detail ---
            doc.addPage();
            doc.setFontSize(14);
            doc.text('Detalhamento por Cliente', 14, 20);

            const clientsHead = [
                [
                    { content: 'Cód', rowSpan: 2, styles: { valign: 'middle' } },
                    { content: 'Cliente', rowSpan: 2, styles: { valign: 'middle' } },
                    { content: 'Vendedor', rowSpan: 2, styles: { valign: 'middle' } },
                    { content: 'Cidade', rowSpan: 2, styles: { valign: 'middle' } },
                    { content: 'Geral', colSpan: 2, styles: { halign: 'center' } },
                    ...weeksHeaders
                ],
                [
                    'Meta', 'Real.',
                    ...weeksSubHeaders
                ]
            ];

            const clientsBody = metaRealizadoDataForExport.clients.map(row => {
                const weekCells = [];
                row.weekData.forEach(w => {
                    weekCells.push(w.meta.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
                    weekCells.push(w.real.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
                });
                return [
                    row.codcli,
                    row.razaoSocial,
                    getFirstName(row.vendedor),
                    row.cidade,
                    row.metaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                    row.realTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                    ...weekCells
                ];
            });

            doc.autoTable({
                head: clientsHead,
                body: clientsBody,
                startY: 25,
                theme: 'grid',
                styles: { fontSize: 6, cellPadding: 1, textColor: [0, 0, 0], halign: 'right' },
                headStyles: { fillColor: [22, 30, 61], textColor: 255, fontStyle: 'bold' },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 15 },
                    1: { halign: 'left', cellWidth: 40 },
                    2: { halign: 'left', cellWidth: 20 },
                    3: { halign: 'left', cellWidth: 20 },
                }
            });

            // Add Page Numbers
            const pageCount = doc.internal.getNumberOfPages();
            for(let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
            }

            let fileNameParam = 'geral';
            if (hierarchyState['meta-realizado'] && hierarchyState['meta-realizado'].promotors.size === 1) {
            }
            const safeFileNameParam = fileNameParam.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            doc.save(`meta_vs_realizado_${safeFileNameParam}_${new Date().toISOString().slice(0,10)}.pdf`);
        }

            function renderAiFullPage(data) {
                const fullPage = document.getElementById('ai-insights-full-page');
                const contentDiv = document.getElementById('ai-insights-full-content');
                const mainWrapper = document.getElementById('content-wrapper'); // This wraps dashboard
                const modal = document.getElementById('import-goals-modal'); // Close the modal

                if (!fullPage || !contentDiv) return;

                // Close Import Modal
                if (modal) modal.classList.add('hidden');

                // Hide Main Dashboard / Content Wrapper
                // Note: index.html structure shows content-wrapper wraps everything *except* the new page which I inserted *inside*?
                // Let's check where I inserted it.
                // "Insert the new full-screen AI insights container into index.html... inside content-wrapper"
                // If it is inside content-wrapper, hiding content-wrapper hides it too.
                // Wait, in my previous step I used  to insert it *before* Goals View.
                //  is inside .
                // So  IS inside .
                // Therefore, I should hide the *siblings* (dashboard, goals-view, etc) explicitly, NOT the wrapper.

                // Hide all main views
                ['main-dashboard', 'city-view', 'comparison-view', 'stock-view', 'coverage-view', 'goals-view', 'meta-realizado-view', 'mix-view', 'innovations-month-view'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.classList.add('hidden');
                });

                // Show AI Page
                fullPage.classList.remove('hidden');

                // Render Content
                let html = `
                    <div class="bg-gradient-to-r from-slate-800 to-slate-900 rounded-lg p-6 border border-slate-700 shadow-lg mb-8">
                        <h2 class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-400 mb-4">
                            🌍 Resumo Estratégico Global
                        </h2>
                        <p class="text-lg text-slate-300 leading-relaxed">${data.global_summary || 'Análise indisponível.'}</p>
                    </div>

                    <div id="ai-full-page-chart-container" class="mt-8 mb-8 h-80 glass-panel-heavy rounded-xl p-4 border border-slate-700 relative">
                        <canvas id="aiFullPageSummaryChart"></canvas>
                    </div>

                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
                `;

                if (data.supervisors) {
                    data.supervisors.forEach(sup => {
                        html += `
                            <div class="glass-panel-heavy rounded-xl border border-slate-700 overflow-hidden shadow-md flex flex-col">
                                <div class="p-5 border-b border-slate-700 bg-glass">
                                    <h3 class="text-xl font-bold text-white flex items-center gap-2">
                                        <div class="w-2 h-8 bg-blue-500 rounded-full"></div>
                                        ${sup.name}
                                    </h3>
                                </div>
                                <div class="p-6 flex-1">
                                    <div class="mb-6">
                                        <h4 class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Análise do Time</h4>
                                        <p class="text-slate-300 text-sm leading-relaxed">${sup.analysis}</p>
                                    </div>

                                    <div>
                                        <div class="flex justify-between items-center mb-3">
                                            <h4 class="text-sm font-bold text-slate-400 uppercase tracking-wider">Detalhamento por Vendedor</h4>
                                            <span class="text-xs text-slate-500 glass-panel-heavy border border-slate-700 px-2 py-1 rounded-full">Top ${sup.variations ? sup.variations.length : 0} Variações</span>
                                        </div>
                                        <div class="overflow-x-auto rounded-lg border border-slate-700/50">
                                            <table class="w-full text-sm text-left text-slate-300">
                                                <thead class="text-xs text-slate-400 uppercase bg-slate-900/80">
                                                    <tr>
                                                        <th class="px-4 py-3 font-semibold tracking-wide">Vendedor</th>
                                                        <th class="px-4 py-3 font-semibold tracking-wide">Métrica</th>
                                                        <th class="px-4 py-3 font-semibold tracking-wide text-right">Alteração</th>
                                                        <th class="px-4 py-3 font-semibold tracking-wide">Insight</th>
                                                    </tr>
                                                </thead>
                                                <tbody class="divide-y divide-slate-700/50 glass-panel-heavy/30">
                        `;

                        if (sup.variations) {
                            sup.variations.forEach(v => {
                                // Enhance change display with colors and icons
                                let coloredChange = v.change_display;

                                // Regex for (+...) -> Green with arrow up
                                if (coloredChange.includes('(+')) {
                                    coloredChange = coloredChange.replace(/(\(\+[^)]+\))/g, '<span class="text-emerald-400 font-bold bg-emerald-400/10 px-1.5 py-0.5 rounded ml-1 text-xs">$1</span>');
                                } else if (coloredChange.includes('(-')) {
                                    coloredChange = coloredChange.replace(/(\(-[^)]+\))/g, '<span class="text-rose-400 font-bold bg-rose-400/10 px-1.5 py-0.5 rounded ml-1 text-xs">$1</span>');
                                }

                                // Format metric with bold prefix
                                const metricParts = v.metric.split('(');
                                let formattedMetric = v.metric;
                                if (metricParts.length > 1) {
                                    formattedMetric = `<span class="text-slate-300 font-medium">${metricParts[0]}</span> <span class="text-slate-500 text-xs">(${metricParts[1]}</span>`;
                                }

                                html += `
                                    <tr class="hover:bg-slate-700/40 transition-colors group">
                                        <td class="px-4 py-3 font-medium text-white group-hover:text-blue-300 transition-colors">${v.seller}</td>
                                        <td class="px-4 py-3 text-slate-400">${formattedMetric}</td>
                                        <td class="px-4 py-3 font-mono text-xs text-right whitespace-nowrap">${coloredChange}</td>
                                        <td class="px-4 py-3 text-blue-300/90 text-xs italic border-l border-slate-700/50 pl-4">"${v.insight}"</td>
                                    </tr>
                                `;
                            });
                        }

                        html += `
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                }

                html += `</div>`;
                contentDiv.innerHTML = html;

                // Render Chart
                setTimeout(renderFullPageSummaryChart, 100);

                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            function renderFullPageSummaryChart() {
                const ctx = document.getElementById('aiFullPageSummaryChart');
                if (!ctx) return;

                // Calculate Totals
                let totalCurrent = 0;
                let totalProposed = 0;

                // Ensure we have updates
                if (pendingImportUpdates) {
                    pendingImportUpdates.forEach(u => {
                        if (u.type === 'rev') {
                            const cur = getSellerCurrentGoal(u.seller, u.category, u.type);
                            totalCurrent += cur;
                            totalProposed += u.val;
                        }
                    });
                }

                const diff = totalProposed - totalCurrent;
                const diffColor = diff >= 0 ? '#22c55e' : '#ef4444';

                if (window.aiFullPageChartInstance) {
                    window.aiFullPageChartInstance.data.datasets[0].data = [totalCurrent, totalProposed];
                    window.aiFullPageChartInstance.data.datasets[0].backgroundColor = ['#64748b', diffColor];
                    window.aiFullPageChartInstance.options.plugins.title.text = `Comparativo Global de Faturamento (Diferença: ${diff > 0 ? '+' : ''}${diff.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})})`;
                    window.aiFullPageChartInstance.update('none');
                } else {
                    window.aiFullPageChartInstance = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: ['Meta Atual', 'Nova Proposta'],
                            datasets: [{
                                label: 'Faturamento Total (R$)',
                                data: [totalCurrent, totalProposed],
                                backgroundColor: ['#64748b', diffColor],
                                borderRadius: 6,
                                barPercentage: 0.5
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false },
                                title: {
                                    display: true,
                                    text: `Comparativo Global de Faturamento (Diferença: ${diff > 0 ? '+' : ''}${diff.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})})`,
                                    color: '#fff',
                                    font: { size: 16 }
                                },
                                datalabels: {
                                    color: '#fff',
                                    anchor: 'end',
                                    align: 'top',
                                    formatter: (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                                    font: { weight: 'bold' }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: false,
                                    grid: { color: '#334155' },
                                    ticks: { color: '#94a3b8' }
                                },
                                x: {
                                    grid: { display: false },
                                    ticks: { color: '#fff', font: { size: 14, weight: 'bold' } }
                                }
                            }
                        }
                    });
                }
            }

            // Export to HTML Function
            document.getElementById('ai-insights-export-btn')?.addEventListener('click', () => {
                const content = document.getElementById('ai-insights-full-content').innerHTML;
                const timestamp = new Date().toLocaleString();

                const fullHtml = `
                    <!DOCTYPE html>
                    <html lang="pt-br">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Relatório de Insights IA - ${timestamp}</title>
                        <script src="https://cdn.tailwindcss.com"></script>
                        <style>body { background-color: #0f172a; color: #cbd5e1; font-family: sans-serif; }</style>
                    </head>
                    <body class="p-8">
                        <div class="max-w-7xl mx-auto">
                            <h1 class="text-3xl font-bold text-white mb-2">Relatório de Insights IA</h1>
                            <p class="text-slate-400 mb-8">Gerado em: ${timestamp}</p>
                            ${content}
                        </div>
                    </body>
                    </html>
                `;

                const blob = new Blob([fullHtml], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `insights_ia_${new Date().toISOString().slice(0,10)}.html`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });

            // Back Button Logic
            document.getElementById('ai-insights-back-btn')?.addEventListener('click', () => {
                document.getElementById('ai-insights-full-page').classList.add('hidden');
                // Restore Dashboard (or Goals View specifically since we came from there)
                // Default to Goals View since the Import Modal is there
                navigateTo('goals');

                // Re-open the Import Modal to preserve context/flow
                const modal = document.getElementById('import-goals-modal');
                if (modal) modal.classList.remove('hidden');
            });

        function initFloatingFilters() {
            const toggleBtn = document.getElementById('floating-filters-toggle');
            const sentinels = document.querySelectorAll('.filter-wrapper-sentinel');

            if (!toggleBtn || sentinels.length === 0) return;

            // Scroll Logic to Show/Hide Button and Auto-Dock
            window.addEventListener('scroll', () => {
                let visibleSentinel = null;
                // Find the sentinel in the currently visible view
                for (const s of sentinels) {
                    if (s.offsetParent !== null) {
                        visibleSentinel = s;
                        break;
                    }
                }

                if (visibleSentinel) {
                    const rect = visibleSentinel.getBoundingClientRect();
                    // Threshold: When the bottom of the sentinel passes the top navigation area (approx 80px)
                    const isPassed = rect.bottom < 80;

                    if (isPassed) {
                        toggleBtn.classList.remove('hidden');
                    } else {
                        toggleBtn.classList.add('hidden');

                        // Auto-dock if scrolled back up
                        const filters = visibleSentinel.querySelector('.sticky-filters');
                        if (filters && filters.classList.contains('filters-overlay-mode')) {
                            filters.classList.remove('filters-overlay-mode');
                            toggleBtn.innerHTML = '<span class="text-lg leading-none mb-0.5">+</span><span>Filtros</span>';
                        }
                    }
                } else {
                    toggleBtn.classList.add('hidden');
                }
            }, { passive: true });

            // Click Handler
            toggleBtn.addEventListener('click', () => {
                let visibleFilters = null;
                // Find visible filters inside visible sentinel
                for (const s of sentinels) {
                    if (s.offsetParent !== null) {
                        visibleFilters = s.querySelector('.sticky-filters');
                        break;
                    }
                }

                if (visibleFilters) {
                    visibleFilters.classList.toggle('filters-overlay-mode');
                    const isActive = visibleFilters.classList.contains('filters-overlay-mode');

                    if (isActive) {
                        toggleBtn.innerHTML = '<span class="text-lg leading-none mb-0.5">-</span><span>Filtros</span>';
                    } else {
                        toggleBtn.innerHTML = '<span class="text-lg leading-none mb-0.5">+</span><span>Filtros</span>';
                    }
                }
            });
        }

            // --- SYSTEM DIAGNOSIS TOOL ---
            const diagnosisBtn = document.getElementById('system-diagnosis-btn');
            const diagnosisModal = document.getElementById('diagnosis-modal');
            const diagnosisCloseBtn = document.getElementById('diagnosis-close-btn');
            const diagnosisCopyBtn = document.getElementById('diagnosis-copy-btn');
            const diagnosisContent = document.getElementById('diagnosis-content');

            if (diagnosisBtn && diagnosisModal) {
                diagnosisBtn.addEventListener('click', () => {
                    const report = generateSystemDiagnosis();
                    diagnosisContent.textContent = report;
                    diagnosisModal.classList.remove('hidden');
                });

                diagnosisCloseBtn.addEventListener('click', () => diagnosisModal.classList.add('hidden'));

                diagnosisCopyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(diagnosisContent.textContent).then(() => {
                        const originalText = diagnosisCopyBtn.innerHTML;
                        diagnosisCopyBtn.innerHTML = `<span class="text-green-300 font-bold">Copiado!</span>`;
                        setTimeout(() => diagnosisCopyBtn.innerHTML = originalText, 2000);
                    });
                });
            }

            function generateSystemDiagnosis() {
                const now = new Date();
                let report = `=== RELATÓRIO DE DIAGNÓSTICO DO SISTEMA ===\n`;
                report += `Data: ${now.toLocaleString()}\n`;
                report += `User Agent: ${navigator.userAgent}\n\n`;

                report += `--- 1. CONTEXTO DO USUÁRIO ---\n`;
                report += `Role (Window): ${window.userRole}\n`;
                report += `Contexto Resolvido: ${JSON.stringify(userHierarchyContext, null, 2)}\n\n`;

                report += `--- 2. ESTRUTURA DE DADOS ---\n`;
                report += `Clientes Totais (Bruto): ${allClientsData ? allClientsData.length : 'N/A'}\n`;
                report += `Vendas Detalhadas (Bruto): ${allSalesData ? allSalesData.length : 'N/A'}\n`;
                report += `Histórico (Bruto): ${allHistoryData ? allHistoryData.length : 'N/A'}\n`;
                report += `Pedidos Agregados: ${aggregatedOrders ? aggregatedOrders.length : 'N/A'}\n`;

                report += `\n--- 3. HIERARQUIA ---\n`;
                const hierRaw = embeddedData.hierarchy;
                report += `Raw Data Length: ${hierRaw ? hierRaw.length : 'N/A (Null)'}\n`;
                if (hierRaw && hierRaw.length > 0) {
                    report += `Sample Keys (First Item): ${JSON.stringify(Object.keys(hierRaw[0]))}\n`;
                }
                report += `Nós na Árvore de Hierarquia: ${optimizedData.hierarchyMap ? optimizedData.hierarchyMap.size : 'N/A'}\n`;
                report += `Clientes Mapeados (Client->Promotor): ${optimizedData.clientHierarchyMap ? optimizedData.clientHierarchyMap.size : 'N/A'}\n`;
                report += `Coordenadores Únicos: ${optimizedData.coordMap ? optimizedData.coordMap.size : 'N/A'}\n`;

                report += `\n--- 4. FILTROS ATIVOS (MAIN) ---\n`;
                const mainState = hierarchyState['main'];
                report += `Coords Selecionados: ${mainState ? Array.from(mainState.coords).join(', ') : 'N/A'}\n`;
                report += `CoCoords Selecionados: ${mainState ? Array.from(mainState.cocoords).join(', ') : 'N/A'}\n`;
                report += `Promotores Selecionados: ${mainState ? Array.from(mainState.promotors).join(', ') : 'N/A'}\n`;

                report += `\n--- 5. TESTE DE FILTRAGEM (Simulação) ---\n`;
                try {
                    const filteredClients = getHierarchyFilteredClients('main', allClientsData);
                    report += `Clientes Após Filtro de Hierarquia: ${filteredClients.length}\n`;

                    if (filteredClients.length === 0) {
                        report += `[ALERTA] Filtro retornou 0 clientes. Verifique se o usuário '${window.userRole}' está mapeado na hierarquia.\n`;
                    } else {
                        // Sample check
                        const sampleClient = filteredClients[0];
                        const cod = String(sampleClient['Código'] || sampleClient['codigo_cliente']);
                        const node = optimizedData.clientHierarchyMap.get(normalizeKey(cod));
                        report += `Exemplo Cliente Aprovado: ${cod} (${sampleClient.fantasia || sampleClient.razaoSocial})\n`;
                        report += ` -> Mapeado para: ${node ? JSON.stringify(node.promotor) : 'SEM NÓ (Erro?)'}\n`;
                    }
                } catch (e) {
                    report += `Erro ao simular filtro: ${e.message}\n`;
                }

                report += `\n--- 6. VALIDAÇÃO DE CHAVES ---\n`;
                if (allClientsData && allClientsData.length > 0) {
                    const c = allClientsData instanceof ColumnarDataset ? allClientsData.get(0) : allClientsData[0];
                    report += `Exemplo Chave Cliente (Raw): '${c['Código'] || c['codigo_cliente']}'\n`;
                    report += `Exemplo Chave Cliente (Normalized): '${normalizeKey(c['Código'] || c['codigo_cliente'])}'\n`;
                }

                return report;
            }

    // --- RACK MULTI-SELECT COMPONENT ---
    const RACK_OPTIONS = [
        "Mini Lego", "Lego 4C", "Lego 4C Smart", "4C Arramado", "5C", "6C",
        "7C - P", "7C - M", "7C - G", "8C", "Ilha Quadrada", "Giratório",
        "Carrossel", "Rack de Amendoim", "Botadeiro", "Rack Toddynho", "Rack FOODS", "Nenhum"
    ];

    let selectedRackOptions = new Set();


    function compressImage(file, maxWidth = 1920, maxHeight = 1080, quality = 0.8) {
        return new Promise((resolve) => {
            if (!file.type.startsWith('image/')) {
                resolve(file);
                return;
            }

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = event => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height *= maxWidth / width));
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round((width *= maxHeight / height));
                            height = maxHeight;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (!blob) {
                            resolve(file);
                            return;
                        }
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    }, 'image/jpeg', quality);
                };
                img.onerror = () => resolve(file);
            };
            reader.onerror = () => resolve(file);
        });
    }

    function initCustomFileInput() {
        const state = window.visitaFotosState;
        if (!state) return;

        const btnGeral = document.getElementById('foto-tipo-geral');
        const btnAntesDepois = document.getElementById('foto-tipo-antes-depois');
        const containerGeral = document.getElementById('fotos-geral-container');
        const containerAntesDepois = document.getElementById('fotos-antes-depois-container');

        if (!btnGeral || !btnAntesDepois) return;

        const setModo = (modo) => {
            state.modo = modo;
            if (modo === 'geral') {
                btnGeral.classList.replace('text-slate-400', 'text-white');
                btnGeral.classList.replace('hover:text-white', 'bg-[#FF5E00]');
                btnGeral.classList.add('shadow-md');
                btnAntesDepois.classList.replace('text-white', 'text-slate-400');
                btnAntesDepois.classList.replace('bg-[#FF5E00]', 'hover:text-white');
                btnAntesDepois.classList.remove('shadow-md');
                containerGeral.classList.remove('hidden');
                containerAntesDepois.classList.add('hidden');
            } else {
                btnAntesDepois.classList.replace('text-slate-400', 'text-white');
                btnAntesDepois.classList.replace('hover:text-white', 'bg-[#FF5E00]');
                btnAntesDepois.classList.add('shadow-md');
                btnGeral.classList.replace('text-white', 'text-slate-400');
                btnGeral.classList.replace('bg-[#FF5E00]', 'hover:text-white');
                btnGeral.classList.remove('shadow-md');
                containerAntesDepois.classList.remove('hidden');
                containerGeral.classList.add('hidden');
            }
        };

        btnGeral.onclick = () => setModo('geral');
        btnAntesDepois.onclick = () => setModo('antes-depois');

        window.removeFotoVisita = (type, index) => {
            if (state.fotos[type] && state.fotos[type].length > index) {
                state.fotos[type].splice(index, 1);
                if (type === 'geral' && window.updateGeralPreview) window.updateGeralPreview();
                if (type === 'antes' && window.updateAntesPreview) window.updateAntesPreview();
                if (type === 'depois' && window.updateDepoisPreview) window.updateDepoisPreview();
            }
        };

        const setupInput = (type, inputId, previewId, countId) => {
            const input = document.getElementById(inputId);
            const preview = document.getElementById(previewId);
            const count = document.getElementById(countId);
            if (!input || !preview || !count) return;

            const updatePreview = () => {
                preview.innerHTML = '';
                state.fotos[type].forEach((file, index) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const div = document.createElement('div');
                        div.className = 'relative aspect-square rounded-lg overflow-hidden border border-slate-700 bg-slate-800';
                        div.innerHTML = `<img src="${e.target.result}" class="w-full h-full object-cover">
                        <button type="button" class="absolute top-1 right-1 bg-red-600/90 hover:bg-red-500 text-white p-1 rounded-md transition-colors" onclick="window.removeFotoVisita('${type}', ${index})">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>`;
                        preview.appendChild(div);
                    };
                    reader.readAsDataURL(file);
                });
                count.textContent = `(${state.fotos[type].length}/${state.max[type]})`;
            };

            if (type === 'geral') window.updateGeralPreview = updatePreview;
            if (type === 'antes') window.updateAntesPreview = updatePreview;
            if (type === 'depois') window.updateDepoisPreview = updatePreview;

            input.onchange = async (e) => {
                if (!e.target.files) return;

                // Show a brief loading indication since compression is async
                const originalLabel = count.textContent;
                count.textContent = '(Comprimindo...)';

                const files = Array.from(e.target.files);
                let added = 0;
                for (const rawFile of files) {
                    if (state.fotos[type].length >= state.max[type]) break;

                    let file = rawFile;
                    if (file.type.startsWith('image/')) {
                         file = await compressImage(file, 1920, 1920, 0.8);
                    }

                    if (file.size > 5 * 1024 * 1024) {
                        if (window.showToast) window.showToast('error', `A imagem ${file.name} ainda excede o limite de 5MB após compressão.`);
                        continue;
                    }
                    state.fotos[type].push(file);
                    added++;
                }

                if (added > 0) {
                    updatePreview();
                } else {
                    count.textContent = originalLabel; // Restore if nothing added
                }
                input.value = '';
            };
            
            updatePreview();
        };

        setupInput('geral', 'input-foto-geral', 'preview-geral', 'count-geral');
        setupInput('antes', 'input-foto-antes', 'preview-antes', 'count-antes');
        setupInput('depois', 'input-foto-depois', 'preview-depois', 'count-depois');
    }

    function resetCustomFileInput() {
        const inputGallery = document.getElementById('visita-foto-input');
        const inputCamera = document.getElementById('visita-foto-input-camera');
        const trigger = document.getElementById('visita-foto-trigger');
        const preview = document.getElementById('visita-foto-preview');

        if (inputGallery) inputGallery.value = '';
        if (inputCamera) inputCamera.value = '';
        if (trigger) trigger.classList.remove('hidden');
        if (preview) preview.classList.add('hidden');
    }

    function initRackMultiSelect() {
        const container = document.getElementById('rack-multiselect-container');
        const btn = document.getElementById('rack-multiselect-btn');
        const dropdown = document.getElementById('rack-multiselect-dropdown');
        const input = document.getElementById('tipo_rack_hidden');

        if (!container || !btn || !dropdown || !input) return;

        // Populate Dropdown
        dropdown.innerHTML = '';
        RACK_OPTIONS.forEach(opt => {
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center p-3 hover:bg-slate-700 cursor-pointer transition-colors border-b border-slate-700/50 last:border-0';
            div.dataset.value = opt;
            div.innerHTML = `
                <span class="text-sm text-white select-none">${opt}</span>
                <svg class="w-4 h-4 text-white hidden check-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
            `;

            div.onclick = (e) => {
                e.stopPropagation();
                toggleRackOption(opt, div);
            };
            dropdown.appendChild(div);
        });

        // Toggle Dropdown
        btn.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
            const svg = btn.querySelector('svg:last-child');
            if (svg) svg.classList.toggle('rotate-180');
        };

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.classList.add('hidden');
                const svg = btn.querySelector('svg:last-child'); // The arrow
                if (svg) svg.classList.remove('rotate-180');
            }
        });
    }

    function toggleRackOption(value, element) {
        if (selectedRackOptions.has(value)) {
            selectedRackOptions.delete(value);
            element.classList.remove('bg-[#FF5E00]');
            element.querySelector('.check-icon').classList.add('hidden');
        } else {
            selectedRackOptions.add(value);
            element.classList.add('bg-[#FF5E00]');
            element.querySelector('.check-icon').classList.remove('hidden');
        }
        updateRackInputState();
    }

    function updateRackInputState() {
        const input = document.getElementById('tipo_rack_hidden');
        const textLabel = document.getElementById('rack-multiselect-text');

        const selected = Array.from(selectedRackOptions);
        input.value = selected.join(', ');

        if (selected.length === 0) {
            textLabel.textContent = 'Selecione...';
            textLabel.classList.add('text-slate-400');
            textLabel.classList.remove('text-white');
        } else if (selected.length === 1) {
            textLabel.textContent = selected[0];
            textLabel.classList.remove('text-slate-400');
            textLabel.classList.add('text-white');
        } else {
            textLabel.textContent = `${selected.length} selecionados`;
            textLabel.classList.remove('text-slate-400');
            textLabel.classList.add('text-white');
        }
    }

    function resetRackMultiSelect(initialValueString = '') {
        selectedRackOptions.clear();

        // Parse initial value
        if (initialValueString) {
            // Split by comma and trim
            const parts = initialValueString.split(',').map(s => s.trim());
            parts.forEach(p => {
                if (RACK_OPTIONS.includes(p)) selectedRackOptions.add(p);
            });
        }

        // Sync UI
        const dropdown = document.getElementById('rack-multiselect-dropdown');
        if (dropdown) {
            Array.from(dropdown.children).forEach(div => {
                const val = div.dataset.value;
                if (selectedRackOptions.has(val)) {
                    div.classList.add('bg-[#FF5E00]');
                    div.querySelector('.check-icon').classList.remove('hidden');
                } else {
                    div.classList.remove('bg-[#FF5E00]');
                    div.querySelector('.check-icon').classList.add('hidden');
                }
            });
        }
        updateRackInputState();
    }

    // --- WALLET MANAGEMENT LOGIC ---
    let isWalletInitialized = false;
    let walletState = {
        selectedPromoter: null,
        promoters: []
    };

    function initWalletView() {
        if (isWalletInitialized) return;
        isWalletInitialized = true;

        const role = (window.userRole || '').trim().toUpperCase();

        // Setup User Menu
        const userMenuBtn = document.getElementById('user-menu-btn');
        const userMenuDropdown = document.getElementById('user-menu-dropdown');
        const userMenuWalletBtn = document.getElementById('user-menu-wallet-btn');
        const userMenuLogoutBtn = document.getElementById('user-menu-logout-btn');
        const userMenuRefreshCacheBtn = document.getElementById('user-menu-refresh-cache-btn');

        if (userMenuBtn) {
            // Update User Info in Menu
            const nameEl = document.getElementById('user-menu-name');
            const roleEl = document.getElementById('user-menu-role');
            if (nameEl && roleEl) {
                 roleEl.textContent = role;
                 // Try find name
                 const h = embeddedData.hierarchy || [];
                 const me = h.find(x =>
                    (x.cod_coord && x.cod_coord.trim().toUpperCase() === role) ||
                    (x.cod_cocoord && x.cod_cocoord.trim().toUpperCase() === role) ||
                    (x.cod_promotor && x.cod_promotor.trim().toUpperCase() === role)
                 );
                 if (me) {
                      if (me.cod_coord && me.cod_coord.trim().toUpperCase() === role) nameEl.textContent = me.nome_coord;
                      else if (me.cod_cocoord && me.cod_cocoord.trim().toUpperCase() === role) nameEl.textContent = me.nome_cocoord;
                      else nameEl.textContent = me.nome_promotor;
                 } else {
                      // Fallback for Seller/Supervisor
                      const formatName = (n) => {
                          if (!n) return 'Usuário';
                          const parts = String(n).split(' ').filter(p => p.trim().length > 0);
                          if (parts.length <= 2) return n;
                          return `${parts[0]} ${parts[1]}`;
                      };

                      if (window.userIsSeller) {
                          let foundName = null;
                          if (typeof sellerDetailsMap !== 'undefined' && sellerDetailsMap.has(role)) {
                              const d = sellerDetailsMap.get(role);
                              if (d && d.name) foundName = d.name;
                          }
                          if (foundName) nameEl.textContent = formatName(foundName);
                      } else if (window.userIsSupervisor) {
                          let foundName = null;
                          if (typeof supervisorDetailsMap !== 'undefined' && supervisorDetailsMap.has(role)) {
                              const d = supervisorDetailsMap.get(role);
                              if (d && d.name) foundName = d.name;
                          }
                          if (foundName) nameEl.textContent = formatName(foundName);
                      }
                 }
            }

            userMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenuDropdown.classList.toggle('hidden');
            });

            document.addEventListener('click', (e) => {
                if (!userMenuBtn.contains(e.target) && !userMenuDropdown.contains(e.target)) {
                    userMenuDropdown.classList.add('hidden');
                }
            });

            if (userMenuRefreshCacheBtn) {
                userMenuRefreshCacheBtn.classList.remove('hidden');
                userMenuRefreshCacheBtn.addEventListener('click', async () => {
                    if(confirm('Isso forçará o recarregamento de todas as tabelas e imagens, demorando alguns minutos. Deseja continuar?')) {
                        if (window.localforage) await window.localforage.clear();
                        if (window.idb) {
                            const db = await window.idb.openDB('PrimeDashboardDB_V2', 1);
                            await db.clear('data_store');
                        }
                        // Force unregister service worker and clear all browser caches if possible
                        if (typeof navigator.serviceWorker !== 'undefined') {
                           navigator.serviceWorker.getRegistrations().then(function(registrations) {
                             for(let registration of registrations) { registration.unregister(); }
                           });
                        }
                        window.location.reload(true);
                    }
                });
            }

            userMenuWalletBtn.addEventListener('click', () => {
                userMenuDropdown.classList.add('hidden');
                navigateTo('wallet');
            });

            userMenuLogoutBtn.addEventListener('click', async () => {
                 const { error } = await window.supabaseClient.auth.signOut();
                 if (!error) window.location.reload();
            });
        }

        // Setup Wallet Controls
        const selectBtn = document.getElementById('wallet-promoter-select-btn');
        const dropdown = document.getElementById('wallet-promoter-dropdown');

        if (selectBtn) {
            selectBtn.addEventListener('click', (e) => {
                if (walletState.promoters.length <= 1) return;
                e.stopPropagation();
                dropdown.classList.toggle('hidden');
            });

            document.addEventListener('click', (e) => {
                if (!selectBtn.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.add('hidden');
                }
            });
        }

        // Search
        const searchInput = document.getElementById('wallet-client-search');
        let debounce;
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounce);
                debounce = setTimeout(() => handleWalletSearch(e.target.value), 400);
            });
            // Click outside suggestions
             document.addEventListener('click', (e) => {
                const sugg = document.getElementById('wallet-search-suggestions');
                if (sugg && !sugg.contains(e.target) && e.target !== searchInput) {
                    sugg.classList.add('hidden');
                }
            });
        }

        // Modal Actions
        const modalCancel = document.getElementById('wallet-modal-cancel-btn');
        const modalClose = document.getElementById('wallet-modal-close-btn');

        const closeWalletModal = () => {
            document.getElementById('wallet-client-modal').classList.add('hidden');
        };

        if(modalCancel) modalCancel.onclick = closeWalletModal;
        if(modalClose) modalClose.onclick = closeWalletModal;
    }

    window.renderWalletView = function() {
        initWalletView();

        // Populate Promoters if empty
        if (walletState.promoters.length === 0) {
             const role = (window.userRole || '').trim().toUpperCase();
             const hierarchy = embeddedData.hierarchy || [];
             const myPromoters = new Set();
             let isManager = (role === 'ADM');

             hierarchy.forEach(h => {
                 const c = (h.cod_coord||'').trim().toUpperCase();
                 const cc = (h.cod_cocoord||'').trim().toUpperCase();
                 const pRaw = (h.cod_promotor||'').trim(); // Keep raw case
                 const p = pRaw.toUpperCase(); // For comparison
                 const pName = h.nome_promotor || pRaw;

                 if (role === 'ADM' || c === role || cc === role) {
                     isManager = true;
                     if (pRaw) myPromoters.add(JSON.stringify({ code: pRaw, name: pName }));
                 } else if (p === role) {
                     if (pRaw) myPromoters.add(JSON.stringify({ code: pRaw, name: pName }));
                 }
            });

            walletState.promoters = Array.from(myPromoters).map(s => JSON.parse(s)).sort((a,b) => a.name.localeCompare(b.name));
            walletState.canEdit = isManager;

            // UI Toggle based on permission
            const searchContainer = document.getElementById('wallet-search-container');
            if (searchContainer) {
                if (walletState.canEdit) searchContainer.classList.remove('hidden');
                else searchContainer.classList.add('hidden');
            }

            // Build Dropdown
            const dropdown = document.getElementById('wallet-promoter-dropdown');
            if (dropdown) {
                dropdown.innerHTML = '';
                walletState.promoters.forEach(p => {
                     const div = document.createElement('div');
                     div.className = 'px-4 py-2 hover:bg-slate-700 cursor-pointer text-sm text-slate-300 hover:text-white border-b border-slate-700/50 last:border-0';
                     div.textContent = `${p.code} - ${p.name}`;
                     div.onclick = () => {
                         selectWalletPromoter(p.code, p.name);
                         dropdown.classList.add('hidden');
                     };
                     dropdown.appendChild(div);
                });
            }

            // Auto Select
            if (walletState.promoters.length === 1) {
                selectWalletPromoter(walletState.promoters[0].code, walletState.promoters[0].name);
                const btn = document.getElementById('wallet-promoter-select-btn');
                if(btn) {
                    btn.classList.add('opacity-75', 'cursor-default');
                    const svg = btn.querySelector('svg');
                    if(svg) svg.classList.add('hidden');
                }
            } else if (walletState.promoters.length > 0) {
                 if (!walletState.selectedPromoter) {
                     // Optionally select first
                 }
            }
        }

        renderWalletTable();
    }

    window.selectWalletPromoter = async function(code, name) {
        walletState.selectedPromoter = code;
        const txt = document.getElementById('wallet-promoter-select-text');
        const btn = document.getElementById('wallet-promoter-select-btn');

        if (code) {
             if(txt) txt.textContent = `${code} - ${name}`;

             // Inject Clear Icon if not exists
             let clearIcon = document.getElementById('wallet-promoter-clear-icon');
             if (!clearIcon && btn) {
                 clearIcon = document.createElement('div');
                 clearIcon.id = 'wallet-promoter-clear-icon';
                 clearIcon.className = 'p-1 hover:bg-slate-700 rounded-full cursor-pointer mr-2 transition-colors';
                 clearIcon.innerHTML = `<svg class="w-4 h-4 text-slate-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;

                 clearIcon.onclick = (e) => {
                     e.stopPropagation();
                     selectWalletPromoter(null, null);
                 };

                 // Insert before the arrow icon
                 const arrow = btn.querySelector('svg:not(#wallet-promoter-clear-icon svg)');
                 if (arrow) btn.insertBefore(clearIcon, arrow);
                 else btn.appendChild(clearIcon);
             }
        } else {
             if(txt) txt.textContent = 'Selecione...';
             const clearIcon = document.getElementById('wallet-promoter-clear-icon');
             if (clearIcon) clearIcon.remove();
        }

        // --- Fetch Missing Clients Logic ---
        if (code) {
            const targetPromoter = String(code).trim().toUpperCase();
            const clientCodes = [];

            // 1. Identify all clients linked to this promoter in the map
            if (embeddedData.clientPromoters) {
                embeddedData.clientPromoters.forEach(cp => {
                    if (cp.promoter_code && String(cp.promoter_code).trim().toUpperCase() === targetPromoter) {
                        clientCodes.push(normalizeKey(cp.client_code));
                    }
                });
            }

            if (clientCodes.length > 0) {
                // 2. Identify which are missing from local embeddedData.clients
                const dataset = embeddedData.clients;
                const existingCodes = new Set();
                const isColumnar = dataset && dataset.values && dataset.columns;

                if (isColumnar) {
                    const col = dataset.values['Código'] || dataset.values['CODIGO_CLIENTE'] || [];
                    const len = dataset.length || col.length || 0;
                    for(let i=0; i<len; i++) existingCodes.add(normalizeKey(col[i]));
                } else if (Array.isArray(dataset)) {
                    dataset.forEach(c => existingCodes.add(normalizeKey(c['Código'] || c['codigo_cliente'])));
                }

                const missing = clientCodes.filter(c => !existingCodes.has(c));

                if (missing.length > 0) {
                    const badge = document.getElementById('wallet-count-badge');
                    if(badge) badge.textContent = '...';

                    try {
                        // 3. Fetch missing clients
                        const { data, error } = await window.supabaseClient
                            .from('data_clients')
                            .select('*')
                            .in('codigo_cliente', missing);

                        if (!error && data && data.length > 0) {
                            // 4. Inject into embeddedData.clients
                            data.forEach(newClient => {
                                // Double check uniqueness before push (race condition)
                                if (existingCodes.has(normalizeKey(newClient.codigo_cliente))) return;

                                const mapped = {
                                     'Código': newClient.codigo_cliente,
                                     'Fantasia': newClient.fantasia,
                                     'Razão Social': newClient.razaosocial,
                                     'CNPJ/CPF': newClient.cnpj_cpf,
                                     'Cidade': newClient.cidade,
                                     'PROMOTOR': code // Use the selected promoter code
                                 };

                                 if (isColumnar) {
                                     dataset.columns.forEach(colName => {
                                         let val = '';
                                         const c = colName.toUpperCase();
                                         if(c === 'CÓDIGO' || c === 'CODIGO_CLIENTE') val = newClient.codigo_cliente;
                                         else if(c === 'FANTASIA' || c === 'NOMECLIENTE') val = newClient.fantasia;
                                         else if(c === 'RAZÃO SOCIAL' || c === 'RAZAOSOCIAL' || c === 'RAZAO') val = newClient.razaosocial;
                                         else if(c === 'CNPJ/CPF' || c === 'CNPJ') val = newClient.cnpj_cpf;
                                         else if(c === 'CIDADE') val = newClient.cidade;
                                         else if(c === 'PROMOTOR') val = code;
                                         else if(c === 'RCA1' || c === 'RCA 1') val = newClient.rca1;

                                         if(dataset.values[colName]) dataset.values[colName].push(val);
                                     });
                                     dataset.length++;
                                 } else if (Array.isArray(dataset)) {
                                     dataset.push(mapped);
                                 }
                                 existingCodes.add(normalizeKey(newClient.codigo_cliente));
                            });
                        }
                    } catch (e) {
                        console.error("Erro ao buscar clientes faltantes:", e);
                    }
                }
            }
        }

        renderWalletTable();
    }

    window.renderWalletTable = function() {
        const promoter = walletState.selectedPromoter;
        const tbody = document.getElementById('wallet-table-body');
        const mobileList = document.getElementById('wallet-mobile-list');
        const empty = document.getElementById('wallet-empty-state');
        const badge = document.getElementById('wallet-count-badge');

        // Toggle Action Header (Removed as per user request)

        if (!tbody) return;
        tbody.innerHTML = '';
        if (mobileList) mobileList.innerHTML = '';

        const dataset = embeddedData.clients;
        const isColumnar = dataset && dataset.values && dataset.columns;
        const len = dataset.length || 0;

        const clientPromoterMap = new Map();

        // Normalize selected promoter for comparison
        const targetPromoter = String(promoter).trim().toUpperCase();

        if (embeddedData.clientPromoters) {
             embeddedData.clientPromoters.forEach(cp => {
                 // Store normalized promoter code in map
                 if (cp.promoter_code) {
                    clientPromoterMap.set(normalizeKey(cp.client_code), String(cp.promoter_code).trim().toUpperCase());
                 }
             });
        }

        let count = 0;
        let renderedCount = 0;
        const fragment = document.createDocumentFragment();
        const RENDER_LIMIT = 150;

        for(let i=0; i<len; i++) {
             let rowCode, rowFantasia, rowRazao, rowCnpj, rowUltimaCompra, rowBloqueio;

             if (isColumnar) {
                 rowCode = dataset.values['Código']?.[i] || dataset.values['CODIGO_CLIENTE']?.[i] || dataset.values['codigo_cliente']?.[i];
                 rowFantasia = dataset.values['Fantasia']?.[i] || dataset.values['FANTASIA']?.[i] || dataset.values['fantasia']?.[i] || dataset.values['NOMECLIENTE']?.[i] || dataset.values['nomeCliente']?.[i];
                 rowRazao = dataset.values['Razão Social']?.[i] || dataset.values['RAZAOSOCIAL']?.[i] || dataset.values['razaoSocial']?.[i];
                 rowCnpj = dataset.values['CNPJ/CPF']?.[i] || dataset.values['CNPJ']?.[i] || dataset.values['cnpj_cpf']?.[i];
                 rowUltimaCompra = dataset.values['ultimacompra']?.[i] || dataset.values['ULTIMACOMPRA']?.[i] || dataset.values['Data da Última Compra']?.[i] || dataset.values['ultimaCompra']?.[i];
                 rowBloqueio = dataset.values['bloqueio']?.[i] || dataset.values['BLOQUEIO']?.[i];
             } else if (Array.isArray(dataset)) {
                 const item = dataset[i];
                 if (!item) continue;
                 rowCode = item['Código'] || item['codigo_cliente'] || item['CODIGO_CLIENTE'];
                 rowFantasia = item['Fantasia'] || item['fantasia'] || item['FANTASIA'] || item['nomeCliente'] || item['NOMECLIENTE'];
                 rowRazao = item['Razão Social'] || item['razaosocial'] || item['razaoSocial'] || item['RAZAOSOCIAL'];
                 rowCnpj = item['CNPJ/CPF'] || item['cnpj_cpf'] || item['CNPJ'];
                 rowUltimaCompra = item['ultimacompra'] || item['ULTIMACOMPRA'] || item['Data da Última Compra'] || item['ultimaCompra'];
                 rowBloqueio = item['bloqueio'] || item['BLOQUEIO'];
             } else {
                 continue;
             }

             if (!rowCode) continue;

             const code = normalizeKey(rowCode);
             const linkedPromoter = clientPromoterMap.get(code);

             // Compare normalized values OR show all if no promoter selected
             if (!promoter || linkedPromoter === targetPromoter) {
                 count++;

                 // Apply Limit for DOM Rendering
                 if (renderedCount < RENDER_LIMIT) {
                     renderedCount++;

                     const tr = document.createElement('tr');
                     tr.className = 'hover:bg-glass transition-colors border-b border-white/10/50 cursor-pointer';
                     tr.setAttribute('onclick', `openWalletClientModal('${code}')`);

                     // Mobile Layout (Single Cell)
                     const mobileCell = `
                        <td class="md:hidden mobile-card-header p-4 border-b border-white/10" colspan="3">
                            <div class="flex flex-col text-left items-start">
                                <div class="text-sm font-bold text-white mb-1 text-left">
                                    ${code} - ${rowFantasia || 'N/A'}
                                </div>
                                <div class="text-xs text-slate-500 font-medium uppercase text-left">
                                    ${rowCnpj || ''} ${rowRazao || ''}
                                </div>
                            </div>
                        </td>
                     `;

                     // Desktop Layout (Columns)
                     const desktopCells = `
                        <td data-label="Código" class="hidden md:table-cell px-6 py-4 font-mono text-xs text-slate-400 w-32 border-b border-white/10">${code}</td>
                        <td data-label="Cliente" class="hidden md:table-cell px-6 py-4 border-b border-white/10">
                            <div class="text-sm font-bold text-white truncate">${rowFantasia || 'N/A'}</div>
                            <div class="text-xs text-slate-500 truncate">${rowRazao || ''}</div>
                        </td>
                        <td data-label="CNPJ" class="hidden md:table-cell px-6 py-4 text-xs text-slate-400 border-b border-white/10">${rowCnpj || ''}</td>
                     `;

                     tr.innerHTML = mobileCell + desktopCells;
                     fragment.appendChild(tr);
                 }
             }
        }

        tbody.appendChild(fragment);
        if (badge) badge.textContent = count;

        if (count === 0) empty.classList.remove('hidden');
        else empty.classList.add('hidden');
    }

    async function handleWalletSearch(query) {
        const sugg = document.getElementById('wallet-search-suggestions');
        if (!query || query.trim().length < 3) {
            sugg.classList.add('hidden');
            return;
        }

        const terms = query.split('%').map(t => t.trim()).filter(t => t.length > 0);

        if (terms.length === 0) {
             sugg.classList.add('hidden');
             return;
        }

        let dbQuery = window.supabaseClient.from('data_clients').select('*');

        // Apply AND logic for each term (term must match at least one field)
        terms.forEach(term => {
             const cleanTerm = term.replace(/[^a-zA-Z0-9]/g, '');
             // Basic fields including City and Bairro as requested
             let orClause = `codigo_cliente.ilike.%${term}%,fantasia.ilike.%${term}%,razaosocial.ilike.%${term}%,cnpj_cpf.ilike.%${term}%,cidade.ilike.%${term}%,bairro.ilike.%${term}%`;

             // Add clean variations if they differ (mostly for CNPJ/Codes)
             if (cleanTerm.length > 0 && cleanTerm !== term) {
                 orClause += `,cnpj_cpf.ilike.%${cleanTerm}%,codigo_cliente.ilike.%${cleanTerm}%`;
             }

             dbQuery = dbQuery.or(orClause);
        });

        const { data, error } = await dbQuery.limit(10);

        if (error || !data || data.length === 0) {
            sugg.classList.add('hidden');
            return;
        }

        sugg.innerHTML = '';
        data.forEach(c => {
            const div = document.createElement('div');
            div.className = 'px-4 py-3 border-b border-slate-700 hover:bg-slate-700 cursor-pointer flex justify-between items-center group';
            div.innerHTML = `
                <div>
                    <div class="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                        <span class="font-mono text-slate-400 mr-2">${c.codigo_cliente}</span>
                        ${c.fantasia || c.razaosocial}
                    </div>
                    <div class="text-xs text-slate-500">${c.cidade || ''} • ${c.cnpj_cpf || ''}</div>
                </div>
                 <div class="p-2 glass-panel-heavy rounded-full group-hover:bg-[#FF5E00] transition-colors text-slate-400 group-hover:text-white">
                     <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
            `;
            div.onclick = () => {
                sugg.classList.add('hidden');
                document.getElementById('wallet-client-search').value = '';
                openWalletClientModal(c.codigo_cliente, c);
            };
            sugg.appendChild(div);
        });
        sugg.classList.remove('hidden');
    }

    window.openWalletClientModal = async function(clientCode, clientData = null) {
        let client = clientData;
        if (!client) {
             const { data } = await window.supabaseClient.from('data_clients').select('*').eq('codigo_cliente', clientCode).single();
             client = data;
        }
        if (!client) return;

        // Merge Itinerary Data from embeddedData.clientPromoters (Memory Cache)
        // This ensures we show the latest Saved data even if data_clients table is stale
        if (embeddedData.clientPromotersMap) {
             // O(1) Lookup
             const matches = embeddedData.clientPromotersMap.get(normalizeKey(clientCode));
             if (matches && matches.length > 0) {
                 const promoData = matches[0];
                 client.itinerary_frequency = promoData.itinerary_frequency;
                 client.itinerary_next_date = promoData.itinerary_ref_date;
             }
        } else if (optimizedData.clientPromotersMap) {
             // O(1) Lookup (Old Map)
             const promoData = optimizedData.clientPromotersMap.get(normalizeKey(clientCode));
             if (promoData) {
                 client.itinerary_frequency = promoData.itinerary_frequency;
                 client.itinerary_next_date = promoData.itinerary_ref_date;
             }


        const modal = document.getElementById('wallet-client-modal');
        const codeKey = String(client['Código'] || client['codigo_cliente']);

        // 1. Populate Basic Info
        document.getElementById('wallet-modal-code').textContent = codeKey;

        // Robust Key Access
        const getVal = (keys) => {
            for (const k of keys) {
                if (client[k]) return client[k];
            }
            return null;
        };

        document.getElementById('wallet-modal-cnpj').textContent = getVal(['cnpj_cpf', 'CNPJ/CPF', 'CNPJ', 'CPF']) || '--';

        // Razão Social: try variations including Name fallback if Razao is missing
        const razao = getVal(['razaosocial', 'Razão Social', 'RAZAOSOCIAL', 'razao', 'RAZAO', 'nomeCliente', 'NOMECLIENTE', 'Cliente', 'CLIENTE']);
        document.getElementById('wallet-modal-razao').textContent = razao || '--';

        // Fantasia: try variations
        const fantasia = getVal(['fantasia', 'Fantasia', 'FANTASIA', 'nome_fantasia', 'NOME_FANTASIA']);
        document.getElementById('wallet-modal-fantasia').textContent = fantasia || '--';

        const bairro = getVal(['bairro', 'BAIRRO']) || '';
        const cidade = getVal(['cidade', 'CIDADE']) || '';
        document.getElementById('wallet-modal-city').textContent = (bairro && bairro !== 'N/A') ? `${bairro} - ${cidade}` : cidade;

        // Address & Seller
        const address = buildAddress(client, 1);
        document.getElementById('wallet-modal-address').textContent = address || 'Endereço não disponível';

        const rca1 = String(client.rca1 || client['RCA 1'] || '');
        let sellerName = rca1;

        let resolvedName = optimizedData.rcaNameByCode ? optimizedData.rcaNameByCode.get(rca1) : null;

        // Fallback: If name is missing or "INATIVOS", try to find a valid name in current sales
        if (!resolvedName || resolvedName.toUpperCase() === 'INATIVOS') {
            // Check Seller Details Map (Populated from History AND Current Sales now)
            if (sellerDetailsMap && sellerDetailsMap.has(rca1)) {
                const details = sellerDetailsMap.get(rca1);
                if (details && details.name && details.name.toUpperCase() !== 'INATIVOS') {
                    resolvedName = details.name;
                }
            }
        }

        if (resolvedName) {
            sellerName = `${rca1} - ${resolvedName}`;
        }

        document.getElementById('wallet-modal-seller').textContent = sellerName || '--';

        // 2. Tabs Logic
        const tabs = document.querySelectorAll('.wallet-tab-btn');
        const contents = {
            general: document.getElementById('wallet-tab-content-general'),
            losses: document.getElementById('wallet-tab-content-losses'),
            bonus: document.getElementById('wallet-tab-content-bonus'),
            itinerary: document.getElementById('wallet-tab-content-itinerary')
        };

        // Initialize Modal Tab History
        modal._tabHistory = [];
        let activeTab = 'general';

        // Visibility Control: Hide Itinerary Tab if user cannot edit (Promoter)
        const itineraryTabBtn = document.querySelector('.wallet-tab-btn[data-tab="itinerary"]');
        if (itineraryTabBtn) {
            if (walletState.canEdit) {
                itineraryTabBtn.classList.remove('hidden');
            } else {
                itineraryTabBtn.classList.add('hidden');
            }
        }

        const switchTab = (tabName, options = {}) => {
            if (!options.skipHistory && activeTab !== tabName) {
                const prev = activeTab;
                modal._tabHistory.push({
                    name: prev,
                    restore: () => switchTab(prev, { skipHistory: true })
                });
            }

            activeTab = tabName;

            tabs.forEach(t => {
                if (t.dataset.tab === tabName) {
                    t.classList.add('active', 'text-[#FF5E00]', 'border-[#FF5E00]');
                    t.classList.remove('text-slate-400', 'border-transparent');
                } else {
                    t.classList.remove('active', 'text-[#FF5E00]', 'border-[#FF5E00]');
                    t.classList.add('text-slate-400', 'border-transparent');
                }
            });
            Object.keys(contents).forEach(k => {
                if (contents[k]) {
                    if (k === tabName) contents[k].classList.remove('hidden');
                    else contents[k].classList.add('hidden');
                }
            });
        };

        tabs.forEach(t => t.onclick = () => switchTab(t.dataset.tab));
        switchTab('general', { skipHistory: true }); // Default

        // --- POPULATE ITINERARY FIELDS ---
        const itinFreqInputs = document.querySelectorAll('input[name="itinerary-frequency"]');
        const itinDateInput = document.getElementById('itinerary-next-date');
        const itinSaveBtn = document.getElementById('save-itinerary-btn');
        const daysContainer = document.getElementById('itinerary-days-container');
        const calcPreview = document.getElementById('itinerary-calc-preview');

        // Reset inputs
        itinFreqInputs.forEach(i => i.checked = false);
        if(itinDateInput) itinDateInput.value = '';
        document.querySelectorAll('input[name="itinerary-day"]').forEach(cb => cb.checked = false);

        // Get Values
        const freqVal = client.ITINERARY_FREQUENCY || client.itinerary_frequency;
        const dateVal = client.ITINERARY_NEXT_DATE || client.itinerary_next_date;
        const daysVal = client.ITINERARY_DAYS || client.itinerary_days || '';

        // Bind Visibility Toggle
        itinFreqInputs.forEach(inp => {
            inp.onchange = () => {
                if (inp.value === 'weekly') {
                    if(daysContainer) daysContainer.classList.remove('hidden');
                } else {
                    if(daysContainer) daysContainer.classList.add('hidden');
                }
                // Defer calculation to allow UI repaint
                setTimeout(updatePrediction, 0);
            };
        });

        // Set Initial Values
        if (freqVal) {
            itinFreqInputs.forEach(i => {
                if(i.value === freqVal) {
                    i.checked = true;
                    // Trigger visibility
                    if(freqVal === 'weekly' && daysContainer) daysContainer.classList.remove('hidden');
                    else if (daysContainer) daysContainer.classList.add('hidden');
                }
            });
        } else {
            // Default hidden
            if (daysContainer) daysContainer.classList.add('hidden');
        }

        if (daysVal) {
            const selected = daysVal.split(',').map(s => s.trim());
            document.querySelectorAll('input[name="itinerary-day"]').forEach(cb => {
                cb.checked = selected.includes(cb.value);
            });
        }

        // Live Prediction Logic
        const updatePrediction = () => {
            if (!calcPreview || !itinDateInput) return;

            const freq = document.querySelector('input[name="itinerary-frequency"]:checked')?.value;
            const refDate = itinDateInput.value;

            if (!freq || !refDate) {
                calcPreview.textContent = 'Selecione frequência e data para calcular.';
                return;
            }

            // Create temp client object for calculation
            const tempClient = {
                ITINERARY_FREQUENCY: freq,
                ITINERARY_NEXT_DATE: refDate,
                ITINERARY_DAYS: ''
            };

            if (freq === 'weekly') {
                const days = [];
                document.querySelectorAll('input[name="itinerary-day"]:checked').forEach(cb => days.push(cb.value));
                tempClient.ITINERARY_DAYS = days.join(',');
            }

            // Use 'today' as base to find next visit from NOW
            const next = calculateNextRoteiroDate(tempClient, new Date());

            if (next) {
                const options = { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' };
                calcPreview.innerHTML = `Próximo atendimento previsto: <strong class="text-white">${next.toLocaleDateString('pt-BR', options)}</strong>`;
            } else {
                calcPreview.textContent = 'Não foi possível calcular.';
            }
        };

        // Bind listeners for live update (Using onchange to prevent stacking listeners on reopen)
        if (itinDateInput) itinDateInput.onchange = updatePrediction;
        document.querySelectorAll('input[name="itinerary-day"]').forEach(cb => {
            cb.onchange = updatePrediction;
        });

        if (dateVal) {
            // Auto-update Display Date Logic
            // If the stored reference date has passed, show the *next* valid future date based on frequency.
            // This prevents showing an old date and helps the user visualize the current schedule status.

            const d = parseDate(dateVal);
            if (d) {
                let displayDate = d;

                // Only calculate if we have a valid frequency
                if (freqVal === 'weekly' || freqVal === 'biweekly') {
                    const today = new Date();
                    today.setHours(0,0,0,0);

                    // Use UTC for day diff calculation to avoid timezone issues
                    const utcRef = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
                    const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

                    if (utcRef < utcToday) {
                        const diffTime = utcToday - utcRef;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        const interval = (freqVal === 'weekly') ? 7 : 14;

                        // Calculate days to add to reach next cycle >= today
                        // We want the smallest N where Ref + (N * interval) >= Today
                        // Ref + X = Today -> X = Today - Ref = diffDays
                        // We need ceil(diffDays / interval) * interval

                        const cycles = Math.ceil(diffDays / interval);
                        const daysToAdd = cycles * interval;

                        // Create new date object from ref
                        const nextFutureDate = new Date(d);
                        nextFutureDate.setDate(d.getDate() + daysToAdd);
                        displayDate = nextFutureDate;
                    }
                }

                // Format YYYY-MM-DD
                // Use UTC components to prevent local timezone shift (e.g. 11/02 becoming 10/02)
                const yyyy = displayDate.getUTCFullYear();
                const mm = String(displayDate.getUTCMonth() + 1).padStart(2, '0');
                const dd = String(displayDate.getUTCDate()).padStart(2, '0');
                itinDateInput.value = `${yyyy}-${mm}-${dd}`;
            }
        }

        // Bind Save Button
        if (itinSaveBtn) {
            // Remove old listeners
            const newBtn = itinSaveBtn.cloneNode(true);
            itinSaveBtn.parentNode.replaceChild(newBtn, itinSaveBtn);

            newBtn.onclick = () => {
                const selectedFreq = document.querySelector('input[name="itinerary-frequency"]:checked')?.value;
                const selectedDate = document.getElementById('itinerary-next-date')?.value;

                let selectedDays = [];
                if (selectedFreq === 'weekly') {
                    document.querySelectorAll('input[name="itinerary-day"]:checked').forEach(cb => {
                        selectedDays.push(cb.value);
                    });
                }
                const daysStr = selectedDays.join(',');

                saveClientItinerary(codeKey, selectedFreq, selectedDate, daysStr);
            };
        }

        // 3. Calculate Metrics (Sales, Losses, Bonus)
        const metrics = {
            salesByMonth: new Map(), // Map<YYYY-MM, value>
            lossesByMonth: new Map(), // Map<YYYY-MM, { value, items: [] }>
            bonusByMonth: new Map(), // Map<YYYY-MM, { value, items: [] }>
            ordersByMonth: new Map() // Map<YYYY-MM, Map<PEDIDO, {date, totalValue, products: Set, types: Set}>>
        };

        const normalizeItem = (s) => ({
            d: parseDate(s.DTPED),
            val: Number(s.VLVENDA) || 0,
            bon: Number(s.VLBONIFIC) || 0,
            type: String(s.TIPOVENDA),
            prod: s.PRODUTO,
            desc: s.DESCRICAO,
            pedido: s.PEDIDO,
            qty: Number(s.QTVENDA) || 0
        });

        const processSaleItem = (s) => {
            if (normalizeKey(s.CODCLI) !== normalizeKey(codeKey)) return;

            const item = normalizeItem(s);
            if (!item.d) return;

            const monthKey = `${item.d.getUTCFullYear()}-${String(item.d.getUTCMonth()+1).padStart(2,'0')}`;

            // Track Orders
            if (item.pedido) {
                let monthOrders = metrics.ordersByMonth.get(monthKey);
                if (!monthOrders) {
                    monthOrders = new Map();
                    metrics.ordersByMonth.set(monthKey, monthOrders);
                }
                let orderData = monthOrders.get(item.pedido);
                if (!orderData) {
                    orderData = { date: item.d, totalValue: 0, products: new Set(), types: new Set() };
                    monthOrders.set(item.pedido, orderData);
                }
                
                // For Perdas (5) and Bonificacoes (11), use item.bon or fallback to item.val
                const itemTotal = (item.type === '5' || item.type === '11') ? (item.bon || item.val) : item.val;
                if (itemTotal > 0) orderData.totalValue += itemTotal;
                
                if (item.type) orderData.types.add(item.type);
                if (item.prod) orderData.products.add(item.prod);
            }

            // General Sales (Type 1, 9, etc - usually non-bonus or specific types? Just sum VLVENDA for Total Purchase)
            if (item.val > 0) {
                metrics.salesByMonth.set(monthKey, (metrics.salesByMonth.get(monthKey) || 0) + item.val);
            }

            // Perdas (Type 5)
            if (item.type === '5') {
                const entry = metrics.lossesByMonth.get(monthKey) || { value: 0, items: [] };
                entry.value += (item.bon || item.val);
                entry.items.push(item);
                metrics.lossesByMonth.set(monthKey, entry);
            }

            // Bonificações (Type 11)
            if (item.type === '11') {
                const entry = metrics.bonusByMonth.get(monthKey) || { value: 0, items: [] };
                entry.value += (item.bon || item.val);
                entry.items.push(item);
                metrics.bonusByMonth.set(monthKey, entry);
            }
        };

        // Iterate History
        if (allHistoryData instanceof ColumnarDataset) {
            const indices = optimizedData.indices.history.byClient.get(normalizeKey(normalizeKey(codeKey)));
            if (indices) {
                indices.forEach(idx => processSaleItem(allHistoryData.get(idx)));
            }
        } else {
            for(let i=0; i<allHistoryData.length; i++) processSaleItem(allHistoryData[i]);
        }

        // Iterate Current Sales (Month) - Added per user request
        if (allSalesData instanceof ColumnarDataset) {
            const indices = optimizedData.indices.current.byClient.get(normalizeKey(normalizeKey(codeKey)));
            if (indices) {
                indices.forEach(idx => processSaleItem(allSalesData.get(idx)));
            }
        } else {
            for(let i=0; i<allSalesData.length; i++) processSaleItem(allSalesData[i]);
        }

        // 4. Render Tab Content

        // General: Sales History Table
        const salesBody = document.getElementById('wallet-purchase-history-body');
        salesBody.innerHTML = '';
        const sortedMonths = Array.from(metrics.salesByMonth.keys()).sort().reverse().slice(0, 6); // Last 6 months (as requested)
        if (sortedMonths.length === 0) {
            salesBody.innerHTML = '<tr><td colspan="4" class="px-4 py-3 text-center text-slate-500">Sem histórico recente</td></tr>';
        } else {
            sortedMonths.forEach(m => {
                const val = metrics.salesByMonth.get(m) || 0;
                const lossesObj = metrics.lossesByMonth.get(m);
                const bonusObj = metrics.bonusByMonth.get(m);
                
                const lossesVal = lossesObj ? lossesObj.value : 0;
                const bonusVal = bonusObj ? bonusObj.value : 0;
                
                const pPerc = val > 0 ? ((lossesVal / val) * 100).toFixed(1) + '%' : '0%';
                const bPerc = val > 0 ? ((bonusVal / val) * 100).toFixed(1) + '%' : '0%';
                
                const [y, mo] = m.split('-');
                const monthName = new Date(y, mo-1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
                
                const tr = document.createElement('tr');
                tr.className = "cursor-pointer hover:bg-slate-800/50 transition-colors border-b border-slate-800/50 last:border-0";
                
                tr.innerHTML = `
                    <td class="px-4 py-2 capitalize text-slate-300 w-1/3">
                        <div class="flex items-center gap-1">
                            <svg class="w-3 h-3 text-slate-500 transition-transform duration-200 transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                            ${monthName}
                        </div>
                    </td>
                    <td class="px-2 py-2 text-right font-mono font-bold text-white">${val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
                    <td class="px-2 py-2 text-center text-[10px] font-mono font-bold text-red-400">${pPerc}</td>
                    <td class="px-2 py-2 text-center text-[10px] font-mono font-bold text-blue-400">${bPerc}</td>
                `;
                
                // Build Sub-row for Orders
                const ordersRow = document.createElement('tr');
                ordersRow.className = "hidden bg-slate-900/30";
                const ordersCell = document.createElement('td');
                ordersCell.colSpan = 4;
                ordersCell.className = "p-0";
                
                const monthOrders = metrics.ordersByMonth.get(m);
                if (monthOrders && monthOrders.size > 0) {
                    let ordersHtml = `<div class="py-2 px-4 border-t border-slate-800/50 space-y-2">`;
                    // Sort orders by date descending
                    const sortedOrders = Array.from(monthOrders.entries()).sort((a,b) => b[1].date - a[1].date);
                    
                    sortedOrders.forEach(([pedidoId, orderData]) => {
                        const dateStr = orderData.date.toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric'});
                        const totalStr = orderData.totalValue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
                        const mixCount = orderData.products.size;
                        
                        // Extract type info if available
                        let typeLabels = '';
                        if (orderData.types && orderData.types.size > 0) {
                            const typesArr = Array.from(orderData.types).filter(t => t);
                            if (typesArr.length > 0) {
                                typeLabels = '<span class="text-[10px] text-slate-500 ml-2 font-normal">(Tipo ' + typesArr.join(', ') + ')</span>';
                            }
                        }
                        
                        ordersHtml += `
                            <div class="flex items-center justify-between text-xs p-2 rounded bg-slate-800/40 border border-slate-700/50">
                                <div class="flex flex-col">
                                    <div>
                                        <span class="text-blue-400 font-mono font-bold cursor-pointer hover:underline" onclick="event.stopPropagation(); window.openModal('${pedidoId}');">#${pedidoId}</span>${typeLabels}
                                    </div>
                                    <span class="text-slate-400">${dateStr}</span>
                                </div>
                                <div class="flex flex-col items-end">
                                    <span class="text-white font-mono font-bold">${totalStr}</span>
                                    <span class="text-[10px] text-teal-400 font-bold">Mix: ${mixCount}</span>
                                </div>
                            </div>
                        `;
                    });
                    
                    ordersHtml += `</div>`;
                    ordersCell.innerHTML = ordersHtml;
                } else {
                    ordersCell.innerHTML = `<div class="py-2 px-4 text-xs text-center text-slate-500 border-t border-slate-800/50">Nenhum pedido encontrado.</div>`;
                }
                
                ordersRow.appendChild(ordersCell);
                
                tr.onclick = () => {
                    const isHidden = ordersRow.classList.contains('hidden');
                    if (isHidden) {
                        ordersRow.classList.remove('hidden');
                        tr.querySelector('svg').classList.add('rotate-90');
                    } else {
                        ordersRow.classList.add('hidden');
                        tr.querySelector('svg').classList.remove('rotate-90');
                    }
                };
                
                salesBody.appendChild(tr);
                salesBody.appendChild(ordersRow);
            });
        }

        // Helper to render Drill-down lists
        const renderDrillDownList = (containerId, totalId, mapData, emptyMsg) => {
            const container = document.getElementById(containerId);
            const totalEl = document.getElementById(totalId);
            container.innerHTML = '';

            const sorted = Array.from(mapData.keys()).sort().reverse();
            let totalVal = 0;

            if (sorted.length === 0) {
                container.innerHTML = `<div class="text-center text-slate-500 py-4 text-xs">${emptyMsg}</div>`;
                totalEl.textContent = 'R$ 0,00';
                return;
            }

            sorted.forEach(m => {
                const data = mapData.get(m);
                totalVal += data.value;
                const [y, mo] = m.split('-');
                const monthName = new Date(y, mo-1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

                // Create Month Header
                const row = document.createElement('div');
                row.className = 'glass-panel-heavy rounded-lg overflow-hidden border border-slate-700/50';

                const header = document.createElement('div');
                header.className = 'p-3 flex justify-between items-center cursor-pointer hover:bg-slate-700 transition-colors';
                header.innerHTML = `
                    <span class="text-sm font-bold text-slate-300 capitalize flex items-center gap-2">
                        <svg class="w-4 h-4 text-slate-500 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                        ${monthName}
                    </span>
                    <span class="text-sm font-mono font-bold text-white">${data.value.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                `;

                // Create Detail Container
                const details = document.createElement('div');
                details.className = 'hidden bg-slate-900/50 border-t border-slate-700 p-2 text-xs';

                // Aggregate items by product to avoid huge lists
                const prodMap = new Map();
                data.items.forEach(it => {
                    if (!prodMap.has(it.prod)) prodMap.set(it.prod, { desc: it.desc, qty: 0, val: 0 });
                    const p = prodMap.get(it.prod);
                    p.qty += it.qty;
                    p.val += (it.bon || it.val);
                });

                let detailsHtml = '<table class="w-full text-left text-slate-400"><thead><tr class="text-[10px] uppercase border-b border-slate-700/50"><th class="py-1">Prod</th><th class="py-1 text-right">Qtd</th><th class="py-1 text-right">Valor</th></tr></thead><tbody>';
                prodMap.forEach((v, k) => {
                    detailsHtml += `
                        <tr class="border-b border-white/10/50 last:border-0">
                            <td class="py-1 pr-2 truncate max-w-[150px]" title="${v.desc}">${k} - ${v.desc}</td>
                            <td class="py-1 text-right font-mono">${v.qty}</td>
                            <td class="py-1 text-right font-mono text-slate-200">${v.val.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                        </tr>
                    `;
                });
                detailsHtml += '</tbody></table>';
                details.innerHTML = detailsHtml;

                // Toggle Logic
                header.onclick = () => {
                    const isHidden = details.classList.contains('hidden');
                    if (isHidden) {
                        details.classList.remove('hidden');
                        header.querySelector('svg').classList.add('rotate-90');
                    } else {
                        details.classList.add('hidden');
                        header.querySelector('svg').classList.remove('rotate-90');
                    }
                };

                row.appendChild(header);
                row.appendChild(details);
                container.appendChild(row);
            });

            totalEl.textContent = totalVal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
        };

        renderDrillDownList('wallet-losses-list', 'wallet-total-losses', metrics.lossesByMonth, 'Nenhuma perda registrada.');
        renderDrillDownList('wallet-bonus-list', 'wallet-total-bonus', metrics.bonusByMonth, 'Nenhuma bonificação registrada.');

        // 5. Existing Wallet Management Logic (Status & Buttons)
        const statusArea = document.getElementById('wallet-modal-status-area');
        const statusTitle = document.getElementById('wallet-modal-status-title');
        const statusMsg = document.getElementById('wallet-modal-status-msg');
        const btn = document.getElementById('wallet-modal-action-btn');
        const btnText = document.getElementById('wallet-modal-action-text');

        let currentOwner = null;
        if (embeddedData.clientPromotersMap) {
             const matches = embeddedData.clientPromotersMap.get(normalizeKey(codeKey));
             if (matches && matches.length > 0) currentOwner = matches[0].promoter_code;
        }

        const myPromoter = walletState.selectedPromoter;
        const role = (window.userRole || '').trim().toUpperCase();

        // Normalize for comparison
        const normCurrent = currentOwner ? String(currentOwner).trim().toUpperCase() : null;
        const normMy = myPromoter ? String(myPromoter).trim().toUpperCase() : null;

        // Reset Status Area (Fix for Stale State)
        statusArea.classList.remove('hidden');
        statusTitle.textContent = '';
        statusMsg.textContent = '';
        statusArea.className = 'mt-4 p-4 rounded-lg hidden';
        btn.onclick = null;
        btn.disabled = false;

        let isPromoterOnly = true;
        const h = embeddedData.hierarchy || [];
        const me = h.find(x =>
            (x.cod_coord && x.cod_coord.trim().toUpperCase() === role) ||
            (x.cod_cocoord && x.cod_cocoord.trim().toUpperCase() === role)
        );
        if (me || role === 'ADM' || window.userRole === 'adm') isPromoterOnly = false;

        if (!myPromoter) {
            // UX Improvement: If Admin/Manager, show disabled button with hint instead of hiding
            if (walletState.canEdit) {
                btn.classList.remove('hidden');
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-700', 'text-slate-400');
                btn.classList.remove('bg-[#FF5E00]', 'hover:bg-[#CC4A00]', 'text-white', 'shadow-lg'); // Remove active styles
                btnText.textContent = 'Selecione Promotor';
                // Remove previous click handler
                btn.onclick = null;
            } else {
                btn.classList.add('hidden');
            }

            statusArea.classList.remove('hidden'); // Ensure visible
            if (currentOwner) {
                statusArea.className = 'mt-4 p-4 rounded-lg bg-orange-500/10 border border-orange-500/30';
                statusTitle.textContent = 'Cadastrado';
                statusTitle.className = 'text-sm font-bold text-orange-400 mb-1';
                let ownerName = '';
                if (typeof optimizedData !== 'undefined' && optimizedData.promotorMap) {
                    const name = optimizedData.promotorMap.get(String(currentOwner).trim().toUpperCase());
                    if (name) ownerName = ` - ${name}`;
                }
                statusMsg.textContent = `Pertence a: ${currentOwner}${ownerName}`;
            } else {
                statusArea.className = 'mt-4 p-4 rounded-lg bg-slate-700/50 border border-slate-600/50';
                statusTitle.textContent = 'Não Cadastrado';
                statusTitle.className = 'text-sm font-bold text-slate-400 mb-1';
                statusMsg.textContent = 'Este cliente não pertence a nenhuma carteira.';
            }
        } else {
            // Reset Button Styles (Enable)
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-700', 'text-slate-400');
            btn.classList.add('bg-[#FF5E00]', 'hover:bg-[#CC4A00]', 'text-white', 'shadow-lg');

             btn.classList.remove('hidden');
             statusArea.classList.remove('hidden');

             if (normCurrent && normMy && normCurrent === normMy) {
                 statusArea.className = 'mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30';
                 statusTitle.textContent = 'Cliente na Carteira';
                 statusTitle.className = 'text-sm font-bold text-green-400 mb-1';
                 statusMsg.textContent = 'Este cliente já pertence à carteira selecionada.';

                 btnText.textContent = 'Remover';
                 btn.className = 'px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold shadow-lg transition-colors flex items-center gap-2 text-sm';
                 btn.onclick = () => handleWalletAction(codeKey, 'remove');

             } else if (currentOwner) {
                 statusArea.className = 'mt-4 p-4 rounded-lg bg-orange-500/10 border border-orange-500/30';
                 statusTitle.textContent = 'Conflito';
                 statusTitle.className = 'text-sm font-bold text-orange-400 mb-1';
                 let ownerName = '';
                 if (typeof optimizedData !== 'undefined' && optimizedData.promotorMap) {
                     const name = optimizedData.promotorMap.get(String(currentOwner).trim().toUpperCase());
                     if (name) ownerName = ` - ${name}`;
                 }
                 statusMsg.textContent = `Pertence a: ${currentOwner}${ownerName}. Transferir?`;

                 btnText.textContent = 'Transferir';
                 btn.className = 'px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold shadow-lg transition-colors flex items-center gap-2 text-sm';
                 btn.onclick = () => handleWalletAction(codeKey, 'upsert');

                 // Co-Coordinator Restriction Check: Prevent cross-base transfers
                 // Only allows transfer if the current owner belongs to the same Co-Coordinator
                 if (userHierarchyContext && userHierarchyContext.role === 'cocoord' && optimizedData) {
                     const ownerNode = optimizedData.hierarchyMap.get(String(currentOwner).trim().toUpperCase());
                     const myCocoord = userHierarchyContext.cocoord;

                     if (ownerNode && ownerNode.cocoord && ownerNode.cocoord.code) {
                         const ownerCocoord = ownerNode.cocoord.code;
                         if (String(ownerCocoord).trim() !== String(myCocoord).trim()) {
                             btn.disabled = true;
                             btnText.textContent = 'Não Permitido';
                             btn.className = 'px-4 py-2 bg-slate-700 text-slate-400 rounded-lg font-bold cursor-not-allowed flex items-center gap-2 text-sm';
                             statusMsg.textContent += ' (Bloqueado: Cliente de outra base)';
                         }
                     }
                 }

             } else {
                 statusArea.className = 'mt-4 p-4 rounded-lg bg-slate-700 border border-slate-600';
                 statusTitle.textContent = 'Disponível';
                 statusTitle.className = 'text-sm font-bold text-slate-300 mb-1';
                 statusMsg.textContent = 'Sem vínculo atual.';

                 btnText.textContent = 'Adicionar';
                 btn.className = 'px-4 py-2 bg-[#FF5E00] hover:bg-[#CC4A00] text-white rounded-lg font-bold shadow-lg transition-colors flex items-center gap-2 text-sm';
                 btn.onclick = () => handleWalletAction(codeKey, 'upsert');
             }
        }

        if (isPromoterOnly) {
             btn.classList.add('hidden');
             statusMsg.textContent += ' (Modo Leitura)';
        }

        modal.classList.remove('hidden');
    }

    window.handleWalletAction = async function(clientCode, action) {
         const promoter = walletState.selectedPromoter;
         if (!promoter) return;

         const clientCodeNorm = normalizeKey(clientCode);
         console.log(`[Wallet] Action: ${action} for ${clientCode} (Norm: ${clientCodeNorm})`);

         const btn = document.getElementById('wallet-modal-action-btn');
         const txt = document.getElementById('wallet-modal-action-text');
         const oldTxt = txt.textContent;
         btn.disabled = true;
         txt.textContent = '...';

         try {
             // Safety check for embeddedData
             if (!embeddedData.clientPromoters) embeddedData.clientPromoters = [];
             if (!embeddedData.clientPromotersMap) embeddedData.clientPromotersMap = new Map();

             if (action === 'upsert') {
                 // Use Normalized Key for DB Consistency
                 const { error } = await window.supabaseClient.from('data_client_promoters')
                    .upsert({ client_code: clientCodeNorm, promoter_code: promoter }, { onConflict: 'client_code' });
                 if(error) throw error;

                 const existingEntries = embeddedData.clientPromotersMap.get(clientCodeNorm) || [];
                 if (existingEntries.length > 0) {
                     // Update all existing entries for this client in memory
                     existingEntries.forEach(entry => {
                         entry.promoter_code = promoter;
                     });
                 } else {
                     // Add new entry
                     const newEntry = { client_code: clientCodeNorm, promoter_code: promoter };
                     embeddedData.clientPromoters.push(newEntry);
                     embeddedData.clientPromotersMap.set(clientCodeNorm, [newEntry]);
                 }

                 // Ensure client exists in local dataset (for display)
                 const dataset = allClientsData;
                 let exists = false;
                 if (dataset instanceof ColumnarDataset) {
                     const col = dataset._data['Código'] || dataset._data['CODIGO_CLIENTE'];
                     // Use normalized key for check
                     if (col) {
                         // Column might contain mixed types, normalize elements for check if needed, or rely on format
                         // Usually column data is normalized on init.
                         // But simple .includes might fail if column has "123" (string) and clientCodeNorm is "123"
                         // But let's check manually to be safe or trust includes if data is clean
                         // Faster: trust includes first
                         if (col.includes(clientCodeNorm)) exists = true;
                         // Fallback: search with normalize
                         else {
                             // Optimize: Cache normalized keys to avoid repeated O(N) normalizeKey calls
                             if (!dataset._normalizedCodeCache) {
                                 dataset._normalizedCodeCache = new Set();
                                 for(let i=0; i<col.length; i++) {
                                     dataset._normalizedCodeCache.add(normalizeKey(col[i]));
                                 }
                             }
                             if (dataset._normalizedCodeCache.has(clientCodeNorm)) exists = true;
                         }
                     }
                 } else {
                     // Optimize: Cache normalized keys for standard array dataset
                     if (!dataset._normalizedCodeCache) {
                         dataset._normalizedCodeCache = new Set();
                         for(let i=0; i<dataset.length; i++) {
                             const c = dataset[i];
                             dataset._normalizedCodeCache.add(normalizeKey(c['Código'] || c['codigo_cliente']));
                         }
                     }
                     if (dataset._normalizedCodeCache.has(clientCodeNorm)) exists = true;
                 }

                 if (!exists) {
                     console.log(`[Wallet] Client ${clientCodeNorm} not in cache. Fetching...`);
                     // Fetch and inject
                     // Try fetching with raw code (might work if DB has it) or normalized?
                     // data_clients code should be normalized ideally but let's try 'ilike' or both?
                     // Or just query by codigo_cliente (which is text).
                     const { data: newClient } = await window.supabaseClient.from('data_clients').select('*').eq('codigo_cliente', clientCode).single();

                     if (newClient) {
                         const mapped = {
                             'Código': newClient.codigo_cliente,
                             'Fantasia': newClient.fantasia,
                             'Razão Social': newClient.razaosocial,
                             'CNPJ/CPF': newClient.cnpj_cpf,
                             'Cidade': newClient.cidade,
                             'PROMOTOR': promoter
                         };

                         if (dataset instanceof ColumnarDataset) {
                             dataset.columns.forEach(col => {
                                 let val = '';
                                 const c = col.toUpperCase();
                                 if(c === 'CÓDIGO' || c === 'CODIGO_CLIENTE') val = newClient.codigo_cliente;
                                 else if(c === 'FANTASIA' || c === 'NOMECLIENTE') val = newClient.fantasia;
                                 else if(c === 'RAZÃO SOCIAL' || c === 'RAZAOSOCIAL' || c === 'RAZAO') val = newClient.razaosocial;
                                 else if(c === 'CNPJ/CPF' || c === 'CNPJ') val = newClient.cnpj_cpf;
                                 else if(c === 'CIDADE') val = newClient.cidade;
                                 else if(c === 'PROMOTOR') val = promoter;

                         if(dataset._data[col]) dataset._data[col].push(val);
                             });
                             dataset.length++;

                             // CRITICAL FIX: Update underlying embeddedData.clients.length if needed
                             // renderWalletTable iterates embeddedData.clients directly
                             if (embeddedData.clients && typeof embeddedData.clients.length === 'number' && !Array.isArray(embeddedData.clients)) {
                                 embeddedData.clients.length++;
                             }
                             // Update local cache if it exists
                             if (dataset._normalizedCodeCache) {
                                 dataset._normalizedCodeCache.add(clientCodeNorm);
                             }
                         } else {
                             dataset.push(mapped);
                             // Update local cache if it exists
                             if (dataset._normalizedCodeCache) {
                                 dataset._normalizedCodeCache.add(clientCodeNorm);
                             }
                         }
                     }
                 }

             } else {
                 // Find all matching entries in memory to get IDs (if available) or check existence
                 const entries = embeddedData.clientPromotersMap.get(clientCodeNorm) || [];

                 if (entries.length > 0) {
                     const idsToDelete = entries.map(e => e.id).filter(id => id);
                     const codesToDelete = entries.length > idsToDelete.length ? [clientCodeNorm] : [];

                     console.log(`[Wallet] Removing existing entries (${entries.length})`);

                     if (idsToDelete.length > 0) {
                         // Bulk Delete by ID is safest and fastest
                         const { error } = await window.supabaseClient.from('data_client_promoters').delete().in('id', idsToDelete);
                         if(error) throw error;
                     }

                     if (codesToDelete.length > 0) {
                         // Fallback: Delete by client_code. Try Normalized first (standard).
                         let { error } = await window.supabaseClient.from('data_client_promoters').delete().eq('client_code', clientCodeNorm);

                         // If rows affected is 0? Supabase doesn't return count by default unless select().
                         // If we are dealing with legacy data (leading zeros), try raw code if different.
                         if (!error && clientCode !== clientCodeNorm) {
                             console.log(`[Wallet] Retrying delete with raw code: ${clientCode}`);
                             await window.supabaseClient.from('data_client_promoters').delete().eq('client_code', clientCode);
                         }
                         if (error) throw error;
                     }

                     // Remove from memory
                     // Use splice to preserve reference integrity
                     for (let i = embeddedData.clientPromoters.length - 1; i >= 0; i--) {
                         if (normalizeKey(embeddedData.clientPromoters[i].client_code) === clientCodeNorm) {
                             embeddedData.clientPromoters.splice(i, 1);
                         }
                     }
                     embeddedData.clientPromotersMap.delete(clientCodeNorm);
                 } else {
                     console.warn(`[Wallet] Client ${clientCodeNorm} not found in memory map during remove. Performing blind delete.`);
                     // Blind delete
                     const { error } = await window.supabaseClient.from('data_client_promoters').delete().eq('client_code', clientCodeNorm);
                     if(error) throw error;
                 }
             }

             document.getElementById('wallet-client-modal').classList.add('hidden');
             renderWalletTable();

         } catch (e) {
             console.error(e);
             window.showToast('error', 'Erro: ' + e.message);
         } finally {
             btn.disabled = false;
             txt.textContent = oldTxt;
         }
    }

    window.renderView = renderView;

    // --- ROTEIRO LOGIC ---
    let isRoteiroMode = false;
    let roteiroDate = new Date();
    roteiroDate.setHours(0,0,0,0);

    function toggleRoteiroMode() {
        isRoteiroMode = !isRoteiroMode;

        const isPromotorUserLocal = (typeof userHierarchyContext !== 'undefined' && userHierarchyContext.role === 'promotor') || (typeof optimizedData !== 'undefined' && optimizedData.promotorMap && optimizedData.promotorMap.has((window.userRole || '').trim().toUpperCase()));
        if (isRoteiroMode && isPromotorUserLocal) {
            const todayRef = new Date();
            todayRef.setHours(0,0,0,0);
            if (roteiroDate.getTime() < todayRef.getTime()) {
                roteiroDate = new Date();
                roteiroDate.setHours(0,0,0,0);
            }
        }
        const btn = document.getElementById('toggle-roteiro-btn');
        const roteiroContainer = document.getElementById('roteiro-container');
        const listWrapper = document.getElementById('clientes-list-view-wrapper');
        const searchInput = document.getElementById('clientes-search');

        if (isRoteiroMode) {
            btn.classList.add('bg-purple-600', 'border-purple-500');
            btn.classList.remove('glass-panel-heavy', 'border-slate-700', 'hover:bg-slate-700');
            btn.querySelector('svg').classList.add('text-white');
            btn.querySelector('svg').classList.remove('text-purple-400');

            roteiroContainer.classList.remove('hidden');
            listWrapper.classList.add('hidden');

            // Enable Search for Smart Roteiro Search
            if(searchInput) {
                searchInput.disabled = false;
                searchInput.value = '';
                searchInput.placeholder = "Pesquisar cliente no roteiro...";
                searchInput.classList.remove('opacity-50', 'cursor-not-allowed');
            }

            renderRoteiroView();
        } else {
            btn.classList.remove('bg-purple-600', 'border-purple-500');
            btn.classList.add('glass-panel-heavy', 'border-slate-700', 'hover:bg-slate-700');
            btn.querySelector('svg').classList.remove('text-white');
            btn.querySelector('svg').classList.add('text-purple-400');

            roteiroContainer.classList.add('hidden');
            listWrapper.classList.remove('hidden');

            if(searchInput) {
                searchInput.disabled = false;
                searchInput.value = '';
                searchInput.placeholder = "Pesquisar...";
                searchInput.classList.remove('opacity-50', 'cursor-not-allowed');
            }
            // Trigger normal list render
            renderClientView();
        }
    }

    function calculateNextRoteiroDate(client, fromDate = new Date()) {
        const freq = client.ITINERARY_FREQUENCY || client.itinerary_frequency;
        const refDateStr = client.ITINERARY_NEXT_DATE || client.itinerary_next_date;
        const daysStr = String(client.ITINERARY_DAYS || client.itinerary_days || '').replace(/[\[\]\s]/g, '');

        if (!freq || !refDateStr) return null;

        let utcRef;
        if (refDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [y, m, d] = refDateStr.split('-').map(Number);
            utcRef = Date.UTC(y, m - 1, d);
        } else {
            const d = parseDate(refDateStr);
            if (!d) return null;
            utcRef = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        }

        const utcFrom = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());

        // --- NEW LOGIC: Multiple Days (Weekly Only) ---
        if (freq === 'weekly' && daysStr) {
            // daysStr e.g. "1,3,5" (Mon, Wed, Fri)
            const days = daysStr.split(',').map(Number).sort((a, b) => a - b);
            if (days.length > 0) {
                // Find current day of week (0=Sun, 6=Sat)
                // Note: utcFrom is UTC 00:00. getUTCDay() gives 0-6.
                const fromDateObj = new Date(utcFrom);
                const currentDay = fromDateObj.getUTCDay();

                // Find next valid day in cycle
                // 1. Check days in current week >= currentDay
                // We want the closest one. If currentDay is in list, we return it (as "next" is today)
                let nextDay = days.find(d => d >= currentDay);
                let daysToAdd = 0;

                if (nextDay !== undefined) {
                    daysToAdd = nextDay - currentDay;
                } else {
                    // Wrap around to next week
                    nextDay = days[0];
                    daysToAdd = (7 - currentDay) + nextDay;
                }

                // Reference Date Check:
                // We must ensure the calculated date is >= refDate.
                const potentialDate = utcFrom + (daysToAdd * 24 * 60 * 60 * 1000);

                if (potentialDate < utcRef) {
                    // If calculated date is before Ref Date, we must start search FROM Ref Date.
                    const refDateObj = new Date(utcRef);
                    const refDay = refDateObj.getUTCDay();

                    let nextDayRef = days.find(d => d >= refDay);
                    let add = 0;
                    if(nextDayRef !== undefined) {
                        add = nextDayRef - refDay;
                    } else {
                        add = (7 - refDay) + days[0];
                    }
                    const final = new Date(utcRef + (add * 24 * 60 * 60 * 1000));
                    return new Date(final.getUTCFullYear(), final.getUTCMonth(), final.getUTCDate());
                }

                const nextDate = new Date(potentialDate);
                return new Date(nextDate.getUTCFullYear(), nextDate.getUTCMonth(), nextDate.getUTCDate());
            }
        }
        // ----------------------------------------------

        // Calculate days difference
        const diffTime = utcFrom - utcRef;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Interval
        const interval = (freq === 'weekly') ? 7 : (freq === 'biweekly' ? 14 : 0);
        if (interval === 0) return null;

        // Find smallest N >= 0 such that Ref + (N * Interval) >= From
        // Ref + X = From -> X = From - Ref = diffDays
        // We need next valid day >= diffDays that is a multiple of interval
        // Wait, the modulo logic in renderRoteiroClients uses `diffDays % interval === 0`.
        // So we need to find the next date where (target - ref) % interval == 0 AND target >= from.

        // Let Offset = diffDays. We need NextOffset >= Offset such that NextOffset % interval == 0.
        // If Offset is negative (Ref is future), we can just use Ref (Offset 0 relative to Ref, but we need >= From).
        // Actually simpler:
        // Current diffDays is the offset from Ref to Today.
        // We want the next multiple of interval that is >= diffDays.

        let remainder = diffDays % interval;
        // JS modulo can be negative.
        // Example: Ref=10th. From=8th. Diff = -2. Interval=7.
        // We want 10th (Ref).
        // -2 % 7 = -2.

        let daysToAdd = 0;
        if (remainder === 0) {
            daysToAdd = 0; // Today matches
        } else {
            // Need to move forward to next multiple
            if (remainder > 0) {
                daysToAdd = interval - remainder;
            } else {
                daysToAdd = Math.abs(remainder);
            }
        }

        const nextDate = new Date(utcFrom + (daysToAdd * 24 * 60 * 60 * 1000));
        // Add Timezone offset compensation to return local date object 00:00
        return new Date(nextDate.getUTCFullYear(), nextDate.getUTCMonth(), nextDate.getUTCDate());
    }

    function handleRoteiroSearch(query) {
        if (!query || query.trim() === '') {
            // Reset to Today if cleared? Or stay? Stay is better UX usually.
            // renderRoteiroView();
            // Just re-render current view to clear filter
            renderRoteiroClients(roteiroDate);
            return;
        }

        const term = query.toLowerCase().trim();

        // 1. Search for Client
        let matchedClient = null;

        // Helper to search
        const searchTerms = term.split(' ').filter(t => t.length > 0 && t !== '-');
        const check = (c) => {
            const nome = (c.nomeCliente || '').toLowerCase();
            const fantasia = (c.fantasia || '').toLowerCase();
            const codigo = String(c['Código'] || c['codigo_cliente']).toLowerCase();

            return searchTerms.every(t =>
                nome.includes(t) ||
                fantasia.includes(t) ||
                codigo.includes(t)
            );
        };

        if (allClientsData instanceof ColumnarDataset) {
            for(let i=0; i<allClientsData.length; i++) {
                const c = allClientsData.get(i);
                if (check(c)) { matchedClient = c; break; }
            }
        } else {
            matchedClient = allClientsData.find(check);
        }

        if (matchedClient) {
            // 2. Calculate Next Date
            const nextDate = calculateNextRoteiroDate(matchedClient);

            if (nextDate) {
                // Update Global Date
                roteiroDate = nextDate;
                // Render
                renderRoteiroView(); // Updates Calendar UI
                // Filter List explicitly? renderRoteiroClients will read the input value.
            } else {
                // Client found but no roteiro
                renderRoteiroClients(roteiroDate, true); // Force empty/special state
            }
        } else {
            // No client found
            renderRoteiroClients(roteiroDate, true); // Force empty
        }
    }

    function renderRoteiroView() {
        renderRoteiroCalendar();
        renderRoteiroClients(roteiroDate);

        // Inject Promoter Filter for Desktop if not already present
        const header = document.querySelector('#roteiro-container header') || document.querySelector('#roteiro-main-card > div:first-child');
        // Note: The structure in HTML is: roteiro-main-card -> div (Calendar Header) -> ...
        // We want to inject it in the header row.

        // Only show if NOT a Promoter
        if (header && !window.userIsPromoter && !document.getElementById('roteiro-promoter-filter')) {
            const filterContainer = document.createElement('div');
            // Inserted below the header, visible on all screens
            filterContainer.className = 'px-4 pb-3 border-b border-slate-800 flex justify-end';
            filterContainer.innerHTML = `
                <select id="roteiro-promoter-filter" class="glass-panel-heavy border border-slate-700 text-white text-xs rounded-lg p-2 focus:ring-2 focus:ring-purple-500 w-full sm:w-auto">
                    <option value="">Todos os Promotores</option>
                </select>
            `;
            // Insert after the header completely to avoid breaking flex layout
            header.parentNode.insertBefore(filterContainer, header.nextSibling);

            // Populate
            const select = filterContainer.querySelector('select');
            if (select && optimizedData.promotorMap) {
                let promotersToShow = Array.from(optimizedData.promotorMap.entries());

                // Co-Coordinator Restriction
                if (userHierarchyContext.role === 'cocoord' && userHierarchyContext.cocoord) {
                    const allowedPromotersSet = optimizedData.promotorsByCocoord.get(userHierarchyContext.cocoord);
                    if (allowedPromotersSet) {
                        promotersToShow = promotersToShow.filter(([code, name]) => allowedPromotersSet.has(code));
                    } else {
                        promotersToShow = [];
                    }
                }

                const sorted = promotersToShow.sort((a,b) => a[1].localeCompare(b[1]));
                sorted.forEach(([code, name]) => {
                    const opt = document.createElement('option');
                    opt.value = code;
                    opt.textContent = name;
                    select.appendChild(opt);
                });

                select.addEventListener('change', () => {
                    renderRoteiroClients(roteiroDate);
                });
            }
        }
    }

    function renderRoteiroCalendar() {
        const strip = document.getElementById('roteiro-calendar-strip');
        const monthLabel = document.getElementById('roteiro-current-month');
        const dayNumber = document.getElementById('roteiro-day-number');

        if (!strip) return;
        strip.innerHTML = '';

        const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        monthLabel.textContent = months[roteiroDate.getMonth()];
        dayNumber.textContent = roteiroDate.getDate();

        // Generate 7 days centered on selected date
        const start = new Date(roteiroDate);
        start.setDate(start.getDate() - 3);

        const weekDays = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);

            const isSelected = d.getTime() === roteiroDate.getTime();
            const isToday = d.toDateString() === new Date().toDateString();


            const todayRef = new Date();
            todayRef.setHours(0,0,0,0);
            const dRef = new Date(d);
            dRef.setHours(0,0,0,0);
            const isPromotorUser = (typeof userHierarchyContext !== 'undefined' && userHierarchyContext.role === 'promotor') || (typeof optimizedData !== 'undefined' && optimizedData.promotorMap && optimizedData.promotorMap.has((window.userRole || '').trim().toUpperCase()));
            const isPast = dRef.getTime() < todayRef.getTime() && isPromotorUser;

            const dayEl = document.createElement('div');
            dayEl.className = `flex flex-col items-center justify-center p-2 rounded-lg min-w-[50px] transition-colors ${isSelected ? 'bg-purple-600 text-white shadow-lg scale-110' : (isPast ? 'text-slate-600 opacity-50 cursor-not-allowed' : 'text-slate-400 hover:bg-white/5 cursor-pointer')}`;


            dayEl.innerHTML = `
                <span class="text-[10px] font-bold tracking-wider ${isToday && !isSelected ? 'text-purple-600' : ''}">${weekDays[d.getDay()]}</span>
                <span class="text-lg font-bold ${isToday && !isSelected ? 'text-purple-600' : ''}">${d.getDate()}</span>
            `;


            if (!isPast) {
                dayEl.onclick = () => {
                    roteiroDate = d;
                    renderRoteiroView();
                };
            }


            strip.appendChild(dayEl);
        }

        // Bind Nav Buttons logic only once? No, safe to rebind or check
        const prevBtn = document.getElementById('roteiro-prev-day');
        const nextBtn = document.getElementById('roteiro-next-day');

        // Remove old listeners to avoid stacking (cloning trick)
        const newPrev = prevBtn.cloneNode(true);
        const newNext = nextBtn.cloneNode(true);
        prevBtn.parentNode.replaceChild(newPrev, prevBtn);
        nextBtn.parentNode.replaceChild(newNext, nextBtn);

        newPrev.onclick = () => {
            const isPromotorUserLocal = (typeof userHierarchyContext !== 'undefined' && userHierarchyContext.role === 'promotor') || (typeof optimizedData !== 'undefined' && optimizedData.promotorMap && optimizedData.promotorMap.has((window.userRole || '').trim().toUpperCase()));
            if (isPromotorUserLocal) {
                const today = new Date();
                today.setHours(0,0,0,0);
                const prevDate = new Date(roteiroDate);
                prevDate.setDate(prevDate.getDate() - 1);
                prevDate.setHours(0,0,0,0); // Explicitly zero time

                // If trying to go before today, block
                if (prevDate.getTime() < today.getTime()) {
                    return;
                }
            }
            roteiroDate.setDate(roteiroDate.getDate() - 1);
            renderRoteiroView();
        };
        newNext.onclick = () => {
            roteiroDate.setDate(roteiroDate.getDate() + 1);
            renderRoteiroView();
        };

        // Visual Feedback for disabled button
        const isPromotorUserLocal = (typeof userHierarchyContext !== 'undefined' && userHierarchyContext.role === 'promotor') || (typeof optimizedData !== 'undefined' && optimizedData.promotorMap && optimizedData.promotorMap.has((window.userRole || '').trim().toUpperCase()));
            if (isPromotorUserLocal) {
            const today = new Date();
            today.setHours(0,0,0,0);
            const roteiroRef = new Date(roteiroDate);
            roteiroRef.setHours(0,0,0,0);
            const isToday = roteiroRef.getTime() === today.getTime();
            if (isToday) {
                newPrev.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                newPrev.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        } else {
            // Ensure enabled for others
            newPrev.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    function renderRoteiroClients(date, forceEmpty = false) {
        const container = document.getElementById('roteiro-container'); // Container wrapping everything
        const dateDisplay = document.getElementById('roteiro-date-display');
        const countDisplay = document.getElementById('roteiro-client-count');
        const emptyState = document.getElementById('roteiro-empty-state');
        const statsPanel = document.getElementById('roteiro-stats-panel'); // Stats panel at bottom of card
        const searchInput = document.getElementById('clientes-search');

        // Check for Off Route (Future Date)
        const today = new Date();
        today.setHours(0,0,0,0);
        const viewDate = new Date(date);
        viewDate.setHours(0,0,0,0);
        const isOffRoute = viewDate > today;

        let warningBanner = document.getElementById('roteiro-off-route-banner');
        if (isOffRoute) {
            if (!warningBanner) {
                warningBanner = document.createElement('div');
                warningBanner.id = 'roteiro-off-route-banner';
                warningBanner.className = 'bg-orange-500/10 border-l-4 border-orange-500 p-4 mb-4 mx-4 rounded-r shadow-lg animate-pulse';
                warningBanner.innerHTML = `
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <svg class="h-5 w-5 text-orange-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                            </svg>
                        </div>
                        <div class="ml-3">
                            <p class="text-sm text-orange-200 font-bold">
                                Atendimento Fora de Rota
                            </p>
                            <p class="text-xs text-orange-300">
                                Você está visualizando uma data futura. As visitas realizadas aqui serão registradas como fora de rota.
                            </p>
                        </div>
                    </div>
                `;
                // Insert before card content
                const card = document.getElementById('roteiro-main-card');
                if(card) card.insertBefore(warningBanner, card.firstChild);
            }
        } else {
            if (warningBanner) warningBanner.remove();
        }

        // Remove existing list if any (custom injection point)
        let listContainer = document.getElementById('roteiro-clients-list');
        if (!listContainer) {
            listContainer = document.createElement('div');
            listContainer.id = 'roteiro-clients-list';
            listContainer.className = 'divide-y divide-slate-800 max-h-[500px] overflow-y-auto custom-scrollbar';
            // Insert after header, before stats
            const card = document.getElementById('roteiro-main-card');
            card.insertBefore(listContainer, statsPanel);
        }
        listContainer.innerHTML = '';

        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateDisplay.textContent = date.toLocaleDateString('pt-BR', options);

        const isPromotorUser = (typeof userHierarchyContext !== 'undefined' && userHierarchyContext.role === 'promotor') || (typeof optimizedData !== 'undefined' && optimizedData.promotorMap && optimizedData.promotorMap.has((window.userRole || '').trim().toUpperCase()));
        const isPast = viewDate < today && isPromotorUser;

        // Filter Logic
        let clients = [];
        const searchTerm = (searchInput && searchInput.value) ? searchInput.value.toLowerCase().trim() : '';
        const promoterFilter = document.getElementById('roteiro-promoter-filter');
        const selectedPromoter = (promoterFilter && promoterFilter.value) ? promoterFilter.value : null;

        try {
            // Use allClientsData directly
            const dataset = allClientsData;
            const len = dataset.length;
            const isColumnar = dataset instanceof ColumnarDataset;

            for (let i = 0; i < len; i++) {
                const c = isColumnar ? dataset.get(i) : dataset[i];

                // 1. Basic Roteiro Check (and Out of Route Check)
                const c_cod = window.normalizeKey ? window.normalizeKey(c['Código'] || c['codigo_cliente']) : String(c['Código'] || c['codigo_cliente']).trim();
                const c_visits = (typeof myMonthVisits !== 'undefined' && myMonthVisits) ? (myMonthVisits.get(c_cod) || []) : [];
                const c_todaysVisit = c_visits.find(v => {
                    const vCreatedAt = String(v.created_at || "").endsWith("Z") || String(v.created_at || "").match(/[+-]\d{2}:\d{2}$/) ? v.created_at : v.created_at + "Z"; const d = new Date(vCreatedAt);
                    return d.getDate() === date.getDate() &&
                           d.getMonth() === date.getMonth() &&
                           d.getFullYear() === date.getFullYear();
                });

                const hasFreq = !!(c.ITINERARY_FREQUENCY || c.itinerary_frequency);

                if (!hasFreq && !c_todaysVisit) continue; // Skip if no freq and no visit today


                // 2. Promoter Filter (Desktop Admin/Coord)
                if (selectedPromoter) {
                    const pCode = String(c.PROMOTOR || c.promotor_code || '').trim();
                    if (pCode !== selectedPromoter) continue;
                }

                // 3. Search Term Filter (If active)
                if (searchTerm) {
                    const searchTerms = searchTerm.split(' ').filter(t => t.length > 0 && t !== '-');
                    const nome = (c.nomeCliente || '').toLowerCase();
                    const fantasia = (c.fantasia || '').toLowerCase();
                    const codigo = String(c['Código'] || c['codigo_cliente']).toLowerCase();

                    const match = searchTerms.every(t =>
                        nome.includes(t) ||
                        fantasia.includes(t) ||
                        codigo.includes(t)
                    );

                    if (!match) continue;
                }

                clients.push(c);
            }
        } catch(e) {
            console.error("[Roteiro] Error getting clients:", e);
        }

        const scheduledClients = [];

        clients.forEach(c => {
            const freq = c.ITINERARY_FREQUENCY || c.itinerary_frequency;
            const refDateStr = c.ITINERARY_NEXT_DATE || c.itinerary_next_date;
            const daysStr = String(c.ITINERARY_DAYS || c.itinerary_days || '').replace(/[\[\]\s]/g, '');

            if (!freq || !refDateStr) {
                // Not scheduled, but let's check if they have a visit
                const cod = window.normalizeKey ? window.normalizeKey(c['Código'] || c['codigo_cliente']) : String(c['Código'] || c['codigo_cliente']).trim();
                const clientVisits = (typeof myMonthVisits !== 'undefined' && myMonthVisits) ? (myMonthVisits.get(cod) || []) : [];
                const todaysVisit = clientVisits.find(v => {
                    const vCreatedAt = String(v.created_at || "").endsWith("Z") || String(v.created_at || "").match(/[+-]\d{2}:\d{2}$/) ? v.created_at : v.created_at + "Z"; const d = new Date(vCreatedAt);
                    return d.getDate() === date.getDate() &&
                           d.getMonth() === date.getMonth() &&
                           d.getFullYear() === date.getFullYear();
                });

                if (todaysVisit) {
                    c._isScheduled = false;
                    c._todaysVisit = todaysVisit;
                    scheduledClients.push(c);
                }
                return;
            }

            let utcRef;
            if (refDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [y, m, d] = refDateStr.split('-').map(Number);
                utcRef = Date.UTC(y, m - 1, d);
            } else {
                const d = parseDate(refDateStr);
                if (!d) return;
                utcRef = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
            }

            const utcTarget = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

            let isScheduled = false;

            if (freq === 'weekly' && daysStr) {
                // Multi-day logic
                const days = daysStr.split(',').map(Number);
                const targetDay = new Date(utcTarget).getUTCDay();

                // Only if target date is >= ref date
                if (utcTarget >= utcRef) {
                    if (days.includes(targetDay)) {
                        isScheduled = true;
                    }
                }
            } else {
                // Interval logic (Standard)
                const diffTime = utcTarget - utcRef;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // Ensure date is >= Ref Date (No past scheduling relative to start)
                if (diffDays >= 0) {
                    if (freq === 'weekly') {
                        isScheduled = (diffDays % 7 === 0);
                    } else if (freq === 'biweekly') {
                        isScheduled = (diffDays % 14 === 0);
                    }
                }
            }

            const cod = window.normalizeKey ? window.normalizeKey(c['Código'] || c['codigo_cliente']) : String(c['Código'] || c['codigo_cliente']).trim();
            const clientVisits = (typeof myMonthVisits !== 'undefined' && myMonthVisits) ? (myMonthVisits.get(cod) || []) : [];
            const todaysVisit = clientVisits.find(v => {
                const vCreatedAt = String(v.created_at || "").endsWith("Z") || String(v.created_at || "").match(/[+-]\d{2}:\d{2}$/) ? v.created_at : v.created_at + "Z"; const d = new Date(vCreatedAt);
                return d.getDate() === date.getDate() &&
                       d.getMonth() === date.getMonth() &&
                       d.getFullYear() === date.getFullYear();
            });

            if (isScheduled || !!todaysVisit) {
                c._isScheduled = isScheduled;
                c._todaysVisit = todaysVisit;
                scheduledClients.push(c);
            }
        });

        countDisplay.textContent = `${scheduledClients.length} clientes`;

        // Sort by Name
        scheduledClients.sort((a,b) => (a.nomeCliente||'').localeCompare(b.nomeCliente||''));

        // Metrics
        let visitedCount = 0;
        let surveyCount = 0;

        // Render List
        if (scheduledClients.length === 0 || forceEmpty) {
            listContainer.innerHTML = '';
            emptyState.classList.remove('hidden');
            statsPanel.classList.add('hidden'); // Hide stats if no clients

            // Custom Message if Searching
            const emptyTitle = emptyState.querySelector('h3');
            const emptyDesc = emptyState.querySelector('p');

            if (isPast) {
                emptyTitle.textContent = "Acesso Negado";
                emptyDesc.textContent = "Não é possível consultar roteiro de dias passados";
            } else if (forceEmpty && searchTerm) {
                emptyTitle.textContent = "Cliente sem roteiro";
                emptyDesc.textContent = "O cliente pesquisado não possui agendamento.";
            } else if (searchTerm) {
                emptyTitle.textContent = "Nenhum resultado";
                emptyDesc.textContent = "Nenhum cliente agendado para esta data corresponde à pesquisa.";
            } else {
                emptyTitle.textContent = "Dia Livre";
                emptyDesc.textContent = "Nenhum cliente agendado para esta data.";
            }

        } else {
            emptyState.classList.add('hidden');
            statsPanel.classList.remove('hidden');

            scheduledClients.forEach(c => {
                const cod = normalizeKey(c['Código'] || c['codigo_cliente']);

                // Check Visits from Memory
                const clientVisits = myMonthVisits.get(cod) || [];

                // Find visit for THIS date (Local)
                const todaysVisit = c._todaysVisit || clientVisits.find(v => {
                    const vCreatedAt = String(v.created_at || "").endsWith("Z") || String(v.created_at || "").match(/[+-]\d{2}:\d{2}$/) ? v.created_at : v.created_at + "Z"; const d = new Date(vCreatedAt);
                    return d.getDate() === date.getDate() &&
                           d.getMonth() === date.getMonth() &&
                           d.getFullYear() === date.getFullYear();
                });

                // Format check-in / check-out date string
                let visitTimeStr = '';
                let isLatestVisit = false;
                if (todaysVisit) {
                    const tVisitTime = todaysVisit.checkout_at || todaysVisit.created_at; const tVisitTimeStr = String(tVisitTime || "").endsWith("Z") || String(tVisitTime || "").match(/[+-]\d{2}:\d{2}$/) ? tVisitTime : tVisitTime + "Z"; const chkIn = new Date(tVisitTimeStr);
                    const dd = String(chkIn.getDate()).padStart(2, '0');
                    const mm = String(chkIn.getMonth() + 1).padStart(2, '0');
                    const yyyy = chkIn.getFullYear();
                    const hh = String(chkIn.getHours()).padStart(2, '0');
                    const min = String(chkIn.getMinutes()).padStart(2, '0');
                    const ss = String(chkIn.getSeconds()).padStart(2, '0');
                    visitTimeStr = `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
                } else if (clientVisits && clientVisits.length > 0) {
                    // Find latest visit
                    let latestVisit = clientVisits[0];
                    for (let j = 1; j < clientVisits.length; j++) {
                        const lTime = new Date(latestVisit.checkout_at || latestVisit.created_at).getTime();
                        const cTime = new Date(clientVisits[j].checkout_at || clientVisits[j].created_at).getTime();
                        if (cTime > lTime) latestVisit = clientVisits[j];
                    }
                    if (latestVisit) {
                        const tVisitTime = latestVisit.checkout_at || latestVisit.created_at; const tVisitTimeStr = String(tVisitTime || "").endsWith("Z") || String(tVisitTime || "").match(/[+-]\d{2}:\d{2}$/) ? tVisitTime : tVisitTime + "Z"; const chkIn = new Date(tVisitTimeStr);
                        const dd = String(chkIn.getDate()).padStart(2, '0');
                        const mm = String(chkIn.getMonth() + 1).padStart(2, '0');
                        const yyyy = chkIn.getFullYear();
                        const hh = String(chkIn.getHours()).padStart(2, '0');
                        const min = String(chkIn.getMinutes()).padStart(2, '0');
                        visitTimeStr = `Últ. visita: ${dd}/${mm}/${yyyy} ${hh}:${min}`;
                        isLatestVisit = true;
                    }
                }

                const isForaDeRota = !c._isScheduled && !!todaysVisit;
                const isToday = (date.getDate() === (new Date()).getDate() && date.getMonth() === (new Date()).getMonth() && date.getFullYear() === (new Date()).getFullYear());


                const hasVisit = !!todaysVisit;
                const hasSurvey = hasVisit && todaysVisit.respostas;
                const visitedThisMonth = clientVisits.length > 0;

                if (hasVisit) visitedCount++;
                if (hasSurvey) surveyCount++;

                // Status Tag Logic
                let statusHtml = `<span class="px-2 py-1 glass-panel-heavy text-slate-400 text-[10px] sm:text-xs font-bold rounded-full whitespace-nowrap">Pendente</span>`;
                let barColor = 'bg-slate-600';

                if (hasVisit) {
                    if (todaysVisit.checkout_at) {
                        statusHtml = `<span class="px-2 py-1 bg-green-900 text-green-300 text-[10px] sm:text-xs font-bold rounded-full whitespace-nowrap">Visitado</span>`;
                        barColor = 'bg-green-500';
                    } else {
                        statusHtml = `<span class="px-2 py-1 bg-orange-900 text-orange-300 text-[10px] sm:text-xs font-bold rounded-full animate-pulse whitespace-nowrap">Em Andamento</span>`;
                        barColor = 'bg-orange-500';
                    }
                }

                const div = document.createElement('div');
                div.className = 'p-4 flex items-center justify-between hover:bg-white/5 cursor-pointer transition-colors';
                div.innerHTML = `
                    <div class="flex items-center gap-3 flex-1 min-w-0 pr-2">
                        <div class="w-2 h-10 ${barColor} rounded-full"></div>
                        <div>
                            <div class="text-sm font-bold text-white flex items-center gap-2">
                                ${c.fantasia || c.nomeCliente}
                                ${visitedThisMonth ? `
                                    <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Visitado este mês">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 11l3 3L22 4"></path>
                                    </svg>
                                ` : ''}
                            </div>
                            <div class="text-xs text-slate-400 font-mono flex flex-wrap items-center gap-1">${cod} • ${c.cidade || ''} ${visitTimeStr ? '• <span class="text-slate-300">' + visitTimeStr + '</span>' : ''} ${(isForaDeRota && isToday) ? '<span class="ml-2 px-1.5 py-0.5 bg-orange-900/50 text-orange-400 border border-orange-500/30 rounded text-[10px] font-bold">Atendido fora de rota</span>' : ''}</div>
                        </div>
                    </div>
                    <div class="flex-shrink-0">
                        ${statusHtml}
                    </div>
                `;
                div.onclick = () => openActionModal(cod, c.fantasia || c.nomeCliente);
                listContainer.appendChild(div);
            });
        }

        // Update Progress Bars
        const visitPct = scheduledClients.length > 0 ? (visitedCount / scheduledClients.length) * 100 : 0;
        const surveyPct = scheduledClients.length > 0 ? (surveyCount / scheduledClients.length) * 100 : 0;

        document.getElementById('roteiro-progress-visit-text').textContent = visitPct.toFixed(1) + '%';
        document.getElementById('roteiro-progress-visit-bar').style.width = visitPct + '%';

        document.getElementById('roteiro-progress-pos-text').textContent = surveyPct.toFixed(1) + '%';
        document.getElementById('roteiro-progress-pos-bar').style.width = surveyPct + '%';
    }

    // Helper to save itinerary
    window.saveClientItinerary = async function(clientCode, frequency, nextDate, days = '') {
        if (!clientCode || !frequency || !nextDate) {
            window.showToast('warning', 'Preencha todos os campos.');
            return;
        }

        const btn = document.getElementById('save-itinerary-btn');
        const oldHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<svg class="animate-spin h-4 w-4 text-white mr-2" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Salvando...`;

        try {
            const clientCodeNorm = normalizeKey(clientCode);

            // 1. Update Supabase (data_client_promoters)
            // Note: We update existing record. If it doesn't exist, we should theoretically insert, but user should be assigned first.
            // upsert is safer. We need the promoter code.
            // Find current promoter in cache and save entry reference
            let currentPromoter = null;
            let cachedEntries = null;
            if (embeddedData.clientPromotersMap) {
                const matches = embeddedData.clientPromotersMap.get(clientCodeNorm);
                if (matches && matches.length > 0) {
                    currentPromoter = matches[0].promoter_code;
                    cachedEntries = matches;
                }
            }

            // If no promoter assigned, we can't save itinerary comfortably in that table?
            // The prompt implies "Gestão de Carteira" access, so likely assigned.
            // If not assigned, warn user? Or just upsert with null promoter? (Table might not allow null if we didn't check schema constraints, usually PK + columns).
            // Schema: client_code PK, promoter_code text.

            const payload = {
                client_code: clientCodeNorm,
                itinerary_frequency: frequency,
                itinerary_ref_date: nextDate, // Date string YYYY-MM-DD
                itinerary_days: days
            };
            if (currentPromoter) payload.promoter_code = currentPromoter;

            const { error } = await window.supabaseClient.from('data_client_promoters')
                .upsert(payload, { onConflict: 'client_code' });

            if (error) throw error;

            // 2. Update Local Cache (embeddedData.clientPromoters)
            if (cachedEntries && cachedEntries.length > 0) {
                cachedEntries.forEach(entry => {
                    entry.itinerary_frequency = frequency;
                    entry.itinerary_ref_date = nextDate;
                    entry.itinerary_days = days;
                });
            } else {
                const newEntry = {
                    client_code: clientCodeNorm,
                    promoter_code: currentPromoter,
                    itinerary_frequency: frequency,
                    itinerary_ref_date: nextDate,
                    itinerary_days: days
                };
                embeddedData.clientPromoters.push(newEntry);
                if (embeddedData.clientPromotersMap) {
                    embeddedData.clientPromotersMap.set(clientCodeNorm, [newEntry]);
                }
            }

            // 3. Update allClientsData (In-memory Columnar)
            // Access by index
            if (allClientsData instanceof ColumnarDataset) {
                let idx = undefined;
                if (clientMapForKPIs && clientMapForKPIs instanceof IndexMap) {
                    idx = clientMapForKPIs.getIndex(clientCodeNorm);
                }

                // Fallback: Linear search (new clients might not be in map)
                if (idx === undefined) {
                    // Search backwards as new clients are likely at the end
                    // Try to find the correct column for code
                    let codeCol = allClientsData._data['Código'] || allClientsData._data['CODIGO_CLIENTE'] || allClientsData._data['codigo_cliente'];

                    if (codeCol) {
                        for(let i = allClientsData.length - 1; i >= 0; i--) {
                            // Ensure strict string comparison with normalization
                            if (normalizeKey(codeCol[i]) === clientCodeNorm) {
                                idx = i;
                                break;
                            }
                        }
                    }
                }

                if (idx !== undefined) {
                    // Update via Proxy setter to handle overrides in ColumnarDataset
                    const clientProxy = allClientsData.get(idx);
                    if (clientProxy) {
                        clientProxy.ITINERARY_FREQUENCY = frequency;
                        clientProxy.ITINERARY_NEXT_DATE = nextDate;
                        clientProxy.ITINERARY_DAYS = days;
                    }
                }
            } else if (Array.isArray(allClientsData)) {
                const client = allClientsData.find(c => normalizeKey(c['Código'] || c['codigo_cliente']) === clientCodeNorm);
                if (client) {
                    client.ITINERARY_FREQUENCY = frequency;
                    client.ITINERARY_NEXT_DATE = nextDate;
                    client.ITINERARY_DAYS = days;
                }
            }

            // 4. Refresh Views if active
            if (isRoteiroMode) renderRoteiroView();
            window.showToast('success', 'Roteiro salvo com sucesso!');

        } catch(e) {
            console.error(e);
            window.showToast('error', 'Erro ao salvar roteiro: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = oldHtml;
        }
    };

    let clientsTableState = { page: 1, limit: 200, filtered: [] };
    let historyTableState = { page: 1, limit: 50, filtered: [], hasSearched: false };

    window.renderClientView = function() {
        const container = document.getElementById('clientes-list-container');
        const countEl = document.getElementById('clientes-count');
        const searchInput = document.getElementById('clientes-search');
        const roteiroBtn = document.getElementById('toggle-roteiro-btn');


        if (roteiroBtn) {
            // Hide Roteiro for Sellers and Supervisors
            if (window.userIsSeller || window.userIsSupervisor) {
                roteiroBtn.classList.add('hidden');
            } else {
                roteiroBtn.classList.remove('hidden');
            }

            // Remove old listeners (clone trick)
            const newBtn = roteiroBtn.cloneNode(true);
            roteiroBtn.parentNode.replaceChild(newBtn, roteiroBtn);
            newBtn.onclick = (e) => {
                toggleRoteiroMode();
            };

            // Sync state visual
            if (isRoteiroMode) {
                newBtn.classList.add('bg-purple-600', 'border-purple-500');
                newBtn.classList.remove('glass-panel-heavy', 'border-slate-700', 'hover:bg-slate-700');
                newBtn.querySelector('svg').classList.add('text-white');
                newBtn.querySelector('svg').classList.remove('text-purple-400');

                // Enforce View State
                const roteiroContainer = document.getElementById('roteiro-container');
                const listWrapper = document.getElementById('clientes-list-view-wrapper');
                if(roteiroContainer) roteiroContainer.classList.remove('hidden');
                if(listWrapper) listWrapper.classList.add('hidden');
                renderRoteiroView();
            } else {
                // Ensure default state (List Visible)
                const roteiroContainer = document.getElementById('roteiro-container');
                const listWrapper = document.getElementById('clientes-list-view-wrapper');
                if(roteiroContainer) roteiroContainer.classList.add('hidden');
                if(listWrapper) listWrapper.classList.remove('hidden');
            }
        }

        if (!container) return;

        // Create pagination controls if not exist
        let paginationContainer = document.getElementById('clients-pagination');
        if (!paginationContainer) {
            paginationContainer = document.createElement('div');
            paginationContainer.id = 'clients-pagination';
            paginationContainer.className = 'p-4 flex justify-between items-center glass-panel border-t border-white/10 mt-4';
            paginationContainer.innerHTML = `
                <button id="client-prev-btn" class="glass-panel-heavy hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 text-xs transition-colors">Anterior</button>
                <span id="client-page-info" class="text-slate-400 text-xs font-medium"></span>
                <button id="client-next-btn" class="glass-panel-heavy hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 text-xs transition-colors">Próxima</button>
            `;
            container.parentNode.appendChild(paginationContainer);

            document.getElementById('client-prev-btn').addEventListener('click', () => {
                if (clientsTableState.page > 1) {
                    clientsTableState.page--;
                    renderList(null, true);
                }
            });
            document.getElementById('client-next-btn').addEventListener('click', () => {
                const maxPage = Math.ceil(clientsTableState.filtered.length / clientsTableState.limit);
                if (clientsTableState.page < maxPage) {
                    clientsTableState.page++;
                    renderList(null, true);
                }
            });
        }

        const renderList = (filterValue = null, isPagination = false) => {
            container.innerHTML = '';

            if (!isPagination) {
                // Reset to page 1 on new filter
                clientsTableState.page = 1;
                const filter = (filterValue !== null ? filterValue : (searchInput ? searchInput.value : '')).toLowerCase();

                // OPTIMIZATION: Use pre-calculated search indices to avoid Proxy overhead
                const searchData = optimizedData.searchIndices.clients || [];

                if (!filter) {
                    clientsTableState.filtered = searchData.filter(c => c.isActive);
                } else {
                    // Split by space for standard search behavior
                    const terms = filter.split(' ').map(t => t.trim()).filter(t => t.length > 0);

                    clientsTableState.filtered = searchData.filter(c => {
                        if (!c.isActive) return false;
                        if (terms.length === 0) return true;

                        return terms.every(term => {
                            return c.code.includes(term) ||
                                   c.nameLower.includes(term) ||
                                   c.cityLower.includes(term) ||
                                   c.bairroLower.includes(term) ||
                                   c.cnpj.includes(term);
                        });
                    });
                }

                // Sort by Name (using pre-stored name)
                clientsTableState.filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            }

            const total = clientsTableState.filtered.length;
            const start = (clientsTableState.page - 1) * clientsTableState.limit;
            const end = start + clientsTableState.limit;
            const subsetIndices = clientsTableState.filtered.slice(start, end);
            const totalPages = Math.ceil(total / clientsTableState.limit) || 1;

            // Map back to full Client Objects (Proxies) for rendering
            const subset = subsetIndices.map(item => {
                 return allClientsData instanceof ColumnarDataset ? allClientsData.get(item.i) : allClientsData[item.i];
            });

            // Update Counts
            if (countEl) countEl.textContent = `${total} Clientes (Página ${clientsTableState.page} de ${totalPages})`;

            // Update Pagination Buttons
            document.getElementById('client-prev-btn').disabled = clientsTableState.page === 1;
            document.getElementById('client-next-btn').disabled = clientsTableState.page >= totalPages;
            document.getElementById('client-page-info').textContent = `${start + 1}-${Math.min(end, total)} de ${total}`;

            subset.forEach((client) => {
                const cod = String(client['Código'] || client['codigo_cliente']);
                const name = client.nomeCliente || 'Desconhecido';
                const fantasia = client.fantasia || '';
                const firstLetter = window.escapeHtml(name.charAt(0).toUpperCase());

                let days = '-';
                if (client.ultimacompra) {
                    const d = parseDate(client.ultimacompra);
                    if (d) {
                        const diffTime = Math.abs(new Date() - d);
                        days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 'd';
                    }
                } else if (client['Data da Última Compra']) {
                     const d = parseDate(client['Data da Última Compra']);
                     if (d) {
                        const diffTime = Math.abs(new Date() - d);
                        days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 'd';
                     }
                }

                let statusColor = 'bg-green-500';
                if (days !== '-' && parseInt(days) > 30) statusColor = 'bg-red-500';

                // Check Monthly Visit
                const visitedThisMonth = myMonthVisits.has(normalizeKey(cod));

                const item = document.createElement('div');
                // Dark Theme Classes with "Shiny" Hover (Left Border)
                item.className = 'p-4 flex items-center justify-between transition-all duration-200 cursor-pointer border-b border-white/10/50 glass-panel hover:bg-white/5/80 border-l-4 border-l-transparent hover:border-l-[#FF5E00] group';
                item.innerHTML = `
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 shrink-0 rounded-full ${statusColor} flex items-center justify-center text-white font-bold text-lg shadow-lg ring-2 ring-slate-800 group-hover:ring-slate-600 transition-all">
                            ${firstLetter}
                        </div>
                        <div>
                            <h3 class="text-sm font-bold text-white leading-tight flex items-center gap-2">
                                ${window.escapeHtml(cod)} - ${window.escapeHtml(name)}
                                ${visitedThisMonth ? `
                                    <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Visitado este mês">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 11l3 3L22 4"></path>
                                    </svg>
                                ` : ''}
                            </h3>
                            <p class="text-xs text-slate-400 font-medium mt-0.5">Fantasia: ${window.escapeHtml(fantasia)}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 text-slate-500 glass-panel-heavy px-3 py-1 rounded-full border border-slate-700">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span class="text-xs font-bold text-slate-300">${window.escapeHtml(days)}</span>
                    </div>
                `;
                item.onclick = () => openWalletClientModal(cod, client);
                container.appendChild(item);
            });
        };

        if (searchInput) {
            // Suggestion Logic Helper
            const renderRoteiroSuggestions = (query) => {
                const suggestionsEl = document.getElementById('clientes-search-suggestions');
                if (!suggestionsEl) return;

                if (!query || query.length < 3) {
                    suggestionsEl.classList.add('hidden');
                    return;
                }

                const results = searchLocalClients(query);

                if (results.length === 0) {
                    suggestionsEl.classList.add('hidden');
                    return;
                }

                suggestionsEl.innerHTML = '';
                results.forEach(c => {
                    const div = document.createElement('div');
                    div.className = 'px-4 py-3 border-b border-slate-700 hover:bg-slate-700 cursor-pointer flex justify-between items-center group';
                    const code = c['Código'] || c['codigo_cliente'];
                    const name = c.fantasia || c.nomeCliente || c.razaoSocial || 'Sem Nome';
                    const city = c.cidade || c.CIDADE || '';

                    const leftDiv = document.createElement('div');
                    const titleDiv = document.createElement('div');
                    titleDiv.className = "text-sm font-bold text-white group-hover:text-blue-300 transition-colors";

                    const codeSpan = document.createElement('span');
                    codeSpan.className = "font-mono text-slate-400 mr-2";
                    codeSpan.textContent = code;

                    titleDiv.appendChild(codeSpan);
                    titleDiv.appendChild(document.createTextNode(name));

                    const subDiv = document.createElement('div');
                    subDiv.className = "text-xs text-slate-500";
                    subDiv.textContent = city;

                    leftDiv.appendChild(titleDiv);
                    leftDiv.appendChild(subDiv);

                    div.appendChild(leftDiv);

                    div.onclick = () => {
                        searchInput.value = `${code} - ${name}`; // Visual feedback
                        handleRoteiroSearch(code); // Trigger search logic
                        suggestionsEl.classList.add('hidden');
                    };
                    suggestionsEl.appendChild(div);
                });
                suggestionsEl.classList.remove('hidden');
            };

            // Hide on click outside (One-time binding check)
            if (!searchInput._hasRoteiroBlurListener) {
                document.addEventListener('click', (e) => {
                    const suggestionsEl = document.getElementById('clientes-search-suggestions');
                    if (suggestionsEl && !suggestionsEl.contains(e.target) && e.target !== searchInput) {
                        suggestionsEl.classList.add('hidden');
                    }
                });
                searchInput._hasRoteiroBlurListener = true;
            }

            let searchTimeout;
            searchInput.oninput = (e) => {
                if (isRoteiroMode) {
                    const val = e.target.value;
                    if (!val) {
                        handleRoteiroSearch('');
                        const suggestionsEl = document.getElementById('clientes-search-suggestions');
                        if (suggestionsEl) suggestionsEl.classList.add('hidden');
                    } else {
                        renderRoteiroSuggestions(val);
                    }
                } else {
                    const suggestionsEl = document.getElementById('clientes-search-suggestions');
                    if (suggestionsEl) suggestionsEl.classList.add('hidden');

                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        renderList(e.target.value);
                    }, 300);
                }
            };
        }
        renderList();
    }

    let isHistoryViewInitialized = false;
    window.renderHistoryView = function() {
        if (!isHistoryViewInitialized) {
            setupHierarchyFilters('history', null); // Reuse hierarchy logic

            // Set default dates (Current Month)
            const now = typeof lastSaleDate !== 'undefined' && lastSaleDate ? new Date(lastSaleDate) : new Date();
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

            const startEl = document.getElementById('history-date-start');
            const endEl = document.getElementById('history-date-end');

            if (startEl && endEl) {
                startEl.valueAsDate = firstDay;
                endEl.valueAsDate = lastDay;
            } else {
                console.error("History date inputs not found!");
            }

            let historySupplierFilterBtn = document.getElementById('history-supplier-filter-btn');
            let historySupplierFilterText = document.getElementById('history-supplier-filter-text');
            let historySupplierFilterDropdown = document.getElementById('history-supplier-filter-dropdown');
            let selectedHistorySuppliers = [];

            const filterBtn = document.getElementById('history-filter-btn');
            if(filterBtn) filterBtn.addEventListener('click', filterHistoryView);

            // Initialize Supplier Filter Dropdown Options
            if (historySupplierFilterDropdown) {
                selectedHistorySuppliers = updateSupplierFilter(historySupplierFilterDropdown, historySupplierFilterText, selectedHistorySuppliers, [...allSalesData, ...allHistoryData], 'history');

                if (!historySupplierFilterDropdown._hasListener) {
                    historySupplierFilterBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        historySupplierFilterDropdown.classList.toggle('hidden');
                    });

                    document.addEventListener('click', (e) => {
                        if (!historySupplierFilterBtn.contains(e.target) && !historySupplierFilterDropdown.contains(e.target)) {
                            historySupplierFilterDropdown.classList.add('hidden');
                        }
                    });

                    historySupplierFilterDropdown.addEventListener('change', (e) => {
                         if (e.target.type === 'checkbox') {
                             const val = e.target.value;
                             if (e.target.checked) selectedHistorySuppliers.push(val);
                             else selectedHistorySuppliers = selectedHistorySuppliers.filter(s => s !== val);
                             selectedHistorySuppliers = updateSupplierFilter(historySupplierFilterDropdown, historySupplierFilterText, selectedHistorySuppliers, [...allSalesData, ...allHistoryData], 'history');
                             // Auto-filter on change
                             historyTableState.page = 1;
                             filterHistoryView();
                         }
                    });
                    historySupplierFilterDropdown._hasListener = true;
                }
            }

            // Initialize Supplier Filter Dropdown Options
            if (historySupplierFilterDropdown) {
                selectedHistorySuppliers = updateSupplierFilter(historySupplierFilterDropdown, historySupplierFilterText, selectedHistorySuppliers, [...allSalesData, ...allHistoryData], 'history');

                if (!historySupplierFilterDropdown._hasListener) {
                    historySupplierFilterBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        historySupplierFilterDropdown.classList.toggle('hidden');
                    });

                    document.addEventListener('click', (e) => {
                        if (!historySupplierFilterBtn.contains(e.target) && !historySupplierFilterDropdown.contains(e.target)) {
                            historySupplierFilterDropdown.classList.add('hidden');
                        }
                    });

                    historySupplierFilterDropdown.addEventListener('change', (e) => {
                         if (e.target.type === 'checkbox') {
                             const val = e.target.value;
                             if (e.target.checked) selectedHistorySuppliers.push(val);
                             else selectedHistorySuppliers = selectedHistorySuppliers.filter(s => s !== val);
                             selectedHistorySuppliers = updateSupplierFilter(historySupplierFilterDropdown, historySupplierFilterText, selectedHistorySuppliers, [...allSalesData, ...allHistoryData], 'history');
                             // Auto-filter on change
                             historyTableState.page = 1;
                             filterHistoryView();
                         }
                    });
                    historySupplierFilterDropdown._hasListener = true;
                }
            }

            // Initialize Supplier Filter Dropdown Options
            if (historySupplierFilterDropdown) {
                selectedHistorySuppliers = updateSupplierFilter(historySupplierFilterDropdown, historySupplierFilterText, selectedHistorySuppliers, [...allSalesData, ...allHistoryData], 'history');

                if (!historySupplierFilterDropdown._hasListener) {
                    historySupplierFilterBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        historySupplierFilterDropdown.classList.toggle('hidden');
                    });

                    document.addEventListener('click', (e) => {
                        if (!historySupplierFilterBtn.contains(e.target) && !historySupplierFilterDropdown.contains(e.target)) {
                            historySupplierFilterDropdown.classList.add('hidden');
                        }
                    });

                    historySupplierFilterDropdown.addEventListener('change', (e) => {
                         if (e.target.type === 'checkbox') {
                             const val = e.target.value;
                             if (e.target.checked) selectedHistorySuppliers.push(val);
                             else selectedHistorySuppliers = selectedHistorySuppliers.filter(s => s !== val);
                             selectedHistorySuppliers = updateSupplierFilter(historySupplierFilterDropdown, historySupplierFilterText, selectedHistorySuppliers, [...allSalesData, ...allHistoryData], 'history');
                             // Auto-filter on change
                             historyTableState.page = 1;
                             filterHistoryView();
                         }
                    });
                    historySupplierFilterDropdown._hasListener = true;
                }
            }

            // Pagination listeners
            document.getElementById('history-prev-page-btn').addEventListener('click', () => {
                if(historyTableState.page > 1) {
                    historyTableState.page--;
                    renderHistoryTable();
                }
            });
            document.getElementById('history-next-page-btn').addEventListener('click', () => {
                const max = Math.ceil(historyTableState.filtered.length / historyTableState.limit);
                if(historyTableState.page < max) {
                    historyTableState.page++;
                    renderHistoryTable();
                }
            });

            isHistoryViewInitialized = true;
        }
        // Don't auto-search on first load, wait for filter click
        // But if searched previously, maybe render? No, clear state to be safe or keep it?
        // Let's keep it if state exists.
        if (historyTableState.hasSearched) {
            renderHistoryTable();
        }
    }

    function filterHistoryView() {
        console.log("[History] Filtering...");
        // UI Elements
        const startEl = document.getElementById('history-date-start');
        const endEl = document.getElementById('history-date-end');
        if (!startEl || !endEl) return;

        const startVal = startEl.value;
        const endVal = endEl.value;
        const posFilter = document.getElementById('history-posicao-filter').value;
        const clientFilter = document.getElementById('history-codcli-filter').value.toLowerCase();

        if (!startVal || !endVal) {
            window.showToast('warning', 'Por favor, selecione as datas inicial e final.');
            return;
        }

        const startDate = new Date(startVal);
        const endDate = new Date(endVal);
        startDate.setUTCHours(0,0,0,0);
        endDate.setUTCHours(23,59,59,999);

        const startTs = startDate.getTime();
        const endTs = endDate.getTime();

        // Show Loading
        const tbody = document.getElementById('history-table-body');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-slate-400">Filtrando dados... <span class="animate-spin inline-block ml-2">⏳</span></td></tr>';

        // 1. Get Base Data (Hierarchy)
        const clients = getHierarchyFilteredClients('history', allClientsData);
        // Optimize: Use Set of Strings
        const validClientCodes = new Set();
        const clientsLen = clients.length;
        const isColumnar = clients instanceof ColumnarDataset;
        for(let i=0; i<clientsLen; i++) {
             const c = isColumnar ? clients.get(i) : clients[i];
             validClientCodes.add(normalizeKey(c['Código'] || c['codigo_cliente']));
        }

        const state = hierarchyState['history'];
        const hasHierarchyFilters = state && (state.coords.size > 0 || state.cocoords.size > 0 || state.promotors.size > 0);
        const isAdmin = window.userRole === 'adm';
        const enforceHierarchy = !isAdmin || hasHierarchyFilters;

        const effectiveCoords = new Set(state ? state.coords : []);
        if (userHierarchyContext && userHierarchyContext.role === 'coord') {
            if (userHierarchyContext.coord) effectiveCoords.add(userHierarchyContext.coord);
        }

        // Prepare Async Data Sources
        // We will process allHistoryData AND allSalesData
        const sources = [allHistoryData];
        if (allSalesData) sources.push(allSalesData);

        const ordersMap = new Map();

        let currentSourceIndex = 0;
        let currentIndex = 0;

        function processChunk() {
            const start = performance.now();

            while (currentSourceIndex < sources.length) {
                const source = sources[currentSourceIndex];
                const total = source.length;
                const isCol = source instanceof ColumnarDataset;

                while (currentIndex < total) {
                    const s = isCol ? source.get(currentIndex) : source[currentIndex];
                    currentIndex++;

                    // --- INLINE CHECKS FOR PERFORMANCE ---

                    // 1. Date Check (Numeric)
                    let ts = s.DTPED;
                    // Fallback if DTPED is string (should rarely happen with worker optimization)
                    if (typeof ts !== 'number') {
                         const d = parseDate(ts);
                         ts = d ? d.getTime() : 0;
                    }

                    if (ts < startTs || ts > endTs) continue;

                    // 2. Client Check
                    const codCli = normalizeKey(s.CODCLI);

                    if (enforceHierarchy) {
                        if (!validClientCodes.has(codCli)) {
                            // Check Orphan Match
                            let isOrphanMatch = false;
                            if (effectiveCoords.size > 0) {
                                 const supName = String(s.SUPERV || '').toUpperCase().trim();
                                 const supCode = String(s.CODSUPERVISOR || '').toUpperCase().trim();
                                 if (supCode && effectiveCoords.has(supCode)) isOrphanMatch = true;
                                 else if (supName && typeof optimizedData !== 'undefined' && optimizedData.supervisorCodeByName) {
                                     const mappedCode = optimizedData.supervisorCodeByName.get(supName);
                                     if (mappedCode && effectiveCoords.has(mappedCode)) isOrphanMatch = true;
                                 }
                            }
                            if (!isOrphanMatch) continue;
                        }
                    }

                    // 3. Text Filter Check
                    if (clientFilter) {
                        const clientObj = clientMapForKPIs.get(codCli);
                        // Optimization: Check code first (fastest)
                        if (!codCli.toLowerCase().includes(clientFilter)) {
                            // Then check name/city
                             const name = clientObj ? (clientObj.nomeCliente || clientObj.fantasia || '') : '';
                             const city = clientObj ? (clientObj.cidade || '') : '';
                             const bairro = clientObj ? (clientObj.bairro || '') : '';
                             const terms = clientFilter.split(' ').filter(t => t.length > 0);
                             const match = terms.every(term => {
                                return codCli.toLowerCase().includes(term) ||
                                       name.toLowerCase().includes(term) ||
                                       city.toLowerCase().includes(term) ||
                                       bairro.toLowerCase().includes(term);
                             });
                             if (!match) continue;
                        }
                    }

                    // 4. Position Check
                    if (posFilter && s.POSICAO !== posFilter) continue;

                    // --- ADD TO RESULTS (AGGREGATE) ---
                    const key = s.PEDIDO;
                    if (!ordersMap.has(key)) {
                        // Resolve Name once
                         const cObj = clientMapForKPIs.get(codCli);
                         const cName = cObj ? (cObj.nomeCliente || cObj.fantasia) : 'N/A';

                        ordersMap.set(key, {
                            PEDIDO: key,
                            DTPED: s.DTPED, // Keep timestamp
                            CODCLI: s.CODCLI,
                            NOME: s.NOME,
                            CODFOR: s.CODFOR,
                            VLVENDA: 0,
                            POSICAO: s.POSICAO,
                            CLIENTE_NOME: cName
                        });
                    }
                    const o = ordersMap.get(key);
                    o.VLVENDA += (Number(s.VLVENDA) || 0);

                    // Time Budget Check
                    if (performance.now() - start > 12) {
                        setTimeout(processChunk, 0);
                        return;
                    }
                }

                // Finished source
                currentSourceIndex++;
                currentIndex = 0;
            }

            // --- ALL DONE ---
            finishFiltering();
        }

        function finishFiltering() {
            historyTableState.filtered = Array.from(ordersMap.values());
            // Sort by Date Desc
            historyTableState.filtered.sort((a, b) => {
                // DTPED is timestamp number
                return (b.DTPED || 0) - (a.DTPED || 0);
            });

            historyTableState.page = 1;
            historyTableState.hasSearched = true;
            renderHistoryTable();
        }

        // Start
        setTimeout(processChunk, 0);
    }

    function renderHistoryTable() {
        const tbody = document.getElementById('history-table-body');
        const countBadge = document.getElementById('history-count-badge');
        const emptyState = document.getElementById('history-empty-state');
        const pagination = document.getElementById('history-pagination-controls');

        if (!tbody) return;
        tbody.innerHTML = '';

        if (!historyTableState.hasSearched || historyTableState.filtered.length === 0) {
            tbody.appendChild(emptyState.cloneNode(true)); // Restore empty state
            document.getElementById('history-empty-state').classList.remove('hidden'); // Ensure visible
            if (historyTableState.hasSearched && historyTableState.filtered.length === 0) {
                 // Show "No results" instead of "Select period"
                 tbody.querySelector('p.text-lg').textContent = 'Nenhum pedido encontrado';
                 tbody.querySelector('p.text-sm').textContent = 'Tente ajustar os filtros.';
            }
            countBadge.textContent = '0';
            pagination.classList.add('hidden');
            return;
        }

        const total = historyTableState.filtered.length;
        const start = (historyTableState.page - 1) * historyTableState.limit;
        const end = start + historyTableState.limit;
        const subset = historyTableState.filtered.slice(start, end);
        const totalPages = Math.ceil(total / historyTableState.limit) || 1;

        countBadge.textContent = total;
        pagination.classList.remove('hidden');

        // Update Pagination Controls
        document.getElementById('history-prev-page-btn').disabled = historyTableState.page === 1;
        document.getElementById('history-next-page-btn').disabled = historyTableState.page >= totalPages;
        document.getElementById('history-page-info-text').textContent = `${start + 1}-${Math.min(end, total)} de ${total}`;

        subset.forEach(order => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-glass transition-colors border-b border-white/10 last:border-0';

            const dateStr = formatDate(order.DTPED);
            const valStr = (order.VLVENDA || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            let statusColor = 'text-slate-400';
            let statusText = order.POSICAO;
            if (statusText === 'F') { statusText = 'Faturado'; statusColor = 'text-green-400 font-bold'; }
            else if (statusText === 'L') { statusText = 'Liberado'; statusColor = 'text-blue-400'; }
            else if (statusText === 'M') { statusText = 'Montado'; statusColor = 'text-yellow-400'; }
            else if (statusText === 'P') { statusText = 'Pendente'; statusColor = 'text-orange-400'; }
            else if (statusText === 'B') { statusText = 'Bloqueado'; statusColor = 'text-red-400'; }

            tr.innerHTML = `
                <td data-label="Data" class="px-2 py-1.5 md:px-2 md:py-3 text-[10px] md:text-xs text-slate-400 font-mono">${window.escapeHtml(dateStr)}</td>
                <td data-label="Pedido" class="px-2 py-1.5 md:px-2 md:py-3 text-xs md:text-sm text-white font-bold">
                    <button class="text-[#FF5E00] hover:text-[#CC4A00] hover:underline transition-colors order-link font-mono">${window.escapeHtml(order.PEDIDO)}</button>
                </td>
                <td data-label="Cliente" class="px-2 py-1.5 md:px-2 md:py-3">
                    <div class="text-xs md:text-sm text-white max-w-[120px] md:max-w-none truncate" title="${window.escapeHtml(order.CLIENTE_NOME || '')}">${window.escapeHtml(order.CLIENTE_NOME || 'N/A')}</div>
                    <div class="text-[10px] md:text-xs text-slate-500 font-mono">${window.escapeHtml(order.CODCLI)}</div>
                </td>
                <td data-label="Vendedor" class="px-2 py-1.5 md:px-2 md:py-3 text-[10px] md:text-xs text-slate-400 hidden md:table-cell truncate max-w-[100px]" title="${window.escapeHtml(order.NOME || '')}">${window.escapeHtml(order.NOME || '-')}</td>
                <td data-label="Fornecedor" class="px-2 py-1.5 md:px-2 md:py-3 text-[10px] md:text-xs text-slate-400 hidden md:table-cell">${window.escapeHtml(order.CODFOR || '-')}</td>
                <td data-label="Valor" class="px-2 py-1.5 md:px-2 md:py-3 text-xs md:text-sm text-white font-bold text-right">${valStr}</td>
                <td data-label="Status" class="px-2 py-1.5 md:px-2 md:py-3 text-[10px] md:text-xs text-center ${statusColor}">${window.escapeHtml(statusText)}</td>
            `;

            const btn = tr.querySelector('.order-link');
            if (btn) {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    openModal(order.PEDIDO);
                };
            }

            tbody.appendChild(tr);
        });
    }

    const STORAGE_PRODUTOS_URL = "https://dldsocponbjthqxhmttj.supabase.co/storage/v1/object/public/produtos/";

    window.renderProductView = function() {
        const container = document.getElementById('produtos-list-container');
        const countEl = document.getElementById('produtos-count');
        const searchInput = document.getElementById('produtos-search');
        if (!container) return;

        const renderList = (filter = '') => {
            container.innerHTML = '';
            // Get products
            let prodList = embeddedData.products || [];

            const filtered = prodList.filter(p => {
                if (!filter) return true;
                const f = filter.toLowerCase();
                return (p.descricao || '').toLowerCase().includes(f) ||
                       (String(p.code || '')).includes(f);
            });

            const limit = 50;
            const subset = filtered.slice(0, limit);

            if (countEl) countEl.textContent = `${filtered.length} Produtos${filtered.length > limit ? ` (Exibindo ${limit})` : ''}`;

            subset.forEach(prod => {
                const code = prod.code;
                const desc = prod.descricao || 'Sem Descrição';
                const emb = prod.embalagem || 'UNIDADE';
                // Stock
                const stock05 = stockData05.get(code) || 0;
                const stock08 = stockData08.get(code) || 0;
                const totalStock = stock05 + stock08;

                let price = 'R$ --';
                // Try to resolve price from available fields
                const priceVal = prod.preco || prod.price || prod.PRECO || prod.PRICE || prod.preco_venda || prod.PRECO_VENDA;
                if (priceVal) {
                     price = parseFloat(priceVal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                }

                const imageUrl = `${STORAGE_PRODUTOS_URL}${code}.jpg`;

                const item = document.createElement('div');
                // Dark Theme Styling
                item.className = 'p-4 border-b border-white/10 hover:bg-white/5 transition-colors flex gap-4';
                item.innerHTML = `
                    <div class="shrink-0 w-16 h-16 bg-white/5 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center">
                        <img
                            src="${imageUrl}"
                            alt="${window.escapeHtml(desc)}"
                            class="w-full h-full object-contain"
                            loading="lazy"
                            onerror="this.onerror=null; this.src='imagens/logo.png'; this.classList.add('opacity-30', 'p-2');"
                        />
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="text-sm font-bold text-white leading-tight flex-1">${window.escapeHtml(code)} - ${window.escapeHtml(desc)}</h3>
                        </div>
                        <div class="flex justify-between items-center text-xs text-slate-400 mb-2">
                            <span>Emb.: ${window.escapeHtml(emb)}</span>
                            <span>Und.: UN Preço: <span class="font-bold text-green-400">${price}</span></span>
                        </div>
                        <div class="flex justify-between items-center text-xs">
                            <span class="text-slate-500">Cód. fábrica: ${window.escapeHtml(prod.cod_fabrica || code)}</span>
                            <span class="font-bold text-[#FF5E00]">Est.: ${totalStock}</span>
                        </div>
                        <div class="flex gap-2 mt-3 opacity-60 hover:opacity-100 transition-opacity">
                            <button class="p-1.5 bg-slate-700 text-lime-400 rounded hover:bg-slate-600 border border-slate-600" title="Detalhes Comerciais"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg></button>
                            <button class="p-1.5 bg-slate-700 text-red-400 rounded hover:bg-slate-600 border border-slate-600" title="Visualizar Imagem" onclick="window.openImageModal('${imageUrl}', '${window.escapeHtml(desc)} - ${code}')"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg></button>
                            <button class="p-1.5 bg-slate-700 text-blue-400 rounded hover:bg-slate-600 border border-slate-600" title="Estoque" onclick="window.handleProductAction('stock', '${code}')"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg></button>
                            <button class="p-1.5 bg-slate-700 text-purple-400 rounded hover:bg-slate-600 border border-slate-600 ml-auto" title="Expandir" onclick="window.handleProductAction('expand', '${code}')"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg></button>
                        </div>
                    </div>
                `;
                container.appendChild(item);
            });
        };

        if (searchInput) {
            searchInput.oninput = (e) => renderList(e.target.value);
        }
        renderList();
    }

    // --- VISITAS LOGIC ---
    let visitaAbertaId = null;
    let clienteEmVisitaId = null; // Storing Client Code (text) to match our usage
    let currentActionClientCode = null; // For the modal context
    let currentActionClientName = null; // For refetching modal
    let myMonthVisits = new Map(); // Map<ClientCode, Array<Visit>>

    async function fetchMyVisits() {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;

        const now = typeof lastSaleDate !== 'undefined' && lastSaleDate ? new Date(lastSaleDate) : new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const isoStart = `${y}-${m}-01T00:00:00`; // Local start of month

        let query = window.supabaseClient
            .from('visitas')
            .select('id, client_code, id_cliente, created_at, checkout_at, respostas')
            .gte('created_at', isoStart);
            
        // Allow ADM, Co-Coordinator, and Coordinator to see all visits (limited by their base dataset later if needed)
        // Only restrict to user's own visits if they are explicitly a 'promotor'
        const isPromoterLevel = (typeof userHierarchyContext !== 'undefined' && userHierarchyContext.role === 'promotor');
        if (window.userRole !== 'adm' && isPromoterLevel) {
            query = query.eq('id_promotor', user.id);
        }
        
        const { data, error } = await query;

        if (window.userRole !== 'adm') {
            query = query.eq('id_promotor', user.id);
        }

        // Add limit to prevent silent 1000 truncation for admins loading all users
        const { data, error } = await query.limit(50000);

        if (data) {
            myMonthVisits.clear();
            data.forEach(v => {
                const code = normalizeKey(v.client_code || v.id_cliente);
                if (!myMonthVisits.has(code)) myMonthVisits.set(code, []);
                myMonthVisits.get(code).push(v);
            });
        }
    }

    async function verificarEstadoVisita() {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;

        // Fetch all visits for the month first (background)
        fetchMyVisits().then(() => {
            if (isRoteiroMode) renderRoteiroView();
            // Also refresh list view if visible to show tags
            if (!isRoteiroMode && document.getElementById('clientes-view') && !document.getElementById('clientes-view').classList.contains('hidden')) {
                renderClientView();
            }
        });

        const { data, error } = await window.supabaseClient
            .from('visitas')
            .select('id, id_cliente, client_code')
            .eq('id_promotor', user.id)
            .is('checkout_at', null)
            .maybeSingle();

        if (data) {
            visitaAbertaId = data.id;
            // Prefer client_code if available, else id_cliente (which we decided to be text/flexible)
            clienteEmVisitaId = data.client_code || data.id_cliente;
            console.log(`[Visitas] Visita aberta encontrada: ID ${visitaAbertaId}, Cliente ${clienteEmVisitaId}`);
        } else {
            console.log("[Visitas] Nenhuma visita aberta.");
        }
        // Re-render roteiro if active to update UI state
        if (isRoteiroMode) renderRoteiroView();
    }

    window.openActionModal = function(clientCode, clientName) {
        currentActionClientCode = String(clientCode);
        if (clientName) currentActionClientName = clientName; // Cache name
        else if (!currentActionClientName) currentActionClientName = 'Cliente';

        const modal = document.getElementById('modal-acoes-visita');
        const title = document.getElementById('acoes-visita-titulo');
        const subtitle = document.getElementById('acoes-visita-subtitulo');
        const statusText = document.getElementById('status-text-visita');
        const statusCard = document.getElementById('status-card-visita');

        // Update Title & Subtitle
        title.textContent = currentActionClientName;
        // Try to find city/info from dataset if possible, or just show code
        let extraInfo = `Código: ${currentActionClientCode}`;
        const clientObj = clientMapForKPIs.get(normalizeKey(currentActionClientCode));
        if (clientObj) {
             const city = clientObj.cidade || clientObj['Nome da Cidade'] || '';
             if (city) extraInfo += ` • ${city}`;
        }
        subtitle.textContent = extraInfo;

        // Get Buttons
        const btnCheckIn = document.getElementById('btn-acao-checkin');
        const btnCheckOut = document.getElementById('btn-acao-checkout');
        const btnPesquisa = document.getElementById('btn-acao-pesquisa');
        const btnDetalhes = document.getElementById('btn-acao-detalhes');
        const btnGeo = document.getElementById('btn-acao-geo');

        // Logic
        // Normalize for comparison
        const normCurrent = normalizeKey(currentActionClientCode);
        const normOpen = clienteEmVisitaId ? normalizeKey(clienteEmVisitaId) : null;

        if (visitaAbertaId) {
            if (normOpen === normCurrent) {
                // This is the active visit
                btnCheckIn.classList.add('hidden');
                btnCheckOut.classList.remove('hidden');
                btnPesquisa.classList.remove('hidden');

                statusText.textContent = 'Em Andamento';
                statusText.className = 'text-sm font-bold text-green-400 animate-pulse';
                statusCard.classList.add('border-green-500/30', 'bg-green-500/5');
                statusCard.classList.remove('border-slate-700/50', 'bg-glass');
            } else {
                // Visit open for ANOTHER client
                btnCheckIn.classList.remove('hidden');
                btnCheckIn.disabled = true;
                btnCheckIn.innerHTML = `<span class="text-xs">Finalize a visita anterior (${normOpen})</span>`;
                btnCheckOut.classList.add('hidden');
                btnPesquisa.classList.add('hidden');

                statusText.textContent = 'Outra Visita Ativa';
                statusText.className = 'text-sm font-bold text-orange-400';
                statusCard.classList.remove('border-green-500/30', 'bg-green-500/5');
                statusCard.classList.add('border-slate-700/50', 'bg-glass');
            }
        } else {
            // No open visit
            btnCheckIn.classList.remove('hidden');
            btnCheckIn.disabled = false;
            btnCheckIn.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                Check-in
            `;
            btnCheckOut.classList.add('hidden');
            btnPesquisa.classList.add('hidden');

            statusText.textContent = 'Não Iniciada';
            statusText.className = 'text-sm font-bold text-slate-400';
            statusCard.classList.remove('border-green-500/30', 'bg-green-500/5');
            statusCard.classList.add('border-slate-700/50', 'bg-glass');
        }

        // Bind Actions (Clean old listeners via cloning)
        const bind = (btn, fn) => {
            if (!btn) return;
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', fn);
            return newBtn;
        };

        bind(btnCheckIn, () => fazerCheckIn(currentActionClientCode));
        bind(btnCheckOut, () => fazerCheckOut());
        bind(btnPesquisa, () => abrirPesquisa());
        bind(btnGeo, () => openGeoUpdateModal());
        bind(btnDetalhes, () => {
            // Keep Action Modal open in background to prevent blinking/state loss
            openWalletClientModal(currentActionClientCode);
        });

        modal.classList.remove('hidden');
    }

    async function fazerCheckIn(clientCode) {
        if (!navigator.geolocation) {
            window.showToast('error', 'Geolocalização não suportada.');
            return;
        }

        const btn = document.getElementById('btn-acao-checkin');
        const oldHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '...';

        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            const { data: { user } } = await window.supabaseClient.auth.getUser();

            if (!user) {
                window.showToast('error', 'Erro: Usuário não autenticado.');
                btn.disabled = false; btn.innerHTML = oldHtml;
                return;
            }

            // 1. Insert Visit
            const payload = {
                id_promotor: user.id,
                id_cliente: clientCode, // Text
                client_code: clientCode, // Text
                latitude,
                longitude,
                status: 'pendente',
                promotor_name: window.userFullName || window.userName || 'Promotor'
            };

            // Determine if Off Route (Logic: Is Roteiro Mode AND Date > Today)
            // Note: roteiroDate is global
            if (typeof isRoteiroMode !== 'undefined' && isRoteiroMode) {
                const today = new Date(); today.setHours(0,0,0,0);
                const routeRef = new Date(roteiroDate); routeRef.setHours(0,0,0,0);

                if (routeRef > today) {
                    // Initialize respostas with the flag
                    payload.respostas = { is_off_route: true };
                }
            }

            // Include Co-Coordinator Code if available (From Init)
            if (window.userCoCoordCode) {
                payload.cod_cocoord = window.userCoCoordCode;
            }
            // Include Pre-Resolved Email if available (Frontend-First Strategy)
            if (window.userCoCoordEmail) {
                payload.coordenador_email = window.userCoCoordEmail;
            }

            let response = await window.supabaseClient.from('visitas').insert(payload).select().single();

            // Self-Healing: Fallback for ANY error if we sent new columns
            if (response.error && (payload.cod_cocoord || payload.coordenador_email)) {
                console.warn("[CheckIn] Error detected with new columns. Retrying purely...", response.error);
                delete payload.cod_cocoord;
                delete payload.coordenador_email;
                response = await window.supabaseClient.from('visitas').insert(payload).select().single();
            }

            if (response.error) {
                console.error(response.error);
                window.showToast('error', 'Erro ao fazer check-in: ' + response.error.message);
                btn.disabled = false; btn.innerHTML = oldHtml;
                return;
            }

            visitaAbertaId = response.data.id;
            clienteEmVisitaId = clientCode;

            // Update Local Cache (Fix for Status not updating)
            const normalizedCode = normalizeKey(clientCode);
            if (!myMonthVisits.has(normalizedCode)) myMonthVisits.set(normalizedCode, []);
            myMonthVisits.get(normalizedCode).push(response.data);

            // REFRESH UI (Keep Modal Open, Update State)
            if (isRoteiroMode) renderRoteiroView();
            openActionModal(currentActionClientCode, currentActionClientName); // Re-open/Refresh

        }, (err) => {
            console.error(err);
            window.showToast('error', 'Erro ao obter localização. Permita o acesso e tente novamente.');
            btn.disabled = false;
            btn.innerHTML = oldHtml;
        }, { enableHighAccuracy: true, timeout: 10000 });
    }

    // --- GEO UPDATE LOGIC ---
    let geoUpdateMap = null;
    let geoUpdateMarker = null;
    let currentGeoLat = null;
    let currentGeoLng = null;

    function openGeoUpdateModal() {
        // Keep Action Modal open in background
        const modal = document.getElementById('modal-geo-update');
        const loading = document.getElementById('geo-update-loading');

        modal.classList.remove('hidden');
        loading.classList.remove('hidden');

        if (!navigator.geolocation) {
            window.showToast('error', "Geolocalização não suportada.");
            modal.classList.add('hidden');
            return;
        }

        navigator.geolocation.getCurrentPosition((pos) => {
            const { latitude, longitude } = pos.coords;
            currentGeoLat = latitude;
            currentGeoLng = longitude;

            loading.classList.add('hidden');

            if (!geoUpdateMap) {
                geoUpdateMap = L.map('geo-update-map').setView([latitude, longitude], 16);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap'
                }).addTo(geoUpdateMap);
            } else {
                geoUpdateMap.invalidateSize(); // Fix render issues in modal
                geoUpdateMap.setView([latitude, longitude], 16);
            }

            if (geoUpdateMarker) geoUpdateMap.removeLayer(geoUpdateMarker);

            geoUpdateMarker = L.marker([latitude, longitude], { draggable: true }).addTo(geoUpdateMap);

            // Allow manual refinement
            geoUpdateMarker.on('dragend', function(e) {
                const pos = e.target.getLatLng();
                currentGeoLat = pos.lat;
                currentGeoLng = pos.lng;
            });

        }, (err) => {
            console.error(err);
            window.showToast('error', "Erro ao obter localização.");
            modal.classList.add('hidden');
        }, { enableHighAccuracy: true });

        // Bind Confirm Button
        const confirmBtn = document.getElementById('btn-confirm-geo-update');
        // Clean listeners
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

        newBtn.addEventListener('click', async () => {
            if (!currentGeoLat || !currentGeoLng || !currentActionClientCode) return;

            const oldText = newBtn.innerHTML;
            newBtn.disabled = true;
            newBtn.innerHTML = 'Salvando...';

            try {
                const { error } = await window.supabaseClient
                    .from('data_client_coordinates')
                    .upsert({
                        client_code: currentActionClientCode,
                        lat: currentGeoLat,
                        lng: currentGeoLng,
                        updated_at: new Date().toISOString()
                    });

                if (error) throw error;

                // Update Local Cache
                clientCoordinatesMap.set(String(currentActionClientCode), {
                    lat: currentGeoLat,
                    lng: currentGeoLng,
                    address: 'Atualizado Manualmente'
                });

                // Update Visuals if needed (e.g. City Map if open)
                if (heatLayer) {
                    if (leafletMap && leafletMap.hasLayer(heatLayer)) {
                        heatLayer.addLatLng([currentGeoLat, currentGeoLng, 1]);
                    } else {
                        if (!heatLayer._latlngs) heatLayer._latlngs = [];
                        heatLayer._latlngs.push([currentGeoLat, currentGeoLng, 1]);
                    }
                }

                window.showToast('success', 'Geolocalização atualizada com sucesso!');
                modal.classList.add('hidden');
            } catch (e) {
                console.error(e);
                window.showToast('error', 'Erro ao salvar: ' + e.message);
            } finally {
                newBtn.disabled = false;
                newBtn.innerHTML = oldText;
            }
        });
    }

    async function fazerCheckOut() {
        if (!visitaAbertaId) return;

        const btn = document.getElementById('btn-acao-checkout');
        const oldHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = 'Finalizando...';

        const checkoutTime = new Date().toISOString();
        try {
            const { error } = await window.supabaseClient
                .from('visitas')
                .update({ checkout_at: checkoutTime })
                .eq('id', visitaAbertaId);

            if (error) throw error;

            // Update Local Cache
            if (clienteEmVisitaId) {
                const normalizedCode = normalizeKey(clienteEmVisitaId);
                const visits = myMonthVisits.get(normalizedCode);
                if (visits) {
                    const visit = visits.find(v => v.id === visitaAbertaId);
                    if (visit) {
                        visit.checkout_at = checkoutTime;
                    }
                }
            }

            visitaAbertaId = null;
            clienteEmVisitaId = null;
            document.getElementById('modal-acoes-visita').classList.add('hidden');
            renderRoteiroView();
            window.showToast('success', 'Visita finalizada!');
        } catch (error) {
            console.error(error);
            window.showToast('error', 'Erro ao fazer check-out: ' + error.message);
        } finally {
            // Fix: Re-enable button on error and success
            btn.disabled = false;
            btn.innerHTML = oldHtml;
        }
    }

    async function abrirPesquisa() {
        // Keep Action Modal open in background
        const modal = document.getElementById('modal-relatorio');
        const form = document.getElementById('form-visita');
        document.getElementById('visita-atual-id').value = visitaAbertaId;

        // Reset form or load previous?
        // Plan says "Carregamos os dados da última visita".
        // Logic: Fetch LAST visit answers for THIS client.

        form.reset();
        resetRackMultiSelect();
        resetCustomFileInput();

        // Fetch last answers
        if (clienteEmVisitaId) {
             const { data } = await window.supabaseClient
                .from('visitas')
                .select('respostas')
                .eq('client_code', clienteEmVisitaId) // Use client_code
                .not('respostas', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

             if (data && data.respostas) {
                 Object.keys(data.respostas).forEach(key => {
                     if (key === 'tipo_rack') {
                         resetRackMultiSelect(data.respostas[key]);
                     } else {
                         const field = form.elements[key];
                         if (field) {
                             if (field instanceof RadioNodeList) field.value = data.respostas[key];
                             else field.value = data.respostas[key];
                         }
                     }
                 });
             }
        }

        modal.classList.remove('hidden');
    }

    // --- Navigation Helpers ---
    window.closeResearchModal = function() {
        document.getElementById('modal-relatorio').classList.add('hidden');
    }

    window.closeGeoModal = function() {
        document.getElementById('modal-geo-update').classList.add('hidden');
    }

    // Bind Form Submit
    const formVisita = document.getElementById('form-visita');
    if (formVisita) {
        formVisita.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Validação de fotos obrigatórias
            let isValidFotos = false;

            if (window.visitaFotosState) {
                const isModoAntesDepois = window.visitaFotosState.modo === 'antes-depois';
                if (isModoAntesDepois) {
                    const hasAntes = window.visitaFotosState.fotos.antes && window.visitaFotosState.fotos.antes.length > 0;
                    const hasDepois = window.visitaFotosState.fotos.depois && window.visitaFotosState.fotos.depois.length > 0;
                    if (hasAntes && hasDepois) {
                        isValidFotos = true;
                    }
                } else {
                    const hasGeral = window.visitaFotosState.fotos.geral && window.visitaFotosState.fotos.geral.length > 0;
                    if (hasGeral) {
                        isValidFotos = true;
                    }
                }
            }

            if (!isValidFotos) {
                if (window.showToast) {
                    window.showToast('error', 'É obrigatório adicionar pelo menos uma foto para enviar a pesquisa');
                } else {
                    alert('É obrigatório adicionar pelo menos uma foto para enviar a pesquisa');
                }
                return; // Interrompe o envio e mantém o modal aberto
            }

            const btn = e.target.querySelector('button[type="submit"]');
            const oldHtml = btn.innerHTML;
            btn.disabled = true; btn.innerHTML = 'Salvando...';

            const formData = new FormData(e.target);
            const respostas = Object.fromEntries(formData.entries());

            // Remove internal fields if any
            const visitId = respostas.visita_id;
            delete respostas.visita_id;

            // Extract observation
            const obs = respostas.observacoes;
            delete respostas.observacoes; // Store obs separately in column

            // Handle Múltiplas Fotos (Antes/Depois ou Geral)
            const fotosArray = [];
            
            // Helper to upload a single file
            const uploadFile = async (file, prefix) => {
                if (!file || file.size === 0) return null;
                const fileName = `${visitId}_${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
                try {
                    const { data, error: uploadError } = await window.supabaseClient
                        .storage
                        .from('visitas-images')
                        .upload(fileName, file, { cacheControl: '3600', upsert: false });

                    if (!uploadError) {
                        const { data: publicUrlData } = window.supabaseClient
                            .storage
                            .from('visitas-images')
                            .getPublicUrl(fileName);
                        return publicUrlData ? publicUrlData.publicUrl : null;
                    }
                } catch (e) {
                    console.error('Upload error:', e);
                }
                return null;
            };

            // Read state from window.visitaFotosState
            if (window.visitaFotosState) {
                const isModoAntesDepois = window.visitaFotosState.modo === 'antes-depois';
                
                if (isModoAntesDepois) {
                    // Upload Antes/Depois in Parallel
                    btn.innerHTML = `Enviando fotos (Antes/Depois)...`;
                    const [antesUrls, depoisUrls] = await Promise.all([
                        Promise.all((window.visitaFotosState.fotos.antes || []).map(file => uploadFile(file, 'antes'))),
                        Promise.all((window.visitaFotosState.fotos.depois || []).map(file => uploadFile(file, 'depois')))
                    ]);
                    antesUrls.forEach(url => { if (url) fotosArray.push({ url, tipo: 'antes' }); });
                    depoisUrls.forEach(url => { if (url) fotosArray.push({ url, tipo: 'depois' }); });
                } else {
                    // Upload Geral in Parallel
                    btn.innerHTML = `Enviando fotos GERAL...`;
                    const geralUrls = await Promise.all(
                        (window.visitaFotosState.fotos.geral || []).map(file => uploadFile(file, 'geral'))
                    );
                    geralUrls.forEach(url => { if (url) fotosArray.push({ url, tipo: 'geral' }); });
                }
            }

            if (fotosArray.length > 0) {
                respostas.fotos = fotosArray; // Append array of urls
            }
            
            // Cleanup legacy field if it somehow got in
            delete respostas.foto_gondola;

            btn.innerHTML = 'Salvando dados...';

            try {
                const { error } = await window.supabaseClient
                    .from('visitas')
                    .update({
                        respostas: respostas,
                        observacao: obs
                    })
                    .eq('id', visitId);

                if (error) throw error;

                // Update Local Cache
                if (clienteEmVisitaId) {
                    const normalizedCode = normalizeKey(clienteEmVisitaId);
                    const visits = myMonthVisits.get(normalizedCode);
                    if (visits) {
                        const visit = visits.find(v => v.id === visitId);
                        if (visit) {
                            visit.respostas = respostas;
                        }
                    }
                }

                // Refresh Roteiro View (Progress Bars)
                if (typeof isRoteiroMode !== 'undefined' && isRoteiroMode) renderRoteiroView();

                document.getElementById('modal-relatorio').classList.add('hidden');
                window.showToast('success', 'Relatório salvo!');

                // Return to Action Menu
                if (currentActionClientCode) {
                    openActionModal(currentActionClientCode, currentActionClientName);
                }

            } catch (err) {
                window.showToast('error', 'Erro ao salvar: ' + err.message);
            } finally {
                btn.disabled = false; btn.innerHTML = oldHtml;
            }
        });
    }

    function renderWeeklyComparisonAmChart(weekLabels, currentData, historyData, isTendency) {
        // Dispose existing root (Robust Check)
        if (window.am5 && window.am5.registry && window.am5.registry.rootElements) {
             for (let i = window.am5.registry.rootElements.length - 1; i >= 0; i--) {
                 const r = window.am5.registry.rootElements[i];
                 if (r.dom && r.dom.id === "weeklyComparisonChartContainer") {
                     r.dispose();
                 }
             }
        }
        weeklyAmChartRoot = null;

        // Clean container (remove any canvas from Chart.js)
        const container = document.getElementById('weeklyComparisonChartContainer');
        if (!container) return;
        container.innerHTML = '';

        // amCharts 5 Logic
        if (!window.am5) {
            console.error("amCharts 5 not loaded");
            return;
        }

        const am5 = window.am5;
        const am5xy = window.am5xy;
        const am5themes_Animated = window.am5themes_Animated;
        const am5themes_Dark = window.am5themes_Dark;

        const root = am5.Root.new("weeklyComparisonChartContainer");
        weeklyAmChartRoot = root;

        if (root._logo) {
            root._logo.dispose();
        }

        root.setThemes([
            am5themes_Animated.new(root),
            am5themes_Dark.new(root)
        ]);

        const chart = root.container.children.push(
            am5xy.XYChart.new(root, {
                panX: true,
                panY: false,
                wheelX: "panX",
                wheelY: "zoomX",
                layout: root.verticalLayout
            })
        );

        // Prepare Data
        const data = weekLabels.map((label, i) => ({
            category: label,
            current: currentData[i] || 0,
            history: historyData[i] || 0
        }));

        // X Axis (Weeks)
        const xRenderer = am5xy.AxisRendererX.new(root, {
            minGridDistance: 30,
            minorGridEnabled: true
        });

        // Clean Look: Hide grid
        xRenderer.grid.template.set("forceHidden", true);

        const xAxis = chart.xAxes.push(
            am5xy.CategoryAxis.new(root, {
                categoryField: "category",
                renderer: xRenderer,
                tooltip: am5.Tooltip.new(root, {})
            })
        );
        xAxis.data.setAll(data);

        // Y Axis
        const yRenderer = am5xy.AxisRendererY.new(root, {});
        // Clean Look: Hide grid
        yRenderer.grid.template.set("forceHidden", true);

        const yAxis = chart.yAxes.push(
            am5xy.ValueAxis.new(root, {
                renderer: yRenderer
            })
        );

        // Series 1: Current (Column) - Indigo
        const series1 = chart.series.push(
            am5xy.ColumnSeries.new(root, {
                name: isTendency ? "Tendência Semanal" : "Mês Atual",
                xAxis: xAxis,
                yAxis: yAxis,
                valueYField: "current",
                categoryXField: "category",
                fill: am5.color(0x3f51b5),
                tooltip: am5.Tooltip.new(root, {
                    pointerOrientation: "horizontal",
                    labelText: "{name}: [bold]{valueY}[/]"
                })
            })
        );

        series1.columns.template.setAll({
            cornerRadiusTL: 5,
            cornerRadiusTR: 5,
            fillOpacity: 0.8,
            strokeWidth: 0
        });

        series1.data.setAll(data);

        // Series 2: History (Line) - Cyan
        const series2 = chart.series.push(
            am5xy.LineSeries.new(root, {
                name: "Média Trimestre",
                xAxis: xAxis,
                yAxis: yAxis,
                valueYField: "history",
                categoryXField: "category",
                stroke: am5.color(0x00e5ff),
                tooltip: am5.Tooltip.new(root, {
                    pointerOrientation: "horizontal",
                    labelText: "{name}: [bold]{valueY}[/]"
                })
            })
        );

        series2.strokes.template.setAll({
            strokeWidth: 3
        });

        series2.bullets.push(function () {
            return am5.Bullet.new(root, {
                sprite: am5.Circle.new(root, {
                    radius: 5,
                    fill: series2.get("stroke")
                })
            });
        });

        series2.data.setAll(data);

        // Cursor
        const cursor = chart.set("cursor", am5xy.XYCursor.new(root, {
            behavior: "zoomX"
        }));
        cursor.lineY.set("visible", false);

        // Legend
        const legend = chart.children.push(am5.Legend.new(root, {
            centerX: am5.p50,
            x: am5.p50
        }));
        legend.data.setAll(chart.series.values);

        // Animation
        series1.appear(1000, 100);
        series2.appear(1000, 100);
        chart.appear(1000, 100);
    }

    function renderMonthlyComparisonAmChart(labels, dataValues, labelName, colorHex) {
        // Dispose existing root (Robust Check)
        if (window.am5 && window.am5.registry && window.am5.registry.rootElements) {
             for (let i = window.am5.registry.rootElements.length - 1; i >= 0; i--) {
                 const r = window.am5.registry.rootElements[i];
                 if (r.dom && r.dom.id === "monthlyComparisonChartContainer") {
                     r.dispose();
                 }
             }
        }
        monthlyAmChartRoot = null;

        const container = document.getElementById('monthlyComparisonChartContainer');
        if (!container) return;
        container.innerHTML = '';

        if (!window.am5) return;

        const am5 = window.am5;
        const am5xy = window.am5xy;
        const am5themes_Animated = window.am5themes_Animated;
        const am5themes_Dark = window.am5themes_Dark;

        const root = am5.Root.new("monthlyComparisonChartContainer");
        monthlyAmChartRoot = root;

        if (root._logo) root._logo.dispose();

        root.setThemes([
            am5themes_Animated.new(root),
            am5themes_Dark.new(root)
        ]);

        const chart = root.container.children.push(
            am5xy.XYChart.new(root, {
                panX: true,
                panY: false,
                wheelX: "panX",
                wheelY: "zoomX",
                layout: root.verticalLayout
            })
        );

        const data = labels.map((l, i) => ({
            category: l,
            value: dataValues[i] || 0
        }));

        const xRenderer = am5xy.AxisRendererX.new(root, {
            minGridDistance: 30,
            minorGridEnabled: true
        });
        xRenderer.grid.template.set("forceHidden", true);

        const xAxis = chart.xAxes.push(
            am5xy.CategoryAxis.new(root, {
                categoryField: "category",
                renderer: xRenderer,
                tooltip: am5.Tooltip.new(root, {})
            })
        );
        xAxis.data.setAll(data);

        const yRenderer = am5xy.AxisRendererY.new(root, {});
        yRenderer.grid.template.set("forceHidden", true);

        const yAxis = chart.yAxes.push(
            am5xy.ValueAxis.new(root, {
                renderer: yRenderer
            })
        );

        const series = chart.series.push(
            am5xy.ColumnSeries.new(root, {
                name: labelName,
                xAxis: xAxis,
                yAxis: yAxis,
                valueYField: "value",
                categoryXField: "category",
                fill: am5.color(colorHex),
                tooltip: am5.Tooltip.new(root, {
                    labelText: "{categoryX}: [bold]{valueY}[/]"
                })
            })
        );

        series.columns.template.setAll({
            cornerRadiusTL: 5,
            cornerRadiusTR: 5,
            fillOpacity: 0.8,
            strokeWidth: 0
        });

        series.data.setAll(data);

        const cursor = chart.set("cursor", am5xy.XYCursor.new(root, {
            behavior: "zoomX"
        }));
        cursor.lineY.set("visible", false);

        series.appear(1000, 100);
        chart.appear(1000, 100);
    }

    function renderLiquidGauge(containerId, value, goal, label) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Clear previous content
        container.innerHTML = '';

        let percent = 0;
        if (goal > 0) {
            percent = (value / goal) * 100;
        } else if (value > 0) {
            percent = 100;
        }

        const clampedPercent = Math.min(Math.max(percent, 0), 100);
        const displayPercentage = Math.round(percent);

        const formattedValue = value.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 2, minimumFractionDigits: 2});
        const formattedGoal = goal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 2, minimumFractionDigits: 2});

        const html = `
            <div class="flex flex-col justify-center w-full h-full px-2 md:px-6 py-2">
                <!-- Main Horizontal Bar -->
                <div class="relative w-full h-16 md:h-24 bg-gray-900/80 rounded-xl md:rounded-2xl border-2 border-gray-700/80 shadow-[0_0_30px_rgba(249,115,22,0.3)] backdrop-blur-sm overflow-hidden flex items-center">

                    <!-- Track Background Gradient -->
                    <div class="absolute inset-0 bg-gradient-to-r from-gray-800/30 via-transparent to-black/60 pointer-events-none z-0"></div>

                    <!-- Liquid Fill (Vivid Orange) -->
                    <div class="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-1000 ease-in-out z-10" style="width: ${clampedPercent}%;">

                        <!-- Diagonal Wave Tip -->
                        <div class="absolute top-[-50%] bottom-[-50%] -right-8 w-16 bg-orange-500 transform skew-x-[-20deg] overflow-hidden flex items-center justify-center">
                             <!-- Wave Animation (Vertical Ripple on the Edge) -->
                             <div class="absolute inset-0 w-full h-[200%] -top-1/2 animate-wave-vertical opacity-50">
                                <svg viewBox="0 0 150 500" preserveAspectRatio="none" class="w-full h-full fill-orange-300">
                                    <path d="M49.98,0.00 C150.00,149.99 -49.98,349.20 49.98,500.00 L150.00,500.00 L150.00,0.00 Z" />
                                </svg>
                             </div>
                        </div>
                    </div>

                    <!-- Text Content (Overlay) -->
                    <div class="absolute inset-0 flex justify-between items-center px-4 md:px-8 z-30 pointer-events-none">
                        <!-- Left: Info -->
                        <div class="flex flex-col items-start">
                            <span class="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5 md:mb-1">Realizado</span>
                            <span class="text-xs md:text-2xl font-bold text-white drop-shadow-md">${formattedValue}</span>
                        </div>

                        <!-- Center: Percentage -->
                        <div class="flex flex-col items-center">
                             <span class="text-xl md:text-5xl font-black tracking-tighter text-white drop-shadow-[0_0_10px_rgba(251,146,60,0.8)]">
                                ${displayPercentage}%
                            </span>
                        </div>

                        <!-- Right: Goal -->
                        <div class="flex flex-col items-end">
                            <span class="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5 md:mb-1">Meta</span>
                            <span class="text-xs md:text-xl font-bold text-white drop-shadow-sm">${formattedGoal}</span>
                        </div>
                    </div>

                    <!-- Glass Shine -->
                    <div class="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none z-20"></div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    function renderInnovationsChart(tableData) {
        const am5 = window.am5;
        const am5hierarchy = window.am5hierarchy;
        const am5themes_Animated = window.am5themes_Animated;
        const am5themes_Dark = window.am5themes_Dark;

        // 1. Dispose existing root
        if (innovationsAmChartRoot) {
            innovationsAmChartRoot.dispose();
            innovationsAmChartRoot = null;
        }

        const container = document.getElementById('innovations-month-chartContainer');
        if (!container) return;
        container.innerHTML = '';

        if (!am5 || !am5hierarchy) {
            console.warn("amCharts 5 or Hierarchy plugin not loaded.");
            container.innerHTML = '<div class="flex items-center justify-center h-full text-slate-500">Erro ao carregar gráfico (Bibliotecas ausentes).</div>';
            return;
        }

        if (!am5hierarchy.ForceDirected) {
             console.warn("am5hierarchy.ForceDirected not available.");
             container.innerHTML = '<div class="flex items-center justify-center h-full text-slate-500">Erro: Tipo de gráfico não suportado.</div>';
             return;
        }

        if (!tableData || tableData.length === 0) {
            container.innerHTML = '<div class="flex items-center justify-center h-full text-slate-500">Sem dados para exibir.</div>';
            return;
        }

        // 2. Transform Data for Hierarchy
        // Root -> Category -> Product
        const rootData = {
            name: "Inovações",
            children: []
        };

        const catMap = new Map();

        tableData.forEach(item => {
            if (!item.categoryName) return;

            if (!catMap.has(item.categoryName)) {
                catMap.set(item.categoryName, {
                    name: item.categoryName,
                    children: []
                });
                rootData.children.push(catMap.get(item.categoryName));
            }

            const catNode = catMap.get(item.categoryName);
            const val = item.clientsCurrentCount || 0;

            if (val > 0) {
                catNode.children.push({
                    name: item.productName,
                    value: val,
                    stock: item.stock,
                    code: item.productCode
                });
            }
        });

        // If no data after filtering 0s
        if (rootData.children.every(c => c.children.length === 0)) {
             container.innerHTML = '<div class="flex items-center justify-center h-full text-slate-500">Nenhum produto positivado neste mês.</div>';
             return;
        }

        // 3. Create Chart
        const root = am5.Root.new("innovations-month-chartContainer");
        innovationsAmChartRoot = root;

        if (root._logo) {
            root._logo.dispose();
        }

        const themes = [];
        // OPTIMIZATION: Disable Animated theme to improve FPS on low-end devices
        // if (am5themes_Animated) themes.push(am5themes_Animated.new(root));
        if (am5themes_Dark) themes.push(am5themes_Dark.new(root));

        root.setThemes(themes);

        const series = root.container.children.push(
            am5hierarchy.ForceDirected.new(root, {
                singleBranchOnly: false,
                downDepth: 1,
                topDepth: 1,
                initialDepth: 2,
                valueField: "value",
                categoryField: "name",
                childDataField: "children",
                idField: "name",
                linkWithStrength: 0,
                manyBodyStrength: -20,
                centerStrength: 0.8,
                minRadius: 35,
                maxRadius: am5.percent(14.5),
                velocityDecay: 0.8, // Increased for stability
                initialVelocity: 0.02 // Decreased for stability
            })
        );

        series.get("colors").setAll({
            step: 2
        });

        series.links.template.set("strength", 0.5);

        series.data.setAll([rootData]);

        // Safety: Only set selected item if data items exist
        if (series.dataItems && series.dataItems.length > 0) {
            series.set("selectedDataItem", series.dataItems[0]);
        }

        // Configure Nodes (Circles)
        series.nodes.template.setAll({
            tooltipText: "[bold]{name}[/]\nPositivação: {value} PDVs\nEstoque: {stock}",
            draggable: true
        });

        // Labels
        series.labels.template.setAll({
            fontSize: 10,
            text: "{name}",
            oversizedBehavior: "fit",
            breakWords: true,
            textAlign: "center",
            fill: am5.color(0xffffff)
        });

        // Animate
        series.appear(1000, 100);
    }

    function renderMetasRadarChart(data) {
        // Dispose existing root if present
        if (window.am5 && window.am5.registry && window.am5.registry.rootElements) {
             for (let i = window.am5.registry.rootElements.length - 1; i >= 0; i--) {
                 const r = window.am5.registry.rootElements[i];
                 if (r.dom && r.dom.id === "metasChartContainer") {
                     r.dispose();
                 }
             }
        }

        const container = document.getElementById('metasChartContainer');
        if (!container) return;
        container.innerHTML = '';

        if (!window.am5 || !window.am5radar) {
            console.error("amCharts 5 Radar not loaded");
            return;
        }

        const am5 = window.am5;
        const am5xy = window.am5xy;
        const am5radar = window.am5radar;
        const am5themes_Animated = window.am5themes_Animated;
        
        const root = am5.Root.new("metasChartContainer");
        
        if (root._logo) {
            root._logo.dispose();
        }

        root.setThemes([
            am5themes_Animated.new(root),
            window.am5themes_Dark ? window.am5themes_Dark.new(root) : am5themes_Animated.new(root)
        ]);

        const chart = root.container.children.push(am5radar.RadarChart.new(root, {
            panX: false,
            panY: false,
            wheelX: "none",
            wheelY: "none",
            innerRadius: am5.percent(20),
            startAngle: -90,
            endAngle: 180
        }));

        // Cursor
        const cursor = chart.set("cursor", am5radar.RadarCursor.new(root, {
            behavior: "none"
        }));
        cursor.lineY.set("visible", false);

        const xRenderer = am5radar.AxisRendererCircular.new(root, {});
        xRenderer.labels.template.setAll({ radius: 10 });
        xRenderer.grid.template.setAll({ forceHidden: true });

        const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, {
            renderer: xRenderer,
            min: 0,
            max: 100,
            strictMinMax: false,
            numberFormat: "#\'%\'",
            tooltip: am5.Tooltip.new(root, {})
        }));

        const yRenderer = am5radar.AxisRendererRadial.new(root, {
            minGridDistance: 10
        });
        yRenderer.labels.template.setAll({
            centerX: am5.p100,
            fontWeight: "500",
            fontSize: 11,
            templateField: "columnSettings",
            oversizedBehavior: "truncate",
            maxWidth: 140
        });
        yRenderer.grid.template.setAll({ forceHidden: true });

        const yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, {
            categoryField: "category",
            renderer: yRenderer
        }));

        yAxis.data.setAll(data);

        // Series 1: Background (Full 100%)
        const series1 = chart.series.push(am5radar.RadarColumnSeries.new(root, {
            xAxis: xAxis,
            yAxis: yAxis,
            clustered: false,
            valueXField: "full",
            categoryYField: "category",
            fill: root.interfaceColors.get("alternativeBackground")
        }));

        series1.columns.template.setAll({
            width: am5.p100,
            fillOpacity: 0.08,
            strokeOpacity: 0,
            cornerRadius: 20
        });
        series1.data.setAll(data);

        // Series 2: Actual Value
        const series2 = chart.series.push(am5radar.RadarColumnSeries.new(root, {
            xAxis: xAxis,
            yAxis: yAxis,
            clustered: false,
            valueXField: "value",
            categoryYField: "category",
            tooltipText: "{category}\nRealizado: {realizedLabel} / Meta: {goalLabel}\nAtingimento: {valueX.formatNumber('#.#')}%"
        }));

        series2.columns.template.setAll({
            templateField: "columnSettings",
            width: am5.p100,
            strokeOpacity: 0,
            cornerRadius: 20
        });

        series2.data.setAll(data);

        series1.appear(1000);
        series2.appear(1000);
        chart.appear(1000, 100);
    }

    function renderCategoryRadarChart(data) {
        // Dispose existing root if present
        if (window.am5 && window.am5.registry && window.am5.registry.rootElements) {
             for (let i = window.am5.registry.rootElements.length - 1; i >= 0; i--) {
                 const r = window.am5.registry.rootElements[i];
                 if (r.dom && r.dom.id === "faturamentoPorFornecedorChartContainer") {
                     r.dispose();
                 }
             }
        }

        const container = document.getElementById('faturamentoPorFornecedorChartContainer');
        if (!container) return;
        container.innerHTML = '';

        if (!window.am5 || !window.am5radar) {
            console.error("amCharts 5 Radar not loaded");
            return;
        }

        const am5 = window.am5;
        const am5xy = window.am5xy;
        const am5radar = window.am5radar;
        const am5themes_Animated = window.am5themes_Animated;

        const root = am5.Root.new("faturamentoPorFornecedorChartContainer");

        if (root._logo) {
            root._logo.dispose();
        }

        root.setThemes([
            am5themes_Animated.new(root),
            window.am5themes_Dark ? window.am5themes_Dark.new(root) : am5themes_Animated.new(root)
        ]);

        // Create chart
        const chart = root.container.children.push(am5radar.RadarChart.new(root, {
            panX: false,
            panY: false,
            wheelX: "none",
            wheelY: "none",
            innerRadius: am5.percent(20),
            startAngle: -90,
            endAngle: 180
        }));

        // Cursor
        const cursor = chart.set("cursor", am5radar.RadarCursor.new(root, {
            behavior: "none"
        }));
        cursor.lineY.set("visible", false);

        // Axes
        const xRenderer = am5radar.AxisRendererCircular.new(root, {});
        xRenderer.labels.template.setAll({ radius: 10 });
        xRenderer.grid.template.setAll({ forceHidden: true });

        const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, {
            renderer: xRenderer,
            min: 0,
            max: 100,
            strictMinMax: false,
            numberFormat: "#'%'",
            tooltip: am5.Tooltip.new(root, {})
        }));

        const yRenderer = am5radar.AxisRendererRadial.new(root, {
            minGridDistance: 10
        });
        yRenderer.labels.template.setAll({
            centerX: am5.p100,
            fontWeight: "500",
            fontSize: 11,
            templateField: "columnSettings",
            oversizedBehavior: "truncate",
            maxWidth: 140
        });
        yRenderer.grid.template.setAll({ forceHidden: true });

        const yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, {
            categoryField: "category",
            renderer: yRenderer
        }));
        yAxis.data.setAll(data);

        // Series 1: Meta (Background / 100%)
        const series1 = chart.series.push(am5radar.RadarColumnSeries.new(root, {
            xAxis: xAxis,
            yAxis: yAxis,
            clustered: false,
            valueXField: "full",
            categoryYField: "category",
            fill: root.interfaceColors.get("alternativeBackground")
        }));
        series1.columns.template.setAll({
            width: am5.p100,
            fillOpacity: 0.08,
            strokeOpacity: 0,
            cornerRadius: 20
        });
        series1.data.setAll(data);

        // Series 2: Realizado
        const series2 = chart.series.push(am5radar.RadarColumnSeries.new(root, {
            xAxis: xAxis,
            yAxis: yAxis,
            clustered: false,
            valueXField: "value",
            categoryYField: "category"
        }));
        series2.columns.template.setAll({
            width: am5.p100,
            strokeOpacity: 0,
            tooltipText: "{category}: {valueX.formatNumber('#.0')}%",
            cornerRadius: 20,
            templateField: "columnSettings"
        });
        series2.data.setAll(data);

        // Animation
        series1.appear(1000);
        series2.appear(1000);
        chart.appear(1000, 100);
    }

    // Auto-init User Menu on load if ready (for Navbar)
    if (document.readyState === "complete" || document.readyState === "interactive") {
        initWalletView();
        initRackMultiSelect();
        initCustomFileInput();
        verificarEstadoVisita();

        // Enforce Menu Permissions
        if (window.userRole !== 'adm') {
            document.querySelectorAll('[data-target="goals"]').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('[data-target="cidades"]').forEach(el => el.classList.add('hidden'));
        }

        // Enforce Weekly View Permissions (Block for Promoters/Sellers)
        const role = (window.userRole || '').toLowerCase();
        if (role === 'promotor' || role === 'vendedor') {
            document.querySelectorAll('[data-target="weekly"]').forEach(el => el.classList.add('hidden'));
        }
    }

        function renderPositivacaoView() {
            setupHierarchyFilters('positivacao', () => handlePositivacaoFilterChange({ excludeFilter: 'hierarchy' }));
            setupPositivacaoSupervisorFilterHandlers();

            // Supplier Filter (New)
            if (positivacaoSupplierFilterDropdown && !positivacaoSupplierFilterDropdown._hasListener) {
                if (positivacaoSupplierFilterBtn) {
                    // Fetch the current text element BEFORE cloning, so we don't lose reference to the original
                    let currentTextEl = document.getElementById('positivacao-supplier-filter-text');

                    const newBtn = positivacaoSupplierFilterBtn.cloneNode(true);
                    positivacaoSupplierFilterBtn.parentNode.replaceChild(newBtn, positivacaoSupplierFilterBtn);

                    // Re-assign the global reference to the cloned elements to prevent modifying detached DOM nodes
                    positivacaoSupplierFilterBtn = newBtn;
                    positivacaoSupplierFilterText = newBtn.querySelector('#positivacao-supplier-filter-text') || currentTextEl;

                    newBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        positivacaoSupplierFilterDropdown.classList.toggle('hidden');
                    });

                    // Close on click outside
                    document.addEventListener('click', (e) => {
                        if (!newBtn.contains(e.target) && !positivacaoSupplierFilterDropdown.contains(e.target)) {
                            positivacaoSupplierFilterDropdown.classList.add('hidden');
                        }
                    });
                }

                positivacaoSupplierFilterDropdown.addEventListener('change', (e) => {
                    if (e.target.type === 'checkbox') {
                        const val = e.target.value;
                        if (e.target.checked) selectedPositivacaoSuppliers.push(val);
                        else selectedPositivacaoSuppliers = selectedPositivacaoSuppliers.filter(s => s !== val);

                        selectedPositivacaoSuppliers = updateSupplierFilter(positivacaoSupplierFilterDropdown, positivacaoSupplierFilterText, selectedPositivacaoSuppliers, [...allSalesData, ...allHistoryData], 'positivacao');
                        handlePositivacaoFilterChange({ excludeFilter: 'supplier' });
                    }
                });
                positivacaoSupplierFilterDropdown._hasListener = true;
            }

            // Setup other filters listeners
            if (positivacaoComRedeBtn && !positivacaoComRedeBtn._hasListener) {
                positivacaoRedeGroupContainer.addEventListener('click', (e) => {
                    const btn = e.target.closest('button');
                    if (!btn) return;

                    const group = btn.dataset.group;
                    positivacaoRedeGroupFilter = group;

                    positivacaoRedeGroupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    if (group === 'com_rede') {
                        positivacaoRedeFilterDropdown.classList.remove('hidden');
                    } else {
                        positivacaoRedeFilterDropdown.classList.add('hidden');
                    }
                    handlePositivacaoFilterChange({ excludeFilter: 'rede' });
                });
                positivacaoComRedeBtn._hasListener = true;
            }

            if (positivacaoRedeFilterDropdown && !positivacaoRedeFilterDropdown._hasListener) {
                positivacaoRedeFilterDropdown.addEventListener('change', () => handlePositivacaoFilterChange({ excludeFilter: 'rede' }));
                positivacaoRedeFilterDropdown._hasListener = true;
            }

            // Client Typeahead
            setupClientTypeahead('positivacao-codcli-filter', 'positivacao-codcli-filter-suggestions', (code) => {
                handlePositivacaoFilterChange({ excludeFilter: 'client' });
            });
            // Manual Input listener for clearing
            if (positivacaoCodCliFilter && !positivacaoCodCliFilter._hasListener) {
                positivacaoCodCliFilter.addEventListener('input', (e) => {
                    if (!e.target.value) handlePositivacaoFilterChange({ excludeFilter: 'client' });
                });
                positivacaoCodCliFilter._hasListener = true;
            }

            if (clearPositivacaoFiltersBtn && !clearPositivacaoFiltersBtn._hasListener) {
                clearPositivacaoFiltersBtn.addEventListener('click', resetPositivacaoFilters);
                clearPositivacaoFiltersBtn._hasListener = true;
            }

            const pActivePrev = document.getElementById('positivacao-active-prev-btn');
            if (pActivePrev && !pActivePrev._hasListener) {
                pActivePrev.addEventListener('click', () => {
                    if(positivacaoActiveState.page > 1) {
                        positivacaoActiveState.page--;
                        renderPositivacaoActiveTable();
                    }
                });
                pActivePrev._hasListener = true;

                document.getElementById('positivacao-active-next-btn').addEventListener('click', () => {
                    const max = Math.ceil(positivacaoActiveState.data.length / positivacaoActiveState.limit);
                    if(positivacaoActiveState.page < max) {
                        positivacaoActiveState.page++;
                        renderPositivacaoActiveTable();
                    }
                });

                document.getElementById('positivacao-inactive-prev-btn').addEventListener('click', () => {
                    if(positivacaoInactiveState.page > 1) {
                        positivacaoInactiveState.page--;
                        renderPositivacaoInactiveTable();
                    }
                });

                document.getElementById('positivacao-inactive-next-btn').addEventListener('click', () => {
                    const max = Math.ceil(positivacaoInactiveState.data.length / positivacaoInactiveState.limit);
                    if(positivacaoInactiveState.page < max) {
                        positivacaoInactiveState.page++;
                        renderPositivacaoInactiveTable();
                    }
                });
            }

            // Initial Update
            updateAllPositivacaoFilters();
            updatePositivacaoView();
        }

        function getPositivacaoFilteredData(options = {}) {
            const { excludeFilter = null } = options;

            // 1. Hierarchy Filter (Base)
            let clients = getHierarchyFilteredClients('positivacao', allClientsData);

            // 2. Filter by Rede, Client, etc.
            const isComRede = positivacaoRedeGroupFilter === 'com_rede';
            const isSemRede = positivacaoRedeGroupFilter === 'sem_rede';
            const redeSet = (isComRede && selectedPositivacaoRedes.length > 0) ? new Set(selectedPositivacaoRedes) : null;
            const clientFilter = positivacaoCodCliFilter.value.trim().toLowerCase();

            if (positivacaoRedeGroupFilter || clientFilter) {
                 const temp = [];
                 const len = clients.length;
                 const checkRede = excludeFilter !== 'rede';
                 const checkClient = excludeFilter !== 'client' && !!clientFilter;

                 for(let i=0; i<len; i++) {
                     const c = clients[i];
                     if (checkRede) {
                        if (isComRede) {
                            if (!c.ramo || c.ramo === 'N/A') continue;
                            if (redeSet && !redeSet.has(c.ramo)) continue;
                        } else if (isSemRede) {
                            if (c.ramo && c.ramo !== 'N/A') continue;
                        }
                     }
                     if (checkClient) {
                        const code = String(c['Código'] || c['codigo_cliente']).toLowerCase();
                        const name = (c.nomeCliente || '').toLowerCase();
                        const city = (c.cidade || '').toLowerCase();
                        const bairro = (c.bairro || '').toLowerCase();
                        const cnpj = String(c['CNPJ/CPF'] || c.cnpj_cpf || '').replace(/\D/g, '');

                        if (!code.includes(clientFilter) && !name.includes(clientFilter) && !city.includes(clientFilter) && !bairro.includes(clientFilter) && !cnpj.includes(clientFilter)) continue;
                     }
                     temp.push(c);
                 }
                 clients = temp;
            }

            // Get matching sales
            const clientCodes = new Set();
            for(let i=0; i<clients.length; i++) clientCodes.add(clients[i]['Código']);

            const filters = {
                clientCodes: clientCodes
            };

            // Add Supplier Filter
            if (selectedPositivacaoSuppliers && selectedPositivacaoSuppliers.length > 0) {
                filters.supplier = new Set(selectedPositivacaoSuppliers);
            }

            const sales = getFilteredDataFromIndices(optimizedData.indices.current, optimizedData.salesById, filters);

            return { clients, sales };
        }

        function updateAllPositivacaoFilters(options = {}) {
            const { skipFilter = null } = options;

            // Populate Supplier Filter (if not skipping or if initializing)
            if (skipFilter !== 'supplier') {
                // For Suppliers, we usually show ALL options, not filtered by clients?
                // The main updateSupplierFilter handles it using global data source.
                selectedPositivacaoSuppliers = updateSupplierFilter(positivacaoSupplierFilterDropdown, positivacaoSupplierFilterText, selectedPositivacaoSuppliers, [...allSalesData, ...allHistoryData], 'positivacao');
            }

            if (skipFilter !== 'rede') {
                 const { clients } = getPositivacaoFilteredData({ excludeFilter: 'rede' });
                 if (positivacaoRedeGroupFilter === 'com_rede') {
                     selectedPositivacaoRedes = updateRedeFilter(positivacaoRedeFilterDropdown, positivacaoComRedeBtnText, selectedPositivacaoRedes, clients);
                 }
            }
        }

        function handlePositivacaoFilterChange(options = {}) {
            if (window.positivacaoUpdateTimeout) clearTimeout(window.positivacaoUpdateTimeout);
            window.positivacaoUpdateTimeout = setTimeout(() => {
                updateAllPositivacaoFilters(options);
                updatePositivacaoView();
            }, 10);
        }

        function resetPositivacaoFilters() {

            if (hierarchyState['positivacao']) {
                hierarchyState['positivacao'].coords.clear();
                hierarchyState['positivacao'].cocoords.clear();
                hierarchyState['positivacao'].promotors.clear();
            }

            if (typeof selectedPositivacaoSupervisors !== 'undefined') selectedPositivacaoSupervisors.clear();
            if (typeof selectedPositivacaoVendedores !== 'undefined') selectedPositivacaoVendedores.clear();

            if (typeof updatePositivacaoSupervisorFilter === 'function') updatePositivacaoSupervisorFilter();
            if (typeof updatePositivacaoVendedorFilter === 'function') updatePositivacaoVendedorFilter();

            selectedPositivacaoCoords = [];
            selectedPositivacaoCoCoords = [];
            selectedPositivacaoPromotors = [];
            selectedPositivacaoRedes = [];
            selectedPositivacaoSuppliers = []; // Reset Supplier
            positivacaoRedeGroupFilter = '';
            positivacaoCodCliFilter.value = '';

            if (positivacaoRedeGroupContainer) {
                positivacaoRedeGroupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                positivacaoRedeGroupContainer.querySelector('button[data-group=""]').classList.add('active');
            }
            if (positivacaoRedeFilterDropdown) positivacaoRedeFilterDropdown.classList.add('hidden');
            if (positivacaoSupplierFilterDropdown) positivacaoSupplierFilterDropdown.classList.add('hidden');

            setupHierarchyFilters('positivacao');
            updateAllPositivacaoFilters();
            updatePositivacaoView();
        }

        function updatePositivacaoView() {
            positivacaoRenderId++;
            const currentRenderId = positivacaoRenderId;

            if (positivacaoActiveDetailTableBody) positivacaoActiveDetailTableBody.innerHTML = getSkeletonRows(7, 5);
            if (positivacaoInactiveDetailTableBody) positivacaoInactiveDetailTableBody.innerHTML = getSkeletonRows(6, 5);

            const { clients, sales } = getPositivacaoFilteredData();

            const clientTotals = new Map();
            const clientDetails = new Map();

            sales.forEach(s => {
                const cod = s.CODCLI;
                const val = Number(s.VLVENDA) || 0;
                clientTotals.set(cod, (clientTotals.get(cod) || 0) + val);

                if (!clientDetails.has(cod)) clientDetails.set(cod, { pepsico: 0, multimarcas: 0 });
                const d = clientDetails.get(cod);
                const pasta = s.OBSERVACAOFOR || s.PASTA;
                if (pasta === 'PEPSICO') d.pepsico += val;
                else if (pasta === 'MULTIMARCAS') d.multimarcas += val;
            });

            const activeList = [];
            const inactiveList = [];

            runAsyncChunked(clients, (c) => {
                const cod = String(c['Código'] || c['codigo_cliente']);
                const total = clientTotals.get(cod) || 0;

                const registrationDate = parseDate(c.dataCadastro);
                const now = lastSaleDate;
                const isNew = registrationDate && registrationDate.getUTCMonth() === now.getUTCMonth() && registrationDate.getUTCFullYear() === now.getUTCFullYear();

                if (total >= 1) {
                    const det = clientDetails.get(cod) || { pepsico: 0, multimarcas: 0 };
                    activeList.push({
                        ...c,
                        total,
                        pepsico: det.pepsico,
                        multimarcas: det.multimarcas,
                        outros: total - det.pepsico - det.multimarcas,
                        isNew
                    });
                } else {
                    c.isReturn = (total < 0);
                    c.isNewForInactiveLabel = isNew && !parseDate(c.ultimaCompra);
                    inactiveList.push(c);
                }
            }, () => {
                if (currentRenderId !== positivacaoRenderId) return;

                activeList.sort((a, b) => b.total - a.total);
                inactiveList.sort((a, b) => (parseDate(b.ultimaCompra) || 0) - (parseDate(a.ultimaCompra) || 0));

                positivacaoDataForExport.active = activeList;
                positivacaoDataForExport.inactive = inactiveList;

                positivacaoActiveState.data = activeList;
                positivacaoActiveState.page = 1;

                positivacaoInactiveState.data = inactiveList;
                positivacaoInactiveState.page = 1;

                renderPositivacaoActiveTable();
                renderPositivacaoInactiveTable();
            });
        }

        function renderPositivacaoActiveTable() {
            const tbody = document.getElementById('positivacao-active-detail-table-body');
            if (!tbody) return;

            const { page, limit, data } = positivacaoActiveState;
            const total = data.length;
            const start = (page - 1) * limit;
            const end = start + limit;
            const subset = data.slice(start, end);
            const totalPages = Math.ceil(total / limit) || 1;

            tbody.innerHTML = subset.map(data => {
                const novoLabel = data.isNew ? `<span class="ml-2 text-xs font-semibold text-purple-400 bg-purple-900/50 px-2 py-0.5 rounded-full">NOVO</span>` : '';
                let tooltipParts = [];
                if (data.pepsico > 0) tooltipParts.push(`PEPSICO: ${data.pepsico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
                if (data.multimarcas > 0) tooltipParts.push(`MULTIMARCAS: ${data.multimarcas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
                if (data.outros > 0.001) tooltipParts.push(`OUTROS: ${data.outros.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
                const tooltipText = tooltipParts.length > 0 ? tooltipParts.join('<br>') : 'Sem detalhamento';

                const rcaVal = (data.rcas && data.rcas.length > 0) ? data.rcas[0] : '-';
                const nome = data.fantasia || data.nomeCliente || 'N/A';
                const cidade = data.cidade || 'N/A';
                const bairro = data.bairro || 'N/A';

                return `<tr class="hover:bg-slate-700">
                            <td class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-sm"><a href="#" class="text-teal-400 hover:underline" data-codcli="${window.escapeHtml(data['Código'])}">${window.escapeHtml(data['Código'])}</a></td>
                            <td class="px-2 py-2 md:px-4 md:py-2 flex items-center text-[10px] md:text-sm truncate max-w-[120px] md:max-w-xs">${window.escapeHtml(nome)}${novoLabel}</td>
                            <td class="px-2 py-2 md:px-4 md:py-2 text-right text-[10px] md:text-sm">
                                <div class="tooltip">${data.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    <span class="tooltip-text" style="width: max-content; transform: translateX(-50%); margin-left: 0;">${tooltipText}</span>
                                </div>
                            </td>
                            <td class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-sm hidden md:table-cell">${window.escapeHtml(cidade)}</td>
                            <td class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-sm hidden md:table-cell">${window.escapeHtml(bairro)}</td>
                            <td class="px-2 py-2 md:px-4 md:py-2 text-center text-[10px] md:text-sm hidden md:table-cell">${formatDate(data.ultimaCompra)}</td>
                            <td class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-sm hidden md:table-cell">${window.escapeHtml(rcaVal)}</td>
                        </tr>`;
            }).join('');

            // Update Pagination Controls
            document.getElementById('positivacao-active-prev-btn').disabled = page === 1;
            document.getElementById('positivacao-active-next-btn').disabled = page >= totalPages;
            document.getElementById('positivacao-active-page-info').textContent = `${start + 1}-${Math.min(end, total)} de ${total}`;
        }

        function renderPositivacaoInactiveTable() {
            const tbody = document.getElementById('positivacao-inactive-detail-table-body');
            if (!tbody) return;

            const { page, limit, data } = positivacaoInactiveState;
            const total = data.length;
            const start = (page - 1) * limit;
            const end = start + limit;
            const subset = data.slice(start, end);
            const totalPages = Math.ceil(total / limit) || 1;

            tbody.innerHTML = subset.map(client => {
                const novoLabel = client.isNewForInactiveLabel ? `<span class="ml-2 text-[9px] md:text-xs font-semibold text-purple-400 bg-purple-900/50 px-1 py-0.5 rounded-full">NOVO</span>` : '';
                const rcaVal = (client.rcas && client.rcas.length > 0) ? client.rcas[0] : '-';
                const nome = client.fantasia || client.nomeCliente || 'N/A';
                const cidade = client.cidade || 'N/A';
                const bairro = client.bairro || 'N/A';
                const ultCompra = client.ultimaCompra || client['Data da Última Compra'];

                return `<tr class="hover:bg-slate-700">
                            <td class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-sm"><a href="#" class="text-teal-400 hover:underline" data-codcli="${window.escapeHtml(client['Código'])}">${window.escapeHtml(client['Código'])}</a></td>
                            <td class="px-2 py-2 md:px-4 md:py-2 flex items-center text-[10px] md:text-sm truncate max-w-[120px] md:max-w-xs">${window.escapeHtml(nome)}${novoLabel}</td>
                            <td class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-sm hidden md:table-cell">${window.escapeHtml(cidade)}</td>
                            <td class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-sm hidden md:table-cell">${window.escapeHtml(bairro)}</td>
                            <td class="px-2 py-2 md:px-4 md:py-2 text-center text-[10px] md:text-sm hidden md:table-cell">${formatDate(ultCompra)}</td>
                            <td class="px-2 py-2 md:px-4 md:py-2 text-[10px] md:text-sm hidden md:table-cell">${window.escapeHtml(rcaVal)}</td>
                        </tr>`;
            }).join('');

            // Update Pagination Controls
            document.getElementById('positivacao-inactive-prev-btn').disabled = page === 1;
            document.getElementById('positivacao-inactive-next-btn').disabled = page >= totalPages;
            document.getElementById('positivacao-inactive-page-info').textContent = `${start + 1}-${Math.min(end, total)} de ${total}`;
        }

        // --- TITULOS VIEW LOGIC ---
        let titulosTableState = { page: 1, limit: 50, filteredData: [] };
        let selectedTitulosRedes = [];
        let titulosRedeGroupFilter = '';
        let titulosRenderId = 0;

        function renderTitulosView() {
            setupHierarchyFilters('titulos', () => handleTitulosFilterChange());

            // Rede Filters
            const redeGroupContainer = document.getElementById('titulos-rede-group-container');
            const comRedeBtn = document.getElementById('titulos-com-rede-btn');
            const comRedeBtnText = document.getElementById('titulos-com-rede-btn-text');
            const redeDropdown = document.getElementById('titulos-rede-filter-dropdown');

            if (redeGroupContainer && !redeGroupContainer._hasListener) {
                redeGroupContainer.addEventListener('click', (e) => {
                    const btn = e.target.closest('button');
                    if (!btn) return;
                    const group = btn.dataset.group;
                    titulosRedeGroupFilter = group;
                    redeGroupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    if (group === 'com_rede') redeDropdown.classList.remove('hidden');
                    else redeDropdown.classList.add('hidden');
                    handleTitulosFilterChange();
                });
                redeGroupContainer._hasListener = true;
            }

            if (redeDropdown && !redeDropdown._hasListener) {
                redeDropdown.addEventListener('change', () => handleTitulosFilterChange());
                redeDropdown._hasListener = true;
            }

            // Client Search
            setupClientTypeahead('titulos-codcli-filter', 'titulos-codcli-filter-suggestions', (code) => {
                handleTitulosFilterChange();
            });
            const clientInput = document.getElementById('titulos-codcli-filter');
            if (clientInput && !clientInput._hasListener) {
                clientInput.addEventListener('input', (e) => {
                     if (!e.target.value) handleTitulosFilterChange();
                });
                clientInput._hasListener = true;
            }

            // Clear Btn
            const clearBtn = document.getElementById('clear-titulos-filters-btn');
            if(clearBtn && !clearBtn._hasListener) {
                clearBtn.addEventListener('click', () => {
                     resetTitulosFilters();
                });
                clearBtn._hasListener = true;
            }

            // Pagination
            const prevBtn = document.getElementById('titulos-prev-page-btn');
            const nextBtn = document.getElementById('titulos-next-page-btn');
            if(prevBtn && !prevBtn._hasListener) {
                prevBtn.addEventListener('click', () => {
                    if(titulosTableState.page > 1) {
                        titulosTableState.page--;
                        renderTitulosTable();
                    }
                });
                prevBtn._hasListener = true;
            }
            if(nextBtn && !nextBtn._hasListener) {
                nextBtn.addEventListener('click', () => {
                    const max = Math.ceil(titulosTableState.filteredData.length / titulosTableState.limit);
                    if(titulosTableState.page < max) {
                        titulosTableState.page++;
                        renderTitulosTable();
                    }
                });
                nextBtn._hasListener = true;
            }

            // Initial Filter Population (Rede)
            updateTitulosRedeFilter();

            // Initial Render
            updateTitulosView();
        }

        function updateTitulosRedeFilter() {
            // Get available networks from clients that have titles? Or all clients?
            // Usually from filtered base.
            // For simplicity, we use the hierarchy filtered clients to populate red dropdown.
            const clients = getHierarchyFilteredClients('titulos', allClientsData);
            const dropdown = document.getElementById('titulos-rede-filter-dropdown');
            const btnText = document.getElementById('titulos-com-rede-btn-text');
            if(dropdown) {
                selectedTitulosRedes = updateRedeFilter(dropdown, btnText, selectedTitulosRedes, clients);
            }
        }

        function handleTitulosFilterChange() {
             if(window.titulosUpdateTimeout) clearTimeout(window.titulosUpdateTimeout);
             window.titulosUpdateTimeout = setTimeout(() => {
                 updateTitulosView();
             }, 10);
        }

        function resetTitulosFilters() {
            selectedTitulosRedes = [];
            titulosRedeGroupFilter = '';
            document.getElementById('titulos-codcli-filter').value = '';
            if(document.getElementById('titulos-city-filter')) document.getElementById('titulos-city-filter').value = '';

            if (hierarchyState['titulos']) {
                hierarchyState['titulos'].coords.clear();
                hierarchyState['titulos'].cocoords.clear();
                hierarchyState['titulos'].promotors.clear();
            }

            if (typeof selectedTitulosSupervisors !== 'undefined') selectedTitulosSupervisors.clear();
            if (typeof selectedTitulosVendedores !== 'undefined') selectedTitulosVendedores.clear();

            if (typeof updateTitulosSupervisorFilter === 'function') updateTitulosSupervisorFilter();
            if (typeof updateTitulosVendedorFilter === 'function') updateTitulosVendedorFilter();

            const groupContainer = document.getElementById('titulos-rede-group-container');
            if(groupContainer) {
                 groupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                 groupContainer.querySelector('button[data-group=""]').classList.add('active');
            }
            const dd = document.getElementById('titulos-rede-filter-dropdown');
            if(dd) dd.classList.add('hidden');

            setupHierarchyFilters('titulos'); // Reset hierarchy
            updateTitulosRedeFilter();
            updateTitulosView();
        }

        function updateTitulosView() {
            titulosRenderId++;
            const currentId = titulosRenderId;

            // 1. Get Data
            const rawTitulos = embeddedData.titulos; // Columnar
            if (!rawTitulos || !rawTitulos.length) {
                // Empty state
                renderTitulosKPIs(0, 0, 0, 0);
                titulosTableState.filteredData = [];
                renderTitulosTable();
                return;
            }

            // 2. Filter Clients Base (Hierarchy + Rede)
            // Use Hierarchy Filter
            let allowedClients = getHierarchyFilteredClients('titulos', allClientsData);

            // Apply Rede Filter
            const isComRede = titulosRedeGroupFilter === 'com_rede';
            const isSemRede = titulosRedeGroupFilter === 'sem_rede';
            const redeSet = (isComRede && selectedTitulosRedes.length > 0) ? new Set(selectedTitulosRedes) : null;
            const clientSearch = document.getElementById('titulos-codcli-filter').value.toLowerCase().trim();

            const allowedClientCodes = new Set();
            for(let i=0; i<allowedClients.length; i++) {
                const c = allowedClients[i]; // Proxy or Object

                // Rede Check
                if (isComRede) {
                    if (!c.ramo || c.ramo === 'N/A') continue;
                    if (redeSet && !redeSet.has(c.ramo)) continue;
                } else if (isSemRede) {
                    if (c.ramo && c.ramo !== 'N/A') continue;
                }

                // Search Check (Name/Code) - Optimization: Check here to reduce set size
                if (clientSearch) {
                    const code = String(c['Código'] || c['codigo_cliente']).toLowerCase();
                    const name = (c.nomeCliente || '').toLowerCase();
                    if (!code.includes(clientSearch) && !name.includes(clientSearch)) continue;
                }

                allowedClientCodes.add(normalizeKey(c['Código'] || c['codigo_cliente']));
            }

            // 3. Filter Titulos based on Allowed Client Codes
            const filteredTitulos = [];
            const isCol = rawTitulos instanceof ColumnarDataset;
            const len = rawTitulos.length;

            // Indices
            // We assume column names from SQL: cod_cliente, vl_receber, etc.
            // But 'embeddedData.titulos' comes from 'fetchAll' which uses CSV parser.
            // The CSV parser uppercases headers. So: COD_CLIENTE, VL_RECEBER, etc.

            // Let's verify column names dynamically or assume standard
            // Standard from CSV parser: keys are UPPERCASE of DB columns.
            // DB: cod_cliente -> CSV: COD_CLIENTE

            // Optimized read with Dual Case Check (Lowercase and Uppercase)
            const getVal = (i, col) => {
                const val = isCol ? (rawTitulos._data[col] ? rawTitulos._data[col][i] : undefined) : rawTitulos[i][col];
                if (val !== undefined) return val;
                // Try Uppercase
                const colUpper = col.toUpperCase();
                return isCol ? (rawTitulos._data[colUpper] ? rawTitulos._data[colUpper][i] : undefined) : rawTitulos[i][colUpper];
            };

            let totalReceber = 0;

            let countCritical = 0;
            const today = new Date();
            today.setHours(0,0,0,0);

            // Critical Date: 60 days ago
            const criticalDate = new Date();
            criticalDate.setDate(today.getDate() - 60);

            for (let i=0; i<len; i++) {
                const codCli = normalizeKey(getVal(i, 'cod_cliente'));

                if (allowedClientCodes.has(codCli)) {
                    // Match!
                    const valReceber = Number(getVal(i, 'vl_receber')) || 0;
                    const valOriginal = Number(getVal(i, 'vl_titulos')) || 0;
                    const dtVenc = parseDate(getVal(i, 'dt_vencimento'));

                    totalReceber += valReceber;

                    let isCritical = false;
                    let daysOverdue = 0;

                    if (dtVenc && valReceber > 0) {
                        if (dtVenc < criticalDate) {
                            isCritical = true;
                            countCritical++;
                        }
                        // Calculate days overdue if past due
                        if (dtVenc < today) {
                             const diffTime = Math.abs(today - dtVenc);
                             daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        }
                    }

                    // Enrich Data for Table
                    // Resolve Client Name and RCA
                    const clientObj = clientMapForKPIs.get(codCli);
                    let clientName = 'Desconhecido';
                    let rcaName = 'N/A';
                    let city = 'N/A';

                    if (clientObj) {
                         let c = clientObj;
                         if (typeof clientObj === 'number') {
                             c = allClientsData.get(clientObj);
                         }

                         clientName = c.nomeCliente || c.fantasia || 'N/A';
                         city = c.cidade || 'N/A';
                         const rcaCode = String(c.rca1 || '').trim();
                         // Resolve RCA Name
                         if (optimizedData.rcaNameByCode && optimizedData.rcaNameByCode.has(rcaCode)) {
                             rcaName = optimizedData.rcaNameByCode.get(rcaCode) || rcaCode;
                         } else {
                             rcaName = rcaCode;
                         }
                    }

                    filteredTitulos.push({
                        codCli,
                        clientName,
                        rcaName,
                        city,
                        dtVenc,
                        valReceber,
                        valOriginal,
                        isCritical,
                        daysOverdue
                    });
                }
            }

            // Update State
            titulosTableState.filteredData = filteredTitulos;
            titulosTableState.page = 1;

            // Sort by Date Ascending (Oldest first usually for debt)
            titulosTableState.filteredData.sort((a,b) => (a.dtVenc || 0) - (b.dtVenc || 0));

            // KPIs
            const totalCount = filteredTitulos.length;
            const uniqueClientsCritical = new Set(filteredTitulos.filter(t => t.isCritical).map(t => t.codCli)).size;

            // Calculate Total Critical Debt
            const criticalDebt = filteredTitulos.reduce((acc, t) => t.isCritical ? acc + t.valReceber : acc, 0);

            renderTitulosKPIs(totalReceber, criticalDebt, uniqueClientsCritical, totalCount);
            renderTitulosTable();
        }

        function renderTitulosKPIs(total, critical, criticalCount, count) {
            document.getElementById('titulos-kpi-total-debt').textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            document.getElementById('titulos-kpi-critical-debt').textContent = critical.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            document.getElementById('titulos-kpi-critical-count').textContent = `${criticalCount} Clientes Críticos`;
            document.getElementById('titulos-kpi-count').textContent = count;
        }

        function renderTitulosTable() {
            const tbody = document.getElementById('titulos-table-body');
            if(!tbody) return;

            const { page, limit, filteredData } = titulosTableState;
            const total = filteredData.length;
            const start = (page - 1) * limit;
            const end = start + limit;
            const subset = filteredData.slice(start, end);
            const totalPages = Math.ceil(total / limit) || 1;

            if (total === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-slate-500">Nenhum título encontrado.</td></tr>';
                document.getElementById('titulos-page-info-text').textContent = '0 de 0';
                return;
            }

            tbody.innerHTML = subset.map(t => {
                const dateStr = t.dtVenc ? t.dtVenc.toLocaleDateString('pt-BR') : '-';
                const valOrig = t.valOriginal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const valOpen = t.valReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                let status;
                if (t.isCritical) {
                     status = `<span class="px-2 py-1 bg-red-900/50 text-red-300 text-[10px] font-bold rounded-full border border-red-800">${t.daysOverdue} Dias</span>`;
                } else {
                     status = `<span class="px-2 py-1 bg-green-900/50 text-green-300 text-[10px] font-bold rounded-full border border-green-800">Em Aberto</span>`;
                }

                return `
                    <tr class="hover:bg-slate-700/50 border-b border-white/5 transition-colors">
                        <td class="px-4 py-3 font-mono text-xs text-slate-400">${t.codCli}</td>
                        <td class="px-4 py-3 text-sm text-white font-medium truncate max-w-[200px]" title="${t.clientName}">${t.clientName}</td>
                        <td class="px-4 py-3 text-xs text-slate-300 hidden md:table-cell">${t.rcaName}</td>
                        <td class="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">${t.city}</td>
                        <td class="px-4 py-3 text-xs text-white text-center font-mono">${dateStr}</td>
                        <td class="px-4 py-3 text-xs text-slate-500 text-right hidden md:table-cell">${valOrig}</td>
                        <td class="px-4 py-3 text-sm text-white font-bold text-right">${valOpen}</td>
                        <td class="px-4 py-3 text-center">${status}</td>
                    </tr>
                `;
            }).join('');

            // Pagination UI
            document.getElementById('titulos-prev-page-btn').disabled = page === 1;
            document.getElementById('titulos-next-page-btn').disabled = page >= totalPages;
            document.getElementById('titulos-page-info-text').textContent = `${start + 1}-${Math.min(end, total)} de ${total}`;
        }
    let lpState = { page: 1, limit: 50, filteredData: [] };
    let selectedLpRedes = [];
    let lpRedeGroupFilter = '';
    let lpRenderId = 0;

    function renderLojaPerfeitaView() {
        setupHierarchyFilters('lp', () => handleLpFilterChange());

        // Rede Filters
        const redeGroupContainer = document.getElementById('lp-rede-group-container');
        const comRedeBtn = document.getElementById('lp-com-rede-btn');
        const comRedeBtnText = document.getElementById('lp-com-rede-btn-text');
        const redeDropdown = document.getElementById('lp-rede-filter-dropdown');

        if (redeGroupContainer && !redeGroupContainer._hasListener) {
            redeGroupContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;
                const group = btn.dataset.group;
                lpRedeGroupFilter = group;
                redeGroupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (group === 'com_rede') redeDropdown.classList.remove('hidden');
                else redeDropdown.classList.add('hidden');
                handleLpFilterChange();
            });
            redeGroupContainer._hasListener = true;
        }

        if (redeDropdown && !redeDropdown._hasListener) {
            redeDropdown.addEventListener('change', () => handleLpFilterChange());
            redeDropdown._hasListener = true;
        }

        // Client Search
        setupClientTypeahead('lp-codcli-filter', 'lp-codcli-filter-suggestions', (code) => {
            handleLpFilterChange();
        });
        const clientInput = document.getElementById('lp-codcli-filter');
        if (clientInput && !clientInput._hasListener) {
            clientInput.addEventListener('input', (e) => {
                 if (!e.target.value) handleLpFilterChange();
            });
            clientInput._hasListener = true;
        }

        // Clear Btn
        const clearBtn = document.getElementById('clear-lp-filters-btn');
        if(clearBtn && !clearBtn._hasListener) {
            clearBtn.addEventListener('click', () => {
                 resetLpFilters();
            });
            clearBtn._hasListener = true;
        }

        // Pagination
        const prevBtn = document.getElementById('lp-prev-page-btn');
        const nextBtn = document.getElementById('lp-next-page-btn');
        if(prevBtn && !prevBtn._hasListener) {
            prevBtn.addEventListener('click', () => {
                if(lpState.page > 1) {
                    lpState.page--;
                    renderLpTable();
                }
            });
            prevBtn._hasListener = true;
        }
        if(nextBtn && !nextBtn._hasListener) {
            nextBtn.addEventListener('click', () => {
                const max = Math.ceil(lpState.filteredData.length / lpState.limit);
                if(lpState.page < max) {
                    lpState.page++;
                    renderLpTable();
                }
            });
            nextBtn._hasListener = true;
        }

        // Initial Filter Population (Rede)
        updateLpRedeFilter();

        // Initial Render
        updateLpView();
    }

    function updateLpRedeFilter() {
        const clients = getHierarchyFilteredClients('lp', allClientsData);
        const dropdown = document.getElementById('lp-rede-filter-dropdown');
        const btnText = document.getElementById('lp-com-rede-btn-text');
        if(dropdown) {
            selectedLpRedes = updateRedeFilter(dropdown, btnText, selectedLpRedes, clients);
        }
    }

    function handleLpFilterChange() {
         if(window.lpUpdateTimeout) clearTimeout(window.lpUpdateTimeout);
         window.lpUpdateTimeout = setTimeout(() => {
             updateLpView();
         }, 10);
    }

    function resetLpFilters() {
        selectedLpRedes = [];
        lpRedeGroupFilter = '';
        document.getElementById('lp-codcli-filter').value = '';

        if (hierarchyState['lp']) {
            hierarchyState['lp'].coords.clear();
            hierarchyState['lp'].cocoords.clear();
            hierarchyState['lp'].promotors.clear();
        }

        const groupContainer = document.getElementById('lp-rede-group-container');
        if(groupContainer) {
             groupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
             groupContainer.querySelector('button[data-group=""]').classList.add('active');
        }
        const dd = document.getElementById('lp-rede-filter-dropdown');
        if(dd) dd.classList.add('hidden');

        setupHierarchyFilters('lp'); // Reset hierarchy
        updateLpRedeFilter();
        updateLpView();
    }

    function updateLpView() {
        lpRenderId++;
        const currentId = lpRenderId;

        // 1. Get Data
        const rawData = embeddedData.nota_perfeita;
        if (!rawData || !rawData.length) {
            // Empty state
            renderLpKPIs(0, 0, 0, 0);
            lpState.filteredData = [];
            renderLpTable();
            return;
        }

        // 2. Filter Clients Base (Hierarchy + Rede)
        let allowedClients = getHierarchyFilteredClients('lp', allClientsData);

        // Apply Rede Filter
        const isComRede = lpRedeGroupFilter === 'com_rede';
        const isSemRede = lpRedeGroupFilter === 'sem_rede';
        const redeSet = (isComRede && selectedLpRedes.length > 0) ? new Set(selectedLpRedes) : null;
        const clientSearch = document.getElementById('lp-codcli-filter').value.toLowerCase().trim();

        const allowedClientCodes = new Set();
        const clientMap = new Map(); // Store metadata for table enrichment

        for(let i=0; i<allowedClients.length; i++) {
            const c = allowedClients[i];

            // Rede Check
            if (isComRede) {
                if (!c.ramo || c.ramo === 'N/A') continue;
                if (redeSet && !redeSet.has(c.ramo)) continue;
            } else if (isSemRede) {
                if (c.ramo && c.ramo !== 'N/A') continue;
            }

            // Search Check
            if (clientSearch) {
                const code = String(c['Código'] || c['codigo_cliente']).toLowerCase();
                const name = (c.nomeCliente || '').toLowerCase();
                if (!code.includes(clientSearch) && !name.includes(clientSearch)) continue;
            }

            const code = normalizeKey(c['Código'] || c['codigo_cliente']);
            allowedClientCodes.add(code);
            clientMap.set(code, c);
        }

        // 3. Filter Data
        const filtered = rawData.filter(row => allowedClientCodes.has(normalizeKey(row.codigo_cliente))).map(row => {
             const c = clientMap.get(normalizeKey(row.codigo_cliente));
             return {
                 ...row,
                 clientName: c ? (c.nomeCliente || c.fantasia) : 'Desconhecido',
                 city: c ? (c.cidade || 'N/A') : 'N/A'
             };
        });

        // 4. Update KPIs
        let totalScore = 0;
        let totalAudits = 0;
        let totalPerfectAudits = 0;
        let perfectStoresCount = 0;

        filtered.forEach(item => {
            totalScore += item.nota_media;
            totalAudits += item.auditorias;
            totalPerfectAudits += item.auditorias_perfeitas;
            if (item.nota_media >= 80) perfectStoresCount++;
        });

        const avgScore = filtered.length > 0 ? (totalScore / filtered.length) : 0;
        // Perfect Store %: (Perfect Audits / Total Audits) * 100
        const perfectPct = totalAudits > 0 ? (totalPerfectAudits / totalAudits) * 100 : 0;

        renderLpKPIs(avgScore, totalAudits, perfectPct, totalPerfectAudits);

        // 5. Update Table
        // Sort by Score Descending
        filtered.sort((a,b) => b.nota_media - a.nota_media);

        lpState.filteredData = filtered;
        lpState.page = 1;
        renderLpTable();
    }

    function renderLpKPIs(avg, audits, perfectPct, perfectCount) {
        document.getElementById('lp-kpi-avg-score').textContent = avg.toFixed(1);
        document.getElementById('lp-kpi-total-audits').textContent = audits;
        document.getElementById('lp-kpi-perfect-stores').textContent = perfectPct.toFixed(1) + '%';
        document.getElementById('lp-kpi-perfect-count').textContent = `${perfectCount} Auditorias`;
    }

    function renderLpTable() {
        const tbody = document.getElementById('lp-table-body');
        if(!tbody) return;

        const { page, limit, filteredData } = lpState;
        const total = filteredData.length;
        const start = (page - 1) * limit;
        const end = start + limit;
        const subset = filteredData.slice(start, end);
        const totalPages = Math.ceil(total / limit) || 1;

        if (total === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-500">Nenhum dado encontrado.</td></tr>';
            document.getElementById('lp-page-info-text').textContent = '0 de 0';
            return;
        }

        tbody.innerHTML = subset.map(t => {
            let colorStyle;
            if (t.nota_media < 50) colorStyle = 'color: #ef4444 !important;';
            else if (t.nota_media < 80) colorStyle = 'color: #eab308 !important;';
            else colorStyle = 'color: #22c55e !important;';

            // Resolve Researcher Display
            let resDisplay = t.pesquisador;
            let resSub = '';

            const resKey = (t.pesquisador || '').toLowerCase().trim();
            if (typeof lpResearcherMap !== 'undefined' && lpResearcherMap.has(resKey)) {
                const info = lpResearcherMap.get(resKey);
                const isPromotor = resKey.toUpperCase().includes('PROMOTOR');

                if (isPromotor) {
                     if (info.sellerName && info.sellerName !== info.sellerCode) {
                         resDisplay = `Promot. ${getFirstName(info.sellerName)}`;
                     } else {
                         resDisplay = `Promot. ${info.sellerCode}`;
                     }
                     resSub = t.pesquisador;
                } else {
                    let prefix = '';
                    if (resKey.toUpperCase().includes('SUPERVISOR')) prefix = 'Sup. ';
                    else if (!resKey.toUpperCase().includes('PROMOTOR')) prefix = 'RCA ';

                    if (info.sellerName && info.sellerName !== info.sellerCode) {
                        resDisplay = `${prefix}${getFirstName(info.sellerName)}`;
                    } else {
                        resDisplay = `${prefix}${info.sellerCode}`;
                    }
                    resSub = t.pesquisador;
                }
            } else {
                // Fallback if map not found or entry missing
                if ((t.pesquisador||'').toUpperCase().includes('PROMOTOR')) {
                    // Try to resolve from global Promotor Map
                    const codeOnly = (t.pesquisador || '').replace(/Promot\.|Promotor/gi, '').trim().toUpperCase();
                    if (typeof optimizedData !== 'undefined' && optimizedData.promotorMap && optimizedData.promotorMap.has(codeOnly)) {
                        const name = optimizedData.promotorMap.get(codeOnly);
                        resDisplay = `Promot. ${getFirstName(name)}`;
                    } else {
                        resDisplay = `Promot. ${t.pesquisador}`;
                    }
                    resSub = t.pesquisador;
                }
            }

            const researcherHtml = `
                <div class="flex flex-col justify-center">
                    <span class="text-xs text-white font-bold leading-tight">${window.escapeHtml(resDisplay)}</span>
                    <span class="text-[9px] text-slate-500 leading-tight">${window.escapeHtml(resSub)}</span>
                </div>
            `;

            return `
                <tr class="hover:bg-slate-700/50 border-b border-white/5 transition-colors flex md:table-row justify-between items-center">
                    <td class="px-4 py-3 font-mono text-xs text-slate-400 hidden md:table-cell">${t.codigo_cliente}</td>
                    <td class="px-4 py-3 text-sm text-white font-medium truncate max-w-[200px] border-none" title="${t.clientName}">${t.clientName}</td>
                    <td class="px-4 py-3 hidden md:table-cell">${researcherHtml}</td>
                    <td class="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">${t.city}</td>
                    <td class="px-4 py-3 text-center font-bold border-none" style="${colorStyle}">${t.nota_media.toFixed(1)}</td>
                </tr>
            `;
        }).join('');

        // Pagination UI
        document.getElementById('lp-prev-page-btn').disabled = page === 1;
        document.getElementById('lp-next-page-btn').disabled = page >= totalPages;
        document.getElementById('lp-page-info-text').textContent = `${start + 1}-${Math.min(end, total)} de ${total}`;
    }

    window.openImageModal = function(imageUrl, title) {
        const modal = document.getElementById('image-modal');
        const img = document.getElementById('image-modal-img');
        const caption = document.getElementById('image-modal-caption');
        const errorMsg = document.getElementById('image-modal-error-msg');
        const closeBtn = document.getElementById('image-modal-close-btn');

        if (!modal || !img) return;

        // Reset State
        img.src = '';
        img.classList.remove('opacity-30'); // Reset opacity
        errorMsg.classList.add('hidden'); // Hide error initially

        if (title) {
            caption.textContent = title;
            caption.classList.remove('hidden');
        } else {
            caption.classList.add('hidden');
        }

        // Handler for Load Success
        img.onload = function() {
            img.classList.remove('opacity-30');
            errorMsg.classList.add('hidden');
        };

        // Handler for Error
        img.onerror = function() {
            this.onerror = null; // Prevent infinite loop
            this.onload = null; // Prevent onload from hiding the error message when logo loads
            this.src = 'imagens/logo.png';
            this.classList.add('opacity-30'); // Dim the logo
            errorMsg.classList.remove('hidden'); // Show overlay text
        };

        // Set Source
        img.src = imageUrl;

        // Open Modal
        modal.classList.remove('hidden');

        // Close Logic
        const closeModal = () => {
            modal.classList.add('hidden');
            img.src = ''; // Clear to stop loading if pending
        };

        if (closeBtn) closeBtn.onclick = closeModal;
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    };
})();
