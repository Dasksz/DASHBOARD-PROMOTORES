
from playwright.sync_api import sync_playwright
import os

def verify_no_console_errors():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        console_errors = []
        page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)
        page.on('pageerror', lambda exc: console_errors.append(str(exc)))

        file_path = os.path.abspath('index.html')
        page.goto(f'file://{file_path}')

        # Give it a moment to run init scripts
        page.wait_for_timeout(3000)

        if console_errors:
            print('Console Errors found:')
            for err in console_errors:
                print(f'- {err}')
        else:
            print('No console errors detected during initialization.')

        page.screenshot(path='verification/console_check.png')
        browser.close()

if __name__ == '__main__':
    verify_no_console_errors()
