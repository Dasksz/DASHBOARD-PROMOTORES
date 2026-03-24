-- ==========================================
-- SCRIPT DE OTIMIZAÇÃO SUPABASE (EGRESS E PERFORMANCE)
-- ==========================================

-- 1. Criação de Índices em colunas frequentemente usadas para filtros
-- Isso acelera buscas massivas como '.in("codcli", [...])' ou '.ilike("promoter_code", ...)'
-- Evita "Seq Scan" (varredura de tabela completa) que gasta CPU e pode causar timeouts.

-- Tabela de Vendas Detalhadas (A mais pesada)
CREATE INDEX IF NOT EXISTS idx_data_detailed_codcli ON data_detailed (codcli);
CREATE INDEX IF NOT EXISTS idx_data_detailed_codsupervisor ON data_detailed (codsupervisor);
CREATE INDEX IF NOT EXISTS idx_data_detailed_codusur ON data_detailed (codusur);
CREATE INDEX IF NOT EXISTS idx_data_detailed_dtped ON data_detailed (dtped);

-- Tabela de Histórico
CREATE INDEX IF NOT EXISTS idx_data_history_codcli ON data_history (codcli);
CREATE INDEX IF NOT EXISTS idx_data_history_dtped ON data_history (dtped);

-- Tabela de Clientes
CREATE INDEX IF NOT EXISTS idx_data_clients_codigo_cliente ON data_clients (codigo_cliente);
CREATE INDEX IF NOT EXISTS idx_data_clients_cidade ON data_clients (cidade);
CREATE INDEX IF NOT EXISTS idx_data_clients_cnpj_cpf ON data_clients (cnpj_cpf);

-- Tabela de Pedidos
CREATE INDEX IF NOT EXISTS idx_data_orders_codcli ON data_orders (codcli);
CREATE INDEX IF NOT EXISTS idx_data_orders_codsupervisor ON data_orders (superv);
CREATE INDEX IF NOT EXISTS idx_data_orders_dtped ON data_orders (dtped);

-- Tabela de Roteiros/Promotores
CREATE INDEX IF NOT EXISTS idx_client_promoters_client_code ON data_client_promoters (client_code);
CREATE INDEX IF NOT EXISTS idx_client_promoters_promoter_code ON data_client_promoters (promoter_code);

-- 2. Compressão (VACUUM) para liberar espaço no banco
-- Isso limpa "linhas mortas" (dead tuples) de atualizações/deleções anteriores.
VACUUM ANALYZE data_detailed;
VACUUM ANALYZE data_history;
VACUUM ANALYZE data_clients;
VACUUM ANALYZE data_orders;

-- ==========================================
-- 3. RLS (ROW LEVEL SECURITY) - SEGURANÇA NA FONTE
-- Opcional e muito recomendado para estancar de vez qualquer chance
-- de um Promotor "hackear" e baixar toda a base (ou no caso de bug de frontend
-- forçar o download completo).
-- ==========================================

-- Para ativar as regras de RLS, primeiramente ative o suporte nas tabelas principais
-- ATENÇÃO: Se as regras abaixo causarem erro 403 (Forbidden) ou apagarem a visão
-- de quem devia ver, basta rodar "ALTER TABLE nome_tabela DISABLE ROW LEVEL SECURITY;"

-- A regra a seguir verifica o e-mail/id do usuário logado e se ele for do tipo "Promotor",
-- o Postgres SÓ RETORNA linhas do "data_detailed" que pertençam a clientes
-- associados a ele na tabela "data_client_promoters". Para "adm" ele libera tudo.

-- Para aplicar, descomente os blocos abaixo:

/*
-- Ativar RLS
ALTER TABLE data_detailed ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_history ENABLE ROW LEVEL SECURITY;

-- Função auxiliar que checa se o usuário atual logado no Supabase tem permissão livre (ex: 'adm' ou 'coord')
CREATE OR REPLACE FUNCTION get_user_role() RETURNS text AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Função auxiliar que pega o "código" do promotor logado (ex: "PROM123")
CREATE OR REPLACE FUNCTION get_user_promoter_code() RETURNS text AS $$
  -- Adapte conforme seu sistema de profiles/hierarquia
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1; 
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Política de RLS para Vendas (Detailed)
-- O usuário pode ver a venda SE ele for Admin/Coordenador OU
-- se o codcli da venda estiver associado ao código dele na tabela de roteiros
CREATE POLICY "RLS de Leitura Detailed" ON data_detailed
  FOR SELECT
  USING (
    get_user_role() IN ('adm', 'coord', 'cocoord') 
    OR 
    codcli IN (
      SELECT client_code 
      FROM data_client_promoters 
      WHERE promoter_code = get_user_role() -- Assumindo que o "role" no profiles guarda o cod_promotor (ex: "PROMOTOR01")
    )
  );

-- Política de RLS para Clientes
CREATE POLICY "RLS de Leitura Clients" ON data_clients
  FOR SELECT
  USING (
    get_user_role() IN ('adm', 'coord', 'cocoord') 
    OR 
    codigo_cliente IN (
      SELECT client_code 
      FROM data_client_promoters 
      WHERE promoter_code = get_user_role()
    )
  );

*/
