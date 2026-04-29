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
