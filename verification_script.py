
from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating to page...")
            page.goto("http://localhost:8000/verification.html")

            print("Waiting for canvas...")
            page.wait_for_selector("#banner-container canvas", state="visible", timeout=10000)

            # Wait for Chester to spawn (0.5s initial + maybe loading time)
            # Swimming.glb is 17MB, might take a few seconds on localhost?
            print("Waiting for load...")
            time.sleep(5)

            print("Taking screenshot 1...")
            page.screenshot(path="verification_1.png")

            print("Waiting for movement...")
            time.sleep(2)

            print("Taking screenshot 2...")
            page.screenshot(path="verification_2.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
