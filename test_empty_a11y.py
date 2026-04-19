import re

with open('index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

# Find input elements without aria-label and without associated label
matches = re.finditer(r'<input([^>]*)>', html_content)
for match in matches:
    attrs = match.group(1)
    if 'type="hidden"' not in attrs and 'type="file"' not in attrs and 'aria-label' not in attrs and 'id="' in attrs:
        print(f"Potential missing aria-label in input: {match.group(0)}")
