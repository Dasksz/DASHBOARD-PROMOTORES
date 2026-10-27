(function (root) {
    'use strict';
    let client, started = false, promoter = null, offset = 0, total = 0, sequence = 0, onRestored;
    const pageSize = 50;
    const el = id => document.getElementById(id);
    const text = (tag, value, className) => {
        const node = document.createElement(tag);
        node.textContent = value == null ? '' : String(value);
        if (className) node.className = className;
        return node;
    };
    function badges(count) {
        for (const id of ['user-wallet-review-badge', 'menu-wallet-review-badge']) {
            const node = el(id);
            if (!node) continue;
            node.textContent = count > 99 ? '99+' : count;
            node.classList.toggle('hidden', !count);
            node.title = count + ' clientes aguardando revisão da carteira';
        }
        if (el('wallet-review-count')) el('wallet-review-count').textContent = count;
        el('user-menu-btn')?.setAttribute('aria-label', count ? 'Menu do usuário: ' + count + ' pendências na carteira' : 'Menu do usuário');
    }
    async function count() {
        if (!client) return;
        const { data, error } = await client.rpc('get_wallet_review_v1', { p_limit: 1 });
        if (error) throw error;
        badges(data.pending_count || 0);
    }
    function card(item) {
        const node = text('article', '', 'wallet-review-card');
        const snapshot = item.client_snapshot || {}, hierarchy = item.hierarchy_snapshot || {};
        node.append(text('h3', item.client_code + ' — ' + (snapshot.nomecliente || snapshot.fantasia || snapshot.razaosocial || 'Cliente sem nome no cadastro anterior')));
        node.append(text('p', 'Promotor: ' + (hierarchy.nome_promotor || item.promoter_code || 'Não informado') + (item.promoter_code ? ' (' + item.promoter_code + ')' : '')));
        const removedAt = new Date(item.removed_at).toLocaleDateString('pt-BR');
        const status = { pending: 'Aguardando revisão', removal_confirmed: 'Retirada confirmada', restored: 'Vínculo restaurado' }[item.status] || item.status;
        node.append(text('p', status + ' • Identificado em ' + removedAt, 'wallet-review-status'));
        if (snapshot.cidade) node.append(text('p', 'Cidade: ' + snapshot.cidade));
        if (item.itinerary_frequency) {
            const days = String(item.itinerary_days || '').split(',').filter(Boolean).map(day => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][Number(day)] || day).join(', ');
            const frequency = { weekly: 'Semanal', biweekly: 'Quinzenal', monthly: 'Mensal' }[item.itinerary_frequency] || item.itinerary_frequency;
            node.append(text('p', 'Roteirização preservada: ' + frequency + (days ? ' • ' + days : '')));
        }
        node.append(text('p', item.client_returned ? 'O cliente voltou ao cadastro 302. Confira o vínculo antes de restaurar.' : 'Cliente ausente no cadastro 302. Verifique a planilha ou confirme a retirada da carteira.'));
        if (item.status !== 'pending') {
            if (item.reviewed_at) node.append(text('p', 'Revisado em ' + new Date(item.reviewed_at).toLocaleDateString('pt-BR')));
            if (item.review_note) node.append(text('p', 'Observação: ' + item.review_note));
        } else if (item.can_review) {
            const label = text('label', 'Observação da revisão (opcional)', 'wallet-review-note');
            const note = document.createElement('input');
            note.type = 'text'; note.maxLength = 500; note.placeholder = 'Motivo ou orientação para a equipe';
            label.append(note); node.append(label);
            const actions = text('div', '', 'wallet-review-actions');
            const confirm = text('button', 'Confirmar retirada'); confirm.type = 'button';
            const restore = text('button', 'Restaurar vínculo'); restore.type = 'button'; restore.disabled = !item.can_restore;
            restore.title = item.can_restore ? 'Restaurar promotor e roteirização originais' : 'É necessário que o cliente e o promotor estejam cadastrados e que não exista outro vínculo ativo.';
            const review = async action => {
                if (action === 'removal_confirmed' && !root.confirm('Confirmar a retirada deste cliente da carteira? O vínculo e a roteirização continuarão guardados no histórico.')) return;
                confirm.disabled = true; restore.disabled = true;
                try {
                    const { data, error } = await client.rpc('review_removed_client_promoter_v1', { p_id: item.id, p_action: action, p_note: note.value.trim() || null });
                    if (error) throw error;
                    root.showToast?.('success', data.already_reviewed ? 'Esta ocorrência já foi revisada.' : data.status === 'restored' ? 'Vínculo e roteirização restaurados.' : 'Retirada confirmada. Histórico preservado.');
                    await refresh();
                    if (data.status === 'restored') onRestored();
                } catch (error) {
                    root.showToast?.('error', 'Não foi possível revisar: ' + error.message);
                    confirm.disabled = false; restore.disabled = !item.can_restore;
                }
            };
            confirm.addEventListener('click', () => review('removal_confirmed'));
            restore.addEventListener('click', () => review('restored'));
            actions.append(confirm, restore); node.append(actions);
        } else node.append(text('p', 'A revisão deve ser feita pelo responsável da equipe.'));
        return node;
    }
    async function refresh() {
        if (!client) return;
        if (!el('wallet-review-section')?.open) {
            try { await count(); } catch (error) { console.warn('[Carteira] Falha ao consultar pendências:', error.message); }
            return;
        }
        const ticket = ++sequence;
        const message = el('wallet-review-message');
        message.textContent = 'Carregando clientes para revisão...';
        try {
            const { data, error } = await client.rpc('get_wallet_review_v1', {
                p_promoter: promoter, p_offset: offset, p_limit: pageSize, p_history: el('wallet-review-history').checked
            });
            if (error) throw error;
            if (ticket !== sequence) return;
            total = data.total || 0;
            if (offset >= total && offset > 0) { offset = 0; return refresh(); }
            badges(data.pending_count || 0);
            el('wallet-review-list').replaceChildren(...(data.items || []).map(card));
            message.textContent = total ? (promoter ? 'Ocorrências do promotor selecionado. ' : 'Ocorrências das carteiras que você pode acessar. ') + 'Exibindo ' + (offset + 1) + '–' + Math.min(offset + pageSize, total) + ' de ' + total + '.'
                : 'Nenhuma ocorrência ' + (el('wallet-review-history').checked ? 'no histórico' : 'pendente') + (promoter ? ' deste promotor.' : ' nas suas carteiras.');
            el('wallet-review-prev').disabled = offset === 0;
            el('wallet-review-next').disabled = offset + pageSize >= total;
        } catch (error) {
            if (ticket !== sequence) return;
            message.textContent = 'Não foi possível carregar as pendências. Clique em Atualizar para tentar novamente.';
            el('wallet-review-list').replaceChildren();
            console.warn('[Carteira] Falha ao carregar revisão:', error.message);
        }
    }
    function init(options = {}) {
        if (started) return;
        client = options.client || root.supabaseClient;
        if (!client || !el('wallet-review-section')) return;
        started = true;
        onRestored = options.onRestored || (() => root.location.reload());
        el('wallet-review-section').addEventListener('toggle', () => { if (el('wallet-review-section').open) refresh(); });
        el('wallet-review-history').addEventListener('change', () => { offset = 0; refresh(); });
        el('wallet-review-refresh').addEventListener('click', () => refresh());
        el('wallet-review-prev').addEventListener('click', () => { offset = Math.max(0, offset - pageSize); refresh(); });
        el('wallet-review-next').addEventListener('click', () => { offset += pageSize; refresh(); });
        el('user-menu-wallet-btn')?.addEventListener('click', () => { el('wallet-review-section').open = true; refresh(); });
        el('user-menu-btn')?.addEventListener('click', () => { count().catch(() => {}); });
        document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
        root.setInterval(() => { if (!document.hidden) refresh(); }, 60000);
        refresh();
    }
    root.PrimeWalletReview = { init, refresh, setPromoter(code) { promoter = code || null; offset = 0; refresh(); } };
})(window);
