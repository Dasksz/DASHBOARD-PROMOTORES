1. **Goal**: Refactor the duplicated UI logic for `feed-filial` dropdown rendering and toggling in `js/app/feed_view.js` by using the existing `window.setupGenericFilialFilterHandlers` function in `js/app/utils.js`.
2. **Current state**: The `setupFilters` function in `feed_view.js` manually attaches change event listeners to `feed-filial` radios, manually updates text, and manually handles dropdown toggling and click-outside events for both `feed-filial-filter-dropdown` and `feed-promotor-filter-dropdown`.
3. **Changes**:
   - Replaced the manual `filialRadios` event listener and the toggle logic for `feed-filial-filter-btn` in `feed_view.js` with `window.setupGenericFilialFilterHandlers('feed', ...)`
   - Passed a callback to update `feedCurrentFilialFilter` and trigger feed loading.
   - Kept the isolated custom behavior to hide `feed-promotor-filter-dropdown` when filial opens.
   - Kept the Promotor dropdown toggle logic intact but isolated since there's no generic single-select checkbox for promotores yet that fits perfectly.
4. **Outcome**: Reduces duplication and centralizes the DOM logic, adhering to the "Tidy" standards observed in memory.
5. **Next steps**: Complete pre commit steps to ensure proper testing, verification, review, and reflection are done. Then submit the pull request.
