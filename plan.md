1. **Fix `worker.js`**
   - Import or implement `normalizeResearcherCode` directly in `worker.js`.
   - In `processLojaPerfeita`, when reading the `pesquisador` field (`const pesquisador = String(getVal(row, 'Pesquisador') || '').trim().toUpperCase();`), wrap it in the `normalizeResearcherCode` function so that it's normalized as soon as it's parsed during the upload process.
2. **Apply Migration to `relacao_rota_involves`**
   - Create and apply a Supabase migration on the `PROMOTORES` project. The migration should update the `relacao_rota_involves` table.
   - It will update the `involves_code` column.
   - The query will apply the normalization rules: convert to lowercase, remove spaces, and remove accents (`translate(lower(replace(involves_code, ' ', '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')`).

This guarantees that both new data coming from the uploader and the existing static relationship table are perfectly clean and matching.
