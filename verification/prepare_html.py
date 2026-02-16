
import os

# Read index.html
with open('index.html', 'r') as f:
    html_content = f.read()

# Mock Data
mock_script = """
<script>
    // MOCK Chart.js
    window.Chart = class {
        constructor() {}
        static register() {}
    };
    window.ChartDataLabels = {};

    // MOCK DATA INJECTION
    window.embeddedData = {
        isColumnar: false,
        history: [
            { DTPED: '2023-10-05', PEDIDO: 'HIST-100', CODCLI: '101', VLVENDA: 150.00, POSICAO: 'F', NOME: 'RCA1', CODFOR: '707', CODUSUR: '10', TIPOVENDA: '1' },
            { DTPED: '2023-10-10', PEDIDO: 'HIST-101', CODCLI: '102', VLVENDA: 250.00, POSICAO: 'F', NOME: 'RCA1', CODFOR: '708', CODUSUR: '10', TIPOVENDA: '1' }
        ],
        detailed: [
            { DTPED: '2023-10-20', PEDIDO: 'CURR-200', CODCLI: '101', VLVENDA: 350.00, POSICAO: 'F', NOME: 'RCA1', CODFOR: '707', TIPOVENDA: '1', CODUSUR: '10' },
            { DTPED: '2023-10-25', PEDIDO: 'CURR-201', CODCLI: '103', VLVENDA: 450.00, POSICAO: 'L', NOME: 'RCA2', CODFOR: '752', TIPOVENDA: '1', CODUSUR: '11' }
        ],
        clients: [
            { 'Código': '101', 'codigo_cliente': '101', nomeCliente: 'CLIENTE HISTORICO E ATUAL', cidade: 'SALVADOR', rca1: '10' },
            { 'Código': '102', 'codigo_cliente': '102', nomeCliente: 'CLIENTE SO HISTORICO', cidade: 'SALVADOR', rca1: '10' },
            { 'Código': '103', 'codigo_cliente': '103', nomeCliente: 'CLIENTE SO ATUAL', cidade: 'LAURO', rca1: '11' }
        ],
        hierarchy: [],
        clientPromoters: [],
        byOrder: [],
        stockMap05: {},
        stockMap08: {},
        productDetails: {},
        activeProductCodes: []
    };

    // Recursive Mock for Supabase Query Builder
    const createMockBuilder = (resultOverride = null) => {
        const builder = new Proxy(() => {}, {
            get: (target, prop) => {
                if (prop === 'then') {
                    // Default resolve to empty array
                    const res = resultOverride !== null ? resultOverride : { data: [], error: null };
                    return (resolve, reject) => resolve(res);
                }
                if (prop === 'single' || prop === 'maybeSingle') {
                    return () => Promise.resolve({ data: {}, error: null });
                }
                // Return builder for chaining
                return (...args) => builder;
            },
            apply: (target, thisArg, argumentsList) => {
                return builder;
            }
        });
        return builder;
    };

    window.supabaseClient = {
        auth: {
            getUser: async () => ({ data: { user: { id: 'test-user' } } }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            getSession: async () => ({ data: { session: { access_token: 'mock' } } })
        },
        from: () => createMockBuilder(),
        storage: { from: () => createMockBuilder() }
    };

    window.userRole = 'adm'; // Full access
    window.userHierarchyContext = { role: 'adm' };

    // Mock ShowToast to prevent crashes
    window.showToast = (type, msg) => console.log(`[Toast ${type}] ${msg}`);

    // Auto-trigger setup after app.js loads
    // Since we use defer, we can listen for DOMContentLoaded or window.onload
    window.addEventListener('load', () => {
        console.log("Window Loaded. Starting Mock Setup...");

        // Ensure renderView exists
        if (!window.renderView) {
            console.error("renderView not found! app.js might have failed.");
            return;
        }

        // We also need to hide login and show dashboard
        setTimeout(() => {
            const login = document.getElementById('tela-login');
            if(login) login.classList.add('hidden');
            const content = document.getElementById('content-wrapper');
            if(content) content.classList.remove('hidden');

            console.log("Rendering History View...");
            window.renderView('history');

            // Pre-fill dates for test
            const start = document.getElementById('history-date-start');
            const end = document.getElementById('history-date-end');
            if(start) start.value = '2023-10-01';
            if(end) end.value = '2023-10-31';

            // Trigger Filter
            const btn = document.getElementById('history-filter-btn');
            if(btn) {
                console.log("Clicking Filter...");
                btn.click();
            } else {
                console.error("Filter button not found!");
            }
        }, 1000);
    });
</script>
"""

# Inject mock script and app.js with DEFER
replacement = mock_script + '\n<script src="js/app/app.js" defer></script>'

modified_html = html_content.replace('<script src="js/init.js?v=6.0.0" defer></script>', replacement)

# Save to ROOT directory
with open('test_history.html', 'w') as f:
    f.write(modified_html)
