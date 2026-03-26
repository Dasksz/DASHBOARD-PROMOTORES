## 2024-10-25 - Added ARIA labels to icon-only buttons
**Learning:** Many icon-only buttons (like modals, FAB actions, close buttons) in this application lack `aria-label`s, which is critical for screen reader users to identify button functions.
**Action:** When reviewing HTML interfaces, specifically scan for `<button>` elements that only wrap SVG icons or icon fonts, and ensure they include descriptive `aria-label` attributes.
