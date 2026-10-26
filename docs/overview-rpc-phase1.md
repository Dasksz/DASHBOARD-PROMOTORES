# Visão Geral em RPC — etapa 1

Branch de revisão: `feat/overview-rpc`. A migração ainda não foi aplicada em produção e a branch não deve ser mesclada antes da homologação.

## O que muda

`get_overview_summary_v1(p_filters)` calcula no PostgreSQL:

- Faturamento, peso, SKU/PDV, positivação e quantidade da carteira usada como denominador.
- Totais de faturamento por coordenador, co-coordenador e promotor usados pelo quadro Performance.

A Visão Geral passa a consumir esses valores por RPC. O navegador cancela pedidos anteriores, ignora respostas atrasadas e mostra erro se a RPC não estiver instalada ou responder com contrato inválido. Não há fallback silencioso para totais locais.

## O que continua local nesta etapa

As opções dos filtros, o detalhamento de pedidos, os demais gráficos e os cálculos de metas de Performance/radar ainda dependem dos dados locais. O carregamento inicial de vendas e histórico permanece necessário. Esta etapa não equivale à migração completa da Visão Geral e não promete eliminar o download das bases.

As demais abas não são migradas por esta branch.

## Regras preservadas

- Sem seleção de tipo de venda, somente tipos 1 e 9 entram no numerador.
- Se houver algum dos tipos 1/9 selecionados, o cálculo continua usando faturamento e excluindo os demais tipos do numerador, como o JavaScript atual.
- Na seleção exclusiva de outros tipos, o valor é a bonificação (`vlbonific`).
- O cliente é positivado quando a soma do valor aplicável é maior ou igual a R$ 1.
- SKU/PDV soma SKUs distintos por cliente nas operações elegíveis; o denominador é a quantidade de clientes positivados. Clientes abaixo de R$ 1 ainda contribuem para a contagem de SKUs, conforme a regra atual.
- Filtros de pasta, fornecedor físico/virtual, posição, rede e hierarquia são repassados ao banco.
- O filtro de cliente individual altera o numerador; o denominador continua sendo a carteira filtrada por hierarquia/vendedor/rede, como no código atual.
- A carteira usada no denominador não recebe clientes extras apenas por terem realizado uma compra. O escopo de vendas mantém os complementos autorizados pelo helper existente.

## Segurança

A função é `SECURITY INVOKER`, tem `search_path` fixo e usa os helpers existentes de autorização. O escopo vem de `auth.uid()`/perfil aprovado; não aceita perfil ou carteira enviados pelo cliente como autorização. Revoga execução de `PUBLIC` e `anon`, liberando somente `authenticated`. Não modifica tabelas, policies, fontes, funções existentes ou jobs de atualização.

Os arquivos em `tests/fixtures` reproduzem os helpers existentes em um PostgreSQL local isolado. Não são scripts de implantação.

## Validação executada

```bash
npm ci --ignore-scripts
npm run test:overview
node tests/meta-realizado-month.cjs
node tests/meta-client-exports.cjs
node tests/goal-metrics-regression.cjs
node tests/exports-and-client-search.cjs
```

O teste SQL usa PGlite (PostgreSQL embarcado), instala a nova função apenas em memória e compara 2.500 combinações com `calculateSummaryFromData` extraída do JavaScript real. Inclui admin, coordenador, promotor, vendedor e supervisor; filtros vazios/múltiplos, tipos alternativos, devoluções/valores negativos, operações abaixo de R$ 1, carteira sem movimento, fornecedores virtuais e clientes sem cadastro.

Também testa RLS/acesso anônimo, perfil não aprovado, falsificação de escopo, respostas fora de ordem e erros de RPC. Não substitui a comparação ponta a ponta com a sessão e a base reais de cada perfil em homologação.

## Homologação antes de mesclar

1. Usar um projeto Supabase de homologação com dados representativos e os helpers existentes de carteira/hierarquia. Não apontar esta branch para o projeto de produção para instalar SQL.
2. Aplicar apenas `SQL/overview_summary_rpc_v1.sql` nesse projeto e usar os perfis de teste aprovados.
3. Comparar os quatro KPIs e os totais de hierarquia com a versão atual, inclusive com filtros combinados e carteiras vazias; verificar o plano e tempo de resposta sob RLS.
4. Testar o carregamento, falha/repetição, mudança rápida de filtros e saída/retorno à Visão Geral no navegador.
5. Só depois de aprovada a etapa, planejar instalação e publicação. A aplicação da SQL e o merge não foram executados por esta alteração.

Próximas etapas: RPC para os gráficos/metas restantes, pedidos paginados e opções de filtros; depois remover a dependência das bases locais na Visão Geral.
