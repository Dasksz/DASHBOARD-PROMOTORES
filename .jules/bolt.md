## 2024-05-18 - [Proxy Array Instantiation Overhead]
**Learning:** Using native array methods like `.filter()` directly on a `ColumnarDataset` instance instantiates a massive number of heavy JS Proxy objects under the hood, degrading performance on large arrays (like `allClientsData`).
**Action:** Always substitute direct `.filter()` calls on `ColumnarDataset` proxies with pre-cached equivalents (e.g., `getActiveClientsData()`) or direct `for` loops against pre-indexed arrays (`optimizedData.clientsByRca.get()`).
## 2024-05-18 - [Proxy filter side-effects]
**Learning:** In `js/app/app.js`, loops over arrays of JS Proxies (like `ColumnarDataset` objects) often use `.filter()` callbacks that always return `true` simply to act as a side-effecting map (e.g., inside `getHistoricalMix`). This approach wastes memory allocation and invokes expensive Proxy getter traps for properties that are never used.
**Action:** Replace `Proxy.filter(() => true)` structures with a direct `for` loop, eliminating dead property access paths to stop unneeded garbage collection overhead.
