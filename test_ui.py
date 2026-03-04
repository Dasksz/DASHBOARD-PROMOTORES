from playwright.sync_api import sync_playwright
import os

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(f"file://{os.getcwd()}/index.html")
    # Wait for body to be attached and have content
    page.wait_for_selector("body", state="attached")
    title = page.title()
    print(f"Page title: {title}")

    # Check if the page has loaded successfully
    if len(title) > 0:
        print("UI successfully loaded.")
    else:
        print("UI might have failed to load.")
    browser.close()
