import re

with open('index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

# Add aria-label to clear-filters-btn since it doesn't seem to have one but looks like an important action button
# Wait, let's see if any button lacks an aria label that should have one

# Find all <button> elements
matches = re.finditer(r'<button([^>]*)>(.*?)</button>', html_content, flags=re.DOTALL)
for match in matches:
    attrs = match.group(1)
    inner = match.group(2)
    if 'aria-label' not in attrs and '<svg' in inner and len(re.sub(r'<[^>]*>', '', inner).strip()) == 0:
        print(f"Found icon-only button without aria-label:\n{match.group(0)}")
