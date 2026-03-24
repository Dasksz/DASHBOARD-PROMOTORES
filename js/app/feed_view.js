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
        feedCurrentClientFilter = ''; feedCurrentCityFilter = ''; feedCurrentFilialFilter = 'all'; feedCurrentPromotorFilter = '';
        updateFiltersUI();
    let flatpickrInstance = null;

    // State Filtros
    let feedCurrentClientFilter = '';
    let feedCurrentCityFilter = '';
    let feedCurrentFilialFilter = 'all';
    let feedCurrentPromotorFilter = '';


    // DOM 
    let container;
    let cardsContainer;
    let loadingIndicator;
    let errorContainer;
    let periodInfo;

    function checkIsManager() {
        const role = (window.userRole || '').trim().toLowerCase();
        const hierarchyRole = typeof window.userHierarchyContext !== 'undefined' && window.userHierarchyContext ? window.userHierarchyContext.role : '';
        const isPromoter = window.userIsPromoter || hierarchyRole === 'promotor' || (typeof window.optimizedData !== 'undefined' && window.optimizedData.promotorMap && window.optimizedData.promotorMap.has((window.userRole || '').trim().toUpperCase()));
        const isAdmin = role === 'adm';
        const isCoord = (hierarchyRole === 'coord' || hierarchyRole === 'cocoord') && !isPromoter;
        const isSup = window.userIsSupervisor || hierarchyRole === 'supervisor' || role === 'supervisor';
        const isManager = isAdmin || isCoord || isSup;
        return { isManager, isAdmin, isCoord, isSup, isPromoter, role, hierarchyRole };
    }

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

        setupFiltersUI();
        
        // Setup Favorites Buttons Visibility based on user role
        const { isManager } = checkIsManager();

        if (!isManager) {
            document.getElementById('feed-favorites-btn')?.classList.add('hidden');
            document.getElementById('feed-clear-favorites-btn')?.classList.add('hidden');
        }
    }

    
    function setupFiltersUI() {
        const toggleBtn = document.getElementById('feed-toggle-filters-btn');
        const panel = document.getElementById('feed-filters-panel');
        const clearBtn = document.getElementById('feed-clear-all-filters-btn');

        if (toggleBtn && panel) {
            toggleBtn.onclick = () => {
                panel.classList.toggle('hidden');
                if (!panel.classList.contains('hidden')) {
                    populateFiltersDropdowns();
                }
            };
        }

        if (clearBtn) {
            clearBtn.onclick = () => {
                feedCurrentClientFilter = '';
                feedCurrentCityFilter = '';
                feedCurrentFilialFilter = 'all';
                feedCurrentPromotorFilter = '';
                updateFiltersUI();
                loadFeed(true);
            };
        }

        const clientInput = document.getElementById('feed-client-filter');
        const cityInput = document.getElementById('feed-city-filter');
        
        if(clientInput) {
            clientInput.addEventListener('input', (e) => { feedCurrentClientFilter = e.target.value.toLowerCase(); checkClearBtn(); delayedLoadFeed(); });
        }
        if(cityInput) {
            cityInput.addEventListener('input', (e) => { feedCurrentCityFilter = e.target.value.toLowerCase(); checkClearBtn(); delayedLoadFeed(); });
        }

        // Setup radio filial
        const filialRadios = document.querySelectorAll('input[name="feed-filial"]');
        filialRadios.forEach(r => {
            r.addEventListener('change', (e) => {
                feedCurrentFilialFilter = e.target.value;
                document.getElementById('feed-filial-filter-text').textContent = e.target.parentElement.textContent.trim();
                document.getElementById('feed-filial-filter-dropdown').classList.add('hidden');
                checkClearBtn();
                loadFeed(true);
            });
        });

        // Setup drop filial toggle
        const filialBtn = document.getElementById('feed-filial-filter-btn');
        if(filialBtn) {
            filialBtn.onclick = (e) => {
                e.stopPropagation();
                document.getElementById('feed-filial-filter-dropdown').classList.toggle('hidden');
                document.getElementById('feed-promotor-filter-dropdown').classList.add('hidden');
            };
        }
        
        // Setup drop promotor toggle
        const promBtn = document.getElementById('feed-promotor-filter-btn');
        if(promBtn) {
            promBtn.onclick = (e) => {
                e.stopPropagation();
                document.getElementById('feed-promotor-filter-dropdown').classList.toggle('hidden');
                document.getElementById('feed-filial-filter-dropdown').classList.add('hidden');
            };
        }

        document.addEventListener('click', (e) => {
            if(!e.target.closest('#feed-filial-filter-dropdown') && !e.target.closest('#feed-filial-filter-btn')) {
                document.getElementById('feed-filial-filter-dropdown')?.classList.add('hidden');
            }
            if(!e.target.closest('#feed-promotor-filter-dropdown') && !e.target.closest('#feed-promotor-filter-btn')) {
                document.getElementById('feed-promotor-filter-dropdown')?.classList.add('hidden');
            }
        });
    }

    let loadFeedTimeout;
    function delayedLoadFeed() {
        clearTimeout(loadFeedTimeout);
        loadFeedTimeout = setTimeout(() => {
            loadFeed(true);
        }, 500);
    }

    function checkClearBtn() {
        const btn = document.getElementById('feed-clear-all-filters-btn');
        if(btn) {
            if(feedCurrentClientFilter || feedCurrentCityFilter || feedCurrentFilialFilter !== 'all' || feedCurrentPromotorFilter) {
                btn.classList.remove('hidden');
            } else {
                btn.classList.add('hidden');
            }
        }
    }

    function updateFiltersUI() {
        const clientInput = document.getElementById('feed-client-filter');
        const cityInput = document.getElementById('feed-city-filter');
        if(clientInput) clientInput.value = feedCurrentClientFilter;
        if(cityInput) cityInput.value = feedCurrentCityFilter;

        document.getElementById('feed-filial-filter-text').textContent = 'Todas (05 + 08)';
        document.querySelectorAll('input[name="feed-filial"]').forEach(r => r.checked = (r.value === 'all'));

        document.getElementById('feed-promotor-filter-text').textContent = 'Todos';
        checkClearBtn();
    }

    function populateFiltersDropdowns() {
        // Promotores from hierarchy or dataset
        const drop = document.getElementById('feed-promotor-filter-dropdown');
        if(!drop) return;
        
        let promotores = [];
        if(window.embeddedData && window.embeddedData.hierarchy) {
            promotores = [...new Set(window.embeddedData.hierarchy.map(h => h.nome_promotor).filter(n => n))].sort();
        }

        let html = `<div class="p-2 hover:bg-slate-700 cursor-pointer rounded text-sm text-slate-300" onclick="window.FeedVisitas.setPromotorFilter('')">Todos</div>`;
        promotores.forEach(p => {
            html += `<div class="p-2 hover:bg-slate-700 cursor-pointer rounded text-sm text-slate-300" onclick="window.FeedVisitas.setPromotorFilter('${p}')">${window.escapeHtml(p)}</div>`;
        });
        drop.innerHTML = html;
    }

    function setPromotorFilter(val) {
        feedCurrentPromotorFilter = val;
        document.getElementById('feed-promotor-filter-text').textContent = val ? window.escapeHtml(val) : 'Todos';
        document.getElementById('feed-promotor-filter-dropdown').classList.add('hidden');
        checkClearBtn();
        loadFeed(true);
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
                .select('id', { count: 'estimated', head: true })
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

        document.getElementById('feed-clear-favorites-btn')?.classList.remove('hidden');
        if (document.getElementById('feed-favorites-btn')) {
            document.getElementById('feed-favorites-btn').classList.add('hidden');
        }

        // Remove filters that might be blocking favorites from other promoters
        const isManager = true; // Always allow viewing favorites regardless of role

        loadFeed(true);
    }

    function clearFavoritesFilter() {
        showOnlyFavorites = false;

        const { isManager } = checkIsManager();

        document.getElementById('feed-clear-favorites-btn')?.classList.add('hidden');
        if (isManager) {
            document.getElementById('feed-favorites-btn')?.classList.remove('hidden');
        }

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
                    closeOnSelect: false,
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
            .select(`id, created_at, checkout_at, client_code, observacao, respostas, status, id_promotor, profiles:id_promotor(name, role, avatar_url), favoritado_por, latitude, longitude, promotor_name`)
            .gte('created_at', currentStartBound.toISOString())
            .lte('created_at', currentEndBound.toISOString())
            .order('created_at', { ascending: false });

        if (showOnlyFavorites && window.userId) {
            query = query.filter('favoritado_por', 'cs', `{${window.userId}}`);
        }

        query = query.range(from, to);

        const { role, hierarchyRole, isPromoter, isAdmin, isCoord, isSup, isManager } = checkIsManager();
        const isSeller = window.userIsSeller || hierarchyRole === 'vendedor' || hierarchyRole === 'seller';
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
                    .select('codigo_cliente, nomecliente, cnpj_cpf, endereco, rca1, cidade')
                    .in('codigo_cliente', uniqueClientCodes);

                if (clientsData) {
                    clientsData.forEach(c => {
                        clientNamesMap.set(String(c.codigo_cliente).trim(), {codigo: c.codigo_cliente, nome: c.nomecliente, cnpj: c.cnpj_cpf, endereco: c.endereco, rca1: c.rca1, cidade: c.cidade });
                    });
                }

                // Fetch registered coordinates for these clients
                const { data: coordsData, error: coordsErr } = await window.supabaseClient
                    .from('data_client_coordinates')
                    .select('client_code, lat, lng')
                    .in('client_code', uniqueClientCodes);

                if (coordsData && !coordsErr) {
                    coordsData.forEach(coord => {
                        const cleanCode = String(coord.client_code).trim();
                        if (clientNamesMap.has(cleanCode)) {
                            const existing = clientNamesMap.get(cleanCode);
                            existing.registeredLat = coord.lat;
                            existing.registeredLng = coord.lng;
                            clientNamesMap.set(cleanCode, existing);
                        }
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
                        // Iterate over all answers to extract photos from 'foto' fields AND count actual answers
                        for (const [key, value] of Object.entries(respostasObj)) {
                            if (key.toLowerCase().includes('foto') && value && !Array.isArray(value)) {
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

                        // Also specifically extract photos from 'fotos' array if it exists
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
                        }
                    }
                }

                // Filter 1: Only show visits with photos or answers
                if (fotos.length === 0 && respostasCount === 0) {
                    return; // Skip this visit
                }

                const card = document.createElement('div');
                card.className = 'glass-card rounded-xl shadow-lg border border-slate-700/50 hover:border-slate-600 transition-colors animate-fade-in-up max-w-xl mx-auto w-full overflow-hidden flex flex-col';

                // Try to resolve client info from fetched data_clients map, fallback to code
                
                // Try to resolve client info from fetched data_clients map, fallback to code
                let clientName = 'Cliente Desconhecido';
                let clientInfo = null;
                let clientCity = '';
                let clientCnpj = '';
                if (visit.client_code) {
                    const cleanCode = String(visit.client_code).trim();
                    if (clientNamesMap.has(cleanCode) && clientNamesMap.get(cleanCode)) {
                        const cached = clientNamesMap.get(cleanCode);
                        clientInfo = {
                            ...cached,
                            latitude: visit.latitude,
                            longitude: visit.longitude,
                            registeredLat: cached.registeredLat,
                            registeredLng: cached.registeredLng
                        };
                        clientName = clientInfo.nome;
                        clientCity = clientInfo.cidade || '';
                        clientCnpj = clientInfo.cnpj || '';
                    } else {
                        clientName = `Cód: ${visit.client_code}`;
                    }
                }

                let promotorName = visit.promotor_name || (visit.profiles ? visit.profiles.name : 'Promotor');

                // --- FEED FILTERS ---
                if (feedCurrentClientFilter) {
                    const searchStr = `${clientName} ${visit.client_code} ${clientCnpj}`.toLowerCase();
                    if (!searchStr.includes(feedCurrentClientFilter)) return;
                }

                if (feedCurrentCityFilter) {
                    if (!clientCity.toLowerCase().includes(feedCurrentCityFilter)) return;
                }

                if (feedCurrentPromotorFilter) {
                    if (promotorName !== feedCurrentPromotorFilter) return;
                }

                if (feedCurrentFilialFilter !== 'all') {
                    // Try to discover Filial from City using config_city_branches
                    let foundFilial = '';
                    if (clientCity && window.embeddedData && window.embeddedData.config_city_branches) {
                        const cityNorm = clientCity.trim().toUpperCase();
                        const configRow = window.embeddedData.config_city_branches.find(r => (r.cidade || '').trim().toUpperCase() === cityNorm);
                        if (configRow) foundFilial = configRow.filial;
                    }
                    if (foundFilial !== feedCurrentFilialFilter) return;
                }

                let avatarUrl = visit.profiles ? visit.profiles.avatar_url : null;
                let avatarHtml = '';

                if (avatarUrl) {
                    avatarHtml = `<img src="${avatarUrl}" class="w-8 h-8 rounded-full object-cover border border-slate-700 mr-2 flex-shrink-0" alt="Avatar">`;
                } else {
                    const initials = promotorName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                    // Generate a random background color based on name
                    const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'];
                    const colorIndex = promotorName.length % colors.length;
                    const bgColor = colors[colorIndex];

                    avatarHtml = `
                        <div class="w-8 h-8 rounded-full ${bgColor} border border-slate-700 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0">
                            ${initials}
                        </div>
                    `;
                }

                // --- NOVO: Lógica para buscar Vendedor, Supervisor e Co-coordenador ---
                let nomeVendedor = '-';
                let nomeSupervisor = '-';
                let nomeCoCoordenador = '-';
                
                try {
                    const clientCodeForLookup = visit.client_code ? String(visit.client_code).trim() : '';

                    // 1. Vendedor (Manteve-se a lógica original baseada no RCA1 do cliente)
                    if (clientInfo && clientInfo.rca1) {
                        const rca = String(clientInfo.rca1).trim();
                        if (window.maps && window.maps.vendedores && window.maps.vendedores.has(rca)) {
                            nomeVendedor = window.maps.vendedores.get(rca) || '-';
                        }
                    }
                    
                    if (clientCodeForLookup) {
                        // 2. Supervisor (Baseado na venda mais recente do cliente)
                        let mostRecentSale = null;
                        let maxDateValue = -Infinity;

                        const parseSaleDate = (val) => {
                            if (!val) return -Infinity;
                            if (val instanceof Date) return val.getTime();
                            if (typeof val === 'number') {
                                if (val < 1000000) {
                                    // Excel serial date (e.g. 45300) -> Convert to ms timestamp
                                    const ts = Math.round((val - 25569) * 86400 * 1000);
                                    return ts + new Date(ts).getTimezoneOffset() * 60000;
                                }
                                return val; // Already a timestamp
                            }
                            if (typeof val === 'string') {
                                // Tenta converter datas do tipo DD/MM/YYYY
                                if (val.includes('/')) {
                                    const parts = val.split('/');
                                    if (parts.length === 3) {
                                        // Assume DD/MM/YYYY
                                        const d = new Date(parts[2], parts[1] - 1, parts[0]);
                                        if (!isNaN(d.getTime())) return d.getTime();
                                    }
                                }
                                val = val.replace(' ', 'T').replace('+00', 'Z');
                            }
                            const d = new Date(val);
                            return isNaN(d.getTime()) ? -Infinity : d.getTime();
                        };

                        const checkSales = (salesData) => {
                            if (!salesData) return;

                            // Tratar formato colunar (window.embeddedData.isColumnar === true)
                            if (window.embeddedData && window.embeddedData.isColumnar && Array.isArray(salesData) && salesData.length > 0 && Array.isArray(salesData[0])) {
                                // Encontrar os índices das colunas relevantes
                                const headers = salesData.map(col => String(col[0] || '').toUpperCase());
                                const codCliIdx = headers.findIndex(h => h === 'CODCLI' || h === 'COD_CLI');
                                const codSupIdx = headers.findIndex(h => h === 'CODSUPERVISOR' || h === 'COD_SUPERVISOR');
                                const dtPedIdx = headers.findIndex(h => h === 'DTPED' || h === 'DT_PED');

                                if (codCliIdx !== -1 && codSupIdx !== -1 && dtPedIdx !== -1) {
                                    const codCliArr = salesData[codCliIdx];
                                    const codSupArr = salesData[codSupIdx];
                                    const dtPedArr = salesData[dtPedIdx];

                                    const len = codCliArr.length;
                                    for (let i = 1; i < len; i++) {
                                        const codCli = codCliArr[i];
                                        if (codCli !== undefined && codCli !== null && String(codCli).trim() === clientCodeForLookup) {
                                            const codSup = codSupArr[i];
                                            if (codSup !== undefined && codSup !== null && String(codSup).trim() !== '') {
                                                const dtPed = dtPedArr[i];
                                                const dValue = parseSaleDate(dtPed);
                                                if (dValue > maxDateValue) {
                                                    maxDateValue = dValue;
                                                    mostRecentSale = {
                                                        CODSUPERVISOR: codSup
                                                    };
                                                }
                                            }
                                        }
                                    }
                                }
                            } else if (Array.isArray(salesData)) {
                                // Formato array de objetos padrão
                                for (let i = 0; i < salesData.length; i++) {
                                    const s = salesData[i];
                                    if (!s) continue;

                                    const codCli = s.CODCLI !== undefined ? s.CODCLI : (s.codcli !== undefined ? s.codcli : (s.cod_cli !== undefined ? s.cod_cli : s.COD_CLI));
                                    const codSup = s.CODSUPERVISOR !== undefined ? s.CODSUPERVISOR : (s.codsupervisor !== undefined ? s.codsupervisor : (s.cod_supervisor !== undefined ? s.cod_supervisor : s.COD_SUPERVISOR));
                                    const dtPed = s.DTPED !== undefined ? s.DTPED : (s.dtped !== undefined ? s.dtped : (s.dt_ped !== undefined ? s.dt_ped : s.DT_PED));

                                    if (codCli !== undefined && codCli !== null && String(codCli).trim() === clientCodeForLookup && codSup !== undefined && codSup !== null && String(codSup).trim() !== '') {
                                        const dValue = parseSaleDate(dtPed);
                                        if (dValue > maxDateValue) {
                                            maxDateValue = dValue;
                                            mostRecentSale = {
                                                CODSUPERVISOR: codSup
                                            };
                                        }
                                    }
                                }
                            }
                        };

                        if (window.embeddedData) {
                            checkSales(window.embeddedData.detailed);
                            checkSales(window.embeddedData.history);
                        }

                        if (mostRecentSale && mostRecentSale.CODSUPERVISOR) {
                            const codSup = String(mostRecentSale.CODSUPERVISOR).trim();
                            // 1. Tentar mapeamento do window.maps
                            if (window.maps && window.maps.supervisores && window.maps.supervisores.has(codSup)) {
                                nomeSupervisor = window.maps.supervisores.get(codSup);
                            } 
                            // 2. Tentar raw window.embeddedData.dim_supervisores (onde os dados estão disponíveis desde o init)
                            else if (window.embeddedData && window.embeddedData.dim_supervisores && Array.isArray(window.embeddedData.dim_supervisores)) {
                                const dimSup = window.embeddedData.dim_supervisores.find(s => {
                                    const c = s.codigo !== undefined ? s.codigo : (s.CODIGO !== undefined ? s.CODIGO : (s.codigo_supervisor !== undefined ? s.codigo_supervisor : s.CODIGO_SUPERVISOR));
                                    return c !== undefined && c !== null && String(c).trim() === codSup;
                                });
                                if (dimSup) {
                                    nomeSupervisor = dimSup.nome || dimSup.NOME || dimSup.nome_supervisor || dimSup.NOME_SUPERVISOR || '-';
                                }
                            }
                        }
                        
                        // 3. Co-coordenador (Baseado na tabela data_client_promoters e data_hierarchy)
                        if (window.embeddedData && window.embeddedData.clientPromotersMap && window.embeddedData.hierarchy) {
                            let promoterRow = null;
                            const matches = window.embeddedData.clientPromotersMap.get(normalizeKey(clientCodeForLookup));
                            if (matches && matches.length > 0) promoterRow = matches[0];
                            
                            if (promoterRow && promoterRow.promoter_code) {
                                // Normaliza o promoter_code
                                const normalizedPromoterCode = String(promoterRow.promoter_code)
                                    .trim()
                                    .toUpperCase()
                                    .normalize('NFD')
                                    .replace(/[\u0300-\u036f]/g, "");

                                const hierarquiaRow = window.embeddedData.hierarchy.find(h => {
                                    if (!h.cod_promotor) return false;
                                    const hCod = String(h.cod_promotor)
                                        .trim()
                                        .toUpperCase()
                                        .normalize('NFD')
                                        .replace(/[\u0300-\u036f]/g, "");
                                    return hCod === normalizedPromoterCode;
                                });

                                if (hierarquiaRow) {
                                    nomeCoCoordenador = hierarquiaRow.nome_cocoord || hierarquiaRow.cod_cocoord || '-';
                                }
                            }
                        }
                    }
                    
                    // Pegar apenas o primeiro nome para não quebrar a linha
                    const pVendedor = nomeVendedor !== '-' ? nomeVendedor.split(' ')[0] : '-';
                    const pSupervisor = nomeSupervisor !== '-' ? nomeSupervisor.split(' ')[0] : '-';
                    const pCoCoordenador = nomeCoCoordenador !== '-' ? nomeCoCoordenador.split(' ')[0] : '-';
                    
                    // Formatar string secundária
                    var secondaryInfoHtml = `
                        <div class="w-full flex items-center text-[10px] text-slate-400 font-medium tracking-wide truncate mt-0.5">
                            Coord.: ${window.escapeHtml(pCoCoordenador)} <span class="mx-1 text-slate-600">•</span> Sup.: ${window.escapeHtml(pSupervisor)} <span class="mx-1 text-slate-600">•</span> Vend.: ${window.escapeHtml(pVendedor)}
                        </div>
                    `;
                } catch (e) {
                    console.error('Erro ao resolver info secundaria do feed', e);
                    var secondaryInfoHtml = '';
                }
                // ----------------------------------------------------------------------


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
                        
                        let valStr = window.escapeHtml(String(value));
                        if (valStr.toLowerCase() === 'true' || valStr.toLowerCase() === 'sim') {
                            valStr = '<span class="text-green-400">Sim</span>';
                        } else if (valStr.toLowerCase() === 'false' || valStr.toLowerCase() === 'nao' || valStr.toLowerCase() === 'não') {
                            valStr = '<span class="text-red-400">Não</span>';
                        } else {
                            valStr = `<span class="text-slate-200">${valStr}</span>`;
                        }

                        respostasFormatadas.push(`<div class="flex justify-between items-center py-1 border-b border-slate-700/30 last:border-0"><span class="text-slate-400 text-xs font-medium">${window.escapeHtml(label)}:</span> <span class="text-xs font-semibold">${valStr}</span></div>`);
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
                            ${avatarHtml}
                            <div class="flex flex-col min-w-0 flex-1">
                                <p class="text-sm font-bold text-white truncate w-full" title="${window.escapeHtml(promotorName)}">${window.escapeHtml(promotorName)}</p>
                                <span class="text-xs text-[#FF5E00] font-medium truncate w-full" title="${window.escapeHtml(clientName)}">${window.escapeHtml(clientName)}</span>
                            </div>
                        </div>
                        ${secondaryInfoHtml}
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

                        ${observacoesTexto && (isManager || isSeller || String(visit.profiles?.role).toUpperCase() === String(window.userRole || '').toUpperCase()) ? `<div class="text-sm text-slate-300 leading-relaxed mt-2"><span class="font-medium text-white">Obs:</span> ${window.escapeHtml(observacoesTexto)}</div>` : ''}
                        ${(isManager || isSeller || String(visit.profiles?.role).toUpperCase() === String(window.userRole || '').toUpperCase()) ? resumoRespostasHtml : ''}
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

        const nomeRaw = clientInfo.nome || 'N/A';
        const codigo = clientInfo.codigo ? String(clientInfo.codigo).trim() : null;
        const nome = codigo ? `${codigo} - ${nomeRaw}` : nomeRaw;
        const cidade = clientInfo.cidade ? String(clientInfo.cidade).toUpperCase() : '';
        const cnpj = clientInfo.cnpj || 'N/A';
        const endereco = clientInfo.endereco || 'N/A';
        const lat = clientInfo.latitude;
        const lng = clientInfo.longitude;
        const regLat = clientInfo.registeredLat;
        const regLng = clientInfo.registeredLng;

        const hasVisitCoords = lat != null && lng != null;
        const hasRegCoords = regLat != null && regLng != null;

        let mapHtml = '';
        let legendHtml = '';

        if (hasVisitCoords || hasRegCoords) {
            mapHtml = `<div id="feed-mini-map" class="w-full h-48 rounded-lg mt-4 bg-slate-200 border border-slate-700"></div>`;

            if (hasVisitCoords && hasRegCoords) {
                legendHtml = `
                    <div class="mt-3 flex flex-col gap-2 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-full bg-[#FF5E00] shadow-[0_0_8px_rgba(255,94,0,0.8)]"></div>
                            <span class="text-xs text-slate-300">Local da Visita</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                            <span class="text-xs text-slate-300">Local Cadastrado no Cliente</span>
                        </div>
                        <div id="feed-distance-info" class="text-xs text-slate-400 mt-1 font-medium hidden">
                            Distância: <span id="feed-distance-val" class="text-white"></span>
                        </div>
                    </div>
                `;
            } else if (hasRegCoords) {
                legendHtml = `
                    <div class="mt-3 flex items-center gap-2 bg-slate-800/50 p-2 rounded border border-slate-700">
                        <div class="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                        <span class="text-xs text-slate-300">Apenas Local Cadastrado disponível</span>
                    </div>
                `;
            } else if (hasVisitCoords) {
                legendHtml = `
                    <div class="mt-3 flex items-center gap-2 bg-slate-800/50 p-2 rounded border border-slate-700">
                        <div class="w-3 h-3 rounded-full bg-[#FF5E00] shadow-[0_0_8px_rgba(255,94,0,0.8)]"></div>
                        <span class="text-xs text-slate-300">Apenas Local da Visita disponível</span>
                    </div>
                `;
            }
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
                            <p class="text-white text-sm font-medium">${window.escapeHtml(nome)}</p>
                        </div>
                        <div>
                            <p class="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1">CNPJ</p>
                            <p class="text-white text-sm font-medium">${window.escapeHtml(cnpj)}</p>
                        </div>
                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <p class="text-xs text-slate-400 uppercase font-semibold tracking-wider">Endereço</p>
                                ${cidade ? `<p class="text-xs text-slate-400 uppercase font-semibold tracking-wider">Cidade</p>` : ''}
                            </div>
                            <div class="flex justify-between items-start gap-4">
                                <p class="text-slate-300 text-sm flex-1">${window.escapeHtml(endereco)}</p>
                                ${cidade ? `<p class="text-slate-300 text-sm text-right max-w-[50%]">${window.escapeHtml(cidade)}</p>` : ''}
                            </div>
                        </div>
                    </div>
                    ${mapHtml}
                    ${legendHtml}
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        // Initialize Map if coords exist
        if ((hasVisitCoords || hasRegCoords) && window.L) {
            // Need a slight delay for DOM to render the container before Leaflet can size it
            setTimeout(() => {
                const mapEl = document.getElementById('feed-mini-map');
                if (mapEl) {
                    const centerLat = hasVisitCoords ? lat : regLat;
                    const centerLng = hasVisitCoords ? lng : regLng;

                    const map = window.L.map('feed-mini-map', {
                        center: [centerLat, centerLng],
                        zoom: 15,
                        zoomControl: false,
                        attributionControl: false
                    });
                    
                    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                        maxZoom: 19
                    }).addTo(map);

                    const markers = [];

                    if (hasRegCoords) {
                        const regIcon = window.L.divIcon({
                            className: 'custom-pin-reg',
                            html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>`,
                            iconSize: [16, 16],
                            iconAnchor: [8, 8]
                        });
                        markers.push(window.L.marker([regLat, regLng], { icon: regIcon }).addTo(map));
                    }

                    if (hasVisitCoords) {
                        const visitIcon = window.L.divIcon({
                            className: 'custom-pin-visit',
                            html: `<div class="w-4 h-4 bg-[#FF5E00] rounded-full border-2 border-white shadow-[0_0_10px_rgba(255,94,0,0.8)] animate-pulse"></div>`,
                            iconSize: [16, 16],
                            iconAnchor: [8, 8]
                        });
                        markers.push(window.L.marker([lat, lng], { icon: visitIcon }).addTo(map));
                    }

                    if (markers.length > 1) {
                        const group = new window.L.featureGroup(markers);
                        map.fitBounds(group.getBounds(), { padding: [30, 30], maxZoom: 18 });

                        // Calcular a distância
                        const p1 = window.L.latLng(lat, lng);
                        const p2 = window.L.latLng(regLat, regLng);
                        const distanceInMeters = p1.distanceTo(p2);

                        const distInfo = document.getElementById('feed-distance-info');
                        const distVal = document.getElementById('feed-distance-val');

                        if (distInfo && distVal) {
                            distInfo.classList.remove('hidden');
                            if (distanceInMeters < 1000) {
                                distVal.textContent = Math.round(distanceInMeters) + ' m';
                            } else {
                                distVal.textContent = (distanceInMeters / 1000).toFixed(2).replace('.', ',') + ' km';
                            }

                            // Se a distância for muito grande, dar um destaque vermelho
                            if (distanceInMeters > 500) {
                                distVal.classList.add('text-red-400');
                                distVal.classList.remove('text-white');
                            }
                        }
                    } else if (markers.length === 1) {
                        map.setView(markers[0].getLatLng(), 16);
                    }
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
            modal.className = 'modal-overlay fixed inset-0 z-[150] hidden items-center justify-center bg-black/95 backdrop-blur-sm cursor-zoom-out touch-none';

            modal.addEventListener('click', () => closeImageModal());

            const imgContainer = document.createElement('div');
            imgContainer.className = 'relative w-full h-full max-w-7xl mx-auto p-4 flex items-center justify-center';

            const closeBtn = document.createElement('button');
            closeBtn.id = 'feed-modal-close-btn'; // Required for global ESC handler
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
        clientCache: {},
        setPromotorFilter
    };
})();

window.FeedVisitas = FeedVisitas;
console.log("FeedVisitas Simples (Simplificado) carregado.");
