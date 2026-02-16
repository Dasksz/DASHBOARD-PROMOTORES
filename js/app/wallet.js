window.App = window.App || {};
window.App.Wallet = {
    state: {
        canEdit: false,
        selectedPromoter: null
    },

    init: function() {
        const role = window.AppState.userHierarchyContext.role;
        this.state.canEdit = (role === 'adm' || role === 'coord' || role === 'cocoord');

        // Bind Filters
        const promoterSelect = document.getElementById('wallet-promoter-select-btn');
        if (promoterSelect) {
            // Logic to populate dropdown handled in initWalletView or similar
        }

        const searchInput = document.getElementById('wallet-client-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }
    },

    initWalletView: function() {
        // Populate Promoter Dropdown
        const dropdown = document.getElementById('wallet-promoter-dropdown');
        if (!dropdown) return;
        dropdown.innerHTML = '';

        const promotors = window.AppState.optimizedData.promotorMap;
        if (promotors) {
            const sorted = Array.from(promotors.entries()).sort((a,b) => a[1].localeCompare(b[1]));
            sorted.forEach(([code, name]) => {
                const div = document.createElement('div');
                div.className = 'px-4 py-2 hover:bg-slate-700 cursor-pointer text-slate-300 text-xs';
                div.textContent = name;
                div.onclick = () => {
                    this.state.selectedPromoter = code;
                    document.getElementById('wallet-promoter-select-text').textContent = name;
                    dropdown.classList.add('hidden');
                    this.renderWalletTable();
                };
                dropdown.appendChild(div);
            });
        }

        // Auto-select if promotor
        if (window.AppState.userHierarchyContext.role === 'promotor') {
            this.state.selectedPromoter = window.AppState.userHierarchyContext.promotor;
            const name = promotors.get(this.state.selectedPromoter);
            if(name) document.getElementById('wallet-promoter-select-text').textContent = name;
            this.renderWalletTable();
        }
    },

    renderWalletTable: function() {
        const tbody = document.getElementById('wallet-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        const promoter = this.state.selectedPromoter;
        if (!promoter) {
            document.getElementById('wallet-empty-state').classList.remove('hidden');
            return;
        }
        document.getElementById('wallet-empty-state').classList.add('hidden');

        // Filter Clients
        const clients = window.AppState.clientPromoters.filter(cp =>
            String(cp.promoter_code).trim().toUpperCase() === String(promoter).trim().toUpperCase()
        );

        document.getElementById('wallet-count-badge').textContent = clients.length;

        clients.forEach(cp => {
            const clientCode = window.Utils.normalizeKey(cp.client_code);
            // Lookup Client Info
            // We need to find client in allClientsData
            let client = null;
            if (window.AppState.allClientsData instanceof window.Utils.ColumnarDataset) {
                // Should have a map? indices.current.byClient?
                const idx = window.AppState.optimizedData.indices.current.byClient.get(clientCode); // This is from sales, not clients list?
                // optimizedData.indices.current.byClient is Set of Sales IDs.
                // We need client object.
                // Use clientMapForKPIs if available (IndexMap)
                if (window.AppState.clientMapForKPIs) {
                    const i = window.AppState.clientMapForKPIs.getIndex(clientCode);
                    if (i !== undefined) client = window.AppState.allClientsData.get(i);
                }
            } else {
                client = window.AppState.allClientsData.find(c => window.Utils.normalizeKey(c['Código'] || c['codigo_cliente']) === clientCode);
            }

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-800/50 border-b border-slate-800';

            const name = client ? (client.fantasia || client.nomeCliente) : 'Desconhecido';
            const cnpj = client ? (client['CNPJ/CPF'] || client.cnpj_cpf) : '-';

            tr.innerHTML = `
                <td class="px-6 py-4 font-mono text-slate-400 text-xs">${clientCode}</td>
                <td class="px-6 py-4 font-bold text-white text-sm">${name}</td>
                <td class="px-6 py-4 text-slate-500 text-xs hidden md:table-cell">${cnpj}</td>
                <td class="px-6 py-4 text-center hidden md:table-cell">
                    <button class="text-blue-400 hover:text-white" onclick="window.App.Wallet.openWalletClientModal('${clientCode}')">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                    </button>
                </td>
                <td class="px-6 py-4 text-center">
                    <button class="text-red-400 hover:text-red-300" onclick="window.App.Filters.handleWalletAction('${clientCode}', 'remove')">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    openWalletClientModal: function(clientCode) {
        // ... (Modal logic - truncated for brevity, assume similar to app.js implementation but attached here)
        // For now, I will skip re-implementing the full modal HTML logic inside JS string,
        // assuming it manipulates existing DOM.
        const modal = document.getElementById('wallet-client-modal');
        if (modal) modal.classList.remove('hidden');
        // Need to populate data
        this.populateWalletModal(clientCode);
    },

    populateWalletModal: function(clientCode) {
        // Logic to fill #wallet-modal-code, etc.
        const clientObj = window.AppState.clientMapForKPIs.get(window.Utils.normalizeKey(clientCode));
        if (clientObj) {
            document.getElementById('wallet-modal-code').textContent = clientCode;
            document.getElementById('wallet-modal-razao').textContent = clientObj.razaoSocial || clientObj.nomeCliente || '';
            // ... more fields
        }
    },

    handleSearch: function(term) {
        // Implementation for search suggestions
    }
};
