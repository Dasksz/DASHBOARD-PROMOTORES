from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the local index.html
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Manually show the content wrapper and consultas view
        page.eval_on_selector("#content-wrapper", "el => el.classList.remove('hidden')")
        page.eval_on_selector("#consultas-view", "el => el.classList.remove('hidden')")

        # Hide the loading screen just in case it overlaps
        page.eval_on_selector("#tela-loading", "el => el.classList.add('hidden')")

        # Wait for a bit just in case animations need to settle
        page.wait_for_timeout(1000)

        # Take a screenshot of the entire view
        # We target content-wrapper or just take a full page screenshot to be safe
        page.screenshot(path="verification/consultas_view.png", full_page=True)

        # Assertions
        content = page.content()

        # Check that the removed buttons are NOT present
        if "MaxInsights" in content:
            print("FAILURE: 'MaxInsights' found in content.")
        else:
            print("SUCCESS: 'MaxInsights' not found.")

        if "Políticas Comerciais" in content:
            print("FAILURE: 'Políticas Comerciais' found in content.")
        else:
            print("SUCCESS: 'Políticas Comerciais' not found.")

        if "Consulta Aniversários" in content:
            print("FAILURE: 'Consulta Aniversários' found in content.")
        else:
            print("SUCCESS: 'Consulta Aniversários' not found.")

        browser.close()

if __name__ == "__main__":
    run()
