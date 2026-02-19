
import os
from playwright.sync_api import sync_playwright

def verify_remember_me():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Determine the absolute path to index.html
        cwd = os.getcwd()
        file_url = f"file://{cwd}/index.html"
        print(f"Navigating to: {file_url}")

        page.goto(file_url)

        # 1. Verify Autocomplete Attributes
        print("Verifying autocomplete attributes...")
        email_input = page.locator("#email")
        password_input = page.locator("#password")

        autocomplete_email = email_input.get_attribute("autocomplete")
        autocomplete_password = password_input.get_attribute("autocomplete")

        print(f"Email autocomplete: {autocomplete_email}")
        print(f"Password autocomplete: {autocomplete_password}")

        if autocomplete_email != "username":
            print("ERROR: Email autocomplete should be 'username'")
        if autocomplete_password != "current-password":
            print("ERROR: Password autocomplete should be 'current-password'")

        # 2. Verify Remember Me Logic
        print("Verifying Remember Me logic...")

        # Simulate user input
        test_email = "testuser@example.com"
        email_input.fill(test_email)
        password_input.fill("Password123!")

        # Check Remember Me
        remember_checkbox = page.locator("#remember-me")
        remember_checkbox.check()

        # Click Entrar (Login)
        # Note: This triggers the submit handler. Login will likely fail (Supabase error),
        # but localStorage logic runs before that.
        submit_btn = page.locator("#submitBtn")
        submit_btn.click()

        # Wait a bit for the event handler to run
        page.wait_for_timeout(1000)

        # Reload the page to test persistence
        print("Reloading page...")
        page.reload()

        # Check if email is pre-filled
        prefilled_email = email_input.input_value()
        is_checked = remember_checkbox.is_checked()

        print(f"Prefilled Email: {prefilled_email}")
        print(f"Checkbox Checked: {is_checked}")

        if prefilled_email == test_email:
            print("SUCCESS: Email was remembered.")
        else:
            print(f"FAILURE: Email was NOT remembered. Expected '{test_email}', got '{prefilled_email}'")

        if is_checked:
            print("SUCCESS: Checkbox was remembered.")
        else:
            print("FAILURE: Checkbox was NOT remembered.")

        # Take screenshot of the login form with pre-filled values
        page.screenshot(path="verification/login_verification.png")
        print("Screenshot saved to verification/login_verification.png")

        browser.close()

if __name__ == "__main__":
    verify_remember_me()
