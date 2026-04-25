## 2024-04-19 - Avoid Chained Array Methods on Columnar Proxy Datasets
**Learning:** In `js/app/app.js`, applying sequential `.filter()` operations on arrays wrapping lazy proxies (`ColumnarDataset`) allocates expensive intermediate arrays. This is extremely inefficient because it forces repeated iteration and instantiation. Profiling showed that doing this inside critical paths like `getGoalsFilteredData` and `meta-realizado` drops performance significantly.
**Action:** When filtering base datasets retrieved from `getHierarchyFilteredClients()`, always collapse the conditions into a single, manually written `for` loop that evaluates `continue` for negative conditions and pushes to a result array. Doing so reduces execution time by over ~45% (e.g. from 826ms to 430ms) for N=500k records.

## 2026-04-24 - Normalize Data Upfront
**Learning:** When fetching raw database rows for application-wide mapping (like Researcher codes from 'data_nota_perfeita' spreadsheet imports), normalize the keys immediately at the edge layer (`js/init.js`) by upper-casing and stripping spaces.
**Action:** This prevents the rest of the application (like filters and KPIs) from breaking or duplicating logic to handle minor string inconsistencies like trailing spaces or casing variations.

## 2026-04-24 - Prevent duplicated DOM Event Listeners upon re-initialization
**Learning:** Functions designed to configure UI bindings, like `setupHierarchyFilters` in `js/app/app.js`, are frequently invoked during filter resets. Without mechanisms to verify existing attachments, this results in duplicate event listeners. These duplicates execute serially, often reversing the intended effect (e.g., toggling a dropdown open and immediately closed).
**Action:** Always decorate target DOM elements with a tracking boolean (e.g., `_hasListener = true`) after listener attachment. Prefix listener configuration routines with a check for this flag.
