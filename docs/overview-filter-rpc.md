# Visão Geral: opções dos filtros via RPC

Base de comparação: main 7de388e9d53920ff50cde787152989b85b2b768f.

- `get_overview_filters_v1`: coordenador, co-coordenador, promotor, supervisor, vendedor, fornecedor, tipo de venda e rede.
- `search_overview_clients_v1`: busca por código/nome/CNPJ/cidade/bairro, termos separados por `%`, mínimo de três caracteres, até dez resultados e seleção automática do promotor para os mesmos perfis do legado.
- Posição e botões PEPSICO/MULTIMARCAS mantêm suas opções fixas; os valores continuam enviados à RPC de KPIs existente.
- Não modifica fórmulas, dados, políticas RLS, outras páginas, nem funções de KPIs já publicadas.

## Regras preservadas

A hierarquia depende dos pais selecionados, nunca de vendas/fornecedor/posição. Vendedores vêm da carteira, com supervisor no modo vendedor ou hierarquia no modo promotor. Supervisor, tipos e redes não são reduzidos por um filtro de fornecedor.

Fornecedores incluem vendas atuais e histórico autorizado; Foods conserva as três categorias virtuais. O contexto da lista segue o evento legado: pasta/supplier usam a pasta atual e removem seleções incompatíveis; escolha de cliente por administrador/coordenador/co-coordenador mostra fornecedores do cliente sem remover seleções; cliente sem vendas/histórico conserva a lista anterior. Limpar restaura o contexto inicial. O comportamento original do filtro de posição ao limpar não foi alterado.

A RPC deriva permissões da sessão, usa SECURITY INVOKER e search_path vazio, revoga execução de PUBLIC/anon e concede a authenticated. Opções não são autoridade para ampliar acesso; os KPIs mantêm sua própria verificação de escopo.

## Concorrência e falhas

Descarta resultados de consultas anteriores, aborta busca substituída/fechada e mantém seleções em falhas de rede. A limpeza de fornecedores incompatíveis ocorre antes de exibir KPIs definitivos: se ela altera a seleção, recalcula com os filtros finais. Não há cache persistente de opções. As regras de carteira continuam usando os helpers existentes e o processo normal de atualização das atribuições.

## Validação

`npm ci --ignore-scripts && npm run test:overview`

- 2.500 combinações de KPIs comparadas com cálculo JavaScript original em PostgreSQL isolado.
- Opções de fornecedor/tipo/rede comparadas com os renderizadores JavaScript originais.
- Seleção múltipla, cascata, limpar, resultado vazio, fornecedores históricos, nomes atualizados e novos tipos de venda.
- Usuário sem sessão/não aprovado/anon negados; carteira do promotor preservada.
- Contrato JSON, respostas fora de ordem, falha/retry, foco, seleção e rótulos seguros.
- Regressões de exportação/busca de clientes, Comparativo, Cobertura/Semanal.

## Publicação e reversão

Instalar somente as duas funções novas de SQL/overview_filters_rpc_v1.sql antes do frontend. Recarregar schema do PostgREST. Reverter o commit de frontend retorna às listas locais sem alteração de dados; as funções aditivas podem permanecer sem chamadas.
