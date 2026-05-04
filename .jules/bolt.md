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

## 2025-05-15 - Parallelize sequential I/O in Edge Functions
**Learning:** Performing sequential await calls (like Storage deletion and DB updates) within a loop in Supabase Edge Functions creates significant latency. Converting these to concurrent operations using `Promise.all()` reduces total execution time from $O(N)$ to approximately $O(1)$ batch time.
**Action:** Map the dataset to an array of async promises and await them concurrently using `Promise.all()`, aggregating results safely after resolution.
