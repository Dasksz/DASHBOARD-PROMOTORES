const fs = require('fs');
const file = 'js/app/feed_view.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Update the indicator so it fades out
// Replace the old indicator string with a new one that starts with opacity 0 and transitions
content = content.replace(
    `<div id="\${carouselId}-indicator" class="absolute top-2 left-2 z-20 bg-black/50 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm tracking-widest shadow-lg">
                                1 / \${fotos.length}
                            </div>`,
    `<div id="\${carouselId}-indicator" class="absolute top-2 right-2 z-20 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm tracking-widest shadow-lg opacity-0 transition-opacity duration-300 pointer-events-none">
                                1 / \${fotos.length}
                            </div>`
);

// Add the logic to updateCarouselIndicator to show/hide the indicator and update dots
// Find updateCarouselIndicator
const updateCarouselIndicatorRegex = /function updateCarouselIndicator\(carouselId, total\) \{([\s\S]*?)\}/;
const newUpdateCarouselIndicator = `function updateCarouselIndicator(carouselId, total) {
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
    }`;
content = content.replace(updateCarouselIndicatorRegex, newUpdateCarouselIndicator);

// 2. Change the statusHtml
content = content.replace(
    `if (visit.status === 'APPROVED') {
                    statusHtml = '<span class="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Aprovada</span>';
                } else if (visit.status === 'REJECTED') {
                    statusHtml = '<span class="px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">Rejeitada</span>';
                } else {
                    statusHtml = '<span class="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Pendente</span>';
                }`,
    `if (visit.status === 'APPROVED') {
                    statusHtml = '<svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Aprovada"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
                } else if (visit.status === 'REJECTED') {
                    statusHtml = '<svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Rejeitada"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
                } else {
                    statusHtml = '<svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Pendente"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
                }`
);

// 3. Update the layout of card.innerHTML
const cardInnerRegex = /card\.innerHTML = `[\s\S]*?`;\s+cardsContainer\.appendChild\(card\);/m;

const newCardInner = `
                let dotsHtml = '';
                if (fotos.length > 1) {
                    const dotsArray = Array.from({ length: fotos.length }).map((_, i) =>
                        \`<div class="w-1.5 h-1.5 rounded-full carousel-dot \${i === 0 ? 'bg-blue-500' : 'bg-slate-600'} transition-colors duration-300"></div>\`
                    ).join('');
                    dotsHtml = \`<div id="carousel-\${visit.id}-dots" class="flex justify-center items-center gap-1.5 flex-1">\${dotsArray}</div>\`;
                }

                card.innerHTML = \`
                    <div class="p-3 flex flex-col gap-1 border-b border-slate-700/50">
                        <div class="flex items-center gap-2 min-w-0">
                            <p class="text-sm font-bold text-white truncate max-w-[120px]" title="\${promotorName}">\${promotorName}</p>
                            <span class="text-xs text-[#FF5E00] font-medium truncate flex-1" title="\${clientName}">\${clientName}</span>
                        </div>
                    </div>
                    \${fotosHtml}
                    <div class="px-4 pt-3 pb-4 flex flex-col gap-2">
                        <!-- Linha 1: Favorito (Esquerda), Dots (Centro), Status (Direita) -->
                        <div class="flex items-center justify-between w-full h-8">
                            <!-- Esquerda: Favorito -->
                            <div class="flex-1 flex justify-start">
                                \${isManager && window.userId ? \`
                                <button onclick="window.FeedVisitas.toggleFavorite('\${visit.id}', this)" class="p-1 rounded-full transition-all hover:bg-slate-800/50 \${(visit.favoritado_por || []).includes(window.userId) ? 'text-yellow-400 scale-110' : 'text-slate-400 hover:text-white'}" title="Favoritar">
                                    <svg class="w-6 h-6" \${(visit.favoritado_por || []).includes(window.userId) ? 'fill="currentColor"' : 'fill="none"'} stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
                                    </svg>
                                </button>
                                \` : '<div></div>'}
                            </div>

                            <!-- Centro: Dots -->
                            \${dotsHtml}

                            <!-- Direita: Status -->
                            <div class="flex-1 flex justify-end">
                                \${statusHtml}
                            </div>
                        </div>

                        <!-- Linha 2: Data -->
                        <div class="w-full mt-1">
                            <span class="text-[11px] text-slate-500 font-medium uppercase tracking-wide">\${formattedDate}</span>
                        </div>

                        \${observacoesTexto && (isManager || String(visit.id_promotor) === String(window.userId)) ? \`<div class="text-sm text-slate-300 leading-relaxed mt-2"><span class="font-medium text-white">Obs:</span> \${observacoesTexto}</div>\` : ''}
                        \${resumoRespostasHtml}
                    </div>
                \`;
                cardsContainer.appendChild(card);`;

content = content.replace(cardInnerRegex, newCardInner);

fs.writeFileSync(file, content);
console.log('Layout patch applied.');
