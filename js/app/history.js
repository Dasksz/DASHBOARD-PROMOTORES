window.App = window.App || {};
window.App.History = {
    state: {
        page: 1,
        limit: 50,
        filtered: [],
        hasSearched: false
    },

    init: function() {
        window.App.Filters.setupHierarchyFilters('history', null);
        const filterBtn = document.getElementById('history-filter-btn');
        if(filterBtn) filterBtn.addEventListener('click', () => this.filter());

        const prevBtn = document.getElementById('history-prev-page-btn');
        const nextBtn = document.getElementById('history-next-page-btn');

        if(prevBtn) prevBtn.addEventListener('click', () => {
            if(this.state.page > 1) {
                this.state.page--;
                this.renderTable();
            }
        });
        if(nextBtn) nextBtn.addEventListener('click', () => {
            if(this.state.page < Math.ceil(this.state.filtered.length / this.state.limit)) {
                this.state.page++;
                this.renderTable();
            }
        });
    },

    render: function() {
        // Initial setup/show
        if(this.state.hasSearched) this.renderTable();
    },

    filter: function() {
        const startVal = document.getElementById('history-date-start').value;
        const endVal = document.getElementById('history-date-end').value;

        if (!startVal || !endVal) {
            window.Utils.showToast('warning', 'Selecione as datas.');
            return;
        }

        const startDate = new Date(startVal); startDate.setUTCHours(0,0,0,0);
        const endDate = new Date(endVal); endDate.setUTCHours(23,59,59,999);

        const clients = window.App.Filters.getHierarchyFilteredClients('history', window.AppState.allClientsData);
        const validCodes = new Set(clients.map(c => window.Utils.normalizeKey(c['Código'] || c['codigo_cliente'])));

        const historyData = window.AppState.allHistoryData;
        const len = historyData.length;
        const isColumnar = historyData instanceof window.Utils.ColumnarDataset;

        const ordersMap = new Map();

        for(let i=0; i<len; i++) {
            const s = isColumnar ? historyData.get(i) : historyData[i];
            const d = window.Utils.parseDate(s.DTPED);
            if (!d || d < startDate || d > endDate) continue;

            const codCli = window.Utils.normalizeKey(s.CODCLI);
            if (!validCodes.has(codCli)) continue;

            if (!ordersMap.has(s.PEDIDO)) {
                ordersMap.set(s.PEDIDO, {
                    PEDIDO: s.PEDIDO,
                    DTPED: s.DTPED,
                    CODCLI: s.CODCLI,
                    NOME: s.NOME,
                    CODFOR: s.CODFOR,
                    VLVENDA: 0,
                    POSICAO: s.POSICAO
                });
            }
            ordersMap.get(s.PEDIDO).VLVENDA += (Number(s.VLVENDA)||0);
        }

        this.state.filtered = Array.from(ordersMap.values());
        this.state.filtered.sort((a,b) => window.Utils.parseDate(b.DTPED) - window.Utils.parseDate(a.DTPED));

        this.state.page = 1;
        this.state.hasSearched = true;
        this.renderTable();
    },

    renderTable: function() {
        const tbody = document.getElementById('history-table-body');
        const count = document.getElementById('history-count-badge');
        const pagination = document.getElementById('history-pagination-controls');

        if(!tbody) return;
        tbody.innerHTML = '';

        if(!this.state.hasSearched || this.state.filtered.length === 0) {
            document.getElementById('history-empty-state').classList.remove('hidden');
            if(pagination) pagination.classList.add('hidden');
            if(count) count.textContent = '0';
            return;
        }

        document.getElementById('history-empty-state').classList.add('hidden');
        if(pagination) pagination.classList.remove('hidden');
        if(count) count.textContent = this.state.filtered.length;

        const start = (this.state.page - 1) * this.state.limit;
        const end = start + this.state.limit;
        const subset = this.state.filtered.slice(start, end);

        subset.forEach(o => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-800 hover:bg-slate-800/50 transition-colors';

            const dateStr = window.Utils.formatDate(o.DTPED);
            const valStr = o.VLVENDA.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

            // Client Name Lookup
            let clientName = 'N/A';
            const clientObj = window.AppState.clientMapForKPIs.get(window.Utils.normalizeKey(o.CODCLI));
            if(clientObj) clientName = clientObj.nomeCliente || clientObj.fantasia;

            tr.innerHTML = `
                <td class="px-4 py-3 text-xs text-slate-400 font-mono">${dateStr}</td>
                <td class="px-4 py-3 text-xs text-white font-bold">${o.PEDIDO}</td>
                <td class="px-4 py-3 text-xs text-slate-300">
                    <div>${clientName}</div>
                    <div class="text-[10px] text-slate-500">${o.CODCLI}</div>
                </td>
                <td class="px-4 py-3 text-xs text-right font-bold text-white">${valStr}</td>
                <td class="px-4 py-3 text-xs text-center text-slate-400">${o.POSICAO}</td>
            `;
            tbody.appendChild(tr);
        });

        // Update pagination text
        const total = this.state.filtered.length;
        const totalPages = Math.ceil(total / this.state.limit);
        const info = document.getElementById('history-page-info-text');
        if(info) info.textContent = `${start+1}-${Math.min(end, total)} de ${total}`;

        const prevBtn = document.getElementById('history-prev-page-btn');
        const nextBtn = document.getElementById('history-next-page-btn');
        if(prevBtn) prevBtn.disabled = this.state.page === 1;
        if(nextBtn) nextBtn.disabled = this.state.page >= totalPages;
    }
};

window.renderHistoryView = function() {
    window.App.History.render();
};
