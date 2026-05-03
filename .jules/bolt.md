## 2024-05-24 - Avoid redundant Array allocation in getFilteredDataFromIndices mapping
**Learning:** In hot loops mapping large proxies or datasets into `Set` instances, using `.map(fn)` prior to the `Set` constructor allocates unnecessary intermediate arrays, straining garbage collection. We've seen this in `app.js` with `.map()` being substituted manually.
**Action:** Replace `const mySet = new Set(arr.map(item => item.prop));` with a simple loop `const mySet = new Set(); for(let i=0; i<arr.length; i++) mySet.add(arr[i].prop);` when iterating over thousands of items.
## 2024-05-24 - Avoid ColumnarDataset proxy allocations in filter iterations
**Learning:** When evaluating filter conditions (like `filters.clientCodes.has(item.CODCLI)`) across a large `ColumnarDataset`, using `dataset.get(i)` for every row allocates thousands of intermediate Proxy objects, creating extreme garbage collection overhead.
**Action:** Extract the raw column array via `dataset._data['CODCLI']` before the loop and evaluate the condition against the raw value. Only call `dataset.get(i)` if the row matches the filter condition. Additionally, bypass expensive helper calls like `normalizeKey()` by first checking the exact raw value if the filter `Set` already accommodates it.

## 2026-04-27 - Replace O(N) Array.find with O(1) Map lookup in Feed View processing
**Learning:** Iterating over feed items while performing an inner `.find()` on a large hierarchy array creates O(N*M) complexity. This is particularly expensive when each `.find()` call also involves complex string normalization (trim, toUpperCase, normalize, regex).
**Action:** Pre-calculate a Map keyed by pre-normalized codes from the hierarchy array before starting the feed items processing loop. This reduces the inner search to O(1) and eliminates redundant normalization.
## 2024-05-24 - Avoid repeated `.filter()` passes on large proxy arrays
**Learning:** Chaining or repeating `.filter()` calls over the same large dataset (like `allHistoryData` or `ColumnarDataset` instances) to extract multiple different subsets (e.g. date ranges) causes severe performance bottlenecks. It allocates multiple intermediate proxy arrays and repeats expensive operations (like date parsing) N times.
**Action:** Consolidate these operations into a single O(N) `for` loop, caching expensive property computations (like parsing timestamps) once per row, and bucketing the results into their respective target arrays via `if/else` or `push()`.
## 2024-04-30 - Avoid throwing away intermediate sets/arrays in chained Array.filter() calls
**Learning:** Chaining `.filter()` array methods that first filter a list by one condition, and then subsequently re-filter the newly created array against a Set allocates redundant arrays which are immediately thrown away, causing garbage collection pauses.
**Action:** Consolidate filtering conditions into a single pass loop using early returns or single evaluation blocks. For example, evaluate `!item.prop || item.prop === 'N/A'` and `!mySet.has(item.prop)` inside a single `.filter()` callback.
## 2024-05-24 - Pre-calculate derived variables outside hot search loops
**Learning:** Performing regex string manipulation (like `term.replace(/[^a-z0-9]/g, '')`) inside an `Array.every` callback that runs inside a massive `for` loop (e.g. iterating over 10k+ indices) recalculates the same value O(N * M) times. This causes significant, unnecessary CPU overhead during typeahead or search features.
**Action:** Pre-calculate any derived values (like cleaned search terms) into an array or map *before* entering the main data iteration loop, then look them up by index inside the loop.
