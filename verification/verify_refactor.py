from playwright.sync_api import sync_playwright
import time

def verify_app():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Load Page
        print("Loading page...")
        page.goto("http://localhost:8000/index.html")

        # 2. Wait for Login Screen
        print("Waiting for Login Screen...")
        try:
            page.wait_for_selector("#tela-login", state="visible", timeout=10000)
            print("Login Screen Visible")
        except:
            print("Login Screen NOT Visible (Timeout)")
            # Maybe loader is stuck?

        # 3. Check Global Objects (Modules)
        print("Checking Global Objects...")
        auth_exists = page.evaluate("() => !!window.Auth")
        data_exists = page.evaluate("() => !!window.Data")
        utils_exists = page.evaluate("() => !!window.Utils")
        app_exists = page.evaluate("() => !!window.App")

        print(f"Auth: {auth_exists}")
        print(f"Data: {data_exists}")
        print(f"Utils: {utils_exists}")
        print(f"App: {app_exists}")

        # 4. Screenshot
        page.screenshot(path="verification/verification.png")

        browser.close()

if __name__ == "__main__":
    verify_app()
