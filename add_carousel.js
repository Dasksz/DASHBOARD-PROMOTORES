const fs = require('fs');

let code = fs.readFileSync('js/app/feed_view.js', 'utf8');

// We need to inject JS for scrolling the carousel into `FeedVisitas` closure and HTML into the card.

const newFotosHtmlLogic = `
                // Building the horizontal carousel HTML
                let fotosHtml = '';
                if (fotos.length > 0) {
                    const carouselId = 'carousel-' + visit.id;
                    fotosHtml += \`<div class="relative w-full group">\`;

                    // The scroll container
                    fotosHtml += \`<div id="\${carouselId}" class="flex overflow-x-auto snap-x snap-mandatory w-full bg-slate-900 border-y border-slate-800 scroll-smooth" style="scrollbar-width: none;" onscroll="window.FeedVisitas.updateCarouselIndicator('\${carouselId}', \${fotos.length})">\`;

                    fotos.forEach((foto, index) => {
                        const url = foto.url;
                        if (!url) return;

                        const tipo = (foto.tipo || '').toLowerCase();
                        let badgeHtml = '';
                        if (tipo === 'antes' || tipo === 'depois') {
                            const badgeText = tipo === 'antes' ? 'ANTES' : 'DEPOIS';
                            badgeHtml = \`
                                <div class="absolute bottom-2 left-2 z-20 px-2 py-1 rounded text-[10px] font-bold text-white tracking-wider"
                                     style="background-color: rgba(255, 94, 0, 0.7); backdrop-filter: blur(4px);">
                                    \${badgeText}
                                </div>
                            \`;
                        }

                        const locationBtnHtml = \`
                            <button onclick="window.FeedVisitas.openLocationModal(\${visit.id})" class="absolute top-2 right-2 z-20 bg-black/50 hover:bg-[#FF5E00] text-white p-1.5 rounded-full backdrop-blur-sm transition-colors border border-white/20 shadow-lg" title="Ver Localização">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                </svg>
                            </button>
                        \`;

                        fotosHtml += \`
                            <div class="relative flex-none min-w-full aspect-square overflow-hidden snap-center bg-slate-800 flex items-center justify-center text-slate-500 cursor-pointer" onclick="window.FeedVisitas.scrollCarousel('\${carouselId}', 1)">
                                <img src="\${url}" class="w-full h-full object-cover absolute inset-0 z-10" loading="lazy" alt="Foto da Visita" onerror="this.onerror=null; this.parentElement.classList.add('image-error'); this.style.display='none'; this.nextElementSibling.classList.remove('hidden'); this.nextElementSibling.classList.add('flex');">
                                <div class="hidden z-0 flex-col items-center justify-center text-xs text-slate-500 gap-2">
                                    <i class="fas fa-image text-2xl mb-1"></i>
                                    <span>Imagem indisponível</span>
                                </div>
                                \${badgeHtml}
                                \${locationBtnHtml}
                            </div>
                        \`;
                    });
                    fotosHtml += \`</div>\`;

                    if (fotos.length > 1) {
                        // Left Arrow
                        fotosHtml += \`
                            <button onclick="window.FeedVisitas.scrollCarousel('\${carouselId}', -1); event.stopPropagation();" class="absolute left-2 top-1/2 -translate-y-1/2 z-30 bg-black/40 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100 touch-pan-y" style="opacity: 0.8;">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                            </button>
                        \`;
                        // Right Arrow
                        fotosHtml += \`
                            <button onclick="window.FeedVisitas.scrollCarousel('\${carouselId}', 1); event.stopPropagation();" class="absolute right-2 top-1/2 -translate-y-1/2 z-30 bg-black/40 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100 touch-pan-y" style="opacity: 0.8;">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                            </button>
                        \`;
                        // Counter Badge
                        fotosHtml += \`
                            <div id="\${carouselId}-indicator" class="absolute top-2 left-2 z-20 bg-black/50 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm tracking-widest shadow-lg">
                                1 / \${fotos.length}
                            </div>
                        \`;
                    }

                    fotosHtml += \`</div>\`;
                }
`;

const startIndex = code.indexOf('// Building the horizontal carousel HTML');
const endIndex = code.indexOf('// Building answers summary (like Instagram captions)');

if (startIndex !== -1 && endIndex !== -1) {
    code = code.substring(0, startIndex) + newFotosHtmlLogic + "\n                " + code.substring(endIndex);
}

// Now we need to add the helper functions into FeedVisitas

const helpersCode = `
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
`;

code = code.replace('function toggleResumo(btnElement, visitId) {', helpersCode);

code = code.replace(
    'toggleResumo,',
    'scrollCarousel,\n        updateCarouselIndicator,\n        toggleResumo,'
);

fs.writeFileSync('js/app/feed_view.js', code);
console.log('Carousel Logic injected successfully');
