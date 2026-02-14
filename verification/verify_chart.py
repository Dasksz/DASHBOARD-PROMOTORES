
import os
import json
from playwright.sync_api import sync_playwright
import time
import subprocess

def test_chart_render():
    # Start server
    server_process = subprocess.Popen(["python3", "-m", "http.server", "8080"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            # Console Logging
            page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))
            page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))

            # Mock Data Injection
            mock_data = {
                "isColumnar": False,
                "detailed": [
                    {"CODCLI": "1", "PRODUTO": "100", "VLVENDA": 100, "QTVENDA": 10, "TIPOVENDA": "1", "DTPED": "2023-10-01", "CODFOR": "707", "OBSERVACAOFOR": "PEPSICO", "FILIAL": "05", "SUPERV": "S1", "NOME": "RCA1", "CODUSUR": "123", "POSICAO": "F"},
                    {"CODCLI": "2", "PRODUTO": "101", "VLVENDA": 200, "QTVENDA": 20, "TIPOVENDA": "1", "DTPED": "2023-10-01", "CODFOR": "707", "OBSERVACAOFOR": "PEPSICO", "FILIAL": "05", "SUPERV": "S1", "NOME": "RCA1", "CODUSUR": "123", "POSICAO": "F"}
                ],
                "history": [],
                "clients": [
                    {"Código": "1", "Cliente": "Client A", "rca1": "123", "cidade": "City A", "bairro": "Bairro A", "PROMOTOR": "P1", "Codigo": "1"},
                    {"Código": "2", "Cliente": "Client B", "rca1": "123", "cidade": "City A", "bairro": "Bairro A", "PROMOTOR": "P1", "Codigo": "2"}
                ],
                "products": [
                    {"code": "100", "descricao": "Product A (Cat 1)", "codfor": "707", "fornecedor": "PEPSICO"},
                    {"code": "101", "descricao": "Product B (Cat 2)", "codfor": "707", "fornecedor": "PEPSICO"}
                ],
                "activeProductCodes": ["100", "101"],
                "byOrder": [],  # Added to prevent sort error
                "innovationsMonth": {
                    "active": True,
                    "categories": {
                        "Categoria Teste": {
                            "products": [
                                {"Codigo": "100", "Produto": "Produto A Teste"},
                                {"Codigo": "101", "Produto": "Produto B Teste"}
                            ],
                            "productCodes": ["100", "101"]
                        }
                    }
                },
                "hierarchy": [
                    {"cod_promotor": "P1", "nome_promotor": "Promoter 1", "cod_coord": "C1", "cod_cocoord": "CC1"}
                ],
                "clientPromoters": [],
                "clientCoordinates": []
            }

            # Inject Mock Script
            page.add_init_script(f"""
                window.supabaseClient = {{
                    auth: {{
                        getUser: () => Promise.resolve({{ data: {{ user: {{ id: '123' }} }} }}),
                        getSession: () => Promise.resolve({{ data: {{ session: {{ user: {{ id: '123' }} }} }} }}),
                        onAuthStateChange: () => {{}}
                    }},
                    from: () => ({{
                        select: () => ({{
                            eq: () => ({{
                                single: () => Promise.resolve({{ data: {{ role: 'adm', status: 'aprovado' }} }}),
                                maybeSingle: () => Promise.resolve({{ data: {{ role: 'adm', status: 'aprovado' }} }}),
                                order: () => ({{ limit: () => ({{ maybeSingle: () => Promise.resolve({{}}) }}) }})
                            }})
                        }})
                    }})
                }};

                window.embeddedData = {json.dumps(mock_data)};
                window.userRole = 'adm';
                window.isDataLoaded = true;
            """)

            page.goto("http://localhost:8080/index.html")

            # Manually inject app.js since we bypassed init.js fetching logic
            page.evaluate("""
                const script = document.createElement('script');
                script.src = 'app.js';
                document.body.appendChild(script);
            """)

            # Wait for app.js to initialize and expose renderView
            page.wait_for_function("() => typeof window.renderView === 'function'")

            # Force UI visibility
            page.evaluate("document.getElementById('content-wrapper').classList.remove('hidden');")
            page.evaluate("document.getElementById('tela-login').classList.add('hidden');")
            page.evaluate("document.getElementById('top-navbar').classList.remove('hidden');")

            # Render View
            page.evaluate("window.renderView('inovacoes-mes')")

            # Wait for chart
            time.sleep(3)

            page.screenshot(path="verification/verification.png")
            print("Screenshot saved.")

    finally:
        server_process.kill()

if __name__ == "__main__":
    test_chart_render()
