
from playwright.sync_api import sync_playwright
import time

def verify_meta_sections():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the page
        page.goto("http://localhost:8080/index.html")

        # Bypass login and show content
        page.evaluate("""
            document.getElementById('tela-login').classList.add('hidden');
            document.getElementById('content-wrapper').classList.remove('hidden');
            document.getElementById('tela-loading').classList.add('hidden');

            // Hide other views
            document.querySelectorAll('#content-wrapper > div').forEach(el => {
                if (el.id !== 'meta-realizado-view') el.classList.add('hidden');
            });

            // Show the correct view
            const view = document.getElementById('meta-realizado-view');
            if (view) {
                view.classList.remove('hidden');
            } else {
                console.error('meta-realizado-view not found');
            }
        """)

        time.sleep(1)

        # Check visibility
        btn_resumo = page.locator("button:has-text('Resumo por Vendedor')")
        if not btn_resumo.is_visible():
            print("Button still not visible. Dumping body classes.")
            print(page.evaluate("document.body.className"))
            print(page.evaluate("document.getElementById('meta-realizado-view').className"))

        # Screenshot Initial State (Collapsed)
        page.screenshot(path="verification/1_collapsed.png")
        print("Screenshot 1 taken: Collapsed")

        # Click Resumo
        btn_resumo.click()
        time.sleep(1) # Wait for transition
        page.screenshot(path="verification/2_resumo_expanded.png")
        print("Screenshot 2 taken: Resumo Expanded")

        # Click Detalhamento
        page.locator("button:has-text('Detalhamento por Cliente')").click()
        time.sleep(1)
        page.screenshot(path="verification/3_both_expanded.png")
        print("Screenshot 3 taken: Both Expanded")

        browser.close()

if __name__ == "__main__":
    verify_meta_sections()
