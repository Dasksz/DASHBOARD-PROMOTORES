from playwright.sync_api import sync_playwright
import time

def verify_chart_container(page):
    page.goto("http://localhost:8080/index.html")

    # Wait a bit for any initial JS
    time.sleep(2)

    # Manually hide login/loading screens and show dashboard for verification
    # We force the visibility classes to ensure we see the static markup
    page.evaluate("""
        const login = document.getElementById("tela-login");
        if(login) login.style.display = "none";

        const loading = document.getElementById("tela-loading");
        if(loading) loading.style.display = "none";

        const loader = document.getElementById("loader");
        if(loader) loader.style.display = "none";

        const wrapper = document.getElementById("content-wrapper");
        if(wrapper) {
            wrapper.classList.remove("hidden");
            wrapper.style.display = "block";
        }

        const dashboard = document.getElementById("main-dashboard");
        if(dashboard) {
            dashboard.classList.remove("hidden");
            dashboard.style.display = "block";
        }

        const chartView = document.getElementById("chartView");
        if(chartView) {
            chartView.classList.remove("hidden");
            chartView.style.display = "block";
        }
    """)

    # Check if the container exists
    container = page.locator("#trendChartContainer")
    if container.count() > 0:
        print("SUCCESS: #trendChartContainer found.")
    else:
        print("FAILURE: #trendChartContainer NOT found.")

    # Scroll to the element to make sure it is in the screenshot
    if container.count() > 0:
        container.scroll_into_view_if_needed()

    time.sleep(1)
    page.screenshot(path="verification/verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_chart_container(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
