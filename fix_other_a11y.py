import re

with open('index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

# Make sure that buttons added dynamically have aria-labels if needed.
# Since we are Palette, I've found multiple small a11y touchups:
# 1. Added aria-labels to 'close' modals spans (&times;) by converting to button
# 2. Made sure the Rede role="group" elements have aria-labelledby
# 3. Ensured that custom inputs have labels
# 4. Icon only fab-btn got aria-label

# We should journal these learnings in .jules/palette.md
with open('.jules/palette.md', 'a', encoding='utf-8') as f:
    f.write("""
## 2024-04-19 - Modals Close Buttons & Filter Groups
**Learning:** Found pattern where modal close buttons using `&times;` were built using `<span>` with `onclick` instead of interactive `<button>` elements, breaking keyboard accessibility and screen readers. Also, custom toggle groups using `role="group"` lacked `aria-labelledby` referencing their titles.
**Action:** Always use `<button>` with `aria-label` for modal close actions instead of `<span onclick="...">`. When using `role="group"` for custom button groups, ensure the visual label has an `id` and is linked via `aria-labelledby` to the group container.
""")
