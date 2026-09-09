# Plano de Migração: Download de Arquivos para Funções RPC

Este documento traça a estratégia para migrar o processamento de dados e os downloads que atualmente ocorrem no navegador para o backend utilizando **Funções RPC (Remote Procedure Call)** no Supabase. O objetivo é deixar a aplicação mais leve, mais rápida e com melhor performance de memória, especialmente ao lidar com grandes volumes de dados.

## 1. Motivação e Objetivos

Atualmente, a aplicação lida com o processamento de dados diretamente no frontend, o que envolve realizar o download de arquivos inteiros (como os excels) para o navegador para então extrair/filtrar/trabalhar os dados (como visto na manipulação dentro de `js/app/app.js`).

**Problemas atuais:**
- Alto consumo de memória no navegador.
- Lentidão em dispositivos mais fracos.
- Transferência desnecessária de grandes payloads através da rede (trazendo dados que muitas vezes serão filtrados e descartados logo em seguida).
- Riscos de "crashes" da aba do navegador.

**Solução (RPCs no Supabase):**
- Mover a carga pesada de junção (JOINs), filtragem (WHERE) e agregações (GROUP BY, SUM, COUNT) para o banco de dados via PostgreSQL e expor isso usando as funções RPC do Supabase (`supabase.rpc('nome_da_funcao')`).
- A aplicação passa a apenas requisitar a "resposta" (já filtrada e sumarizada) em vez de baixar todos os dados brutos.

## 2. Estratégia de Migração

### Passo 2.1: Mapeamento de Cargas e Filtros Pesados
- **Ação:** Inspecionar `js/app/app.js` e outros arquivos de visualização (ex: `coverage_view.js`, `feed_view.js`) para identificar os principais gargalos.
- **Focos:**
  - Lógica de hierarquia (filtragem de supervisores/vendedores).
  - Cálculos de "Loja Perfeita" (scores médios).
  - Cálculos de Tendência e KPIs gerais (Realizado, Metas).
  - Geração de relatórios completos que hoje exportam arquivos Excel a partir de dados em memória.

### Passo 2.2: Criação de Funções RPC no PostgreSQL
- **Ação:** Escrever o código SQL para funções (stored procedures) dentro do banco de dados (esquema `public`).
- **Exemplo de Padrão SQL:**
  ```sql
  CREATE OR REPLACE FUNCTION get_dashboard_kpis(p_supervisor_code TEXT, p_start_date DATE, p_end_date DATE)
  RETURNS TABLE (total_sales NUMERIC, perfect_stores INT) AS $$
  BEGIN
    RETURN QUERY
    -- Lógica de join com data_hierarchy e sumarização
    SELECT ...
  END;
  $$ LANGUAGE plpgsql;
  ```
- *Nota: Será essencial tratar a tabela `data_hierarchy` (cod_promotor, rca) para que o banco faça a filtragem da árvore (RLS ou filtros diretos) antes de devolver.*

### Passo 2.3: Atualização do Frontend (Projeto V2)
- **Ação:** Refatorar as chamadas Supabase no frontend.
- **De:**
  ```javascript
  const { data, error } = await supabase.from('minha_tabela').select('*');
  const dadosFiltrados = data.filter(...);
  const kpi = dadosFiltrados.reduce(...);
  ```
- **Para:**
  ```javascript
  const { data: kpi, error } = await supabase.rpc('get_dashboard_kpis', {
      p_supervisor_code: '123',
      p_start_date: '2023-01-01',
      p_end_date: '2023-01-31'
  });
  ```
- **Limpeza:** Remover gradativamente funções de utils no JS focadas em processamento em massa que foram substituídas (redução do `app.js`).

### Passo 2.4: Paginação e Relatórios Exportáveis
- **Ação:** Quando um usuário precisar baixar um relatório (Excel/CSV) *muito grande*, em vez de puxar para o navegador, podemos:
  1. Construir uma **Edge Function** no Supabase que consulta o banco, gera o arquivo na memória do servidor e retorna uma URL assinada (Storage) para o cliente.
  2. Ou o cliente chama um RPC paginado, reduzindo o travamento da interface.

## 3. Próximos Passos Imediatos na V2

1. **Analise o `app.js` e o banco atual:** Identifique as 2 ou 3 consultas que mais travam a tela.
2. **Crie a primeira função RPC (Teste):** Desenvolva uma query de sumarização de KPIs básicos e teste localmente no Studio/SQL Editor do Supabase.
3. **Integre a função RPC na V2:** Altere um painel (por exemplo, a view principal de Metas) para usar a nova RPC em vez de iterar sobre o array em memória.
4. **Validar:** Compare a velocidade e o consumo de memória do navegador entre a V1 e a V2-RPC.

---
*Este documento é um rascunho vivo. Conforme avançamos na construção da versão RPC, ele será atualizado com esquemas de banco e endpoints específicos.*
