## 2024-04-10 - Aria-labels added via sed
**Learning:** Found an extensive pattern of icon-only SVG buttons lacking descriptive aria-labels for proper accessibility tracking across the entire HTML and JS template strings. Applied massive search and replace with descriptive Portuguese aria labels to meet accessibility requirements.
**Action:** Always ensure any newly added icon-based buttons or input files correctly supply descriptive `aria-label` tags in Portuguese from the beginning to avoid large-scale manual sweeps later.

## 2024-04-12 - Missing explicit form labels
**Learning:** Found a widespread pattern where form labels were visually associated but lacked `for` attributes connecting them programmatically to `<input>`, `<select>`, and `<button>` elements, especially for filter dropdowns and search inputs. This hindered screen reader accessibility.
**Action:** When adding new form inputs or interactive filters, ensure labels explicitly use the `for="id"` attribute linking to the target element's `id`. Where layout constraints prevent visual labels, use `<label for="..." class="sr-only">`.

## 2026-04-14 - Icon-only and ambiguous buttons accessibility
**Learning:** This app heavily uses utility-class driven (Tailwind) design and interactive icon-only buttons as well as dynamically injected buttons via `innerHTML`. `aria-label`s should be reserved for icon-only buttons or situations where the visible text is not descriptive enough, not simply duplicating the inner text of a button.
**Action:** Add missing `aria-label` to icon-only buttons or ambiguous buttons that are not descriptive enough on their own.

## 2024-04-19 - Modals Close Buttons & Filter Groups
**Learning:** Found pattern where modal close buttons using `&times;` were built using `<span>` with `onclick` instead of interactive `<button>` elements, breaking keyboard accessibility and screen readers. Also, custom toggle groups using `role="group"` lacked `aria-labelledby` referencing their titles.
**Action:** Always use `<button>` with `aria-label` for modal close actions instead of `<span onclick="...">`. When using `role="group"` for custom button groups, ensure the visual label has an `id` and is linked via `aria-labelledby` to the group container.
