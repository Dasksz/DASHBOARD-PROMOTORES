from playwright.sync_api import sync_playwright
import os

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Determine absolute path to index.html
        cwd = os.getcwd()
        file_path = f'file://{cwd}/index.html'

        print(f'Navigating to {file_path}')
        page.goto(file_path)

        # Wait for scripts to load (simulated)
        page.wait_for_timeout(1000)

        # Check for presence of new filter elements for 'main' view
        views = ['main', 'city', 'weekly', 'comparison', 'stock', 'innovations-month', 'mix', 'coverage', 'goals-gv', 'goals-summary']
        roles = ['coord', 'cocoord', 'promotor']

        missing_elements = []
        present_elements = []

        for view in views:
            for role in roles:
                btn_id = f'{view}-{role}-filter-btn'
                # wrapper_id = f'{view}-{role}-filter-wrapper'

                # Check button existence
                btn = page.query_selector(f'#{btn_id}')
                if not btn:
                    missing_elements.append(btn_id)
                else:
                    present_elements.append(btn_id)

        # Check for legacy elements (should NOT exist)
        legacy_ids = ['supervisor-filter-wrapper', 'vendedor-filter-wrapper', 'city-supervisor-filter-wrapper']
        found_legacy = []
        for lid in legacy_ids:
             if page.query_selector(f'#{lid}'):
                 found_legacy.append(lid)

        print(f'Verified {len(present_elements)} new hierarchy buttons.')
        if missing_elements:
            print('ERROR: Missing buttons:')
            for m in missing_elements:
                print(f' - {m}')
        else:
            print('SUCCESS: All expected hierarchy buttons found.')

        if found_legacy:
             print('ERROR: Legacy elements still found:')
             for l in found_legacy:
                 print(f' - {l}')
        else:
             print('SUCCESS: No legacy supervisor/seller wrappers found.')

        browser.close()

if __name__ == '__main__':
    run_verification()
