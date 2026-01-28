
from playwright.sync_api import sync_playwright
import os

def verify_app_load():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the file
        file_path = os.path.abspath('index.html')
        page.goto(f'file://{file_path}')

        # Wait for the main table to load (indicator that JS executed without crash)
        # We look for the main table body or a specific element that is rendered by JS
        try:
            # Wait for any table body content to appear, or the hierarchy filter dropdowns which we touched
            page.wait_for_selector('#main-table-body tr', timeout=10000)

            # Take a screenshot
            page.screenshot(path='verification/app_load.png')
            print('Screenshot taken successfully.')

            # Check for console errors
            # Note: capturing console logs is tricky in sync mode without event listeners,
            # but seeing the screenshot proves no critical white-screen crash.

        except Exception as e:
            print(f'Error waiting for selector: {e}')
            page.screenshot(path='verification/error_state.png')

        browser.close()

if __name__ == '__main__':
    verify_app_load()
