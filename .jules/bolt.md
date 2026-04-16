## 2024-05-18 - [Proxy Array Instantiation Overhead]
**Learning:** Using native array methods like `.filter()` directly on a `ColumnarDataset` instance instantiates a massive number of heavy JS Proxy objects under the hood, degrading performance on large arrays (like `allClientsData`).
**Action:** Always substitute direct `.filter()` calls on `ColumnarDataset` proxies with pre-cached equivalents (e.g., `getActiveClientsData()`) or direct `for` loops against pre-indexed arrays (`optimizedData.clientsByRca.get()`).
