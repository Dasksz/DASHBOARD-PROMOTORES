import re

with open('index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

# Add aria-label to the first fab button
html_content = re.sub(
    r'<button class="fab-btn bg-\[#FF5E00\] hover:bg-\[#FF7A33\] text-white p-4 rounded-full shadow-lg shadow-\[#FF5E00\]/30 transition-all duration-300 flex items-center justify-center">',
    r'<button aria-label="Abrir opções de Loja Perfeita" class="fab-btn bg-[#FF5E00] hover:bg-[#FF7A33] text-white p-4 rounded-full shadow-lg shadow-[#FF5E00]/30 transition-all duration-300 flex items-center justify-center">',
    html_content
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html_content)
