
from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Determine the file URL
        cwd = os.getcwd()
        file_url = f'file://{cwd}/index.html'

        # Block script execution to purely test UI layout
        page.route('**/js/app/app.js', lambda route: route.abort())
        page.route('**/js/init.js', lambda route: route.abort())

        page.goto(file_url)

        # Force show the modal
        page.evaluate("document.getElementById('admin-uploader-modal').classList.remove('hidden')")

        # Screenshot the Modal
        page.screenshot(path='verification/uploader_modal.png')
        print('Screenshot taken: verification/uploader_modal.png')

        browser.close()

if __name__ == '__main__':
    run()
