import re

with open('js/app/app.js', 'r') as f:
    content = f.read()

# Let's inspect `setupHierarchyFilters`
pattern = r"function setupHierarchyFilters\(.*?\) \{[\s\S]*?\n        \}"
match = re.search(pattern, content)
if match:
    print(match.group(0)[:1000])
