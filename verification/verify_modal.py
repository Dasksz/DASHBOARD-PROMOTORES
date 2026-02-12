from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the local index.html file
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Force the modal to be visible by removing the 'hidden' class
        # The modal id is 'modal-relatorio'
        page.evaluate("document.getElementById('modal-relatorio').classList.remove('hidden')")

        # Wait a moment for it to render
        page.wait_for_timeout(1000)

        # Take a screenshot of the modal content specifically, or the whole page
        # Let's target the modal content div to see it clearly
        modal_content = page.locator("#modal-relatorio .bg-modal-content")
        modal_content.screenshot(path="verification/modal_screenshot.png")

        # Also take full page screenshot for context
        page.screenshot(path="verification/full_page_screenshot.png")

        browser.close()

if __name__ == "__main__":
    run()
