
from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load local file
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/verification/test_colors.html")

        # Wait for render
        page.wait_for_selector("#gauge-container")

        # Screenshot
        page.screenshot(path="verification/verification_colors.png")
        browser.close()

if __name__ == "__main__":
    run()
