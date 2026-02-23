from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Go to the local server
    page.goto("http://localhost:8080/index.html")

    # Force UI to show up by bypassing loading/auth
    page.evaluate("""
        () => {
            document.getElementById('loader')?.classList.add('hidden');
            document.getElementById('tela-loading')?.classList.add('hidden');
            document.getElementById('tela-login')?.classList.add('hidden');
            document.getElementById('content-wrapper')?.classList.remove('hidden');
            document.getElementById('top-navbar')?.classList.remove('hidden');

            // Mock renderView to just toggle visibility if needed, or rely on existing click handlers if they work without data
            // But let's try to click the buttons.
        }
    """)

    # Verify Client Filter (on Dashboard)
    # It might be in #main-dashboard which is inside #content-wrapper
    # Ensure #main-dashboard is visible.
    page.evaluate("document.getElementById('main-dashboard').classList.remove('hidden')")

    client_filter = page.locator("#codcli-filter")
    # It should be visible if main-dashboard is visible.
    # Wait for it just in case
    client_filter.wait_for(state="attached")

    print("Checking #codcli-filter attributes...")
    autocomplete = client_filter.get_attribute("autocomplete")
    type_attr = client_filter.get_attribute("type")
    name_attr = client_filter.get_attribute("name")

    print(f"codcli-filter: autocomplete={autocomplete}, type={type_attr}, name={name_attr}")

    if autocomplete != "off":
        print("FAIL: codcli-filter autocomplete is not 'off'")
    if type_attr != "search":
        print("FAIL: codcli-filter type is not 'search'")
    if name_attr != "client_filter_query":
        print("FAIL: codcli-filter name is not 'client_filter_query'")

    page.screenshot(path="verification/dashboard_filters.png")

    # Switch to Produtos View
    # We can try clicking the button if logic allows, or just manually toggle views via JS
    print("Switching to Produtos view...")
    page.evaluate("""
        () => {
            document.querySelectorAll('#content-wrapper > div').forEach(el => el.classList.add('hidden'));
            document.getElementById('produtos-view').classList.remove('hidden');
        }
    """)

    produtos_search = page.locator("#produtos-search")
    produtos_search.wait_for(state="visible")

    print("Checking #produtos-search attributes...")
    prod_autocomplete = produtos_search.get_attribute("autocomplete")
    prod_type = produtos_search.get_attribute("type")

    print(f"produtos-search: autocomplete={prod_autocomplete}, type={prod_type}")

    if prod_autocomplete != "off":
        print("FAIL: produtos-search autocomplete is not 'off'")

    page.screenshot(path="verification/produtos_view.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
