import re

html_content = open('index.html', 'r', encoding='utf-8').read()

# Fix the missing aria-label for close buttons
html_content = re.sub(
    r'<span class="text-slate-400 hover:text-white cursor-pointer text-2xl leading-none" onclick="closeResearchModal\(\)">&times;</span>',
    r'<button aria-label="Fechar" class="text-slate-400 hover:text-white cursor-pointer text-2xl leading-none" onclick="closeResearchModal()">&times;</button>',
    html_content
)

open('index.html', 'w', encoding='utf-8').write(html_content)
