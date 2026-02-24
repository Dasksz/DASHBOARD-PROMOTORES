from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Enable Console Logging
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
    page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))

    # Mock Data Injection
    page.add_init_script("""
        window.supabaseClient = {
            from: () => ({
                select: () => ({
                    eq: () => Promise.resolve({ data: [], error: null }),
                    upsert: () => Promise.resolve({ error: null }),
                    delete: () => Promise.resolve({ error: null })
                })
            })
        };

        window.embeddedData = {
            detailed: [],
            history: [],
            clients: [
                { 'Código': '1', 'nomeCliente': 'Client A', 'cidade': 'City A', 'bairro': 'Bairro A', 'rca1': '10', 'ramo': 'AS', 'dataCadastro': '2023-01-01', 'ultimaCompra': '2023-01-01' }
            ],
            hierarchy: [
                { 'cod_coord': 'C1', 'nome_coord': 'Coord 1', 'cod_cocoord': 'CC1', 'nome_cocoord': 'Cocoord 1', 'cod_promotor': 'P1', 'nome_promotor': 'Promotor 1' }
            ],
            clientPromoters: [
                { 'client_code': '1', 'promoter_code': 'P1' }
            ],
            activeProductCodes: [],
            productDetails: {},
            clientCoordinates: [],
            byOrder: [],
            stockMap05: {},
            stockMap08: {},
            innovationsMonth: [],
            titulos: [],
            nota_perfeita: []
        };

        window.userRole = 'adm';
    """)

    page.goto("http://localhost:8000")

    print("Waiting for loader to hide...")
    page.wait_for_selector("#tela-loading", state="hidden", timeout=15000)
    print("Loader hidden.")

    # Small sleep to ensure app.js execution completes if async
    page.wait_for_timeout(1000)

    # Force Navigation
    print("Calling renderView('cidades')...")
    page.evaluate("renderView('cidades')")

    # Wait for view transition
    page.wait_for_selector("#city-view:not(.hidden)", timeout=5000)

    # 2. Check for Supplier Filter Button presence
    supplier_btn = page.locator("#city-supplier-filter-btn")
    expect(supplier_btn).to_be_visible()

    # 3. Click Supplier Filter
    supplier_btn.click()

    # 4. Check Dropdown Visibility
    dropdown = page.locator("#city-supplier-filter-dropdown")
    expect(dropdown).to_be_visible()

    # 5. Check Hierarchy Filter (Promotor) - Click to verify z-index (visually in screenshot)
    promotor_btn = page.locator("#city-promotor-filter-btn")
    promotor_btn.click()

    promotor_dropdown = page.locator("#city-promotor-filter-dropdown")
    expect(promotor_dropdown).to_be_visible()

    # Take screenshot
    page.screenshot(path="verification/geo_verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
