from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("file:///app/index.html")
    page.wait_for_timeout(2000)

    # Execute the window.showToast method to show a toast
    page.evaluate("""
        if (window.showToast) {
            window.showToast('Test Toast', 'This is a test notification', 'info');
        } else {
            throw new Error('window.showToast is not defined');
        }
    """)

    # Wait for the toast to appear
    page.wait_for_selector('.toast-close-btn', state='visible')
    page.wait_for_timeout(500)

    # Take screenshot
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    import os
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
