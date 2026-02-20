from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    # iPhone SE viewport
    context = browser.new_context(viewport={'width': 375, 'height': 667}, device_scale_factor=2)
    page = context.new_page()

    try:
        page.goto("http://localhost:8080")

        # Wait for login screen to confirm load
        page.wait_for_selector("#tela-login", state="visible", timeout=5000)
        print("Login screen visible.")

        # Force switch to content and mix view
        page.evaluate("""
            // Hide Login
            document.getElementById('tela-login').classList.add('hidden');
            document.getElementById('content-wrapper').classList.remove('hidden');

            // Hide Dashboard
            const dashboard = document.getElementById('main-dashboard');
            if(dashboard) dashboard.classList.add('hidden');

            // Hide all other views
            const views = ['city-view', 'positivacao-view', 'titulos-view', 'loja-perfeita-view', 'innovations-month-view', 'goals-view', 'meta-realizado-view', 'coverage-view', 'clientes-view', 'produtos-view', 'history-view', 'wallet-view'];
            views.forEach(id => {
                const el = document.getElementById(id);
                if(el) el.classList.add('hidden');
            });

            // Show Mix View
            const mixView = document.getElementById('mix-view');
            if(mixView) mixView.classList.remove('hidden');

            // Inject Mock Table Body HTML directly (simulating what app.js would render)
            // This verifies that IF app.js outputs this HTML, the CSS renders it correctly.
            const rowHTML = `
                <tr class="hover:bg-slate-700/50 border-b border-slate-500 last:border-0 cursor-pointer md:cursor-default">
                    <!-- Hidden Desktop Code -->
                    <td data-label="Cód" class="px-2 py-2 md:px-4 md:py-2 font-medium text-slate-300 text-[10px] md:text-xs hidden md:table-cell">12345</td>

                    <!-- Client Column -->
                    <td data-label="Cliente" class="px-2 py-2 md:px-4 md:py-2 text-left">
                        <!-- Mobile: Code - Name -->
                        <div class="md:hidden text-xs font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                            12345 - MERCADINHO MODELO LTDA
                        </div>
                        <!-- Desktop: Name -->
                        <div class="hidden md:block text-xs font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] md:max-w-none">
                            MERCADINHO MODELO LTDA
                        </div>

                        <!-- Fantasia (Line 2) -->
                        <div class="text-[10px] text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis max-w-full md:max-w-none mt-1">
                            MERCADINHO DO JOAO
                        </div>
                    </td>

                    <!-- Hidden Desktop Columns -->
                    <td class="hidden md:table-cell">Salvador</td>
                    <td class="hidden md:table-cell">Maria</td>

                    <!-- Mobile Counter -->
                    <td data-label="Categorias" class="px-2 py-2 text-center text-white font-bold text-lg md:text-sm md:hidden border-l border-slate-500">
                        5
                    </td>
                </tr>
            `;

            const tbody = document.getElementById('mix-table-body');
            if(tbody) tbody.innerHTML = rowHTML + rowHTML + rowHTML;

        """)

        # Wait a bit for rendering
        page.wait_for_timeout(500)

        # Take screenshot
        page.screenshot(path="/home/jules/verification/mix_view_mobile_v2.png", full_page=False)
        print("Screenshot saved to /home/jules/verification/mix_view_mobile_v2.png")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        browser.close()

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run(playwright)
