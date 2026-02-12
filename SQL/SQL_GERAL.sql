-- ==============================================================================
-- UNIFIED SQL SCHEMA
-- This file unifies all previous SQL scripts into a single, idempotent schema definition.
-- It includes table definitions, RLS policies, helper functions, and security fixes.
--
-- INSTRUCTIONS FOR ADMIN SETUP:
-- To make a user an admin, run the following SQL (replace with the user's email):
-- UPDATE public.profiles SET role = 'adm', status = 'aprovado' WHERE email = 'user@example.com';
-- ==============================================================================
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ==============================================================================
-- 1. TABLES
-- ==============================================================================
-- 1.1 Tabela de Vendas Detalhadas (Mês Atual)
create table if not exists public.data_detailed (
  id uuid default uuid_generate_v4 () primary key,
  pedido text,
  nome text, -- Vendedor
  superv text, -- Supervisor
  produto text,
  descricao text,
  fornecedor text,
  observacaofor text, -- Pasta
  codfor text,
  codusur text,
  codcli text,
  qtvenda numeric,
  codsupervisor text,
  vlvenda numeric,
  vlbonific numeric,
  totpesoliq numeric,
  dtped timestamp with time zone,
  dtsaida timestamp with time zone,
  posicao text,
  estoqueunit numeric,
  qtvenda_embalagem_master numeric,
  tipovenda text,
  filial text,
  cliente_nome text, -- Otimização
  cidade text,
  bairro text
);

-- 1.2 Tabela de Histórico de Vendas (Trimestre)
create table if not exists public.data_history (
  id uuid default uuid_generate_v4 () primary key,
  pedido text,
  nome text,
  superv text,
  produto text,
  descricao text,
  fornecedor text,
  observacaofor text,
  codfor text,
  codusur text,
  codcli text,
  qtvenda numeric,
  codsupervisor text,
  vlvenda numeric,
  vlbonific numeric,
  totpesoliq numeric,
  dtped timestamp with time zone,
  dtsaida timestamp with time zone,
  posicao text,
  estoqueunit numeric,
  qtvenda_embalagem_master numeric,
  tipovenda text,
  filial text
);

-- 1.3 Tabela de Clientes
create table if not exists public.data_clients (
  id uuid default uuid_generate_v4 () primary key,
  codigo_cliente text unique,
  rca1 text,
  rca2 text,
  rcas text[], -- Array de RCAs
  cidade text,
  nomecliente text,
  bairro text,
  razaosocial text,
  fantasia text,
  cnpj_cpf text,
  endereco text,
  numero text,
  cep text,
  telefone text,
  email text,
  ramo text,
  ultimacompra timestamp with time zone,
  datacadastro timestamp with time zone,
  bloqueio text,
  inscricaoestadual text
);

-- 1.4 Tabela de Pedidos Agregados
create table if not exists public.data_orders (
  id uuid default uuid_generate_v4 () primary key,
  pedido text unique,
  codcli text,
  cliente_nome text,
  cidade text,
  nome text, -- Vendedor
  superv text, -- Supervisor
  fornecedores_str text,
  dtped timestamp with time zone,
  dtsaida timestamp with time zone,
  posicao text,
  vlvenda numeric,
  totpesoliq numeric,
  filial text,
  tipovenda text,
  fornecedores_list text[],
  codfors_list text[]
);

-- 1.5 Tabela de Detalhes de Produtos
create table if not exists public.data_product_details (
  code text primary key,
  descricao text,
  fornecedor text,
  codfor text,
  dtcadastro timestamp with time zone,
  pasta text
);

-- 1.6 Tabela de Produtos Ativos
create table if not exists public.data_active_products (code text primary key);

-- 1.7 Tabela de Estoque
create table if not exists public.data_stock (
  id uuid default uuid_generate_v4 () primary key,
  product_code text,
  filial text,
  stock_qty numeric
);

-- 1.8 Tabela de Inovações
create table if not exists public.data_innovations (
  id uuid default uuid_generate_v4 () primary key,
  codigo text,
  produto text,
  inovacoes text
);

-- 1.9 Tabela de Metadados
create table if not exists public.data_metadata (key text primary key, value text);

-- 1.10 Tabela para Salvar Metas
create table if not exists public.goals_distribution (
  id uuid default uuid_generate_v4 () primary key,
  month_key text not null,
  supplier text not null,
  brand text default 'GENERAL',
  goals_data jsonb not null,
  updated_at timestamp with time zone default now(),
  updated_by text
);

create unique index if not exists idx_goals_unique on public.goals_distribution (month_key, supplier, brand);

-- 1.11 Tabela de Perfis de Usuário
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  status text default 'pendente', -- pendente, aprovado, bloqueado
  role text default 'user',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 1.12 Tabela de Coordenadas de Clientes
create table if not exists public.data_client_coordinates (
  client_code text primary key,
  lat double precision not null,
  lng double precision not null,
  address text,
  updated_at timestamp with time zone default now()
);

-- 1.13 Tabela de Hierarquia de Equipe
create table if not exists public.data_hierarchy (
  id uuid default uuid_generate_v4 () primary key,
  cod_coord text,
  nome_coord text,
  cod_cocoord text,
  nome_cocoord text,
  cod_promotor text,
  nome_promotor text
);

-- 1.14 Tabela de Vínculo Cliente-Promotor
create table if not exists public.data_client_promoters (
  client_code text primary key,
  promoter_code text
);

-- Ensure columns exist (Idempotency for older schemas)
do $$
BEGIN
    ALTER TABLE public.data_detailed ADD COLUMN IF NOT EXISTS observacaofor text;
    ALTER TABLE public.data_history ADD COLUMN IF NOT EXISTS observacaofor text;
    ALTER TABLE public.data_orders ADD COLUMN IF NOT EXISTS tipovenda text;
    ALTER TABLE public.data_orders ADD COLUMN IF NOT EXISTS fornecedores_list text[];
    ALTER TABLE public.data_orders ADD COLUMN IF NOT EXISTS codfors_list text[];
    ALTER TABLE public.data_product_details ADD COLUMN IF NOT EXISTS pasta text;
    ALTER TABLE public.data_client_promoters ADD COLUMN IF NOT EXISTS itinerary_frequency text;
    ALTER TABLE public.data_client_promoters ADD COLUMN IF NOT EXISTS itinerary_ref_date timestamp with time zone;
    
    -- Ensure 'cod_cocoord' exists in 'visitas'
    ALTER TABLE public.visitas ADD COLUMN IF NOT EXISTS cod_cocoord text;
    -- promotor column removed from data_clients in new schema
END $$;

-- Reload Schema Cache to recognize new columns immediately
NOTIFY pgrst, 'reload config';

-- ==============================================================================
-- 2. HELPER FUNCTIONS
-- ==============================================================================
-- 2.1 Check is_admin
create or replace function public.is_admin () RETURNS boolean as $$
BEGIN
  -- Service Role always admin
  IF (select auth.role()) = 'service_role' THEN RETURN true; END IF;
  
  -- Check profiles table for 'adm' role
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = (select auth.uid()) 
    AND role = 'adm'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
set
  search_path = public;

-- 2.2 Check is_approved
create or replace function public.is_approved () RETURNS boolean as $$
BEGIN
  IF (select auth.role()) = 'service_role' THEN RETURN true; END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = (select auth.uid()) 
    AND status = 'aprovado'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
set
  search_path = public;

-- 2.3 Truncate Table (Secure)
create or replace function public.truncate_table (table_name text) RETURNS void as $$
BEGIN
  -- Security check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Only admins can truncate tables.';
  END IF;

  -- Whitelist validation
  IF table_name NOT IN (
    'data_detailed', 'data_history', 'data_clients', 'data_orders', 
    'data_product_details', 'data_active_products', 'data_stock', 
    'data_innovations', 'data_metadata', 'goals_distribution', 'data_hierarchy'
  ) THEN
    RAISE EXCEPTION 'Invalid table name.';
  END IF;

  EXECUTE format('TRUNCATE TABLE public.%I;', table_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
set
  search_path = public;

-- 2.4 Get Initial Dashboard Data (Stub)
create or replace function public.get_initial_dashboard_data () RETURNS json as $$
BEGIN
  return '{}'::json;
end;
$$ LANGUAGE plpgsql SECURITY DEFINER
set
  search_path = public;

-- ==============================================================================
-- 3. TRIGGERS
-- ==============================================================================
-- 3.1 Handle New User (Create Profile)
create or replace function public.handle_new_user () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
set
  search_path = public as $$
BEGIN
  insert into public.profiles (id, email, status)
  values (new.id, new.email, 'pendente');
  return new;
end;
$$;

drop trigger IF exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after INSERT on auth.users for EACH row
execute PROCEDURE public.handle_new_user ();

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) & POLICIES
-- ==============================================================================
-- Enable RLS on all tables
do $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND (table_name LIKE 'data_%' OR table_name = 'goals_distribution' OR table_name = 'profiles')
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        
        -- Revoke public permissions for security
        EXECUTE format('REVOKE ALL ON public.%I FROM anon;', t);
        EXECUTE format('REVOKE ALL ON public.%I FROM authenticated;', t);
        
        -- Grant minimal permissions to authenticated (RLS will handle access)
        EXECUTE format('GRANT SELECT ON public.%I TO authenticated;', t);
        EXECUTE format('GRANT INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    END LOOP;
END $$;

-- 4.1 Profiles Policies
-- Cleanup old policies
drop policy IF exists "Profiles Visibility" on public.profiles;

drop policy IF exists "Admin Manage Profiles" on public.profiles;

drop policy IF exists "Users can view own profile" on public.profiles;

drop policy IF exists "Users can update own profile" on public.profiles;

drop policy IF exists "Profiles Unified Select" on public.profiles;

drop policy IF exists "Profiles Unified Update" on public.profiles;

drop policy IF exists "Profiles Unified Insert" on public.profiles;

drop policy IF exists "Profiles Unified Delete" on public.profiles;

-- Create Unified Policies
-- Select: Users see own, Admins see all
create policy "Profiles Unified Select" on public.profiles for
select
  to authenticated using (
    (
      select
        auth.uid ()
    ) = id
    or public.is_admin ()
  );

-- Update: Users update own, Admins update all
create policy "Profiles Unified Update" on public.profiles
for update
  to authenticated using (
    (
      select
        auth.uid ()
    ) = id
    or public.is_admin ()
  )
with
  check (
    (
      select
        auth.uid ()
    ) = id
    or public.is_admin ()
  );

-- Insert: Admins only (Users created via trigger)
create policy "Profiles Unified Insert" on public.profiles for INSERT to authenticated
with
  check (public.is_admin ());

-- Delete: Admins only
create policy "Profiles Unified Delete" on public.profiles for DELETE to authenticated using (public.is_admin ());

-- 4.2 Data Tables Policies (Standardized: Read=Approved|Admin, Write=Admin)
do $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
            'data_active_products',
            'data_clients',
            'data_client_coordinates', -- Applying standardized security
            'data_detailed',
            'data_history',
            'data_innovations',
            'data_metadata',
            'data_orders',
            'data_product_details',
            'data_stock',
            'data_hierarchy',
            'data_client_promoters'
        )
    LOOP
        -- Cleanup
        EXECUTE format('DROP POLICY IF EXISTS "Read Access Approved" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Write Access Admin" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Update Access Admin" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Delete Access Admin" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Acesso Leitura Unificado" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Acesso Escrita Admin (Insert)" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Acesso Escrita Admin (Update)" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Acesso Escrita Admin (Delete)" ON public.%I;', t);
        -- Old/Legacy names
        EXECUTE format('DROP POLICY IF EXISTS "Enable read access for all users" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Enable insert/update for authenticated users" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Acesso leitura aprovados" ON public.%I;', t);
        
        -- Create New Standardized Policies
        EXECUTE format('CREATE POLICY "Acesso Leitura Unificado" ON public.%I FOR SELECT TO authenticated USING (public.is_admin() OR public.is_approved());', t);
        EXECUTE format('CREATE POLICY "Acesso Escrita Admin (Insert)" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin());', t);
        EXECUTE format('CREATE POLICY "Acesso Escrita Admin (Update)" ON public.%I FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());', t);
        EXECUTE format('CREATE POLICY "Acesso Escrita Admin (Delete)" ON public.%I FOR DELETE TO authenticated USING (public.is_admin());', t);
    END LOOP;
END $$;

-- 4.2.1 Special Policy for data_client_promoters (Allow Write for Approved Users)
-- We explicitly drop the Admin-only policies created in the loop above for this specific table
DROP POLICY IF EXISTS "Acesso Escrita Admin (Insert)" ON public.data_client_promoters;
DROP POLICY IF EXISTS "Acesso Escrita Admin (Update)" ON public.data_client_promoters;
DROP POLICY IF EXISTS "Acesso Escrita Admin (Delete)" ON public.data_client_promoters;

-- Create permissive policies for Coordinators/Co-coordinators (Approved Users)
-- This allows them to manage the client portfolio
DROP POLICY IF EXISTS "Acesso Escrita Aprovados (Insert)" ON public.data_client_promoters;
CREATE POLICY "Acesso Escrita Aprovados (Insert)" ON public.data_client_promoters FOR INSERT TO authenticated WITH CHECK (public.is_approved());

DROP POLICY IF EXISTS "Acesso Escrita Aprovados (Update)" ON public.data_client_promoters;
CREATE POLICY "Acesso Escrita Aprovados (Update)" ON public.data_client_promoters FOR UPDATE TO authenticated USING (public.is_approved()) WITH CHECK (public.is_approved());

DROP POLICY IF EXISTS "Acesso Escrita Aprovados (Delete)" ON public.data_client_promoters;
CREATE POLICY "Acesso Escrita Aprovados (Delete)" ON public.data_client_promoters FOR DELETE TO authenticated USING (public.is_approved());

-- 4.3 Goals Distribution Policies
-- Cleanup
drop policy IF exists "Goals Write Admin" on public.goals_distribution;

drop policy IF exists "Goals Read Approved" on public.goals_distribution;

drop policy IF exists "Acesso Total Unificado" on public.goals_distribution;

drop policy IF exists "Enable read access for all users" on public.goals_distribution;

-- Unified Policy (Read/Write for Admins AND Approved users - per requirements)
-- UPDATE: Segregated into Read (Approved/Admin) and Write (Admin Only) for security.

-- 1. Read Access (SELECT)
DROP POLICY IF EXISTS "Goals Read Access" ON public.goals_distribution;
create policy "Goals Read Access" on public.goals_distribution
for select
to authenticated using (
  public.is_admin ()
  or public.is_approved ()
);

-- 2. Write Access (INSERT, UPDATE, DELETE) - Admin Only
DROP POLICY IF EXISTS "Goals Write Access" ON public.goals_distribution;
create policy "Goals Write Access" on public.goals_distribution
for all
to authenticated using (public.is_admin ())
with check (public.is_admin ());

-- ==============================================================================
-- 5. SECURITY FIXES (DYNAMIC SEARCH PATH)
-- ==============================================================================
-- Fixes "Function Search Path Mutable" warnings for any existing functions
do $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN
        SELECT
            n.nspname AS schema_name,
            p.proname AS function_name,
            pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'get_comparison_data',
              'get_filtered_client_base',
              'get_city_view_data',
              'get_comparison_view_data',
              'get_orders_view_data',
              'get_main_charts_data',
              'get_detailed_orders_data',
              'get_innovations_data_v2',
              'get_weekly_view_data',
              'get_innovations_view_data',
              'get_detailed_orders',
              'get_coverage_view_data',
              'get_filtered_client_base_json',
              'get_stock_view_data'
          )
    LOOP
        EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public',
                       func_record.schema_name, func_record.function_name, func_record.args);
    END LOOP;
END $$;

-- 6. METADATA DEFAULTS
-- Initialize 'senha_modal'
INSERT INTO public.data_metadata (key, value)
VALUES ('senha_modal', '123456')
ON CONFLICT (key) DO NOTHING;

-- Initialize RESEND_FROM_EMAIL (Placeholder - Must be updated by Admin with verified domain)
-- INSERT INTO public.data_metadata (key, value)
-- VALUES ('RESEND_FROM_EMAIL', 'noreply@yourdomain.com')
-- ON CONFLICT (key) DO NOTHING;


-- ==============================================================================
-- 7. VISITAS (New Module)
-- ==============================================================================

-- 7.1 Tabela de Visitas
CREATE TABLE IF NOT EXISTS public.visitas (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now(),
    id_promotor uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    id_cliente text, -- Alterado para TEXT para suportar UUID ou Código do Cliente (flexibilidade)
    client_code text, -- Adicionado para facilitar busca por codigo
    data_visita timestamp with time zone DEFAULT now(),
    checkout_at timestamp with time zone,
    latitude double precision,
    longitude double precision,
    status text DEFAULT 'pendente', -- pendente, aprovado, rejeitado
    respostas jsonb,
    observacao text,
    coordenador_email text,
    cod_cocoord text -- Codigo do Co-Coordenador (Para facilitar envio de email)
);

-- 7.2 Segurança (RLS)
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Promotores inserem suas visitas" ON public.visitas;
CREATE POLICY "Promotores inserem suas visitas" ON public.visitas FOR INSERT TO authenticated WITH CHECK (auth.uid() = id_promotor);

DROP POLICY IF EXISTS "Promotores veem suas visitas" ON public.visitas;
CREATE POLICY "Promotores veem suas visitas" ON public.visitas FOR ALL TO authenticated USING (auth.uid() = id_promotor);

DROP POLICY IF EXISTS "Serviço tem acesso total" ON public.visitas;
CREATE POLICY "Serviço tem acesso total" ON public.visitas FOR ALL TO service_role USING (true);

-- 7.3 Trigger para Email Coordenador
CREATE OR REPLACE FUNCTION public.preencher_email_coordenador()
RETURNS TRIGGER AS $$
DECLARE
  v_user_code text;
  v_cocoord_code text;
BEGIN
  -- 0. Se já foi informado um email (ex: pela Edge Function ou API), mantém.
  IF NEW.coordenador_email IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Usar o código do Co-Coordenador se fornecido na inserção (Prioridade 1)
  IF NEW.cod_cocoord IS NOT NULL THEN
      v_cocoord_code := TRIM(NEW.cod_cocoord);
  ELSE
      -- 2. Descobrir o código do promotor atual (armazenado na coluna 'role' do profile)
      SELECT role INTO v_user_code
      FROM public.profiles
      WHERE id = NEW.id_promotor;

      -- 3. Buscar na hierarquia quem é o co-coordenador deste promotor
      -- Usamos UPPER e TRIM para evitar erros de case sensitivity e espaços
      IF v_user_code IS NOT NULL THEN
        SELECT cod_cocoord INTO v_cocoord_code
        FROM public.data_hierarchy
        WHERE UPPER(TRIM(cod_promotor)) = UPPER(TRIM(v_user_code))
        LIMIT 1;
      END IF;
      
      -- Salvar na coluna para referência futura se descobrimos agora
      IF v_cocoord_code IS NOT NULL THEN
          NEW.cod_cocoord := v_cocoord_code;
      END IF;
  END IF;

  -- 4. Buscar o e-mail desse co-coordenador na tabela profiles usando o código identificado
  IF v_cocoord_code IS NOT NULL THEN
    NEW.coordenador_email := (SELECT email FROM public.profiles WHERE UPPER(TRIM(role)) = UPPER(TRIM(v_cocoord_code)) LIMIT 1);
  END IF;

  -- Fallback 1: Tenta buscar um usuario com role 'coord' (Coordenador Geral)
  IF NEW.coordenador_email IS NULL THEN
     NEW.coordenador_email := (SELECT email FROM public.profiles WHERE UPPER(TRIM(role)) = 'COORD' LIMIT 1);
  END IF;

  -- Fallback 2: Tenta buscar um usuario com role 'adm' ou 'admin' (Admin) se não achou coord
  IF NEW.coordenador_email IS NULL THEN
     NEW.coordenador_email := (SELECT email FROM public.profiles WHERE UPPER(TRIM(role)) IN ('ADM', 'ADMIN') LIMIT 1);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_auto_email_coordenador ON public.visitas;
CREATE TRIGGER trigger_auto_email_coordenador
BEFORE INSERT ON public.visitas
FOR EACH ROW EXECUTE FUNCTION public.preencher_email_coordenador();

DROP TRIGGER IF EXISTS trigger_auto_email_coordenador_update ON public.visitas;
CREATE TRIGGER trigger_auto_email_coordenador_update
BEFORE UPDATE ON public.visitas
FOR EACH ROW
WHEN (OLD.coordenador_email IS NULL)
EXECUTE FUNCTION public.preencher_email_coordenador();
