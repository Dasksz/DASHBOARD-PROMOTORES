window.App = window.App || {};
window.App.Products = {
    render: function(filter = '') {
        const container = document.getElementById('produtos-list-container');
        const countEl = document.getElementById('produtos-count');
        const searchInput = document.getElementById('produtos-search');
        if (!container) return;

        // Bind Search once
        if (searchInput && !searchInput._bound) {
            searchInput.addEventListener('input', (e) => this.render(e.target.value));
            searchInput._bound = true;
        }

        // Use global embeddedData as fallback or AppState property if mapped
        const prodList = (window.embeddedData && window.embeddedData.products) ? window.embeddedData.products : [];

        const filtered = prodList.filter(p => {
            if (!filter) return true;
            const f = filter.toLowerCase();
            return (p.descricao || '').toLowerCase().includes(f) || (String(p.code || '')).includes(f);
        });

        const limit = 50;
        const subset = filtered.slice(0, limit);
        container.innerHTML = '';

        if(countEl) countEl.textContent = `${filtered.length} Produtos${filtered.length > limit ? ` (Exibindo ${limit})` : ''}`;

        subset.forEach(prod => {
            const code = prod.code;
            const desc = prod.descricao || 'Sem Descrição';
            const emb = prod.embalagem || 'UN';

            const stock05 = window.AppState.stockData05.get(code) || 0;
            const stock08 = window.AppState.stockData08.get(code) || 0;

            const item = document.createElement('div');
            item.className = 'p-4 border-b border-slate-800 hover:bg-slate-800 transition-colors';
            item.innerHTML = `
                <div class="flex justify-between">
                    <h3 class="text-sm font-bold text-white">${code} - ${desc}</h3>
                    <span class="text-xs text-slate-400">${emb}</span>
                </div>
                <div class="flex justify-between text-xs text-slate-500 mt-1">
                    <span>Estoque 05: <b class="text-blue-400">${stock05}</b></span>
                    <span>Estoque 08: <b class="text-blue-400">${stock08}</b></span>
                </div>
            `;
            container.appendChild(item);
        });
    }
};

window.renderProductView = function() {
    window.App.Products.render();
};
