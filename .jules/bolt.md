
## 2024-03-24 - [Hoist Set Lookups in Vanilla Loops]
**Learning:** Hardcoded arrays checked with `.includes()` inside `.map()`/`.reduce()` loops process very slowly when iterating over datasets with 10k+ rows. In a vanilla SPA architecture without bundler-based dead-code elimination, these tiny allocations in hot paths like filtering cause noticeable UI jank.
**Action:** Always extract static hardcoded arrays into globally/locally hoisted `Set` objects, replacing `.includes(item)` with `.has(item)`. This converts `O(m * n)` operations to `O(1 * n)`, which drastically improves rendering speed and eliminates garbage collection pauses.
## 2026-03-25 - [Optimize DOM Insertion in Feed View]
**Learning:** Sequential DOM insertions in high-frequency rendering loops (like building feed cards) cause significant browser repaints.
**Action:** Use `DocumentFragment` to batch DOM insertions when rendering multiple elements (e.g. in `js/app/feed_view.js`) to achieve O(1) DOM reflow instead of O(N).

## 2024-03-25 - [Optimize `updateAllVisuals` Filter Recomputations]
**Learning:** In highly interactive dashboards, running base-level array filters (like checking hierarchical data for all clients) multiple times within the same function pass creates massive blocking CPU overhead, particularly noticeable on scroll/render events. The `updateAllVisuals` function was running `getHierarchyFilteredClients` and subsequent Map/Set filtering up to 4 times per execution for the same base view context.
**Action:** When working on complex visual updating routines, identify the absolute minimum filtered set of data needed and compute it once at the start. Store this base filtered set (`baseFilteredHierarchyClients`) and pass it to secondary helper functions (`getFilteredIds`, table data map) to perform their intersections immediately, turning O(N*4) operations into a single O(N) pre-compute pass.
