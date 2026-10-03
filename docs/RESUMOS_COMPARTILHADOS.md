# Resumos compartilhados — 02/10/2026

O repositório foi sincronizado com as 11 migrações de resumos já aplicadas no projeto PROMOTOR's. `SQL/shared_dashboard_summaries_v1.sql` preserva a sequência das migrações; o mesmo conteúdo está ao final de `SQL/SQL_GERAL.sql`. Não é necessário reaplicar em produção: o banco já tem esta versão.

Os resumos ficam em `dashboard_private`: vendas por dia, mês, cliente, produto, fornecedor, filial, vendedor, supervisor e operação; calendário e opções de filtros; atribuições atuais de clientes; títulos por cliente/vencimento; respostas pré-calculadas de Cobertura e opções gerais. Valor, bonificação, peso, unidades, caixas e preço unitário original são preservados. Os filtros de preço continuam distinguindo preços originais. As tabelas de origem e seus downloads continuam disponíveis às demais páginas.

Cobertura, Semanal, indicadores do Comparativo e Títulos usam os resumos nas RPCs existentes. O Comparativo foi posteriormente migrado por completo; consulte [COMPARATIVO_RPC_COMPLETO.md](COMPARATIVO_RPC_COMPLETO.md), que também documenta o novo fluxo de atualização após importações. As medições e o fluxo abaixo registram a etapa anterior.

Gatilhos marcam os resumos como pendentes quando as fontes mudam, incluindo estoque e títulos. O job `dashboard-page-summaries-v1` executa a cada minuto. A atualização usa bloqueio e substituição atômica para manter uma geração completa disponível aos leitores. Ao finalizar o upload, o frontend aguarda `refresh_dashboard_summaries_v1` e só informa sucesso com status `current` ou `refreshed`; erro, retorno vazio ou `busy` impedem a mensagem de sucesso. Uma falha nesta etapa não desfaz os dados já enviados.

## Validação nesta continuação

- Sintaxe do frontend e testes existentes de Cobertura/Semanal, interface do Comparativo e gráficos passaram.
- `tests/summary-import-refresh.cjs` confere a espera e os retornos de sucesso/falha da atualização.
- `SQL/tests/shared_summaries_smoke.sql` consulta as quatro RPCs com papel authenticated em transação revertida.
- `SQL/tests/coverage_weekly_plan_reuse.sql` passou: oito seleções sucessivas e limpeza retornaram exatamente os dados gerais iniciais.
- `SQL/tests/comparison_kpis_access_v1.sql` passou: acesso anônimo/sessão vazia recusado e carteira de promotor/vendedor preservada, sem ampliação pela seleção de clientes.

Medições pontuais no banco, sem rede ou renderização: Cobertura geral 2,7 ms; Semanal geral 58,1 ms; Títulos geral 494,8 ms; indicadores do Comparativo com todos os clientes e referência 02/10/2026, 3.867,2 ms. São seleções diferentes e não representam o carregamento completo das páginas. O Comparativo ainda precisa de otimização adicional. Após oito trocas de filtro, limpar a Cobertura retornou o resultado geral em 0,5 ms.

O estado consultado estava atualizado (`dirty=false`, geração 4) e o job automático ativo. Não foi realizada importação real nem inspeção visual em uma sessão autenticada do aplicativo durante esta continuação.
