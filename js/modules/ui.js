import { state } from './data.js';
import { formatDate } from './utils.js';

export function navigateTo(targetId) {
    const views = ['dashboard', 'pedidos', 'comparativo', 'estoque', 'cobertura', 'cidades', 'semanal', 'mix', 'inovacoes-mes', 'goals', 'meta-realizado'];
    views.forEach(v => {
        const el = document.getElementById(v === 'dashboard' ? 'main-dashboard' :
                                         v === 'pedidos' ? 'tableView' :
                                         v === 'estoque' ? 'stock-view' :
                                         v === 'cobertura' ? 'coverage-view' :
                                         v === 'cidades' ? 'city-view' :
                                         v === 'semanal' ? 'weekly-view' :
                                         v === 'comparativo' ? 'comparison-view' :
                                         v === 'mix' ? 'mix-view' :
                                         v === 'inovacoes-mes' ? 'innovations-month-view' :
                                         v === 'goals' ? 'goals-view' :
                                         v === 'meta-realizado' ? 'meta-realizado-view' : '');
        if(el) el.classList.add('hidden');
    });

    const activeView = document.getElementById(targetId === 'dashboard' ? 'main-dashboard' :
                                             targetId === 'pedidos' ? 'tableView' :
                                             targetId === 'estoque' ? 'stock-view' :
                                             targetId === 'cobertura' ? 'coverage-view' :
                                             targetId === 'cidades' ? 'city-view' :
                                             targetId === 'semanal' ? 'weekly-view' :
                                             targetId === 'comparativo' ? 'comparison-view' :
                                             targetId === 'mix' ? 'mix-view' :
                                             targetId === 'inovacoes-mes' ? 'innovations-month-view' :
                                             targetId === 'goals' ? 'goals-view' :
                                             targetId === 'meta-realizado' ? 'meta-realizado-view' : '');
    if(activeView) activeView.classList.remove('hidden');

    // Update Nav Active State
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(l => {
        l.classList.remove('active-nav', 'bg-slate-700', 'text-white');
        l.classList.add('text-slate-300');
        if(l.dataset.target === targetId) {
            l.classList.add('active-nav', 'text-white');
            l.classList.remove('text-slate-300');
            if(l.classList.contains('mobile-nav-link')) l.classList.add('bg-slate-700');
        }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function renderTable(data, tableBodyId = 'report-table-body', pageInfoId = 'page-info-text', paginationState) {
    const tableBody = document.getElementById(tableBodyId);
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="px-6 py-4 text-center text-slate-500">Nenhum registro encontrado.</td></tr>';
        if(pageInfoId) document.getElementById(pageInfoId).textContent = '';
        return;
    }

    const start = (paginationState.currentPage - 1) * paginationState.itemsPerPage;
    const end = start + paginationState.itemsPerPage;
    const pageData = data.slice(start, end);

    pageData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/50 transition-colors border-b border-slate-800/50';

        let statusClass = 'text-green-400';
        let statusText = row.POSICAO || 'N/A';
        if (statusText === 'C') { statusClass = 'text-red-400'; statusText = 'Cancelado'; }
        else if (statusText === 'P') { statusClass = 'text-yellow-400'; statusText = 'Pendente'; }
        else if (statusText === 'F') { statusClass = 'text-blue-400'; statusText = 'Faturado'; }
        else if (statusText === 'L') { statusClass = 'text-green-400'; statusText = 'Liberado'; }
        else if (statusText === 'M') { statusClass = 'text-purple-400'; statusText = 'Montado'; }

        // Determine if it's aggregated (Object) or Columnar (Proxy/Raw)
        // Aggregated orders are usually plain objects.
        const dtsaida = row.DTSAIDA instanceof Date ? row.DTSAIDA : new Date(row.DTSAIDA || 0);
        const dtped = row.DTPED instanceof Date ? row.DTPED : new Date(row.DTPED || 0);
        // Use DTSAIDA if available, else DTPED
        const displayDate = (dtsaida.getTime() > 0) ? dtsaida : dtped;

        tr.innerHTML = `
            <td class="px-6 py-4 font-medium text-white whitespace-nowrap">${row.PEDIDO}</td>
            <td class="px-6 py-4 truncate max-w-xs" title="${row.CLIENTE_NOME}">${row.CLIENTE_NOME}</td>
            <td class="px-6 py-4 whitespace-nowrap">${row.NOME}</td>
            <td class="px-6 py-4 whitespace-nowrap text-xs text-slate-400">${row.FORNECEDORES_STR || ''}</td>
            <td class="px-6 py-4 text-center whitespace-nowrap">${formatDate(displayDate)}</td>
            <td class="px-6 py-4 text-right font-mono">${(row.TOTPESOLIQ || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} kg</td>
            <td class="px-6 py-4 text-right font-bold text-green-400 font-mono">${(row.VLVENDA || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td class="px-6 py-4 text-center font-bold text-xs ${statusClass}">${statusText}</td>
        `;

        tr.addEventListener('click', () => openOrderModal(row));
        tableBody.appendChild(tr);
    });

    if (pageInfoId) {
        const totalPages = Math.ceil(data.length / paginationState.itemsPerPage);
        document.getElementById(pageInfoId).textContent = `Página ${paginationState.currentPage} de ${totalPages} (${data.length} registros)`;
    }
}

export function openOrderModal(orderData) {
    const modal = document.getElementById('order-details-modal');
    if(!modal) return;

    document.getElementById('modal-pedido-id').textContent = `Pedido #${orderData.PEDIDO}`;

    const headerHtml = `
        <div class="grid grid-cols-2 gap-4 text-sm text-slate-300 mb-4">
            <div><span class="text-slate-500 font-bold">Cliente:</span> ${orderData.CLIENTE_NOME} (${orderData.CODCLI})</div>
            <div><span class="text-slate-500 font-bold">Vendedor:</span> ${orderData.NOME}</div>
            <div><span class="text-slate-500 font-bold">Data:</span> ${formatDate(orderData.DTPED)}</div>
            <div><span class="text-slate-500 font-bold">Posição:</span> ${orderData.POSICAO}</div>
        </div>
    `;
    document.getElementById('modal-header-info').innerHTML = headerHtml;

    // Fetch Details Logic needs access to optimizedData
    // We can filter `state.allSalesData` by PEDIDO.
    // Since `state.allSalesData` is large, using an index would be better.
    // However, `aggregatedOrders` is what we passed to `renderTable`.
    // We need to find items in `allSalesData`.
    // Let's iterate `allSalesData` efficiently or assume it's fast enough for modal open.

    const items = [];
    const sales = state.allSalesData;
    for(let i=0; i<sales.length; i++) {
        const s = sales instanceof Object && sales.get ? sales.get(i) : sales[i]; // Handle Columnar
        if (String(s.PEDIDO) === String(orderData.PEDIDO)) {
            items.push(s);
        }
    }

    const tbody = document.getElementById('modal-table-body');
    tbody.innerHTML = '';

    items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-4 py-2 text-white">${item.PRODUTO}</td>
            <td class="px-4 py-2 text-slate-300">${item.DESCRICAO}</td>
            <td class="px-4 py-2 text-right text-slate-300">${Number(item.QTVENDA)}</td>
            <td class="px-4 py-2 text-right text-slate-300 font-mono">${Number(item.VLVENDA).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('modal-footer-total').innerHTML = `
        <div class="flex justify-between items-center pt-4 border-t border-slate-700">
            <span class="font-bold text-white">Total</span>
            <span class="font-bold text-xl text-green-400">${orderData.VLVENDA.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
        </div>
    `;

    modal.classList.remove('hidden');
}

export function initUI() {
    // Modal Closers
    document.querySelectorAll('.modal-overlay .bg-modal-content button[id$="close-btn"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal-overlay').classList.add('hidden');
        });
    });

    // Navigation
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const target = e.target.dataset.target;
            navigateTo(target);
            // Close mobile menu if open
            document.getElementById('mobile-menu').classList.add('hidden');
        });
    });

    // Mobile Menu Toggle
    const toggle = document.getElementById('mobile-menu-toggle');
    if(toggle) {
        toggle.addEventListener('click', () => {
            document.getElementById('mobile-menu').classList.toggle('hidden');
        });
    }
}
