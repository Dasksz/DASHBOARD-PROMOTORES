from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load local index.html
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Wait for page load
        page.wait_for_load_state("networkidle")

        # Determine if we need to bypass login?
        # The login screen is #tela-login. It has z-[2000].
        # If it's visible, we might block the sidebar view.
        # But the sidebar is in #content-wrapper which is .hidden by default until login?
        # "document.getElementById('content-wrapper').classList.remove('hidden');" happens in init.js after loading data.

        # Since I cannot easily mock the full Supabase login flow in this environment without credentials or mocking,
        # I will forcefully show the sidebar and hide the login screen via JS injection for verification purposes.

        page.evaluate("""() => {
            document.getElementById('tela-login').classList.add('hidden');
            document.getElementById('content-wrapper').classList.remove('hidden');

            // Open sidebar
            const sidebar = document.getElementById('side-menu');
            sidebar.classList.remove('-translate-x-full');
        }""")

        # Wait a bit for transition
        page.wait_for_timeout(500)

        # Take screenshot of the sidebar area
        page.screenshot(path="verification/sidebar_check.png")

        browser.close()

if __name__ == "__main__":
    run()
