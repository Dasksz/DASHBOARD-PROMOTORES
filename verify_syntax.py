from playwright.sync_api import sync_playwright

def verify_syntax():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(str(exc)))

        try:
            page.goto("http://localhost:8000/index.html")
            page.wait_for_load_state("networkidle")

            if len(errors) == 0:
                print("No console errors found.")
            else:
                print(f"Console errors found: {len(errors)}")
                for e in errors:
                    print(f"- {e}")

            page.screenshot(path="verification.png")

        except Exception as e:
            print(f"Error during verification: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_syntax()
