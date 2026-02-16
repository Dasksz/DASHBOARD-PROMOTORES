from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        # Block Supabase CDN
        page.route("**/*supabase-js*", lambda route: route.fulfill(body="window.supabase = { createClient: () => window.mockSupabaseClient };"))

        # Mock Data
        mock_script = """
        window.embeddedData = {
            detailed: [],
            history: [],
            clients: [],
            byOrder: [],
            stockMap05: {},
            stockMap08: {},
            innovationsMonth: [
                { categoryName: "Salgadinho", productName: "Doritos", productCode: "123", clientsCurrentCount: 150, stock: 500 },
                { categoryName: "Biscoito", productName: "Mabel", productCode: "127", clientsCurrentCount: 60, stock: 100 }
            ],
            hierarchy: [],
            products: [],
            activeProductCodes: [],
            productDetails: {},
            metadata: [],
            clientPromoters: [],
            clientCoordinates: [],
            passedWorkingDaysCurrentMonth: 1,
            isColumnar: false
        };
        window.userRole = 'adm';

        const mockUser = {
            id: 'mock-id',
            email: 'test@test.com',
            user_metadata: { full_name: 'Tester' }
        };

        window.mockSupabaseClient = {
            auth: {
                getUser: async () => ({ data: { user: mockUser } }),
                getSession: async () => ({ data: { session: { user: mockUser } } }),
                onAuthStateChange: (cb) => {
                    setTimeout(() => cb('SIGNED_IN', { user: mockUser }), 100);
                    return { data: { subscription: { unsubscribe: () => {} } } };
                },
                signInWithPassword: async () => ({ data: {}, error: null })
            },
            from: () => ({
                select: () => {
                    const chain = {
                        eq: () => chain,
                        ilike: () => chain,
                        is: () => chain,
                        gte: () => chain,
                        limit: () => chain,
                        order: () => chain,
                        single: async () => ({ data: { status: 'aprovado', role: 'adm' }, error: null }),
                        maybeSingle: async () => ({ data: { status: 'aprovado', role: 'adm' }, error: null }),
                        then: (cb) => cb({ data: [], error: null })
                    };
                    return chain;
                }
            })
        };

        document.addEventListener('DOMContentLoaded', () => {
            window.carregarDadosDoSupabase = async () => {
                console.log("Injecting app.js");
                const scriptEl = document.createElement('script');
                scriptEl.src = 'js/app/app.js?v=' + Date.now();
                scriptEl.onload = () => {
                    console.log("app.js loaded");
                    document.getElementById('loader').classList.add('hidden');
                    document.getElementById('content-wrapper').classList.remove('hidden');
                };
                document.body.appendChild(scriptEl);
            };
        });
        """

        page.add_init_script(mock_script)

        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        try:
            page.wait_for_function("() => window.renderView !== undefined", timeout=15000)
            print("renderView is available.")
            page.evaluate("window.renderView('inovacoes-mes')")

            # Wait for Chart Canvas
            page.wait_for_selector("#innovations-month-chartContainer canvas", timeout=10000)
            print("Chart canvas appeared.")

            # Wait for render
            page.wait_for_timeout(2000)

        except Exception as e:
            print(f"Error: {e}")

        page.screenshot(path="verification/chart_final.png")
        print("Screenshot saved.")
        browser.close()

if __name__ == "__main__":
    run()
