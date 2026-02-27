from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Open the local index.html directly since it is static (or serve it if needed)
        # Assuming static file for now as structure suggests
        # But wait, index.html relies on Supabase and fetch. Without a server, it might fail CORS or local fetch.
        # It's better to use python http.server

        page.goto("http://localhost:8000/index.html")

        # Wait for dashboard to load (simulated)
        # We need to wait for the chart title "Share por Categoria" or the canvas
        try:
            page.wait_for_selector("#faturamentoPorFornecedorTitle", timeout=10000)
            page.wait_for_timeout(5000) # Wait for chart animations/rendering

            # Take screenshot of the chart container
            element = page.locator("#faturamentoPorFornecedorChartContainer").first
            if element:
                element.screenshot(path="verification/chart_screenshot.png")
                print("Screenshot saved to verification/chart_screenshot.png")
            else:
                print("Chart container not found")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_state.png")

        browser.close()

if __name__ == "__main__":
    run()
