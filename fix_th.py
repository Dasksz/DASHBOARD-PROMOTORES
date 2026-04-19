import re

with open('index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

# I am looking for something visually impactful for a UX/a11y improvement.
# Let's check color contrast or hover states
