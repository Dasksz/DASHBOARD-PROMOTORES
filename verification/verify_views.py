from playwright.sync_api import sync_playwright
import time

def verify(page):
    page.on("console", lambda msg: print(f"Console: {msg.text}"))
    page.on("pageerror", lambda err: print(f"Page Error: {err}"))

    # 1. Open Page
    page.goto("http://localhost:8000/verification/test.html")
    time.sleep(2) # Wait for app.js init

    # 2. Click Clientes
    print("Clicking Clientes...")
    page.click("#btn-clientes")
    time.sleep(1)

    # Check visibility explicitly
    visible = page.evaluate("() => !document.getElementById('clientes-view').classList.contains('hidden')")
    print(f"Clientes View Visible: {visible}")
    page.screenshot(path="/home/jules/verification/clientes.png")

    # 3. Click Produtos
    print("Clicking Produtos...")
    page.click("#btn-produtos")
    time.sleep(1)
    page.screenshot(path="/home/jules/verification/produtos.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
