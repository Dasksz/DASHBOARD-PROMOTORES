const fs = require('fs');

let fileContent = fs.readFileSync('js/app/feed_view.js', 'utf8');

// 1. Add Navigation State Variables
fileContent = fileContent.replace(
    'let currentEndBound = null;\n    let initialized = false;',
    'let currentEndBound = null;\n    let initialized = false;\n    \n    // Navigation State\n    let showOnlyFavorites = false;\n    let flatpickrInstance = null;'
);

// 2. Call setupFlatpickr in init()
fileContent = fileContent.replace(
    'resetFeed();\n        loadFeed();\n        initialized = true;',
    'resetFeed();\n        loadFeed();\n        initialized = true;\n        \n        if (!flatpickrInstance) {\n            setupFlatpickr();\n        }'
);

// 3. Add setupFlatpickr function before loadFeed
const setupFlatpickrFunc = `
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
                        btnContainer.innerHTML = \`<button type="button" id="feed-flatpickr-filter-btn" class="bg-[#FF5E00] hover:bg-[#CC4A00] text-white font-bold py-1 px-4 rounded text-sm transition-colors">Filtrar</button>\`;

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

        if (favBtn) favBtn.addEventListener('click', window.FeedVisitas.openFavoritesModal);
        if (favCloseBtn) favCloseBtn.addEventListener('click', () => favModal.classList.add('hidden'));
        if (favViewBtn) favViewBtn.addEventListener('click', window.FeedVisitas.applyFavoritesFilter);
    }
`;

fileContent = fileContent.replace('async function loadFeed() {', setupFlatpickrFunc + '\n    async function loadFeed(skipDateCalc = false) {');

// 4. Update loadFeed Logic
const loadFeedBodyOriginal = `// Determine current month context based on lastSaleDate
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
                periodInfo.textContent = \`Mês: \${monthName}/\${year}\`;
            }`;

const loadFeedBodyNew = `if (!skipDateCalc) {
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
                periodInfo.textContent = \`Período: \${fd(currentStartBound)} até \${fd(currentEndBound)}\`;

                if (showOnlyFavorites) {
                     periodInfo.textContent += \` (Apenas Favoritos)\`;
                     periodInfo.classList.replace('text-brand-orange', 'text-yellow-400');
                     periodInfo.classList.replace('bg-brand-orange/10', 'bg-yellow-400/10');
                } else {
                     periodInfo.classList.replace('text-yellow-400', 'text-brand-orange');
                     periodInfo.classList.replace('bg-yellow-400/10', 'bg-brand-orange/10');
                }
            }`;

fileContent = fileContent.replace(loadFeedBodyOriginal, loadFeedBodyNew);

// 5. Update Empty State text
fileContent = fileContent.replace(
    '<p class="text-slate-300 font-medium">Nenhuma visita registrada no mês atual (${monthName}/${year}).</p>',
    '<p class="text-slate-300 font-medium">Nenhuma visita encontrada neste período.</p>'
);

fs.writeFileSync('js/app/feed_view.js', fileContent);
