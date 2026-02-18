
from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        cwd = os.getcwd()
        file_url = f'file://{cwd}/index.html'

        # Block scripts to verify static UI
        page.route('**/js/app/app.js', lambda route: route.abort())
        page.route('**/js/init.js', lambda route: route.abort())

        page.goto(file_url)

        # Check if Titulos view container exists
        titulos_view = page.locator('#titulos-view')
        if titulos_view.count() > 0:
            print('Success: #titulos-view found.')
        else:
            print('Error: #titulos-view not found.')

        # Check Upload Modal Structure
        # We need to make the modal visible manually since JS is blocked
        page.evaluate("document.getElementById('admin-uploader-modal').classList.remove('hidden')")

        # Check Optional Toggle
        toggle_btn = page.locator('#toggle-optional-uploads-btn')
        if toggle_btn.is_visible():
            print('Success: Optional Toggle Button is visible.')
        else:
            print('Error: Optional Toggle Button missing.')

        # Check if Input is initially hidden
        input_container = page.locator('#optional-uploads-container')
        if not input_container.is_visible():
            print('Success: Optional Container is initially hidden.')
        else:
            print('Error: Optional Container should be hidden.')

        # Verify Titulos Button in Consultas
        # Open Consultas View
        page.evaluate("document.getElementById('consultas-view').classList.remove('hidden')")
        titulos_nav_btn = page.locator("button[onclick*=\"renderView('titulos')\"]")
        # Note: onclick handler text might vary, checking text content
        # Or checking if a button with 'Títulos' text exists
        btn = page.get_by_text('Títulos', exact=False)
        if btn.count() > 0:
             print('Success: Navigation button found.')
        else:
             print('Error: Navigation button not found.')

        browser.close()

if __name__ == '__main__':
    run()
