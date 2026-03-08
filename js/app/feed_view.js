// Feed Visitas Module

const FeedVisitas = (() => {
    let currentPage = 1;
    const ITEMS_PER_PAGE = 20;
    let isLoading = false;
    let hasMore = true;
    let feedData = [];

    // DOM Elements
    const container = document.getElementById('feed-visitas-view');
    const cardsContainer = document.getElementById('feed-cards-container');
    const loadingIndicator = document.getElementById('feed-loading');
    const dateFilter = document.getElementById('feed-date-filter');
    const promotorFilter = document.getElementById('feed-promotor-filter');
    const clienteFilter = document.getElementById('feed-cliente-filter');

    // Init
    function init() {
        if (!container) return;

        // Setup filters
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dateFilter.value = `${yyyy}-${mm}-${dd}`;

        setupFilters();

        // Setup infinite scroll
        window.addEventListener('scroll', handleScroll);

        // Initial load
        loadFeed();
    }

    // Setup filter event listeners
    function setupFilters() {
        populatePromotorFilter();

        dateFilter.addEventListener('change', () => { resetFeed(); loadFeed(); });
        promotorFilter.addEventListener('change', () => { resetFeed(); loadFeed(); });

        // Debounce for text input
        let debounceTimer;
        clienteFilter.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                resetFeed();
                loadFeed();
            }, 500);
        });
    }

    function populatePromotorFilter() {
        promotorFilter.innerHTML = '<option value="todos">Todos</option>';
        if (typeof dimVendedores !== 'undefined') {
            dimVendedores.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.cod.trim();
                opt.textContent = `${v.nome} (${v.cod})`;
                promotorFilter.appendChild(opt);
            });
        }
    }

    function resetFeed() {
        currentPage = 1;
        hasMore = true;
        feedData = [];
        cardsContainer.innerHTML = '';
        cardsContainer.appendChild(loadingIndicator);
        loadingIndicator.classList.remove('hidden');
    }

    function handleScroll() {
        if (container.classList.contains('hidden') || isLoading || !hasMore) return;

        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        if (scrollTop + clientHeight >= scrollHeight - 300) {
            currentPage++;
            loadFeed();
        }
    }

    async function loadFeed() {
        if (isLoading || !hasMore) return;
        isLoading = true;
        loadingIndicator.classList.remove('hidden');

        try {
            const dateVal = dateFilter.value; // YYYY-MM-DD
            const promotorVal = promotorFilter.value;
            const clienteVal = clienteFilter.value.trim().toLowerCase();

            let query = window.supabaseClient
                .from('visitas')
                .select(`
                    id,
                    created_at,
                    id_promotor,
                    id_cliente,
                    client_code,
                    data_visita,
                    checkout_at,
                    respostas,
                    observacao,
                    status,
                    profiles:id_promotor (name, email)
                `)
                .order('created_at', { ascending: false });

            // Date Filter
            if (dateVal) {
                const startDate = new Date(dateVal + 'T00:00:00').toISOString();
                const endDate = new Date(dateVal + 'T23:59:59').toISOString();
                query = query.gte('created_at', startDate).lte('created_at', endDate);
            }

            // Role / RLS equivalent filtering (Client side fallback just in case)
            const role = (window.userRole || '').trim().toLowerCase();
            const isRestricted = role === 'promotor' || role === 'vendedor' || window.userIsSeller || window.userIsPromoter;

            if (isRestricted) {
                // For restricted users, filter only their own visits (id_promotor = window.userId)
                // Since id_promotor in visitas is auth.users UUID, we can use the RLS or explicit filter
                if (window.userId) {
                    query = query.eq('id_promotor', window.userId);
                }
            }


            // Promotor Filter
            // For simplicity, we apply client side filter for promotor/cliente if it's text based
            // However, we can also filter using data if we resolve it.

            // Pagination
            const from = (currentPage - 1) * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;
            query = query.range(from, to);

            const { data, error } = await query;

            if (error) throw error;

            if (data.length < ITEMS_PER_PAGE) {
                hasMore = false;
            }

            // Client side filtering for text and specific promotor code if needed
            let filteredData = data;

            if (clienteVal) {
                filteredData = filteredData.filter(v => {
                    const clientName = (window.resolveDim('clientes', v.client_code || v.id_cliente) || {nome: ''}).nome.toLowerCase();
                    return clientName.includes(clienteVal) || String(v.client_code).includes(clienteVal);
                });
            }

            // Remove loading indicator temporarily
            loadingIndicator.remove();

            filteredData.forEach(visit => {
                const card = createFeedCard(visit);
                cardsContainer.appendChild(card);
            });

            if (!hasMore && feedData.length === 0 && filteredData.length === 0) {
                 cardsContainer.innerHTML = '<div class="text-center text-slate-400 py-10">Nenhuma visita encontrada.</div>';
            }

            // Re-append loading at the bottom if has more
            if (hasMore) {
                cardsContainer.appendChild(loadingIndicator);
                loadingIndicator.classList.add('hidden'); // hide until next scroll
            }

            feedData = [...feedData, ...filteredData];

        } catch (error) {
            console.error('Error loading feed:', error);
            window.showToast('error', 'Erro ao carregar o feed de visitas.');
        } finally {
            isLoading = false;
        }
    }

    // Helper: MD5 Hash for Gravatar (Simple implementation)
    // For a real app, you might want to include a small md5 library,
    // but for now we can try to use standard crypto or a fallback.
    async function getGravatarUrl(email) {
        if (!email) return null;
        const normalizedEmail = email.trim().toLowerCase();

        try {
            // Use Web Crypto API
            const msgBuffer = new TextEncoder().encode(normalizedEmail);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            // Note: Gravatar uses MD5, but we are using SHA-256 here which Gravatar ALSO supports via sha256!
            // Actually, Gravatar standard is MD5. Since we don't have MD5 easily, we can use ui-avatars as fallback
            return `https://ui-avatars.com/api/?name=${encodeURIComponent(normalizedEmail)}&background=random`;
        } catch (e) {
            return `https://ui-avatars.com/api/?name=${encodeURIComponent(email)}&background=random`;
        }
    }

    function createFeedCard(visit) {
        const card = document.createElement('div');
        card.className = 'glass-card rounded-2xl p-0 overflow-hidden shadow-lg animate-fade-in-up border border-slate-700/50';

        // 1. Resolve Data
        const clientCode = visit.client_code || visit.id_cliente;
        const clientInfo = window.resolveDim('clientes', clientCode) || { nome: 'Cliente Desconhecido' };

        let promotorName = 'Usuário';
        let promotorEmail = '';
        if (visit.profiles) {
            promotorName = visit.profiles.name || visit.profiles.email || 'Usuário';
            promotorEmail = visit.profiles.email || '';
        }

        const dateObj = new Date(visit.checkout_at || visit.created_at);
        const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        // Generate Avatar URL
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(promotorName)}&background=2d3748&color=fff&rounded=true`;

        // 2. Parse Photos
        let fotosHtml = '';
        let fotos = [];

        if (visit.respostas && visit.respostas.fotos && Array.isArray(visit.respostas.fotos)) {
            fotos = visit.respostas.fotos;
        } else if (visit.respostas && visit.respostas.foto_url) {
            fotos = [{ url: visit.respostas.foto_url, tipo: 'geral' }];
        }

        if (fotos.length > 0) {
            const carouselId = `carousel-${visit.id}`;
            const slidesHtml = fotos.map((foto, index) => {
                let badgeClass = 'bg-slate-800/80 text-white';
                let badgeText = 'GERAL';

                if (foto.tipo === 'antes') {
                    badgeClass = 'bg-red-500/80 text-white';
                    badgeText = 'ANTES';
                } else if (foto.tipo === 'depois') {
                    badgeClass = 'bg-green-500/80 text-white';
                    badgeText = 'DEPOIS';
                }

                return `
                    <div class="carousel-item relative w-full flex-shrink-0 snap-center">
                        <img src="${foto.url}" class="w-full h-80 object-cover" alt="Foto da visita" loading="lazy" onclick="window.open('${foto.url}', '_blank')">
                        <div class="absolute top-3 right-3 ${badgeClass} text-xs font-bold px-2 py-1 rounded-md backdrop-blur-sm">
                            ${badgeText}
                        </div>
                    </div>
                `;
            }).join('');

            // Pagination dots
            const dotsHtml = fotos.length > 1 ? `
                <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                    ${fotos.map((_, i) => `<div class="w-2 h-2 rounded-full bg-white/50 ${i===0?'bg-white':''}"></div>`).join('')}
                </div>
            ` : '';

            fotosHtml = `
                <div class="relative w-full overflow-hidden group bg-slate-900">
                    <div id="${carouselId}" class="flex overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth">
                        ${slidesHtml}
                    </div>
                    ${dotsHtml}
                    ${fotos.length > 1 ? `
                    <button class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onclick="FeedVisitas.scrollCarousel('${carouselId}', -1)">❮</button>
                    <button class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onclick="FeedVisitas.scrollCarousel('${carouselId}', 1)">❯</button>
                    ` : ''}
                </div>
            `;
        }

        // 3. Assemble Card
        card.innerHTML = `
            <!-- Header -->
            <div class="p-4 flex items-center gap-3">
                <img src="${avatarUrl}" alt="Avatar" class="w-10 h-10 rounded-full border border-slate-600">
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-white truncate">${promotorName}</p>
                    <p class="text-xs text-brand-orange truncate font-medium flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        ${clientInfo.nome}
                    </p>
                </div>
                <div class="text-xs text-slate-400 whitespace-nowrap">${formattedDate}</div>
            </div>

            <!-- Media -->
            ${fotosHtml}

            <!-- Body -->
            <div class="p-4">
                ${visit.observacao ? `
                <p class="text-sm text-slate-300 mb-3 whitespace-pre-line leading-relaxed"><span class="font-bold text-white">Obs:</span> ${visit.observacao}</p>
                ` : ''}

                ${renderRespostasResumo(visit.respostas)}
            </div>
        `;

        // Add scroll listener for dots if needed
        if (fotos.length > 1) {
            const carousel = card.querySelector(`#carousel-${visit.id}`);
            const dots = card.querySelectorAll('.bottom-3 div');
            carousel.addEventListener('scroll', () => {
                const scrollLeft = carousel.scrollLeft;
                const width = carousel.clientWidth;
                const activeIndex = Math.round(scrollLeft / width);
                dots.forEach((dot, i) => {
                    if (i === activeIndex) {
                        dot.classList.replace('bg-white/50', 'bg-white');
                    } else {
                        dot.classList.replace('bg-white', 'bg-white/50');
                    }
                });
            });
        }

        return card;
    }

    function renderRespostasResumo(respostas) {
        if (!respostas || Object.keys(respostas).length === 0) return '';

        let html = '<div class="flex flex-wrap gap-2 mt-2">';

        // Loop through keys that are not 'fotos' or 'foto_url'
        for (const [key, value] of Object.entries(respostas)) {
            if (key === 'fotos' || key === 'foto_url') continue;

            // Format key
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            html += `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                    <span class="text-slate-500">${label}:</span> ${value}
                </span>
            `;
        }

        html += '</div>';
        return html;
    }

    function scrollCarousel(id, direction) {
        const carousel = document.getElementById(id);
        if (carousel) {
            const width = carousel.clientWidth;
            carousel.scrollBy({ left: width * direction, behavior: 'smooth' });
        }
    }

    // Export public methods
    return {
        init,
        scrollCarousel
    };
})();

// Attach to global scope for HTML onclick access
window.FeedVisitas = FeedVisitas;
