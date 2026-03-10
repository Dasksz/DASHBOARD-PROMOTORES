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

        resetFeed();
        hideError();
        if (loadingIndicator) loadingIndicator.classList.remove('hidden');
        if (periodInfo) periodInfo.textContent = 'Carregando...';

        try {
            console.log("FeedVisitas: Buscando dados iniciais...");

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
            
            // Format for display
            const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
            const monthName = monthNames[contextDate.getUTCMonth()];
            const year = contextDate.getUTCFullYear();
            if (periodInfo) {
                periodInfo.textContent = `Mês: ${monthName}/${year}`;
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
                        <p class="text-slate-300 font-medium">Nenhuma visita registrada no mês atual (${monthName}/${year}).</p>
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
            .select(`id, created_at, checkout_at, client_code, observacao, respostas, status, id_promotor, profiles:id_promotor(name)`)
            .gte('created_at', currentStartBound.toISOString())
            .lte('created_at', currentEndBound.toISOString())
            .order('created_at', { ascending: false })
            .range(from, to);

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
                                        urlStr = urlData.publicUrl + '?width=500&quality=60';
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
                                        url = urlData.publicUrl + '?width=500&quality=60';
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
                    statusHtml = '<span class="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Aprovada</span>';
                } else if (visit.status === 'REJECTED') {
                    statusHtml = '<span class="px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">Rejeitada</span>';
                } else {
                    statusHtml = '<span class="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Pendente</span>';
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
                            <div id="${carouselId}-indicator" class="absolute top-2 left-2 z-20 bg-black/50 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm tracking-widest shadow-lg">
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

                card.innerHTML = `
                    <div class="p-4 flex flex-col gap-1 border-b border-slate-700/50">
                        <div class="flex items-center gap-2">
                            <p class="text-sm font-bold text-white truncate max-w-[120px]" title="${promotorName}">${promotorName}</p>
                            <span class="text-xs text-[#FF5E00] font-medium truncate flex-1" title="${clientName}">${clientName}</span>
                        </div>
                    </div>
                    ${fotosHtml}
                    <div class="p-4 flex flex-col gap-2">
                        <div class="flex items-center justify-between w-full mb-1">
                            <span class="text-xs text-slate-400">${formattedDate}</span>
                            ${statusHtml}
                        </div>
                        ${observacoesTexto && (isManager || String(visit.id_promotor) === String(window.userId)) ? `<div class="text-sm text-slate-300 leading-relaxed"><span class="font-medium text-white">Obs:</span> ${observacoesTexto}</div>` : ''}
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
        if (container && indicator) {
            const width = container.offsetWidth;
            const scrollLeft = container.scrollLeft;
            const currentIndex = Math.round(scrollLeft / width) + 1;
            indicator.textContent = currentIndex + ' / ' + total;
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
