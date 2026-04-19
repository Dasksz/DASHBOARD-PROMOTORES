import re

with open('index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

# Add missing aria-label to inputs that were flagged
html_content = re.sub(
    r'<input type="checkbox" id="remember-me" class="w-4 h-4 rounded border-gray-600 bg-transparent text-\[#FF5E00\] focus:ring-offset-0 focus:ring-\[#FF5E00\]">',
    r'<input type="checkbox" id="remember-me" aria-label="Lembrar-me" class="w-4 h-4 rounded border-gray-600 bg-transparent text-[#FF5E00] focus:ring-offset-0 focus:ring-[#FF5E00]">',
    html_content
)

html_content = re.sub(
    r'<input type="checkbox" id="mix-kpi-toggle" class="sr-only peer">',
    r'<input type="checkbox" id="mix-kpi-toggle" aria-label="Alternar base de cálculo do KPI Mix" class="sr-only peer">',
    html_content
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html_content)
