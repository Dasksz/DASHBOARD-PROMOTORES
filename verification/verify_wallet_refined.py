from playwright.sync_api import sync_playwright, expect

def verify_refined_wallet(page):
    page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))
    page.on("pageerror", lambda err: print(f"Browser Error: {err}"))

    # 1. Arrange: Go to local server
    page.goto("http://localhost:8080")

    # 2. Setup Mock Environment & Data
    mock_data_setup = """
    window.embeddedData = {
        clients: [
            {
                'Código': '5464',
                'Fantasia': 'MERCADO NOVA CONQUISTA',
                'Razão Social': 'ALESSANDRO SANTOS OLIVEIRA',
                'CNPJ/CPF': '59.871.502',
                'Cidade': 'Salvador',
                'PROMOTOR': 'TEST',
                'rca1': 'TEST',
                'ultimacompra': '2023-01-01'
            },
            {
                'Código': '9999',
                'Fantasia': 'TEST CLIENT',
                'Razão Social': 'TEST REASON',
                'CNPJ/CPF': '00.000.000',
                'Cidade': 'Test City',
                'PROMOTOR': 'TEST',
                'rca1': 'TEST'
            }
        ],
        clientPromoters: [],
        byOrder: [],
        detailed: [],
        history: [],
        hierarchy: [],
        metadata: [],
        isColumnar: false
    };
    window.userRole = 'ADM';
    const mockQueryBuilder = {
        select: () => mockQueryBuilder,
        eq: () => mockQueryBuilder,
        in: () => mockQueryBuilder,
        is: () => mockQueryBuilder,
        gte: () => mockQueryBuilder,
        gt: () => mockQueryBuilder,
        lt: () => mockQueryBuilder,
        lte: () => mockQueryBuilder,
        like: () => mockQueryBuilder,
        ilike: () => mockQueryBuilder,
        limit: () => mockQueryBuilder,
        order: () => mockQueryBuilder,
        delete: () => mockQueryBuilder,
        insert: () => mockQueryBuilder,
        update: () => mockQueryBuilder,
        upsert: () => mockQueryBuilder,
        single: () => Promise.resolve({ data: {}, error: null }),
        maybeSingle: () => Promise.resolve({ data: {}, error: null }),
        then: (resolve) => resolve({ data: [], error: null })
    };

    window.supabaseClient = {
        from: () => mockQueryBuilder,
        auth: {
            getUser: () => Promise.resolve({ data: { user: { id: 'test' } }, error: null })
        }
    };
    """
    page.evaluate(mock_data_setup)

    # 3. Inject scripts in order
    page.evaluate("""
        const s1 = document.createElement('script');
        s1.src = 'js/app/utils.js';
        document.body.appendChild(s1);

        s1.onload = () => {
            const s2 = document.createElement('script');
            s2.src = 'js/app/app.js?v=' + Date.now();
            document.body.appendChild(s2);
        };
    """)

    # 4. Wait for renderWalletTable to be available
    try:
        page.wait_for_function("() => typeof window.renderWalletTable === 'function'", timeout=10000)
    except:
        # Debug info
        page.evaluate("console.log('DEBUG: window.renderWalletTable type:', typeof window.renderWalletTable)")
        # Force continue to see if it works anyway or fails at call

    # 5. Prepare UI
    page.evaluate("document.getElementById('tela-login').classList.add('hidden')")
    page.evaluate("document.getElementById('content-wrapper').classList.remove('hidden')")

    page.evaluate("window.renderWalletTable()")

    page.evaluate("document.getElementById('wallet-view').classList.remove('hidden')")
    page.evaluate("document.getElementById('main-dashboard').classList.add('hidden')")

    # Force Mobile Viewport
    page.set_viewport_size({"width": 375, "height": 812})

    # 6. Screenshot
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/refined_wallet.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_refined_wallet(page)
        finally:
            browser.close()
