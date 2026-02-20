from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 375, "height": 1200},
        user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
    )
    page = context.new_page()

    # Debug Console
    page.on("console", lambda msg: print(f"BROWSER: {msg.text}"))
    page.on("pageerror", lambda exc: print(f"BROWSER ERROR: {exc}"))

    page.route("**/*supabase*", lambda route: route.fulfill(status=200, body="{}"))

    page.goto("http://localhost:8080")

    page.evaluate("""
        () => {
            const mockHistory = [
                {
                    PEDIDO: '28211817',
                    CODCLI: '1756',
                    NOME: 'VENDEDOR A',
                    CODFOR: '707',
                    VLVENDA: 1500.50,
                    DTPED: new Date().getTime(),
                    POSICAO: 'F', // Faturado (Green)
                },
                {
                    PEDIDO: '987654321',
                    CODCLI: '1002',
                    NOME: 'VENDEDOR B',
                    CODFOR: '708',
                    VLVENDA: 500.00,
                    DTPED: new Date().getTime() - 86400000,
                    POSICAO: 'M', // Montado (Yellow)
                },
                {
                    PEDIDO: '456123789',
                    CODCLI: '1003',
                    NOME: 'VENDEDOR A',
                    CODFOR: '752',
                    VLVENDA: 250.00,
                    DTPED: new Date().getTime() - 172800000,
                    POSICAO: 'L', // Liberado (Blue)
                }
            ];

            const mockClients = [
                { 'Código': '1756', 'nomeCliente': 'SUPERMERCADO MAIS DE AIQUARA LTDA', 'fantasia': 'SUPERMERCADO MAIS DE AIQUARA', 'cidade': 'AIQUARA' },
                { 'Código': '1002', 'nomeCliente': 'MERCADINHO DO BAIRRO', 'fantasia': 'MERCADINHO TOP', 'cidade': 'FEIRA' },
                { 'Código': '1003', 'nomeCliente': 'PADARIA PÃO QUENTE', 'fantasia': '', 'cidade': 'LAURO' }
            ];

            window.embeddedData = {
                detailed: [],
                history: mockHistory,
                clients: mockClients,
                byOrder: [],
                stockMap05: {},
                stockMap08: {},
                innovationsMonth: {},
                activeProductCodes: [],
                productDetails: {},
                metadata: [],
                hierarchy: [],
                clientPromoters: [],
                clientCoordinates: [],
                titulos: [],
                nota_perfeita: [],
                passedWorkingDaysCurrentMonth: 1,
                isColumnar: false
            };

            window.userRole = 'adm';
            window.isDataLoaded = true;

            const login = document.getElementById('tela-login');
            if(login) login.classList.add('hidden');
            document.getElementById('content-wrapper').classList.remove('hidden');

            const script = document.createElement('script');
            script.src = 'js/app/app.js';
            script.onload = () => {
                setTimeout(() => {
                    if (window.renderHistoryView) {
                        document.querySelectorAll('#content-wrapper > div').forEach(d => d.classList.add('hidden'));
                        document.getElementById('history-view').classList.remove('hidden');

                        window.renderHistoryView();

                        // Set Filters
                        const start = new Date();
                        start.setDate(start.getDate() - 30);
                        const end = new Date();

                        // Use valueAsDate for reliable setting
                        document.getElementById('history-date-start').valueAsDate = start;
                        document.getElementById('history-date-end').valueAsDate = end;

                        console.log("Triggering Filter...");
                        document.getElementById('history-filter-btn').click();

                        setTimeout(() => {
                            const table = document.querySelector("#history-table-body");
                            if(table) table.scrollIntoView();
                        }, 500);
                    } else {
                        console.error("renderHistoryView not found");
                    }
                }, 1000);
            };
            document.body.appendChild(script);
        }
    """)

    try:
        page.wait_for_selector("#history-table-body tr td.md\:hidden", timeout=10000) # Wait for mobile row
    except:
        print("Timeout waiting for table rows.")

    time.sleep(2)
    page.screenshot(path="verification/verification_scroll.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
