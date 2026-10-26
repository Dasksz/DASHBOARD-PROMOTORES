(function(root) {
    'use strict';
    function validateSummary(data) {
        const numbers = ['totalFaturamento','totalPeso','skuPdv','positivacaoCount','positivacaoPercent','totalRelevantClients'];
        const maps = ['vendasPorCoord','vendasPorCoCoord','vendasPorPromotor'];
        if (!data || data.schema_version !== 1 || numbers.some(k => !Number.isFinite(data[k]))
            || maps.some(k => !data[k] || typeof data[k] !== 'object' || Array.isArray(data[k]) || Object.values(data[k]).some(v => !Number.isFinite(v)))) {
            throw new Error('Resposta inválida da Visão Geral.');
        }
        return data;
    }
    function createController(client, { onPending = () => {}, onError = () => {} } = {}) {
        let request = 0, controller;
        return {
            async load(filters) {
                const id = ++request;
                controller?.abort();
                controller = new AbortController();
                const active = controller;
                onPending(true);
                try {
                    const { data, error } = await client.rpc('get_overview_summary_v1', { p_filters: filters }).abortSignal(active.signal);
                    if (id !== request) return null;
                    if (error) throw error;
                    return validateSummary(data);
                } catch (error) {
                    if (id === request) onError(error);
                    return null;
                } finally {
                    if (id === request) onPending(false);
                }
            }
        };
    }
    const api = { validateSummary, createController };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.PrimeOverviewRPC = api;
})(typeof window === 'undefined' ? globalThis : window);
