# Plano de Implementação: Páginas "Estoque" e "Semanal"

Este documento descreve a estratégia técnica para portar e adaptar as funcionalidades de **Estoque** e **Análise Semanal** do projeto referência ("PRIME") para o **Painel de Promotores**, respeitando as regras de negócio e hierarquia atuais.

---

## 1. Visão Geral e Controle de Acesso

Novas visualizações serão adicionadas ao dashboard, com regras de acesso específicas baseadas em `window.userRole` (adm, coord, cocoord, promotor, supervisor, vendedor).

| Página | Público Alvo | Regra de Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| **Estoque** | Todos | Aberto | Visualização de disponibilidade, ruptura e oportunidades (Novos/Perdidos). Promotores veem apenas dados filtrados para sua carteira. |
| **Semanal** | Gestão | Restrito | Bloqueado para `promotor` e `vendedor`. Acessível para `adm`, `coord`, `cocoord`, `supervisor`. Foca em faturamento macro e rankings. |

### Lógica de Restrição (`app.js`)
*   No `navigateTo(view)`, adicionar verificação:
    ```javascript
    if (view === 'semanal') {
        if (window.userRole === 'promotor' || window.userRole === 'vendedor') {
            window.showToast('error', 'Acesso restrito a gestores.');
            return;
        }
    }
    ```
*   No `index.html`, ocultar o botão "Semanal" no menu (`#desktop-nav-container` e `#mobile-menu`) via classe `hidden` se o usuário não tiver permissão (lógica executada no `init.js` ou `applyHierarchyVisibilityRules`).

---

## 2. Página "Estoque" ( deve ser inserido no botão "Notificações de Estoque").

**Objetivo:** Permitir que o usuário identifique produtos com estoque parado, produtos novos com saída e, principalmente, **Produtos Perdidos** (Com estoque na filial, mas sem venda na carteira do usuário no mês atual).

### A. Estrutura HTML (`index.html`)
Adicionar `#stock-view` dentro de `#content-wrapper`. Estrutura baseada no projeto PRIME: ( https://github.com/Dasksz/PRIME ).

1.  **Filtros (Context-Aware):**
    *   Reutilizar a estrutura de filtros existente (`.glass-filter-box`).
    *   **Filtros Comuns:** Rede, Pasta (Fornecedor), Filial, Cidade, Produto.
    *   **Filtros de Gestão:** Supervisor, Vendedor.
        *   *Adaptação:* Se o usuário for Promotor, os filtros de Supervisor/Vendedor devem ser ocultos ou travados no contexto dele. Usaremos a função existente `applyHierarchyVisibilityRules` ou uma nova `adjustStockFiltersForRole()` para gerenciar isso.
2.  **Tabela Principal:** "Análise de Estoque e Tendência". Colunas: Produto, Fornecedor, Estoque (CX), Venda Média, Tendência (Dias).
3.  **Tabelas Secundárias (Grid 2x2):**
    *   Crescimento (Venda Atual > Média).
    *   Queda (Venda Atual < Média).
    *   Novos (Sem histórico, com venda).
    *   **Perdidos** (Com estoque, sem venda).

### B. Lógica de Dados (`js/app/app.js`)

#### Função `updateStockView()`
1.  **Consolidação de Estoque:**
    *   Ler `stockMap05` e `stockMap08` (já existentes em `embeddedData`).
    *   Criar `activeStockMap`: Soma das filiais (ou filtro por filial selecionada).
2.  **Filtragem de Vendas:**
    *   Usar `getStockFilteredData()` adaptado para respeitar a hierarquia do Promotor.
    *   Se for Promotor, `allSalesData` já deve ser filtrado (ou o filtro de `clientCodes` deve restringir aos clientes dele).
3.  **Classificação de Produtos (Iteração por Produto):**
    *   Para cada produto com Estoque > 0 OU Venda > 0:
        *   Calcular `vendaAtual` (Mês corrente, filtrado pelos clientes visíveis).
        *   Calcular `mediaTrimestral` (Histórico).
        *   **Lógica "Perdidos":**
            *   `if (estoque > 0 && vendaAtual === 0)` -> Adicionar à lista de Perdidos.
            *   *Importante:* Isso mostra produtos que a empresa tem para vender, mas que a carteira do usuário (ex: Promotor X) não vendeu este mês. Isso gera o insight de oportunidade.

---

## 3. Página "Semanal"

**Objetivo:** Acompanhamento tático de vendas por semana e dia útil, comparando com o histórico.

### A. Estrutura HTML (`index.html`)
Adicionar `#weekly-view` dentro de `#content-wrapper`.

1.  **Filtros:** Fornecedor (Pasta), Supervisor, Vendedor, Filial.
2.  **Gráfico Principal (`#weeklySalesChart`):** Barras empilhadas (Dias da Semana) agrupadas por Semana. Linha de tendência "Melhor Dia Mês Anterior".
3.  **Tabela Resumo:** Total por Semana.
4.  **Rankings:**
    *   Positivação (Vendedores).
    *   Mix (Vendedores).
    *   Top Vendedores (Faturamento).

### B. Lógica de Dados (`js/app/app.js`)

#### Função `updateWeeklyView()`
1.  **Definição de Semanas Úteis:**
    *   Implementar `getWorkingMonthWeeks(year, month)`: Divide o mês em semanas de negócio (Seg-Sex, ignorando fins de semana para o gráfico de barras, mas somando ao total).
2.  **Agregação:**
    *   Filtrar vendas do mês atual.
    *   Agrupar por `Semana` (1 a 5) e `Dia da Semana` (Seg a Sex).
    *   *Nota:* Vendas de Sábado/Domingo entram no KPI "Total Mês" mas não geram barras no gráfico de dias úteis (para manter comparabilidade limpa), a menos que o projeto PRIME tenha lógica específica para isso (verificado: o PRIME foca em dias úteis 1-5 para o comparativo diário).
3.  **Comparativo Histórico:**
    *   Calcular "Melhor Dia por Dia da Semana" do mês anterior para desenhar a linha de meta/referência no gráfico.

---

## 4. Plano de Execução Técnica

### Passo 1: Atualizar `index.html`
1.  **Navegação:** Adicionar botões no `#desktop-nav-container` e menu mobile. Ocultar "Semanal" por padrão (`class="hidden"`) e mostrar via JS apenas para gestores.
2.  **Views:** Copiar o esqueleto HTML das views `#stock-view` e `#weekly-view` do projeto PRIME, adaptando as classes CSS para o tema atual (`glass-panel`, `text-slate-300`, etc).

### Passo 2: Implementar Helpers em `js/app/app.js` (ou `utils.js`)
1.  `getWorkingMonthWeeks`: Lógica de calendário.
2.  `calculateStockMonthlyAverage`: Média móvel para estoque.
3.  `getStockFilteredData`: Centralizar a lógica de filtros de estoque cruzando com hierarquia.

### Passo 3: Implementar Lógica da View Estoque
1.  Criar `updateStockView`.
2.  Implementar lógica de cálculo de ruptura/oportunidade ("Perdidos").
3.  Integrar com `renderProductView` ou criar renderizadores de tabela específicos (`renderStockTable`, `renderLostTable`).

### Passo 4: Implementar Lógica da View Semanal
1.  Criar `updateWeeklyView`.
2.  Configurar gráfico Chart.js (`weeklySalesChart`).
3.  Implementar rankings de vendedores (reutilizando lógica de `salesByPersonChart` se possível).

### Passo 5: Event Listeners e Integração
1.  Registrar listeners para os novos filtros (`stock-rede-filter`, `weekly-supervisor-filter`, etc).
2.  Atualizar `navigateTo` para gerenciar a visibilidade e disparar os `updates`.
3.  Garantir que ao trocar de "Promotor" para "Supervisor" (toggle existente), as views se atualizem corretamente (re-renderizar tabelas com o novo contexto).

---

## 5. Considerações de Performance
*   As views de Estoque processam muitos dados (Produtos x Clientes). Manter o uso de `runAsyncChunked` (já existente no projeto) para não travar a UI durante o cálculo da tabela "Perdidos".
*   Usar `Set` para lookups rápidos de clientes ativos.
