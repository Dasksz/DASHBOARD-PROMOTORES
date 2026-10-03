# Comparativo completo por RPC — 02/10/2026

O Comparativo usa `get_comparison_page_v2` para indicadores, gráficos diários, semanais e mensais e tabelas. `get_comparison_filters_v2` fornece as opções dos filtros. O frontend apresenta os resultados sem consultar os conjuntos locais de vendas, histórico ou clientes para calcular esta página.

As regras anteriores foram preservadas: tipos 1/9 e bonificação alternativa, perdas do tipo 5 com exclusões existentes, divisor histórico de três meses, semanas de domingo a sábado com sobreposição do mês anterior, comparação diária pela posição do dia útil, tendência e agrupamentos por hierarquia. A tabela semanal mantém VLVENDA bruto. Os botões mensais permitem faturamento ou clientes atendidos.

Resumos gerais são armazenados apenas para administradores nas seleções elegíveis. A atualização atômica publica a mesma geração para dados e filtros. Todas as chamadas derivam o escopo da sessão autenticada antes de acessar resultados. Seleções específicas continuam sendo calculadas dentro desse escopo.

Ao concluir uma importação, a interface consulta `get_dashboard_summary_status_v1` a cada dois segundos por até três minutos. O job existente, executado a cada minuto, reconstrói os resumos pendentes. O sucesso só aparece após o estado atualizado; uma falha não desfaz os dados já enviados. Esta consulta curta evita depender de uma reconstrução longa dentro do limite de oito segundos da API.

Os filtros usam debounce, cancelamento e descarte de respostas antigas. As opções são carregadas independentemente. Os indicadores mantêm sua altura durante a carga; falhas permitem tentar novamente.

## Cobertura: Americanas

A consulta agrega as vendas por produto e dia uma única vez antes de calcular a projeção. As consultas de dados e filtros usam planos adequados às seleções. O conteúdo JSON completo permaneceu idêntico em oito seleções antes e depois da alteração.

Medições pontuais no banco: Americanas passou de aproximadamente 5.542 ms para 1.338–3.055 ms; as opções de filtro levaram aproximadamente 211 ms. Consultas preparadas no formato da API passaram com limite de oito segundos, inclusive com fornecedor 707. Esses números não representam o carregamento completo do navegador nem garantem duração constante.

## Validação

- Os 16 valores dos indicadores coincidiram com a RPC anterior em seis seleções reais.
- Dezoito cenários sintéticos de calendário, tendência e tipos coincidiram com o cálculo anterior, incluindo 1.086 valores numéricos e as tabelas semanais.
- Testes de acesso verificaram ausência de sessão, escopos de vendedor/promotor, filtros adulterados, cache administrativo e acesso ao estado dos resumos.
- Testes de interface verificaram filtros, cancelamento, respostas antigas, oito indicadores, gráficos, limpeza, nova tentativa e rejeição de dados inválidos.
- Testes existentes de Cobertura/Semanal e sintaxe do frontend passaram.

A abertura geral do Comparativo com resumo pronto levou aproximadamente 54 ms para os dados e 1 ms para as opções no banco. Os resumos reais foram reconstruídos e a geração 5 estava atualizada. Não houve importação real nem inspeção visual em sessão autenticada nesta atualização. A verificação de segurança não apontou achados novos nas funções alteradas; avisos anteriores de outros objetos permanecem fora deste escopo.

## Instalação

`SQL/comparison_full_rpc_v2.sql` reúne a instalação após os resumos compartilhados e também foi anexado a `SQL/SQL_GERAL.sql`. Os arquivos separados mantêm as fontes das funções, filtros, cache, reconstrução e otimização da Cobertura. A atualização já foi aplicada ao banco conectado; não é necessário executar novamente o SQL consolidado inteiro em produção.
