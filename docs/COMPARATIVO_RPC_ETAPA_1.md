# Comparativo: primeira etapa da migração RPC

Implementação em 02/10/2026 no banco PROMOTOR's e no frontend.

## Escopo entregue

Os oito cartões do Comparativo consomem `get_comparison_kpis_v1(p_filters jsonb)`: faturamento, peso, clientes, ticket, mix Pepsico, mix Salty, mix Foods e perdas. A tendência dos cartões também é calculada no banco. O gráfico mensal conserva seu cálculo local nesta etapa. O processamento local de mix e perdas foi retirado deste fluxo.

Filtros, séries semanal/mensal/diária, agrupamento de coordenador/promotor/supervisor, tabela semanal e calendário das séries continuam parcialmente locais. Os downloads e o boot de `js/init.js` permanecem. Esta etapa NÃO é a migração completa da página e NÃO elimina a carga inicial do histórico.

O consolidado a manter é `SQL/SQL_GERAL.sql`, conforme a auditoria e a decisão anterior. O antigo `SQL/full_system_v2.sql` não foi restaurado. Para instalação incremental, executar somente `SQL/comparison_kpis_v1.sql` e `SQL/comparison_read_policy_optimization.sql`, em transação; não executar o consolidado antigo inteiro sobre produção.

## Regras conferidas

| Indicador/regra | Comportamento preservado |
|---|---|
| Tipo normal | Tipos 1/9 usam `vlvenda`; seleção mista com 1/9 continua normal |
| Tipo alternativo | Seleção sem 1/9 usa `vlbonific` |
| Positivação | Soma líquida por cliente >= 1 |
| Mix | Soma líquida por cliente/produto >= 1; fornecedores 707, 708, 752; média apenas entre clientes com mix positivo |
| Salty/Foods | Todas as marcas necessárias devem existir no conjunto de produtos positivos do cliente |
| Histórico | Faturamento, peso e perdas de todo o arquivo histórico divididos por 3; clientes e mix dos últimos três meses encontrados, também divididos por 3 |
| Ticket | Faturamento dividido pelos clientes; histórico é a razão dos indicadores médios |
| Perdas | Tipo 5 usa `vlbonific`, independentemente dos tipos escolhidos; exclui ramo contendo AMERICANAS/BH |
| Foods virtual | TODDYNHO, TODDY e QUAKER/KEROCOCO, com a precedência do frontend |
| Cidade | Igualdade exata em minúsculas com cidade do cadastro; não usa coluna inexistente no histórico |
| Pasta | Campo da venda, dimensão do fornecedor ou inferência pelo nome, na mesma ordem do frontend |
| Tendência | Segunda a sexta, feriados selecionados, data de referência UTC; mínimo de 1 dia decorrido; arredondamento dos indicadores de clientes; mix não projetado |
| Fontes | Histórico e atual permanecem separados; `UNION ALL` preserva linhas legítimas iguais |

Descrições vêm de `dim_produtos`, como no frontend atual. Não foi substituída silenciosamente por `data_product_details`. Não foram impostas novas janelas de data à base histórica. Antes de mudar essas regras, definir explicitamente a regra desejada e repetir a comparação.

## Acesso e integração

Função `SECURITY INVOKER`, `search_path` fixo, EXECUTE revogado de PUBLIC/anon e concedido a authenticated. Exige sessão e aprovação/administração. A carteira é derivada do perfil e dos vínculos de promotores; em modo vendedor, o código do perfil restringe `codusur`. Os códigos de clientes enviados são seleção adicional. Os filtros de hierarquia/rede escolhidos pelo usuário ainda são traduzidos em clientes pelo fluxo legado.

Existe uma limitação anterior importante: o vínculo de supervisor a vendedor ainda não tem uma fonte completa nas dimensões. A RPC não inventa esse vínculo nem libera toda a base como alternativa. O problema anterior de autoedição de `profiles.role/status` também continua pendente; usar o papel do perfil não corrige essa vulnerabilidade. As políticas amplas de leitura direta das tabelas ainda precisam de uma etapa própria de autorização.

O frontend reúne alterações durante 150 ms, cancela a requisição anterior, ignora respostas antigas, valida o contrato e oferece retry em erro. Erro não é convertido em zero. Os cartões não são recalculados a partir das tabelas locais. Os gráficos começam a atualizar em paralelo à RPC. Os cartões existentes permanecem na grade durante a atualização; a indicação de carregamento usa opacidade, sem recolher a altura da grade. Em caso de erro, o aviso e retry são sobrepostos aos cartões. As animações de entrada de 1,1 segundo foram retiradas dos gráficos do Comparativo.

As sete políticas de leitura usadas pela RPC mantêm a mesma expressão de autorização, mas `is_admin`/`is_approved` são avaliadas por subconsulta, uma vez por consulta. Papéis e políticas de escrita foram preservados.

## Validação

- 11 cenários determinísticos executados com fixtures transacionais e ROLLBACK: todos os indicadores, linhas repetidas, tipos alternativos/mistos, filial, fornecedor virtual, produto, cidade, carteira vazia, tendência e feriado.
- 13 combinações sobre amostra real de 297 linhas de 3 clientes: 208 valores confrontados com implementação JavaScript independente das regras antigas; paridade dentro de tolerância numérica.
- Testes com papel authenticated: promotor, vendedor, tentativa de selecionar cliente fora da carteira, sessão vazia e ausência de EXECUTE para anon.
- Testes do consumidor: debounce, cancelamento, resposta fora de ordem, contrato inválido, erro/retry e conversão de peso para toneladas.
- Teste de execução dos caminhos de gráfico semanal, mensal e diário, com/sem tendência. Não equivale a teste visual autenticado de navegador.
- `node --check` no arquivo alterado.
- Nenhuma fixture permaneceu no banco. Os dados reais da amostra não são versionados no repositório.

Em duas medições isoladas com `EXPLAIN ANALYZE`, a mesma chamada administrativa com todos os clientes e pasta PEPSICO levou 8.050 ms antes e 2.191 ms depois da otimização de políticas. São medições do banco, com cache de blocos aquecido; não representam o tempo completo da página nem uma média de benchmark. Ainda há escrita temporária nas agregações e espaço para otimizar o plano.

Os Advisors não apontaram a nova função entre os problemas de segurança. Continuam os avisos anteriores. Referências: [RLS e InitPlans](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select), [políticas sobrepostas](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies).

## Próximas etapas

1. Séries e tabelas por RPC: preservar semanas que atravessam meses, média diária por índice de dia útil, excedente do mês anterior e projeção semanal. A tabela semanal legada usa `VLVENDA` mesmo em tipo alternativo; resolver explicitamente essa divergência ao migrá-la.
2. Filtros em cascata e buscas por RPC, incluindo hierarquia/rede e seleções vazias. Completar vínculo supervisor–vendedor.
3. Bootstrap do Comparativo por RPC e remoção de sua dependência de arrays locais; manter downloads das outras páginas até suas migrações.
4. Somente ao fim retirar downloads globais, como solicitado.

Também foi observado armazenamento de credenciais de serviços em `data_metadata`, tabela baixada pelo frontend. Não foram reproduzidos seus valores nem alteradas credenciais. Migrar esses segredos para armazenamento restrito e avaliar rotação em etapa específica; a migração do Comparativo não resolve essa exposição.

## Reversão

Reverter o commit de frontend e consolidado para recuperar o consumidor anterior. A RPC adicional pode permanecer sem consumidores. Para retornar exatamente ao custo anterior das sete políticas, substituir as duas subconsultas pela expressão anterior `public.is_admin() OR public.is_approved()`. Não apagar tabelas nem reimportar dados para reverter esta etapa.

## Otimização da troca de filtros (02/10/2026)

A RPC agora evita materializar sucessivamente as mesmas linhas brutas e enriquecidas, trabalha com projeção menor e calcula a classificação de marcas uma vez por produto, utilizando máscaras para reunir as marcas compradas. A lista selecionada de clientes é deduplicada antes da filtragem. A seleção dos últimos meses usa agregação, evitando ordenar todas as linhas do histórico para obter somente três meses. Foram preservadas as regras e os privilégios.

O frontend conserva o DOM dos cartões durante o carregamento, inicia os gráficos locais sem esperar pela RPC e elimina a animação de entrada de 1.000 ms mais 100 ms de atraso a cada filtro. Cancelamento e descarte de resultados antigos continuam ativos.

Medições isoladas durante a otimização: aproximadamente 1,55–1,89 segundo para seleção administrativa ampla com PEPSICO; 97 ms para seleção de 36 clientes de um promotor. Esses valores medem somente o banco, não rede/renderização. A página ainda não tem todas as séries por RPC; o processamento local de gráficos continua sendo uma limitação a remover na próxima etapa.
