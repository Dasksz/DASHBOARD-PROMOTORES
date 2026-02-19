from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8080/index.html")

        # Bypass Login and Show Comparison View manually
        page.evaluate("""() => {
            document.getElementById('tela-login').classList.add('hidden');
            document.getElementById('content-wrapper').classList.remove('hidden');

            // Hide dashboard (default)
            document.getElementById('main-dashboard').classList.add('hidden');

            // Show comparison view
            document.getElementById('comparison-view').classList.remove('hidden');
        }""")

        time.sleep(2)

        # Screenshot
        page.screenshot(path="verification_screenshot.png", full_page=True)

        browser.close()

if __name__ == "__main__":
    run()
