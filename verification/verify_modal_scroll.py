from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Show modal
        page.evaluate("document.getElementById('modal-relatorio').classList.remove('hidden')")
        page.wait_for_timeout(1000)

        # Scroll to bottom of the modal content
        # The scrollable element is the div with class 'bg-modal-content'
        modal_content = page.locator("#modal-relatorio .bg-modal-content")

        # Scroll to bottom
        modal_content.evaluate("el => el.scrollTop = el.scrollHeight")
        page.wait_for_timeout(500)

        modal_content.screenshot(path="verification/modal_scroll_bottom.png")

        browser.close()

if __name__ == "__main__":
    run()
