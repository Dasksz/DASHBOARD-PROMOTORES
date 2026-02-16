window.App = window.App || {};
window.App.Clients = {
    state: {
        page: 1,
        limit: 50,
        filtered: []
    },

    render: function(filterValue = null, isPagination = false) {
        const container = document.getElementById('clientes-list-container');
        const countEl = document.getElementById('clientes-count');
        const searchInput = document.getElementById('clientes-search');
        if (!container) return;

        // Init Pagination Controls if missing
        if (!document.getElementById('clients-pagination')) {
             const p = document.createElement('div');
             p.id = 'clients-pagination';
             p.className = 'p-4 flex justify-between items-center bg-[#0f172a] border-t border-slate-800 mt-4';
             p.innerHTML = `
                <button id="client-prev-btn" class="bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 text-xs transition-colors">Anterior</button>
                <span id="client-page-info" class="text-slate-400 text-xs font-medium"></span>
                <button id="client-next-btn" class="bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 text-xs transition-colors">Próxima</button>
             `;
             container.parentNode.appendChild(p);

             document.getElementById('client-prev-btn').onclick = () => { if(this.state.page > 1) { this.state.page--; this.render(null, true); } };
             document.getElementById('client-next-btn').onclick = () => { if(this.state.page < Math.ceil(this.state.filtered.length / this.state.limit)) { this.state.page++; this.render(null, true); } };

             // Bind Search
             if(searchInput) {
                 searchInput.oninput = (e) => {
                     if (window.App.Visitas && window.App.Visitas.isRoteiroMode) {
                         // Roteiro Mode search logic handled in Visitas module mostly?
                         // Actually Visitas module handled it.
                         // But we need to dispatch.
                         // Let Visitas module handle its own search input logic or check mode here.
                         // Visitas module should bind its own listener or share this one.
                         // Let's assume standard mode here.
                     } else {
                         this.render(e.target.value);
                     }
                 };
             }
        }

        if (!isPagination) {
            this.state.page = 1;
            const filter = (filterValue !== null ? filterValue : (searchInput ? searchInput.value : '')).toLowerCase();
            // Get Active Clients
            const clients = window.App.Filters.getActiveClientsData ? window.App.Filters.getActiveClientsData() : window.AppState.allClientsData; // Need to implement getActiveClientsData in Filters
            // Fallback if not implemented
            const all = window.AppState.allClientsData;

            this.state.filtered = [];
            const len = all.length;
            const isColumnar = all instanceof window.Utils.ColumnarDataset;

            for(let i=0; i<len; i++) {
                const c = isColumnar ? all.get(i) : all[i];
                if (filter) {
                    const match = (c.nomeCliente || '').toLowerCase().includes(filter) ||
                                  (c.fantasia || '').toLowerCase().includes(filter) ||
                                  (String(c['Código'] || c['codigo_cliente'])).includes(filter);
                    if (!match) continue;
                }
                this.state.filtered.push(c);
            }
            this.state.filtered.sort((a, b) => (a.nomeCliente || '').localeCompare(b.nomeCliente || ''));
        }

        container.innerHTML = '';
        const total = this.state.filtered.length;
        const start = (this.state.page - 1) * this.state.limit;
        const end = start + this.state.limit;
        const subset = this.state.filtered.slice(start, end);
        const totalPages = Math.ceil(total / this.state.limit) || 1;

        if (countEl) countEl.textContent = `${total} Clientes (Página ${this.state.page} of ${totalPages})`;

        const prevBtn = document.getElementById('client-prev-btn');
        const nextBtn = document.getElementById('client-next-btn');
        const info = document.getElementById('client-page-info');

        if(prevBtn) prevBtn.disabled = this.state.page === 1;
        if(nextBtn) nextBtn.disabled = this.state.page >= totalPages;
        if(info) info.textContent = `${start + 1}-${Math.min(end, total)} de ${total}`;

        subset.forEach(client => {
            const cod = window.Utils.normalizeKey(client['Código'] || client['codigo_cliente']);
            const name = client.nomeCliente || 'Desconhecido';

            // Check visit
            const visited = window.AppState.myMonthVisits.has(cod);

            const item = document.createElement('div');
            item.className = 'p-4 border-b border-slate-800 hover:bg-slate-800 transition-colors cursor-pointer flex justify-between items-center';
            item.innerHTML = `
                <div>
                    <h3 class="text-sm font-bold text-white flex items-center gap-2">
                        ${cod} - ${name}
                        ${visited ? '<span class="w-2 h-2 bg-blue-500 rounded-full"></span>' : ''}
                    </h3>
                    <p class="text-xs text-slate-400">${client.cidade || ''}</p>
                </div>
                <button class="text-slate-400 hover:text-white">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
            `;
            item.onclick = () => {
                if(window.App.Wallet && window.App.Wallet.openWalletClientModal) window.App.Wallet.openWalletClientModal(cod);
            };
            container.appendChild(item);
        });
    }
};

window.renderClientView = function() {
    window.App.Clients.render();
};
