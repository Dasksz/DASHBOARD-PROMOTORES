
        function debounce(func, delay = 300) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    func.apply(this, args);
                }, delay);
            };
        }

        function showLoader(text = 'Carregando...') {
            return new Promise(resolve => {
                const loader = document.getElementById('page-transition-loader');
                const loaderText = document.getElementById('loader-text');
                if (loader && loaderText) {
                    document.body.setAttribute('data-loading', 'true');
                    loaderText.textContent = text;
                    loader.classList.remove('opacity-0', 'pointer-events-none');
                    setTimeout(resolve, 50);
                } else {
                    resolve();
                }
            });
        }

        function hideLoader() {
             return new Promise(resolve => {
                const loader = document.getElementById('page-transition-loader');
                if (loader) {
                    document.body.removeAttribute('data-loading');
                    loader.classList.add('opacity-0', 'pointer-events-none');
                    setTimeout(resolve, 300);
                } else {
                    resolve();
                }
            });
        }

        function toggleMobileMenu() {
            const mobileMenu = document.getElementById('mobile-menu');
            if (mobileMenu) {
                if (mobileMenu.classList.contains('hidden')) {
                    mobileMenu.classList.remove('hidden');
                    setTimeout(() => mobileMenu.classList.add('open'), 10);
                } else {
                    mobileMenu.classList.remove('open');
                    setTimeout(() => mobileMenu.classList.add('hidden'), 300);
                }
            }
        }

        function navigateTo(view) {
            window.location.hash = view;
        }

        function showViewElement(el) {
            if (!el) return;
            el.classList.remove('hidden');
        }

        async function renderView(view, options = {}) {
            updateFabVisibility(view);

            if (view === 'goals') {
                if (window.userRole !== 'adm') {
                    window.showToast('warning', 'Acesso restrito a administradores.');
                    renderView('dashboard');
                    return;
                }
                if (window.innerWidth < 1024) {
                    window.showToast('warning', 'A página de Metas só está disponível no desktop.');
                    renderView('dashboard');
                    return;
                }
            }

            // Push to history if not navigating back
            if (!options.skipHistory && currentActiveView && currentActiveView !== view) {
                viewHistory.push(currentActiveView);
            }
            currentActiveView = view;

            // Sync Hash to ensure navigation consistency
            try {
                if (window.location.hash !== '#' + view) {
                    history.pushState(null, null, '#' + view);
                }
            } catch (e) {
                console.warn("History pushState failed", e);
            }

            const mobileMenu = document.getElementById('mobile-menu');
            if (mobileMenu && mobileMenu.classList.contains('open')) {
                toggleMobileMenu();
            }

            const viewNameMap = {
                dashboard: 'Visão Geral',
                comparativo: 'Comparativo',
                estoque: 'Estoque',
                cobertura: 'Cobertura',
                cidades: 'Geolocalização',
                'inovacoes-mes': 'Inovações',
                mix: 'Mix',
                'meta-realizado': 'Meta Vs. Realizado',
                'goals': 'Metas',
                'clientes': 'Clientes',
                'produtos': 'Produtos',
                'consultas': 'Consultas',
                'history': 'Histórico de Pedidos',
                'titulos': 'Títulos em Aberto'
            };
            const friendlyName = viewNameMap[view] || 'a página';

            await showLoader(`Carregando ${friendlyName}...`);

            // This function now runs after the loader is visible
            const updateContent = () => {
                [mainDashboard, cityView, positivacaoView, comparisonView, stockView, innovationsMonthView, coverageView, document.getElementById('mix-view'), goalsView, document.getElementById('meta-realizado-view'), document.getElementById('ai-insights-full-page'), document.getElementById('wallet-view'), document.getElementById('clientes-view'), document.getElementById('produtos-view'), document.getElementById('consultas-view'), document.getElementById('history-view'), document.getElementById('titulos-view'), document.getElementById('loja-perfeita-view')].forEach(el => {
                    if(el) el.classList.add('hidden');
                });

                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active-nav');
                });

                const activeLink = document.querySelector(`.nav-link[data-target="${view}"]`);
                if (activeLink) {
                    activeLink.classList.add('active-nav');
                }
                // Also update mobile active state
                document.querySelectorAll('.mobile-nav-link').forEach(link => {
                    if (link.dataset.target === view) {
                        link.classList.add('bg-[#FF5E00]', 'text-white');
                        link.classList.remove('glass-panel-heavy', 'text-slate-300');
                    } else {
                        link.classList.remove('bg-[#FF5E00]', 'text-white');
                        link.classList.add('glass-panel-heavy', 'text-slate-300');
                    }
                });

                switch(view) {
                    case 'history':
                        showViewElement(document.getElementById('history-view'));
                        if (viewState.history.dirty || !viewState.history.rendered) {
                            if (typeof renderHistoryView === 'function') renderHistoryView();
                            viewState.history.rendered = true;
                            viewState.history.dirty = false;
                        }
                        break;
                    case 'clientes':
                        showViewElement(document.getElementById('clientes-view'));
                        if (viewState.clientes.dirty || !viewState.clientes.rendered) {
                            if (typeof renderClientView === 'function') renderClientView();
                            viewState.clientes.rendered = true;
                            viewState.clientes.dirty = false;
                        }
                        break;
                    case 'produtos':
                        showViewElement(document.getElementById('produtos-view'));
                        if (viewState.produtos.dirty || !viewState.produtos.rendered) {
                            if (typeof renderProductView === 'function') renderProductView();
                            viewState.produtos.rendered = true;
                            viewState.produtos.dirty = false;
                        }
                        break;
                    case 'consultas':
                        showViewElement(document.getElementById('consultas-view'));
                        if (viewState.consultas.dirty || !viewState.consultas.rendered) {
                            viewState.consultas.rendered = true;
                            viewState.consultas.dirty = false;
                        }
                        break;
                    case 'wallet':
                        showViewElement(document.getElementById('wallet-view'));
                        if (viewState.wallet.dirty || !viewState.wallet.rendered) {
                            if (typeof renderWalletView === 'function') renderWalletView();
                            viewState.wallet.rendered = true;
                            viewState.wallet.dirty = false;
                        }
                        break;
                    case 'dashboard':
                        showViewElement(mainDashboard);
                        // Trigger 3D Banner Resize (Fix for hidden container init)
                        if (window.resizeBanner3D) setTimeout(window.resizeBanner3D, 100);

                        if (document.getElementById('dashboard-kpi-container')) document.getElementById('dashboard-kpi-container').classList.remove('hidden');
                        if (chartView) chartView.classList.remove('hidden');
                        if (viewState.dashboard.dirty || !viewState.dashboard.rendered) {
                            // Defer execution to allow loader to render
                            setTimeout(() => {
                                updateAllVisuals();
                                viewState.dashboard.rendered = true;
                                viewState.dashboard.dirty = false;
                            }, 50);
                        }
                        break;
                    case 'comparativo':
                        showViewElement(comparisonView);
                        if (viewState.comparativo.dirty || !viewState.comparativo.rendered) {
                            updateAllComparisonFilters();
                            updateComparisonView();
                            viewState.comparativo.rendered = true;
                            viewState.comparativo.dirty = false;
                        }
                        break;
                    case 'estoque':
                        if (stockView) showViewElement(stockView);
                        // Ensure viewState.estoque exists before accessing
                        if (viewState.estoque && (viewState.estoque.dirty || !viewState.estoque.rendered)) {
                            handleStockFilterChange();
                            viewState.estoque.rendered = true;
                            viewState.estoque.dirty = false;
                        }
                        break;
                    case 'cobertura':
                        showViewElement(coverageView);
                        if (viewState.cobertura.dirty || !viewState.cobertura.rendered) {
                            updateAllCoverageFilters();
                            updateCoverageView();
                            viewState.cobertura.rendered = true;
                            viewState.cobertura.dirty = false;
                        }
                        break;
                    case 'cidades':
                        showViewElement(cityView);
                        // Always trigger background sync if admin
                        syncGlobalCoordinates();
                        if (viewState.cidades.dirty || !viewState.cidades.rendered) {
                            // Setup Typeahead
                            if (cityCodCliFilter && !cityCodCliFilter._hasTypeahead) {
                                setupClientTypeahead('city-codcli-filter', 'city-codcli-filter-suggestions', () => {
                                    handleCityFilterChange();
                                });
                                cityCodCliFilter.addEventListener('input', (e) => {
                                    if (!e.target.value) handleCityFilterChange();
                                });
                                cityCodCliFilter._hasTypeahead = true;
                            }

                            updateAllCityFilters();
                            updateCityView();
                            viewState.cidades.rendered = true;
                            viewState.cidades.dirty = false;
                        }
                        break;
                    case 'positivacao':
                        showViewElement(positivacaoView);
                        if (viewState.positivacao.dirty || !viewState.positivacao.rendered) {
                            renderPositivacaoView();
                            updateAllPositivacaoFilters();
                            updatePositivacaoView();
                            viewState.positivacao.rendered = true;
                            viewState.positivacao.dirty = false;
                        }
                        break;
                    case 'titulos':
                        showViewElement(document.getElementById('titulos-view'));
                        if (typeof renderTitulosView === 'function') renderTitulosView();
                        break;
                    case 'lojaPerfeita':
                        showViewElement(document.getElementById('loja-perfeita-view'));
                        if (typeof renderLojaPerfeitaView === 'function') renderLojaPerfeitaView();
                        break;
                    case 'inovacoes-mes':
                        showViewElement(innovationsMonthView);
                        if (viewState.inovacoes.dirty || !viewState.inovacoes.rendered) {
                            selectedInnovationsMonthTiposVenda = updateTipoVendaFilter(innovationsMonthTipoVendaFilterDropdown, innovationsMonthTipoVendaFilterText, selectedInnovationsMonthTiposVenda, [...allSalesData, ...allHistoryData]);
                            updateInnovationsMonthView();
                            viewState.inovacoes.rendered = true;
                            viewState.inovacoes.dirty = false;
                        }
                        break;
                    case 'mix':
                        showViewElement(document.getElementById('mix-view'));
                        if (viewState.mix.dirty || !viewState.mix.rendered) {
                            updateAllMixFilters();
                            updateMixView();
                            viewState.mix.rendered = true;
                            viewState.mix.dirty = false;
                        }
                        break;
                    case 'goals':
                        showViewElement(goalsView);
                        if (viewState.goals.dirty || !viewState.goals.rendered) {
                            updateGoalsView();
                            viewState.goals.rendered = true;
                            viewState.goals.dirty = false;
                        }
                        break;
                    case 'meta-realizado':
                        showViewElement(document.getElementById('meta-realizado-view'));
                        if (viewState.metaRealizado.dirty || !viewState.metaRealizado.rendered) {
                            // Initial filter logic if needed, similar to other views

                            updateMetaRealizadoView();
                            viewState.metaRealizado.rendered = true;
                            viewState.metaRealizado.dirty = false;
                        }
                        break;
                }
            };

            updateContent();

            await hideLoader();
        }


        async function enviarDadosParaSupabase(data) {
            const supabaseUrl = document.getElementById('supabase-url').value;

            // Tentamos obter a sessão atual do usuário
            const { data: { session } } = await supabaseClient.auth.getSession();

            // Definição da chave de autenticação (Token)
            // Agora usa estritamente o token de sessão do usuário logado
            const authToken = session?.access_token;

            // Definição da API Key (Header 'apikey')
            const apiKeyHeader = SUPABASE_ANON_KEY;

            if (!supabaseUrl || !authToken) {
                window.showToast('warning', "Você precisa estar logado como Administrador para enviar dados.");
                return;
            }

            const statusText = document.getElementById('status-text');
            const progressBar = document.getElementById('progress-bar');
            const statusContainer = document.getElementById('status-container');

            statusContainer.classList.remove('hidden');
            const updateStatus = (msg, percent) => {
                statusText.textContent = msg;
                progressBar.style.width = `${percent}%`;
            };

            // --- OPTIMIZATION: Adjusted Batch Size & Concurrency for Stability ---
            const BATCH_SIZE = 1000; // Reduced from 3000 to prevent 520 errors on large tables
            const CONCURRENT_REQUESTS = 3; // Reduced from 7 to prevent DB lock contention

            const retryOperation = async (operation, retries = 3, delay = 1000) => {
                for (let i = 0; i < retries; i++) {
                    try {
                        return await operation();
                    } catch (error) {
                        if (i === retries - 1) throw error;
                        console.warn(`Tentativa ${i + 1} falhou. Retentando em ${delay}ms...`, error);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        delay *= 2; // Exponential backoff
                    }
                }
            };

            const performUpsert = async (table, batch) => {
                await retryOperation(async () => {
                    const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
                        method: 'POST',
                        headers: {
                            'apikey': apiKeyHeader,
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'resolution=merge-duplicates'
                        },
                        body: JSON.stringify(batch)
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Erro Supabase (${response.status}): ${errorText}`);
                    }
                });
            };

            const clearTable = async (table, pkColumn = 'id') => {
                await retryOperation(async () => {
                    // 1. Tenta limpar usando a função RPC 'truncate_table' (Preferred - Fast)
                    try {
                        const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/truncate_table`, {
                            method: 'POST',
                            headers: {
                                'apikey': apiKeyHeader,
                                'Authorization': `Bearer ${authToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ table_name: table })
                        });

                        if (rpcResponse.ok) {
                            return; // Success
                        } else {
                            const errorText = await rpcResponse.text();
                            console.warn(`RPC truncate_table falhou para ${table} (Status: ${rpcResponse.status}). Msg: ${errorText}.`);
                        }
                    } catch (e) {
                        console.warn(`Erro ao chamar RPC truncate_table para ${table}.`, e);
                    }

                    // 2. Fallback: DELETE All (Conventional)
                    // Note: This might timeout for very large tables (e.g., data_history)
                    try {
                        const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${pkColumn}=not.is.null`, {
                            method: 'DELETE',
                            headers: {
                                'apikey': apiKeyHeader,
                                'Authorization': `Bearer ${authToken}`,
                                'Content-Type': 'application/json',
                                'Prefer': 'count=exact' // Request count to verify
                            }
                        });

                        if (response.ok) {
                            return; // Success
                        } else {
                            const errorText = await response.text();
                            console.warn(`DELETE convencional falhou para ${table}: ${errorText}. Tentando Chunked Delete...`);
                        }
                    } catch (e) {
                        console.warn(`DELETE convencional exceção para ${table}.`, e);
                    }

                    // 3. Last Resort: Chunked Delete (Slow but Reliable)
                    // Fetch IDs in batches and delete them
                    console.log(`[ClearTable] Iniciando exclusão em lote para ${table}...`);
                    let hasMore = true;
                    const chunkSize = 5000;

                    while (hasMore) {
                        // Fetch a chunk of IDs
                        const selectUrl = `${supabaseUrl}/rest/v1/${table}?select=${pkColumn}&limit=${chunkSize}`;
                        const selectRes = await fetch(selectUrl, {
                            method: 'GET',
                            headers: {
                                'apikey': apiKeyHeader,
                                'Authorization': `Bearer ${authToken}`,
                                'Content-Type': 'application/json'
                            }
                        });

                        if (!selectRes.ok) throw new Error(`Erro ao buscar IDs para exclusão em lote de ${table}`);
                        const rows = await selectRes.json();

                        if (rows.length === 0) {
                            hasMore = false;
                            break;
                        }

                        const ids = rows.map(r => r[pkColumn]);
                        // Delete these IDs
                        // Using 'in' filter: id=in.(1,2,3...)
                        // URL length limit might be an issue, so we use POST with body filter or strictly URL params carefully.
                        // Supabase REST 'DELETE' supports filtering parameters in URL.
                        // Optimized: Use Supabase Client .delete().in() for larger batches via POST
                        // This handles up to thousands of IDs in one request without URL length issues
                        // reducing Database Round-trips and Disk I/O.
                        const { error: delError } = await window.supabaseClient
                            .from(table)
                            .delete()
                            .in(pkColumn, ids);

                        if (delError) {
                            throw new Error(`Erro no Chunked Delete (${table}): ${delError.message}`);
                        }

                        updateStatus(`Limpando ${table} (Lote progressivo)...`, 50); // Indeterminate progress
                        // Wait a bit to let DB breathe
                        await new Promise(r => setTimeout(r, 200));
                    }
                }, 5, 2000); // Increased retries (5) and initial delay (2s)
            };

            // List of columns that are dates and need conversion from timestamp (ms) to ISO String
            const dateColumns = new Set(['dtped', 'dtsaida', 'ultimacompra', 'datacadastro', 'dtcadastro', 'updated_at']);
            // Special handling for string dates in titulos (dt_vencimento comes as string YYYY-MM-DD from worker)
            const stringDateColumns = new Set(['dt_vencimento']);

            const formatValue = (key, value) => {
                if (dateColumns.has(key) && typeof value === 'number') {
                    try {
                        return new Date(value).toISOString();
                    } catch (e) {
                        return null;
                    }
                }
                // Don't format string dates that are already ISO-ish or simple YYYY-MM-DD
                if (stringDateColumns.has(key)) {
                    return value;
                }
                return value;
            };

            // --- Unified Parallel Uploader ---
            const uploadBatchParallel = async (table, dataObj, isColumnar) => {
                const totalRows = isColumnar ? dataObj.length : dataObj.length;
                if (totalRows === 0) return;

                const totalBatches = Math.ceil(totalRows / BATCH_SIZE);
                let processedBatches = 0;

                const processChunk = async (chunkIndex) => {
                    const start = chunkIndex * BATCH_SIZE;
                    const end = Math.min(start + BATCH_SIZE, totalRows);
                    const batch = [];

                    if (isColumnar) {
                        const columns = dataObj.columns;
                        const values = dataObj.values;
                        // Pre-calculate lower keys to avoid repeated toLowerCase()
                        const colKeys = columns.map(c => c.toLowerCase());

                        for (let j = start; j < end; j++) {
                            const row = {};
                            for (let k = 0; k < columns.length; k++) {
                                const col = columns[k];
                                const lowerKey = colKeys[k];
                                row[lowerKey] = formatValue(lowerKey, values[col][j]);
                            }
                            batch.push(row);
                        }
                    } else {
                        // Array of Objects
                        for (let j = start; j < end; j++) {
                            const item = dataObj[j];
                            const newItem = {};
                            for (const key in item) {
                                const lowerKey = key.toLowerCase();
                                newItem[lowerKey] = formatValue(lowerKey, item[key]);
                            }
                            batch.push(newItem);
                        }
                    }

                    await performUpsert(table, batch);
                    processedBatches++;
                    const progress = Math.round((processedBatches / totalBatches) * 100);
                    updateStatus(`Enviando ${table}: ${progress}%`, progress);
                };

                // Queue worker pattern
                const queue = Array.from({ length: totalBatches }, (_, i) => i);
                const worker = async () => {
                    while (queue.length > 0) {
                        const index = queue.shift();
                        await processChunk(index);
                    }
                };

                const workers = Array.from({ length: Math.min(CONCURRENT_REQUESTS, totalBatches) }, worker);
                await Promise.all(workers);
            };

            try {
                // --- HASH CHECK FOR CONDITIONAL UPLOAD ---
                const { data: remoteMetadata } = await window.supabaseClient.from('data_metadata').select('*');
                const remoteHashMap = new Map();
                if (remoteMetadata) {
                    remoteMetadata.forEach(m => remoteHashMap.set(m.key, m.value));
                }

                const checkHash = (key, newDataHash) => {
                    const remoteHash = remoteHashMap.get(key);
                    const localHash = data.metadata.find(m => m.key === key)?.value;
                    if (remoteHash && localHash && remoteHash === localHash) {
                        console.log(`[Upload] Hash match for ${key}. Skipping upload.`);
                        return false;
                    }
                    console.log(`[Upload] Hash mismatch for ${key} (Remote: ${remoteHash}, Local: ${localHash}). Uploading...`);
                    return true;
                };

                // Helper to perform conditional upload
                const conditionalUpload = async (table, dataPart, hashKey, isCol, pk = 'id') => {
                    if (dataPart && (isCol ? dataPart.length > 0 : dataPart.length > 0)) {
                        // Check if table is empty (Force upload if empty)
                        let forceUpload = false;
                        try {
                             const { count, error } = await window.supabaseClient
                                .from(table)
                                .select('*', { count: 'exact', head: true });
                             if (!error && count === 0) {
                                 forceUpload = true;
                                 console.log(`[Upload] Table ${table} is empty. Forcing upload.`);
                             }
                        } catch(e) {}

                        // checkHash returns FALSE if match (skip), TRUE if mismatch (upload)
                        if (checkHash(hashKey, null) || forceUpload) {
                            await clearTable(table, pk);
                            await uploadBatchParallel(table, dataPart, isCol);
                        } else {
                            updateStatus(`Pulando ${table} (Dados idênticos)...`, 100);
                        }
                    }
                };

                await conditionalUpload('data_detailed', data.detailed, 'hash_detailed', true);
                await conditionalUpload('data_history', data.history, 'hash_history', true);
                await conditionalUpload('data_orders', data.byOrder, 'hash_orders', false);
                await conditionalUpload('data_clients', data.clients, 'hash_clients', true);
                await conditionalUpload('data_stock', data.stock, 'hash_stock', false);
                await conditionalUpload('data_innovations', data.innovations, 'hash_innovations', false);
                await conditionalUpload('data_product_details', data.product_details, 'hash_product_details', false, 'code');
                await conditionalUpload('data_active_products', data.active_products, 'hash_active_products', false, 'code');
                await conditionalUpload('data_hierarchy', data.hierarchy, 'hash_hierarchy', false);
                // Make Titulos Optional: Only upload if data is present
                if (data.titulos && data.titulos.length > 0) {
                    await conditionalUpload('data_titulos', data.titulos, 'hash_titulos', false);
                } else {
                    console.log("[Upload] Skipping Titulos (No data provided).");
                }

                // Make Nota Perfeita Optional
                if (data.nota_perfeita && data.nota_perfeita.length > 0) {
                    await conditionalUpload('data_nota_perfeita', data.nota_perfeita, 'hash_nota_perfeita', false);
                } else {
                    console.log("[Upload] Skipping Nota Perfeita (No data provided).");
                }

                if (data.metadata && data.metadata.length > 0) {
                    // Update last_update timestamp
                    const now = new Date();
                    const lastUpdateIdx = data.metadata.findIndex(m => m.key === 'last_update');
                    if (lastUpdateIdx !== -1) {
                        data.metadata[lastUpdateIdx].value = now.toISOString();
                    } else {
                        data.metadata.push({ key: 'last_update', value: now.toISOString() });
                    }

                    // --- PRESERVE MANUAL KEYS ---
                    try {
                        const keysToPreserve = ['groq_api_key', 'senha_modal', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL'];

                        // We filter from remoteMetadata which we fetched earlier
                        if (remoteMetadata && remoteMetadata.length > 0) {
                            remoteMetadata.forEach(item => {
                                if (keysToPreserve.includes(item.key)) {
                                    const existsInNew = data.metadata.some(newM => newM.key === item.key);
                                    if (!existsInNew) {
                                        data.metadata.push(item);
                                    }
                                }
                            });
                        }
                    } catch (e) {
                        console.warn("[Upload] Failed to preserve manual keys:", e);
                    }

                    // Always upload metadata to update hashes and timestamps
                    await clearTable('data_metadata', 'key');
                    await uploadBatchParallel('data_metadata', data.metadata, false);

                    const lastUpdateText = document.getElementById('last-update-text');
                    if (lastUpdateText) {
                        lastUpdateText.textContent = `Sistema Ativo • ${now.toLocaleString('pt-BR')}`;
                    }
                }

                updateStatus('Upload Concluído com Sucesso!', 100);
                window.showToast('success', 'Dados enviados com sucesso!');
                setTimeout(() => statusContainer.classList.add('hidden'), 3000);

            } catch (error) {
                console.error(error);
                let msg = error.message;
                if (msg.includes('403') || msg.includes('row-level security') || msg.includes('violates row-level security policy') || msg.includes('Access denied')) {
                     msg = "Permissão negada. Verifique se seu usuário tem permissão de 'adm' no Supabase. " + msg;
                }
                updateStatus('Erro: ' + msg, 0);
                window.showToast('error', 'Erro durante o upload: ' + msg);
            }
        }
        // Helper to mark dirty states
        const markDirty = (view) => {
            if (viewState[view]) viewState[view].dirty = true;
        };

        // --- Dashboard/Pedidos Filters ---
        const updateDashboard = () => {
            markDirty('dashboard');
            updateAllVisuals();
        };

        function searchLocalClients(query) {
            if (!query || query.length < 3) return [];
            const terms = query.toLowerCase().split('%').map(t => t.trim()).filter(t => t.length > 0);
            if (terms.length === 0) return [];

            const results = [];
            const indices = optimizedData.searchIndices.clients;
            const limit = 10;

            if (!indices || indices.length === 0) return [];

            for (let i = 0; i < indices.length; i++) {
                const idx = indices[i];
                if (!idx) continue;

                const match = terms.every(term => {
                    const cleanTerm = term.replace(/[^a-z0-9]/g, '');
                    return (
                        (idx.code && idx.code.includes(cleanTerm)) ||
                        (idx.nameLower && idx.nameLower.includes(term)) ||
                        (idx.cnpj && idx.cnpj.includes(cleanTerm)) ||
                        (idx.cityLower && idx.cityLower.includes(term)) ||
                        (idx.bairroLower && idx.bairroLower.includes(term))
                    );
                });

                if (match) {
                    results.push(allClientsData instanceof ColumnarDataset ? allClientsData.get(i) : allClientsData[i]);
                    if (results.length >= limit) break;
                }
            }
            return results;
        }

        function setupClientTypeahead(inputId, suggestionsId, onSelect) {
            const input = document.getElementById(inputId);
            const suggestions = document.getElementById(suggestionsId);
            if (!input || !suggestions) return;

            let debounce;

            input.addEventListener('input', (e) => {
                const val = e.target.value;
                if (!val || val.length < 3) {
                    suggestions.classList.add('hidden');
                    return;
                }

                clearTimeout(debounce);
                debounce = setTimeout(() => {
                    const results = searchLocalClients(val);
                    renderSuggestions(results);
                }, 300);
            });

            // Close on click outside
            document.addEventListener('click', (e) => {
                if (!input.contains(e.target) && !suggestions.contains(e.target)) {
                    suggestions.classList.add('hidden');
                }
            });

            function renderSuggestions(results) {
                suggestions.innerHTML = '';
                if (results.length === 0) {
                    suggestions.classList.add('hidden');
                    return;
                }

                results.forEach(c => {
                    const div = document.createElement('div');
                    div.className = 'px-4 py-3 border-b border-slate-700 hover:bg-slate-700 cursor-pointer flex justify-between items-center group';

                    const code = c['Código'] || c['codigo_cliente'];
                    const name = c.fantasia || c.nomeCliente || c.razaoSocial || 'Sem Nome';
                    const city = c.cidade || c.CIDADE || '';
                    const doc = c['CNPJ/CPF'] || c.cnpj_cpf || '';

                    div.innerHTML = `
                        <div>
                            <div class="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                                <span class="font-mono text-slate-400 mr-2">${code}</span>
                                ${name}
                            </div>
                            <div class="text-xs text-slate-500">${city} • ${doc}</div>
                        </div>
                         <div class="p-2 glass-panel-heavy rounded-full group-hover:bg-[#FF5E00] transition-colors text-slate-400 group-hover:text-white">
                             <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </div>
                    `;
                    div.onclick = () => {
                        input.value = code;
                        suggestions.classList.add('hidden');
                        if (onSelect) onSelect(code);
                    };
                    suggestions.appendChild(div);
                });
                suggestions.classList.remove('hidden');
            }
        }

        function handleClientFilterCascade(clientCode, viewPrefix) {
            if (!clientCode) return;

            // Apply only for Co-Coord and up
            const role = userHierarchyContext.role;
            if (role !== 'adm' && role !== 'coord' && role !== 'cocoord') return;

            const normalizedCode = normalizeKey(clientCode);

            // 1. Auto-Select Promoter
            if (optimizedData.clientHierarchyMap) {
                const node = optimizedData.clientHierarchyMap.get(normalizedCode);
                if (node && hierarchyState[viewPrefix]) {
                    const promotorCode = node.promotor.code;
                    if (promotorCode) {
                        hierarchyState[viewPrefix].promotors.clear();
                        hierarchyState[viewPrefix].promotors.add(promotorCode);
                        updateHierarchyDropdown(viewPrefix, 'promotor');
                    }
                }
            }

            // 2. Update Supplier Filter Options based on Client Data
            const salesIndices = optimizedData.indices.current.byClient.get(normalizeKey(normalizedCode));
            const historyIndices = optimizedData.indices.history.byClient.get(normalizeKey(normalizedCode));

            const filteredRows = [];
            if (salesIndices) salesIndices.forEach(i => filteredRows.push(allSalesData instanceof ColumnarDataset ? allSalesData.get(i) : allSalesData[i]));
            if (historyIndices) historyIndices.forEach(i => filteredRows.push(allHistoryData instanceof ColumnarDataset ? allHistoryData.get(i) : allHistoryData[i]));

            if (filteredRows.length > 0) {
                if (viewPrefix === 'main') {
                     // Note: We don't change 'selectedMainSuppliers' here, just the options available.
                     // The user said: "se eu filtrar um cliente... só deve aparecer para selecionar esse fornecedor"
                     updateSupplierFilter(document.getElementById('fornecedor-filter-dropdown'), document.getElementById('fornecedor-filter-text'), selectedMainSuppliers, filteredRows, 'main');
                }
            }
        }

        function setupEventListeners() {
            // Drag-to-Scroll for Desktop Nav
            const navContainer = document.getElementById('desktop-nav-container');
            if (navContainer) {
                let isDown = false;
                let startX;
                let scrollLeft;

                navContainer.addEventListener('mousedown', (e) => {
                    isDown = true;
                    navContainer.classList.add('cursor-grabbing');
                    startX = e.pageX - navContainer.offsetLeft;
                    scrollLeft = navContainer.scrollLeft;
                });

                navContainer.addEventListener('mouseleave', () => {
                    isDown = false;
                    navContainer.classList.remove('cursor-grabbing');
                });

                navContainer.addEventListener('mouseup', () => {
                    isDown = false;
                    navContainer.classList.remove('cursor-grabbing');
                });

                navContainer.addEventListener('mousemove', (e) => {
                    if (!isDown) return;
                    e.preventDefault();
                    const x = e.pageX - navContainer.offsetLeft;
                    const walk = (x - startX) * 2; // Scroll-fast
                    navContainer.scrollLeft = scrollLeft - walk;
                });
            }

            // Uploader Logic
            const openAdminBtn = document.getElementById('open-admin-btn');
            const adminModal = document.getElementById('admin-uploader-modal');
            const adminCloseBtn = document.getElementById('admin-modal-close-btn');

            // Password Modal Elements
            const pwdModal = document.getElementById('admin-password-modal');
            const pwdInput = document.getElementById('admin-password-input');
            const pwdConfirm = document.getElementById('admin-password-confirm-btn');
            const pwdCancel = document.getElementById('admin-password-cancel-btn');

            const openAdminModal = () => {
                if (pwdModal) pwdModal.classList.add('hidden');
                if (adminModal) adminModal.classList.remove('hidden');
                // Close mobile menu if open
                const mobileMenu = document.getElementById('mobile-menu');
                if (mobileMenu && mobileMenu.classList.contains('open')) {
                    toggleMobileMenu(); // Assuming this function exists in scope
                }

                // Reset Optional Uploads UI
                const container = document.getElementById('optional-uploads-container');
                const icon = document.getElementById('optional-uploads-icon');
                if (container) container.classList.add('hidden');
                if (icon) icon.style.transform = 'rotate(0deg)';
            };

            // Optional Uploads Toggle Logic
            const toggleOptionalBtn = document.getElementById('toggle-optional-uploads-btn');
            if (toggleOptionalBtn) {
                // Clone to remove old listeners if any
                const newBtn = toggleOptionalBtn.cloneNode(true);
                toggleOptionalBtn.parentNode.replaceChild(newBtn, toggleOptionalBtn);

                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const container = document.getElementById('optional-uploads-container');
                    const icon = document.getElementById('optional-uploads-icon');
                    if (container) {
                        container.classList.toggle('hidden');
                        if (icon) {
                            icon.style.transform = container.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(90deg)';
                        }
                    }
                });
            }

            const checkPassword = () => {
                const input = pwdInput.value;
                // Find password in metadata
                let storedPwd = 'admin'; // Default fallback
                if (embeddedData.metadata && Array.isArray(embeddedData.metadata)) {
                    const entry = embeddedData.metadata.find(m => m.key === 'senha_modal');
                    if (entry && entry.value) storedPwd = entry.value;
                }

                if (input === storedPwd) {
                    openAdminModal();
                } else {
                    window.showToast('error', 'Senha incorreta.');
                    pwdInput.value = '';
                    pwdInput.focus();
                }
            };

            if (openAdminBtn) {
                openAdminBtn.addEventListener('click', () => {
                    if (window.userRole === 'adm') {
                        openAdminModal();
                    } else {
                        // Show Password Prompt
                        if (pwdModal) {
                            pwdInput.value = '';
                            pwdModal.classList.remove('hidden');
                            pwdInput.focus();
                        }
                    }
                });
            }

            if (pwdConfirm) {
                pwdConfirm.addEventListener('click', checkPassword);
            }
            if (pwdCancel) {
                pwdCancel.addEventListener('click', () => {
                    if (pwdModal) pwdModal.classList.add('hidden');
                });
            }
            if (pwdInput) {
                pwdInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') checkPassword();
                });
            }
            if (adminCloseBtn) {
                adminCloseBtn.addEventListener('click', () => {
                    adminModal.classList.add('hidden');
                });
            }

            const generateBtn = document.getElementById('generate-btn');
            if (generateBtn) {
                generateBtn.addEventListener('click', () => {
                    const salesFile = document.getElementById('sales-file-input').files[0];
                    const clientsFile = document.getElementById('clients-file-input').files[0];
                    const productsFile = document.getElementById('products-file-input').files[0];
                    const historyFile = document.getElementById('history-file-input').files[0];
                    const innovationsFile = document.getElementById('innovations-file-input').files[0];
                    const hierarchyFile = document.getElementById('hierarchy-file-input').files[0];
                    const titulosFile = document.getElementById('titulos-file-input').files[0];
                    const notaInvolves1File = document.getElementById('nota-involves-1-input').files[0];
                    const notaInvolves2File = document.getElementById('nota-involves-2-input').files[0];

                    if (!salesFile && !historyFile && !hierarchyFile && !notaInvolves1File && !notaInvolves2File) {
                        // Titulos is optional, not required for basic operation
                        window.showToast('warning', "Pelo menos um arquivo (Vendas, Histórico, Hierarquia ou Nota Involves) é necessário.");
                        return;
                    }

                    // Initialize Worker
                    const worker = new Worker('js/worker.js');

                    document.getElementById('status-container').classList.remove('hidden');
                    document.getElementById('status-text').textContent = "Processando arquivos...";

                    // Construct Reference Data (CNPJ Map) from current memory
                    // This allows optional file upload (e.g. just Nota Perfeita) without re-uploading Clients file
                    const referenceData = { cnpjMap: {} };
                    if (allClientsData) {
                        try {
                            if (allClientsData instanceof ColumnarDataset) {
                                const data = allClientsData._data;
                                const len = allClientsData.length;
                                // Try possible keys
                                const codes = data['Código'] || data['codigo_cliente'] || data['CODCLI'];
                                const cnpjs = data['CNPJ/CPF'] || data['cnpj_cpf'] || data['CNPJ'];

                                if (codes && cnpjs) {
                                    for(let i=0; i<len; i++) {
                                        const cnpj = String(cnpjs[i] || '').replace(/\D/g, '');
                                        const code = String(codes[i] || '').trim();
                                        if (cnpj && code) referenceData.cnpjMap[cnpj] = code;
                                    }
                                }
                            } else if (Array.isArray(allClientsData)) {
                                allClientsData.forEach(c => {
                                    const cnpj = String(c['CNPJ/CPF'] || c.cnpj_cpf || c.CNPJ || '').replace(/\D/g, '');
                                    const code = String(c['Código'] || c['codigo_cliente'] || c['CODCLI'] || '').trim();
                                    if (cnpj && code) referenceData.cnpjMap[cnpj] = code;
                                });
                            }
                        } catch (e) {
                            console.warn("Error building reference CNPJ map:", e);
                        }
                    }

                    worker.postMessage({
                        salesFile,
                        clientsFile,
                        productsFile,
                        historyFile,
                        innovationsFile,
                        hierarchyFile,
                        titulosFile,
                        notaInvolvesFile1: notaInvolves1File,
                        notaInvolvesFile2: notaInvolves2File,
                        referenceData: referenceData // Pass the map
                    });

                    worker.onmessage = (e) => {
                        const { type, data, status, percentage, message } = e.data;
                        if (type === 'progress') {
                            document.getElementById('status-text').textContent = status;
                            document.getElementById('progress-bar').style.width = percentage + '%';
                        } else if (type === 'result') {
                            if (data.nota_perfeita_count !== undefined && data.nota_perfeita_count > 0) {
                                window.showToast('success', `${data.nota_perfeita_count} clientes identificados no arquivo 'Loja Perfeita'.`);
                            }
                            enviarDadosParaSupabase(data);
                            worker.terminate();
                        } else if (type === 'error') {
                            window.showToast('error', 'Erro no processamento: ' + message);
                            worker.terminate();
                        }
                    };
                });
            }

            const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
            if (mobileMenuToggle) mobileMenuToggle.addEventListener('click', toggleMobileMenu);

            const handleNavClick = (e) => {
                const target = e.currentTarget.dataset.target;
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    const url = new URL(window.location.href);
                    url.searchParams.set('ir_para', target);
                    window.open(url.toString(), '_blank');
                } else {
                    navigateTo(target);
                }
            };

            document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', handleNavClick));

            document.querySelectorAll('.mobile-nav-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    handleNavClick(e);
                    toggleMobileMenu();
                });
            });

            const supervisorFilterBtn = document.getElementById('supervisor-filter-btn');
            const supervisorFilterDropdown = document.getElementById('supervisor-filter-dropdown');
            if (supervisorFilterBtn && supervisorFilterDropdown) {
                supervisorFilterBtn.addEventListener('click', () => supervisorFilterDropdown.classList.toggle('hidden'));
                supervisorFilterDropdown.addEventListener('change', (e) => {
                    if (e.target.type === 'checkbox') {
                        const { value, checked } = e.target;

                        updateDashboard();
                    }
                });
            }

            const fornecedorFilterBtn = document.getElementById('fornecedor-filter-btn');
            const fornecedorFilterDropdown = document.getElementById('fornecedor-filter-dropdown');
            if (fornecedorFilterBtn && fornecedorFilterDropdown) {
                fornecedorFilterBtn.addEventListener('click', () => fornecedorFilterDropdown.classList.toggle('hidden'));
                fornecedorFilterDropdown.addEventListener('change', (e) => {
                    if (e.target.type === 'checkbox') {
                        const { value, checked } = e.target;
                        if (checked) selectedMainSuppliers.push(value);
                        else selectedMainSuppliers = selectedMainSuppliers.filter(s => s !== value);

                        let supplierDataSource = [...allSalesData, ...allHistoryData];
                        if (currentFornecedor) {
                            supplierDataSource = supplierDataSource.filter(s => s.OBSERVACAOFOR === currentFornecedor);
                        }
                        selectedMainSuppliers = updateSupplierFilter(fornecedorFilterDropdown, document.getElementById('fornecedor-filter-text'), selectedMainSuppliers, supplierDataSource, 'main');

                        updateDashboard();
                    }
                });
            }

            if (vendedorFilterBtn && vendedorFilterDropdown) {
                vendedorFilterBtn.addEventListener('click', () => vendedorFilterDropdown.classList.toggle('hidden'));
                vendedorFilterDropdown.addEventListener('change', (e) => {
                    if (e.target.type === 'checkbox') {
                        const { value, checked } = e.target;

                        updateDashboard();
                    }
                });
            }

            if (tipoVendaFilterBtn && tipoVendaFilterDropdown) {
                tipoVendaFilterBtn.addEventListener('click', () => tipoVendaFilterDropdown.classList.toggle('hidden'));
                tipoVendaFilterDropdown.addEventListener('change', (e) => {
                    if (e.target.type === 'checkbox') {
                        const { value, checked } = e.target;
                        if (checked) selectedTiposVenda.push(value);
                        else selectedTiposVenda = selectedTiposVenda.filter(s => s !== value);
                        selectedTiposVenda = updateTipoVendaFilter(tipoVendaFilterDropdown, tipoVendaFilterText, selectedTiposVenda, allSalesData);

                        updateDashboard();
                    }
                });
            }

            if (posicaoFilter) posicaoFilter.addEventListener('change', () => {  updateDashboard(); });
            const debouncedUpdateDashboard = debounce(updateDashboard, 400);
            if (codcliFilter) {
                setupClientTypeahead('codcli-filter', 'codcli-filter-suggestions', (code) => {
                    handleClientFilterCascade(code, 'main');

                    debouncedUpdateDashboard();
                });
                codcliFilter.addEventListener('input', (e) => {
                    if (!e.target.value) {
                         debouncedUpdateDashboard();
                    }
                });
                // Make Lupa Icon Interactive
                const codcliSearchIcon = document.getElementById('codcli-search-icon');
                if (codcliSearchIcon) {
                    codcliSearchIcon.addEventListener('click', () => {
                        codcliFilter.focus();

                        updateDashboard(); // Immediate update
                    });
                }
            }

            const goalsGvCodcliFilter = document.getElementById('goals-gv-codcli-filter');
            if (goalsGvCodcliFilter) {
                setupClientTypeahead('goals-gv-codcli-filter', 'goals-gv-codcli-filter-suggestions', (code) => {
                    handleClientFilterCascade(code, 'goals-gv');
                    if (typeof updateGoalsView === 'function') {
                        goalsTableState.currentPage = 1;
                        updateGoalsView();
                    } else {
                        goalsGvCodcliFilter.dispatchEvent(new Event('input'));
                    }
                });
                goalsGvCodcliFilter.addEventListener('input', (e) => {
                    if (!e.target.value) {
                        if (typeof updateGoalsView === 'function') {
                            goalsTableState.currentPage = 1;
                            updateGoalsView();
                        }
                    }
                });
                // Make Goals Lupa Icon Interactive
                const goalsGvSearchIcon = document.getElementById('goals-gv-search-icon');
                if (goalsGvSearchIcon) {
                    goalsGvSearchIcon.addEventListener('click', () => {
                        goalsGvCodcliFilter.focus();
                        if (typeof updateGoalsView === 'function') {
                            goalsTableState.currentPage = 1;
                            updateGoalsView();
                        } else {
                            goalsGvCodcliFilter.dispatchEvent(new Event('input'));
                        }
                    });
                }
            }
            if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', () => { resetMainFilters(); markDirty('dashboard'); });

            if (mainComRedeBtn) mainComRedeBtn.addEventListener('click', () => mainRedeFilterDropdown.classList.toggle('hidden'));
            if (mainRedeGroupContainer) {
                mainRedeGroupContainer.addEventListener('click', (e) => {
                    if(e.target.closest('button')) {
                        const button = e.target.closest('button');
                        mainRedeGroupFilter = button.dataset.group;
                        mainRedeGroupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                        button.classList.add('active');
                        if (mainRedeGroupFilter !== 'com_rede') {
                            mainRedeFilterDropdown.classList.add('hidden');
                            selectedMainRedes = [];
                        }
                        updateRedeFilter(mainRedeFilterDropdown, mainComRedeBtnText, selectedMainRedes, allClientsData);

                        updateDashboard();
                    }
                });
            }
            if (mainRedeFilterDropdown) {
                mainRedeFilterDropdown.addEventListener('change', (e) => {
                    if (e.target.type === 'checkbox') {
                        const { value, checked } = e.target;
                        if (checked) selectedMainRedes.push(value);
                        else selectedMainRedes = selectedMainRedes.filter(r => r !== value);
                        selectedMainRedes = updateRedeFilter(mainRedeFilterDropdown, mainComRedeBtnText, selectedMainRedes, allClientsData);

                        updateDashboard();
                    }
                });
            }

            // --- City View Filters ---
            const updateCity = () => {
                markDirty('cidades');
                handleCityFilterChange();
            };
            if (citySupplierFilterDropdown) {
                citySupplierFilterDropdown.addEventListener('change', (e) => {
                    if (e.target.type === 'checkbox' && e.target.dataset.filterType === 'city') {
                        const { value, checked } = e.target;
                        if (checked) {
                            if (!selectedCitySuppliers.includes(value)) selectedCitySuppliers.push(value);
                        } else {
                            selectedCitySuppliers = selectedCitySuppliers.filter(s => s !== value);
                        }
                        handleCityFilterChange({ skipFilter: 'supplier' });
                    }
                });
            }

            if (cityTipoVendaFilterBtn && cityTipoVendaFilterDropdown) {
                cityTipoVendaFilterBtn.addEventListener('click', () => cityTipoVendaFilterDropdown.classList.toggle('hidden'));
                cityTipoVendaFilterDropdown.addEventListener('change', (e) => {
                    if (e.target.type === 'checkbox') {
                        const { value, checked } = e.target;
                        if (checked) {
                            if (!selectedCityTiposVenda.includes(value)) selectedCityTiposVenda.push(value);
                        } else {
                            selectedCityTiposVenda = selectedCityTiposVenda.filter(s => s !== value);
                        }
                        handleCityFilterChange({ skipFilter: 'tipoVenda' });
                    }
                });
            }

            if (cityComRedeBtn) cityComRedeBtn.addEventListener('click', () => cityRedeFilterDropdown.classList.toggle('hidden'));
            if (cityRedeGroupContainer) {
                cityRedeGroupContainer.addEventListener('click', (e) => {
                    if(e.target.closest('button')) {
                        const button = e.target.closest('button');
                        cityRedeGroupFilter = button.dataset.group;
                        cityRedeGroupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                        button.classList.add('active');

                        if (cityRedeGroupFilter !== 'com_rede') {
                            cityRedeFilterDropdown.classList.add('hidden');
                            selectedCityRedes = [];
                        }
                        handleCityFilterChange();
                    }
                });
            }
            if (cityRedeFilterDropdown) {
                cityRedeFilterDropdown.addEventListener('change', (e) => {
                    if (e.target.type === 'checkbox') {
                        const { value, checked } = e.target;
                        if (checked) selectedCityRedes.push(value);
                        else selectedCityRedes = selectedCityRedes.filter(r => r !== value);

                        cityRedeGroupFilter = 'com_rede';
                        cityRedeGroupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                        cityComRedeBtn.classList.add('active');

                        handleCityFilterChange({ skipFilter: 'rede' });
                    }
                });
            }

            const toggleCityMapBtn = document.getElementById('toggle-city-map-btn');
            if (toggleCityMapBtn) {
                toggleCityMapBtn.addEventListener('click', () => {
                    const cityMapContainer = document.getElementById('city-map-container');
                    if (!cityMapContainer) return;

                    const isHidden = cityMapContainer.classList.contains('hidden');

                    if (isHidden) {
                        // Show Map
                        cityMapContainer.classList.remove('hidden');
                        toggleCityMapBtn.innerHTML = `
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
                            Ocultar Mapa
                        `;

                        // Initialize or Refresh Leaflet
                        if (!leafletMap) {
                            initLeafletMap();
                        }

                        // Important: Invalidate size after removing 'hidden' so Leaflet calculates dimensions correctly
                        setTimeout(() => {
                            if (leafletMap) leafletMap.invalidateSize();
                            updateCityMap();
                        }, 100);

                    } else {
                        // Hide Map
                        cityMapContainer.classList.add('hidden');
                        toggleCityMapBtn.innerHTML = `
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
                            Ver Mapa
                        `;
                    }
                });
            }

            if (clearCityFiltersBtn) clearCityFiltersBtn.addEventListener('click', () => { resetCityFilters(); markDirty('cidades'); });
            const debouncedUpdateCity = debounce(updateCity, 400);
            if (cityCodCliFilter) {
                cityCodCliFilter.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/[^0-9]/g, '');
                    debouncedUpdateCity();
                });
            }

            // debouncedCitySearch removed
            // cityNameFilter listeners removed

            document.addEventListener('click', (e) => {
                if (supervisorFilterBtn && supervisorFilterDropdown && !supervisorFilterBtn.contains(e.target) && !supervisorFilterDropdown.contains(e.target)) supervisorFilterDropdown.classList.add('hidden');
                if (fornecedorFilterBtn && fornecedorFilterDropdown && !fornecedorFilterBtn.contains(e.target) && !fornecedorFilterDropdown.contains(e.target)) fornecedorFilterDropdown.classList.add('hidden');
                if (vendedorFilterBtn && vendedorFilterDropdown && !vendedorFilterBtn.contains(e.target) && !vendedorFilterDropdown.contains(e.target)) vendedorFilterDropdown.classList.add('hidden');
                if (tipoVendaFilterBtn && tipoVendaFilterDropdown && !tipoVendaFilterBtn.contains(e.target) && !tipoVendaFilterDropdown.contains(e.target)) tipoVendaFilterDropdown.classList.add('hidden');

                if (citySupplierFilterBtn && citySupplierFilterDropdown && !citySupplierFilterBtn.contains(e.target) && !citySupplierFilterDropdown.contains(e.target)) citySupplierFilterDropdown.classList.add('hidden');
                if (cityTipoVendaFilterBtn && cityTipoVendaFilterDropdown && !cityTipoVendaFilterBtn.contains(e.target) && !cityTipoVendaFilterDropdown.contains(e.target)) cityTipoVendaFilterDropdown.classList.add('hidden');
                if (cityComRedeBtn && cityRedeFilterDropdown && !cityComRedeBtn.contains(e.target) && !cityRedeFilterDropdown.contains(e.target)) cityRedeFilterDropdown.classList.add('hidden');
                if (mainComRedeBtn && mainRedeFilterDropdown && !mainComRedeBtn.contains(e.target) && !mainRedeFilterDropdown.contains(e.target)) mainRedeFilterDropdown.classList.add('hidden');

                if (comparisonComRedeBtn && comparisonRedeFilterDropdown && !comparisonComRedeBtn.contains(e.target) && !comparisonRedeFilterDropdown.contains(e.target)) comparisonRedeFilterDropdown.classList.add('hidden');
                if (comparisonTipoVendaFilterBtn && comparisonTipoVendaFilterDropdown && !comparisonTipoVendaFilterBtn.contains(e.target) && !comparisonTipoVendaFilterDropdown.contains(e.target)) comparisonTipoVendaFilterDropdown.classList.add('hidden');
                if (comparisonSupplierFilterBtn && comparisonSupplierFilterDropdown && !comparisonSupplierFilterBtn.contains(e.target) && !comparisonSupplierFilterDropdown.contains(e.target)) comparisonSupplierFilterDropdown.classList.add('hidden');
                if (comparisonProductFilterBtn && comparisonProductFilterDropdown && !comparisonProductFilterBtn.contains(e.target) && !comparisonProductFilterDropdown.contains(e.target)) comparisonProductFilterDropdown.classList.add('hidden');


                if (e.target.closest('[data-pedido-id]')) { e.preventDefault(); openModal(e.target.closest('[data-pedido-id]').dataset.pedidoId); }
                if (e.target.closest('[data-codcli]')) { e.preventDefault(); openClientModal(e.target.closest('[data-codcli]').dataset.codcli); }
                // Old city suggestions listener removed
                if (e.target.closest('#comparison-city-suggestions > div')) { if(comparisonCityFilter) comparisonCityFilter.value = e.target.textContent; comparisonCitySuggestions.classList.add('hidden'); updateAllComparisonFilters(); updateComparisonView(); }
                else if (comparisonCityFilter && !comparisonCityFilter.contains(e.target)) comparisonCitySuggestions.classList.add('hidden');
            });

            fornecedorToggleContainerEl.querySelectorAll('.fornecedor-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const fornecedor = btn.dataset.fornecedor;
                    if (currentFornecedor === fornecedor) { currentFornecedor = ''; btn.classList.remove('active'); } else { currentFornecedor = fornecedor; fornecedorToggleContainerEl.querySelectorAll('.fornecedor-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }

                    // Update Supplier Filter Options
                    let supplierDataSource = [...allSalesData, ...allHistoryData];
                    if (currentFornecedor) {
                        supplierDataSource = supplierDataSource.filter(s => s.OBSERVACAOFOR === currentFornecedor);
                    }
                    selectedMainSuppliers = updateSupplierFilter(fornecedorFilterDropdown, document.getElementById('fornecedor-filter-text'), selectedMainSuppliers, supplierDataSource, 'main');


                    updateDashboard();
                });
            });

            const updateComparison = () => {
                markDirty('comparativo');
                updateAllComparisonFilters();
                updateComparisonView();
            };

            const handleComparisonFilterChange = updateComparison;

            comparisonTipoVendaFilterBtn.addEventListener('click', () => comparisonTipoVendaFilterDropdown.classList.toggle('hidden'));
            comparisonTipoVendaFilterDropdown.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox') {
                    const { value, checked } = e.target;
                    if (checked) {
                        if (!selectedComparisonTiposVenda.includes(value)) selectedComparisonTiposVenda.push(value);
                    } else {
                        selectedComparisonTiposVenda = selectedComparisonTiposVenda.filter(s => s !== value);
                    }
                    selectedComparisonTiposVenda = updateTipoVendaFilter(comparisonTipoVendaFilterDropdown, comparisonTipoVendaFilterText, selectedComparisonTiposVenda, [...allSalesData, ...allHistoryData]);
                    handleComparisonFilterChange();
                }
            });
            comparisonFornecedorToggleContainer.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON') { const fornecedor = e.target.dataset.fornecedor; if (currentComparisonFornecedor === fornecedor) { currentComparisonFornecedor = ''; e.target.classList.remove('active'); } else { currentComparisonFornecedor = fornecedor; comparisonFornecedorToggleContainer.querySelectorAll('.fornecedor-btn').forEach(b => b.classList.remove('active')); e.target.classList.add('active'); } handleComparisonFilterChange(); } });
            comparisonSupplierFilterBtn.addEventListener('click', () => comparisonSupplierFilterDropdown.classList.toggle('hidden'));
            comparisonSupplierFilterDropdown.addEventListener('change', (e) => { if (e.target.type === 'checkbox' && e.target.dataset.filterType === 'comparison') { const { value, checked } = e.target; if (checked) selectedComparisonSuppliers.push(value); else selectedComparisonSuppliers = selectedComparisonSuppliers.filter(s => s !== value); handleComparisonFilterChange(); } });

            comparisonComRedeBtn.addEventListener('click', () => comparisonRedeFilterDropdown.classList.toggle('hidden'));
            comparisonRedeGroupContainer.addEventListener('click', (e) => {
                if(e.target.closest('button')) {
                    const button = e.target.closest('button');
                    comparisonRedeGroupFilter = button.dataset.group;
                    comparisonRedeGroupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                    button.classList.add('active');
                    if (comparisonRedeGroupFilter !== 'com_rede') {
                        comparisonRedeFilterDropdown.classList.add('hidden');
                        selectedComparisonRedes = [];
                    }
                    updateRedeFilter(comparisonRedeFilterDropdown, comparisonComRedeBtnText, selectedComparisonRedes, allClientsData);
                    handleComparisonFilterChange();
                }
            });
            comparisonRedeFilterDropdown.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox') {
                    const { value, checked } = e.target;
                    if (checked) selectedComparisonRedes.push(value);
                    else selectedComparisonRedes = selectedComparisonRedes.filter(r => r !== value);

                    comparisonRedeGroupFilter = 'com_rede';
                    comparisonRedeGroupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                    comparisonComRedeBtn.classList.add('active');

                    selectedComparisonRedes = updateRedeFilter(comparisonRedeFilterDropdown, comparisonComRedeBtnText, selectedComparisonRedes, allClientsData);
                    handleComparisonFilterChange();
                }
            });

            const debouncedComparisonCityUpdate = debounce(() => {
                const { currentSales, historySales } = getComparisonFilteredData({ excludeFilter: 'city' });
                comparisonCitySuggestions.classList.remove('manual-hide');
                updateComparisonCitySuggestions([...currentSales, ...historySales]);
            }, 300);

            comparisonCityFilter.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[0-9]/g, '');
                debouncedComparisonCityUpdate();
            });
            comparisonCityFilter.addEventListener('focus', () => {
                const { currentSales, historySales } = getComparisonFilteredData({ excludeFilter: 'city' });
                comparisonCitySuggestions.classList.remove('manual-hide');
                updateComparisonCitySuggestions([...currentSales, ...historySales]);
            });
            comparisonCityFilter.addEventListener('blur', () => setTimeout(() => comparisonCitySuggestions.classList.add('hidden'), 150));
            comparisonCityFilter.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    comparisonCitySuggestions.classList.add('hidden', 'manual-hide');
                    handleComparisonFilterChange();
                    e.target.blur();
                }
            });
            comparisonCitySuggestions.addEventListener('click', (e) => {
                if (e.target.tagName === 'DIV') {
                    comparisonCityFilter.value = e.target.textContent;
                    comparisonCitySuggestions.classList.add('hidden');
                    handleComparisonFilterChange();
                }
            });

            const resetComparisonFilters = () => {
                selectedComparisonTiposVenda = [];
                currentComparisonFornecedor = 'PEPSICO';
                selectedComparisonSuppliers = [];
                comparisonRedeGroupFilter = '';
                selectedComparisonRedes = [];

                if (comparisonCityFilter) comparisonCityFilter.value = '';

                if (comparisonTipoVendaFilterDropdown) {
                    comparisonTipoVendaFilterDropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                    updateTipoVendaFilter(comparisonTipoVendaFilterDropdown, comparisonTipoVendaFilterText, selectedComparisonTiposVenda, [...allSalesData, ...allHistoryData]);
                }

                if (comparisonSupplierFilterDropdown) {
                    comparisonSupplierFilterDropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                    updateSupplierFilter(comparisonSupplierFilterDropdown, comparisonSupplierFilterText, selectedComparisonSuppliers, supplierOptionsData, 'comparison');
                }

                if (comparisonRedeFilterDropdown) {
                    comparisonRedeFilterDropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                }

                if (comparisonRedeGroupContainer) {
                    comparisonRedeGroupContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                    const defaultBtn = comparisonRedeGroupContainer.querySelector('button[data-group=""]');
                    if (defaultBtn) defaultBtn.classList.add('active');
                    updateRedeFilter(comparisonRedeFilterDropdown, comparisonComRedeBtnText, selectedComparisonRedes, allClientsData);
                }

                if (comparisonFornecedorToggleContainer) {
                    comparisonFornecedorToggleContainer.querySelectorAll('.fornecedor-btn').forEach(b => b.classList.remove('active'));
                    const pepsicoBtn = comparisonFornecedorToggleContainer.querySelector('button[data-fornecedor="PEPSICO"]');
                    if (pepsicoBtn) pepsicoBtn.classList.add('active');
                }

                handleComparisonFilterChange();
            };

            clearComparisonFiltersBtn.addEventListener('click', resetComparisonFilters);

            const handleProductFilterChange = (e, selectedArray) => {
                 if (e.target.type === 'checkbox') {
                    const { value, checked } = e.target;
                    if (checked) {
                        if (!selectedArray.includes(value)) selectedArray.push(value);
                    } else {
                        const index = selectedArray.indexOf(value);
                        if (index > -1) selectedArray.splice(index, 1);
                    }
                    return true;
                }
                return false;
            }

            comparisonProductFilterBtn.addEventListener('click', () => {
                updateComparisonProductFilter();
                comparisonProductFilterDropdown.classList.toggle('hidden');
            });

            const debouncedComparisonProductSearch = debounce(updateComparisonProductFilter, 250);
            comparisonProductFilterDropdown.addEventListener('input', (e) => {
                if (e.target.id === 'comparison-product-search-input') {
                    debouncedComparisonProductSearch();
                }
            });
            comparisonProductFilterDropdown.addEventListener('change', (e) => {
                if(e.target.dataset.filterType === 'comparison' && handleProductFilterChange(e, selectedComparisonProducts)) {
                    handleComparisonFilterChange();
                    updateComparisonProductFilter();
                }
            });


            comparisonTendencyToggle.addEventListener('click', () => {
                useTendencyComparison = !useTendencyComparison;
                comparisonTendencyToggle.textContent = useTendencyComparison ? 'Ver Dados Reais' : 'Calcular Tendência';
                comparisonTendencyToggle.classList.toggle('bg-orange-600');
                comparisonTendencyToggle.classList.toggle('hover:bg-orange-500');
                comparisonTendencyToggle.classList.toggle('bg-purple-600');
                comparisonTendencyToggle.classList.toggle('hover:bg-purple-500');
                updateComparison();
            });

            const updateToggleStyles = (activeBtn, ...others) => {
                activeBtn.classList.add('active', 'bg-[#FF5E00]', 'text-white');
                activeBtn.classList.remove('text-slate-400');
                others.forEach(btn => {
                    if (btn) {
                        btn.classList.remove('active', 'bg-[#FF5E00]', 'text-white');
                        btn.classList.add('text-slate-400');
                    }
                });
            };

            if (toggleDailyBtn) {
                toggleDailyBtn.addEventListener('click', () => {
                    comparisonChartType = 'daily';
                    updateToggleStyles(toggleDailyBtn, toggleWeeklyBtn, toggleMonthlyBtn);
                    document.getElementById('comparison-monthly-metric-container').classList.add('hidden');
                    updateComparisonView();
                });
            }

            toggleWeeklyBtn.addEventListener('click', () => {
                comparisonChartType = 'weekly';
                updateToggleStyles(toggleWeeklyBtn, toggleDailyBtn, toggleMonthlyBtn);
                document.getElementById('comparison-monthly-metric-container').classList.add('hidden');
                updateComparisonView();
            });

            toggleMonthlyBtn.addEventListener('click', () => {
                comparisonChartType = 'monthly';
                updateToggleStyles(toggleMonthlyBtn, toggleDailyBtn, toggleWeeklyBtn);
                // The toggle visibility is handled inside updateComparisonView based on mode
                updateComparisonView();
            });

            // Initialize Toggle Styles for Default View (Daily)
            if (toggleDailyBtn) {
                updateToggleStyles(toggleDailyBtn, toggleWeeklyBtn, toggleMonthlyBtn);
            }

            // New Metric Toggle Listeners
            const toggleMonthlyFatBtn = document.getElementById('toggle-monthly-fat-btn');
            const toggleMonthlyClientsBtn = document.getElementById('toggle-monthly-clients-btn');

            if (toggleMonthlyFatBtn && toggleMonthlyClientsBtn) {
                toggleMonthlyFatBtn.addEventListener('click', () => {
                    comparisonMonthlyMetric = 'faturamento';
                    toggleMonthlyFatBtn.classList.add('active');
                    toggleMonthlyClientsBtn.classList.remove('active');
                    updateComparison();
                });

                toggleMonthlyClientsBtn.addEventListener('click', () => {
                    comparisonMonthlyMetric = 'clientes';
                    toggleMonthlyClientsBtn.classList.add('active');
                    toggleMonthlyFatBtn.classList.remove('active');
                    updateComparison();
                });
            }

            if (mainHolidayPickerBtn) {
                mainHolidayPickerBtn.addEventListener('click', () => {
                    renderCalendar(calendarState.year, calendarState.month);
                    holidayModal.classList.remove('hidden');
                });
            }
            if (comparisonHolidayPickerBtn) {
                comparisonHolidayPickerBtn.addEventListener('click', () => {
                    renderCalendar(calendarState.year, calendarState.month);
                    holidayModal.classList.remove('hidden');
                });
            }
            if (holidayModalCloseBtn) {
                holidayModalCloseBtn.addEventListener('click', () => holidayModal.classList.add('hidden'));
            }
            if (holidayModalDoneBtn) {
                holidayModalDoneBtn.addEventListener('click', () => {
                    holidayModal.classList.add('hidden');
                    const holidayBtnText = selectedHolidays.length > 0 ? `${selectedHolidays.length} feriado(s)` : 'Selecionar Feriados';
                    if (comparisonHolidayPickerBtn) comparisonHolidayPickerBtn.textContent = holidayBtnText;
                    if (mainHolidayPickerBtn) mainHolidayPickerBtn.textContent = holidayBtnText;
                    updateComparison();
                    updateDashboard();
                });
            }
            if (calendarContainer) {
                calendarContainer.addEventListener('click', (e) => {
                    if (e.target.id === 'prev-month-btn') {
                        calendarState.month--;
                        if (calendarState.month < 0) {
                            calendarState.month = 11;
                            calendarState.year--;
                        }
                        renderCalendar(calendarState.year, calendarState.month);
                    } else if (e.target.id === 'next-month-btn') {
                        calendarState.month++;
                        if (calendarState.month > 11) {
                            calendarState.month = 0;
                            calendarState.year++;
                        }
                        renderCalendar(calendarState.year, calendarState.month);
                    } else if (e.target.dataset.date) {
                        const dateString = e.target.dataset.date;
                        const index = selectedHolidays.indexOf(dateString);
                        if (index > -1) {
                            selectedHolidays.splice(index, 1);
                        } else {
                            selectedHolidays.push(dateString);
                        }
                        renderCalendar(calendarState.year, calendarState.month);
                    }
                });
            }


            // FAB Setup for Positivacao View (Custom with multiple PDF options)
            setupFab('positivacao-fab-container', null, null); // Setup toggle only

            const positivacaoFab = document.getElementById('positivacao-fab-container');
            if (positivacaoFab) {
                const pdfActiveBtn = positivacaoFab.querySelector('[data-action="pdf-active"]');
                const pdfInactiveBtn = positivacaoFab.querySelector('[data-action="pdf-inactive"]');
                const excelBtn = positivacaoFab.querySelector('[data-action="excel"]');

                if (pdfActiveBtn) {
                    const newBtn = pdfActiveBtn.cloneNode(true);
                    pdfActiveBtn.parentNode.replaceChild(newBtn, pdfActiveBtn);
                    newBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        positivacaoFab.classList.remove('active');
                        exportClientsPDF(positivacaoDataForExport.active, 'Relatório de Clientes Ativos no Mês', 'clientes_ativos', true);
                    });
                }

                if (pdfInactiveBtn) {
                    const newBtn = pdfInactiveBtn.cloneNode(true);
                    pdfInactiveBtn.parentNode.replaceChild(newBtn, pdfInactiveBtn);
                    newBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        positivacaoFab.classList.remove('active');
                        exportClientsPDF(positivacaoDataForExport.inactive, 'Relatório de Clientes Inativos (Sem Compra)', 'clientes_inativos', false);
                    });
                }

                if (excelBtn) {
                    const newBtn = excelBtn.cloneNode(true);
                    excelBtn.parentNode.replaceChild(newBtn, excelBtn);
                    newBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        positivacaoFab.classList.remove('active');
                        const sheets = {};
                        if(positivacaoDataForExport.active && positivacaoDataForExport.active.length) sheets['Ativos'] = positivacaoDataForExport.active;
                        if(positivacaoDataForExport.inactive && positivacaoDataForExport.inactive.length) sheets['Inativos'] = positivacaoDataForExport.inactive;
                        exportToExcel(sheets, 'Positivacao_Clientes');
                    });
                }
            }

            if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => modal.classList.add('hidden'));
            if (clientModalCloseBtn) clientModalCloseBtn.addEventListener('click', () => clientModal.classList.add('hidden'));
            if (faturamentoBtn) faturamentoBtn.addEventListener('click', () => { currentProductMetric = 'faturamento'; faturamentoBtn.classList.add('active'); pesoBtn.classList.remove('active'); updateDashboard(); });
            if (pesoBtn) pesoBtn.addEventListener('click', () => { currentProductMetric = 'peso'; pesoBtn.classList.add('active'); faturamentoBtn.classList.remove('active'); updateDashboard(); });

            // --- Innovations View Filters ---
            const updateInnovations = () => {
                markDirty('inovacoes');
                updateInnovationsMonthView();
            };

            innovationsMonthCategoryFilter.addEventListener('change', updateInnovations);

            const debouncedUpdateInnovationsMonth = debounce(updateInnovations, 400);

            const debouncedInnovationsCityUpdate = debounce(() => {
                const cityDataSource = getInnovationsMonthFilteredData({ excludeFilter: 'city' }).clients;
                innovationsMonthCitySuggestions.classList.remove('manual-hide');
                updateCitySuggestions(innovationsMonthCityFilter, innovationsMonthCitySuggestions, cityDataSource);
            }, 300);

            innovationsMonthCityFilter.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[0-9]/g, '');
                debouncedInnovationsCityUpdate();
            });
            innovationsMonthCityFilter.addEventListener('focus', () => {
                const cityDataSource = getInnovationsMonthFilteredData({ excludeFilter: 'city' }).clients;
                innovationsMonthCitySuggestions.classList.remove('manual-hide');
                updateCitySuggestions(innovationsMonthCityFilter, innovationsMonthCitySuggestions, cityDataSource);
            });
            innovationsMonthCityFilter.addEventListener('blur', () => setTimeout(() => innovationsMonthCitySuggestions.classList.add('hidden'), 150));
            innovationsMonthCityFilter.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    innovationsMonthCitySuggestions.classList.add('hidden', 'manual-hide');
                    debouncedUpdateInnovationsMonth();
                    e.target.blur();
                }
            });
            innovationsMonthCitySuggestions.addEventListener('click', (e) => {
                if (e.target.tagName === 'DIV') {
                    innovationsMonthCityFilter.value = e.target.textContent;
                    innovationsMonthCitySuggestions.classList.add('hidden');
                    debouncedUpdateInnovationsMonth();
                }
            });

            innovationsMonthFilialFilter.addEventListener('change', debouncedUpdateInnovationsMonth);
            clearInnovationsMonthFiltersBtn.addEventListener('click', () => { resetInnovationsMonthFilters(); markDirty('inovacoes'); });

            setupFab('innovations-fab-container',
                exportInnovationsMonthPDF,
                () => {
                    exportToExcel({'Inovacoes': innovationsMonthTableDataForExport}, 'Inovacoes_Mes');
                }
            );

            innovationsMonthTipoVendaFilterBtn.addEventListener('click', () => innovationsMonthTipoVendaFilterDropdown.classList.toggle('hidden'));
            innovationsMonthTipoVendaFilterDropdown.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox') {
                    const { value, checked } = e.target;
                    if (checked) {
                        if (!selectedInnovationsMonthTiposVenda.includes(value)) selectedInnovationsMonthTiposVenda.push(value);
                    } else {
                        selectedInnovationsMonthTiposVenda = selectedInnovationsMonthTiposVenda.filter(s => s !== value);
                    }
                    selectedInnovationsMonthTiposVenda = updateTipoVendaFilter(innovationsMonthTipoVendaFilterDropdown, innovationsMonthTipoVendaFilterText, selectedInnovationsMonthTiposVenda, [...allSalesData, ...allHistoryData]);
                    debouncedUpdateInnovationsMonth();
                }
            });


            setupFab('coverage-fab-container',
                exportCoveragePDF,
                () => {
                    exportToExcel({'Cobertura': coverageTableDataForExport}, 'Cobertura');
                }
            );

            const coverageChartToggleBtn = document.getElementById('coverage-chart-toggle-btn');
            if (coverageChartToggleBtn) {
                coverageChartToggleBtn.addEventListener('click', () => {
                    currentCoverageChartMode = currentCoverageChartMode === 'city' ? 'seller' : 'city';
                    updateCoverageView();
                });
            }

            // --- Mix View Event Listeners ---
            // --- Goals View Event Listeners ---
            const updateGoals = () => {
                markDirty('goals');
                handleGoalsFilterChange();
            };

            document.addEventListener('goalsCleared', () => {
                updateGoals();
            });

            const debouncedUpdateGoals = debounce(updateGoals, 400);

            async function loadGoalsFromSupabase() {
                try {
                    const monthKey = new Date().toISOString().slice(0, 7);
                    const { data, error } = await window.supabaseClient
                        .from('goals_distribution')
                        .select('goals_data')
                        .eq('month_key', monthKey)
                        .eq('supplier', 'ALL')
                        .eq('brand', 'GENERAL')
                        .maybeSingle();

                    if (error) {
                        console.error('Erro ao carregar metas:', error);
                        return;
                    }

                    if (data && data.goals_data) {
                        const gd = data.goals_data;
                        let clientsData = {};
                        let targetsData = {};

                        if (gd.clients || gd.targets) {
                            clientsData = gd.clients || {};
                            targetsData = gd.targets || {};
                        } else {
                            clientsData = gd;
                        }

                        globalClientGoals = new Map();
                        for (const [key, val] of Object.entries(clientsData)) {
                            const clientMap = new Map();
                            for (const [k, v] of Object.entries(val)) {
                                clientMap.set(k, v);
                            }
                            globalClientGoals.set(key, clientMap);
                        }

                        // --- RE-AGGREGATE TOTALS (Fix for Dashboard 0 issue) ---
                        for (const [clientId, clientMap] of globalClientGoals) {
                            const getGoal = (k) => clientMap.get(k) || { fat: 0, vol: 0 };

                            const g707 = getGoal(window.SUPPLIER_CODES.ELMA[0]);
                            const g708 = getGoal(window.SUPPLIER_CODES.ELMA[1]);
                            const g752 = getGoal(window.SUPPLIER_CODES.ELMA[2]);
                            const gToddynho = getGoal(window.SUPPLIER_CODES.VIRTUAL.TODDYNHO);
                            const gToddy = getGoal(window.SUPPLIER_CODES.VIRTUAL.TODDY);
                            const gQuaker = getGoal(window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO);

                            const sumGoals = (list) => {
                                return list.reduce((acc, curr) => ({
                                    fat: acc.fat + (curr.fat || 0),
                                    vol: acc.vol + (curr.vol || 0)
                                }), { fat: 0, vol: 0 });
                            };

                            const elmaAll = sumGoals([g707, g708, g752]);
                            const foodsAll = sumGoals([gToddynho, gToddy, gQuaker]);
                            const pepsicoAll = sumGoals([g707, g708, g752, gToddynho, gToddy, gQuaker]);

                            clientMap.set('ELMA_ALL', elmaAll);
                            clientMap.set('FOODS_ALL', foodsAll);
                            clientMap.set('PEPSICO_ALL', pepsicoAll);
                        }
                        // --------------------------------------------------------

                        window.globalClientGoals = globalClientGoals;

                        if (targetsData && Object.keys(targetsData).length > 0) {
                            for (const key in targetsData) {
                                goalsTargets[key] = targetsData[key];
                            }
                        }

                        if (gd.seller_targets) {
                            goalsSellerTargets.clear();
                            for (const [seller, targets] of Object.entries(gd.seller_targets)) {
                                goalsSellerTargets.set(seller, targets);
                            }
                        }

                        console.log('Metas carregadas do Supabase.');
                        updateGoals();
                        // Se o painel estiver ativo e as metas chegarem, precisamos atualizar o gráfico de Performance
                        if (typeof currentActiveView !== 'undefined' && currentActiveView === 'dashboard') {
                            updateDashboard();
                        }
                    }
                } catch (err) {
                    console.error('Exceção ao carregar metas:', err);
                }
            }

            // Trigger Load
            loadGoalsFromSupabase();

            // Sub-tabs Switching
            const goalsSubTabsContainer = document.getElementById('goals-sub-tabs-container');
            if (goalsSubTabsContainer) {
                goalsSubTabsContainer.addEventListener('click', (e) => {
                    const btn = e.target.closest('.goals-sub-tab');
                    if (!btn) return;

                    // Ensure metrics are ready
                    if (Object.keys(globalGoalsMetrics).length === 0) {
                        calculateGoalsMetrics();
                    }

                    // Remove active styles from ALL sub-tabs across both groups
                    document.querySelectorAll('.goals-sub-tab').forEach(b => {
                        b.classList.remove('active', 'text-teal-400', 'font-bold', 'border-b-2', 'border-teal-400');
                        b.classList.add('text-slate-400', 'font-medium');
                        const indicator = b.querySelector('.indicator');
                        if (indicator) indicator.remove();
                    });

                    btn.classList.remove('text-slate-400', 'font-medium');
                    btn.classList.add('active', 'text-teal-400', 'font-bold', 'border-b-2', 'border-teal-400');

                    const indicator = document.createElement('span');
                    indicator.className = 'w-2 h-2 rounded-full bg-teal-400 inline-block indicator mr-2';
                    btn.prepend(indicator);

                    currentGoalsSupplier = btn.dataset.supplier;
                    currentGoalsBrand = btn.dataset.brand || null;

                    const cacheKey = currentGoalsSupplier + (currentGoalsBrand ? `_${currentGoalsBrand}` : '');

                    // --- Update Metrics Display and Pre-fill Inputs ---
                    const metrics = globalGoalsMetrics[cacheKey];

                    if (!goalsTargets[cacheKey]) {
                        goalsTargets[cacheKey] = { fat: 0, vol: 0 };
                    }
                    const target = goalsTargets[cacheKey];

                    if (metrics) {
                        // PRE-FILL logic: If target is 0 (uninitialized), use Previous Month values as default suggestion
                        if (target.fat === 0) target.fat = metrics.prevFat;
                        if (target.vol === 0) target.vol = metrics.prevVol;
                    }

                    // Update Input Fields
                    const fatInput = document.getElementById('goal-global-fat');
                    const volInput = document.getElementById('goal-global-vol');

                    if (fatInput) fatInput.value = target.fat.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    if (volInput) volInput.value = target.vol.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                    // ----------------------------------------------------------

                    goalsTableState.currentPage = 1;
                    updateGoals();
                });
            }

            // Category Toggle Logic
            const btnPepsico = document.getElementById('goals-category-pepsico-btn');
            const btnElmaChips = document.getElementById('goals-category-elmachips-btn');
            const btnFoods = document.getElementById('goals-category-foods-btn');
            const btnSummary = document.getElementById('goals-category-summary-btn');
            const subTabsPepsico = document.getElementById('goals-sub-tabs-pepsico');
            const subTabsElmaChips = document.getElementById('goals-sub-tabs-elmachips');
            const subTabsFoods = document.getElementById('goals-sub-tabs-foods');

            // Containers
            const goalsMainContainer = document.getElementById('goals-input-cards');
            const goalsTableContainer = document.getElementById('goals-table-container'); // Main table wrapper
            const goalsFiltersContainer = document.querySelector('#goals-gv-content > div.mb-4'); // Filters wrapper
            const goalsSummaryContainer = document.getElementById('goals-summary-content');

            // Filter Wrappers
            const wrapperCodCli = document.getElementById('goals-gv-codcli-filter-wrapper');

            const toggleGoalsView = (view) => {
                // Reset Buttons
                [btnPepsico, btnElmaChips, btnFoods, btnSummary].forEach(btn => {
                    if (btn) {
                        btn.classList.remove('bg-[#0d9488]', 'text-white', 'shadow-lg', 'border-teal-500/50');
                        btn.classList.add('bg-[#334155]', 'text-slate-400', 'border-slate-700');
                    }
                });

                // Hide All Sub-tabs
                if(subTabsPepsico) subTabsPepsico.classList.add('hidden');
                if(subTabsElmaChips) subTabsElmaChips.classList.add('hidden');
                if(subTabsFoods) subTabsFoods.classList.add('hidden');

                // Toggle Content
                if (view === 'summary') {
                    if(btnSummary) {
                        btnSummary.classList.remove('bg-[#334155]', 'text-slate-400', 'border-slate-700');
                        btnSummary.classList.add('bg-[#0d9488]', 'text-white', 'shadow-lg', 'border-teal-500/50');
                    }
                    if(goalsSummaryContainer) goalsSummaryContainer.classList.remove('hidden');
                    if(goalsMainContainer) goalsMainContainer.classList.add('hidden');
                    if(goalsTableContainer) goalsTableContainer.classList.add('hidden');

                    // HIDE Main Filters Container completely
                    if(goalsFiltersContainer) goalsFiltersContainer.classList.add('hidden');

                    // Ensure Summary Filters are initialized/visible (they are inside summary container)
                    updateGoalsSummaryView();
                } else {
                    // Show Main Content
                    if(goalsSummaryContainer) goalsSummaryContainer.classList.add('hidden');
                    if(goalsMainContainer) goalsMainContainer.classList.remove('hidden');
                    if(goalsTableContainer) goalsTableContainer.classList.remove('hidden');

                    // SHOW Main Filters Container and all wrappers
                    if(goalsFiltersContainer) goalsFiltersContainer.classList.remove('hidden');
                    if(wrapperCodCli) wrapperCodCli.classList.remove('hidden');

                    if (view === 'pepsico') {
                        if(btnPepsico) {
                            btnPepsico.classList.remove('bg-[#334155]', 'text-slate-400', 'border-slate-700');
                            btnPepsico.classList.add('bg-[#0d9488]', 'text-white', 'shadow-lg', 'border-teal-500/50');
                        }
                        if(subTabsPepsico) subTabsPepsico.classList.remove('hidden');
                        const firstTab = subTabsPepsico.querySelector('.goals-sub-tab');
                        if (firstTab) firstTab.click();
                    } else if (view === 'elmachips') {
                        if(btnElmaChips) {
                            btnElmaChips.classList.remove('bg-[#334155]', 'text-slate-400', 'border-slate-700');
                            btnElmaChips.classList.add('bg-[#0d9488]', 'text-white', 'shadow-lg', 'border-teal-500/50');
                        }
                        if(subTabsElmaChips) subTabsElmaChips.classList.remove('hidden');

                        // Select First Tab of Elma Chips
                        const firstTab = subTabsElmaChips.querySelector('.goals-sub-tab');
                        if (firstTab) firstTab.click();
                    } else if (view === 'foods') {
                        if(btnFoods) {
                            btnFoods.classList.remove('bg-[#334155]', 'text-slate-400', 'border-slate-700');
                            btnFoods.classList.add('bg-[#0d9488]', 'text-white', 'shadow-lg', 'border-teal-500/50');
                        }
                        if(subTabsFoods) subTabsFoods.classList.remove('hidden');

                        // Select First Tab of Foods
                        const firstTab = subTabsFoods.querySelector('.goals-sub-tab');
                        if (firstTab) firstTab.click();
                    }
                }
            };

            if (btnPepsico && btnElmaChips && btnFoods && btnSummary) {
                btnPepsico.addEventListener('click', () => toggleGoalsView('pepsico'));
                btnElmaChips.addEventListener('click', () => toggleGoalsView('elmachips'));
                btnFoods.addEventListener('click', () => toggleGoalsView('foods'));
                btnSummary.addEventListener('click', () => toggleGoalsView('summary'));
            }

            // Tab Switching
            document.getElementById('goals-tabs').addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    const tab = e.target.dataset.tab;
                    document.querySelectorAll('#goals-tabs button').forEach(btn => {
                        btn.classList.remove('border-teal-500', 'text-teal-500', 'active');
                        btn.classList.add('border-transparent', 'hover:text-slate-300', 'hover:border-slate-300', 'text-slate-400');
                    });
                    e.target.classList.remove('border-transparent', 'hover:text-slate-300', 'hover:border-slate-300', 'text-slate-400');
                    e.target.classList.add('border-teal-500', 'text-teal-500', 'active');

                    if (tab === 'gv') {
                        goalsGvContent.classList.remove('hidden');
                        goalsSvContent.classList.add('hidden');
                        updateGoals(); // Refresh GV view
                    } else if (tab === 'sv') {
                        goalsGvContent.classList.add('hidden');
                        goalsSvContent.classList.remove('hidden');
                        // But we want to refresh data
                        updateGoalsSvView();
                    }
                }
            });

            // SV Sub-tabs Logic and Toggle Logic REMOVED (Replaced by Single Table View)

            // GV Filters
            const clearGoalsSummaryFiltersBtn = document.getElementById('clear-goals-summary-filters-btn');

            const btnDistributeFat = document.getElementById('btn-distribute-fat');
            if (btnDistributeFat) {
                btnDistributeFat.addEventListener('click', () => {
                    const filterDesc = getFilterDescription();
                    const val = document.getElementById('goal-global-fat').value;
                    showConfirmationModal(`Você deseja inserir esta meta de Faturamento (${val}) para: ${filterDesc}?`, () => {
                        distributeGoals('fat');
                    });
                });
            }

            const btnDistributeVol = document.getElementById('btn-distribute-vol');
            if (btnDistributeVol) {
                btnDistributeVol.addEventListener('click', () => {
                    const filterDesc = getFilterDescription();
                    const val = document.getElementById('goal-global-vol').value;
                    showConfirmationModal(`Você deseja inserir esta meta de Volume (${val}) para: ${filterDesc}?`, () => {
                        distributeGoals('vol');
                    });
                });
            }

            const btnDistributeMixSalty = document.getElementById('btn-distribute-mix-salty');
            if (btnDistributeMixSalty) {
                btnDistributeMixSalty.addEventListener('click', () => {
                    if (!sellerName) return;
                    const valStr = document.getElementById('goal-global-mix-salty').value;
                    showConfirmationModal(`Confirmar ajuste de Meta Mix Salty para ${valStr} (Vendedor: ${getFirstName(sellerName)})?`, () => {
                        const val = parseFloat(valStr.replace(/\./g, '').replace(',', '.')) || 0;

                        // Calculate Natural Base again to store Delta
                        // We need the natural base for THIS seller to calculate delta (Input - Natural)
                        // It's cleaner if updateGoalsView handles this logic directly in the listener,
                        // OR we store the natural base somewhere.
                        // For simplicity, let's just trigger a custom event or call a handler that has access to context.
                        // Actually, since we need "Natural" value which varies by filter context, it's safer to handle this
                        // inside updateGoalsView where metrics are available, OR make this listener smart enough.

                        // Let's use the adjustment map directly.
                        // But we don't know the natural value here easily without recalculating.
                        // Solution: The input value IS the target. We want to store the adjustment.
                        // Adjustment = Target - Natural.

                        // Let's implement a specific helper function "saveMixAdjustment" that recalculates natural base for single seller.
                        saveMixAdjustment('salty', val, sellerName);
                    });
                });
            }

            const btnDistributeMixFoods = document.getElementById('btn-distribute-mix-foods');
            if (btnDistributeMixFoods) {
                btnDistributeMixFoods.addEventListener('click', () => {
                    if (!sellerName) return;
                    const valStr = document.getElementById('goal-global-mix-foods').value;
                    showConfirmationModal(`Confirmar ajuste de Meta Mix Foods para ${valStr} (Vendedor: ${getFirstName(sellerName)})?`, () => {
                        const val = parseFloat(valStr.replace(/\./g, '').replace(',', '.')) || 0;
                        saveMixAdjustment('foods', val, sellerName);
                    });
                });
            }

            // Add Input Listeners for Real-time State Updates
            const fatInput = document.getElementById('goal-global-fat');
            const volInput = document.getElementById('goal-global-vol');

            // REMOVED: Automatic update on change/input to prevent overwriting user input before distribution.
            // Values are now read directly from the input when the "Distribute" button is clicked.

            clearGoalsGvFiltersBtn.addEventListener('click', () => { resetGoalsGvFilters(); markDirty('goals'); });

            // SV Filters

            document.getElementById('goals-prev-page-btn').addEventListener('click', () => {
                if (goalsTableState.currentPage > 1) {
                    goalsTableState.currentPage--;
                    updateGoalsView();
                }
            });

            const goalsGvExportPdfBtn = document.getElementById('goals-gv-export-pdf-btn');
            if(goalsGvExportPdfBtn) {
                goalsGvExportPdfBtn.addEventListener('click', exportGoalsGvPDF);
            }

            const goalsGvExportXlsxBtn = document.getElementById('goals-gv-export-xlsx-btn');
            if(goalsGvExportXlsxBtn) {
                goalsGvExportXlsxBtn.addEventListener('click', exportGoalsCurrentTabXLSX);
            }

            const goalsSvExportXlsxBtn = document.getElementById('goals-sv-export-xlsx-btn');
            if(goalsSvExportXlsxBtn) {
                goalsSvExportXlsxBtn.addEventListener('click', exportGoalsSvXLSX);
            }

            document.getElementById('goals-next-page-btn').addEventListener('click', () => {
                if (goalsTableState.currentPage < goalsTableState.totalPages) {
                    goalsTableState.currentPage++;
                    updateGoalsView();
                }
            });

            // --- Meta Vs Realizado Listeners ---
            const updateMetaRealizado = () => {
                markDirty('metaRealizado');
                updateMetaRealizadoView();
            };

            const debouncedUpdateMetaRealizado = debounce(updateMetaRealizado, 400);

            // Supervisor Filter

            // Supplier Filter
            const metaRealizadoSupplierFilterBtn = document.getElementById('meta-realizado-supplier-filter-btn');
            const metaRealizadoSupplierFilterDropdown = document.getElementById('meta-realizado-supplier-filter-dropdown');
            metaRealizadoSupplierFilterBtn.addEventListener('click', () => metaRealizadoSupplierFilterDropdown.classList.toggle('hidden'));
            metaRealizadoSupplierFilterDropdown.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox') {
                    const { value, checked } = e.target;
                    if (checked) {
                        if (!selectedMetaRealizadoSuppliers.includes(value)) selectedMetaRealizadoSuppliers.push(value);
                    } else {
                        selectedMetaRealizadoSuppliers = selectedMetaRealizadoSuppliers.filter(s => s !== value);
                    }
                    selectedMetaRealizadoSuppliers = updateSupplierFilter(metaRealizadoSupplierFilterDropdown, document.getElementById('meta-realizado-supplier-filter-text'), selectedMetaRealizadoSuppliers, metaRealizadoSuppliersSource, 'metaRealizado', true);
                    debouncedUpdateMetaRealizado();
                }
            });

            // Pasta Filter
            const metaRealizadoPastaContainer = document.getElementById('meta-realizado-pasta-toggle-container');
            if (metaRealizadoPastaContainer) {
                metaRealizadoPastaContainer.addEventListener('click', (e) => {
                    if (e.target.tagName === 'BUTTON') {
                        const pasta = e.target.dataset.pasta;

                        // Toggle logic: If clicking active button, deselect (revert to PEPSICO/All).
                        // If clicking inactive, select it.
                        if (currentMetaRealizadoPasta === pasta) {
                            currentMetaRealizadoPasta = 'PEPSICO'; // Revert to default
                        } else {
                            currentMetaRealizadoPasta = pasta;
                        }

                        // Update UI
                        metaRealizadoPastaContainer.querySelectorAll('.pasta-btn').forEach(b => {
                            if (b.dataset.pasta === currentMetaRealizadoPasta) {
                                b.classList.remove('bg-slate-700');
                                b.classList.add('bg-teal-600', 'hover:bg-teal-500'); // Active State
                            } else {
                                b.classList.add('bg-slate-700');
                                b.classList.remove('bg-teal-600', 'hover:bg-teal-500');
                            }
                        });

                        debouncedUpdateMetaRealizado();
                    }
                });

                // Initialize default active button style
                metaRealizadoPastaContainer.querySelectorAll('.pasta-btn').forEach(b => {
                    if (b.dataset.pasta === currentMetaRealizadoPasta) {
                        b.classList.remove('bg-slate-700');
                        b.classList.add('bg-teal-600', 'hover:bg-teal-500');
                    }
                });
            }

            // Toggle Metric Logic
            const metaRealizadoMetricToggleBtn = document.getElementById('metaRealizadoMetricToggleBtn');
            if (metaRealizadoMetricToggleBtn) {
                metaRealizadoMetricToggleBtn.addEventListener('click', () => {
                    if (currentMetaRealizadoMetric === 'valor') {
                        currentMetaRealizadoMetric = 'peso';
                        metaRealizadoMetricToggleBtn.textContent = 'Toneladas';
                        metaRealizadoMetricToggleBtn.classList.remove('active', 'text-white');
                        metaRealizadoMetricToggleBtn.classList.add('text-slate-300'); // Inactive style? No, it's a toggle button.
                        // Better style: keep active but change text? Or standard toggle behavior?
                        // User image shows "R$ / Ton". It implies a switch.
                        // Let's toggle between states.
                    } else {
                        currentMetaRealizadoMetric = 'valor';
                        metaRealizadoMetricToggleBtn.textContent = 'R$ / Ton'; // Or 'Faturamento'? Image says "R$ / Ton" likely meaning the button label is static or toggles?
                        // "gostaria de ter um botão desse da imagem, deve ter a função de alternar entre R$ e Tonelada"
                        // The image shows "R$ / Ton". It might be a label for the button that cycles?
                        // Let's update text to indicate CURRENT state or NEXT state?
                        // Usually toggle buttons indicate current state.
                        // Let's use: "Faturamento (R$)" and "Volume (Ton)" as labels for clarity, or stick to user image.
                        // User image: "R$ / Ton".
                        // Let's assume the button text is static "R$ / Ton" and we just toggle state?
                        // No, usually buttons show what is selected.
                        // Let's change text to "Volume (Ton)" when Ton is selected, and "Faturamento (R$)" when R$ is selected?
                        // Or just keep "R$ / Ton" and toggle a visual indicator?
                        // Let's just update the chart and maybe change button style/text slightly.
                    }

                    // Simple Toggle Text Update
                    metaRealizadoMetricToggleBtn.textContent = currentMetaRealizadoMetric === 'valor' ? 'R$ / Ton' : 'Toneladas';

                    const metaRealizadoChartTitle = document.getElementById('metaRealizadoChartTitle');
                    if (metaRealizadoChartTitle) {
                        metaRealizadoChartTitle.textContent = currentMetaRealizadoMetric === 'valor' ? 'Meta Vs Realizado - Faturamento' : 'Meta Vs Realizado - Tonelada';
                    }

                    updateMetaRealizado();
                });
            }

            // Clear Filters
            document.getElementById('clear-meta-realizado-filters-btn').addEventListener('click', () => {
                selectedMetaRealizadoSuppliers = [];
                currentMetaRealizadoPasta = 'PEPSICO'; // Reset to default

                // Reset UI

                // Reset Supplier UI
                document.getElementById('meta-realizado-supplier-filter-text').textContent = 'Todos';
                metaRealizadoSupplierFilterDropdown.querySelectorAll('input').forEach(cb => cb.checked = false);

                // Reset Pasta UI (Deactivate all, since PEPSICO button is gone)
                metaRealizadoPastaContainer.querySelectorAll('.pasta-btn').forEach(b => {
                    b.classList.add('bg-slate-700');
                    b.classList.remove('bg-teal-600', 'hover:bg-teal-500');
                });

                debouncedUpdateMetaRealizado();
            });

            // Close Dropdowns on Click Outside
            document.addEventListener('click', (e) => {
                if (!metaRealizadoSupplierFilterBtn.contains(e.target) && !metaRealizadoSupplierFilterDropdown.contains(e.target)) metaRealizadoSupplierFilterDropdown.classList.add('hidden');
            });

            // Pagination Listeners for Meta Realizado Clients Table
            document.getElementById('meta-realizado-clients-prev-page-btn').addEventListener('click', () => {
                if (metaRealizadoClientsTableState.currentPage > 1) {
                    metaRealizadoClientsTableState.currentPage--;
                    updateMetaRealizadoView();
                }
            });

            setupFab('meta-realizado-fab-container',
                exportMetaRealizadoPDF,
                () => {
                    // Prepare data for Meta Realizado
                    const sheets = {};
                    if(metaRealizadoDataForExport && metaRealizadoDataForExport.sellers && metaRealizadoDataForExport.sellers.length) sheets['Vendedores'] = metaRealizadoDataForExport.sellers;
                    if(metaRealizadoDataForExport && metaRealizadoDataForExport.clients && metaRealizadoDataForExport.clients.length) sheets['Clientes'] = metaRealizadoDataForExport.clients;
                    exportToExcel(sheets, 'Meta_Realizado');
                }
            );

            document.getElementById('meta-realizado-clients-next-page-btn').addEventListener('click', () => {
                if (metaRealizadoClientsTableState.currentPage < metaRealizadoClientsTableState.totalPages) {
                    metaRealizadoClientsTableState.currentPage++;
                    updateMetaRealizadoView();
                }
            });


            const updateMix = () => {
                markDirty('mix');
                handleMixFilterChange();
            };

            const mixSupervisorBtn = document.getElementById('mix-supervisor-filter-btn');
            if (mixSupervisorBtn) {
                mixSupervisorBtn.addEventListener('click', () => {
                    const dropdown = document.getElementById('mix-supervisor-filter-dropdown');
                    if(dropdown) dropdown.classList.toggle('hidden');
                });
            }

            const mixTipoVendaBtn = document.getElementById('mix-tipo-venda-filter-btn');
            if (mixTipoVendaBtn) {
                mixTipoVendaBtn.addEventListener('click', (e) => {
                    const dd = document.getElementById('mix-tipo-venda-filter-dropdown');
                    if (dd) dd.classList.toggle('hidden');
                });
            }

            const mixTipoVendaDropdown = document.getElementById('mix-tipo-venda-filter-dropdown');
            if (mixTipoVendaDropdown) {
                mixTipoVendaDropdown.addEventListener('change', (e) => {
                    if (e.target.type === 'checkbox') {
                        const { value, checked } = e.target;
                        if (checked) selectedMixTiposVenda.push(value);
                        else selectedMixTiposVenda = selectedMixTiposVenda.filter(s => s !== value);
                        handleMixFilterChange({ skipFilter: 'tipoVenda' });
                        markDirty('mix');
                    }
                });
            }

            const mixFilialFilter = document.getElementById('mix-filial-filter');
            if (mixFilialFilter) mixFilialFilter.addEventListener('change', updateMix);

            const mixCityFilter = document.getElementById('mix-city-filter');
            const mixCitySuggestions = document.getElementById('mix-city-suggestions');

            if (mixCityFilter && mixCitySuggestions) {
                const debouncedMixCityUpdate = debounce(() => {
                    const { clients } = getMixFilteredData({ excludeFilter: 'city' });
                    mixCitySuggestions.classList.remove('manual-hide');
                    updateCitySuggestions(mixCityFilter, mixCitySuggestions, clients);
                }, 300);

                mixCityFilter.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/[0-9]/g, '');
                    debouncedMixCityUpdate();
                });
                mixCityFilter.addEventListener('focus', () => {
                    const { clients } = getMixFilteredData({ excludeFilter: 'city' });
                    mixCitySuggestions.classList.remove('manual-hide');
                    updateCitySuggestions(mixCityFilter, mixCitySuggestions, clients);
                });
                mixCityFilter.addEventListener('blur', () => setTimeout(() => mixCitySuggestions.classList.add('hidden'), 150));
                mixCityFilter.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        mixCitySuggestions.classList.add('hidden', 'manual-hide');
                        updateMix();
                        e.target.blur();
                    }
                });
                mixCitySuggestions.addEventListener('click', (e) => {
                    if (e.target.tagName === 'DIV') {
                        mixCityFilter.value = e.target.textContent;
                        mixCitySuggestions.classList.add('hidden');
                        updateMix();
                    }
                });
            }

            const mixComRedeBtn = document.getElementById('mix-com-rede-btn');
            if (mixComRedeBtn) {
                mixComRedeBtn.addEventListener('click', () => {
                    const dd = document.getElementById('mix-rede-filter-dropdown');
                    if (dd) dd.classList.toggle('hidden');
                });
            }

            const mixRedeGroupContainer = document.getElementById('mix-rede-group-container');
            if (mixRedeGroupContainer) {
                mixRedeGroupContainer.addEventListener('click', (e) => {
                    if(e.target.closest('button')) {
                        const button = e.target.closest('button');
                        mixRedeGroupFilter = button.dataset.group;
                        document.getElementById('mix-rede-group-container').querySelectorAll('button').forEach(b => b.classList.remove('active'));
                        button.classList.add('active');
                        if (mixRedeGroupFilter !== 'com_rede') {
                            const dd = document.getElementById('mix-rede-filter-dropdown');
                            if (dd) dd.classList.add('hidden');
                            selectedMixRedes = [];
                        }
                        handleMixFilterChange();
                    }
                });
            }

            const mixRedeFilterDropdown = document.getElementById('mix-rede-filter-dropdown');
            if (mixRedeFilterDropdown) {
                mixRedeFilterDropdown.addEventListener('change', (e) => {
                    if (e.target.type === 'checkbox') {
                        const { value, checked } = e.target;
                        if (checked) selectedMixRedes.push(value);
                        else selectedMixRedes = selectedMixRedes.filter(r => r !== value);

                        mixRedeGroupFilter = 'com_rede';
                        const container = document.getElementById('mix-rede-group-container');
                        if (container) container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                        const btn = document.getElementById('mix-com-rede-btn');
                        if (btn) btn.classList.add('active');

                        handleMixFilterChange({ skipFilter: 'rede' });
                    }
                });
            }

            const clearMixFiltersBtn = document.getElementById('clear-mix-filters-btn');
            if (clearMixFiltersBtn) clearMixFiltersBtn.addEventListener('click', () => { resetMixFilters(); markDirty('mix'); });

            setupFab('mix-fab-container',
                exportMixPDF,
                () => {
                    exportToExcel({'Mix': mixTableDataForExport}, 'Analise_Mix');
                }
            );

            const mixKpiToggle = document.getElementById('mix-kpi-toggle');
            if (mixKpiToggle) {
                mixKpiToggle.addEventListener('change', (e) => {
                    mixKpiMode = e.target.checked ? 'atendidos' : 'total';
                    markDirty('mix');
                    updateMixView();
                });
            }

            const mixPrevPageBtn = document.getElementById('mix-prev-page-btn');
            if (mixPrevPageBtn) {
                mixPrevPageBtn.addEventListener('click', () => {
                    if (mixTableState.currentPage > 1) {
                        mixTableState.currentPage--;
                        updateMixView();
                    }
                });
            }

            const mixNextPageBtn = document.getElementById('mix-next-page-btn');
            if (mixNextPageBtn) {
                mixNextPageBtn.addEventListener('click', () => {
                    if (mixTableState.currentPage < mixTableState.totalPages) {
                        mixTableState.currentPage++;
                        updateMixView();
                    }
                });
            }

            document.addEventListener('click', (e) => {
                // Close Mix Dropdowns
                const safeClose = (btnId, ddId) => {
                    const btn = document.getElementById(btnId);
                    const dd = document.getElementById(ddId);
                    if (btn && dd && !btn.contains(e.target) && !dd.contains(e.target)) {
                        dd.classList.add('hidden');
                    }
                };

                safeClose('mix-supervisor-filter-btn', 'mix-supervisor-filter-dropdown');
                safeClose('mix-vendedor-filter-btn', 'mix-vendedor-filter-dropdown');
                safeClose('mix-tipo-venda-filter-btn', 'mix-tipo-venda-filter-dropdown');
                safeClose('mix-com-rede-btn', 'mix-rede-filter-dropdown');
            });

            // --- Coverage View Filters ---
            const updateCoverage = () => {
                markDirty('cobertura');
                handleCoverageFilterChange();
            };

            const debouncedHandleCoverageChange = debounce(updateCoverage, 400);

            coverageFilialFilter.addEventListener('change', updateCoverage);

            const debouncedCoverageCityUpdate = debounce(() => {
                const { clients } = getCoverageFilteredData({ excludeFilter: 'city' });
                coverageCitySuggestions.classList.remove('manual-hide');
                updateCitySuggestions(coverageCityFilter, coverageCitySuggestions, clients);
            }, 300);

            if (coverageCityFilter) coverageCityFilter.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[0-9]/g, '');
                debouncedCoverageCityUpdate();
            });
            coverageCityFilter.addEventListener('focus', () => {
                const { clients } = getCoverageFilteredData({ excludeFilter: 'city' });
                coverageCitySuggestions.classList.remove('manual-hide');
                updateCitySuggestions(coverageCityFilter, coverageCitySuggestions, clients);
            });
            coverageCityFilter.addEventListener('blur', () => setTimeout(() => coverageCitySuggestions.classList.add('hidden'), 150));
            coverageCityFilter.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    coverageCitySuggestions.classList.add('hidden', 'manual-hide');
                    updateCoverage();
                    e.target.blur();
                }
            });
            coverageCitySuggestions.addEventListener('click', (e) => {
                if (e.target.tagName === 'DIV') {
                    coverageCityFilter.value = e.target.textContent;
                    coverageCitySuggestions.classList.add('hidden');
                    updateCoverage();
                }
            });

            coverageTipoVendaFilterBtn.addEventListener('click', () => coverageTipoVendaFilterDropdown.classList.toggle('hidden'));
            coverageTipoVendaFilterDropdown.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox') {
                    const { value, checked } = e.target;
                    if (checked) {
                        if (!selectedCoverageTiposVenda.includes(value)) selectedCoverageTiposVenda.push(value);
                    } else {
                        selectedCoverageTiposVenda = selectedCoverageTiposVenda.filter(s => s !== value);
                    }
                    updateCoverage();
                }
            });

            clearCoverageFiltersBtn.addEventListener('click', () => { resetCoverageFilters(); markDirty('cobertura'); });

            coverageSupplierFilterBtn.addEventListener('click', () => coverageSupplierFilterDropdown.classList.toggle('hidden'));
            coverageSupplierFilterDropdown.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox' && e.target.dataset.filterType === 'coverage') {
                    const { value, checked } = e.target;
                    if (checked) {
                        if (!selectedCoverageSuppliers.includes(value)) selectedCoverageSuppliers.push(value);
                    } else {
                        selectedCoverageSuppliers = selectedCoverageSuppliers.filter(s => s !== value);
                    }

                    markDirty('cobertura');
                    handleCoverageFilterChange({ skipFilter: 'supplier' });
                }
            });

            coverageProductFilterBtn.addEventListener('click', () => {
                const { sales, history } = getCoverageFilteredData({ excludeFilter: 'product' });
                selectedCoverageProducts = updateProductFilter(coverageProductFilterDropdown, coverageProductFilterText, selectedCoverageProducts, [...sales, ...history], 'coverage');
                coverageProductFilterDropdown.classList.toggle('hidden');
            });

            const debouncedCoverageProductUpdate = debounce(() => {
                 const { sales, history } = getCoverageFilteredData({ excludeFilter: 'product' });
                 selectedCoverageProducts = updateProductFilter(coverageProductFilterDropdown, coverageProductFilterText, selectedCoverageProducts, [...sales, ...history], 'coverage');
            }, 250);

            coverageProductFilterDropdown.addEventListener('input', (e) => {
                if (e.target.id === 'coverage-product-search-input') {
                    debouncedCoverageProductUpdate();
                }
            });

            coverageProductFilterDropdown.addEventListener('change', (e) => {
                if (e.target.dataset.filterType === 'coverage' && handleProductFilterChange(e, selectedCoverageProducts)) {
                    markDirty('cobertura');
                    handleCoverageFilterChange({ skipFilter: 'product' });
                }
            });

            const coverageUnitPriceInput = document.getElementById('coverage-unit-price-filter');
            if (coverageUnitPriceInput) {
                coverageUnitPriceInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        updateCoverage();
                        e.target.blur();
                    }
                });
                coverageUnitPriceInput.addEventListener('blur', updateCoverage);
            }


            document.addEventListener('click', (e) => {
                if (!innovationsMonthTipoVendaFilterBtn.contains(e.target) && !innovationsMonthTipoVendaFilterDropdown.contains(e.target)) innovationsMonthTipoVendaFilterDropdown.classList.add('hidden');
                if (!coverageSupplierFilterBtn.contains(e.target) && !coverageSupplierFilterDropdown.contains(e.target)) coverageSupplierFilterDropdown.classList.add('hidden');
                if (!coverageProductFilterBtn.contains(e.target) && !coverageProductFilterDropdown.contains(e.target)) coverageProductFilterDropdown.classList.add('hidden');
                if (!coverageTipoVendaFilterBtn.contains(e.target) && !coverageTipoVendaFilterDropdown.contains(e.target)) coverageTipoVendaFilterDropdown.classList.add('hidden');
            });

        }

        initializeOptimizedDataStructures();

        // --- USER CONTEXT RESOLUTION ---
        let userHierarchyContext = { role: 'adm', coord: null, cocoord: null, promotor: null };

        function applyHierarchyVisibilityRules() {
            const role = (userHierarchyContext.role || '').toLowerCase();
            // Views to apply logic to (excluding 'goals' and 'wallet' as requested)
            const views = ['main', 'city', 'comparison', 'innovations-month', 'mix', 'coverage'];

            views.forEach(prefix => {
                const coordWrapper = document.getElementById(`${prefix}-coord-filter-wrapper`);
                const cocoordWrapper = document.getElementById(`${prefix}-cocoord-filter-wrapper`);
                const promotorWrapper = document.getElementById(`${prefix}-promotor-filter-wrapper`);

                // Reset visibility first (Show All)
                if (coordWrapper) coordWrapper.classList.remove('hidden');
                if (cocoordWrapper) cocoordWrapper.classList.remove('hidden');
                if (promotorWrapper) promotorWrapper.classList.remove('hidden');

                if (role === 'adm') {
                    // Show all
                } else if (role === 'coord') {
                    // Hide Coord filter
                    if (coordWrapper) coordWrapper.classList.add('hidden');
                } else if (role === 'cocoord') {
                    // Hide Coord and CoCoord
                    if (coordWrapper) coordWrapper.classList.add('hidden');
                    if (cocoordWrapper) cocoordWrapper.classList.add('hidden');
                } else if (role === 'promotor') {
                    // Hide All
                    if (coordWrapper) coordWrapper.classList.add('hidden');
                    if (cocoordWrapper) cocoordWrapper.classList.add('hidden');
                    if (promotorWrapper) promotorWrapper.classList.add('hidden');
                }
            });
        }

        function resolveUserContext() {
            // PRIORITY 1: Explicit Data-Driven Roles (Supervisor/Seller)
            if (window.userIsSupervisor) {
                userHierarchyContext.role = 'supervisor';
                userHierarchyContext.supervisor = window.userSupervisorCode;
                return;
            }
            if (window.userIsSeller) {
                userHierarchyContext.role = 'seller';
                userHierarchyContext.seller = window.userSellerCode;
                return;
            }

            const role = (window.userRole || '').trim().toUpperCase();

            if (role === 'ADM' || role === 'ADMIN') {
                userHierarchyContext.role = 'adm';
                return;
            }

            // Check if Role is a Coordinator
            if (optimizedData.coordMap.has(role)) {
                userHierarchyContext.role = 'coord';
                userHierarchyContext.coord = role;
                return;
            }

            // Check if Role is a Co-Coordinator
            if (optimizedData.cocoordMap.has(role)) {
                userHierarchyContext.role = 'cocoord';
                userHierarchyContext.cocoord = role;
                userHierarchyContext.coord = optimizedData.coordsByCocoord.get(role);
                return;
            }

            // Check if Role is a Promotor
            if (optimizedData.promotorMap.has(role)) {
                userHierarchyContext.role = 'promotor';
                userHierarchyContext.promotor = role;
                const node = optimizedData.hierarchyMap.get(role);
                if (node) {
                    userHierarchyContext.cocoord = node.cocoord.code;
                    userHierarchyContext.coord = node.coord.code;
                }
                return;
            }

            // Fallback: Default to ADM (UI allows all, but Data is filtered by init.js)
            userHierarchyContext.role = 'adm';
            console.warn(`[DEBUG] Role '${role}' not found in Hierarchy Maps. Defaulting to ADM context (Data filtered by Init).`);
            console.log("Available Coords:", Array.from(optimizedData.coordMap.keys()));
        }
        resolveUserContext();
        applyHierarchyVisibilityRules();

        calculateHistoricalBests(); // <-- MOVIDA PARA CIMA
        // Initialize Hierarchy Filters
        setupHierarchyFilters('main', updateDashboard);
        setupHierarchyFilters('city', updateCityView);
        setupHierarchyFilters('comparison', updateComparisonView);
        setupHierarchyFilters('innovations-month', updateInnovationsMonthView);
        setupHierarchyFilters('mix', updateMixView);
        setupHierarchyFilters('meta-realizado', updateMetaRealizadoView);
        setupHierarchyFilters('coverage', updateCoverageView);
        setupHierarchyFilters('goals-gv', updateGoalsView);
        setupHierarchyFilters('goals-summary', updateGoalsSummaryView);
        setupHierarchyFilters('goals-sv', updateGoalsSvView);

        // Initialize Other Filters
        selectedMainSuppliers = updateSupplierFilter(document.getElementById('fornecedor-filter-dropdown'), document.getElementById('fornecedor-filter-text'), selectedMainSuppliers, [...allSalesData, ...allHistoryData], 'main');
        updateTipoVendaFilter(tipoVendaFilterDropdown, tipoVendaFilterText, selectedTiposVenda, allSalesData);

        updateRedeFilter(mainRedeFilterDropdown, mainComRedeBtnText, selectedMainRedes, allClientsData);
        updateRedeFilter(cityRedeFilterDropdown, cityComRedeBtnText, selectedCityRedes, allClientsData);
        updateRedeFilter(comparisonRedeFilterDropdown, comparisonComRedeBtnText, selectedComparisonRedes, allClientsData);

        // Fix: Pre-filter Suppliers for Meta Realizado (Only PEPSICO)
        const metaRealizadoSuppliersSource = [...allSalesData, ...allHistoryData].filter(s => {
            const rowPasta = resolveSupplierPasta(s.OBSERVACAOFOR, s.FORNECEDOR);
            return rowPasta === SUPPLIER_CONFIG.metaRealizado.requiredPasta;
        });
        selectedMetaRealizadoSuppliers = updateSupplierFilter(document.getElementById('meta-realizado-supplier-filter-dropdown'), document.getElementById('meta-realizado-supplier-filter-text'), selectedMetaRealizadoSuppliers, metaRealizadoSuppliersSource, 'metaRealizado');

        updateAllComparisonFilters();


        initializeRedeFilters();
        setupEventListeners();
        initFloatingFilters();

        // Assegura que os dados históricos estão prontos antes da primeira renderização
        calculateHistoricalBests();

        // --- Initialization for Goals Metrics ---
        calculateGoalsMetrics();
        // Initialize Targets with Defaults (Pre-fill)
        for (const key in globalGoalsMetrics) {
            if (!goalsTargets[key]) {
                goalsTargets[key] = { fat: 0, vol: 0 };
            }
            if (globalGoalsMetrics[key]) {
                goalsTargets[key].fat = globalGoalsMetrics[key].prevFat;
                goalsTargets[key].vol = globalGoalsMetrics[key].prevVol;
            }
        }
        // Initialize Inputs and Refs for Default Tab (ELMA_ALL)
        const defGoalsMetric = globalGoalsMetrics['ELMA_ALL'];
        if (defGoalsMetric) {
            const fi = document.getElementById('goal-global-fat');
            const vi = document.getElementById('goal-global-vol');
            if (fi) fi.value = defGoalsMetric.prevFat.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            if (vi) vi.value = defGoalsMetric.prevVol.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

            const refAvgFat = document.getElementById('ref-avg-fat');
            const refPrevFat = document.getElementById('ref-prev-fat');
            const refAvgVol = document.getElementById('ref-avg-vol');
            const refPrevVol = document.getElementById('ref-prev-vol');
            const refAvgClients = document.getElementById('ref-avg-clients');
            const refPrevClients = document.getElementById('ref-prev-clients');
        }
        // ----------------------------------------

        window.addEventListener('hashchange', () => {
            const view = window.location.hash.substring(1) || 'dashboard';
            renderView(view);
        });

        const urlParams = new URLSearchParams(window.location.search);
        const targetParam = urlParams.get('ir_para');
        const hash = window.location.hash.substring(1);
        const targetPage = hash || targetParam || 'dashboard';

        if (window.location.hash.substring(1) === targetPage) {
            renderView(targetPage);
        } else {
            window.location.hash = targetPage;
        }

        // Helper to redistribute weekly goals
        function calculateAdjustedWeeklyGoals(totalGoal, realizedByWeek, weeks) {
            let adjustedGoals = new Array(weeks.length).fill(0);
            let remainingWorkingDays = 0;
            let pastDifference = 0;
            let totalWorkingDays = weeks.reduce((sum, w) => sum + w.workingDays, 0);
            if (totalWorkingDays === 0) totalWorkingDays = 1;

            const currentDate = lastSaleDate; // Global context

            // 1. First Pass: Identify Past Weeks and Calculate Initial Diff
            weeks.forEach((week, i) => {
                // Determine if week is fully past
                // A week is "past" if its END date is strictly BEFORE the currentDate (ignoring time)
                // Logic: "Check if first week passed... then redistribute difference".
                // If we are IN week 2, week 1 is past.
                // Assuming lastSaleDate represents "today".

                const isPast = week.end < currentDate;
                const dailyGoal = totalGoal / totalWorkingDays;
                let originalWeekGoal = dailyGoal * week.workingDays;

                if (isPast) {
                    // Week is closed.
                    // User Requirement: "case in the first week the goal that was 40k wasn't hit (realized 30k), the 10k missing must be reassigned"
                    //
                    // Implementation:
                    // 1. Past Weeks: Display Original Goal (to show variance/failure).
                    // 2. Future Weeks: Display Adjusted Goal (Original + Share of Deficit).
                    //
                    // Mathematical Note:
                    // Because we display Original Goal for past weeks (instead of Realized), the sum of displayed goals
                    // will NOT equal the Total Monthly Goal if there is any deficit/surplus.
                    // Sum(Displayed) = Total Goal + (Original Past - Realized Past).
                    //
                    // However, the Dynamic Planning Invariant holds:
                    // Realized Past + Future Adjusted Goals = Total Monthly Goal.
                    // This ensures the seller knows exactly what is needed in future weeks to hit the contract target.

                    adjustedGoals[i] = originalWeekGoal;
                    const realized = realizedByWeek[i] || 0;
                    pastDifference += (originalWeekGoal - realized); // Positive if deficit, Negative if surplus
                } else {
                    remainingWorkingDays += week.workingDays;
                }
            });

            // 2. Second Pass: Distribute Difference to Future Weeks
            if (remainingWorkingDays > 0) {
                weeks.forEach((week, i) => {
                    const isPast = week.end < currentDate;
                    if (!isPast) {
                        const dailyGoal = totalGoal / totalWorkingDays;
                        const originalWeekGoal = dailyGoal * week.workingDays;

                        // Distribute pastDifference proportionally to this week's weight in remaining time
                        const share = pastDifference * (week.workingDays / remainingWorkingDays);

                        // New Goal = Original + Share
                        // If deficit (pos), goal increases. If surplus (neg), goal decreases.
                        let newGoal = originalWeekGoal + share;

                        // Prevent negative goals? (Extreme surplus)
                        if (newGoal < 0) newGoal = 0;

                        adjustedGoals[i] = newGoal;
                    }
                });
            } else {
                // If no remaining days (month over), the deficit just sits there (or we add to last week?)
                // Usually just leave as is.
                weeks.forEach((week, i) => {
                    const isPast = week.end < currentDate;
                    if (!isPast) {
                         // Should not happen if logic is correct, unless current date is before start of month?
                         // If we are strictly before month starts, remaining = total. Loop above handles it (pastDifference=0).
                         const dailyGoal = totalGoal / totalWorkingDays;
                         adjustedGoals[i] = dailyGoal * week.workingDays;
                    }
                });
            }

            return adjustedGoals;
        }

        // --- IMPORT PARSER AND LOGIC ---

        function calculateSellerDefaults(sellerName) {
            const defaults = {
                elmaPos: 0,
                foodsPos: 0,
                mixSalty: 0,
                mixFoods: 0
            };

            const sellerCode = optimizedData.rcaCodeByName.get(sellerName);
            if (!sellerCode) return defaults;

            const clients = optimizedData.clientsByRca.get(sellerCode) || [];
            const activeClients = clients.filter(c => {
                const cod = String(c["Código"] || c["codigo_cliente"]);
                const rca1 = String(c.rca1 || "").trim();
                const isAmericanas = (c.razaoSocial || "").toUpperCase().includes("AMERICANAS");
                return (isAmericanas || rca1 !== "53" || clientsWithSalesThisMonth.has(cod));
            });

            activeClients.forEach(client => {
                const codCli = String(client["Código"] || client["codigo_cliente"]);
                const historyIds = optimizedData.indices.history.byClient.get(normalizeKey(codCli));

                if (historyIds) {
                    let clientElmaFat = 0;
                    let clientFoodsFat = 0;

                    historyIds.forEach(id => {
                        const sale = optimizedData.historyById.get(id);
                        if (String(codCli).trim() === "9569" && (String(sale.CODUSUR).trim() === "53" || String(sale.CODUSUR).trim() === "053")) return;

                        const isRev = (sale.TIPOVENDA === "1" || sale.TIPOVENDA === "9");
                        if (!isRev) return;

                        const codFor = String(sale.CODFOR);
                        const desc = (sale.DESCRICAO || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

                        if (codFor === "707" || codFor === "708" || codFor === "752") {
                            clientElmaFat += sale.VLVENDA;
                        } else if (codFor === "1119") {
                            if (desc.includes("TODDYNHO") || desc.includes("TODDY") || desc.includes("QUAKER") || desc.includes("KEROCOCO")) {
                                clientFoodsFat += sale.VLVENDA;
                            }
                        }
                    });

                    if (clientElmaFat >= 1) defaults.elmaPos++;
                    if (clientFoodsFat >= 1) defaults.foodsPos++;
                }
            });

            const elmaAdj = goalsPosAdjustments["ELMA_ALL"] ? (goalsPosAdjustments["ELMA_ALL"].get(sellerName) || 0) : 0;
            const elmaBase = defaults.elmaPos + elmaAdj;

            defaults.mixSalty = Math.round(elmaBase * 0.50);
            defaults.mixFoods = Math.round(elmaBase * 0.30);

            if (sellerCode === "1001") {
                defaults.mixSalty = 0;
                defaults.mixFoods = 0;
            }

            return defaults;
        }

        function parseGoalsSvStructure(text) {
            console.log("[Parser] Iniciando parse...");
            const lines = text.replace(/[\r\n]+$/, '').split(/\r?\n/);
            if (lines.length === 0) return null;

            // 1. Detect Delimiter (Heuristic)
            const firstLine = lines[0];
            let delimiter = '\t';
            if (firstLine.includes('\t')) delimiter = '\t';
            else if (firstLine.includes(';')) delimiter = ';';
            else if (firstLine.includes(',') && lines.length > 1) delimiter = ',';
            // Fallback for space separated copy-paste if single line has spaces
            else if (firstLine.trim().split(/\s{2,}/).length > 1) delimiter = /\s{2,}/; // At least 2 spaces

            console.log("[Parser] Delimitador detectado:", delimiter);

            const rows = lines.map(line => {
                // If delimiter is regex, use split directly
                if (delimiter instanceof RegExp) return line.trim().split(delimiter);
                return line.split(delimiter);
            });

            console.log(`[Parser] Linhas encontradas: ${rows.length}`);

            // Helper: Parse Value (Moved up for availability)
            const parseImportValue = (rawStr) => {
                if (!rawStr) return NaN;
                let clean = String(rawStr).trim().toUpperCase().replace(/[^0-9,.-]/g, '');
                if (!clean) return NaN;

                const dotIdx = clean.lastIndexOf('.');
                const commaIdx = clean.lastIndexOf(',');

                if (dotIdx > -1 && commaIdx > -1) {
                    if (dotIdx > commaIdx) clean = clean.replace(/,/g, '');
                    else clean = clean.replace(/\./g, '').replace(',', '.');
                } else if (commaIdx > -1) {
                    if (/,\d{3}$/.test(clean)) clean = clean.replace(/,/g, '');
                    else clean = clean.replace(',', '.');
                } else if (dotIdx > -1) {
                    if (/\.\d{3}$/.test(clean)) clean = clean.replace(/\./g, '');
                }
                return parseFloat(clean);
            };

            // Helper: Normalize Category
            const normalizeGoalCategory = (catKey) => {
                if (!catKey) return null;
                catKey = catKey.toUpperCase();
                if (catKey.includes('NÃO EXTRUSADOS') || catKey.includes('NAO EXTRUSADOS')) return window.SUPPLIER_CODES.ELMA[1];
                if (catKey.includes('EXTRUSADOS')) return window.SUPPLIER_CODES.ELMA[0];
                if (catKey.includes('TORCIDA')) return window.SUPPLIER_CODES.ELMA[2];
                if (catKey.includes('TODDYNHO')) return window.SUPPLIER_CODES.VIRTUAL.TODDYNHO;
                if (catKey.includes('TODDY')) return window.SUPPLIER_CODES.VIRTUAL.TODDY;
                if (catKey.includes('QUAKER') || catKey.includes('KEROCOCO')) return window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO;
                if (catKey === 'KG ELMA' || catKey === 'KG_ELMA') return 'tonelada_elma';
                if (catKey === 'KG FOODS' || catKey === 'KG_FOODS') return 'tonelada_foods';
                if (catKey === 'TOTAL ELMA' || catKey === 'TOTAL_ELMA') return 'total_elma';
                if (catKey === 'TOTAL FOODS' || catKey === 'TOTAL_FOODS') return 'total_foods';
                if (catKey === 'MIX SALTY' || catKey === 'MIX_SALTY') return 'mix_salty';
                if (catKey === 'MIX FOODS' || catKey === 'MIX_FOODS') return 'mix_foods';
                if (catKey === 'PEPSICO_ALL_POS' || catKey === 'PEPSICO_ALL' || catKey === 'GERAL') return 'pepsico_all';

                const validIds = [window.SUPPLIER_CODES.ELMA[0], window.SUPPLIER_CODES.ELMA[1], window.SUPPLIER_CODES.ELMA[2], window.SUPPLIER_CODES.VIRTUAL.TODDYNHO, window.SUPPLIER_CODES.VIRTUAL.TODDY, window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO, 'tonelada_elma', 'tonelada_foods', 'total_elma', 'total_foods', 'mix_salty', 'mix_foods', 'pepsico_all'];
                if (validIds.includes(catKey.toLowerCase())) return catKey.toLowerCase();
                return null;
            };

            // Helper: Normalize Metric
            const normalizeGoalMetric = (metricKey) => {
                if (!metricKey) return null;
                metricKey = metricKey.toUpperCase();
                if (metricKey === 'FATURAMENTO' || metricKey === 'MÉDIA TRIM.' || metricKey === 'FAT' || metricKey === 'R$' || metricKey === 'VALOR') return 'FAT';
                if (metricKey === 'POSITIVAÇÃO' || metricKey === 'POSITIVACAO' || metricKey.includes('POSITIVA') || metricKey === 'POS') return 'POS';
                if (metricKey === 'TONELADA' || metricKey === 'META KG' || metricKey === 'VOL' || metricKey === 'KG' || metricKey === 'VOLUME') return 'VOL';
                if (metricKey === 'META MIX' || metricKey === 'MIX' || metricKey === 'QTD') return 'MIX';
                return null;
            };

            // Helper: Resolve Seller
            const resolveSeller = (rawName) => {
                if (!rawName) return null;
                if (isGarbageSeller(rawName)) return null;
                const upperName = rawName.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
                if (optimizedData.rcasBySupervisor.has(upperName) || optimizedData.rcasBySupervisor.has(rawName)) return null;

                if (!isNaN(parseImportValue(rawName))) {
                     const codeStr = String(parseImportValue(rawName));
                     if (optimizedData.rcaNameByCode.has(codeStr)) return optimizedData.rcaNameByCode.get(codeStr);
                }

                for (const [sysName, sysCode] of optimizedData.rcaCodeByName) {
                     const sysUpper = sysName.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
                     if (sysUpper === upperName) return sysName;
                }
                return rawName;
            };

            // 2. Identify Header Rows
            // We look for 3 consecutive rows that might be the header structure
            let startRow = 0;
            if (rows.length >= 3) {
                // Standard logic: Rows 0, 1, 2
                startRow = 0;
            } else {
                console.warn("[Parser] Menos de 3 linhas. Tentando modo simplificado...");
                const simplifiedUpdates = [];

                rows.forEach((row, rowIndex) => {
                    const cols = row.map(c => c ? c.trim() : '').filter(c => c !== '');
                    if (cols.length < 3) {
                         console.warn(`[Parser-Simples] Linha ${rowIndex+1} ignorada: Menos de 3 colunas válidas.`);
                         return;
                    }

                    const sellerName = resolveSeller(cols[0]);
                    if (!sellerName) return;

                    let catId = null;
                    let metricId = null;
                    let value = NaN;

                    // Try 4 Columns: Seller | Category | Metric | Value
                    if (cols.length >= 4) {
                        catId = normalizeGoalCategory(cols[1]);
                        metricId = normalizeGoalMetric(cols[2]);
                        value = parseImportValue(cols[3]);
                    }
                    // Try 3 Columns: Seller | Category | Value (Infer Metric)
                    else if (cols.length === 3) {
                        catId = normalizeGoalCategory(cols[1]);
                        value = parseImportValue(cols[2]);

                        if (catId) {
                            if (catId.startsWith('mix_')) metricId = 'MIX';
                            else if (catId.startsWith('tonelada_')) metricId = 'VOL';
                            else if (catId.startsWith('total_') || catId === 'pepsico_all') metricId = 'POS';
                            // Ambiguous: 707, 708... could be FAT or POS.
                            // If Value is small (< 200), maybe POS? If large, FAT? Dangerous.
                            // Default to FAT for 707/etc?
                            else if (window.SUPPLIER_CODES.ALL_GOALS.includes(catId)) {
                                metricId = 'FAT'; // Default assumption for simplified input
                            }
                        }
                    }

                    if (sellerName && catId && metricId && !isNaN(value)) {
                        let type = 'rev';
                        if (metricId === 'VOL') type = 'vol';
                        if (metricId === 'POS') type = 'pos';
                        if (metricId === 'MIX') type = 'mix';

                        simplifiedUpdates.push({ type, seller: sellerName, category: catId, val: value });
                    }
                });

                return simplifiedUpdates.length > 0 ? simplifiedUpdates : null;
            }

            const header0 = rows[startRow].map(h => h ? h.trim().toUpperCase() : '');
            const header1 = rows[startRow + 1].map(h => h ? h.trim().toUpperCase() : '');
            const header2 = rows[startRow + 2].map(h => h ? h.trim().toUpperCase() : '');

            console.log("[Parser] Header 0:", header0.join('|'));
            console.log("[Parser] Header 1:", header1.join('|'));
            console.log("[Parser] Header 2:", header2.join('|'));

            const colMap = {};
            let currentCategory = null;
            let currentMetric = null;

            // Map Headers
            for (let i = 0; i < header0.length; i++) {
                if (header0[i]) currentCategory = header0[i];
                if (header1[i]) currentMetric = header1[i];
                let subMetric = header2[i]; // Meta, Ajuste, etc.

                if (currentCategory && subMetric) {
                    if (subMetric === 'AJ.' || subMetric === 'AJ') subMetric = 'AJUSTE';

                    let catKey = currentCategory;
                    // Normalize Category Names to IDs (Reuse helper if possible or keep logic)
                    const normalizedCat = normalizeGoalCategory(catKey);
                    if (normalizedCat) catKey = normalizedCat;

                    let metricKey = 'OTHER';
                    const normalizedMetric = normalizeGoalMetric(currentMetric);
                    if (normalizedMetric) metricKey = normalizedMetric;

                    const key = `${catKey}_${metricKey}_${subMetric}`;
                    colMap[key] = i;
                }
            }

            const updates = [];
            const processedSellers = new Set();

            const dataStartRow = startRow + 3;
            // Identify Vendor Column Index (Name)
            // Usually Index 1 (Code, Name, ...)
            // We scan first few rows to find valid seller names
            let nameColIndex = 1;
            // Basic Heuristic: If col 0 looks like a name and col 1 is number, maybe it's col 0.
            // But standard template is [Code, Name, ...]. We stick to 1 for now or 0 if 1 is empty.

            for (let i = dataStartRow; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length < 2) continue;

                // Try col 1 for name, fallback to col 0 if col 1 is empty/numeric
                let sellerName = row[1];
                let sellerCodeCandidate = row[0]; // Candidate for Code

                if (!sellerName || !isNaN(parseImportValue(sellerName))) {
                     // If col 1 is number, maybe col 0 is name? Or col 2?
                     // Standard: Col 0 = Code, Col 1 = Name.
                     if (row[0] && isNaN(parseImportValue(row[0]))) {
                         sellerName = row[0];
                         sellerCodeCandidate = null; // Name is in Col 0
                     }
                }

                if (!sellerName) continue;

                // --- ENHANCED FILTER: Ignore Supervisors, Aggregates, and BALCAO ---
                if (isGarbageSeller(sellerName)) continue;
                const upperName = sellerName.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

                // --- RESOLUTION LOGIC: Normalize Seller Name to System Canonical Name ---
                let canonicalName = null;

                // 1. Try by Code (Col 0)
                if (sellerCodeCandidate) {
                    const parsedCode = parseImportValue(sellerCodeCandidate);
                    if (!isNaN(parsedCode)) {
                        const codeStr = String(parsedCode);
                        if (optimizedData.rcaNameByCode.has(codeStr)) {
                            canonicalName = optimizedData.rcaNameByCode.get(codeStr);
                        }
                    }
                }

                // 2. Try by Name (Fuzzy/Case-Insensitive)
                if (!canonicalName) {
                    // Iterate existing system names to find case-insensitive match
                    for (const [sysName, sysCode] of optimizedData.rcaCodeByName) {
                         const sysUpper = sysName.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
                         if (sysUpper === upperName) {
                             canonicalName = sysName;
                             break;
                         }
                    }
                }

                const finalSellerName = canonicalName || sellerName;

                // 2. Dynamic Supervisor Check
                // If the name is a known Supervisor (key in rcasBySupervisor), ignore it.
                // Assuming supervisors are not also sellers in this context (or we only want leaf sellers).
                if (optimizedData.rcasBySupervisor.has(finalSellerName) || optimizedData.rcasBySupervisor.has(finalSellerName.toUpperCase())) {
                    continue;
                }
                // ------------------------------------------------

                if (processedSellers.has(finalSellerName)) continue;
                processedSellers.add(finalSellerName);

                // Helper to get value with priority: Adjust > Meta
                const getPriorityValue = (cat, metric) => {
                    // 1. Try AJUSTE
                    let idx = colMap[`${cat}_${metric}_AJUSTE`];
                    if (idx !== undefined && row[idx]) {
                        const val = parseImportValue(row[idx]);
                        if (!isNaN(val)) return val;
                    }
                    // 2. Try META
                    idx = colMap[`${cat}_${metric}_META`];
                    if (idx !== undefined && row[idx]) {
                        const val = parseImportValue(row[idx]);
                        if (!isNaN(val)) return val;
                    }
                    return NaN;
                };

                // 1. Revenue
                const revCats = window.SUPPLIER_CODES.ALL_GOALS;
                revCats.forEach(cat => {
                    const val = getPriorityValue(cat, 'FAT');
                    if (!isNaN(val)) updates.push({ type: 'rev', seller: sellerName, category: cat, val: val });
                });

                // 2. Volume
                // Metas de Volume são importadas pelos Totais (KG ELMA / KG FOODS) e distribuídas automaticamente
                const volCats = ['tonelada_elma', 'tonelada_foods'];
                volCats.forEach(cat => {
                    const val = getPriorityValue(cat, 'VOL');
                    if (!isNaN(val)) updates.push({ type: 'vol', seller: sellerName, category: cat, val: val });
                });

                // 3. Positivation
                const posCats = ['pepsico_all', 'total_elma', 'total_foods', window.SUPPLIER_CODES.ELMA[0], window.SUPPLIER_CODES.ELMA[1], window.SUPPLIER_CODES.ELMA[2], window.SUPPLIER_CODES.VIRTUAL.TODDYNHO, window.SUPPLIER_CODES.VIRTUAL.TODDY, window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO];
                posCats.forEach(cat => {
                    const val = getPriorityValue(cat, 'POS');
                    if (!isNaN(val)) updates.push({ type: 'pos', seller: sellerName, category: cat, val: Math.round(val) });
                });

                // 4. Mix
                const mixCats = ['mix_salty', 'mix_foods'];
                mixCats.forEach(cat => {
                    const val = getPriorityValue(cat, 'MIX');
                    if (!isNaN(val)) updates.push({ type: 'mix', seller: sellerName, category: cat, val: Math.round(val) });
                });
            }
            return updates;
        }

        // --- Event Listeners for Import ---
        const importBtn = document.getElementById('goals-sv-import-btn');
        const importModal = document.getElementById('import-goals-modal');
        const importCloseBtn = document.getElementById('import-goals-close-btn');
        const importCancelBtn = document.getElementById('import-goals-cancel-btn');
        const importAnalyzeBtn = document.getElementById('import-goals-analyze-btn');
        const importConfirmBtn = document.getElementById('import-goals-confirm-btn');
        const importTextarea = document.getElementById('import-goals-textarea');
        const analysisContainer = document.getElementById('import-analysis-container');
        const analysisBody = document.getElementById('import-analysis-table-body');
        const analysisBadges = document.getElementById('import-summary-badges');
            const importPaginationControls = document.createElement('div');
            importPaginationControls.id = 'import-pagination-controls';
            importPaginationControls.className = 'flex justify-between items-center mt-4 hidden';
            importPaginationControls.innerHTML = `
                <button id="import-prev-page-btn" class="bg-slate-700 border border-slate-600 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded-lg disabled:opacity-50 text-xs" disabled>Anterior</button>
                <span id="import-page-info-text" class="text-slate-400 text-xs">Página 1 de 1</span>
                <button id="import-next-page-btn" class="bg-slate-700 border border-slate-600 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded-lg disabled:opacity-50 text-xs" disabled>Próxima</button>
            `;
            // Insert after table container (which is inside analysisContainer -> div.bg-slate-900)
            // analysisContainer contains a header div, result div, and then the table container div.
            // We need to find the table container.

        let pendingImportUpdates = [];
            let importTablePage = 1;
            const importTablePageSize = 19;

            function renderImportTable() {
                if (!analysisBody) return;
                analysisBody.innerHTML = '';

                const totalPages = Math.ceil(pendingImportUpdates.length / importTablePageSize);
                if (importTablePage > totalPages && totalPages > 0) importTablePage = totalPages;
                if (totalPages === 0) importTablePage = 1;

                const start = (importTablePage - 1) * importTablePageSize;
                const end = start + importTablePageSize;
                const pageItems = pendingImportUpdates.slice(start, end);

                const formatGoalValue = (val, type) => {
                    if (type === 'rev') return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    if (type === 'vol') return val.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' Kg';
                    return Math.round(val).toString();
                };

                pageItems.forEach(u => {
                    const row = document.createElement('tr');

                    const currentVal = getSellerCurrentGoal(u.seller, u.category, u.type);
                    const newVal = u.val;
                    const diff = newVal - currentVal;

                    const currentValStr = formatGoalValue(currentVal, u.type);
                    const newValStr = formatGoalValue(newVal, u.type);
                    const diffStr = formatGoalValue(diff, u.type);

                    let diffClass = "text-slate-500";
                    if (diff > 0.001) diffClass = "text-green-400 font-bold";
                    else if (diff < -0.001) diffClass = "text-red-400 font-bold";

                    const sellerCode = optimizedData.rcaCodeByName.get(u.seller) || '-';

                    let displayCategory = u.category;
                    if (u.type === 'pos') displayCategory += '_POS';

                    row.innerHTML = `
                        <td class="px-4 py-2 text-xs text-slate-300">${sellerCode}</td>
                        <td class="px-4 py-2 text-xs text-slate-400">${u.seller}</td>
                        <td class="px-4 py-2 text-xs text-blue-300">${displayCategory}</td>
                        <td class="px-4 py-2 text-xs text-slate-400 font-mono text-right">${currentValStr}</td>
                        <td class="px-4 py-2 text-xs text-white font-bold font-mono text-right">${newValStr}</td>
                        <td class="px-4 py-2 text-xs ${diffClass} font-mono text-right">${diff > 0 ? '+' : ''}${diffStr}</td>
                        <td class="px-4 py-2 text-center text-xs"><span class="px-2 py-1 rounded-full bg-blue-900/50 text-blue-200 text-[10px]">Importar</span></td>
                    `;
                    analysisBody.appendChild(row);
                });

                // Update Pagination Controls
                const prevBtn = document.getElementById('import-prev-page-btn');
                const nextBtn = document.getElementById('import-next-page-btn');
                const infoText = document.getElementById('import-page-info-text');
                const paginationContainer = document.getElementById('import-pagination-controls');

                if (paginationContainer) {
                    if (pendingImportUpdates.length > importTablePageSize) {
                        paginationContainer.classList.remove('hidden');
                        if(infoText) infoText.textContent = `Página ${importTablePage} de ${totalPages}`;
                        if(prevBtn) prevBtn.disabled = importTablePage === 1;
                        if(nextBtn) nextBtn.disabled = importTablePage === totalPages;
                    } else {
                        paginationContainer.classList.add('hidden');
                    }
                }
            }

        if (importBtn && importModal) {
            const dropZone = document.getElementById('import-drop-zone');
            const fileInput = document.getElementById('import-goals-file');

            // Inject Pagination Controls into Analysis Container if not present
            if (!document.getElementById('import-pagination-controls')) {
                const tableContainer = analysisContainer.querySelector('.bg-slate-900.rounded-lg.border.border-slate-700');
                if (tableContainer) {
                    tableContainer.parentNode.insertBefore(importPaginationControls, tableContainer.nextSibling);
                }
            }

            // Bind Pagination Listeners
            const prevBtn = document.getElementById('import-prev-page-btn');
            const nextBtn = document.getElementById('import-next-page-btn');

            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    if (importTablePage > 1) {
                        importTablePage--;
                        renderImportTable();
                    }
                });
            }
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    const totalPages = Math.ceil(pendingImportUpdates.length / importTablePageSize);
                    if (importTablePage < totalPages) {
                        importTablePage++;
                        renderImportTable();
                    }
                });
            }

            importBtn.addEventListener('click', () => {
                importModal.classList.remove('hidden');
                importTextarea.value = '';
                analysisContainer.classList.add('hidden');
                importConfirmBtn.disabled = true;
                importConfirmBtn.classList.add('opacity-50', 'cursor-not-allowed');

                // Reset File Input
                if (fileInput) fileInput.value = '';
                if (dropZone) {
                    dropZone.classList.remove('bg-slate-700/50', 'border-teal-500');
                    dropZone.innerHTML = `
                        <svg class="w-12 h-12 text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                        </svg>
                        <p class="text-slate-300 font-medium mb-2">Arraste e solte o arquivo Excel aqui</p>
                        <p class="text-slate-500 text-sm mb-4">ou</p>
                        <label for="import-goals-file" class="bg-[#FF5E00] hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg cursor-pointer transition-colors shadow-lg">
                            Selecionar Arquivo
                        </label>
                        <p class="text-xs text-slate-500 mt-4">Formatos suportados: .xlsx, .xls, .csv</p>
                    `;
                }
            });

            const closeModal = () => {
                importModal.classList.add('hidden');
            };

            importCloseBtn.addEventListener('click', closeModal);
            importCancelBtn.addEventListener('click', closeModal);

            // Drag & Drop Logic
            if (dropZone) {
                ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                    dropZone.addEventListener(eventName, preventDefaults, false);
                });

                function preventDefaults(e) {
                    e.preventDefault();
                    e.stopPropagation();
                }

                ['dragenter', 'dragover'].forEach(eventName => {
                    dropZone.addEventListener(eventName, () => {
                        dropZone.classList.add('bg-slate-700/50', 'border-teal-500');
                    });
                });

                ['dragleave', 'drop'].forEach(eventName => {
                    dropZone.addEventListener(eventName, () => {
                        dropZone.classList.remove('bg-slate-700/50', 'border-teal-500');
                    });
                });

                dropZone.addEventListener('drop', (e) => {
                    const dt = e.dataTransfer;
                    const files = dt.files;
                    handleFiles(files);
                });
            }

            if (fileInput) {
                fileInput.addEventListener('change', (e) => {
                    handleFiles(e.target.files);
                });
            }

            function handleFiles(files) {
                if (files.length === 0) return;
                const file = files[0];

                // Visual Feedback: Loading
                if (dropZone) {
                    dropZone.innerHTML = `
                        <div class="flex flex-col items-center justify-center">
                            <svg class="animate-spin h-10 w-10 text-teal-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p class="text-slate-300 font-medium animate-pulse">Carregando ${file.name}...</p>
                        </div>
                    `;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, {type: 'array'});

                        const sheetName = workbook.SheetNames[0];
                        const sheet = workbook.Sheets[sheetName];

                        // Convert to TSV for the parser
                        const tsv = XLSX.utils.sheet_to_csv(sheet, {FS: "\t"});

                        // Update UI
                        importTextarea.value = tsv;
                        if (dropZone) {
                            dropZone.innerHTML = `
                                <svg class="w-12 h-12 text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                                <p class="text-green-400 font-bold mb-2">Sucesso!</p>
                                <p class="text-slate-400 text-sm">${file.name} carregado.</p>
                            `;
                        }

                        // Auto-analyze
                        setTimeout(() => importAnalyzeBtn.click(), 500);

                    } catch (err) {
                        console.error(err);
                        if (dropZone) {
                            dropZone.innerHTML = `
                                <svg class="w-12 h-12 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                <p class="text-red-400 font-bold mb-2">Erro!</p>
                                <p class="text-slate-400 text-sm">Falha ao ler o arquivo.</p>
                            `;
                        }
                    }
                };
                reader.readAsArrayBuffer(file);
            }

            function resolveGoalCategory(category) {
                // Returns list of leaf categories and metric type hint if needed
                if (category === 'tonelada_elma') return window.SUPPLIER_CODES.ELMA;
                if (category === 'tonelada_foods') return window.SUPPLIER_CODES.VIRTUAL_LIST;
                if (category === 'total_elma') return window.SUPPLIER_CODES.ELMA;
                if (category === 'total_foods') return window.SUPPLIER_CODES.VIRTUAL_LIST;
                return [category];
            }

            function getSellerCurrentGoal(sellerName, category, type) {
                const sellerCode = optimizedData.rcaCodeByName.get(sellerName);
                if (!sellerCode) return 0;

                // Check for Overrides FIRST
                const targets = goalsSellerTargets.get(sellerName);
                if (type === 'rev' && targets && targets[`${category}_FAT`] !== undefined) {
                    return targets[`${category}_FAT`];
                }
                if (type === 'vol' && targets && targets[`${category}_VOL`] !== undefined) {
                    return targets[`${category}_VOL`];
                }

                if (type === 'pos' || type === 'mix') {
                    // Do not mask missing data: If manual targets exist for seller, explicit 0 is returned instead of falling back to calculated defaults.
                    if (targets) {
                        // Manual Override Exists for this Seller
                        if (targets[category] !== undefined) {
                            return targets[category];
                        }
                        // Explicitly return 0 if category is missing (User intended 0 or skipped it)
                        return 0;
                    } else {
                        // Calculate Default (Auto-Pilot for unconfigured sellers)
                        const defaults = calculateSellerDefaults(sellerName);
                        if (category === 'total_elma') return defaults.elmaPos;
                        if (category === 'total_foods') return defaults.foodsPos;
                        if (category === 'mix_salty') return defaults.mixSalty;
                        if (category === 'mix_foods') return defaults.mixFoods;
                        return 0;
                    }
                }

                if (type === 'rev' || type === 'vol') {
                    // Aggregate from globalClientGoals
                    const clients = optimizedData.clientsByRca.get(sellerCode) || [];
                    const activeClients = clients.filter(c => {
                        const cod = String(c['Código'] || c['codigo_cliente']);
                        const rca1 = String(c.rca1 || '').trim();
                        const isAmericanas = (c.razaoSocial || '').toUpperCase().includes('AMERICANAS');
                        return (isAmericanas || rca1 !== '53' || clientsWithSalesThisMonth.has(cod));
                    });

                    let total = 0;
                    const leafCategories = resolveGoalCategory(category);

                    activeClients.forEach(client => {
                        const codCli = String(client['Código'] || client['codigo_cliente']);
                        const clientGoals = globalClientGoals.get(codCli);
                        if (clientGoals) {
                            leafCategories.forEach(leaf => {
                                const goal = clientGoals.get(leaf);
                                if (goal) {
                                    if (type === 'rev') total += (goal.fat || 0);
                                    else if (type === 'vol') total += (goal.vol || 0);
                                }
                            });
                        }
                    });
                    return total;
                }
                return 0;
            }

            // --- AI Insights Logic ---
                        async function generateAiInsights() {
                const btn = document.getElementById('btn-generate-ai');

                if (!pendingImportUpdates || pendingImportUpdates.length === 0) return;

                // UI Loading State
                btn.disabled = true;
                btn.innerHTML = `<svg class="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Analisando...`;

                // Show loading overlay
                const pageLoader = document.getElementById('page-transition-loader');
                const loaderText = document.getElementById('loader-text');
                if (pageLoader && loaderText) {
                    loaderText.textContent = "A Inteligência Artificial está analisando os dados...";
                    pageLoader.classList.remove('hidden');
                }

                try {
                    // 1. Prepare Data Context (Grouped by Supervisor, Strict Types, Top 5)
                    const supervisorsMap = new Map(); // Map<SupervisorName, { total_fat_diff, sellers: [] }>

                    // Helper to get or create supervisor entry
                    const getSupervisorEntry = (supervisorName) => {
                        if (!supervisorsMap.has(supervisorName)) {
                            supervisorsMap.set(supervisorName, {
                                name: supervisorName,
                                total_fat_diff: 0,
                                sellers: []
                            });
                        }
                        return supervisorsMap.get(supervisorName);
                    };

                    // Helper to resolve human-readable category name
                    const resolveCategoryName = (catCode) => {
                        const map = {
                            [window.SUPPLIER_CODES.ELMA[0]]: 'Extrusados',
                            [window.SUPPLIER_CODES.ELMA[1]]: 'Não Extrusados',
                            [window.SUPPLIER_CODES.ELMA[2]]: 'Torcida',
                            [window.SUPPLIER_CODES.VIRTUAL.TODDYNHO]: 'Toddynho',
                            [window.SUPPLIER_CODES.VIRTUAL.TODDY]: 'Toddy',
                            [window.SUPPLIER_CODES.VIRTUAL.QUAKER_KEROCOCO]: 'Quaker/Kero Coco',
                            'tonelada_elma': 'Elma Chips',
                            'tonelada_foods': 'Foods',
                            'total_elma': 'Elma Chips',
                            'total_foods': 'Foods',
                            'mix_salty': 'Mix Salty',
                            'mix_foods': 'Mix Foods'
                        };
                        return map[catCode] || catCode;
                    };

                    // Helper to resolve history (simplified for context)
                    const getSellerHistorySimple = (sellerName, type, category) => {
                       // Note: Full history calculation is expensive. We can use the 'current' logic as baseline if history isn't cached.
                       // For accurate comparison, we should use the same logic as renderImportTable if possible, or fetch from history data.
                       // Here we simply return 0 if strict calculation is too heavy, relying on the 'diff' already calculated in pendingImportUpdates?
                       // Actually pendingImportUpdates doesn't store history, it stores 'val' (new).
                       // We can compute history on the fly for the top items only? No, we need to sort first.
                       // Let's rely on 'getSellerCurrentGoal' as the "Old" value (which is Current Target).
                       // The Prompt asks for comparison with "History".
                       // getSellerCurrentGoal returns the *Current Goal* before update.
                       // The AI prompt usually compares New Goal vs History Avg.
                       // Let's provide [Current Goal] and [New Goal]. The AI can infer "Change".
                       return getSellerCurrentGoal(sellerName, category, type);
                    };

                    // Process Updates
                    for (const u of pendingImportUpdates) {
                        // Filter out supervisors/aggregates
                        if (isGarbageSeller(u.seller)) continue;

                        const upperUName = u.seller.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
                        if (optimizedData.rcasBySupervisor.has(upperUName) || optimizedData.rcasBySupervisor.has(u.seller)) {
                            continue;
                        }

                        // Determine Supervisor
                        const sellerCode = optimizedData.rcaCodeByName.get(u.seller);
                        let supervisorName = 'Sem Supervisor';
                        if (u.seller === 'AMERICANAS') {
                            supervisorName = 'BALCAO';
                        } else if (sellerCode) {
                            const details = sellerDetailsMap.get(sellerCode);
                            if (details && details.supervisor) supervisorName = details.supervisor;
                        }

                        const oldVal = getSellerCurrentGoal(u.seller, u.category, u.type);
                        const diff = u.val - oldVal;
                        const impact = Math.abs(diff);

                        // FILTER: Ignore 0 variation globally (Irrelevant info)
                        if (Math.abs(diff) < 0.01) continue;

                        // Define Unit explicitly
                        let unit = '';
                        if (u.type === 'rev') unit = 'R$';
                        else if (u.type === 'vol') unit = 'Kg';
                        else unit = 'Clientes'; // Pos and Mix count as clients

                        // Add to Supervisor Group
                        const supervisorEntry = getSupervisorEntry(supervisorName);

                        // We aggregate items per seller? Or just list variations?
                        // Requirement: "list the main variations of 5 sellers".
                        // It's better to list *Variations* as items.
                        // One seller might have huge Rev change AND huge Vol change.

                        supervisorEntry.sellers.push({
                            seller: u.seller,
                            category: u.category,
                            metric_type: u.type,
                            unit: unit,
                            old_value: oldVal,
                            new_value: u.val,
                            diff: diff,
                            impact: impact
                        });
                    }

                    const optimizedContext = { supervisors: [] };

                    supervisorsMap.forEach(sup => {
                        // Sort by Impact (Magnitude of change)
                        sup.sellers.sort((a, b) => b.impact - a.impact);

                        // Deduplicate Variations (same seller + same metric)
                        const seen = new Set();
                        const uniqueVariations = [];

                        for (const v of sup.sellers) {
                            const catName = resolveCategoryName(v.category);
                            let metricName = '';
                            if (v.unit === 'R$') metricName = `Faturamento (${catName})`;
                            else if (v.unit === 'Kg') metricName = `Volume (${catName})`;
                            else metricName = `Positivação (${catName})`;

                            // Create unique signature
                            const sig = `${v.seller}|${metricName}`;

                            if (!seen.has(sig)) {
                                seen.add(sig);
                                // Attach resolved metric name for later use
                                v._resolvedMetricName = metricName;
                                uniqueVariations.push(v);
                            }
                        }

                        // Apply Limits: 5 for BALCAO, 10 for Others
                        const limit = sup.name === 'BALCAO' ? 5 : 10;
                        const topVariations = uniqueVariations.slice(0, limit).map(v => {
                            return {
                                seller: v.seller,
                                metric: v._resolvedMetricName,
                                details: `${v.unit} ${Math.round(v.old_value)} -> ${Math.round(v.new_value)} (Diff: ${v.diff > 0 ? '+' : ''}${Math.round(v.diff)})`
                            };
                        });

                        optimizedContext.supervisors.push({
                            name: sup.name,
                            top_variations: topVariations
                        });
                    });

                    const promptText = `
                        Atue como um Gerente Nacional de Vendas da Prime Distribuição.
                        Analise as alterações de metas propostas (Proposed Goals).

                        Dados: ${JSON.stringify(optimizedContext)}

                        Gere um relatório JSON estritamente com esta estrutura:
                        {
                            "global_summary": "Resumo executivo da estratégia geral percebida nas alterações. Use emojis.",
                            "supervisors": [
                                {
                                    "name": "Nome do Supervisor",
                                    "analysis": "Parágrafo de análise estratégica sobre este time. Identifique se o foco é agressividade em vendas, recuperação de volume ou cobertura.",
                                    "variations": [
                                        {
                                            "seller": "Nome Vendedor",
                                            "metric": "O nome completo da métrica (ex: Faturamento (Extrusados))",
                                            "change_display": "Texto ex: R$ 50k -> R$ 60k (+10k)",
                                            "insight": "Comentário curto sobre o impacto (ex: 'Aumento agressivo', 'Ajuste conservador')"
                                        }
                                    ]
                                }
                            ]
                        }

                        Regras:
                        1. "variations" deve conter EXATAMENTE os itens enviados no contexto.
                        2. Use o nome COMPLETO da métrica fornecido no input (ex: "Faturamento (Extrusados)"). NÃO simplifique para apenas "Faturamento".
                        3. Retorne APENAS o JSON.
                    `;

                    // 2. Call API
                    const metaEntry = embeddedData.metadata ? embeddedData.metadata.find(m => m.key === 'groq_api_key') : null;
                    const API_KEY = metaEntry ? metaEntry.value : null;

                    if (!API_KEY) throw new Error("Chave de API não configurada.");

                    const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${API_KEY}`
                        },
                        body: JSON.stringify({
                            model: "llama-3.3-70b-versatile",
                            messages: [{ role: "user", content: promptText }]
                        })
                    });

                    const data = await response.json();
                    if (data.error) throw new Error(data.error.message);

                    const aiText = data.choices[0].message.content;

                    // 3. Render Output
                    let result;
                    try {
                        const jsonStart = aiText.indexOf('{');
                        const jsonEnd = aiText.lastIndexOf('}');
                        result = JSON.parse(aiText.substring(jsonStart, jsonEnd + 1));

                        // Deduplicate Variations (Post-Processing)
                        if (result.supervisors) {
                            result.supervisors.forEach(sup => {
                                if (sup.variations) {
                                    const uniqueMap = new Map();
                                    const cleanVariations = [];

                                    sup.variations.forEach(v => {
                                        // Create signature: Seller + Metric Name
                                        // Normalize strings to avoid case/space issues
                                        const sig = `${v.seller}_${v.metric}`.trim().toLowerCase();

                                        if (!uniqueMap.has(sig)) {
                                            uniqueMap.set(sig, true);
                                            cleanVariations.push(v);
                                        }
                                    });

                                    // Enforce Limits (Safety Net)
                                    // If AI hallucinates or context structure varies, ensure BALCAO/Americanas is capped at 5
                                    // Other supervisors can show up to 10
                                    const isBalcao = sup.name && (sup.name.toUpperCase() === 'BALCAO' || sup.name.toUpperCase().includes('AMERICANAS'));
                                    const limit = isBalcao ? 5 : 10;

                                    sup.variations = cleanVariations.slice(0, limit);
                                }
                            });
                        }
                    } catch (e) {
                        console.error("AI JSON Parse Error", e);
                        // Fallback simple structure
                        result = { global_summary: aiText, supervisors: [] };
                    }

                    renderAiFullPage(result);

                } catch (err) {
                    console.error("AI Error:", err);
                    window.showToast('error', `Erro na análise: ${err.message}`);
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = `✨ Gerar Insights`;
                    if (pageLoader) pageLoader.classList.add('hidden');
                }
            }

            function renderAiSummaryChart(fatDiff) {
                const chartContainer = document.getElementById('ai-chart-container');
                if(!chartContainer) return;

                // Clear previous canvas
                chartContainer.innerHTML = '<canvas id="aiSummaryChart"></canvas>';
                const ctx = document.getElementById('aiSummaryChart').getContext('2d');

                // Calc Total Current vs Total Proposed based on diff (Approximation for visual)
                // We need the absolute totals to make a bar chart.
                // Let's iterate updates again to sum "Current" and "Proposed" totals for Revenue only.
                let totalCurrent = 0;
                let totalProposed = 0;

                pendingImportUpdates.forEach(u => {
                    if (u.type === 'rev') {
                        const cur = getSellerCurrentGoal(u.seller, u.category, u.type);
                        totalCurrent += cur;
                        totalProposed += u.val;
                    }
                });

                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['Meta Atual', 'Nova Proposta'],
                        datasets: [{
                            label: 'Faturamento Total (R$)',
                            data: [totalCurrent, totalProposed],
                            backgroundColor: ['#64748b', fatDiff >= 0 ? '#22c55e' : '#ef4444'],
                            borderWidth: 0,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            title: { display: true, text: 'Comparativo de Faturamento Total', color: '#fff' }
                        },
                        scales: {
                            y: {
                                beginAtZero: false,
                                grid: { color: '#334155' },
                                ticks: {
                                    color: '#94a3b8',
                                    callback: function(value) {
                                        return new Intl.NumberFormat('pt-BR', { notation: "compact", maximumFractionDigits: 1 }).format(value);
                                    }
                                }
                            },
                            x: { grid: { display: false }, ticks: { color: '#fff' } }
                        }
                    }
                });
            }

            const btnGenerateAi = document.getElementById('btn-generate-ai');
            if(btnGenerateAi) {
                btnGenerateAi.addEventListener('click', generateAiInsights);
            }

            importAnalyzeBtn.addEventListener('click', () => {
                console.log("Analisar Texto Colado clicado");
                try {
                    const text = importTextarea.value;
                    if (!text.trim()) {
                        window.showToast('warning', "A área de texto está vazia. Cole os dados ou arraste um arquivo novamente.");
                        return;
                    }
                    console.log("Iniciando análise. Tamanho do texto:", text.length);

                    const updates = parseGoalsSvStructure(text);
                    console.log("Resultado da análise:", updates ? updates.length : "null");

                    if (!updates || updates.length === 0) {
                        window.showToast('warning', "Nenhum dado válido encontrado para atualização. \n\nVerifique se:\n1. O arquivo possui os cabeçalhos corretos (3 linhas iniciais).\n2. As colunas de 'Ajuste' contêm valores numéricos.\n3. Os nomes dos vendedores correspondem ao cadastro.");
                        return;
                    }

                    pendingImportUpdates = updates;

                    // Reset to page 1 and render using the pagination function
                    importTablePage = 1;
                    renderImportTable();

                    analysisBadges.innerHTML = `<span class="bg-[#FF5E00] text-white px-3 py-1 rounded-full text-xs font-bold">${updates.length} Registros Encontrados</span>`;
                    analysisContainer.classList.remove('hidden');

                    // Force Scroll
                    analysisContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

                    importConfirmBtn.disabled = false;
                    importConfirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                } catch (e) {
                    console.error("Erro ao analisar dados importados:", e);
                    window.showToast('error', "Erro ao analisar dados: " + e.message);
                }
            });

            importConfirmBtn.addEventListener('click', async () => {
                const originalText = importConfirmBtn.textContent;
                importConfirmBtn.textContent = "Salvando...";
                importConfirmBtn.disabled = true;
                importConfirmBtn.classList.add('opacity-50', 'cursor-not-allowed');

                try {
                    let countRev = 0;
                    let countPos = 0;

                    // --- FULL RESET (Purge Everything) ---
                    // To guarantee no ghost data from Supervisors or previous states persists, we clear all targets.
                    // Only active sellers (backfilled) and imported sellers will remain.
                    goalsSellerTargets.clear();
                    globalClientGoals.clear();
                    // ------------------------

                    // 1. Process Manual Updates (Imported)
                    const importedSellers = new Set();
                    pendingImportUpdates.forEach(u => {
                        importedSellers.add(u.seller);
                        if (u.type === 'rev') {
                            distributeSellerGoal(u.seller, u.category, u.val, 'fat');
                            // Save Override
                            if (!goalsSellerTargets.has(u.seller)) goalsSellerTargets.set(u.seller, {});
                            const t = goalsSellerTargets.get(u.seller);
                            t[`${u.category}_FAT`] = u.val;
                            countRev++;
                        } else if (u.type === 'vol') {
                            distributeSellerGoal(u.seller, u.category, u.val, 'vol');
                            // Save Override
                            if (!goalsSellerTargets.has(u.seller)) goalsSellerTargets.set(u.seller, {});
                            const t = goalsSellerTargets.get(u.seller);
                            t[`${u.category}_VOL`] = u.val;
                            countRev++;
                        } else if (u.type === 'pos' || u.type === 'mix') {
                            // Update Seller Target Map
                            if (!goalsSellerTargets.has(u.seller)) goalsSellerTargets.set(u.seller, {});
                            const t = goalsSellerTargets.get(u.seller);
                            t[u.category] = u.val;
                            countPos++;
                        }
                    });

                    // 2. Backfill Defaults for ALL Active Sellers
                    // Iterate all active sellers to ensure their calculated "Suggestions" are saved if not manually set.
                    // We get active sellers from optimizedData.rcasBySupervisor
                    // 2. Backfill Defaults for ALL Active Sellers
                    // Iterate all active sellers to ensure their calculated "Suggestions" are saved if not manually set.
