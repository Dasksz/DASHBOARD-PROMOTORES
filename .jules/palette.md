## 2024-10-25 - Added ARIA labels to icon-only buttons
**Learning:** Many icon-only buttons (like modals, FAB actions, close buttons) in this application lack `aria-label`s, which is critical for screen reader users to identify button functions.
**Action:** When reviewing HTML interfaces, specifically scan for `<button>` elements that only wrap SVG icons or icon fonts, and ensure they include descriptive `aria-label` attributes.

## 2025-03-30 - Aria labels
**Learning:** For a single micro-improvement, it is better to modify specific files directly rather than using a script across the entire document. Always clean up temporary files used for scripts or verification before submitting.
**Action:** Use precise `sed` or file replacing tools to add `aria-label` to just the elements requested when trying to add a micro-UX improvement. Keep it below 50 lines. Remember to `rm` workspace files.

## 2025-04-01 - Add ARIA Labels to Dynamic Icon-Only Buttons
**Learning:** Icon-only buttons within template literals (JavaScript generated HTML) are a common pattern in this codebase and require explicit `aria-label` mapping since static HTML checkers miss them.
**Action:** Always search dynamically generated HTML for icon-only buttons when doing accessibility sweeps.

## 2025-04-09 - Missing `for` Attributes on Labels
**Learning:** Many form `<label>` elements in both static (`index.html`) and dynamically generated HTML are missing the `for` attribute that links them to their corresponding input fields (`<input>`, `<select>`). This impacts screen reader accessibility as the label is not programmatically associated with the input.
**Action:** Always ensure that `<label>` elements use the `for` attribute (or `htmlFor` in React/JSX) matching the ID of their associated input, especially when working with form components or dynamically rendering filters.
