from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Determine absolute path to index.html
        cwd = os.getcwd()
        file_path = f"file://{cwd}/index.html"

        print(f"Navigating to {file_path}")
        page.goto(file_path)

        # Wait for page load (init.js execution)
        # page.wait_for_load_state("networkidle") # local file might not have network idle
        page.wait_for_timeout(2000)

        # Inject toasts manually via console evaluation
        print("Injecting toasts...")
        page.evaluate("""
            window.showToast('success', 'Operação realizada com sucesso!', 'Sucesso');
            window.showToast('error', 'Ocorreu um erro crítico no sistema.', 'Erro Fatal');
            window.showToast('info', 'Nova atualização disponível.', 'Informação');
            window.showToast('warning', 'Sua sessão expira em breve.', 'Atenção');
        """)

        # Wait a moment for animations
        page.wait_for_timeout(1000)

        # Take screenshot
        output_path = "verification_toasts.png"
        page.screenshot(path=output_path)
        print(f"Screenshot saved to {output_path}")

        browser.close()

if __name__ == "__main__":
    run()
