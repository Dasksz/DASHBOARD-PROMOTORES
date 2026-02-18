from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # Scenario 1: Desktop
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.goto(f"file://{os.getcwd()}/index.html")

        # Make the FAB visible
        page.evaluate("document.getElementById('positivacao-fab-container').classList.remove('hidden')")

        # Wait for potential animations or rendering
        page.wait_for_timeout(500)

        # Screenshot the bottom right area
        page.screenshot(path="verification_fab_desktop.png")
        print("Desktop screenshot taken.")

        # Scenario 2: Mobile
        page_mobile = browser.new_page(viewport={"width": 375, "height": 667})
        page_mobile.goto(f"file://{os.getcwd()}/index.html")

        page_mobile.evaluate("document.getElementById('positivacao-fab-container').classList.remove('hidden')")
        page_mobile.wait_for_timeout(500)

        page_mobile.screenshot(path="verification_fab_mobile.png")
        print("Mobile screenshot taken.")

        browser.close()

if __name__ == "__main__":
    run()
