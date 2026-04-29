1. **Refactor duplicated Rede Filter initialization logic to use `setupGenericRedeFilterHandlers` for `titulos` and `lp` views.**
   - Currently, `titulos` and `lp` views have duplicated manual setup code for the Rede filter (listening to clicks on `redeGroupContainer`, showing/hiding dropdowns, and triggering filter change handlers).
   - This exact logic has been previously generalized into `window.setupGenericRedeFilterHandlers` in `js/app/utils.js`.
   - Update `js/app/app.js` to replace the duplicated logic for `titulos` with a call to `window.setupGenericRedeFilterHandlers('titulos', { get groupFilter() { return titulosRedeGroupFilter; }, set groupFilter(v) { titulosRedeGroupFilter = v; }, get selectedRedes() { return selectedTitulosRedes; }, set selectedRedes(v) { selectedTitulosRedes = v; } }, getTitulosFilteredData, handleTitulosFilterChange, updateRedeFilter)`.
   - Update `js/app/app.js` to replace the duplicated logic for `lp` with a call to `window.setupGenericRedeFilterHandlers('lp', { get groupFilter() { return lpRedeGroupFilter; }, set groupFilter(v) { lpRedeGroupFilter = v; }, get selectedRedes() { return selectedLpRedes; }, set selectedRedes(v) { selectedLpRedes = v; } }, getLpFilteredData, handleLpFilterChange, updateRedeFilter)`.
   - Ensure the required data functions like `getTitulosFilteredData` and `getLpFilteredData` exist or adapt the setup call to match existing data retrieval logic.
2. **Remove duplicate implementations in `renderTitulosView` and `renderLpView`.**
3. **Add entry to `.jules/tidy.md` logging the application of generic rede filter handlers to additional views.**
4. **Complete pre commit steps**
   - Execute tests and lint checks as required before submitting.
1. **Atualizar a função `normalizeKey` no `js/app/utils.js` (Opcional ou Nova Função)**
   - Em vez de alterar o `normalizeKey` (que é muito usado no sistema para outras coisas), criarei uma nova função em `js/app/utils.js` (ex. `window.normalizeResearcherCode`) que fará o `.trim().toLowerCase().replace(/\s+/g, '')` (remove todos os espaços e deixa em minúsculo).
   - Também removerei acentos se houver, garantindo máxima compatibilidade: `.normalize('NFD').replace(/[\u0300-\u036f]/g, "")`.

2. **Aplicar a normalização na inicialização (`relacao_rota_involves` e mapa de pesquisa)**
   - Em `js/app/app.js` (linha ~1916), modificar `const involvesCode = String(item.involves_code || item.INVOLVES_CODE || '').trim().toLowerCase();` para `const involvesCode = window.normalizeResearcherCode(String(item.involves_code || item.INVOLVES_CODE || ''));`. Isso salvará as chaves do `lpResearcherMap` na forma totalmente normalizada sem espaços.

3. **Aplicar a normalização no filtro de Pesquisadores da Loja Perfeita**
   - Na linha ~29130, alterar `const normRes = rawPesquisador.toLowerCase();` para `const normRes = window.normalizeResearcherCode(rawPesquisador);`. Isso fará com que o filtro procure o pesquisador no `lpResearcherMap` ignorando espaços.

4. **Aplicar a normalização na tabela da Loja Perfeita (renderização)**
   - Na linha ~29208, alterar `const resKey = (row.pesquisador || '').toLowerCase().trim();` para `const resKey = window.normalizeResearcherCode(row.pesquisador || '');`.

5. **Aplicar a normalização no PDF Export da Loja Perfeita**
   - Na linha ~29846, alterar `const resKey = rawPesquisador.toLowerCase();` para `const resKey = window.normalizeResearcherCode(rawPesquisador);`.

6. **Pre commit step**
   - Verificar a sintaxe usando `node -c js/app/app.js` e `node -c js/app/utils.js`.

7. **Submit the change**
   - Submit com branch "fix/loja-perfeita-researcher-normalization".
