import os
import time
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Mock data
    mock_data_script = """
    window.embeddedData = {
        isColumnar: false,
        clients: [
            {'Código': '1', 'nomeCliente': 'CLIENTE A', 'cidade': 'SALVADOR', 'rca1': '10', 'razaoSocial': 'RAZAO A'},
            {'Código': '2', 'nomeCliente': 'CLIENTE B', 'cidade': 'FEIRA', 'rca1': '10', 'razaoSocial': 'RAZAO B'},
            {'Código': '3', 'nomeCliente': 'CLIENTE C', 'cidade': 'SALVADOR', 'rca1': '53', 'razaoSocial': 'RAZAO C'},
            {'Código': '4', 'nomeCliente': 'LOJA AMERICANAS', 'cidade': 'SALVADOR', 'rca1': '10', 'razaoSocial': 'AMERICANAS S.A.'}
        ],
        detailed: [],
        history: [],
        byOrder: [],
        activeProductCodes: [],
        productDetails: {},
        stockMap05: {},
        stockMap08: {},
        innovationsMonth: [],
        hierarchy: [],
        clientPromoters: [],
        clientCoordinates: {}
    };

    window.supabaseClient = {
        auth: {
            getUser: async () => ({ data: { user: { id: 'test-user' } } })
        },
        from: () => ({
            select: () => ({
                eq: () => ({
                    gte: () => Promise.resolve({ data: [] }),
                    is: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
                    not: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) })
                })
            }),
            insert: () => Promise.resolve({ data: {}, error: null }),
            update: () => Promise.resolve({ data: {}, error: null }),
            delete: () => Promise.resolve({ data: {}, error: null }),
            upsert: () => Promise.resolve({ data: {}, error: null })
        }),
        storage: {
            from: () => ({
                upload: () => Promise.resolve({ data: {}, error: null }),
                getPublicUrl: () => ({ data: { publicUrl: 'http://mock' } })
            })
        }
    };

    window.userRole = 'promotor';
    window.userHierarchyContext = { role: 'promotor', promotor: 'TEST' };
    """

    # Intercept init.js
    page.route("**/js/init.js*", lambda route: route.fulfill(body="console.log('Init blocked');"))

    # Read app.js content
    with open("js/app/app.js", "r") as f:
        app_js_content = f.read()

    # Open page
    page.goto("http://localhost:8000/index.html")

    # Inject Mock Data
    page.evaluate(mock_data_script)

    # Wait for utils.js to load
    time.sleep(1)

    # Execute app.js manually
    print("Executing app.js...")
    page.evaluate(app_js_content)

    # Force render View
    print("Rendering 'clientes' view...")
    page.evaluate("if(window.renderView) window.renderView('clientes');")

    # Nuclear visibility option
    page.evaluate("document.querySelectorAll('.hidden').forEach(e => e.classList.remove('hidden'));")

    # Wait for rendering
    try:
        page.wait_for_selector("#clientes-list-container", state="visible", timeout=5000)
    except:
        print("Timeout waiting for list container visibility.")

    # Verify Initial State
    items = page.locator("#clientes-list-container > div")
    count = items.count()
    print(f"Initial count: {count}")

    if count == 3:
        print("Initial filtering correct (3 items).")
    else:
        print(f"Initial filtering FAILED. Expected 3, got {count}.")

    page.screenshot(path="verification/initial_list.png")

    # Search
    print("Searching for 'AMERICANAS'...")
    # Attempt force fill if standard fill fails?
    try:
        page.fill("#clientes-search", "AMERICANAS")
    except:
        print("Fill failed, trying manual dispatch event")
        page.evaluate("document.getElementById('clientes-search').value = 'AMERICANAS';")
        page.evaluate("document.getElementById('clientes-search').dispatchEvent(new Event('input'));")


    # Wait for debounce (300ms) + processing
    time.sleep(1)

    items = page.locator("#clientes-list-container > div")
    count = items.count()
    print(f"Search count: {count}")

    if count == 1:
        print("Search filtering correct (1 item).")
    else:
        print(f"Search filtering FAILED. Expected 1, got {count}.")

    page.screenshot(path="verification/search_result.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
