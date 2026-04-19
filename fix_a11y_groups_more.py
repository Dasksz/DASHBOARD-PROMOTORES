import re

with open('index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

# Fix `role="group"` missing `aria-labelledby`
html_content = re.sub(
    r'<label class="block mb-2 text-xs font-bold text-slate-500 uppercase">Rede</label>\s*<div id="([^"]+)" class="inline-flex rounded-lg shadow-sm w-full glass-panel p-1" role="group">',
    r'<span id="\1-label" class="block mb-2 text-xs font-bold text-slate-500 uppercase">Rede</span>\n                        <div id="\1" aria-labelledby="\1-label" class="inline-flex rounded-lg shadow-sm w-full glass-panel p-1" role="group">',
    html_content
)

html_content = re.sub(
    r'<label class="block mb-2 text-xs font-bold text-slate-500 uppercase">Rede</label>\s*<div id="([^"]+)" class="inline-flex rounded-lg glass-panel p-1 w-full" role="group">',
    r'<span id="\1-label" class="block mb-2 text-xs font-bold text-slate-500 uppercase">Rede</span>\n                            <div id="\1" aria-labelledby="\1-label" class="inline-flex rounded-lg glass-panel p-1 w-full" role="group">',
    html_content
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html_content)
