from playwright.sync_api import sync_playwright
import os
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 375, "height": 812})
        page = context.new_page()

        # Capture logs
        page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

        # Block Real Supabase and IDB to preserve our mocks
        page.route("**/*supabase-js*", lambda route: route.abort())
        page.route("**/*idb*", lambda route: route.abort())

        page.add_init_script("""
        window.mockUser = { id: 'test-user', email: 'test@example.com', user_metadata: { full_name: 'Test User' } };
        window.supabase = {
            createClient: () => ({
                auth: {
                    getUser: () => Promise.resolve({ data: { user: window.mockUser } }),
                    getSession: () => Promise.resolve({ data: { session: { user: window.mockUser, access_token: 'fake' } } }),
                    onAuthStateChange: (cb) => {
                        console.log("[Mock] Auth State Change Registered");
                        setTimeout(() => {
                            console.log("[Mock] Triggering SIGNED_IN");
                            cb('SIGNED_IN', { user: window.mockUser });
                        }, 100);
                        return { data: { subscription: { unsubscribe: () => {} } } };
                    },
                    signInWithPassword: () => Promise.resolve({ data: {}, error: null }),
                },
                from: (table) => {
                    if (table === 'profiles') {
                         return {
                             select: () => ({
                                 eq: () => ({ single: () => Promise.resolve({ data: { id: 'test-user', role: 'adm', status: 'aprovado' }, error: null }) })
                             })
                         };
                    }
                    return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }) };
                }
            })
        };
        window.idb = { openDB: () => Promise.resolve({ get: () => null, put: () => null }) };
        """)

        def handle_init_js(route):
            with open("init.js", "r") as f:
                content = f.read()

            mock_loader = """
            // FORCE OVERWRITE
            window.carregarDadosDoSupabase = async function(client) {
                console.log("[Mock] carregarDadosDoSupabase EXECUTION STARTED");
                window.isDataLoaded = true;

                window.embeddedData = {
                    isColumnar: false,
                    detailed: [
                        { CODCLI: '1', NOME: 'Seller A', DTPED: '2023-10-01', VLVENDA: 150.00, PRODUTO: '123', DESCRICAO: 'Produto Teste A', TIPOVENDA: '1', SUPERV: 'Sup A', TOTPESOLIQ: 10, CODFOR: '707', FILIAL: '05' },
                        { CODCLI: '2', NOME: 'Seller B', DTPED: '2023-10-02', VLVENDA: 200.00, PRODUTO: '456', DESCRICAO: 'Produto Teste B', TIPOVENDA: '1', SUPERV: 'Sup B', TOTPESOLIQ: 20, CODFOR: '707', FILIAL: '08' }
                    ],
                    history: [
                        { PEDIDO: '1001', DTPED: '2023-09-01', CODCLI: '1', NOME: 'Seller A', VLVENDA: 500.50, POSICAO: 'F', CODFOR: '707', SUPERV: 'Sup A', TIPOVENDA: '1', TOTPESOLIQ: 50, CODUSUR: '10' },
                        { PEDIDO: '1002', DTPED: '2023-09-02', CODCLI: '1', NOME: 'Seller A', VLVENDA: 1200.00, POSICAO: 'L', CODFOR: '707', SUPERV: 'Sup A', TIPOVENDA: '1', TOTPESOLIQ: 120, CODUSUR: '10' }
                    ],
                    clients: [
                        { 'Código': '1', 'nomeCliente': 'Cliente Um', 'cidade': 'Salvador', 'rca1': 'Seller A' },
                        { 'Código': '2', 'nomeCliente': 'Cliente Dois', 'cidade': 'Feira', 'rca1': 'Seller B' }
                    ],
                    byOrder: [],
                    stockMap05: {}, stockMap08: {},
                    innovationsMonth: [],
                    activeProductCodes: ['123', '456'],
                    productDetails: { '123': { descricao: 'P A', code:'123' }, '456': { descricao: 'P B', code:'456' } },
                    hierarchy: [],
                    clientPromoters: [],
                    clientCoordinates: [],
                    passedWorkingDaysCurrentMonth: 1
                };

                const scriptEl = document.createElement('script');
                scriptEl.src = 'app.js';
                scriptEl.onload = () => {
                    document.getElementById('loader').classList.add('hidden');
                    document.getElementById('content-wrapper').classList.remove('hidden');
                    console.log("[Mock] app.js loaded and ONLOAD fired.");
                };
                document.body.appendChild(scriptEl);
            };
            console.log("[Mock] carregarDadosDoSupabase overwritten in init.js");
            """
            route.fulfill(body=content + "\n" + mock_loader, content_type="application/javascript")

        page.route("**/init.js*", handle_init_js)

        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Poll for renderView
        max_retries = 20
        has_render = False
        for i in range(max_retries):
            has_render = page.evaluate("typeof window.renderView === 'function'")
            if has_render:
                print("renderView detected!")
                break
            time.sleep(0.5)

        if not has_render:
            print("Failed to detect renderView after timeout.")
            page.screenshot(path="verification/failed_load.png")
        else:
            page.screenshot(path="verification/dashboard_mobile_view.png", full_page=True)
            print("Dashboard screenshot captured.")

            print("Switching to History View...")
            page.evaluate("window.renderView('history')")
            time.sleep(1)

            if page.is_visible("#history-filter-btn"):
                page.click("#history-filter-btn")
                time.sleep(1)
                page.screenshot(path="verification/history_mobile_view.png", full_page=True)
                print("History screenshot captured.")
            else:
                print("History filter button missing.")

        browser.close()

if __name__ == "__main__":
    run()
