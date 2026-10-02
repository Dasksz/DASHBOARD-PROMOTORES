# Cobertura e Semanal via RPC

Migração de 02/10/2026, projeto PROMOTORES. O frontend consulta resultados agregados; não varre `allSalesData`, `allHistoryData`, `optimizedData` nem mapas locais de clientes/estoque para calcular estas páginas.

## Endpoints

- `get_coverage_page_v1(p_filters jsonb)`: carteira, clientes ativos no histórico, cobertura atual/anterior, melhor produto, estoque, caixas, PDVs, variações, projeção em dias, tabela completa e séries dos gráficos de cidades e vendedores/promotores.
- `get_weekly_page_v1(p_filters jsonb)`: calendário de semanas, valores por dia, resumo semanal, melhores dias do mês anterior e rankings por faturamento/quantidade de clientes.
- `get_dashboard_filters_v1(p_page text, p_filters jsonb)`: opções de coordenador, co-coordenador, promotor, supervisor, vendedor, fornecedor (incluindo virtuais), produto, tipo de venda, rede, cidade e meses disponíveis. `p_page` aceita `coverage` e `weekly`.

As funções retornam JSON com `schema_version: 1`. O navegador formata os valores e desenha os gráficos; a fonte dos dados e os cálculos ficam no banco. Pesquisa de texto dentro das opções já recebidas é uma operação de apresentação. Filial e grupos de rede são opções fixas da interface; seus filtros são aplicados no SQL.

## Regras de cálculo

| Regra | Comportamento |
|---|---|
| Carteira | Derivada da sessão: administrador, hierarquia trade, supervisor ou vendedor; seleção enviada só restringe. Clientes sem cadastro que venderam no período atual complementam o escopo de vendedor/supervisor, como no carregador existente. |
| Vendedor atual | Vendas e histórico seguem o RCA atual do cliente; Americanas segue o código 1001. O supervisor usa a atribuição mais recente da carteira, independentemente do filtro de fornecedor/produto/período. |
| Base da Cobertura | Clientes cadastrados da carteira após hierarquia, vendedor/supervisor, cidade, rede e última filial. Não exige venda do produto selecionado para entrar no denominador. |
| Ativos no histórico | Soma de `vlvenda >= 1` por cliente no histórico carregado, após filtros de produto/fornecedor/tipo/filial. Não aplica preço nem datas personalizadas a este denominador, preservando a regra existente. O rótulo “3M” pressupõe que o histórico carregado corresponda a três meses. |
| Cliente/PDV coberto | Valor líquido agregado por cliente ou por cliente/produto >= 1; devoluções compensam vendas. |
| Tipos na Cobertura | Sem seleção, conserva todas as operações. Se a seleção não inclui 1 nem 9, usa `vlbonific`; nas demais seleções usa `vlvenda`. Não aplica ao fluxo da Cobertura a restrição de tipos do Comparativo. |
| Caixas | `qtvenda / qtde_master`, usando divisor 1 quando o cadastro não tem embalagem válida; estoque já é armazenado em caixas. |
| Cobertura da seleção | Clientes cobertos / ativos no histórico. Pode superar 100% se há novos clientes atuais que não compraram no histórico; comportamento preservado. |
| Melhor produto | PDVs do produto / base total de clientes, não o denominador histórico. |
| Datas personalizadas | Cada ponta do intervalo é deslocada um mês, limitada ao último dia existente. Intervalos sobrepostos contam nas duas comparações, como antes. |
| Tabela/exportação | Apenas produtos com caixas atuais positivas; ordenação por estoque. A tela mostra 100, a resposta e as exportações conservam todas as linhas. Filtro de projeção afeta a tabela e seu total, não os indicadores/gráficos gerais. |
| Semanal | `vlvenda` de todas as operações. Positivação do ranking conta clientes distintos, sem o limiar monetário da Cobertura. A primeira semana começa no primeiro dia de segunda a sexta do mês; as seguintes começam na segunda e terminam no domingo/último dia do mês. |
| Melhor dia anterior | Maior soma diária, por dia da semana, do mês anterior. Filial, rede, hierarquia e vendedor/fornecedor aplicam-se igualmente aos dois períodos. |

`null` representa variação “Novo” ou projeção sem consumo com estoque positivo, porque JSON não suporta `Infinity`. O frontend restaura o marcador apenas para a apresentação e a compatibilidade com PDF/Excel existentes.

## Correções durante a migração

- A comparação de melhores dias do Semanal ignorava filial/rede no mês anterior; agora os períodos usam a mesma seleção.
- A projeção de produtos novos usava um contador fixo de um dia recebido do carregador; agora conta os dias de segunda a sexta até a data de referência do banco. O cadastro de produto para a vida útil vem de `data_product_details.dtcadastro`.
- A última filial e o supervisor são resolvidos por data, com prioridade do período atual. Isso elimina dependência da ordem de download.
- O rodapé de 100 resultados da Cobertura aparecia duas vezes. Foi removida a duplicação e foi escapado o texto dos produtos na tabela/modal móvel.
- Corrigida a leitura do valor de filial do Semanal: o callback do helper genérico não fornecia os argumentos assumidos.

## Interface e demais páginas

Debounce de 150 ms, cancelamento de chamadas substituídas, timeout de 20 s e descarte de respostas antigas. Indicadores/tabelas/gráficos permanecem durante a carga; erros mostram aviso com tentativa novamente. As opções RPC têm cache de 60 s por seleção dentro da sessão da página; números e séries sempre são consultados. Handlers são instalados uma vez. A animação de entrada do gráfico Semanal foi desativada.

PDF e Excel da Cobertura usam o resultado completo da RPC, incluindo o modal móvel por produto. O Semanal mantém seu gráfico, resumo e rankings. Os downloads globais e a inicialização de `js/init.js` continuam para as outras páginas; portanto a aplicação ainda baixa tabelas no boot. Estas duas páginas já não precisam dessas tabelas para consultar seus dados. O Comparativo continua com a primeira etapa existente (KPIs via RPC, gráficos locais).

## Segurança e instalação

Funções públicas `SECURITY INVOKER`, `search_path` vazio, timeout de 15 s, execução revogada de `PUBLIC`/`anon` e concedida a `authenticated`. Helpers ficam em `dashboard_private`, fora da API pública, com RLS preservada. Não se usa `user_metadata` para autorização. Quatro políticas de leitura foram reescritas com subconsultas escalares para avaliar a mesma permissão uma vez por consulta, sem alterar os predicados nem políticas de escrita.

O instalador incremental é `SQL/coverage_weekly_rpc_v1.sql`; a mesma versão está no consolidado `SQL/SQL_GERAL.sql`. Não executar todo o consolidado antigo sobre produção para instalar somente esta etapa.

O advisor de segurança não apontou avisos para os novos endpoints/helpers. Permanecem as permissões/RLS amplas preexistentes das tabelas e as funções antigas já registradas na auditoria anterior; esta migração restringe os novos endpoints e não substitui aquela revisão.

## Validação

- `node --check js/app/app.js` e `git diff --check`.
- `node tests/coverage-weekly-rpc-ui.cjs`: RPC, debounce, cancelamento, resposta antiga, cache, filial, erro/retry, gráficos, exportação completa, escape de HTML e validação do contrato. Verificação de DOM simulada, não inspeção visual no navegador autenticado.
- `SQL/tests/coverage_weekly_rpc_v1.sql`: 17 cenários de cálculo e controles de acesso/opções, incluindo devolução, limiar monetário, tipos alternativos/mistos, fornecedor virtual, preço, 31 de março/28 de fevereiro, períodos sobrepostos, dias úteis, mês histórico, início de mês no fim de semana, promotor/vendedor/supervisor, perfil pendente, sessão vazia e ausência de execução anônima. Fixtures e alterações de perfil são revertidas por `ROLLBACK`.
- Conferência independente com 1.751 linhas reais de uma carteira, 10 combinações: **2.260 valores operacionais** iguais entre JavaScript e RPC. O script `tests/coverage-weekly-parity.cjs` recebe snapshots fora do repositório; dados reais não foram publicados. Projeção/estoque têm cenários SQL próprios; não entram naquela contagem de paridade.
- Testes existentes do Comparativo (interface e gráficos) continuam passando.

Medições pontuais com `EXPLAIN ANALYZE`, sem rede/renderização: Semanal amplo com fornecedor 707 passou de ~4,6 s na primeira implementação para ~0,9 s; Cobertura com seleção de promotor/fornecedor foi medida em ~0,82 s; opções amplas em ~1,66 s, depois reutilizadas pelo cache da interface. As medidas variam com cache/carga e não representam o tempo completo da página.

## Otimização após timeout em 02/10/2026

A consulta ampla de Cobertura foi reproduzida cancelando após 18 s. A versão anterior recalculava a soma de tendência em leituras correlacionadas do histórico por produto; a expansão dos CTEs repetia trabalho e gerava arquivos temporários. Agora produto/dia é agregado uma vez, divisores são materializados e a tendência usa junção com esse resumo. Os períodos personalizados sobrepostos conservam as duplicações necessárias. O histórico que alimenta apenas tendência é compactado; preço continua aplicado a cada venda original.

O SQL de origem é projetado dentro das páginas para o otimizador eliminar colunas não utilizadas, evitando a resposta interna larga de `rows_v1`. Cobertura não faz mais a junção de supervisor por venda: a atribuição continua disponível na base da carteira para os filtros de supervisor/filial. JIT foi desativado nestes três endpoints; `work_mem` de 32 MB e hash joins nas duas páginas são ajustes locais às funções, restaurados ao retornar. Não foi aumentado o timeout nem alterada a permissão de acesso.

A resposta das opções de filtros deixou de bloquear a apresentação dos números/gráficos. As duas consultas continuam paralelas; opções atualizam separadamente. Uma falha das opções é registrada e permite nova tentativa na próxima atualização, sem descartar dados válidos da página.

Medições amplas, como administrador, sem filtros: **Cobertura ~1,87 s**, **Semanal ~0,69 s** no banco. São medições pontuais de `EXPLAIN ANALYZE`; não incluem rede, boot global ou renderização. A consulta ampla percorre cerca de 129 mil linhas atuais/históricas.

Verificações: 17 cenários SQL e autorização passaram; 2.260 valores operacionais conferidos com o cálculo JavaScript; comparação completa antes/depois em 10 seleções confirmou **2.957 valores numéricos**, incluindo estoque e tendência. O teste de frontend garante números visíveis antes das opções e preservação dos dados quando a RPC de opções falha.

## Plano reutilizado entre filtros

Na investigação posterior da demora ao limpar, a consulta ampla foi medida sob `force_generic_plan`: **26,8 s**, contra **2,2 s** sob `force_custom_plan`. Isso reproduz o risco dos planos genéricos que o PostgreSQL pode escolher após chamadas sucessivas com seleções muito diferentes. As três RPCs públicas agora definem `plan_cache_mode=force_custom_plan` apenas durante sua execução, para planejar com os filtros e a carteira reais. A configuração externa da sessão é restaurada automaticamente. Não se alterou o timeout.

Depois da mudança, a mesma consulta sob uma sessão forçada a reutilizar planos concluiu em **2,34 s**; o Semanal em **1,10 s**. Medições somente no banco, variáveis conforme cache/carga. `SQL/tests/coverage_weekly_plan_reuse.sql` executa 8 seleções sucessivas e confere que Limpar retorna exatamente o JSON geral inicial, incluindo tabela/gráficos, e que o ajuste de planejamento não vaza para a sessão.

O botão Limpar também reinicializa todo o estado de seleção em uma etapa e cancela a resposta filtrada pendente. Nenhuma consulta local de histórico é necessária para essa limpeza. O boot global ainda baixa as tabelas exigidas pelas demais páginas; esta alteração resolve o planejamento das RPCs, não remove aqueles downloads.
