const fs = require('fs');

let fileContent = fs.readFileSync('js/app/feed_view.js', 'utf8');

// 1. Add fetch query modification and favorite toggle function
const fetchFeedDataOriginal = `        let query = window.supabaseClient
            .from('visitas')
            .select(\`id, created_at, checkout_at, client_code, observacao, respostas, status, id_promotor, profiles:id_promotor(name)\`)
            .gte('created_at', currentStartBound.toISOString())
            .lte('created_at', currentEndBound.toISOString())
            .order('created_at', { ascending: false })
            .range(from, to);`;

const fetchFeedDataNew = `        let query = window.supabaseClient
            .from('visitas')
            .select(\`id, created_at, checkout_at, client_code, observacao, respostas, status, id_promotor, profiles:id_promotor(name), favoritado_por\`)
            .gte('created_at', currentStartBound.toISOString())
            .lte('created_at', currentEndBound.toISOString())
            .order('created_at', { ascending: false });

        if (showOnlyFavorites && window.userId) {
            query = query.contains('favoritado_por', [window.userId]);
        }

        query = query.range(from, to);`;

fileContent = fileContent.replace(fetchFeedDataOriginal, fetchFeedDataNew);

// 2. Add Favorites Modal Logic
const modalFunctions = `
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
                .contains('favoritado_por', [window.userId])
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

        // Remove filters that might be blocking favorites from other promoters
        const isManager = true; // Always allow viewing favorites regardless of role

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
            btnElement.innerHTML = \`<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>\`;
        } else {
            btnElement.classList.add('text-yellow-400');
            btnElement.classList.remove('text-slate-400', 'hover:text-white');
            btnElement.innerHTML = \`<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>\`;
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
`;

fileContent = fileContent.replace('function showError(msg) {', modalFunctions + '\n    function showError(msg) {');

// 3. Update Image Compression logic based on showOnlyFavorites mode
const imageLogicOriginal1 = `if (foto.url.startsWith('http')) {
                                        urlStr = foto.url;
                                    } else {
                                        const { data: urlData } = window.supabaseClient.storage.from('visitas-images').getPublicUrl(foto.url);
                                        urlStr = urlData.publicUrl + '?width=500&quality=60';
                                    }`;

const imageLogicNew1 = `if (foto.url.startsWith('http')) {
                                        urlStr = foto.url;
                                    } else {
                                        const { data: urlData } = window.supabaseClient.storage.from('visitas-images').getPublicUrl(foto.url);
                                        urlStr = urlData.publicUrl;
                                        if (!showOnlyFavorites) {
                                            urlStr += '?width=500&quality=60';
                                        }
                                    }`;

fileContent = fileContent.replace(imageLogicOriginal1, imageLogicNew1);

const imageLogicOriginal2 = `if (typeof value === 'string' && value.startsWith('http')) {
                                        url = value;
                                    } else if (typeof value === 'string') {
                                        const { data: urlData } = window.supabaseClient.storage.from('visitas-images').getPublicUrl(value);
                                        url = urlData.publicUrl + '?width=500&quality=60';
                                    }`;

const imageLogicNew2 = `if (typeof value === 'string' && value.startsWith('http')) {
                                        url = value;
                                    } else if (typeof value === 'string') {
                                        const { data: urlData } = window.supabaseClient.storage.from('visitas-images').getPublicUrl(value);
                                        url = urlData.publicUrl;
                                        if (!showOnlyFavorites) {
                                            url += '?width=500&quality=60';
                                        }
                                    }`;

fileContent = fileContent.replace(imageLogicOriginal2, imageLogicNew2);

// 4. Expose functions
fileContent = fileContent.replace(
    'return {\n        scrollCarousel',
    'return {\n        openFavoritesModal,\n        applyFavoritesFilter,\n        toggleFavorite,\n        scrollCarousel'
);

// 5. Update Card Template with Favorite Button
const cardHeaderOriginal = `<div class="p-4 flex flex-col gap-1 border-b border-slate-700/50">
                        <div class="flex items-center gap-2">
                            <p class="text-sm font-bold text-white truncate max-w-[120px]" title="\${promotorName}">\${promotorName}</p>
                            <span class="text-xs text-[#FF5E00] font-medium truncate flex-1" title="\${clientName}">\${clientName}</span>
                        </div>
                    </div>`;

const cardHeaderNew = `<div class="p-4 flex flex-col gap-1 border-b border-slate-700/50">
                        <div class="flex justify-between items-start w-full">
                            <div class="flex items-center gap-2 min-w-0">
                                <p class="text-sm font-bold text-white truncate max-w-[120px]" title="\${promotorName}">\${promotorName}</p>
                                <span class="text-xs text-[#FF5E00] font-medium truncate flex-1" title="\${clientName}">\${clientName}</span>
                            </div>

                            \${window.userId ? \`
                            <button onclick="window.FeedVisitas.toggleFavorite('\${visit.id}', this)" class="ml-2 p-1.5 rounded-full transition-colors bg-slate-800/50 border border-slate-700/50 \${(visit.favoritado_por || []).includes(window.userId) ? 'text-yellow-400' : 'text-slate-400 hover:text-white'}">
                                <svg class="w-5 h-5" \${(visit.favoritado_por || []).includes(window.userId) ? 'fill="currentColor"' : 'fill="none"'} stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
                                </svg>
                            </button>
                            \` : ''}

                        </div>
                    </div>`;

fileContent = fileContent.replace(cardHeaderOriginal, cardHeaderNew);

fs.writeFileSync('js/app/feed_view.js', fileContent);
