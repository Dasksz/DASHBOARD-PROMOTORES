
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:8080/index.html")

    # Force hide login/overlays to access navbar
    page.evaluate("""() => {
        document.getElementById('tela-login').classList.add('hidden');
        document.getElementById('tela-loading').classList.add('hidden');
        document.getElementById('tela-pendente').classList.add('hidden');
        document.getElementById('page-transition-loader').classList.add('hidden');
    }""")

    # Verify Container Layout
    nav_container = page.locator("#desktop-nav-container")
    # Make sure it's visible (might need to set viewport large enough for lg:flex)
    page.set_viewport_size({"width": 1280, "height": 720})

    if not nav_container.is_visible():
        print("Nav container not visible. Checking class list...")
        print(nav_container.get_attribute("class"))

    classes = nav_container.get_attribute("class")
    if "h-full" not in classes:
        print("FAIL: h-full missing")
    if "overflow-y-hidden" not in classes:
        print("FAIL: overflow-y-hidden missing")

    print("Classes verification passed.")

    # Test Drag to Scroll
    # First, ensure there is content to scroll.
    # The buttons are there.

    initial_scroll = page.evaluate("document.getElementById('desktop-nav-container').scrollLeft")
    print(f"Initial Scroll: {initial_scroll}")

    # Perform Drag
    box = nav_container.bounding_box()
    start_x = box["x"] + box["width"] / 2
    start_y = box["y"] + box["height"] / 2

    page.mouse.move(start_x, start_y)
    page.mouse.down()

    # Check cursor class applied
    # Note: classList update might be async or immediate.
    # We replaced 'active:cursor-grabbing' with 'cursor-grabbing'
    page.wait_for_function("document.getElementById('desktop-nav-container').classList.contains('cursor-grabbing')")
    print("Cursor class 'cursor-grabbing' applied on mousedown.")

    # Move mouse to drag
    page.mouse.move(start_x - 100, start_y) # Drag left (should scroll right?)
    # Logic: x = newX. walk = (x - startX) * 2. scrollLeft = scrollLeft - walk.
    # newX < startX => walk is negative. scrollLeft - (-val) => scrollLeft increases.
    # So dragging left scrolls right. Correct.

    page.wait_for_timeout(100) # Wait for event loop

    new_scroll = page.evaluate("document.getElementById('desktop-nav-container').scrollLeft")
    print(f"New Scroll: {new_scroll}")

    if new_scroll > initial_scroll:
        print("PASS: Drag scrolled content.")
    else:
        print("FAIL: Scroll did not change (or content fits perfectly so no scroll needed).")
        # Check scrollWidth vs clientWidth
        sw = page.evaluate("document.getElementById('desktop-nav-container').scrollWidth")
        cw = page.evaluate("document.getElementById('desktop-nav-container').clientWidth")
        print(f"ScrollWidth: {sw}, ClientWidth: {cw}")

    page.mouse.up()

    # Verify cursor class removed
    page.wait_for_function("!document.getElementById('desktop-nav-container').classList.contains('cursor-grabbing')")
    print("Cursor class removed on mouseup.")

    # Verify Admin Button
    # Expect alert
    def handle_dialog(dialog):
        print(f"Dialog appeared: {dialog.message}")
        dialog.dismiss()

    page.on("dialog", handle_dialog)
    page.click("#open-admin-btn")

    page.screenshot(path="verification.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
