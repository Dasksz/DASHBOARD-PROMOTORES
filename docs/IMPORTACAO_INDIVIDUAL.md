# Importação individual de planilhas

O uploader aceita qualquer uma das planilhas individualmente. Arquivos enviados têm prioridade; referências ausentes são consultadas no Supabase, sem depender do cache do painel.

| Planilha | Referências utilizadas quando os arquivos não são enviados |
| --- | --- |
| Histórico do trimestre | Clientes, vendas atuais, cadastro de produtos, embalagens master e dimensões |
| Cadastro de produtos | Vendas atuais e códigos dos produtos vendidos no histórico; dimensões |
| Nota Involves 1 ou 2 | Cadastro de clientes para identificação por CNPJ/CPF |
| Estrutura de equipe | Nenhuma |
| Títulos | Nenhuma |
| Inovações do mês | Nenhuma |
| Metas de pesquisas | Nenhuma |
| Metas de loja perfeita | Nenhuma |
| Vendas atuais | Clientes, produtos e dimensões |
| Cadastro de clientes | Vendas atuais, produtos e dimensões para o processamento existente |

A RPC `get_import_reference_page_v1` é somente leitura, usa `SECURITY INVOKER`, mantém RLS e exige `is_admin()`. As consultas usam páginas de até 2.000 registros e cursor por chave primária. A consulta de produtos vendidos devolve apenas os códigos distintos, sem baixar todo o histórico.

Se uma referência necessária de vendas ou clientes estiver vazia, ou a consulta falhar, o envio é interrompido com uma mensagem indicando a referência necessária. Arquivos enviados inválidos não são tratados como arquivos ausentes.

O worker devolve `importTables`, a lista de tabelas que o envio pode alterar. Vendas, pedidos, estoque e clientes usados apenas como referência não são reenviados. As dimensões são atualizadas por upsert, preservando códigos existentes. Metadados são atualizados por chave: datas e hashes das fontes ausentes permanecem no banco.

Aplicar `SQL/import_reference_page_v1.sql` antes de publicar o frontend. Verificação local: `node tests/optional-import.cjs` e `node tests/summary-import-refresh.cjs`.
