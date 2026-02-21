from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.add_init_script("""
            window.userRole = 'adm';
            window.localStorage.setItem('userRole', 'adm');
            window.embeddedData = {
                hierarchy: [],
                clients: [],
                detailed: [],
                history: [],
                products: [],
                metadata: []
            };
        """)

        page.goto("http://localhost:8080/index.html")

        # Bypass Login & Show Dashboard
        page.evaluate("""
            document.getElementById('tela-login').classList.add('hidden');
            document.getElementById('content-wrapper').classList.remove('hidden');
            document.getElementById('top-navbar').classList.remove('hidden'); // Show Navbar
            document.getElementById('admin-view-toggle-btn').classList.remove('hidden'); // Show Toggle
        """)

        time.sleep(2)

        # Snapshot 1: Promoter Mode (Default)
        # Expect: Coord Filter Visible, Supervisor Filter Hidden
        page.screenshot(path="verification/step1_promoter_mode.png")

        # Click Toggle
        page.click('#admin-view-toggle-btn')
        time.sleep(1)

        # Snapshot 2: Seller Mode
        # Expect: Coord Filter Hidden, Supervisor Filter Visible
        page.screenshot(path="verification/step2_seller_mode.png")

        browser.close()

if __name__ == "__main__":
    run()
