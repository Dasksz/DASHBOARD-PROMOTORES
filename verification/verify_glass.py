
from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a larger viewport to capture dashboard layout
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        # Load the local index.html file
        # Assuming the script runs from the repo root or we provide absolute path
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Wait for the dashboard to load (simulated)
        # In a real app we might wait for a specific element
        page.wait_for_timeout(2000)

        # Take a screenshot of the main dashboard
        page.screenshot(path="verification/dashboard_glass.png")
        print("Screenshot saved to verification/dashboard_glass.png")

        browser.close()

if __name__ == "__main__":
    run()
