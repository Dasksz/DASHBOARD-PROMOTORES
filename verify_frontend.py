
from playwright.sync_api import sync_playwright
import time
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))
    page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

    # Block init.js
    page.route("**/js/init.js", lambda route: route.fulfill(body="console.log('Blocked init.js');"))

    # Navigate
    page.goto("http://localhost:8080/index.html")

    # Inject Mocks
    page.evaluate("""
        window.userRole = 'adm';
        window.supabaseClient = {
            auth: {
                getUser: async () => ({ data: { user: { id: 'mock-user' } } }),
                getSession: async () => ({ data: { session: { user: { id: 'mock-user' } } } })
            },
            from: () => ({
                select: () => ({
                    eq: () => ({
                        single: async () => ({ data: {} }),
                        maybeSingle: async () => ({ data: {} })
                    })
                })
            })
        };

        window.embeddedData = {
            isColumnar: false,
            clients: [
                {
                    'Código': '1001',
                    'Cliente': 'CLIENTE TESTE',
                    'Fantasia': 'TESTE LTDA',
                    'CNPJ/CPF': '12.345.678/0001-99',
                    'RCA 1': '50',
                    'CIDADE': 'SALVADOR',
                    'BAIRRO': 'CENTRO',
                    'rca1': '50',
                    'razaoSocial': 'TESTE LTDA'
                }
            ],
            clientPromoters: [],
            detailed: [],
            history: [],
            products: [],
            byOrder: [],
            innovationsMonth: [],
            activeProductCodes: [],
            productDetails: {},
            stockMap05: {},
            stockMap08: {}
        };

        if (!window.normalizeKey) window.normalizeKey = (k) => String(k).trim();
        if (!window.escapeHtml) window.escapeHtml = (s) => s;
        if (!window.parseDate) window.parseDate = () => new Date();
    """)

    # Inject app.js locally
    with open("js/app/app.js", "r") as f:
        app_js = f.read()

    page.evaluate(app_js)
    print("Injected app.js")

    time.sleep(2)

    # Render Wallet View
    try:
        page.evaluate("if (typeof window.renderClientView === 'function') { window.renderClientView(); document.getElementById('wallet-view').classList.remove('hidden'); } else console.error('renderClientView missing');")
    except Exception as e:
        print(f"Error rendering view: {e}")

    page.wait_for_timeout(1000)

    # 1. Verify Table Headers
    detalhes_header = page.query_selector("th:has-text('Detalhes')")
    acao_header = page.query_selector("th:has-text('Ação')")

    print(f"Detalhes Header Present: {detalhes_header is not None}")
    print(f"Ação Header Present: {acao_header is not None}")

    # 2. Open Modal to check colors
    try:
        page.evaluate("if (typeof window.openWalletClientModal === 'function') window.openWalletClientModal('1001');")
        page.wait_for_timeout(1000)
    except Exception as e:
        print(f"Error opening modal: {e}")

    # Take Screenshot
    page.screenshot(path="verification_frontend.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
