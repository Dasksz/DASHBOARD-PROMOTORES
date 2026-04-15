## 2024-05-15 - Optimize array method chains on ColumnarDataset proxies
**Learning:** Chaining array methods like `.map().filter().reduce()` on instances of `ColumnarDataset` is extremely inefficient in this codebase because it dynamically creates computationally expensive Proxy objects for each row multiple times.
**Action:** Replace these chains with a single, vanilla `for` loop. When iterating, check `typeof dataset.get === 'function'` instead of `instanceof ColumnarDataset` to safely handle both array and proxy types without risking `ReferenceError`s due to undefined class references in isolated scopes. Use `.get(i)` inside the loop if it's a proxy.

## 2024-05-16 - Avoid spread syntax with `.map()` on ColumnarDataset
**Learning:** Extracting unique values from large datasets using `new Set([...dataset.map(...)])` allocates massive intermediate arrays and triggers severe proxy overhead on `ColumnarDataset` instances, blocking the main thread during view updates.
**Action:** Always use a vanilla `for` loop to build sets from large proxy arrays. Iterate by `length`, access the underlying array via `_data['COLUMN']` directly (with a fallback to `.get(i)`), and add items to the `Set` individually.
## 2026-04-05 - Optimize array method chains before new Set()
**Learning:** Using `new Set(array.map(fn))` or `new Set([...array1, ...array2])` creates short-lived intermediate arrays that increase memory usage and garbage collection overhead, especially in hot paths over large datasets.
**Action:** Always use vanilla `for` loops to directly populate sets instead of chaining `map` or spread operators when dealing with arrays.
## 2024-03-24 - Pre-resolving Columnar Datasets Array Lookups
**Learning:** Calling functions with property fallbacks and `.toUpperCase()` string manipulation on every iteration of a large `ColumnarDataset` loop introduces massive overhead.
**Action:** When looping over `ColumnarDataset` objects in critical paths, hoist array property lookups before the loop block. Save references to `_data['KEY']` and use conditional indexing inside the loop (`col ? col[i] : fallback`) to gain O(1) performance.
## 2024-05-18 - Optimize Set and Map iteration
**Learning:** Using `Array.from(collection).map(...)` on `Set` or `Map` instances allocates intermediate arrays that are immediately discarded, increasing garbage collection overhead.
**Action:** Replace `Array.from(...).map(...)` with a pre-allocated array (`new Array(collection.size)`) and a direct `for...of` loop to gain a significant performance improvement (up to 3x faster), especially for large datasets.
## 2024-05-20 - Replace Array.prototype.reduce with for-loops\n**Learning:** Chaining array methods or using  in hot paths inside rendering and calculation functions allocates short-lived closure scopes and intermediate arrays, increasing garbage collection overhead.\n**Action:** Replaced  and related  chains with vanilla  loops in key reporting aggregations (e.g., , , total calculations for charts and order items) to eliminate closures, intermediate arrays, and improve execution speed during UI updates.
## 2024-05-20 - Replace Array.prototype.reduce with for-loops
**Learning:** Chaining array methods or using `.reduce()` in hot paths inside rendering and calculation functions allocates short-lived closure scopes and intermediate arrays, increasing garbage collection overhead.
**Action:** Replaced `.reduce()` and related `.map().reduce()` chains with vanilla `for` loops in key reporting aggregations (e.g., `monthlyKpiAverage`, `calculateAdjustedWeeklyGoals`, total calculations for charts and order items) to eliminate closures, intermediate arrays, and improve execution speed during UI updates.
## 2026-04-15 - Avoid Set spreads for merging collections
**Learning:** Merging sets or iterables using spread syntax (e.g., `new Set([...set1, ...set2])` or `[...new Set(array.map(...))]`) causes severe garbage collection overhead by allocating large intermediate arrays before passing them to the Set constructor.
**Action:** Always instantiate sets directly and add items incrementally using vanilla `for` loops or `.forEach()` to optimize memory footprint and rendering speed during hot loops.
## 2026-04-15 - Fixed Mix Client Filter missing logic
**Issue:** The filter `mix-codcli-filter` was not taken into account when producing filtered list of clients in `getMixFilteredData`.
**Resolution:** Added `codcliFilter` variable to fetch `mix-codcli-filter` and passed it inside the array filter using `String(c['Código']) === codcliFilter`.
