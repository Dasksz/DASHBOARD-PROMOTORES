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
        }
    """)

    # Verify Client Filter (on Dashboard)
    page.evaluate("document.getElementById('main-dashboard').classList.remove('hidden')")

    client_filter = page.locator("#codcli-filter")
    client_filter.wait_for(state="attached")

    print("Checking #codcli-filter attributes...")
    autocomplete = client_filter.get_attribute("autocomplete")
    type_attr = client_filter.get_attribute("type")
    name_attr = client_filter.get_attribute("name")
    readonly_attr = client_filter.get_attribute("readonly")

    print(f"codcli-filter: autocomplete={autocomplete}, type={type_attr}, name={name_attr}, readonly={readonly_attr}")

    # Check if readonly attribute exists (it might be empty string or 'true' depending on browser handling, playwright returns '' if present with no value or value)
    if readonly_attr is None:
        print("FAIL: codcli-filter readonly attribute missing initially")

    if autocomplete != "nope":
        print(f"FAIL: codcli-filter autocomplete is '{autocomplete}', expected 'nope'")

    page.screenshot(path="verification/dashboard_filters_updated.png")

    # Switch to Produtos View
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
    prod_readonly = produtos_search.get_attribute("readonly")

    print(f"produtos-search: autocomplete={prod_autocomplete}, readonly={prod_readonly}")

    if prod_autocomplete != "nope":
        print(f"FAIL: produtos-search autocomplete is '{prod_autocomplete}', expected 'nope'")

    page.screenshot(path="verification/produtos_view_updated.png")

    # Switch to Goals View (GV)
    print("Switching to Goals view...")
    page.evaluate("""
        () => {
            document.querySelectorAll('#content-wrapper > div').forEach(el => el.classList.add('hidden'));
            document.getElementById('goals-view').classList.remove('hidden');
            document.getElementById('goals-gv-content').classList.remove('hidden');
        }
    """)

    goals_search = page.locator("#goals-gv-codcli-filter")
    # Goals view might need admin role to be visible, but we forced the hidden class off.
    # However, if it's inside a container that is hidden, locator might fail visibility check.
    # We unhid #goals-view and #goals-gv-content.

    # Wait for attached, might not be visible in viewport if no data loaded etc.
    goals_search.wait_for(state="attached")

    print("Checking #goals-gv-codcli-filter attributes...")
    goals_autocomplete = goals_search.get_attribute("autocomplete")
    goals_readonly = goals_search.get_attribute("readonly")

    print(f"goals-gv-codcli-filter: autocomplete={goals_autocomplete}, readonly={goals_readonly}")

    if goals_autocomplete != "nope":
        print(f"FAIL: goals-gv-codcli-filter autocomplete is '{goals_autocomplete}', expected 'nope'")

    page.screenshot(path="verification/goals_view_updated.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
