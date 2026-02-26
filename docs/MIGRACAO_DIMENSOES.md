# Plano de Migração: Uso de Tabelas Dimensão (Star Schema)

Este documento detalha a estratégia para atualizar o frontend e backend do projeto para utilizar as novas tabelas de dimensão (`dim_vendedores`, `dim_supervisores`, `dim_fornecedores`, `dim_produtos`), visando otimização de performance e redução de custos de armazenamento.

## 1. Contexto e Objetivo

Atualmente, o banco de dados foi atualizado para um modelo **Star Schema** (Esquema Estrela), onde:
*   **Fatos (Vendas):** Tabelas `data_detailed` e `data_history` contêm milhões de registros com códigos (IDs).
*   **Dimensões (Cadastros):** Tabelas `dim_*` contêm os textos (Nomes, Descrições) associados a esses códigos.

**O Problema Atual:** O frontend (`js/app/app.js`) e a carga inicial (`js/init.js`) ainda dependem das colunas de texto duplicadas dentro das tabelas de vendas (ex: `sale.NOME`, `sale.DESCRICAO`). Isso infla o tamanho do download inicial (JSON) e desperdiça armazenamento no Supabase.

**O Objetivo:** Alterar a lógica para que o frontend baixe apenas os códigos nas vendas e faça o "Join" (cruzamento) com as tabelas de dimensão na memória do navegador.

---

## 2. Estratégia Escolhida: Opção A (Join no Frontend)

Esta abordagem foi selecionada como a estratégia imediata para migração. Ela mantém a reatividade instantânea do dashboard atual e reduz drasticamente o tráfego de dados.

### Passo 1: Atualizar o Carregamento de Dados (`js/init.js`)

**Objetivo:** Baixar as tabelas de dimensão em paralelo com as vendas, e selecionar apenas as colunas essenciais (códigos) da tabela de fatos.

**Como fazer:**
No arquivo `js/init.js` (ou onde for feita a chamada `supabase.from(...).select(...)`), alterar a lógica:

```javascript
// 1. Buscar Dimensões (Tabelas Leves)
const [dimVendedores, dimSupervisores, dimProdutos] = await Promise.all([
    supabase.from('dim_vendedores').select('codigo, nome'),
    supabase.from('dim_supervisores').select('codigo, nome'),
    supabase.from('dim_produtos').select('codigo, descricao, codfor, mix_marca, mix_categoria')
]);

// 2. Buscar Vendas (Apenas Códigos e Valores)
// NOTA: Removemos 'nome', 'superv', 'descricao', 'fornecedor' do SELECT para economizar banda
const { data: sales } = await supabase.from('data_detailed')
    .select('id, pedido, codusur, codsupervisor, produto, codfor, qtvenda, vlvenda, dtped, dtsaida, posicao, filial, tipovenda');
```

### Passo 2: Criar Mapas de Acesso Rápido (`js/app/app.js`)

**Objetivo:** Transformar os arrays das dimensões em `Map` para permitir buscas instantâneas (O(1)) durante a renderização.

**Como fazer:**
No início do `js/app/app.js`, logo após receber os dados do `init.js`:

```javascript
// Inicialização dos Mapas
const maps = {
    vendedores: new Map(embeddedData.dim_vendedores.map(v => [v.codigo, v.nome])),
    supervisores: new Map(embeddedData.dim_supervisores.map(s => [s.codigo, s.nome])),
    produtos: new Map(embeddedData.dim_produtos.map(p => [p.codigo, p])), // Guarda o objeto todo
    fornecedores: new Map(embeddedData.dim_fornecedores.map(f => [f.codigo, f.nome]))
};

// Expor helper global para uso nas views
window.resolveDim = (type, code) => {
    if (!code) return 'N/A';
    const map = maps[type];
    if (type === 'produtos') {
        // Produtos retorna o objeto completo
        return map?.get(code) || { descricao: `Produto ${code}` };
    }
    return map?.get(code) || code; // Retorna o nome ou o próprio código se não achar
};
```

### Passo 3: Atualizar a Lógica de Renderização

**Objetivo:** Substituir o acesso direto às propriedades antigas pelos novos lookups.

**Exemplo de Refatoração:**

*   **Antes:**
    ```javascript
    const nomeVendedor = sale.NOME;
    const nomeSupervisor = sale.SUPERV;
    const descProduto = sale.DESCRICAO;
    ```

*   **Depois:**
    ```javascript
    const nomeVendedor = window.resolveDim('vendedores', sale.CODUSUR);
    const nomeSupervisor = window.resolveDim('supervisores', sale.CODSUPERVISOR);
    const produtoInfo = window.resolveDim('produtos', sale.PRODUTO);
    const descProduto = produtoInfo.descricao;
    ```

### Passo 4: Limpeza do Banco de Dados

**Objetivo:** Liberar espaço no Supabase.

**Ação:** Somente após confirmar que **todas** as views do sistema (Dashboard, Tabelas, Exportações Excel/PDF) estão exibindo os nomes corretamente usando a nova lógica, devemos criar uma migration para:
1.  Remover as colunas `nome`, `superv`, `descricao`, `fornecedor`, `observacaofor` das tabelas `data_detailed` e `data_history`.
2.  Manter apenas as colunas de código (`codusur`, `codsupervisor`, `produto`, `codfor`).

---

## 3. Estratégia Futura (Server-Side Rendering)

Para volumes de dados muito grandes (que travam o navegador), a solução final será mover a agregação para o servidor.

**Conceito:**
O frontend deixa de baixar `data_detailed` inteira. Ele apenas chama funções RPC (já criadas em `SQL/RPC_DASHBOARD.sql`).

**Exemplo de Chamada:**
```javascript
const dashboardData = await supabase.rpc('get_main_dashboard_data', {
    p_ano: '2024',
    p_mes: '10',
    p_filial: ['05']
});
renderDashboard(dashboardData);
```

**Estado Atual:** As RPCs já foram criadas no banco de dados e estão prontas para uso quando essa transição for necessária.
