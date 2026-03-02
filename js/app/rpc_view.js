// js/app/rpc_view.js

document.addEventListener('DOMContentLoaded', () => {
    // Referências aos elementos da DOM
    const btnFetchRpc = document.getElementById('btn-fetch-rpc');
    const rcaLoading = document.getElementById('rpc-loading');
    const rcaContent = document.getElementById('rpc-content');

    const kpiFaturamento = document.getElementById('rpc-faturamento');
    const kpiPeso = document.getElementById('rpc-peso');
    const kpiPositivacao = document.getElementById('rpc-positivacao');
    const kpiSalty = document.getElementById('rpc-salty');
    const kpiFoods = document.getElementById('rpc-foods');
    const kpiMetas = document.getElementById('rpc-metas');
    const kpiInovacoes = document.getElementById('rpc-inovacoes');

    // Verifica se o usuário tem permissão para ver o botão (somente 'adm')
    // Usamos um pequeno atraso para garantir que o window.userRole já foi populado pelo init.js
    setTimeout(() => {
        const btnMenuRpc = document.getElementById('rpc-view-btn');
        if (btnMenuRpc && window.userRole === 'adm') {
            btnMenuRpc.classList.remove('hidden');

            // Adiciona o evento de clique para abrir a view (integração com a navegação existente)
            btnMenuRpc.addEventListener('click', () => {
                if (typeof window.renderView === 'function') {
                    window.renderView('rpc');
                } else {
                    // Fallback se renderView não estiver disponível no escopo global
                    document.querySelectorAll('.view, [id$="-view"], #main-dashboard').forEach(el => {
                        if (el.id !== 'rpc-view') el.classList.add('hidden');
                    });
                    const view = document.getElementById('rpc-view');
                    if(view) view.classList.remove('hidden');
                }
            });
        }
    }, 1000);

    // Lógica para buscar os dados via RPC
    if (btnFetchRpc) {
        btnFetchRpc.addEventListener('click', async () => {
            // 1. Mostrar estado de carregamento
            rcaLoading.classList.remove('hidden');
            btnFetchRpc.disabled = true;
            btnFetchRpc.innerHTML = 'Processando...';

            try {
                // Pegar o ano e mês dos filtros globais do dashboard, ou fallback para o atual
                const hoje = new Date();
                const anoAtual = typeof window.currentYear !== 'undefined' ? window.currentYear : hoje.getFullYear();
                const mesAtual = typeof window.currentMonth !== 'undefined' ? window.currentMonth : (hoje.getMonth() + 1);

                // Pegar as filiais selecionadas nos filtros globais, se houver
                let filiaisArray = null;
                if (typeof window.selectedFiliais !== 'undefined' && window.selectedFiliais.size > 0) {
                    filiaisArray = Array.from(window.selectedFiliais);
                }

                console.log(`[RPC PoC] Chamando get_rpc_dashboard_data para ${mesAtual}/${anoAtual}, Filiais: ${filiaisArray || 'Todas'}...`);

                // 2. Chamar a função RPC no Supabase com parâmetros dinâmicos
                const { data, error } = await window.supabaseClient.rpc('get_rpc_dashboard_data', {
                    p_ano: anoAtual,
                    p_mes: mesAtual,
                    p_filial: filiaisArray,
                    p_vendedor: null // Vendedor mantido null na PoC geral, a menos que especificado
                });

                if (error) {
                    throw error;
                }

                console.log('[RPC PoC] Resposta do Banco de Dados:', data);

                // 3. Atualizar a UI com os dados formatados
                if (data) {
                    // Função auxiliar para formatar moeda (caso formatMoney não esteja no escopo)
                    const formataMoeda = (valor) => {
                        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
                    };

                    kpiFaturamento.textContent = typeof window.formatMoney === 'function' ? window.formatMoney(data.kpi_faturamento) : formataMoeda(data.kpi_faturamento);
                    kpiPeso.textContent = Number(data.kpi_peso_kg || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                    kpiPositivacao.textContent = data.kpi_clientes_positivados || 0;
                    kpiSalty.textContent = data.kpi_mix_salty || 0;
                    kpiFoods.textContent = data.kpi_mix_foods || 0;
                    kpiMetas.textContent = typeof window.formatMoney === 'function' ? window.formatMoney(data.kpi_metas) : formataMoeda(data.kpi_metas);
                    kpiInovacoes.textContent = data.kpi_inovacoes || 0;

                    if (window.showToast) {
                        window.showToast('success', 'Dados atualizados via banco de dados em tempo real!', 'RPC PoC');
                    }
                }

            } catch (err) {
                console.error('[RPC PoC] Erro ao buscar dados:', err);

                // Tratar erro específico: a função não existe no banco
                let msgErro = err.message;
                if (msgErro.includes('Could not find the function')) {
                    msgErro = 'Função get_rpc_dashboard_data não encontrada no banco. Você executou o script SQL/RPC_POC.sql no Supabase?';
                }

                if (window.showToast) {
                    window.showToast('error', msgErro, 'Erro no RPC');
                } else {
                    alert('Erro no RPC: ' + msgErro);
                }
            } finally {
                // 4. Restaurar estado da UI
                rcaLoading.classList.add('hidden');
                btnFetchRpc.disabled = false;
                btnFetchRpc.innerHTML = `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    Sincronizar Via RPC
                `;
            }
        });
    }
});
