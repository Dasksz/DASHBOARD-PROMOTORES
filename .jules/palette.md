## 2024-10-25 - Added ARIA labels to icon-only buttons
**Learning:** Many icon-only buttons (like modals, FAB actions, close buttons) in this application lack `aria-label`s, which is critical for screen reader users to identify button functions.
**Action:** When reviewing HTML interfaces, specifically scan for `<button>` elements that only wrap SVG icons or icon fonts, and ensure they include descriptive `aria-label` attributes.

## 2025-03-30 - Aria labels
**Learning:** For a single micro-improvement, it is better to modify specific files directly rather than using a script across the entire document. Always clean up temporary files used for scripts or verification before submitting.
**Action:** Use precise `sed` or file replacing tools to add `aria-label` to just the elements requested when trying to add a micro-UX improvement. Keep it below 50 lines. Remember to `rm` workspace files.
