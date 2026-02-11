from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        print("Navigating to http://localhost:8000/index.html")
        page.goto("http://localhost:8000/index.html")

        # Wait a bit for scripts to execute
        page.wait_for_timeout(3000)

        if console_errors:
            print("Errors found in console:")
            for err in console_errors:
                print(f"- {err}")

            # Check for the specific error
            if any("Cannot read properties of null (reading 'addEventListener')" in err for err in console_errors):
                print("FAILURE: The specific error 'Cannot read properties of null (reading 'addEventListener')' was found.")
            else:
                print("The specific error was NOT found, but other errors occurred.")
        else:
            print("SUCCESS: No console errors found.")

        page.screenshot(path="verification_screenshot.png")
        browser.close()

if __name__ == "__main__":
    run()
