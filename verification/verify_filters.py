from playwright.sync_api import sync_playwright
import time

def verify_filters():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Browser Error: {err}"))

        # Inject mock embeddedData to prevent crash
        page.add_init_script("""
            window.embeddedData = {
                metadata: [],
                hierarchy: [],
                clients: [],
                detailed: [],
                history: [],
                byOrder: []
            };
            window.userRole = 'adm';
        """)

        page.goto("http://localhost:8000/index.html")
        time.sleep(2)

        print("Forcing UI visibility...")
        page.evaluate("""
            document.getElementById('content-wrapper').classList.remove('hidden');
            const login = document.getElementById('tela-login'); if(login) login.classList.add('hidden');
            const loading = document.getElementById('tela-loading'); if(loading) loading.classList.add('hidden');
            const loader = document.getElementById('loader'); if(loader) loader.classList.add('hidden');
        """)
        time.sleep(1)

        # 1. Verify Rede Button Visuals
        print("Testing Rede Button Visuals...")
        rede_btn = page.locator("#main-com-rede-btn")

        # Click "Com Rede"
        rede_btn.click(force=True)
        time.sleep(0.5)

        # Check for .active class
        is_active = "active" in rede_btn.get_attribute("class")
        print(f"Rede Button has active class: {is_active}")

        bg_color = rede_btn.evaluate("element => getComputedStyle(element).backgroundColor")
        print(f"Rede Button Background Color: {bg_color}")

        # 2. Verify Clear Filters
        print("Testing Clear Filters...")
        client_input = page.locator("#codcli-filter")
        clear_btn = page.locator("#clear-filters-btn")

        client_input.fill("12345")
        clear_btn.click(force=True)
        time.sleep(0.5)

        val_after = client_input.input_value()
        print(f"Client Input after clear: '{val_after}'")

        page.screenshot(path="verification/final_check.png")
        browser.close()

if __name__ == "__main__":
    verify_filters()
