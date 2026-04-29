## 2024-04-10 - Aria-labels added via sed
**Learning:** Found an extensive pattern of icon-only SVG buttons lacking descriptive aria-labels for proper accessibility tracking across the entire HTML and JS template strings. Applied massive search and replace with descriptive Portuguese aria labels to meet accessibility requirements.
**Action:** Always ensure any newly added icon-based buttons or input files correctly supply descriptive `aria-label` tags in Portuguese from the beginning to avoid large-scale manual sweeps later.

## 2024-04-12 - Missing explicit form labels
**Learning:** Found a widespread pattern where form labels were visually associated but lacked `for` attributes connecting them programmatically to `<input>`, `<select>`, and `<button>` elements, especially for filter dropdowns and search inputs. This hindered screen reader accessibility.
**Action:** When adding new form inputs or interactive filters, ensure labels explicitly use the `for="id"` attribute linking to the target element's `id`. Where layout constraints prevent visual labels, use `<label for="..." class="sr-only">`.

## 2026-04-14 - Icon-only and ambiguous buttons accessibility
**Learning:** This app heavily uses utility-class driven (Tailwind) design and interactive icon-only buttons as well as dynamically injected buttons via `innerHTML`. `aria-label`s should be reserved for icon-only buttons or situations where the visible text is not descriptive enough, not simply duplicating the inner text of a button.
**Action:** Add missing `aria-label` to icon-only buttons or ambiguous buttons that are not descriptive enough on their own.
## 2024-04-18 - Missing ARIA label on Loja Perfeita FAB
**Learning:** Found an accessibility issue where the main Floating Action Button (FAB) in the "Loja Perfeita" view, containing only an SVG plus icon for toggling export options, lacked an `aria-label`. Static HTML checkers and regex searches are necessary to find these isolated `<button>` elements that have no text content.
**Action:** Always verify that buttons containing only an SVG or icon have descriptive `aria-label` attributes to ensure screen reader users can understand their function. Used `aria-label="Abrir menu de exportação"` to match the other FABs.

## 2026-04-23 - Modal close buttons accessibility and consistency
**Learning:** Found non-interactive `<span>` elements acting as modal close buttons using `onclick`, lacking keyboard focusability. Also found inconsistent usage of the `&times;` character instead of the standard SVG 'X' icon used in other modals.
**Action:** Replaced `<span>` with `<button aria-label="Fechar">`. Standardized modal close icons to use the uniform SVG path `M6 18L18 6M6 6l12 12` for consistent visual weight and accessibility.

## 2024-04-23 - Secondary Text in KPIs
**Learning:** Found a case where secondary KPIs text context ("Base para os KPIs") was updated to include dynamic data context, like "Clientes Ativos". We wrapped the changing number in a separate `<span>` allowing easy targetability from JS without blowing up the whole text element wrapper, which preserves styling.
**Action:** Always maintain CSS text styles when updating secondary metrics, isolating dynamic content into nested `<span>` elements for targeting.

## 2024-11-20 - Keyboard Accessibility and Empty States
**Learning:** Found that `focus-visible` was completely missing for key navigation/action buttons, severely hindering keyboard accessibility. Additionally, empty chart states were relying on generic and unhelpful text ("Sem dados para exibir.").
**Action:** Added `focus-visible` classes with proper contrast rings (`focus-visible:ring-2 focus-visible:ring-[#FF5E00] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900`) to interactive components and improved empty state feedback strings to guide users on why data might be missing (due to active filters or period selected).
## 2024-04-28 - Descriptive Empty State Messages
**Learning:** Found that generic empty state messages in charts (like "Sem dados para exibir.") are unhelpful to users when filtering datasets. Describing why the data is missing improves the UX significantly.
**Action:** Replaced generic empty state text in the coverage view charts with a more descriptive message explaining that the active filters or period selected might be the cause.

## 2024-04-29 - Missing programmatic linkages for labels
**Learning:** Found a widespread pattern where form labels were visually associated but lacked programmatic linkage. Standard text `<label>` elements were missing the `for` attribute referencing the input's `id` (e.g., in 'Cliente', 'Cidade', and File Uploads). Additionally, custom UI filter groups structured with `role="group"` (like the 'Rede' buttons) incorrectly used generic `<label>` tags which violate HTML standards when containing or sibling to non-form groupings.
**Action:** Always add the `for="id"` attribute to `<label>` tags associating them with `<input>` or `<select>` elements. For custom UI groupings that aren't native inputs, replace the generic `<label>` tag with a `<span id="...">` and add `aria-labelledby="..."` to the container `<div>` with `role="group"` to ensure proper screen reader support.
