from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto("http://localhost:8080/index.html")

    # Wait for app to load (checking for loader disappearance)
    page.wait_for_selector("#page-transition-loader", state="hidden", timeout=10000)

    # Locate the Lupa Icon
    # It has id 'codcli-search-icon'
    icon = page.locator("#codcli-search-icon")

    # Verify it has cursor-pointer class
    classes = icon.get_attribute("class")
    print(f"Icon classes: {classes}")
    if "cursor-pointer" in classes:
        print("Icon has cursor-pointer")
    else:
        print("Icon MISSING cursor-pointer")

    # Click it
    icon.click()

    # Take screenshot
    page.screenshot(path="verification/lupa_check.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
