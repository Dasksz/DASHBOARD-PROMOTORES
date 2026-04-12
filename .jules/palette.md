## 2024-04-10 - Aria-labels added via sed
**Learning:** Found an extensive pattern of icon-only SVG buttons lacking descriptive aria-labels for proper accessibility tracking across the entire HTML and JS template strings. Applied massive search and replace with descriptive Portuguese aria labels to meet accessibility requirements.
**Action:** Always ensure any newly added icon-based buttons or input files correctly supply descriptive `aria-label` tags in Portuguese from the beginning to avoid large-scale manual sweeps later.

## 2024-04-12 - Missing explicit form labels
**Learning:** Found a widespread pattern where form labels were visually associated but lacked `for` attributes connecting them programmatically to `<input>`, `<select>`, and `<button>` elements, especially for filter dropdowns and search inputs. This hindered screen reader accessibility.
**Action:** When adding new form inputs or interactive filters, ensure labels explicitly use the `for="id"` attribute linking to the target element's `id`. Where layout constraints prevent visual labels, use `<label for="..." class="sr-only">`.
