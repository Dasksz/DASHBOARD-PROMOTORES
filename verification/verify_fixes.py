from playwright.sync_api import sync_playwright
import os
import json

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Read local files
        with open("js/app/utils.js", "r") as f:
            utils_js = f.read()
        with open("js/app/app.js", "r") as f:
            app_js = f.read()

        # Mock Data
        mock_data = {
            "isColumnar": False,
            "detailed": [],
            "history": [],
            "clients": [
                {
                    "Código": "123",
                    "nomeCliente": "Safe Client",
                    "cidade": "Salvador",
                    "rca1": "1001",
                    "ramo": "varejo"
                },
                {
                    "Código": "666",
                    "nomeCliente": "<b style='color:red'>XSS Attack</b>",
                    "cidade": "Hacker City",
                    "rca1": "1001",
                    "ramo": "varejo"
                }
            ],
            "byOrder": [],
            "products": [],
            "hierarchy": [],
            "clientPromoters": [],
            "stockMap05": {},
            "stockMap08": {},
            "activeProductCodes": [],
            "productDetails": {}
        }

        # Intercept requests to block original scripts and inject ours
        def handle_route(route):
            url = route.request.url
            if "app.js" in url or "init.js" in url or "utils.js" in url:
                route.fulfill(body="", status=200)
            else:
                # Mock Supabase or other externals if they block
                if "supabase" in url:
                     route.fulfill(body="{}", status=200)
                else:
                     route.continue_()

        page.route("**/*.js", handle_route)

        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Setup Mock Environment
        # JSON dump to ensure valid JS syntax
        page.evaluate(f"""
            window.embeddedData = {json.dumps(mock_data)};
            window.supabaseClient = {{
                auth: {{ getUser: () => Promise.resolve({{ data: {{ user: {{ id: 'mock-id' }} }} }}) }},
                from: () => ({{
                    select: () => ({{
                        eq: () => ({{
                            gte: () => ({{
                                is: () => ({{
                                    maybeSingle: () => Promise.resolve({{ data: null }})
                                }})
                            }})
                        }})
                    }}),
                    insert: () => ({{ select: () => ({{ single: () => Promise.resolve({{ data: {{ id: 1 }} }}) }}) }})
                }})
            }};
            window.userRole = 'adm';
        """)

        # Inject Scripts
        # Inject utils first
        page.evaluate(utils_js)
        # Inject app
        page.evaluate(app_js)

        # Trigger Render
        # Force visibility of content wrapper
        page.evaluate("document.getElementById('content-wrapper').classList.remove('hidden');")

        # Use renderView to handle view toggling
        page.evaluate("if(window.renderView) window.renderView('clientes');")

        # Wait for the list to appear
        page.wait_for_selector("#clientes-list-container")

        # Take screenshot
        page.screenshot(path="verification/xss_check.png")

        # Inspect Elements
        items = page.locator("#clientes-list-container > div")
        count = items.count()
        print(f"Found {count} items.")

        for i in range(count):
            text = items.nth(i).text_content()
            print(f"Item {i}: {text.strip()}")
            if "<b style='color:red'>XSS Attack</b>" in text:
                print(f"SUCCESS: Item {i} contains escaped HTML tags.")
            elif "XSS Attack" in text:
                # Need to check if it's bold/red to confirm if it executed
                print(f"Item {i} contains text 'XSS Attack'. Checking HTML...")
                html = items.nth(i).inner_html()
                if "&lt;b style='color:red'&gt;" in html or "&lt;b style=&quot;color:red&quot;&gt;" in html:
                     print("SUCCESS: HTML tags are escaped in innerHTML.")
                else:
                     print(f"FAILURE: HTML tags likely NOT escaped. innerHTML: {html}")

        browser.close()

if __name__ == "__main__":
    run_verification()
