import re

with open('index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

# Find a elements without aria-label and without inner text
matches = re.finditer(r'<a([^>]*)>(.*?)</a>', html_content, flags=re.DOTALL)
for match in matches:
    attrs = match.group(1)
    inner = match.group(2)
    if 'aria-label' not in attrs and '<svg' in inner and len(re.sub(r'<[^>]*>', '', inner).strip()) == 0:
        print(f"Found icon-only link without aria-label:\n{match.group(0)}")
