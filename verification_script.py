
from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Set viewport to a size where the issue was likely happening (e.g. 1024px width)
        context = browser.new_context(viewport={'width': 1024, 'height': 768})
        page = context.new_page()

        # Load the page
        page.goto("http://localhost:8000")

        time.sleep(2) # Wait for init

        # Bypass Login
        print("Bypassing login screens...")
        page.evaluate("""
            document.getElementById('tela-login').classList.add('hidden');
            document.getElementById('tela-loading').classList.add('hidden');
            document.getElementById('top-navbar').classList.remove('hidden');
            document.getElementById('content-wrapper').classList.remove('hidden');
        """)

        # Manually Show Comparison View
        print("Forcing comparison view visibility...")
        page.evaluate("""
            document.querySelectorAll('#content-wrapper > div').forEach(el => {
                if (el.id !== 'page-transition-loader') el.classList.add('hidden');
            });
            document.getElementById('comparison-view').classList.remove('hidden');
        """)

        # Wait for comparison view to be visible
        try:
            page.wait_for_selector("#comparison-view", state="visible", timeout=5000)
        except:
            print("Timeout waiting for comparison-view. Dumping HTML state of comparison-view.")
            html = page.eval_on_selector("#comparison-view", "el => el.outerHTML")
            # print(html)
            # If it's still hidden, maybe there is some other CSS logic or JS re-hiding it?
            # app.js renderView might be running and hiding it if it detects invalid state.
            pass

        # Take screenshot of the filters area
        # The filters are in .sticky-filters inside #comparison-view
        try:
            filters = page.locator("#comparison-view .sticky-filters")
            filters.screenshot(path="verification_filters.png")
            print("Screenshot taken: verification_filters.png")
        except Exception as e:
            print(f"Failed to take screenshot: {e}")
            page.screenshot(path="verification_full_page.png")
            print("Taken full page screenshot instead.")

        browser.close()

if __name__ == "__main__":
    run()
