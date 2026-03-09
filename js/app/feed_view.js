const FeedVisitas = (() => {
    let isLoading = false;
    let initialized = false;

    // DOM 
    let container;
    let cardsContainer;
    let loadingIndicator;
    let errorContainer;
    let periodInfo;

    function init() {
        console.log("Inicializando FeedVisitas Simples...");

        container = document.getElementById('feed-view');
        cardsContainer = document.getElementById('feed-cards-container');
        loadingIndicator = document.getElementById('feed-loading');
        errorContainer = document.getElementById('feed-error-message');
        periodInfo = document.getElementById('feed-period-info');

        if (!container || !cardsContainer || !loadingIndicator || !errorContainer) {
            console.error("FeedVisitas: Elementos HTML base não encontrados!");
            return;
        }

        // Always reload when opened to ensure fresh data and check errors
        loadFeed();
        initialized = true;
    }

    function showError(msg) {
        if (errorContainer) {
            errorContainer.innerHTML = msg;
            errorContainer.classList.remove('hidden');
        }
    }

    function hideError() {
        if (errorContainer) {
            errorContainer.classList.add('hidden');
            errorContainer.innerHTML = '';
        }
    }

    function getMonthBounds(date) {
        const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
        const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
        return { start, end };
    }

    async function loadFeed() {
        if (isLoading) return;
        isLoading = true;

        hideError();
        if (loadingIndicator) loadingIndicator.classList.remove('hidden');
        if (cardsContainer) cardsContainer.innerHTML = '';
        if (periodInfo) periodInfo.textContent = 'Carregando...';

        try {
            console.log("FeedVisitas: Buscando dados...");

            // Determine current month context based on lastSaleDate
            let contextDate = new Date();
            if (typeof window.lastSaleDate !== 'undefined' && window.lastSaleDate) {
                // Ensure valid date string processing
                let cleanDateStr = window.lastSaleDate.replace(' ', 'T');
                if (!cleanDateStr.endsWith('Z') && !cleanDateStr.includes('+') && !cleanDateStr.includes('-')) {
                    cleanDateStr += 'Z';
                }
                const parsedDate = new Date(cleanDateStr);
                if (!isNaN(parsedDate)) {
                    contextDate = parsedDate;
                }
            }

            const bounds = getMonthBounds(contextDate);
            const start = bounds.start;
            const end = bounds.end;

            // Format for display
            const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
            const monthName = monthNames[contextDate.getUTCMonth()];
            const year = contextDate.getUTCFullYear();
            if (periodInfo) {
                periodInfo.textContent = `Mês: ${monthName}/${year}`;
            }

            // Simple Query: visits within the month
            let query = window.supabaseClient
                .from('visitas')
                .select(`id, created_at, checkout_at, client_code, observacao, status, profiles:id_promotor(name)`)
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString())
                .order('created_at', { ascending: false })
                .limit(50); // Setting a reasonable limit to prevent huge payload

            // Filtro RLS para promotores para evitar tela em branco por RLS violation silently se Supabase estiver barrando leitura total
            const role = (window.userRole || '').trim().toLowerCase();
            const isRestricted = role === 'promotor' || role === 'vendedor' || window.userIsSeller || window.userIsPromoter;
            if (isRestricted && window.userId) {
                query = query.eq('id_promotor', window.userId);
            }

            const { data, error } = await query;

            if (error) {
                console.error("FeedVisitas Supabase Error:", error);
                throw error;
            }

            console.log("FeedVisitas: Dados recebidos:", data ? data.length : 0);

            // Fetch client names from data_clients
            const clientNamesMap = new Map();
            if (data && data.length > 0) {
                const uniqueClientCodes = [...new Set(data.map(v => v.client_code).filter(c => c))];
                if (uniqueClientCodes.length > 0) {
                    try {
                        const { data: clientsData, error: clientsError } = await window.supabaseClient
                            .from('data_clients')
                            .select('codigo_cliente, nomecliente')
                            .in('codigo_cliente', uniqueClientCodes);

                        if (clientsError) {
                            console.error("Erro ao buscar nomes dos clientes:", clientsError);
                        } else if (clientsData) {
                            clientsData.forEach(c => {
                                clientNamesMap.set(String(c.codigo_cliente).trim(), c.nomecliente);
                            });
                        }
                    } catch (err) {
                        console.error("Exceção ao buscar nomes dos clientes:", err);
                    }
                }
            }

            if (loadingIndicator) loadingIndicator.classList.add('hidden');

            if (!data || data.length === 0) {
                cardsContainer.innerHTML = `
                    <div class="glass-panel p-8 text-center rounded-2xl border border-slate-700/50">
                        <div class="flex justify-center mb-4">
                            <div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
                                <svg class="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                            </div>
                        </div>
                        <p class="text-slate-300 font-medium">Nenhuma visita registrada no mês atual (${monthName}/${year}).</p>
                        <p class="text-slate-500 text-sm mt-2">Visitas registradas aparecerão aqui.</p>
                    </div>`;
                return;
            }

            data.forEach(visit => {
                const card = document.createElement('div');
                card.className = 'glass-card p-4 rounded-xl shadow-lg border border-slate-700/50 hover:border-slate-600 transition-colors animate-fade-in-up';

                // Try to resolve client name from fetched data_clients map, fallback to code
                let clientName = 'Cliente Desconhecido';
                if (visit.client_code) {
                    const cleanCode = String(visit.client_code).trim();
                    if (clientNamesMap.has(cleanCode) && clientNamesMap.get(cleanCode)) {
                        clientName = clientNamesMap.get(cleanCode);
                    } else {
                        clientName = `Cód: ${visit.client_code}`;
                    }
                }

                let promotorName = visit.profiles ? visit.profiles.name : 'Promotor';
                
                // Adjust date to BRT timezone manually
                let visitDate = new Date(visit.created_at);
                visitDate = new Date(visitDate.getTime() - (3 * 60 * 60 * 1000));

                const formattedDate = visitDate.getUTCDate().toString().padStart(2, '0') + '/' +
                                     (visitDate.getUTCMonth() + 1).toString().padStart(2, '0') + '/' +
                                     visitDate.getUTCFullYear() + ' ' +
                                     visitDate.getUTCHours().toString().padStart(2, '0') + ':' +
                                     visitDate.getUTCMinutes().toString().padStart(2, '0');

                // status badge
                let statusHtml = '';
                if (visit.status === 'APPROVED') {
                    statusHtml = '<span class="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Aprovada</span>';
                } else if (visit.status === 'REJECTED') {
                    statusHtml = '<span class="px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">Rejeitada</span>';
                } else {
                    statusHtml = '<span class="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Pendente</span>';
                }

                card.innerHTML = `
                    <div class="flex justify-between items-start mb-2 gap-4">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                                <p class="text-sm font-bold text-white truncate">${promotorName}</p>
                                ${statusHtml}
                            </div>
                            <p class="text-xs text-[#FF5E00] font-medium truncate" title="${clientName}">${clientName}</p>
                        </div>
                        <span class="text-xs text-slate-400 bg-slate-800/80 px-2 py-1 rounded whitespace-nowrap border border-slate-700/50">${formattedDate}</span>
                    </div>
                    ${visit.observacao ? `<div class="mt-3 text-sm text-slate-300 border-t border-slate-700/50 pt-3">${visit.observacao}</div>` : ''}
                `;
                cardsContainer.appendChild(card);
            });

        } catch (error) {
            console.error('FeedVisitas Erro Fatal:', error);
            showError(`Falha ao carregar visitas: ${error.message || 'Erro desconhecido'}`);
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
        } finally {
            isLoading = false;
        }
    }

    return {
        init
    };
})();

window.FeedVisitas = FeedVisitas;
console.log("FeedVisitas Simples (Simplificado) carregado.");
