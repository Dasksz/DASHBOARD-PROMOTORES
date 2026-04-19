import re

with open('index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

# Find <svg> tags that don't have aria-hidden
matches = re.finditer(r'<svg([^>]*)>', html_content)
for match in matches:
    attrs = match.group(1)
    if 'aria-hidden' not in attrs and 'role="img"' not in attrs:
        pass
        #print(f"Found svg without aria-hidden/role=img: {match.group(0)}")
