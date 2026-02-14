
from playwright.sync_api import sync_playwright
import os

def run():
    filepath = os.path.abspath("verification/test.html")
    file_url = f"file://{filepath}"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

        page.goto(file_url)

        # Check if renderView exists
        exists = page.evaluate("typeof window.renderView !== undefined")
        print(f"renderView exists: {exists}")

        try:
            page.wait_for_selector("#top-products-variation-table-body tr", timeout=5000)
        except:
            print("Timeout.")

        browser.close()

if __name__ == "__main__":
    run()
