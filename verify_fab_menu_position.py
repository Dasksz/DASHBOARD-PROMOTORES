from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # Scenario: Desktop with Menu Open
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        # Load local index.html
        page.goto(f"file://{os.getcwd()}/index.html")

        # 1. Make the FAB visible (remove hidden)
        # 2. Open the menu (add active class)
        page.evaluate("""
            const fab = document.getElementById('positivacao-fab-container');
            fab.classList.remove('hidden');
            fab.classList.add('active');
        """)

        # Wait for CSS transition (300ms)
        page.wait_for_timeout(500)

        # Screenshot the bottom right area
        # We can clip to the relevant area to make it easier to see
        # Bottom right 300x400
        page.screenshot(path="verification_fab_menu_desktop.png")
        print("Desktop menu screenshot taken.")

        # Scenario: Mobile with Menu Open
        page_mobile = browser.new_page(viewport={"width": 375, "height": 667})
        page_mobile.goto(f"file://{os.getcwd()}/index.html")

        page_mobile.evaluate("""
            const fab = document.getElementById('positivacao-fab-container');
            fab.classList.remove('hidden');
            fab.classList.add('active');
        """)
        page_mobile.wait_for_timeout(500)

        page_mobile.screenshot(path="verification_fab_menu_mobile.png")
        print("Mobile menu screenshot taken.")

        browser.close()

if __name__ == "__main__":
    run()
