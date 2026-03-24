
## 2024-03-24 - [Hoist Set Lookups in Vanilla Loops]
**Learning:** Hardcoded arrays checked with `.includes()` inside `.map()`/`.reduce()` loops process very slowly when iterating over datasets with 10k+ rows. In a vanilla SPA architecture without bundler-based dead-code elimination, these tiny allocations in hot paths like filtering cause noticeable UI jank.
**Action:** Always extract static hardcoded arrays into globally/locally hoisted `Set` objects, replacing `.includes(item)` with `.has(item)`. This converts `O(m * n)` operations to `O(1 * n)`, which drastically improves rendering speed and eliminates garbage collection pauses.
