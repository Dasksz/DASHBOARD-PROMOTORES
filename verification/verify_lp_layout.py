from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture Console Logs
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page Error: {err}"))

        # Inject Mock Data via init script
        page.add_init_script("""
            // Mock Chart.js
            window.Chart = class {
                constructor() {}
                update() {}
                destroy() {}
                static register() {}
            };
            window.ChartDataLabels = {};

            // Mock Supabase
            window.supabaseClient = {
                from: () => ({
                    select: () => ({
                        eq: () => ({
                            gte: () => Promise.resolve({ data: [] }),
                            single: () => Promise.resolve({ data: null }),
                            maybeSingle: () => Promise.resolve({ data: null })
                        }),
                        in: () => Promise.resolve({ data: [] })
                    }),
                    insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: {} }) }) }),
                    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
                    upsert: () => Promise.resolve({ error: null }),
                    delete: () => ({ eq: () => Promise.resolve({ error: null }) })
                }),
                auth: {
                    getUser: () => Promise.resolve({ data: { user: { id: 'test-user' } } }),
                    signOut: () => Promise.resolve({ error: null })
                },
                storage: {
                    from: () => ({
                        upload: () => Promise.resolve({ data: {}, error: null }),
                        getPublicUrl: () => ({ data: { publicUrl: 'http://mock.url/img.jpg' } })
                    })
                }
            };

            // Mock Embedded Data
            window.embeddedData = {
                hierarchy: [],
                clients: [
                    { 'Código': '123', 'Nome Fantasia': 'Loja Teste', 'Cidade': 'Salvador', 'rca1': '53' }
                ],
                detailed: [],
                history: [],
                nota_perfeita: [
                    { codigo_cliente: '123', pesquisador: 'PROMOTOR1', nota_media: 95, auditorias: 1, auditorias_perfeitas: 1, city: 'Salvador' },
                    { codigo_cliente: '456', pesquisador: 'RCA99', nota_media: 70, auditorias: 1, auditorias_perfeitas: 0, city: 'Salvador' }
                ],
                relacao_rota_involves: [
                    { involves_code: 'promotor1', seller_code: 'PROMOTOR1' }
                ],
                byOrder: [],
                isColumnar: false,
                stockMap05: {},
                stockMap08: {},
                innovationsMonth: [],
                activeProductCodes: [],
                productDetails: {},
                clientCoordinates: []
            };

            window.userRole = 'adm';
        """)

        # Navigate
        page.goto("http://localhost:8000")

        # Wait for Utils to load
        time.sleep(1)

        # Inject app.js manually
        print("Injecting app.js...")
        page.evaluate("""() => {
            const script = document.createElement('script');
            script.src = 'js/app/app.js';
            script.onload = () => { window.appLoaded = true; };
            document.body.appendChild(script);
        }""")

        # Wait for app load
        for _ in range(20):
            if page.evaluate("window.appLoaded === true"):
                break
            time.sleep(0.5)

        # Check renderView
        exists = page.evaluate("typeof window.renderView !== 'undefined'")
        if not exists:
            print("renderView still undefined. App crashed or didn't load.")
            browser.close()
            return

        # Navigate to Loja Perfeita
        print("Navigating to Loja Perfeita...")
        page.evaluate("renderView('loja-perfeita')")

        # Hide overlay stuff
        page.evaluate("""() => {
            const login = document.getElementById('tela-login');
            if(login) login.style.display = 'none';
            const loader = document.getElementById('loader');
            if(loader) loader.style.display = 'none';
            const main = document.getElementById('main-dashboard');
            if(main) main.style.display = 'block';
            const lp = document.getElementById('loja-perfeita-view');
            if(lp) lp.style.display = 'block';
        }""")

        time.sleep(1)

        # Open Researcher Dropdown
        print("Opening Dropdown...")
        try:
            page.click("#lp-researcher-filter-btn")
            time.sleep(0.5)
        except Exception as e:
            print(f"Error clicking dropdown: {e}")

        # Take Screenshot
        page.screenshot(path="verification/loja_perfeita_verify.png", full_page=True)
        print("Screenshot taken.")

        browser.close()

if __name__ == "__main__":
    run()
