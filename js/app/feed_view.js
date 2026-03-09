const FeedVisitas = (() => {
    let isLoading = false;
    let initialized = false;

    // DOM
    let container;
    let cardsContainer;
    let loadingIndicator;
    let errorContainer;

    function init() {
        console.log("Inicializando FeedVisitas Simples...");

        container = document.getElementById('feed-view');
        cardsContainer = document.getElementById('feed-cards-container');
        loadingIndicator = document.getElementById('feed-loading');
        errorContainer = document.getElementById('feed-error-message');

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

    async function loadFeed() {
        if (isLoading) return;
        isLoading = true;

        hideError();
        if (loadingIndicator) loadingIndicator.classList.remove('hidden');
        if (cardsContainer) cardsContainer.innerHTML = '';

        try {
            console.log("FeedVisitas: Buscando dados...");

            // Simple Query: last 20 visits.
            let query = window.supabaseClient
                .from('visitas')
                .select(`id, created_at, client_code, observacao, status, profiles:id_promotor(name)`)
                .order('created_at', { ascending: false })
                .limit(20);

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

            if (loadingIndicator) loadingIndicator.classList.add('hidden');

            if (!data || data.length === 0) {
                cardsContainer.innerHTML = `
                    <div class="glass-panel p-8 text-center rounded-2xl border border-slate-700">
                        <p class="text-slate-400 font-medium">Nenhuma visita encontrada ou você não tem permissão para visualizar.</p>
                    </div>`;
                return;
            }

            data.forEach(visit => {
                const card = document.createElement('div');
                card.className = 'glass-card p-4 rounded-xl shadow-lg border border-slate-700/50 hover:border-slate-600 transition-colors animate-fade-in-up';

                // Try to resolve client name from memory, fallback to code
                let clientName = 'Cliente Desconhecido';
                if (window.resolveDim && visit.client_code) {
                    const clientInfo = window.resolveDim('clientes', visit.client_code);
                    if (clientInfo && clientInfo.nome) clientName = clientInfo.nome;
                } else if (visit.client_code) {
                    clientName = `Cód: ${visit.client_code}`;
                }

                let promotorName = visit.profiles ? visit.profiles.name : 'Promotor';

                const dateObj = new Date(visit.created_at);
                const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

                card.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <p class="text-sm font-bold text-white">${promotorName}</p>
                            <p class="text-xs text-[#FF5E00] font-medium">${clientName}</p>
                        </div>
                        <span class="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">${formattedDate}</span>
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
