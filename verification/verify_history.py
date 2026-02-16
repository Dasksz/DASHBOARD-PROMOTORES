
from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
    page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))

    # Load the test HTML file (ROOT)
    file_path = os.path.abspath("test_history.html")
    page.goto(f"file://{file_path}")

    # Wait for the dashboard to load (our mock script handles visibility)
    try:
        page.wait_for_selector("#history-view", state="visible", timeout=10000)
    except Exception as e:
        print(f"Timeout waiting for #history-view: {e}")
        page.screenshot(path="verification/error_state.png")

    try:
        # Wait for the count badge to update
        page.wait_for_function("document.getElementById('history-count-badge').textContent !== '0'", timeout=10000)
    except Exception as e:
        print(f"Timeout waiting for badge update: {e}")
        page.screenshot(path="verification/error_badge.png")

    # Take screenshot of the history view
    page.screenshot(path="verification/verification.png", full_page=True)

    # Print results count for verification log
    try:
        count = page.inner_text("#history-count-badge")
        print(f"Items found: {count}")

        # Verify checking inner text of the table to be sure it's rendered
        table_text = page.inner_text("#history-table-body")
        if "HIST-100" in table_text and "CURR-200" in table_text:
            print("SUCCESS: Found both History (HIST-100) and Current (CURR-200) items in the table.")
        else:
            print("FAILURE: Missing expected items in table.")
            print(f"Table Content: {table_text}")
    except Exception as e:
        print(f"Error checking content: {e}")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
