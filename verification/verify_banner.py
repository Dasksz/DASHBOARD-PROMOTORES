from playwright.sync_api import Page, expect, sync_playwright
import time

def verify_banner(page: Page):
    page.goto("http://localhost:3000/index.html")

    # Wait for page load
    time.sleep(2)

    # Bypass Login Screen visually to see the dashboard
    page.evaluate("""() => {
        document.getElementById('tela-login').classList.add('hidden');
        document.getElementById('content-wrapper').classList.remove('hidden');
        document.getElementById('main-dashboard').classList.remove('hidden');

        // Trigger manual resize/init since we are forcefully showing it
        if (window.resizeBanner3D) {
            window.resizeBanner3D();
        } else if (window.initBanner3D) {
            window.initBanner3D();
        }
    }""")

    time.sleep(3) # Wait for Three.js to render

    # Check for Banner Container
    expect(page.locator("#banner-container")).to_be_visible()

    # Check for Canvas
    expect(page.locator("#banner-container canvas")).to_be_visible()

    # Check for Text
    expect(page.locator(".brand-tag")).to_have_text("Dashboard Prime")
    expect(page.locator(".user-greeting")).to_be_visible()

    page.screenshot(path="verification/banner_verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_banner(page)
        finally:
            browser.close()
