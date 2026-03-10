const FeedVisitas = (() => {
    let isLoading = false;
    let isLoadingMore = false;
    let hasMore = true;
    let currentPage = 0;
    const PAGE_SIZE = 10;
    let observer = null;
    let currentStartBound = null;
    let currentEndBound = null;
    let initialized = false;

    // Navigation State
    let showOnlyFavorites = false;
    let flatpickrInstance = null;

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
        resetFeed();
        loadFeed();
        initialized = true;

        if (!flatpickrInstance) {
            setupFlatpickr();
        }
    }

    function resetFeed() {
        currentPage = 0;
        hasMore = true;
        if (cardsContainer) cardsContainer.innerHTML = '';
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        removeLoadingMoreIndicator();
    }

    function removeLoadingMoreIndicator() {
        const loader = document.getElementById('feed-load-more-indicator');
        if (loader) loader.remove();
    }

    function addLoadingMoreIndicator() {
        removeLoadingMoreIndicator();
        if (!cardsContainer) return;
        const loader = document.createElement('div');
        loader.id = 'feed-load-more-indicator';
        loader.className = 'w-full py-6 flex justify-center items-center';
        loader.innerHTML = `<svg class="w-8 h-8 text-[#FF5E00] animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>`;
        cardsContainer.appendChild(loader);
    }

    function setupObserver() {
        if (!cardsContainer || !hasMore) return;

        // Find the last card
        const cards = cardsContainer.querySelectorAll('.glass-card');
        if (cards.length === 0) return;
        const lastCard = cards[cards.length - 1];

        if (observer) observer.disconnect();

        observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !isLoading && !isLoadingMore && hasMore) {
                loadMoreFeed();
            }
        }, {
            root: null,
            rootMargin: '100px',
            threshold: 0.1
        });

        observer.observe(lastCard);
    }

    async function loadMoreFeed() {
        if (isLoading || isLoadingMore || !hasMore) return;
        isLoadingMore = true;
        addLoadingMoreIndicator();

        try {
            currentPage++;
            await fetchFeedData();
        } catch (error) {
            console.error("Erro ao carregar mais posts:", error);
            currentPage--; // Revert
        } finally {
            isLoadingMore = false;
            removeLoadingMoreIndicator();
            setupObserver();
        }
    }


    async function openFavoritesModal() {
        const modal = document.getElementById('feed-favorites-modal');
        const countEl = document.getElementById('feed-favorites-count');
        const viewBtn = document.getElementById('feed-favorites-view-btn');

        if (!modal || !countEl) return;

        countEl.innerHTML = '<span class="text-2xl animate-pulse">⏳</span>';
        modal.classList.remove('hidden');

        try {
            const { count, error } = await window.supabaseClient
                .from('visitas')
                .select('*', { count: 'exact', head: true })
                .filter('favoritado_por', 'cs', `{${window.userId}}`)
                .gte('created_at', currentStartBound.toISOString())
                .lte('created_at', currentEndBound.toISOString());

            if (error) throw error;

            countEl.textContent = count || 0;

            if (count === 0) {
                 viewBtn.classList.add('opacity-50', 'cursor-not-allowed');
                 viewBtn.disabled = true;
            } else {
                 viewBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                 viewBtn.disabled = false;
            }
        } catch (e) {
            console.error('Erro ao contar favoritos:', e);
            countEl.textContent = 'Erro';
        }
    }

    function applyFavoritesFilter() {
        showOnlyFavorites = true;
        document.getElementById('feed-favorites-modal').classList.add('hidden');

        document.getElementById('feed-clear-favorites-btn').classList.remove('hidden');
        document.getElementById('feed-favorites-btn').classList.add('hidden');

        // Remove filters that might be blocking favorites from other promoters
        const isManager = true; // Always allow viewing favorites regardless of role

        loadFeed(true);
    }

    function clearFavoritesFilter() {
        showOnlyFavorites = false;

        document.getElementById('feed-clear-favorites-btn').classList.add('hidden');
        document.getElementById('feed-favorites-btn').classList.remove('hidden');

        loadFeed(true);
    }

    async function toggleFavorite(visitId, btnElement) {
        if (!window.userId) return;

        const isCurrentlyFavorite = btnElement.classList.contains('text-yellow-400');
        const originalHtml = btnElement.innerHTML;
        const originalClasses = btnElement.className;

        // Optimistic UI Update
        if (isCurrentlyFavorite) {
            btnElement.classList.remove('text-yellow-400');
            btnElement.classList.add('text-slate-400', 'hover:text-white');
            btnElement.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>`;
        } else {
            btnElement.classList.add('text-yellow-400');
            btnElement.classList.remove('text-slate-400', 'hover:text-white');
            btnElement.innerHTML = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>`;
        }

        btnElement.classList.add('scale-125', 'transition-transform');
        setTimeout(() => btnElement.classList.remove('scale-125'), 150);

        try {
            // First, fetch current favorites array
            const { data: currentData, error: fetchErr } = await window.supabaseClient
                .from('visitas')
                .select('favoritado_por')
                .eq('id', visitId)
                .single();

            if (fetchErr) throw fetchErr;

            let favArray = currentData.favoritado_por || [];

            if (isCurrentlyFavorite) {
                // Remove my id
                favArray = favArray.filter(id => id !== window.userId);
            } else {
                // Add my id
                if (!favArray.includes(window.userId)) {
                    favArray.push(window.userId);
                }
            }

            const { error: updateErr } = await window.supabaseClient
                .from('visitas')
                .update({ favoritado_por: favArray })
                .eq('id', visitId);

            if (updateErr) throw updateErr;

            // If we are IN "showOnlyFavorites" mode and we just UN-favorited, we might want to refresh or hide the card.
            // For better UX, we'll let it stay until reload, or we can hide it immediately. Let's keep it simple.

        } catch(e) {
            console.error("Erro ao favoritar/desfavoritar:", e);
            // Revert UI on failure
            btnElement.innerHTML = originalHtml;
            btnElement.className = originalClasses;
            window.showToast('error', 'Falha ao atualizar favorito.');
        }
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


    async function setupFlatpickr() {
        try {
            // Buscando datas extremas do BD
            const [{ data: minData }, { data: maxData }] = await Promise.all([
                window.supabaseClient.from('visitas').select('created_at').order('created_at', { ascending: true }).limit(1).maybeSingle(),
                window.supabaseClient.from('visitas').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle()
            ]);

            let minDate = minData ? new Date(minData.created_at) : new Date();
            let maxDate = maxData ? new Date(maxData.created_at) : new Date();

            // Instanciando Flatpickr
            const input = document.getElementById('feed-date-filter');
            if (input && window.flatpickr) {
                flatpickrInstance = window.flatpickr(input, {
                    mode: "range",
                    minDate: minDate,
                    maxDate: maxDate,
                    dateFormat: "d/m/Y",
                    locale: "pt",
                    disableMobile: "true",
                    onReady: function(selectedDates, dateStr, instance) {
                        // Adicionar botão de Filtrar
                        const btnContainer = document.createElement('div');
                        btnContainer.className = "flex justify-end p-2 border-t border-slate-700 bg-slate-800 mt-2";
                        btnContainer.innerHTML = `<button type="button" id="feed-flatpickr-filter-btn" class="bg-[#FF5E00] hover:bg-[#CC4A00] text-white font-bold py-1 px-4 rounded text-sm transition-colors">Filtrar</button>`;

                        instance.calendarContainer.appendChild(btnContainer);

                        const btn = document.getElementById('feed-flatpickr-filter-btn');
                        btn.addEventListener('click', () => {
                            if (instance.selectedDates.length === 2) {
                                const start = instance.selectedDates[0];
                                const end = instance.selectedDates[1];

                                // Ajustar as horas para o período do dia todo (em UTC para bater com BD)
                                currentStartBound = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0));
                                currentEndBound = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999));

                                instance.close();
                                loadFeed(true);
                            } else {
                                window.showToast('warning', 'Selecione um período completo (Data Inicial e Final).');
                            }
                        });
                    }
                });
            }

            // Setando o período inicial no input (Mês Atual)
            if (flatpickrInstance && currentStartBound && currentEndBound) {
                // Ajusta datas UTC para local de volta pro flatpickr exibir correto
                const localStart = new Date(currentStartBound.getTime() + currentStartBound.getTimezoneOffset() * 60000);
                const localEnd = new Date(currentEndBound.getTime() + currentEndBound.getTimezoneOffset() * 60000);
                flatpickrInstance.setDate([localStart, localEnd], false);
            }

        } catch(e) {
            console.error("Erro ao instanciar Flatpickr:", e);
        }

        // Setup Favorites Modal Listeners
        const favBtn = document.getElementById('feed-favorites-btn');
        const favModal = document.getElementById('feed-favorites-modal');
        const favCloseBtn = document.getElementById('feed-favorites-close-btn');
        const favViewBtn = document.getElementById('feed-favorites-view-btn');
        const clearFavBtn = document.getElementById('feed-clear-favorites-btn');

        if (favBtn) favBtn.addEventListener('click', window.FeedVisitas.openFavoritesModal);
        if (favCloseBtn) favCloseBtn.addEventListener('click', () => favModal.classList.add('hidden'));
        if (favViewBtn) favViewBtn.addEventListener('click', window.FeedVisitas.applyFavoritesFilter);
        if (clearFavBtn) clearFavBtn.addEventListener('click', window.FeedVisitas.clearFavoritesFilter);
    }

    async function loadFeed(skipDateCalc = false) {
        if (isLoading) return;
        isLoading = true;

        resetFeed();
        hideError();
        if (loadingIndicator) loadingIndicator.classList.remove('hidden');
        if (periodInfo) periodInfo.textContent = 'Carregando...';

        try {
            console.log("FeedVisitas: Buscando dados iniciais...");

            if (!skipDateCalc) {
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
                currentStartBound = bounds.start;
                currentEndBound = bounds.end;
            }
            
            // Format for display
            if (periodInfo && currentStartBound && currentEndBound) {
                const fd = (d) => d.getUTCDate().toString().padStart(2, '0') + '/' + (d.getUTCMonth() + 1).toString().padStart(2, '0');
                periodInfo.textContent = `Período: ${fd(currentStartBound)} até ${fd(currentEndBound)}`;

                if (showOnlyFavorites) {
                     periodInfo.textContent += ` (Apenas Favoritos)`;
                     periodInfo.classList.replace('text-brand-orange', 'text-yellow-400');
                     periodInfo.classList.replace('bg-brand-orange/10', 'bg-yellow-400/10');
                } else {
                     periodInfo.classList.replace('text-yellow-400', 'text-brand-orange');
                     periodInfo.classList.replace('bg-yellow-400/10', 'bg-brand-orange/10');
                }
            }

            await fetchFeedData();

            if (cardsContainer && cardsContainer.children.length === 0) {
                cardsContainer.innerHTML = `
                    <div class="glass-panel p-8 text-center rounded-2xl border border-slate-700/50">
                        <div class="flex justify-center mb-4">
                            <div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
                                <svg class="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                            </div>
                        </div>
                        <p class="text-slate-300 font-medium">Nenhuma visita encontrada neste período.</p>
                        <p class="text-slate-500 text-sm mt-2">Visitas registradas aparecerão aqui.</p>
                    </div>`;
            }

        } catch (error) {
            console.error('FeedVisitas Erro Fatal:', error);
            showError(`Falha ao carregar visitas: ${error.message || 'Erro desconhecido'}`);
        } finally {
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
            isLoading = false;
        }
    }

    async function fetchFeedData() {
        if (!currentStartBound || !currentEndBound) return;

        const from = currentPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let query = window.supabaseClient
            .from('visitas')
            .select(`id, created_at, checkout_at, client_code, observacao, respostas, status, id_promotor, profiles:id_promotor(name), favoritado_por`)
            .gte('created_at', currentStartBound.toISOString())
            .lte('created_at', currentEndBound.toISOString())
            .order('created_at', { ascending: false });

        if (showOnlyFavorites && window.userId) {
            query = query.filter('favoritado_por', 'cs', `{${window.userId}}`);
        }

        query = query.range(from, to);

        const role = (window.userRole || '').trim().toLowerCase();
        const isManager = role === 'adm' || role === 'supervisor' || role === 'coordenador' || role.includes('coord');
        // We no longer restrict the query by id_promotor here, because we need to fetch visits
        // from other promoters if they have 'antes' and 'depois' photos.
        // We will filter the results in memory below.

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        if (!data || data.length < PAGE_SIZE) {
            hasMore = false; // No more pages to load
        }

        if (!data || data.length === 0) {
            return;
        }

        // Fetch client names from data_clients
        const clientNamesMap = new Map();
        const uniqueClientCodes = [...new Set(data.map(v => v.client_code).filter(c => c))];
        if (uniqueClientCodes.length > 0) {
            try {
                const { data: clientsData } = await window.supabaseClient
                    .from('data_clients')
                    .select('codigo_cliente, nomecliente, cnpj_cpf, endereco')
                    .in('codigo_cliente', uniqueClientCodes);

                if (clientsData) {
                    clientsData.forEach(c => {
                        clientNamesMap.set(String(c.codigo_cliente).trim(), {nome: c.nomecliente, cnpj: c.cnpj_cpf, endereco: c.endereco });
                    });
                }
            } catch (err) {
                console.error("Exceção ao buscar nomes dos clientes:", err);
            }
        }

        data.forEach(visit => {
                // Extract answers and photos before building the card to check if it should be displayed
                let fotos = [];
                let observacoesTexto = '';
                let respostasObj = null;
                let respostasCount = 0;

                if (visit.respostas) {
                    try {
                        respostasObj = typeof visit.respostas === 'string' ? JSON.parse(visit.respostas) : visit.respostas;
                    } catch (e) {}
                    
                    if (respostasObj) {
                        observacoesTexto = respostasObj.observacoes || visit.observacao || '';
                    }

                    // Handling photo array from answers
                    if (respostasObj && typeof respostasObj === 'object') {
                        if (respostasObj.fotos && Array.isArray(respostasObj.fotos)) {
                            respostasObj.fotos.forEach(foto => {
                                let urlStr = '';
                                if (foto.url && typeof foto.url === 'string') {
                                    if (foto.url.startsWith('http')) {
                                        urlStr = foto.url;
                                    } else {
                                        const { data: urlData } = window.supabaseClient.storage.from('visitas-images').getPublicUrl(foto.url);
                                        urlStr = urlData.publicUrl;
                                        if (!showOnlyFavorites) {
                                            urlStr += '?width=500&quality=60';
                                        }
                                    }
                                }
                                if (urlStr) {
                                    fotos.push({
                                        url: urlStr,
                                        tipo: foto.tipo || ''
                                    });
                                }
                            });
                        } else {
                            for (const [key, value] of Object.entries(respostasObj)) {
                                if (key.toLowerCase().includes('foto') && value) {
                                    let url = '';
                                    if (typeof value === 'string' && value.startsWith('http')) {
                                        url = value;
                                    } else if (typeof value === 'string') {
                                        const { data: urlData } = window.supabaseClient.storage.from('visitas-images').getPublicUrl(value);
                                        url = urlData.publicUrl;
                                        if (!showOnlyFavorites) {
                                            url += '?width=500&quality=60';
                                        }
                                    }
                                    
                                    if (url) {
                                        let tipo = '';
                                        if (key.toLowerCase().includes('antes')) tipo = 'antes';
                                        if (key.toLowerCase().includes('depois')) tipo = 'depois';
                                        
                                        fotos.push({
                                            url: url,
                                            tipo: tipo
                                        });
                                    }
                                } else {
                                    const chavesOcultas = ['fotos', 'is_off_route', 'observacoes'];
                                    if (!chavesOcultas.includes(key) && !key.toLowerCase().includes('foto') && value !== '' && value !== null && value !== undefined) {
                                        respostasCount++;
                                    }
                                }
                            }
                        }
                    }
                }

                // Filter 1: Only show visits with photos or answers
                if (fotos.length === 0 && respostasCount === 0) {
                    return; // Skip this visit
                }

                // Filter 2: If not manager, only show own visits OR other visits that have BOTH 'antes' and 'depois' photos
                if (!isManager && String(visit.id_promotor) !== String(window.userId)) {
                    const hasAntes = fotos.some(f => f.tipo === 'antes');
                    const hasDepois = fotos.some(f => f.tipo === 'depois');
                    if (!hasAntes || !hasDepois) {
                        return; // Skip this visit
                    }
                }

                const card = document.createElement('div');
                card.className = 'glass-card rounded-xl shadow-lg border border-slate-700/50 hover:border-slate-600 transition-colors animate-fade-in-up max-w-xl mx-auto w-full overflow-hidden flex flex-col';

                // Try to resolve client info from fetched data_clients map, fallback to code
                let clientName = 'Cliente Desconhecido';
                let clientInfo = null;
                if (visit.client_code) {
                    const cleanCode = String(visit.client_code).trim();
                    if (clientNamesMap.has(cleanCode) && clientNamesMap.get(cleanCode)) {
                        clientInfo = { ...clientNamesMap.get(cleanCode), latitude: visit.latitude, longitude: visit.longitude };
                        clientName = clientInfo.nome;
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
                    statusHtml = '<svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Aprovada"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
                } else if (visit.status === 'REJECTED') {
                    statusHtml = '<svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Rejeitada"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
                } else {
                    statusHtml = '<svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Pendente"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
                }

                // Answers and photos were already extracted above for filtering.


                // Building the horizontal carousel HTML
                let fotosHtml = '';
                if (fotos.length > 0) {
                    const carouselId = 'carousel-' + visit.id;
                    fotosHtml += `<div class="relative w-full group">`;

                    // The scroll container
                    fotosHtml += `<div id="${carouselId}" class="flex overflow-x-auto snap-x snap-mandatory w-full bg-slate-900 border-y border-slate-800 scroll-smooth" style="scrollbar-width: none;" onscroll="window.FeedVisitas.updateCarouselIndicator('${carouselId}', ${fotos.length})">`;

                    fotos.forEach((foto, index) => {
                        const url = foto.url;
                        if (!url) return;

                        const tipo = (foto.tipo || '').toLowerCase();
                        let badgeHtml = '';
                        if (tipo === 'antes' || tipo === 'depois') {
                            const badgeText = tipo === 'antes' ? 'ANTES' : 'DEPOIS';
                            badgeHtml = `
                                <div class="absolute bottom-2 left-2 z-20 px-2 py-1 rounded text-[10px] font-bold text-white tracking-wider"
                                     style="background-color: rgba(255, 94, 0, 0.7); backdrop-filter: blur(4px);">
                                    ${badgeText}
                                </div>
                            `;
                        }

                        const locationBtnHtml = `
                            <button onclick="window.FeedVisitas.openLocationModal(${visit.id})" class="absolute top-2 right-2 z-20 bg-black/50 hover:bg-[#FF5E00] text-white p-1.5 rounded-full backdrop-blur-sm transition-colors border border-white/20 shadow-lg" title="Ver Localização">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                </svg>
                            </button>
                        `;


                        let originalUrl = url;
                        try {
                            const u = new URL(url);
                            u.searchParams.delete('width');
                            u.searchParams.delete('height');
                            u.searchParams.delete('quality');
                            originalUrl = u.toString();
                        } catch(e) {
                            originalUrl = url.split('?')[0];
                        }

                        fotosHtml += `
                            <div class="relative flex-none min-w-full aspect-square overflow-hidden snap-center bg-slate-800 flex items-center justify-center text-slate-500 cursor-pointer group/img" onclick="window.FeedVisitas.scrollCarousel('${carouselId}', 1)">
                                <img src="${url}" class="w-full h-full object-cover absolute inset-0 z-10 transition-transform duration-500 group-hover/img:scale-105" loading="lazy" alt="Foto da Visita" onerror="this.onerror=null; this.parentElement.classList.add('image-error'); this.style.display='none'; this.nextElementSibling.classList.remove('hidden'); this.nextElementSibling.classList.add('flex');">
                                <div class="absolute inset-0 z-15 bg-black/0 group-hover/img:bg-black/10 transition-colors pointer-events-none"></div>

                                <button onclick="window.FeedVisitas.openImageModal('${originalUrl}'); event.stopPropagation();" class="absolute bottom-2 right-2 z-20 bg-black/50 hover:bg-[#FF5E00] text-white p-2 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover/img:opacity-100 shadow-lg border border-white/20" title="Ver imagem original">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                                </button>

                                <div class="hidden z-0 flex-col items-center justify-center text-xs text-slate-500 gap-2">
                                    <i class="fas fa-image text-2xl mb-1"></i>
                                    <span>Imagem indisponível</span>
                                </div>
                                ${badgeHtml}
                                ${locationBtnHtml}
                            </div>
                        `;
                    });
                    fotosHtml += `</div>`;

                    if (fotos.length > 1) {
                        // Left Arrow
                        fotosHtml += `
                            <button onclick="window.FeedVisitas.scrollCarousel('${carouselId}', -1); event.stopPropagation();" class="absolute left-2 top-1/2 -translate-y-1/2 z-30 bg-black/40 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100 touch-pan-y" style="opacity: 0.8;">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                            </button>
                        `;
                        // Right Arrow
                        fotosHtml += `
                            <button onclick="window.FeedVisitas.scrollCarousel('${carouselId}', 1); event.stopPropagation();" class="absolute right-2 top-1/2 -translate-y-1/2 z-30 bg-black/40 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100 touch-pan-y" style="opacity: 0.8;">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                            </button>
                        `;
                        // Counter Badge
                        fotosHtml += `
                            <div id="${carouselId}-indicator" class="absolute top-2 right-2 z-20 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm tracking-widest shadow-lg opacity-0 transition-opacity duration-300 pointer-events-none">
                                1 / ${fotos.length}
                            </div>
                        `;
                    }

                    fotosHtml += `</div>`;
                }

                // Building answers summary (like Instagram captions)
                let resumoRespostasHtml = '';
                if (respostasObj && typeof respostasObj === 'object') {
                    const chavesOcultas = ['fotos', 'is_off_route', 'observacoes'];
                    let respostasFormatadas = [];
                    for (const [key, value] of Object.entries(respostasObj)) {
                        // Ignorar chaves ocultas e fotos
                        if (chavesOcultas.includes(key) || key.toLowerCase().includes('foto')) continue;
                        
                        // Ignore empty strings
                        if (value === '' || value === null || value === undefined) continue;

                        let label = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
                        // Capitalize each word for label
                        label = label.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                        
                        let valStr = String(value);
                        if (valStr.toLowerCase() === 'true' || valStr.toLowerCase() === 'sim') {
                            valStr = '<span class="text-green-400">Sim</span>';
                        } else if (valStr.toLowerCase() === 'false' || valStr.toLowerCase() === 'nao' || valStr.toLowerCase() === 'não') {
                            valStr = '<span class="text-red-400">Não</span>';
                        } else {
                            valStr = `<span class="text-slate-200">${valStr}</span>`;
                        }

                        respostasFormatadas.push(`<div class="flex justify-between items-center py-1 border-b border-slate-700/30 last:border-0"><span class="text-slate-400 text-xs font-medium">${label}:</span> <span class="text-xs font-semibold">${valStr}</span></div>`);
                    }

                    if (respostasFormatadas.length > 0) {
                        resumoRespostasHtml = `
                            <div class="mt-2">
                                <button onclick="window.FeedVisitas.toggleResumo(this, '${visit.id}')" class="text-sm text-slate-400 font-medium hover:text-slate-200 transition-colors cursor-pointer inline-flex items-center gap-1">
                                    <span>Mais</span>
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                                </button>
                                <div id="resumo-visita-${visit.id}" class="hidden mt-2 bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 transition-all duration-300">
                                    ${respostasFormatadas.join('')}
                                </div>
                            </div>
                        `;
                    }
                }

                // Ensure data is cached for the modal
                if (clientInfo && !window.FeedVisitas.clientCache) window.FeedVisitas.clientCache = {};
                if (clientInfo) {
                    window.FeedVisitas.clientCache[visit.id] = clientInfo;
                }

                
                let dotsHtml = '';
                if (fotos.length > 1) {
                    const dotsArray = Array.from({ length: fotos.length }).map((_, i) => 
                        `<div class="w-1.5 h-1.5 rounded-full carousel-dot ${i === 0 ? 'bg-blue-500' : 'bg-slate-600'} transition-colors duration-300"></div>`
                    ).join('');
                    dotsHtml = `<div id="carousel-${visit.id}-dots" class="flex justify-center items-center gap-1.5 flex-1">${dotsArray}</div>`;
                }

                card.innerHTML = `
                    <div class="p-3 flex flex-col gap-1 border-b border-slate-700/50">
                        <div class="flex items-center gap-2 min-w-0">
                            <p class="text-sm font-bold text-white truncate max-w-[120px]" title="${promotorName}">${promotorName}</p>
                            <span class="text-xs text-[#FF5E00] font-medium truncate flex-1" title="${clientName}">${clientName}</span>
                        </div>
                    </div>
                    ${fotosHtml}
                    <div class="px-4 pt-3 pb-4 flex flex-col gap-2">
                        <!-- Linha 1: Favorito (Esquerda), Dots (Centro), Status (Direita) -->
                        <div class="flex items-center justify-between w-full h-8">
                            <!-- Esquerda: Favorito -->
                            <div class="flex-1 flex justify-start">
                                ${isManager && window.userId ? `
                                <button onclick="window.FeedVisitas.toggleFavorite('${visit.id}', this)" class="p-1 rounded-full transition-all hover:bg-slate-800/50 ${(visit.favoritado_por || []).includes(window.userId) ? 'text-yellow-400 scale-110' : 'text-slate-400 hover:text-white'}" title="Favoritar">
                                    <svg class="w-6 h-6" ${(visit.favoritado_por || []).includes(window.userId) ? 'fill="currentColor"' : 'fill="none"'} stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
                                    </svg>
                                </button>
                                ` : '<div></div>'}
                            </div>

                            <!-- Centro: Dots -->
                            ${dotsHtml}

                            <!-- Direita: Status -->
                            <div class="flex-1 flex justify-end">
                                ${statusHtml}
                            </div>
                        </div>

                        <!-- Linha 2: Data -->
                        <div class="w-full mt-1">
                            <span class="text-[11px] text-slate-500 font-medium uppercase tracking-wide">${formattedDate}</span>
                        </div>

                        ${observacoesTexto && (isManager || String(visit.id_promotor) === String(window.userId)) ? `<div class="text-sm text-slate-300 leading-relaxed mt-2"><span class="font-medium text-white">Obs:</span> ${observacoesTexto}</div>` : ''}
                        ${resumoRespostasHtml}
                    </div>
                `;
                cardsContainer.appendChild(card);
        });

        setupObserver();
    }

    function openLocationModal(visitId) {
        if (!FeedVisitas.clientCache || !FeedVisitas.clientCache[visitId]) return;
        
        const clientInfo = FeedVisitas.clientCache[visitId];
        
        // Ensure modal exists in DOM
        let modal = document.getElementById('feed-location-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'feed-location-modal';
            modal.className = 'fixed inset-0 z-[100] hidden items-center justify-center p-4 bg-black/60 backdrop-blur-sm';
            
            // Close when clicking outside
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeLocationModal();
            });

            document.body.appendChild(modal);
        }

        const nome = clientInfo.nome || 'N/A';
        const cnpj = clientInfo.cnpj || 'N/A';
        const endereco = clientInfo.endereco || 'N/A';
        const lat = clientInfo.latitude;
        const lng = clientInfo.longitude;

        let mapHtml = '';
        if (lat && lng) {
            mapHtml = `<div id="feed-mini-map" class="w-full h-48 rounded-lg mt-4 bg-slate-800 border border-slate-700"></div>`;
        } else {
            mapHtml = `<div class="w-full p-4 rounded-lg mt-4 bg-slate-800/50 border border-slate-700 flex items-center justify-center text-slate-400 text-sm">Sem coordenadas geográficas disponíveis.</div>`;
        }

        modal.innerHTML = `
            <div class="bg-[#1A1E24] w-full max-w-md rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                <div class="px-5 py-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/20">
                    <div class="flex items-center gap-2">
                        <svg class="w-5 h-5 text-[#FF5E00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                        <h3 class="text-white font-semibold text-lg">Detalhes do Cliente</h3>
                    </div>
                    <button onclick="window.FeedVisitas.closeLocationModal()" class="text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-700 p-1.5 rounded-full">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div class="p-5 overflow-y-auto" style="scrollbar-width: thin; scrollbar-color: #334155 transparent;">
                    <div class="space-y-3">
                        <div>
                            <p class="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1">Nome</p>
                            <p class="text-white text-sm font-medium">${nome}</p>
                        </div>
                        <div>
                            <p class="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1">CNPJ</p>
                            <p class="text-white text-sm font-medium">${cnpj}</p>
                        </div>
                        <div>
                            <p class="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1">Endereço</p>
                            <p class="text-slate-300 text-sm">${endereco}</p>
                        </div>
                    </div>
                    ${mapHtml}
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        // Initialize Map if coords exist
        if (lat && lng && window.L) {
            // Need a slight delay for DOM to render the container before Leaflet can size it
            setTimeout(() => {
                const mapEl = document.getElementById('feed-mini-map');
                if (mapEl) {
                    const map = window.L.map('feed-mini-map', {
                        center: [lat, lng],
                        zoom: 15,
                        zoomControl: false,
                        attributionControl: false
                    });
                    
                    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                        maxZoom: 19
                    }).addTo(map);

                    const customIcon = window.L.divIcon({
                        className: 'custom-pin',
                        html: `<div class="w-4 h-4 bg-[#FF5E00] rounded-full border-2 border-white shadow-[0_0_10px_rgba(255,94,0,0.8)] animate-pulse"></div>`,
                        iconSize: [16, 16],
                        iconAnchor: [8, 8]
                    });

                    window.L.marker([lat, lng], { icon: customIcon }).addTo(map);
                }
            }, 100);
        }
    }

    function closeLocationModal() {
        const modal = document.getElementById('feed-location-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            modal.innerHTML = ''; // clear map instance
        }
    }


    function scrollCarousel(carouselId, direction) {
        const container = document.getElementById(carouselId);
        if (container) {
            const width = container.offsetWidth;
            container.scrollBy({ left: width * direction, behavior: 'smooth' });
        }
    }

    function updateCarouselIndicator(carouselId, total) {
        const container = document.getElementById(carouselId);
        const indicator = document.getElementById(carouselId + '-indicator');
        if (container) {
            const width = container.offsetWidth;
            const scrollLeft = container.scrollLeft;
            const currentIndex = Math.round(scrollLeft / width) + 1;
            
            if (indicator) {
                indicator.textContent = currentIndex + ' / ' + total;
                // Show indicator briefly
                indicator.classList.remove('opacity-0');
                indicator.classList.add('opacity-100');
                
                clearTimeout(indicator.hideTimeout);
                indicator.hideTimeout = setTimeout(() => {
                    indicator.classList.remove('opacity-100');
                    indicator.classList.add('opacity-0');
                }, 1500);
            }

            // Update dots
            const dotsContainer = document.getElementById(carouselId + '-dots');
            if (dotsContainer) {
                const dots = dotsContainer.querySelectorAll('.carousel-dot');
                dots.forEach((dot, index) => {
                    if (index === (currentIndex - 1)) {
                        dot.classList.replace('bg-slate-600', 'bg-blue-500'); // Active color like Instagram
                    } else {
                        dot.classList.replace('bg-blue-500', 'bg-slate-600'); // Inactive color
                    }
                });
            }
        }
    }

    function toggleResumo(btnElement, visitId) {

        const container = document.getElementById('resumo-visita-' + visitId);
        const icon = btnElement.querySelector('svg');
        const textSpan = btnElement.querySelector('span');
        if (container) {
            if (container.classList.contains('hidden')) {
                container.classList.remove('hidden');
                if (textSpan) textSpan.textContent = 'Menos';
                if (icon) icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>';
            } else {
                container.classList.add('hidden');
                if (textSpan) textSpan.textContent = 'Mais';
                if (icon) icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>';
            }
        }
    }


    function openImageModal(originalUrl) {
        let modal = document.getElementById('feed-image-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'feed-image-modal';
            modal.className = 'fixed inset-0 z-[150] hidden items-center justify-center bg-black/95 backdrop-blur-sm cursor-zoom-out touch-none';

            modal.addEventListener('click', () => closeImageModal());

            const imgContainer = document.createElement('div');
            imgContainer.className = 'relative w-full h-full max-w-7xl mx-auto p-4 flex items-center justify-center';

            const closeBtn = document.createElement('button');
            closeBtn.className = 'absolute top-4 right-4 z-[160] text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-all cursor-pointer backdrop-blur-md shadow-xl border border-white/10';
            closeBtn.innerHTML = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                closeImageModal();
            };
            imgContainer.appendChild(closeBtn);

            const imgEl = document.createElement('img');
            imgEl.id = 'feed-modal-image';
            imgEl.className = 'max-w-full max-h-[90vh] object-contain drop-shadow-2xl rounded pointer-events-auto cursor-default';

            imgContainer.appendChild(imgEl);
            modal.appendChild(imgContainer);

            document.body.appendChild(modal);
        }


        const modalEl = document.getElementById('feed-image-modal');
        const imgEl = document.getElementById('feed-modal-image');

        if (imgEl) {
            imgEl.src = '';
            imgEl.src = originalUrl;
        }

        modalEl.classList.remove('hidden');
        modalEl.classList.add('flex');
        document.body.style.overflow = 'hidden';

        // Add Escape key listener
        const escHandler = function(e) {
            if (e.key === 'Escape') {
                closeImageModal();
            }
        };
        document.addEventListener('keydown', escHandler);
        modalEl._escHandler = escHandler;
    }

    function closeImageModal() {
        const modal = document.getElementById('feed-image-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');

            const imgEl = document.getElementById('feed-modal-image');
            if (imgEl) {
                imgEl.src = '';
            }
            document.body.style.overflow = '';
            
            // Remove Escape key listener
            if (modal._escHandler) {
                document.removeEventListener('keydown', modal._escHandler);
                delete modal._escHandler;
            }
        }
    }

    return {
        openFavoritesModal,
        applyFavoritesFilter,
        clearFavoritesFilter,
        toggleFavorite,
        scrollCarousel,
        updateCarouselIndicator,
        toggleResumo,
        init,
        openLocationModal,
        closeLocationModal,
        openImageModal,
        closeImageModal,
        clientCache: {}
    };
})();

window.FeedVisitas = FeedVisitas;
console.log("FeedVisitas Simples (Simplificado) carregado.");
