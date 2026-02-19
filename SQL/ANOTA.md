# Plano de Implementação: Visualização por Perfil (Supervisor/Vendedor)

Este documento detalha o plano técnico para adaptar o dashboard para os perfis de **Supervisor de Vendas** e **Vendedor**, garantindo que a visualização de dados e filtros se ajuste automaticamente ao contexto do usuário.

## 1. Definição de Perfis e Escopo

Atualmente, o sistema foca em Admin, Coordenador, Co-Coordenador e Promotor. Novos perfis serão integrados:

*   **Supervisor de Vendas:**
    *   **Escopo:** Visualiza dados agregados de sua equipe de Vendedores (RCAs). ( o supervisor de determiando RCA será reconhecido por uma logica de reatrribuição, que vai reconhecer nas planilhas de vendas por qual supervisor esse "RCA" vendeu.. O codigo do supervisor vira na planilha de vendas carregadas no uploader na coluna "CODSUPERVISOR". ( para qualquer duviida nessa logicas de reatribuição, opde consultar o projeto "https://github.com/Dasksz/PRIME".
    *   **Foco:** Vendas, Metas, Cobertura e Positivação por Vendedor.
    *   **Filtros:** Deve ver filtros de "Vendedor" e "Supervisor" (se hierarquia permitir), mas **não** deve ver filtros de "Promotor" ou "Coordenador" (a menos que alinhado à estrutura de trade).
    *   **Gráficos:** Rankings devem focar em Vendedores (RCAs).

*   **Vendedor (RCA):**
    *   **Escopo:** Apenas seus próprios dados (Clientes da sua carteira). ( reconhecido pela planilha 'cadstro de cliente", pois para os vendedores, a base está casdtrada diretanente nssa planilha, na coluna "rca1".
    *   **Foco:** Auto-gestão, atingimento de meta pessoal, lista de clientes.
    *   **Filtros:** Filtros de hierarquia (Supervisor, Vendedor) devem vir pré-selecionados e travados (ou ocultos).
    *   **Gráficos:** Visualização de performance individual vs Meta.

## 2. Estratégia de Implementação Técnica

### A. Contexto de Usuário (`userHierarchyContext`)
Aprimorar o objeto global `userHierarchyContext` (definido em `init.js`) para suportar os novos papéis.

*   Adicionar propriedades: `isSupervisor`, `isSeller`.
*   Mapear o login do usuário para o código de Supervisor/Vendedor correspondente nas tabelas de dados (`data_sales`, `data_clients`). ( o codigo que eu vou informar na tabela "profiles" na coluna "role" será o mesmo codigos das planilhas... Ex.: Se o vendedoor pela planilha de casdtrado de cliente tem o codigo "247", na coluna "role" e vou informar o codigo "247" para sabermos que o login é desse vendedor, que vai ter acesso só aos dados desse codigo de RCA,

### B. Gestão de Filtros (Visibilidade Dinâmica)

A lógica de filtros deve ser centralizada para "limpar" a interface baseada no papel.

1.  **Identificação de Elementos:**
    *   Padronizar IDs dos wrappers de filtros: `[view]-promotor-filter-wrapper`, `[view]-supervisor-filter-wrapper`, `[view]-vendedor-filter-wrapper`.

2.  **Lógica de Ocultação (`init.js` ou `utils.js`):**
    *   Criar função `adjustFiltersForUserRole()`:
        *   **Se Supervisor:** Adicionar classe `.hidden` aos wrappers de *Promotor*, *Coordenador*, *Co-Coordenador*. Garantir que wrappers de *Vendedor* estejam visíveis.
        *   **Se Vendedor:** Ocultar todos os filtros de seleção de equipe. Apenas filtros de produto/cliente permanecem.

### C. Adaptação dos Gráficos (Lógica "Context-Aware")

Os gráficos devem reagir à visibilidade dos filtros (como implementado na correção da página "Cobertura").

*   **Padrão de Implementação:**
    *   Verificar se o filtro "Pivô" (ex: Promotor) está visível.
    *   `const showPromoterView = !document.getElementById('...-promotor-filter-wrapper').classList.contains('hidden');`
    *   Se `showPromoterView` for `true` -> Agregar dados por `Promotor`.
    *   Se `showPromoterView` for `false` -> Agregar dados por `Vendedor` (Comportamento padrão para Supervisores).

### D. Ajuste de Consultas de Dados

*   **`getHierarchyFilteredClients`:**
    *   Atualizar para filtrar clientes baseados no `rca1` (código do vendedor) se o usuário for Vendedor ou Supervisor.
    *   Atualmente foca em `promotor`/`coord`. Adicionar ramo lógico para `supervisor`/`vendedor`.

### E. Passos Práticos para Migração

1.  **Database/Auth:** Garantir que a tabela de usuários do Supabase tenha coluna de `role` ou tabela de vínculo para identificar Supervisores/Vendedores.
2.  **Frontend (Init):** Atualizar a lógica de `onAuthStateChange` para popular `window.userRole` corretamente com os novos papéis.
3.  **Frontend (Views):**
    *   Revisar cada view (`updateCoverageView`, `updateMixView`, etc.).
    *   Aplicar a lógica de ocultação de filtros no início da renderização ou globalmente.
    *   Ajustar labels de gráficos dinamicamente (ex: "Top 10 [Entidade]").

## 3. Exemplo Prático (View Cobertura)

A lógica já foi preparada na view de Cobertura:
*   Se o usuário for **Supervisor**, o filtro de Promotor será oculto via CSS/JS na inicialização.
*   O gráfico detectará a ausência do filtro e renderizará automaticamente "Ranking de Vendedores".
*   O título do gráfico e botão de alternância se ajustarão para "Vendedores".

Esta abordagem deve ser replicada para **Mix**, **Positivação** e **Inovações**.

## 4. Para a página de Gestão de carteira para os Vendedores.
*  Como a base já vai vir pr-definida pela planilha de casdatro de clientes... Não teremos opção de adicionar ou excluir clientes, muito menos cadastrar roreirização, pois essa parte de roteirização será apenas para os Promotorrs, consequentemente Os Supervisroes e Venderoes não verão essa pagna "roteiro".
