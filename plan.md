1. **Add generic single-select dropdown filter handler**
   - Add `window.setupGenericSingleDropdownFilterHandlers` to `js/app/utils.js`. This generic function will handle the dropdown toggle, selection updates (by capturing clicks on `.dropdown-item`), updating the hidden input, updating the text span, closing on outside click, and executing a callback. This logic exactly mirrors what is currently in `setupInnovationsMonthCategoryFilterHandlers`.
2. **Refactor `setupInnovationsMonthCategoryFilterHandlers`**
   - Update `js/app/app.js` to replace the verbose implementation inside `setupInnovationsMonthCategoryFilterHandlers` with a call to the new `window.setupGenericSingleDropdownFilterHandlers`.
   - Note: There are two places where `setupInnovationsMonthCategoryFilterHandlers` might be defined, or it might be duplicate logic. We will ensure the implementation is DRY.
3. **Run Pre Commit Steps**
   - Ensure the code parses correctly, UI tests pass (if any), and everything looks clean without changing business logic.
4. **Submit PR**
   - Title: `🧹 Tidy: Extrai lógica do dropdown de categoria (single-select) para utilitário global`
   - Description includes the what, why, impact and verification.
