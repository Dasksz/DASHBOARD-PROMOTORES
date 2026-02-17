
from playwright.sync_api import sync_playwright
import os
import time

def run_proper(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Pre-load Script
    page.add_init_script("""
        window.userRole = 'adm';
        window.supabaseClient = {
            auth: { getUser: () => Promise.resolve({ data: { user: { id: 'mock' } } }) },
            from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({}) }) }) })
        };

        const currentData = [
            { DTPED: new Date('2023-10-02T10:00:00Z').getTime(), VLVENDA: 1000, TIPOVENDA: '1', CODCLI: '1' },
            { DTPED: new Date('2023-10-03T10:00:00Z').getTime(), VLVENDA: 1500, TIPOVENDA: '1', CODCLI: '1' },
            { DTPED: new Date('2023-10-04T10:00:00Z').getTime(), VLVENDA: 2000, TIPOVENDA: '1', CODCLI: '1' },
            { DTPED: new Date('2023-10-07T10:00:00Z').getTime(), VLVENDA: 500, TIPOVENDA: '1', CODCLI: '1' }
        ];
        const historyData = [
             { DTPED: new Date('2023-09-01T10:00:00Z').getTime(), VLVENDA: 1200, TIPOVENDA: '1', CODCLI: '1' }
        ];

        window.embeddedData = {
            detailed: currentData,
            history: historyData,
            byOrder: currentData, // Mock as same
            clients: [{ 'Código': '1', 'nomeCliente': 'Test Client', 'rca1': '100' }],
            isColumnar: false,
            activeProductCodes: [],
            productDetails: {},
            hierarchy: [],
            clientPromoters: [],
            stockMap05: {},
            stockMap08: {},
            innovationsMonth: []
        };

        window.am5 = {
            Root: { new: () => ({ setThemes: () => {}, container: { children: { push: () => ({ xAxes: { push: () => ({ data: { setAll: () => {} } }) }, yAxes: { push: () => ({ data: { setAll: () => {} } }) }, series: { push: () => ({ data: { setAll: () => {} }, columns: { template: { setAll: () => {} } }, strokes: { template: { setAll: () => {} } }, bullets: { push: () => {} }, appear: () => {} }) }, children: { push: () => ({ data: { setAll: () => {} } }) }, set: () => ({ lineY: { set: () => {} } }), appear: () => {} }) } }, _logo: { dispose: () => {} } }) },
            xy: { XYChart: { new: () => {} }, AxisRendererX: { new: () => ({ grid: { template: { set: () => {} } } }) }, CategoryAxis: { new: () => {} }, AxisRendererY: { new: () => ({ grid: { template: { set: () => {} } } }) }, ValueAxis: { new: () => {} }, ColumnSeries: { new: () => {} }, LineSeries: { new: () => {} }, XYCursor: { new: () => {} } },
            themes_Animated: { new: () => {} },
            themes_Dark: { new: () => {} },
            color: () => {},
            Tooltip: { new: () => {} },
            Bullet: { new: () => {} },
            Circle: { new: () => {} },
            Legend: { new: () => {} },
            p50: 50
        };
        window.am5themes_Animated = window.am5.themes_Animated;
        window.am5themes_Dark = window.am5.themes_Dark;
        window.am5xy = window.am5.xy;
    """)

    page.route("**/js/init.js", lambda route: route.fulfill(body="console.log('Blocked init.js');"))
    page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))
    page.on("pageerror", lambda exc: print(f"Browser Error: {exc}"))

    page.goto(f"file://{os.getcwd()}/index.html")

    page.evaluate("""() => {
        const script = document.createElement('script');
        script.src = 'js/app/app.js';
        document.body.appendChild(script);
    }""")

    time.sleep(3)

    is_app_loaded = page.evaluate("!!window.renderView")
    print(f"App Loaded: {is_app_loaded}")

    if is_app_loaded:
        page.evaluate("renderView('comparativo')")
        time.sleep(1)

        is_daily_active = page.evaluate("""() => {
            const btn = document.getElementById('toggle-daily-btn');
            return btn.classList.contains('active');
        }""")
        print(f"Daily Button Active: {is_daily_active}")

        page.screenshot(path="verification/verification.png")
    else:
        print("App failed to load.")

    browser.close()

with sync_playwright() as playwright:
    run_proper(playwright)
