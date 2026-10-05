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
  cod_cliente text,
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
  inscricaoestadual text,
  filial text,
  supervisor text,
  cod_supervisor text,
  vendedor text,
  cod_vendedor text,
  vendedor_nome text,
  vendedor_codigo text
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
  pasta text,
  qtde_master numeric
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
  name text, -- Full Name
  phone text, -- Phone Number
  avatar_url text, -- Profile Picture URL
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

-- 1.15 Tabela de Títulos (Inadimplência)
create table if not exists public.data_titulos (
  id uuid default uuid_generate_v4 () primary key,
  cod_cliente text,
  vl_receber numeric,
  qt_tit_receber numeric,
  vl_titulos numeric,
  qt_titulos numeric,
  dt_vencimento timestamp with time zone,
  updated_at timestamp with time zone default now()
);

-- 1.16 Tabela Nota Perfeita (Loja Perfeita)
create table if not exists public.data_nota_perfeita (
  id uuid default uuid_generate_v4 () primary key,
  codigo_cliente text,
  mes_ano text,
  semana text,
  pesquisador text,
  cnpj_origem text,
  canal text,
  subcanal text,
  nota_media numeric,
  auditorias integer,
  auditorias_perfeitas integer,
  updated_at timestamp with time zone default now()
);

-- Index for fast client lookup in Loja Perfeita
create index if not exists idx_nota_perfeita_codcli on public.data_nota_perfeita (codigo_cliente);

-- 1.17 Tabela de Relação Rota Involves
create table if not exists public.relacao_rota_involves (
  id uuid default uuid_generate_v4 () primary key,
  seller_code text, -- Código do Vendedor
  involves_code text, -- Código na tabela de notas
  created_at timestamp with time zone default now()
);

-- Index for fast lookup
create index if not exists idx_relacao_rota_involves_seller on public.relacao_rota_involves (seller_code);
create index if not exists idx_relacao_rota_involves_involves on public.relacao_rota_involves (involves_code);

-- 1.18 DIMENSION TABLES (OPTIMIZATION)

-- 1.18.1 DIM_VENDEDORES (Sellers)
CREATE TABLE IF NOT EXISTS public.dim_vendedores (
    codigo text PRIMARY KEY,
    nome text
);

-- 1.18.2 DIM_SUPERVISORES (Supervisors)
CREATE TABLE IF NOT EXISTS public.dim_supervisores (
    codigo text PRIMARY KEY,
    nome text
);

-- 1.18.3 DIM_FORNECEDORES (Suppliers)
CREATE TABLE IF NOT EXISTS public.dim_fornecedores (
    codigo text PRIMARY KEY,
    nome text,
    pasta text
);

-- 1.18.4 DIM_PRODUTOS (Products)
CREATE TABLE IF NOT EXISTS public.dim_produtos (
    codigo text PRIMARY KEY,
    descricao text,
    codfor text,
    mix_marca text,
    mix_categoria text,
    qtde_master numeric
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
    ALTER TABLE public.data_product_details ADD COLUMN IF NOT EXISTS qtde_master numeric;
    ALTER TABLE public.dim_fornecedores ADD COLUMN IF NOT EXISTS pasta text;
    ALTER TABLE public.dim_produtos ADD COLUMN IF NOT EXISTS qtde_master numeric;
    ALTER TABLE public.data_client_promoters ADD COLUMN IF NOT EXISTS itinerary_frequency text;
    ALTER TABLE public.data_client_promoters ADD COLUMN IF NOT EXISTS itinerary_ref_date timestamp with time zone;
    ALTER TABLE public.data_client_promoters ADD COLUMN IF NOT EXISTS itinerary_days text;
    
    -- Ensure 'cod_cocoord' exists in 'visitas'
    ALTER TABLE public.visitas ADD COLUMN IF NOT EXISTS cod_cocoord text;
    ALTER TABLE public.visitas ADD COLUMN IF NOT EXISTS favoritado_por uuid[] DEFAULT '{}';

    -- Ensure 'profiles' columns exist
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name text;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

    -- Ensure data_clients columns exist
    ALTER TABLE public.data_clients ADD COLUMN IF NOT EXISTS cod_cliente text;
    ALTER TABLE public.data_clients ADD COLUMN IF NOT EXISTS filial text;
    ALTER TABLE public.data_clients ADD COLUMN IF NOT EXISTS supervisor text;
    ALTER TABLE public.data_clients ADD COLUMN IF NOT EXISTS cod_supervisor text;
    ALTER TABLE public.data_clients ADD COLUMN IF NOT EXISTS vendedor text;
    ALTER TABLE public.data_clients ADD COLUMN IF NOT EXISTS cod_vendedor text;
    ALTER TABLE public.data_clients ADD COLUMN IF NOT EXISTS vendedor_nome text;
    ALTER TABLE public.data_clients ADD COLUMN IF NOT EXISTS vendedor_codigo text;

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
    'data_innovations', 'data_metadata', 'goals_distribution', 'data_hierarchy', 'data_titulos', 'data_nota_perfeita', 'relacao_rota_involves',
    'dim_vendedores', 'dim_supervisores', 'dim_fornecedores', 'dim_produtos'
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

-- 2.5 Classify Product Mix (Auto-Trigger Function)
CREATE OR REPLACE FUNCTION public.classify_product_mix()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Initialize as null
    NEW.mix_marca := NULL;
    NEW.mix_categoria := NULL;

    -- Brand Logic (Optimization: avoid ILIKE if possible, but description is unstructured)
    IF NEW.descricao ILIKE '%CHEETOS%' THEN NEW.mix_marca := 'CHEETOS';
    ELSIF NEW.descricao ILIKE '%DORITOS%' THEN NEW.mix_marca := 'DORITOS';
    ELSIF NEW.descricao ILIKE '%FANDANGOS%' THEN NEW.mix_marca := 'FANDANGOS';
    ELSIF NEW.descricao ILIKE '%RUFFLES%' THEN NEW.mix_marca := 'RUFFLES';
    ELSIF NEW.descricao ILIKE '%TORCIDA%' THEN NEW.mix_marca := 'TORCIDA';
    ELSIF NEW.descricao ILIKE '%TODDYNHO%' THEN NEW.mix_marca := 'TODDYNHO';
    ELSIF NEW.descricao ILIKE '%TODDY %' THEN NEW.mix_marca := 'TODDY';
    ELSIF NEW.descricao ILIKE '%QUAKER%' THEN NEW.mix_marca := 'QUAKER';
    ELSIF NEW.descricao ILIKE '%KEROCOCO%' THEN NEW.mix_marca := 'KEROCOCO';
    ELSIF NEW.descricao ILIKE '%EQLIBRI%' THEN NEW.mix_marca := 'EQLIBRI';
    ELSIF NEW.descricao ILIKE '%LAYS%' THEN NEW.mix_marca := 'LAYS';
    END IF;

    -- Category Logic
    IF NEW.mix_marca IN ('CHEETOS', 'DORITOS', 'FANDANGOS', 'RUFFLES', 'TORCIDA', 'EQLIBRI', 'LAYS') THEN
        NEW.mix_categoria := 'SALTY';
    ELSIF NEW.mix_marca IN ('TODDYNHO', 'TODDY', 'QUAKER', 'KEROCOCO') THEN
        NEW.mix_categoria := 'FOODS';
    END IF;

    RETURN NEW;
END;
$$;

-- ==============================================================================
-- 3. TRIGGERS
-- ==============================================================================
-- 3.1 Handle New User (Create Profile)
create or replace function public.handle_new_user () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
set
  search_path = public as $$
DECLARE
  v_name text;
  v_phone text;
  v_avatar_url text;
BEGIN
  -- Extract metadata
  v_name := new.raw_user_meta_data ->> 'full_name';
  v_phone := new.raw_user_meta_data ->> 'phone';
  v_avatar_url := COALESCE(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture');

  -- Insert into profiles
  insert into public.profiles (id, email, status, role, name, phone, avatar_url)
  values (
    new.id, 
    new.email, 
    'pendente', 
    'user', 
    v_name, 
    v_phone,
    v_avatar_url
  );
  
  return new;
end;
$$;

drop trigger IF exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after INSERT on auth.users for EACH row
execute PROCEDURE public.handle_new_user ();

-- 3.2 Auto-Classify Products (Mix Logic)
DROP TRIGGER IF EXISTS trg_classify_products ON public.dim_produtos;
CREATE TRIGGER trg_classify_products
BEFORE INSERT OR UPDATE OF descricao ON public.dim_produtos
FOR EACH ROW
EXECUTE FUNCTION public.classify_product_mix();

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
        AND (table_name LIKE 'data_%' OR table_name LIKE 'dim_%' OR table_name = 'goals_distribution' OR table_name = 'profiles')
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

-- Cleanup conflicting/duplicate policies (Performance Fixes)
drop policy IF exists "Profiles Select" on public.profiles;
drop policy IF exists "Profiles Insert" on public.profiles;
drop policy IF exists "Profiles Update" on public.profiles;
drop policy IF exists "Profiles Delete" on public.profiles;

drop policy IF exists "Profiles Unified Select" on public.profiles;

drop policy IF exists "Profiles Unified Update" on public.profiles;

drop policy IF exists "Profiles Unified Insert" on public.profiles;

drop policy IF exists "Profiles Unified Delete" on public.profiles;

-- Create Unified Policies
-- Select: Users see own, Admins see all
create policy "Profiles Unified Select" on public.profiles for
select
  to authenticated using (true);

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
            'data_client_promoters',
            'data_titulos',
            'data_nota_perfeita',
            'relacao_rota_involves',
            'dim_vendedores',
            'dim_supervisores',
            'dim_fornecedores',
            'dim_produtos'
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
        EXECUTE format('DROP POLICY IF EXISTS "Admin Write Access" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Unified Read Access" ON public.%I;', t);
        
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

DROP POLICY IF EXISTS "Goals Insert Admin" ON public.goals_distribution;
create policy "Goals Insert Admin" on public.goals_distribution
for insert
to authenticated
with check (public.is_admin ());

DROP POLICY IF EXISTS "Goals Update Admin" ON public.goals_distribution;
create policy "Goals Update Admin" on public.goals_distribution
for update
to authenticated
using (public.is_admin ())
with check (public.is_admin ());

DROP POLICY IF EXISTS "Goals Delete Admin" ON public.goals_distribution;
create policy "Goals Delete Admin" on public.goals_distribution
for delete
to authenticated
using (public.is_admin ());

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
              'get_stock_view_data',
              'classify_product_mix',
              'set_coordenador_email_on_visita'
          )
    LOOP
        EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public',
                       func_record.schema_name, func_record.function_name, func_record.args);
    END LOOP;
END $$;

-- 6. METADATA DEFAULTS
-- Initialize 'senha_modal'
INSERT INTO public.data_metadata (key, value)
VALUES ('senha_modal', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92')
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
    id_promotor uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
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
    cod_cocoord text, -- Codigo do Co-Coordenador (Para facilitar envio de email)
    favoritado_por uuid[] DEFAULT '{}', -- IDs dos gestores que favoritaram
    promotor_name text
);

-- 7.1.1 Indexes (Performance Optimization)
CREATE INDEX IF NOT EXISTS idx_visitas_id_promotor ON public.visitas (id_promotor);

-- 7.2 Segurança (RLS)
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Promotores inserem suas visitas" ON public.visitas;
CREATE POLICY "Promotores inserem suas visitas" ON public.visitas FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = id_promotor);

DROP POLICY IF EXISTS "Promotores veem suas visitas" ON public.visitas;
DROP POLICY IF EXISTS "Todos veem todas as visitas" ON public.visitas;
DROP POLICY IF EXISTS "Promotores Select" ON public.visitas;
CREATE POLICY "Todos veem todas as visitas" ON public.visitas FOR SELECT TO authenticated USING (true);


DROP POLICY IF EXISTS "Promotores Update" ON public.visitas;
CREATE POLICY "Promotores Update" ON public.visitas FOR UPDATE TO authenticated USING ((select auth.uid()) = id_promotor);

DROP POLICY IF EXISTS "Admin and Coords Update" ON public.visitas;
CREATE POLICY "Admin and Coords Update" ON public.visitas
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (
      role = 'adm'
      OR role IN (SELECT cod_coord FROM public.data_hierarchy)
      OR role IN (SELECT cod_cocoord FROM public.data_hierarchy)
      OR role IN (SELECT codigo FROM public.dim_supervisores)
    )
  )
);

DROP POLICY IF EXISTS "Promotores Delete" ON public.visitas;
CREATE POLICY "Promotores Delete" ON public.visitas FOR DELETE TO authenticated USING ((select auth.uid()) = id_promotor);

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
-- ==============================================================================
-- STORAGE SETUP (Visitas Images)
-- Run this script in the Supabase SQL Editor to create the bucket and policies.
-- ==============================================================================

-- 1. Create 'visitas-images' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('visitas-images', 'visitas-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Security (RLS) for Storage Objects
-- Note: storage.objects usually has RLS enabled by default. 
-- We skip ALTER TABLE to avoid permission errors (42501) if not owner.

-- Allow authenticated uploads
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'visitas-images');

-- Allow public viewing (since bucket is public)
DROP POLICY IF EXISTS "Public can view images" ON storage.objects;
CREATE POLICY "Public can view images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'visitas-images');

-- Allow users to update their own files
DROP POLICY IF EXISTS "Users can update own images" ON storage.objects;
CREATE POLICY "Users can update own images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'visitas-images' AND auth.uid() = owner);

-- Allow users to delete their own files
DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'visitas-images' AND auth.uid() = owner);

-- ==============================================================================
-- STORAGE SETUP (Product Images)
-- ==============================================================================

-- 1. Create 'produtos' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('produtos', 'produtos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Security (RLS) for Storage Objects

-- Allow public viewing (since bucket is public)
DROP POLICY IF EXISTS "Acesso público para ver imagens de produtos" ON storage.objects;
CREATE POLICY "Acesso público para ver imagens de produtos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'produtos' );
-- ==============================================================================
-- MANUAL WEBHOOK SETUP USING PG_NET
--
-- Description:
-- This script manually sets up an HTTP POST trigger using the 'pg_net' extension.
-- This bypasses the need to enable "Database Webhooks" in the Supabase Dashboard,
-- ensuring the 'notify-coordinator' Edge Function is called immediately upon
-- checkout updates.
--
-- Instructions:
-- Run this script in the Supabase SQL Editor.
-- ==============================================================================

-- 1. Enable pg_net extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA extensions;

-- 2. Define the Trigger Function
CREATE OR REPLACE FUNCTION public.trigger_notify_coordinator_http()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text := 'https://dldsocponbjthqxhmttj.supabase.co/functions/v1/notify-coordinator';
  v_api_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZHNvY3BvbmJqdGhxeGhtdHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzgzMzgsImV4cCI6MjA4NTAxNDMzOH0.IGxUEd977uIdhWvMzjDM8ygfISB_Frcf_2air8e3aOs'; -- Anon Key from init.js
  v_payload jsonb;
  v_request_id int;
BEGIN
  -- Construct Payload matching Supabase Webhook format
  v_payload := jsonb_build_object(
    'type', 'UPDATE',
    'table', 'visitas',
    'schema', 'public',
    'record', row_to_json(NEW),
    'old_record', row_to_json(OLD)
  );

  -- Send HTTP POST via pg_net
  -- Note: net.http_post is asynchronous
  SELECT net.http_post(
    url := v_url,
    body := v_payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_api_key
    )
  ) INTO v_request_id;

  RAISE NOTICE 'Manual Webhook Fired via pg_net. Request ID: %', v_request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send manual webhook: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 3. Create the Trigger on 'visitas' table
DROP TRIGGER IF EXISTS "manual_webhook_notify_coordinator" ON public.visitas;

CREATE TRIGGER "manual_webhook_notify_coordinator"
AFTER UPDATE ON public.visitas
FOR EACH ROW
-- Only fire when checkout_at changes from null to a value (Checkout event)
WHEN (OLD.checkout_at IS NULL AND NEW.checkout_at IS NOT NULL)
EXECUTE FUNCTION public.trigger_notify_coordinator_http();

-- Confirmation (Use SELECT instead of RAISE NOTICE for top-level output compatibility)
SELECT 'Manual pg_net webhook configured successfully on public.visitas' as status;


-- ==============================================================================
-- 9. OPTIONAL CONFIGURATIONS
-- ==============================================================================

/*

INSERT INTO public.data_metadata (key, value)
VALUES
    ('BREVO_API_KEY', 'SUA_CHAVE_API_V3_AQUI'),
    ('BREVO_SENDER_EMAIL', 'seu_email_verificado@gmail.com')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- OBS: Se configurar a Brevo, o sistema usará ela automaticamente no lugar do Resend.
-- Para voltar ao Resend, basta deletar essas chaves:
-- DELETE FROM public.data_metadata WHERE key IN ('BREVO_API_KEY', 'BREVO_SENDER_EMAIL');

*/

-- Adicionar coluna promotor_name se nao existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitas' AND column_name='promotor_name') THEN
        ALTER TABLE public.visitas ADD COLUMN promotor_name text;
    END IF;
END $$;

-------------------------------------------------------------------------------
-- Nomalização da tabela config_city_branches (Maiúsculas e sem acentos)
-------------------------------------------------------------------------------

-- 1. Habilitar a extensão que permite tirar acentos
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Atualizar todos os registros existentes para ficar sem acento e em maiúsculo
UPDATE public.config_city_branches
SET cidade = UPPER(unaccent(cidade));

-- 3. Criar uma função para o trigger
CREATE OR REPLACE FUNCTION public.normalize_cidade()
RETURNS TRIGGER AS $$
BEGIN
  NEW.cidade := UPPER(unaccent(NEW.cidade));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Garantir que se o trigger já existir ele será removido antes de recriar
DROP TRIGGER IF EXISTS trg_normalize_cidade ON public.config_city_branches;

-- 5. Criar o trigger na tabela para rodar antes de todo insert/update
CREATE TRIGGER trg_normalize_cidade
BEFORE INSERT OR UPDATE ON public.config_city_branches
FOR EACH ROW
EXECUTE FUNCTION public.normalize_cidade();

-- ==============================================================================
-- 7. SCHEDULED TASKS (CRON)
-- ==============================================================================
-- Ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Auto-checkout unclosed visits at midnight
SELECT cron.schedule('auto-checkout-midnight', '0 0 * * *', $$
    UPDATE visitas
    SET checkout_at = current_timestamp
    WHERE checkout_at IS NULL
$$);


-- ==========================================
-- FUNCTION: public.get_titulos_view_data
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_titulos_view_data(
    p_filial text[] DEFAULT NULL::text[],
    p_cidade text[] DEFAULT NULL::text[],
    p_supervisor text[] DEFAULT NULL::text[],
    p_vendedor text[] DEFAULT NULL::text[],
    p_rede text[] DEFAULT NULL::text[],
    p_search text DEFAULT NULL::text,
    p_coordenador text[] DEFAULT NULL::text[],
    p_cocoordenador text[] DEFAULT NULL::text[],
    p_page integer DEFAULT 0,
    p_limit integer DEFAULT 50
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_rows bigint;
    v_total_receber numeric;
    v_critical_receber numeric;
    v_critical_clients bigint;
    v_rows json;
    v_result json;
    v_today date := CURRENT_DATE;
    v_critical_date date := CURRENT_DATE - INTERVAL '60 days';
BEGIN
    -- Tabela temporária filtrada e unida com clientes
    CREATE TEMP TABLE temp_titulos_filtered ON COMMIT DROP AS
    SELECT 
        t.cod_cliente,
        t.vl_titulos,
        t.vl_receber,
        t.dt_vencimento,
        COALESCE(c.nomecliente, c.razaosocial, c.fantasia, 'Desconhecido') AS nomecliente,
        COALESCE(c.cidade, 'N/A') AS cidade,
        COALESCE(c.rca1, 'N/A') AS vendedor_nome,
        c.ramo,
        c.filial,
        c.supervisor
    FROM public.data_titulos t
    LEFT JOIN public.data_clients c ON (
        COALESCE(c.codigo_cliente, c.cod_cliente, '')::text = t.cod_cliente::text
        OR TRIM(LEADING '0' FROM COALESCE(c.codigo_cliente, c.cod_cliente, '')::text) = TRIM(LEADING '0' FROM t.cod_cliente::text)
    )
    WHERE (p_cidade IS NULL OR c.cidade = ANY(p_cidade))
      AND (
          p_filial IS NULL 
          OR c.filial = ANY(p_filial)
          OR TRIM(c.filial) = ANY(p_filial)
          OR TRIM(LEADING '0' FROM COALESCE(c.filial, '')) = ANY(
              SELECT TRIM(LEADING '0' FROM elem) FROM unnest(p_filial) AS elem
          )
          OR LPAD(TRIM(COALESCE(c.filial, '')), 2, '0') = ANY(
              SELECT LPAD(TRIM(elem), 2, '0') FROM unnest(p_filial) AS elem
          )
          OR EXISTS (
              SELECT 1 FROM unnest(p_filial) elem 
              WHERE c.filial ILIKE '%' || elem || '%'
          )
          OR EXISTS (
              SELECT 1 FROM public.config_city_branches ccb
              WHERE UPPER(ccb.cidade) = UPPER(COALESCE(c.cidade, ''))
                AND (
                    ccb.filial = ANY(p_filial)
                    OR TRIM(ccb.filial) = ANY(p_filial)
                    OR TRIM(LEADING '0' FROM COALESCE(ccb.filial, '')) = ANY(
                        SELECT TRIM(LEADING '0' FROM elem) FROM unnest(p_filial) AS elem
                    )
                    OR LPAD(TRIM(COALESCE(ccb.filial, '')), 2, '0') = ANY(
                        SELECT LPAD(TRIM(elem), 2, '0') FROM unnest(p_filial) AS elem
                    )
                )
          )
      )
      AND (
          p_supervisor IS NULL 
          OR c.supervisor = ANY(p_supervisor)
          OR c.cod_supervisor = ANY(p_supervisor)
          OR UPPER(TRIM(COALESCE(c.supervisor, ''))) = ANY(SELECT UPPER(TRIM(elem)) FROM unnest(p_supervisor) AS elem)
          OR UPPER(TRIM(COALESCE(c.cod_supervisor, ''))) = ANY(SELECT UPPER(TRIM(elem)) FROM unnest(p_supervisor) AS elem)
          OR EXISTS (
              SELECT 1 FROM unnest(p_supervisor) elem
              WHERE (c.supervisor IS NOT NULL AND (c.supervisor ILIKE '%' || elem || '%' OR elem ILIKE '%' || c.supervisor || '%'))
                 OR (c.cod_supervisor IS NOT NULL AND (c.cod_supervisor ILIKE '%' || elem || '%' OR elem ILIKE '%' || c.cod_supervisor || '%'))
                 OR (elem LIKE '% - %' AND (
                     c.supervisor ILIKE '%' || trim(split_part(elem, ' - ', 2)) || '%'
                     OR c.cod_supervisor = trim(split_part(elem, ' - ', 1))
                 ))
          )
          OR EXISTS (
              SELECT 1 FROM public.data_clients c2
              WHERE (
                  (c2.rca1 IS NOT NULL AND c2.rca1 <> '' AND c2.rca1 = c.rca1)
                  OR (c2.vendedor_codigo IS NOT NULL AND c2.vendedor_codigo <> '' AND c2.vendedor_codigo = c.vendedor_codigo)
              )
              AND (
                  c2.supervisor = ANY(p_supervisor)
                  OR c2.cod_supervisor = ANY(p_supervisor)
                  OR UPPER(TRIM(COALESCE(c2.supervisor, ''))) = ANY(SELECT UPPER(TRIM(elem)) FROM unnest(p_supervisor) AS elem)
                  OR EXISTS (
                      SELECT 1 FROM unnest(p_supervisor) elem
                      WHERE c2.supervisor ILIKE '%' || elem || '%'
                         OR elem ILIKE '%' || c2.supervisor || '%'
                         OR (elem LIKE '% - %' AND (
                             c2.supervisor ILIKE '%' || trim(split_part(elem, ' - ', 2)) || '%'
                             OR c2.cod_supervisor = trim(split_part(elem, ' - ', 1))
                         ))
                  )
              )
          )
                    OR EXISTS (
              SELECT 1 FROM public.data_orders o
              WHERE (o.codcli = COALESCE(c.codigo_cliente, c.cod_cliente, ''))
                AND (
                    o.superv = ANY(p_supervisor)
                    OR EXISTS (
                        SELECT 1 FROM unnest(p_supervisor) elem
                        WHERE o.superv ILIKE '%' || elem || '%'
                           OR elem ILIKE '%' || o.superv || '%'
                           OR (elem LIKE '% - %' AND (
                               o.superv ILIKE '%' || trim(split_part(elem, ' - ', 2)) || '%'
                           ))
                    )
                )
          )
      )
      AND (
          p_vendedor IS NULL 
          OR c.rca1 = ANY(p_vendedor)
          OR c.vendedor = ANY(p_vendedor)
          OR c.vendedor_codigo = ANY(p_vendedor)
      )
      AND (
          p_coordenador IS NULL
          OR EXISTS (
              SELECT 1 FROM public.data_hierarchy dh
              LEFT JOIN public.data_client_promoters dcp ON dcp.promoter_code = dh.cod_promotor
              WHERE (dh.nome_coord = ANY(p_coordenador) OR dh.cod_coord = ANY(p_coordenador))
                AND (
                    dcp.client_code = COALESCE(c.codigo_cliente, c.cod_cliente)
                    OR dh.cod_promotor = c.rca1
                    OR dh.cod_promotor = c.vendedor_codigo
                )
          )
      )
      AND (
          p_cocoordenador IS NULL
          OR EXISTS (
              SELECT 1 FROM public.data_hierarchy dh
              LEFT JOIN public.data_client_promoters dcp ON dcp.promoter_code = dh.cod_promotor
              WHERE (dh.nome_cocoord = ANY(p_cocoordenador) OR dh.cod_cocoord = ANY(p_cocoordenador))
                AND (
                    dcp.client_code = COALESCE(c.codigo_cliente, c.cod_cliente)
                    OR dh.cod_promotor = c.rca1
                    OR dh.cod_promotor = c.vendedor_codigo
                )
          )
      )
      AND (
          p_rede IS NULL 
          OR (array_position(p_rede, 'C/ REDE') IS NOT NULL AND (c.ramo IS NOT NULL AND c.ramo <> '' AND c.ramo <> 'N/A'))
          OR (array_position(p_rede, 'S/ REDE') IS NOT NULL AND (c.ramo IS NULL OR c.ramo = '' OR c.ramo = 'N/A'))
          OR (c.ramo = ANY(p_rede))
      )
      AND (
          p_search IS NULL 
          OR p_search = '' 
          OR t.cod_cliente::text ILIKE '%' || p_search || '%'
          OR c.nomecliente ILIKE '%' || p_search || '%'
          OR c.razaosocial ILIKE '%' || p_search || '%'
          OR c.fantasia ILIKE '%' || p_search || '%'
      );

    -- Agregação dos KPIs
    SELECT 
        COUNT(*),
        COALESCE(SUM(vl_receber), 0),
        COALESCE(SUM(CASE WHEN dt_vencimento < v_critical_date AND vl_receber > 0 THEN vl_receber ELSE 0 END), 0),
        COUNT(DISTINCT CASE WHEN dt_vencimento < v_critical_date AND vl_receber > 0 THEN cod_cliente END)
    INTO 
        v_total_rows,
        v_total_receber,
        v_critical_receber,
        v_critical_clients
    FROM temp_titulos_filtered;

    -- Linhas paginadas
    SELECT COALESCE(json_agg(r), '[]'::json) INTO v_rows
    FROM (
        SELECT 
            cod_cliente,
            vl_titulos,
            vl_receber,
            dt_vencimento,
            nomecliente,
            cidade,
            vendedor_nome,
            ramo
        FROM temp_titulos_filtered
        ORDER BY dt_vencimento ASC NULLS LAST, cod_cliente ASC
        OFFSET (p_page * p_limit)
        LIMIT p_limit
    ) r;

    -- Monta o JSON final de resposta
    v_result := json_build_object(
        'kpis', json_build_object(
            'total_rows', v_total_rows,
            'total_vl_receber', v_total_receber,
            'critical_vl_receber', v_critical_receber,
            'critical_clients', v_critical_clients
        ),
        'rows', v_rows
    );

    RETURN v_result;
END;
$$;

-- ==========================================
-- TABLE: public.data_metas_pesquisas
-- ==========================================
CREATE TABLE IF NOT EXISTS public.data_metas_pesquisas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filial TEXT,
    cod_supervisor TEXT,
    supervisor TEXT,
    cod_vendedor TEXT,
    vendedor TEXT,
    meta_pesquisas INTEGER,
    mes INTEGER,
    ano INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.data_metas_pesquisas ADD COLUMN IF NOT EXISTS cod_vendedor TEXT;
CREATE INDEX IF NOT EXISTS idx_data_metas_pesquisas_vendedor ON public.data_metas_pesquisas (cod_vendedor);
CREATE INDEX IF NOT EXISTS idx_data_metas_pesquisas_mes_ano ON public.data_metas_pesquisas (mes, ano);

ALTER TABLE public.data_metas_pesquisas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.data_metas_pesquisas;
CREATE POLICY "Enable read access for authenticated users" ON public.data_metas_pesquisas
    FOR SELECT TO authenticated USING (true);


-- ==========================================
-- TABLE: public.data_metas_loja_perfeita
-- ==========================================
CREATE TABLE IF NOT EXISTS public.data_metas_loja_perfeita (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filial TEXT,
    cod_vendedor TEXT,
    vendedor TEXT,
    meta_lojas INTEGER,
    meta_auditorias INTEGER,
    mes INTEGER,
    ano INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.data_metas_loja_perfeita ADD COLUMN IF NOT EXISTS cod_vendedor TEXT;
CREATE INDEX IF NOT EXISTS idx_data_metas_loja_perfeita_vendedor ON public.data_metas_loja_perfeita (cod_vendedor);
CREATE INDEX IF NOT EXISTS idx_data_metas_loja_perfeita_mes_ano ON public.data_metas_loja_perfeita (mes, ano);

ALTER TABLE public.data_metas_loja_perfeita ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.data_metas_loja_perfeita;
CREATE POLICY "Enable read access for authenticated users" ON public.data_metas_loja_perfeita
    FOR SELECT TO authenticated USING (true);

-- ==============================================================================
-- AUTOMATED STORAGE CLEANUP (30-day retention for visit photos)
-- ==============================================================================

-- 1. Enable pg_cron & pg_net extensions if available
CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA extensions;

-- 2. Function to invoke Edge Function 'cleanup-visit-images' via HTTP POST
CREATE OR REPLACE FUNCTION public.invoke_cleanup_visit_images()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text := 'https://dldsocponbjthqxhmttj.supabase.co/functions/v1/cleanup-visit-images';
  v_api_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZHNvY3BvbmJqdGhxeGhtdHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzgzMzgsImV4cCI6MjA4NTAxNDMzOH0.IGxUEd977uIdhWvMzjDM8ygfISB_Frcf_2air8e3aOs';
  v_payload jsonb := jsonb_build_object('days', 30);
  v_request_id int;
BEGIN
  SELECT net.http_post(
    url := v_url,
    body := v_payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_api_key
    )
  ) INTO v_request_id;

  RAISE NOTICE 'Scheduled cleanup invoked via pg_net. Request ID: %', v_request_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to trigger cleanup function: %', SQLERRM;
END;
$$;

-- 3. Schedule daily cron job at 03:00 AM UTC
-- Note: Run in Supabase SQL Editor if pg_cron is enabled in your project extensions.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedule existing job if present
    PERFORM cron.unschedule('daily-visit-images-cleanup');
    -- Schedule job for 03:00 AM daily
    PERFORM cron.schedule(
      'daily-visit-images-cleanup',
      '0 3 * * *',
      'SELECT public.invoke_cleanup_visit_images();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron schedule notice: %', SQLERRM;
END;
$$;

-- 4. Manual / Immediate Cleanup Query (Optional Direct SQL)
-- Can be executed directly to immediately clear photo keys in DB for visits older than 30 days
-- UPDATE public.visitas
-- SET respostas = respostas - 'fotos'
-- WHERE (data_visita < NOW() - INTERVAL '30 days' OR (data_visita IS NULL AND created_at < NOW() - INTERVAL '30 days'))
--   AND respostas ? 'fotos';


-- COMPARATIVO RPC - ETAPA 1 (2026-10-02)
-- Etapa 1: KPIs do Comparativo. Filtros de carteira ainda vêm do fluxo legado.
-- A lista de clientes é uma seleção, NÃO uma autorização; RLS continua aplicada.
-- Não executar o consolidado inteiro para instalar esta função.
CREATE OR REPLACE FUNCTION public.get_comparison_kpis_v1(p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = '' SET statement_timeout = '15s'
AS $fn$
DECLARE
  result jsonb;
  ref_date date := (p_filters->>'reference_date')::date;
  client_codes text[];
  suppliers text[];
  products text[];
  types text[];
  holidays text[];
  alt_mode boolean;
  total_days integer;
  passed_days integer;
  ratio numeric := 1;
  caller_role text;
  allowed_clients text[];
  is_admin boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_admin() OR public.is_approved()) THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  SELECT lower(btrim(role)) INTO caller_role FROM public.profiles WHERE id=auth.uid();
  is_admin := caller_role='adm';
  -- Carteira derivada da sessão. Os códigos enviados só restringem o resultado.
  SELECT array_agg(cp.client_code) INTO allowed_clients
  FROM public.data_client_promoters cp
  WHERE lower(btrim(cp.promoter_code))=caller_role OR EXISTS (
    SELECT 1 FROM public.data_hierarchy h
    WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code))
      AND caller_role IN (lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor)))
  );
  IF allowed_clients IS NULL AND EXISTS (
    SELECT 1 FROM public.data_hierarchy h WHERE caller_role IN
      (lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor)))) THEN
    allowed_clients := ARRAY[]::text[];
  END IF;
  IF jsonb_typeof(p_filters) <> 'object' OR ref_date IS NULL
     OR jsonb_typeof(p_filters->'client_codes') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'reference_date e client_codes são obrigatórios' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO client_codes FROM jsonb_array_elements_text(p_filters->'client_codes');
  SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO suppliers FROM jsonb_array_elements_text(coalesce(p_filters->'suppliers','[]'));
  SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO products FROM jsonb_array_elements_text(coalesce(p_filters->'products','[]'));
  SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO types FROM jsonb_array_elements_text(coalesce(p_filters->'types','[]'));
  SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO holidays FROM jsonb_array_elements_text(coalesce(p_filters->'holidays','[]'));
  alt_mode := cardinality(types)>0 AND NOT ('1'=ANY(types) OR '9'=ANY(types));
  SELECT count(*), greatest(count(*) FILTER(WHERE d::date<=ref_date),1)
  INTO total_days, passed_days
  FROM pg_catalog.generate_series(date_trunc('month',ref_date::timestamp), date_trunc('month',ref_date::timestamp)+interval '1 month - 1 day', interval '1 day') d
  WHERE extract(isodow FROM d) BETWEEN 1 AND 5 AND NOT (to_char(d,'YYYY-MM-DD')=ANY(holidays));
  IF coalesce((p_filters->>'tendency')::boolean,false) AND passed_days<total_days AND total_days>0 THEN
    ratio := total_days::numeric/passed_days;
  END IF;

  WITH selected_clients AS MATERIALIZED (
    SELECT DISTINCT unnest(client_codes) codcli
  ), client_info AS MATERIALIZED (
    SELECT codigo_cliente,cidade,ramo FROM public.data_clients
  ), product_info AS MATERIALIZED (
    SELECT codigo,descricao,
      (CASE WHEN upper(descricao) LIKE '%CHEETOS%' THEN 1 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%DORITOS%' THEN 2 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%FANDANGOS%' THEN 4 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%RUFFLES%' THEN 8 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%TORCIDA%' THEN 16 ELSE 0 END) salty_mask,
      (CASE WHEN upper(descricao) LIKE '%TODDYNHO%' THEN 1 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%TODDY %' THEN 2 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%QUAKER%' THEN 4 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%KEROCOCO%' THEN 8 ELSE 0 END) foods_mask
    FROM public.dim_produtos
  ), supplier_info AS MATERIALIZED (
    SELECT codigo,pasta,nome FROM public.dim_fornecedores
  ), filtered AS MATERIALIZED (
    SELECT r.source,r.codcli,r.produto,r.codfor,r.tipovenda,r.totpesoliq,c.ramo,
      CASE WHEN alt_mode THEN coalesce(r.vlbonific,0) ELSE coalesce(r.vlvenda,0) END amount,
      to_char(r.dtped AT TIME ZONE 'UTC','YYYY-MM') month_key,r.vlbonific
    FROM (
    SELECT 'current'::text source, codcli, produto, codfor, filial, tipovenda, dtped,
           vlvenda, vlbonific, totpesoliq, observacaofor FROM public.data_detailed
    WHERE codcli IN (SELECT codcli FROM selected_clients) AND (is_admin OR (allowed_clients IS NOT NULL AND codcli=ANY(allowed_clients))
      OR (allowed_clients IS NULL AND lower(btrim(codusur))=caller_role))
    UNION ALL
    SELECT 'history', codcli, produto, codfor, filial, tipovenda, dtped,
           vlvenda, vlbonific, totpesoliq, observacaofor FROM public.data_history
    WHERE codcli IN (SELECT codcli FROM selected_clients) AND (is_admin OR (allowed_clients IS NOT NULL AND codcli=ANY(allowed_clients))
      OR (allowed_clients IS NULL AND lower(btrim(codusur))=caller_role))
    ) r
    LEFT JOIN client_info c ON c.codigo_cliente=r.codcli
    LEFT JOIN product_info dp ON dp.codigo=r.produto
    LEFT JOIN supplier_info df ON df.codigo=r.codfor
    WHERE (coalesce(p_filters->>'filial','ambas')='ambas' OR r.filial=p_filters->>'filial')
      AND (coalesce(p_filters->>'city','')='' OR lower(coalesce(c.cidade,'N/A'))=p_filters->>'city')
      AND (coalesce(p_filters->>'pasta','')='' OR (CASE WHEN coalesce(r.observacaofor,'') NOT IN ('','0','00','N/A') THEN r.observacaofor WHEN coalesce(df.pasta,'')<>'' THEN df.pasta WHEN upper(coalesce(df.nome,r.codfor)) LIKE '%PEPSICO%' THEN 'PEPSICO' ELSE 'MULTIMARCAS' END)=p_filters->>'pasta')
      AND (cardinality(products)=0 OR r.produto=ANY(products))
      AND (cardinality(suppliers)=0 OR r.codfor=ANY(suppliers) OR
        (r.codfor='1119' AND (CASE
          WHEN upper(coalesce(nullif(dp.descricao,''),'Produto '||btrim(r.produto))) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO'
          WHEN upper(coalesce(nullif(dp.descricao,''),'Produto '||btrim(r.produto))) LIKE '%TODDY%' THEN '1119_TODDY'
          WHEN upper(coalesce(nullif(dp.descricao,''),'Produto '||btrim(r.produto))) LIKE '%QUAKER%' OR upper(coalesce(nullif(dp.descricao,''),'Produto '||btrim(r.produto))) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO'
          END)=ANY(suppliers)))
  ), sales AS MATERIALIZED (
    SELECT * FROM filtered
    WHERE (cardinality(types)=0 OR tipovenda=ANY(types)) AND (alt_mode OR tipovenda IN ('1','9'))
  ), totals AS (
    SELECT source,sum(amount) fat,sum(coalesce(totpesoliq,0)) peso FROM sales GROUP BY source
  ), losses AS (
    SELECT source,sum(coalesce(vlbonific,0)) perdas FROM filtered
    WHERE tipovenda='5' AND upper(coalesce(ramo,'')) NOT LIKE '%AMERICANAS%' AND upper(coalesce(ramo,'')) NOT LIKE '%BH%'
    GROUP BY source
  ), client_totals AS (
    SELECT source,CASE WHEN source='current' THEN '' ELSE month_key END m,codcli,sum(amount) amount
    FROM sales WHERE codcli IS NOT NULL AND codcli<>'' AND (source='current' OR month_key IS NOT NULL)
    GROUP BY 1,2,3
  ), client_counts AS (
    SELECT source,m,count(*) FILTER(WHERE amount>=1) clients FROM client_totals GROUP BY 1,2
  ), product_totals AS (
    SELECT source,CASE WHEN source='current' THEN '' ELSE month_key END m,codcli,produto,
      min(codfor) codfor,sum(amount) amount
    FROM sales WHERE codcli IS NOT NULL AND codcli<>'' AND (source='current' OR month_key IS NOT NULL)
    GROUP BY 1,2,3,4
  ), mixes AS (
    SELECT source,m,codcli,
      count(*) FILTER(WHERE amount>=1 AND codfor IN ('707','708','752')) mix,
      bit_or(CASE WHEN amount>=1 THEN coalesce(pi.salty_mask,0) ELSE 0 END)=31 salty,
      bit_or(CASE WHEN amount>=1 THEN coalesce(pi.foods_mask,0) ELSE 0 END)=15 foods
    FROM product_totals pt LEFT JOIN product_info pi ON pi.codigo=pt.produto GROUP BY source,m,codcli
  ), month_mix AS (
    SELECT source,m,coalesce(avg(mix) FILTER(WHERE mix>0),0) mix,
      count(*) FILTER(WHERE salty) salty,count(*) FILTER(WHERE foods) foods FROM mixes GROUP BY 1,2
  ), latest AS (
    SELECT month_key FROM sales WHERE source='history' AND month_key IS NOT NULL GROUP BY month_key ORDER BY month_key DESC LIMIT 3
  ), kpis AS (
    SELECT 'current' source,
      coalesce((SELECT clients FROM client_counts WHERE source='current'),0)::numeric clients,
      coalesce((SELECT mix FROM month_mix WHERE source='current'),0) mix,
      coalesce((SELECT salty FROM month_mix WHERE source='current'),0)::numeric salty,
      coalesce((SELECT foods FROM month_mix WHERE source='current'),0)::numeric foods
    UNION ALL
    SELECT 'history',
      coalesce((SELECT sum(clients) FROM client_counts WHERE source='history' AND m IN(SELECT month_key FROM latest)),0)/3.0,
      coalesce((SELECT sum(mix) FROM month_mix WHERE source='history' AND m IN(SELECT month_key FROM latest)),0)/3.0,
      coalesce((SELECT sum(salty) FROM month_mix WHERE source='history' AND m IN(SELECT month_key FROM latest)),0)/3.0,
      coalesce((SELECT sum(foods) FROM month_mix WHERE source='history' AND m IN(SELECT month_key FROM latest)),0)/3.0
  ), final AS (
    SELECT k.source,coalesce(t.fat,0)/CASE WHEN k.source='current' THEN 1 ELSE 3.0 END*CASE WHEN k.source='current' THEN ratio ELSE 1 END fat,
      coalesce(t.peso,0)/CASE WHEN k.source='current' THEN 1 ELSE 3.0 END*CASE WHEN k.source='current' THEN ratio ELSE 1 END peso,
      CASE WHEN k.source='current' AND ratio<>1 THEN floor(k.clients*ratio+0.5) ELSE k.clients END clients,
      k.mix,
      CASE WHEN k.source='current' AND ratio<>1 THEN floor(k.salty*ratio+0.5) ELSE k.salty END salty,
      CASE WHEN k.source='current' AND ratio<>1 THEN floor(k.foods*ratio+0.5) ELSE k.foods END foods,
      coalesce(l.perdas,0)/CASE WHEN k.source='current' THEN 1 ELSE 3.0 END*CASE WHEN k.source='current' THEN ratio ELSE 1 END perdas
    FROM kpis k LEFT JOIN totals t USING(source) LEFT JOIN losses l USING(source)
  )
  SELECT jsonb_build_object('schema_version',1,'reference_date',ref_date,'tendency_ratio',ratio,
    'kpis',jsonb_object_agg(source,jsonb_build_object('fat',fat,'peso',peso,'clients',clients,'mixPepsico',mix,
      'positivacaoSalty',salty,'positivacaoFoods',foods,'perdas',perdas,'ticket',CASE WHEN clients>0 THEN fat/clients ELSE 0 END)))
  INTO result FROM final;
  RETURN result;
END;
$fn$;
REVOKE ALL ON FUNCTION public.get_comparison_kpis_v1(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_comparison_kpis_v1(jsonb) TO authenticated;

-- Mesma condição de acesso, avaliada uma vez por consulta (InitPlan).
-- Mantém os papéis e todas as políticas de escrita existentes.
ALTER POLICY "Acesso Leitura Unificado" ON public.data_history USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.data_detailed USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.data_clients USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.dim_produtos USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.dim_fornecedores USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.data_hierarchy USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.data_client_promoters USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));

-- Cobertura e Semanal: dados, cálculos e opções de filtros no PostgreSQL.
-- Helpers ficam fora do schema exposto pela API; todos preservam RLS.
CREATE SCHEMA IF NOT EXISTS dashboard_private;
REVOKE ALL ON SCHEMA dashboard_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA dashboard_private TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.scope_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $$
DECLARE r text; kind text; sellers text[]; clients text[]; ghosts text[];
BEGIN
 IF auth.uid() IS NULL OR NOT(public.is_admin() OR public.is_approved()) THEN
  RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501';
 END IF;
 SELECT lower(btrim(role)) INTO r FROM public.profiles WHERE id=auth.uid();
 IF r='adm' THEN RETURN jsonb_build_object('kind','admin'); END IF;
 -- Trade: carteira atribuída, inclusive coordenadores com carteira vazia.
 IF EXISTS(SELECT 1 FROM public.data_hierarchy h WHERE r IN(lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor))))
 OR EXISTS(SELECT 1 FROM public.data_client_promoters WHERE lower(btrim(promoter_code))=r) THEN
  kind:='trade';
  SELECT array_agg(cp.client_code) INTO clients FROM public.data_client_promoters cp
  WHERE lower(btrim(cp.promoter_code))=r OR EXISTS(SELECT 1 FROM public.data_hierarchy h
   WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code)) AND r IN(lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor))));
 ELSE
  SELECT array_agg(DISTINCT codusur) INTO sellers FROM (
   SELECT codusur FROM public.data_detailed WHERE lower(btrim(codsupervisor))=r
   UNION ALL SELECT codusur FROM public.data_history WHERE lower(btrim(codsupervisor))=r) s;
  kind:=CASE WHEN sellers IS NULL THEN 'seller' ELSE 'supervisor' END;
  SELECT array_agg(codigo_cliente) INTO clients FROM public.data_clients
  WHERE (kind='seller' AND lower(btrim(rca1))=r) OR (kind='supervisor' AND rca1=ANY(sellers))
   OR (r='1001' AND upper(coalesce(razaosocial,nomecliente,'')) LIKE '%AMERICANAS%');
  -- Mesmo complemento da carteira legado: clientes com venda atual do vendedor/supervisor.
  SELECT array_agg(DISTINCT codcli) INTO ghosts FROM public.data_detailed
  WHERE (kind='seller' AND lower(btrim(codusur))=r) OR (kind='supervisor' AND lower(btrim(codsupervisor))=r);
 END IF;
 RETURN jsonb_build_object('kind',kind,'clients',coalesce(clients,ARRAY[]::text[]),'ghosts',coalesce(ghosts,ARRAY[]::text[]));
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.clients_v1(s jsonb)
RETURNS TABLE(code text,rca text,city text,rede text,coord text,coord_name text,cocoord text,cocoord_name text,promotor text,promotor_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT c.codigo_cliente,CASE WHEN upper(coalesce(c.razaosocial,c.nomecliente,'')) LIKE '%AMERICANAS%' THEN '1001' ELSE c.rca1 END,
 coalesce(nullif(c.cidade,''),'N/A'),coalesce(nullif(c.ramo,''),'N/A'),h.cod_coord,h.nome_coord,h.cod_cocoord,h.nome_cocoord,cp.promoter_code,coalesce(h.nome_promotor,cp.promoter_code)
 FROM public.data_clients c
 LEFT JOIN public.data_client_promoters cp ON cp.client_code=c.codigo_cliente
 LEFT JOIN LATERAL (SELECT * FROM public.data_hierarchy h WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code)) ORDER BY h.id LIMIT 1) h ON true
 WHERE s->>'kind'='admin' OR c.codigo_cliente IN(SELECT jsonb_array_elements_text(s->'clients'))
 OR c.codigo_cliente IN(SELECT jsonb_array_elements_text(s->'ghosts'));
$$;

CREATE OR REPLACE FUNCTION dashboard_private.matches_v1(f jsonb,k text,v text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(jsonb_array_length(f->k),0)=0 OR coalesce(f->k ? v,false);
$$;
CREATE OR REPLACE FUNCTION dashboard_private.rede_v1(f jsonb,v text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(v,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? v,false))
 WHEN 'sem_rede' THEN coalesce(v,'N/A') IN('','N/A') ELSE true END;
$$;

CREATE OR REPLACE FUNCTION dashboard_private.assignments_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 raw AS MATERIALIZED(
 SELECT 'current'::text source,codcli,coalesce(nullif(c.rca,''),codusur) seller,codsupervisor,filial,dtped FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))
 UNION ALL SELECT 'history',codcli,coalesce(nullif(c.rca,''),codusur),codsupervisor,filial,dtped FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients'))),
 branch AS MATERIALIZED(SELECT DISTINCT ON(codcli) codcli,seller,filial,codsupervisor,dtped,source FROM raw ORDER BY codcli,source,dtped DESC NULLS LAST,filial),
 sup AS(SELECT DISTINCT ON(seller) seller,codsupervisor FROM branch ORDER BY seller,dtped DESC NULLS LAST,source,codsupervisor)
 SELECT coalesce(c.code,b.codcli),coalesce(nullif(c.rca,''),b.seller),sup.codsupervisor,coalesce(ds.nome,sup.codsupervisor,'N/A'),b.filial
 FROM clients c FULL JOIN branch b ON b.codcli=c.code LEFT JOIN sup ON sup.seller=coalesce(nullif(c.rca,''),b.seller)
 LEFT JOIN public.dim_supervisores ds ON ds.codigo=sup.codsupervisor;
$$;

CREATE OR REPLACE FUNCTION dashboard_private.rows_v1(s jsonb,f jsonb DEFAULT '{}'::jsonb,purpose text DEFAULT 'all')
RETURNS TABLE(source text,client text,product text,supplier text,virtual_supplier text,seller text,seller_name text,supervisor text,supervisor_name text,filial text,sale_type text,day date,amount numeric,bonus numeric,units numeric,boxes numeric,description text,registered date,city text,rede text,coord text,coord_name text,cocoord text,cocoord_name text,promotor text,promotor_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 products AS MATERIALIZED(SELECT * FROM public.dim_produtos), details AS MATERIALIZED(SELECT * FROM public.data_product_details),
 vendors AS MATERIALIZED(SELECT * FROM public.dim_vendedores), supervisors AS MATERIALIZED(SELECT * FROM public.dim_supervisores), raw AS MATERIALIZED(
 SELECT 'current'::text source,d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date AS day,coalesce(d.vlvenda,0) amount,coalesce(d.vlbonific,0) bonus,coalesce(d.qtvenda,0) units
 FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (purpose<>'weekly' OR coalesce(f->>'month','current')='current')
 UNION ALL
 SELECT 'history',d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date,coalesce(d.vlvenda,0),coalesce(d.vlbonific,0),coalesce(d.qtvenda,0)
 FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (purpose<>'weekly' OR ((d.dtped AT TIME ZONE 'UTC')::date >= (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date END)-interval '1 month' AND (d.dtped AT TIME ZONE 'UTC')::date < (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date+interval '1 month' END)))
 ), assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s))
 SELECT r.source,r.codcli,r.produto,r.codfor,CASE WHEN r.codfor='1119' THEN CASE
 WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY'
 WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END,
 coalesce(nullif(c.rca,''),r.codusur),coalesce(v.nome,coalesce(nullif(c.rca,''),r.codusur),'N/A'),
 coalesce(ss.supervisor,r.codsupervisor),coalesce(ds.nome,ss.supervisor,r.codsupervisor,'N/A'),r.filial,r.tipovenda,r.day,r.amount,r.bonus,r.units,
 r.units/CASE WHEN p.qtde_master>0 THEN p.qtde_master ELSE 1 END,
 coalesce(nullif(p.descricao,''),'Produto '||r.produto),(pd.dtcadastro AT TIME ZONE 'UTC')::date,
 coalesce(c.city,'N/A'),coalesce(c.rede,'N/A'),c.coord,c.coord_name,c.cocoord,c.cocoord_name,c.promotor,c.promotor_name
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli
 LEFT JOIN products p ON p.codigo=r.produto
 LEFT JOIN details pd ON pd.code=r.produto
 LEFT JOIN assignments ss ON ss.client=r.codcli
 LEFT JOIN vendors v ON v.codigo=coalesce(nullif(c.rca,''),r.codusur)
 LEFT JOIN supervisors ds ON ds.codigo=coalesce(ss.supervisor,r.codsupervisor);
$$;

-- Page-local planner settings avoid JIT startup and merge joins caused by opaque helper cardinality.
-- Settings restore automatically on function exit; authorization/RLS remain unchanged.
-- As opções são pequenas projeções; nunca retornam linhas de vendas ao navegador.
CREATE OR REPLACE FUNCTION public.get_dashboard_filters_v1(p_page text,p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb; f jsonb:=p_filters;
BEGIN
 IF p_page NOT IN('coverage','weekly') OR jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Página ou filtros inválidos' USING ERRCODE='22023'; END IF;
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 raw AS MATERIALIZED(
 SELECT 'current'::text source,codcli,produto,codfor,filial,tipovenda,(dtped AT TIME ZONE 'UTC')::date AS day FROM public.data_detailed
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))
 UNION ALL SELECT 'history',codcli,produto,codfor,filial,tipovenda,(dtped AT TIME ZONE 'UTC')::date FROM public.data_history
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients'))),
 rows AS MATERIALIZED(SELECT r.source,r.day,r.filial,r.tipovenda sale_type,r.produto product,r.codfor supplier,
 coalesce(p.descricao,'Produto '||r.produto) description,
 CASE WHEN r.codfor='1119' THEN CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END virtual_supplier,
 a.seller,coalesce(v.nome,a.seller,'N/A') seller_name,a.supervisor_name,c.city,c.rede,c.coord,c.cocoord,c.promotor
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli LEFT JOIN assignments a ON a.client=r.codcli
 LEFT JOIN public.dim_produtos p ON p.codigo=r.produto LEFT JOIN public.dim_vendedores v ON v.codigo=a.seller),
 scope AS MATERIALIZED(SELECT * FROM rows WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false)))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? seller,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? rede,false)) WHEN 'sem_rede' THEN coalesce(rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR filial=f->>'filial')
 AND (coalesce(f->>'city','')='' OR lower(city)=lower(f->>'city'))),
 supplier_options AS (SELECT DISTINCT supplier code,coalesce(df.nome,supplier) label FROM scope LEFT JOIN public.dim_fornecedores df ON df.codigo=scope.supplier
 UNION SELECT DISTINCT virtual_supplier,CASE virtual_supplier WHEN '1119_TODDYNHO' THEN 'TODDYNHO' WHEN '1119_TODDY' THEN 'TODDY' ELSE 'QUAKER / KEROCOCO' END FROM scope WHERE virtual_supplier IS NOT NULL),
 products AS (SELECT DISTINCT product code,'('||product||') '||description label FROM scope WHERE (coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false)),
 sellers AS(SELECT DISTINCT seller code,seller_name label,supervisor_name supervisor FROM rows
 WHERE (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))),
 hierarchy AS(SELECT * FROM clients), months AS(SELECT DISTINCT to_char(day,'YYYY-MM') code FROM raw WHERE day IS NOT NULL)
 SELECT jsonb_build_object('schema_version',1,'reference_date',coalesce((SELECT max(day) FROM rows WHERE source='current'),(SELECT max(day) FROM rows),current_date),
 'suppliers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM supplier_options t),'[]'),
 'products',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM products t),'[]'),
 'types',coalesce((SELECT jsonb_agg(jsonb_build_object('code',sale_type,'label',sale_type) ORDER BY sale_type) FROM (SELECT DISTINCT sale_type FROM scope WHERE sale_type IS NOT NULL)t),'[]'),
 'sellers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM sellers t),'[]'),
 'supervisors',coalesce((SELECT jsonb_agg(jsonb_build_object('code',label,'label',label) ORDER BY label) FROM(SELECT DISTINCT supervisor_name label FROM rows)t),'[]'),
 'coords',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT coord code,coalesce(coord_name,coord) label FROM hierarchy WHERE coord IS NOT NULL)t),'[]'),
 'cocoords',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT cocoord code,coalesce(cocoord_name,cocoord) label FROM hierarchy WHERE cocoord IS NOT NULL AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)))t),'[]'),
 'promotors',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT promotor code,coalesce(promotor_name,promotor) label FROM hierarchy WHERE promotor IS NOT NULL AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)))t),'[]'),
 'cities',coalesce((SELECT jsonb_agg(city ORDER BY city) FROM(SELECT DISTINCT city FROM clients)t),'[]'),
 'redes',coalesce((SELECT jsonb_agg(jsonb_build_object('code',rede,'label',rede) ORDER BY rede) FROM(SELECT DISTINCT rede FROM clients WHERE rede NOT IN('','N/A'))t),'[]'),
 'months',coalesce((SELECT jsonb_agg(code ORDER BY code DESC) FROM months),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.get_weekly_page_v1(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); f jsonb:=p_filters; ref date; target date; result jsonb;
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce((SELECT max((dtped AT TIME ZONE 'UTC')::date) FROM public.data_detailed),(SELECT max((dtped AT TIME ZONE 'UTC')::date) FROM public.data_history),current_date) INTO ref;
 target:=CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',ref)::date ELSE ((f->>'month')||'-01')::date END;
 WITH rows AS NOT MATERIALIZED(SELECT source,client,day,amount,supplier,virtual_supplier,seller,seller_name,supervisor_name,filial,rede,coord,cocoord,promotor,promotor_name FROM (
WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 products AS MATERIALIZED(SELECT * FROM public.dim_produtos), details AS MATERIALIZED(SELECT * FROM public.data_product_details),
 vendors AS MATERIALIZED(SELECT * FROM public.dim_vendedores), supervisors AS MATERIALIZED(SELECT * FROM public.dim_supervisores), raw AS MATERIALIZED(
 SELECT 'current'::text source,d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date AS day,coalesce(d.vlvenda,0) amount,coalesce(d.vlbonific,0) bonus,coalesce(d.qtvenda,0) units
 FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))
 AND ('weekly'<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND ('weekly'<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND ('weekly'<>'weekly' OR coalesce(f->>'month','current')='current')
 UNION ALL
 SELECT 'history',d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date,coalesce(d.vlvenda,0),coalesce(d.vlbonific,0),coalesce(d.qtvenda,0)
 FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')))
 AND ('weekly'<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND ('weekly'<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND ('weekly'<>'weekly' OR ((d.dtped AT TIME ZONE 'UTC')::date >= (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date END)-interval '1 month' AND (d.dtped AT TIME ZONE 'UTC')::date < (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date+interval '1 month' END)))
 ), assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s))
 SELECT r.source,r.codcli,r.produto,r.codfor,CASE WHEN r.codfor='1119' THEN CASE
 WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY'
 WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END,
 coalesce(nullif(c.rca,''),r.codusur),coalesce(v.nome,coalesce(nullif(c.rca,''),r.codusur),'N/A'),
 coalesce(ss.supervisor,r.codsupervisor),coalesce(ds.nome,ss.supervisor,r.codsupervisor,'N/A'),r.filial,r.tipovenda,r.day,r.amount,r.bonus,r.units,
 r.units/CASE WHEN p.qtde_master>0 THEN p.qtde_master ELSE 1 END,
 coalesce(nullif(p.descricao,''),'Produto '||r.produto),(pd.dtcadastro AT TIME ZONE 'UTC')::date,
 coalesce(c.city,'N/A'),coalesce(c.rede,'N/A'),c.coord,c.coord_name,c.cocoord,c.cocoord_name,c.promotor,c.promotor_name
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli
 LEFT JOIN products p ON p.codigo=r.produto
 LEFT JOIN details pd ON pd.code=r.produto
 LEFT JOIN assignments ss ON ss.client=r.codcli
 LEFT JOIN vendors v ON v.codigo=coalesce(nullif(c.rca,''),r.codusur)
 LEFT JOIN supervisors ds ON ds.codigo=coalesce(ss.supervisor,r.codsupervisor)
) page_rows(source,client,product,supplier,virtual_supplier,seller,seller_name,supervisor,supervisor_name,filial,sale_type,day,amount,bonus,units,boxes,description,registered,city,rede,coord,coord_name,cocoord,cocoord_name,promotor,promotor_name)),
 filtered AS MATERIALIZED(SELECT * FROM rows WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false)))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? seller,false))
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? rede,false)) WHEN 'sem_rede' THEN coalesce(rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR filial=f->>'filial')),
 selected AS MATERIALIZED(SELECT * FROM filtered WHERE
 (coalesce(f->>'month','current')='current' AND source='current') OR (coalesce(f->>'month','current')<>'current' AND source='history' AND day>=target AND day<target+interval '1 month')),
 first_day AS(SELECT target+CASE extract(isodow FROM target)::int WHEN 6 THEN 2 WHEN 7 THEN 1 ELSE 0 END first),
 week_starts AS(SELECT first start FROM first_day UNION SELECT d::date FROM first_day,generate_series(date_trunc('week',first::timestamp)+interval '7 days',target::timestamp+interval '1 month - 1 day',interval '7 days') d),
 weeks AS(SELECT row_number() OVER(ORDER BY start) id,start,least((date_trunc('week',start::timestamp)+interval '6 days')::date,(target+interval '1 month - 1 day')::date) finish FROM week_starts),
 daily AS(SELECT w.id,extract(dow FROM s.day)::int weekday,sum(s.amount) amount FROM weeks w JOIN selected s ON s.day BETWEEN w.start AND w.finish GROUP BY 1,2),
 week_data AS(SELECT w.id,w.start,w.finish "end",coalesce((SELECT sum(amount) FROM daily d WHERE d.id=w.id),0) total,
 (SELECT jsonb_agg(coalesce(d.amount,0) ORDER BY wd) FROM generate_series(0,6) wd LEFT JOIN daily d ON d.id=w.id AND d.weekday=wd) days FROM weeks w),
 best_daily AS(SELECT day,sum(amount) amount FROM filtered WHERE source='history' AND day>=target-interval '1 month' AND day<target GROUP BY day),
 best AS(SELECT extract(dow FROM day)::int wd,greatest(max(amount),0) amount FROM best_daily GROUP BY 1),
 ranks AS(SELECT CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(promotor,'Sem Promotor') ELSE coalesce(seller,'N/A') END code,
 CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(promotor_name,'Sem Promotor') ELSE coalesce(seller_name,seller,'N/A') END name,
 sum(amount) val,count(DISTINCT client) pos FROM selected GROUP BY 1,2)
 SELECT jsonb_build_object('schema_version',1,'reference_date',ref,'target_month',to_char(target,'YYYY-MM'),
 'weeks',coalesce((SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM week_data w),'[]'),
 'best_days',(SELECT jsonb_agg(coalesce(b.amount,0) ORDER BY wd) FROM generate_series(0,6) wd LEFT JOIN best b USING(wd)),
 'ranking_fat',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY val DESC,code) FROM(SELECT * FROM ranks ORDER BY val DESC,code LIMIT 10)t),'[]'),
 'ranking_pos',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY pos DESC,val DESC,code) FROM(SELECT * FROM ranks ORDER BY pos DESC,val DESC,code LIMIT 10)t),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.get_coverage_page_v1(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); f jsonb:=p_filters; ref date; start_date date; end_date date; prev_start date; prev_end date;
 custom_date boolean; alt boolean; result jsonb; days integer:=greatest(coalesce((f->>'working_days')::int,0),0);
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce((SELECT max((dtped AT TIME ZONE 'UTC')::date) FROM public.data_detailed),(SELECT max((dtped AT TIME ZONE 'UTC')::date) FROM public.data_history),current_date) INTO ref;
 custom_date:=nullif(f->>'date_start','') IS NOT NULL AND nullif(f->>'date_end','') IS NOT NULL;
 start_date:=CASE WHEN custom_date THEN (f->>'date_start')::date ELSE date_trunc('month',ref)::date END;
 end_date:=CASE WHEN custom_date THEN (f->>'date_end')::date ELSE (start_date+interval '1 month - 1 day')::date END;
 IF end_date<start_date THEN RAISE EXCEPTION 'Período inválido' USING ERRCODE='22023'; END IF;
 prev_start:=(start_date-interval '1 month')::date; prev_end:=(end_date-interval '1 month')::date;
 IF NOT custom_date THEN prev_end:=start_date-1; END IF;
 alt:=coalesce(jsonb_array_length(f->'types'),0)>0 AND NOT(coalesce(f->'types' ? '1',false) OR coalesce(f->'types' ? '9',false));
 WITH rows AS NOT MATERIALIZED(SELECT source,client,product,supplier,virtual_supplier,filial,sale_type,day,amount,bonus,units,boxes,description,registered,city,rede,coord,cocoord,promotor,promotor_name,seller_name FROM (
WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 products AS MATERIALIZED(SELECT * FROM public.dim_produtos), details AS MATERIALIZED(SELECT * FROM public.data_product_details),
 vendors AS MATERIALIZED(SELECT * FROM public.dim_vendedores), supervisors AS MATERIALIZED(SELECT * FROM public.dim_supervisores), raw AS MATERIALIZED(
 SELECT 'current'::text source,d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date AS day,coalesce(d.vlvenda,0) amount,coalesce(d.vlbonific,0) bonus,coalesce(d.qtvenda,0) units
 FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))
 AND ('coverage'<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND ('coverage'<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND ('coverage'<>'weekly' OR coalesce(f->>'month','current')='current')
 UNION ALL
 SELECT 'history',d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date,coalesce(d.vlvenda,0),coalesce(d.vlbonific,0),coalesce(d.qtvenda,0)
 FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')))
 AND ('coverage'<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND ('coverage'<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND ('coverage'<>'weekly' OR ((d.dtped AT TIME ZONE 'UTC')::date >= (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date END)-interval '1 month' AND (d.dtped AT TIME ZONE 'UTC')::date < (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date+interval '1 month' END)))
 )
 SELECT r.source,r.codcli,r.produto,r.codfor,CASE WHEN r.codfor='1119' THEN CASE
 WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY'
 WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END,
 coalesce(nullif(c.rca,''),r.codusur),coalesce(v.nome,coalesce(nullif(c.rca,''),r.codusur),'N/A'),
 r.codsupervisor,coalesce(r.codsupervisor,'N/A'),r.filial,r.tipovenda,r.day,r.amount,r.bonus,r.units,
 r.units/CASE WHEN p.qtde_master>0 THEN p.qtde_master ELSE 1 END,
 coalesce(nullif(p.descricao,''),'Produto '||r.produto),(pd.dtcadastro AT TIME ZONE 'UTC')::date,
 coalesce(c.city,'N/A'),coalesce(c.rede,'N/A'),c.coord,c.coord_name,c.cocoord,c.cocoord_name,c.promotor,c.promotor_name
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli
 LEFT JOIN products p ON p.codigo=r.produto
 LEFT JOIN details pd ON pd.code=r.produto
 LEFT JOIN vendors v ON v.codigo=coalesce(nullif(c.rca,''),r.codusur)
) page_rows(source,client,product,supplier,virtual_supplier,seller,seller_name,supervisor,supervisor_name,filial,sale_type,day,amount,bonus,units,boxes,description,registered,city,rede,coord,coord_name,cocoord,cocoord_name,promotor,promotor_name)), clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 seller_sup AS(SELECT DISTINCT seller,supervisor_name FROM assignments),
 branches AS(SELECT client,filial FROM assignments),
 base_clients AS MATERIALIZED(SELECT c.* FROM clients c WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR EXISTS(SELECT 1 FROM seller_sup ss WHERE ss.seller=c.rca AND (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? ss.supervisor_name,false))) OR coalesce(jsonb_array_length(f->'supervisors'),0)=0)
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? c.rca,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR EXISTS(SELECT 1 FROM branches b WHERE b.client=c.code AND b.filial=f->>'filial'))),
 scoped AS MATERIALIZED(SELECT source,client,product,day,description,registered,city,promotor_name,seller_name,amount,units,boxes,CASE WHEN alt THEN bonus ELSE amount END value FROM rows r
 WHERE client IN(SELECT code FROM base_clients)
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? product,false)) AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? sale_type,false))),
 filtered AS NOT MATERIALIZED(SELECT source,client,product,day,description,registered,city,promotor_name,seller_name,boxes,value FROM scoped WHERE (f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR
 (units<>0 AND (f->>'price_min' IS NULL OR amount/units>=(f->>'price_min')::numeric) AND(f->>'price_max' IS NULL OR amount/units<=(f->>'price_max')::numeric))),
 periods AS MATERIALIZED(
 SELECT r.*,'current'::text period FROM filtered r WHERE (custom_date AND day BETWEEN start_date AND end_date) OR(NOT custom_date AND source='current')
 UNION ALL SELECT r.*,'previous' FROM filtered r WHERE (custom_date AND day BETWEEN prev_start AND prev_end) OR(NOT custom_date AND source='history' AND day BETWEEN prev_start AND prev_end)
 UNION ALL SELECT source,NULL::text,product,day,description,registered,NULL::text,NULL::text,NULL::text,sum(boxes),sum(value),'history'
 FROM filtered WHERE NOT custom_date AND source='history' AND day NOT BETWEEN prev_start AND prev_end
 GROUP BY source,product,day,description,registered),
 product_clients AS(SELECT product,client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2,3),
 product_counts AS(SELECT product,count(*) FILTER(WHERE period='current' AND value>=1) current_count,count(*) FILTER(WHERE period='previous' AND value>=1) previous_count FROM product_clients GROUP BY product),
 selection AS(SELECT client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2),
 active_history AS(SELECT client FROM scoped WHERE source='history' GROUP BY client HAVING sum(amount)>=1),
 working AS MATERIALIZED(SELECT DISTINCT day FROM (SELECT (dtped AT TIME ZONE 'UTC')::date AS day FROM public.data_detailed WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')) UNION ALL SELECT (dtped AT TIME ZONE 'UTC')::date FROM public.data_history WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients'))) wd WHERE extract(isodow FROM day) BETWEEN 1 AND 5),
 working_array AS(SELECT array_agg(day ORDER BY day) dates FROM working),
 stats AS MATERIALIZED(SELECT product,min(description) description,min(registered) registered,
 coalesce(sum(boxes) FILTER(WHERE period='current'),0) current_boxes,coalesce(sum(boxes) FILTER(WHERE period='previous'),0) previous_boxes,
 bool_or(day<date_trunc('month',ref)::date) has_history FROM periods GROUP BY product),
 stock AS(SELECT product_code,sum(coalesce(stock_qty,0)) qty FROM public.data_stock WHERE coalesce(f->>'filial','ambas') IN('ambas','all') OR filial=f->>'filial' GROUP BY product_code),
 divisors AS MATERIALIZED(SELECT t.*,coalesce(st.qty,0) stock,coalesce(pc.current_count,0) current_count,coalesce(pc.previous_count,0) previous_count,
 greatest(1,CASE WHEN NOT coalesce(has_history,false) AND current_boxes>0 THEN least(
 greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1),
 CASE WHEN days>0 THEN days ELSE greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1) END)
 ELSE CASE WHEN days>0 THEN least(days,(SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered)) ELSE (SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered) END END)::numeric divisor
 FROM stats t LEFT JOIN stock st ON st.product_code=t.product LEFT JOIN product_counts pc USING(product)),
 -- Aggregate once per product/day, then join the small result to each divisor.
 -- UNION ALL period duplicates remain meaningful for overlapping custom ranges.
 product_days AS MATERIALIZED(SELECT product,day,sum(boxes) boxes FROM periods GROUP BY product,day),
 trend_totals AS MATERIALIZED(SELECT d.product,coalesce(sum(p.boxes),0)/d.divisor daily_avg
 FROM divisors d CROSS JOIN working_array w LEFT JOIN product_days p ON p.product=d.product
 AND p.day BETWEEN w.dates[greatest(1,cardinality(w.dates)-d.divisor::int+1)] AND w.dates[cardinality(w.dates)]
 GROUP BY d.product,d.divisor),
 trend AS(SELECT d.*,t.daily_avg FROM divisors d JOIN trend_totals t USING(product)),
 table_all AS MATERIALIZED(SELECT product code,'('||product||') '||description descricao,stock "stockQty",current_boxes "boxesSoldCurrentMonth",previous_boxes "boxesSoldPreviousMonth",
 CASE WHEN previous_boxes>0 THEN (current_boxes-previous_boxes)/previous_boxes*100 WHEN current_boxes>0 THEN NULL ELSE 0 END "boxesVariation",
 CASE WHEN previous_count>0 THEN (current_count-previous_count)::numeric/previous_count*100 WHEN current_count>0 THEN NULL ELSE 0 END "pdvVariation",
 CASE WHEN daily_avg>0 THEN stock/daily_avg WHEN stock>0 THEN NULL ELSE 0 END "trendDays",previous_count "clientsPreviousCount",current_count "clientsCurrentCount",
 CASE WHEN (SELECT count(*) FROM base_clients)>0 THEN current_count::numeric/(SELECT count(*) FROM base_clients)*100 ELSE 0 END "coverageCurrent" FROM trend),
 table_filtered AS MATERIALIZED(SELECT * FROM table_all WHERE "boxesSoldCurrentMonth">0 AND CASE coalesce(f->>'trend','all') WHEN 'low' THEN "trendDays"<15 WHEN 'medium' THEN "trendDays">=15 AND "trendDays"<30 WHEN 'good' THEN "trendDays">=30 ELSE true END),
 cities AS(SELECT city name,sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN boxes ELSE value END) value FROM periods WHERE period='current' GROUP BY city),
 ranking AS(SELECT CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(promotor_name,'N/A') ELSE seller_name END name,sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN boxes ELSE value END) value FROM periods WHERE period='current' GROUP BY 1),
 top_product AS(SELECT * FROM table_all WHERE "coverageCurrent">0 ORDER BY "coverageCurrent" DESC,code LIMIT 1)
 SELECT jsonb_build_object('schema_version',1,'reference_date',ref,'active_clients',(SELECT count(*) FROM base_clients),'active_3m',(SELECT count(*) FROM active_history),
 'current_clients',(SELECT count(*) FROM selection WHERE period='current' AND value>=1),'previous_clients',(SELECT count(*) FROM selection WHERE period='previous' AND value>=1),
 'top',coalesce((SELECT to_jsonb(t) FROM top_product t),'null'),
 'rows',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY "stockQty" DESC,code) FROM table_filtered t),'[]'),
 'total_boxes',coalesce((SELECT sum("boxesSoldCurrentMonth") FROM table_filtered),0),
 'chart_total',coalesce((SELECT sum(value) FROM cities),0),
 'cities',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY value DESC,name) FROM(SELECT * FROM cities ORDER BY value DESC,name LIMIT 10)t),'[]'),
 'ranking',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY value DESC,name) FROM(SELECT * FROM ranking ORDER BY value DESC,name LIMIT 10)t),'[]')) INTO result;
 RETURN result;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dashboard_private FROM PUBLIC,anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dashboard_private TO authenticated;
REVOKE ALL ON FUNCTION public.get_dashboard_filters_v1(text,jsonb),public.get_coverage_page_v1(jsonb),public.get_weekly_page_v1(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_filters_v1(text,jsonb),public.get_coverage_page_v1(jsonb),public.get_weekly_page_v1(jsonb) TO authenticated;

-- Mesma autorização de leitura, avaliada uma vez por consulta.
ALTER POLICY "Acesso Leitura Unificado" ON public.data_product_details USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.data_stock USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.dim_vendedores USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.dim_supervisores USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
NOTIFY pgrst,'reload schema';

-- RESUMOS COMPARTILHADOS - 02/10/2026
-- Resumos compartilhados recuperados das migrações aplicadas em produção.
-- Aplicar após coverage_weekly_rpc_v1.sql e comparison_kpis_v1.sql.

-- Migration 20261002225841 shared_dashboard_sales_summaries_v1
-- Resumos privados: nenhuma mudança nas tabelas originais ou nos downloads legados.
CREATE TABLE IF NOT EXISTS dashboard_private.summary_state (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), dirty boolean NOT NULL DEFAULT true,
 generation bigint NOT NULL DEFAULT 0, refreshed_at timestamptz, last_change timestamptz NOT NULL DEFAULT clock_timestamp());
INSERT INTO dashboard_private.summary_state(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS dashboard_private.sales_day (
 source text NOT NULL, codcli text, produto text, codfor text, filial text, tipovenda text,
 codusur text,codsupervisor text,day date,unit_price numeric,virtual_supplier text,observacaofor text,
 vlvenda numeric NOT NULL,vlbonific numeric NOT NULL,qtvenda numeric NOT NULL,boxes numeric NOT NULL,totpesoliq numeric NOT NULL,
 row_count bigint NOT NULL);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_month (LIKE dashboard_private.sales_day INCLUDING ALL);
CREATE TABLE IF NOT EXISTS dashboard_private.weekly_day (
 source text NOT NULL,codcli text,codfor text,filial text,codusur text,codsupervisor text,
 day date,virtual_supplier text,vlvenda numeric NOT NULL);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_facets (
 source text NOT NULL,codcli text,produto text,codfor text,filial text,tipovenda text,day date);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_calendar (source text NOT NULL,codcli text,day date);
CREATE TABLE IF NOT EXISTS dashboard_private.client_assignments (
 client text PRIMARY KEY,seller text,supervisor text,supervisor_name text,filial text);
CREATE INDEX IF NOT EXISTS sales_day_client_date ON dashboard_private.sales_day(codcli,day);
CREATE INDEX IF NOT EXISTS sales_day_supplier_date ON dashboard_private.sales_day(codfor,day);
CREATE INDEX IF NOT EXISTS sales_day_product_date ON dashboard_private.sales_day(produto,day);
CREATE INDEX IF NOT EXISTS sales_month_client ON dashboard_private.sales_month(codcli,source);
CREATE INDEX IF NOT EXISTS sales_month_supplier ON dashboard_private.sales_month(codfor,source);
CREATE INDEX IF NOT EXISTS sales_month_product ON dashboard_private.sales_month(produto,source);
CREATE INDEX IF NOT EXISTS weekly_day_client_date ON dashboard_private.weekly_day(codcli,day);
CREATE INDEX IF NOT EXISTS weekly_day_supplier_date ON dashboard_private.weekly_day(codfor,day);
CREATE INDEX IF NOT EXISTS facets_client ON dashboard_private.sales_facets(codcli);
CREATE INDEX IF NOT EXISTS facets_supplier ON dashboard_private.sales_facets(codfor);
CREATE INDEX IF NOT EXISTS calendar_date ON dashboard_private.sales_calendar(source,day DESC);
CREATE INDEX IF NOT EXISTS calendar_client ON dashboard_private.sales_calendar(codcli,day);

-- Same approved-reader policy as the underlying tables; API endpoints still derive the wallet.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['summary_state','sales_day','sales_month','weekly_day','sales_facets','sales_calendar','client_assignments'] LOOP
  EXECUTE format('ALTER TABLE dashboard_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON dashboard_private.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT ON dashboard_private.%I TO authenticated',t);
  EXECUTE format('DROP POLICY IF EXISTS summary_read ON dashboard_private.%I',t);
  EXECUTE format('CREATE POLICY summary_read ON dashboard_private.%I FOR SELECT TO authenticated USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()))',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.assignments_source_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 raw AS MATERIALIZED(
 SELECT 'current'::text source,codcli,coalesce(nullif(c.rca,''),codusur) seller,codsupervisor,filial,dtped FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))
 UNION ALL SELECT 'history',codcli,coalesce(nullif(c.rca,''),codusur),codsupervisor,filial,dtped FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients'))),
 branch AS MATERIALIZED(SELECT DISTINCT ON(codcli) codcli,seller,filial,codsupervisor,dtped,source FROM raw ORDER BY codcli,source,dtped DESC NULLS LAST,filial),
 sup AS(SELECT DISTINCT ON(seller) seller,codsupervisor FROM branch ORDER BY seller,dtped DESC NULLS LAST,source,codsupervisor)
 SELECT coalesce(c.code,b.codcli),coalesce(nullif(c.rca,''),b.seller),sup.codsupervisor,coalesce(ds.nome,sup.codsupervisor,'N/A'),b.filial
 FROM clients c FULL JOIN branch b ON b.codcli=c.code LEFT JOIN sup ON sup.seller=coalesce(nullif(c.rca,''),b.seller)
 LEFT JOIN public.dim_supervisores ds ON ds.codigo=sup.codsupervisor;
$$;

-- Privileged writer lives outside the exposed schema and checks its caller.
CREATE OR REPLACE FUNCTION dashboard_private.refresh_summaries_v1(force_refresh boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET jit='off' SET work_mem='32MB' AS $$
DECLARE st dashboard_private.summary_state; result jsonb;
BEGIN
 IF NOT ((auth.uid() IS NOT NULL AND public.is_admin()) OR (auth.uid() IS NULL AND session_user IN('postgres','supabase_admin'))) THEN
  RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501';
 END IF;
 IF NOT pg_try_advisory_xact_lock(70261002,1) THEN RETURN jsonb_build_object('status','busy'); END IF;
 SELECT * INTO st FROM dashboard_private.summary_state WHERE id=true;
 IF NOT force_refresh AND NOT st.dirty THEN RETURN jsonb_build_object('status','current','generation',st.generation); END IF;
 -- Capture the revision without locking the upload trigger's state row.
 -- New source commits during the rebuild must leave dirty=true for the next generation.
 -- DELETE/INSERT is atomic under MVCC: concurrent readers keep the previous complete generation.
 DELETE FROM dashboard_private.sales_day;
 INSERT INTO dashboard_private.sales_day
 WITH raw AS MATERIALIZED(
  SELECT 'current'::text source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,
   (dtped AT TIME ZONE 'UTC')::date AS day,coalesce(vlvenda,0) amount,coalesce(vlbonific,0) bonus,coalesce(qtvenda,0) units,coalesce(totpesoliq,0) peso,observacaofor FROM public.data_detailed
  UNION ALL SELECT 'history',codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,
   (dtped AT TIME ZONE 'UTC')::date,coalesce(vlvenda,0),coalesce(vlbonific,0),coalesce(qtvenda,0),coalesce(totpesoliq,0),observacaofor FROM public.data_history),
 enriched AS(SELECT r.*,CASE WHEN units<>0 THEN amount/units END unit_price,
  units/CASE WHEN p.qtde_master>0 THEN p.qtde_master ELSE 1 END boxes,
  CASE WHEN r.codfor='1119' THEN CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END virtual_supplier
  FROM raw r LEFT JOIN public.dim_produtos p ON p.codigo=r.produto)
 SELECT source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,unit_price,virtual_supplier,observacaofor,
 sum(amount),sum(bonus),sum(units),sum(boxes),sum(peso),count(*) FROM enriched
 GROUP BY source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,unit_price,virtual_supplier,observacaofor;
 DELETE FROM dashboard_private.sales_month;
 INSERT INTO dashboard_private.sales_month
 SELECT source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,date_trunc('month',day)::date,unit_price,virtual_supplier,observacaofor,
 sum(vlvenda),sum(vlbonific),sum(qtvenda),sum(boxes),sum(totpesoliq),sum(row_count)
 FROM dashboard_private.sales_day GROUP BY source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,date_trunc('month',day)::date,unit_price,virtual_supplier,observacaofor;
 DELETE FROM dashboard_private.weekly_day;
 INSERT INTO dashboard_private.weekly_day SELECT source,codcli,codfor,filial,codusur,codsupervisor,day,virtual_supplier,sum(vlvenda)
 FROM dashboard_private.sales_day GROUP BY source,codcli,codfor,filial,codusur,codsupervisor,day,virtual_supplier;
 DELETE FROM dashboard_private.sales_facets;
 INSERT INTO dashboard_private.sales_facets SELECT source,codcli,produto,codfor,filial,tipovenda,max(day)
 FROM dashboard_private.sales_day GROUP BY source,codcli,produto,codfor,filial,tipovenda,date_trunc('month',day);
 DELETE FROM dashboard_private.sales_calendar;
 INSERT INTO dashboard_private.sales_calendar SELECT DISTINCT source,codcli,day FROM dashboard_private.sales_day;
 DELETE FROM dashboard_private.client_assignments;
 INSERT INTO dashboard_private.client_assignments SELECT * FROM dashboard_private.assignments_source_v1('{"kind":"admin"}');
 ANALYZE dashboard_private.sales_day; ANALYZE dashboard_private.sales_month; ANALYZE dashboard_private.weekly_day;
 ANALYZE dashboard_private.sales_facets; ANALYZE dashboard_private.sales_calendar; ANALYZE dashboard_private.client_assignments;
 UPDATE dashboard_private.summary_state SET dirty=(last_change IS DISTINCT FROM st.last_change),generation=generation+1,refreshed_at=clock_timestamp() WHERE id=true RETURNING
  jsonb_build_object('status','refreshed','generation',generation,'refreshed_at',refreshed_at) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION dashboard_private.assignments_source_v1(jsonb),dashboard_private.refresh_summaries_v1(boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION dashboard_private.refresh_summaries_v1(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_dashboard_summaries_v1()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' SET statement_timeout='60s' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501'; END IF;
 RETURN dashboard_private.refresh_summaries_v1(true);
END $$;
REVOKE ALL ON FUNCTION public.refresh_dashboard_summaries_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.refresh_dashboard_summaries_v1() TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.queue_summaries_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_SCHEMA<>'public' OR TG_TABLE_NAME NOT IN('data_detailed','data_history','data_clients','data_client_promoters','data_hierarchy','dim_produtos','dim_vendedores','dim_supervisores','data_product_details') THEN
  RAISE EXCEPTION 'Origem de atualização inválida';
 END IF;
 IF NOT ((auth.uid() IS NOT NULL AND public.is_admin()) OR (auth.uid() IS NULL AND session_user IN('postgres','supabase_admin'))) THEN
  RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501';
 END IF;
 UPDATE dashboard_private.summary_state SET dirty=true,last_change=clock_timestamp() WHERE id=true;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION dashboard_private.queue_summaries_v1() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['data_detailed','data_history','data_clients','data_client_promoters','data_hierarchy','dim_produtos','dim_vendedores','dim_supervisores','data_product_details'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS dashboard_summary_dirty ON public.%I',t);
  EXECUTE format('CREATE TRIGGER dashboard_summary_dirty AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION dashboard_private.queue_summaries_v1()',t);
 END LOOP;
END $$;
-- One minute safety net for integrations that don't explicitly finish an import.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='dashboard-page-summaries-v1') THEN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='dashboard-page-summaries-v1';
 END IF;
 PERFORM cron.schedule('dashboard-page-summaries-v1','* * * * *','SELECT dashboard_private.refresh_summaries_v1(false)');
END $$;
SELECT dashboard_private.refresh_summaries_v1(true);

CREATE OR REPLACE FUNCTION dashboard_private.assignments_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT a.* FROM dashboard_private.client_assignments a WHERE s->>'kind'='admin'
 OR a.client IN(SELECT jsonb_array_elements_text(s->'clients')) OR a.client IN(SELECT jsonb_array_elements_text(s->'ghosts'));
$$;
GRANT EXECUTE ON FUNCTION dashboard_private.assignments_v1(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION dashboard_private.assignments_v1(jsonb) FROM PUBLIC,anon;


-- Migration 20261002230230 coverage_weekly_filters_use_shared_summaries
-- Cobertura e Semanal: dados, cálculos e opções de filtros no PostgreSQL.
-- Helpers ficam fora do schema exposto pela API; todos preservam RLS.
CREATE SCHEMA IF NOT EXISTS dashboard_private;
REVOKE ALL ON SCHEMA dashboard_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA dashboard_private TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.scope_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $$
DECLARE r text; kind text; sellers text[]; clients text[]; ghosts text[];
BEGIN
 IF auth.uid() IS NULL OR NOT(public.is_admin() OR public.is_approved()) THEN
  RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501';
 END IF;
 SELECT lower(btrim(role)) INTO r FROM public.profiles WHERE id=auth.uid();
 IF r='adm' THEN RETURN jsonb_build_object('kind','admin'); END IF;
 -- Trade: carteira atribuída, inclusive coordenadores com carteira vazia.
 IF EXISTS(SELECT 1 FROM public.data_hierarchy h WHERE r IN(lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor))))
 OR EXISTS(SELECT 1 FROM public.data_client_promoters WHERE lower(btrim(promoter_code))=r) THEN
  kind:='trade';
  SELECT array_agg(cp.client_code) INTO clients FROM public.data_client_promoters cp
  WHERE lower(btrim(cp.promoter_code))=r OR EXISTS(SELECT 1 FROM public.data_hierarchy h
   WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code)) AND r IN(lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor))));
 ELSE
  SELECT array_agg(DISTINCT codusur) INTO sellers FROM (
   SELECT codusur FROM public.data_detailed WHERE lower(btrim(codsupervisor))=r
   UNION ALL SELECT codusur FROM public.data_history WHERE lower(btrim(codsupervisor))=r) s;
  kind:=CASE WHEN sellers IS NULL THEN 'seller' ELSE 'supervisor' END;
  SELECT array_agg(codigo_cliente) INTO clients FROM public.data_clients
  WHERE (kind='seller' AND lower(btrim(rca1))=r) OR (kind='supervisor' AND rca1=ANY(sellers))
   OR (r='1001' AND upper(coalesce(razaosocial,nomecliente,'')) LIKE '%AMERICANAS%');
  -- Mesmo complemento da carteira legado: clientes com venda atual do vendedor/supervisor.
  SELECT array_agg(DISTINCT codcli) INTO ghosts FROM public.data_detailed
  WHERE (kind='seller' AND lower(btrim(codusur))=r) OR (kind='supervisor' AND lower(btrim(codsupervisor))=r);
 END IF;
 RETURN jsonb_build_object('kind',kind,'clients',coalesce(clients,ARRAY[]::text[]),'ghosts',coalesce(ghosts,ARRAY[]::text[]));
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.clients_v1(s jsonb)
RETURNS TABLE(code text,rca text,city text,rede text,coord text,coord_name text,cocoord text,cocoord_name text,promotor text,promotor_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT c.codigo_cliente,CASE WHEN upper(coalesce(c.razaosocial,c.nomecliente,'')) LIKE '%AMERICANAS%' THEN '1001' ELSE c.rca1 END,
 coalesce(nullif(c.cidade,''),'N/A'),coalesce(nullif(c.ramo,''),'N/A'),h.cod_coord,h.nome_coord,h.cod_cocoord,h.nome_cocoord,cp.promoter_code,coalesce(h.nome_promotor,cp.promoter_code)
 FROM public.data_clients c
 LEFT JOIN public.data_client_promoters cp ON cp.client_code=c.codigo_cliente
 LEFT JOIN LATERAL (SELECT * FROM public.data_hierarchy h WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code)) ORDER BY h.id LIMIT 1) h ON true
 WHERE s->>'kind'='admin' OR c.codigo_cliente IN(SELECT jsonb_array_elements_text(s->'clients'))
 OR c.codigo_cliente IN(SELECT jsonb_array_elements_text(s->'ghosts'));
$$;

CREATE OR REPLACE FUNCTION dashboard_private.matches_v1(f jsonb,k text,v text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(jsonb_array_length(f->k),0)=0 OR coalesce(f->k ? v,false);
$$;
CREATE OR REPLACE FUNCTION dashboard_private.rede_v1(f jsonb,v text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(v,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? v,false))
 WHEN 'sem_rede' THEN coalesce(v,'N/A') IN('','N/A') ELSE true END;
$$;

CREATE OR REPLACE FUNCTION dashboard_private.assignments_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 raw AS MATERIALIZED(
 SELECT 'current'::text source,codcli,coalesce(nullif(c.rca,''),codusur) seller,codsupervisor,filial,dtped FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))
 UNION ALL SELECT 'history',codcli,coalesce(nullif(c.rca,''),codusur),codsupervisor,filial,dtped FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients'))),
 branch AS MATERIALIZED(SELECT DISTINCT ON(codcli) codcli,seller,filial,codsupervisor,dtped,source FROM raw ORDER BY codcli,source,dtped DESC NULLS LAST,filial),
 sup AS(SELECT DISTINCT ON(seller) seller,codsupervisor FROM branch ORDER BY seller,dtped DESC NULLS LAST,source,codsupervisor)
 SELECT coalesce(c.code,b.codcli),coalesce(nullif(c.rca,''),b.seller),sup.codsupervisor,coalesce(ds.nome,sup.codsupervisor,'N/A'),b.filial
 FROM clients c FULL JOIN branch b ON b.codcli=c.code LEFT JOIN sup ON sup.seller=coalesce(nullif(c.rca,''),b.seller)
 LEFT JOIN public.dim_supervisores ds ON ds.codigo=sup.codsupervisor;
$$;

CREATE OR REPLACE FUNCTION dashboard_private.rows_v1(s jsonb,f jsonb DEFAULT '{}'::jsonb,purpose text DEFAULT 'all')
RETURNS TABLE(source text,client text,product text,supplier text,virtual_supplier text,seller text,seller_name text,supervisor text,supervisor_name text,filial text,sale_type text,day date,amount numeric,bonus numeric,units numeric,boxes numeric,description text,registered date,city text,rede text,coord text,coord_name text,cocoord text,cocoord_name text,promotor text,promotor_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 products AS MATERIALIZED(SELECT * FROM public.dim_produtos), details AS MATERIALIZED(SELECT * FROM public.data_product_details),
 vendors AS MATERIALIZED(SELECT * FROM public.dim_vendedores), supervisors AS MATERIALIZED(SELECT * FROM public.dim_supervisores), raw AS MATERIALIZED(
 SELECT 'current'::text source,d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date AS day,coalesce(d.vlvenda,0) amount,coalesce(d.vlbonific,0) bonus,coalesce(d.qtvenda,0) units
 FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (purpose<>'weekly' OR coalesce(f->>'month','current')='current')
 UNION ALL
 SELECT 'history',d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date,coalesce(d.vlvenda,0),coalesce(d.vlbonific,0),coalesce(d.qtvenda,0)
 FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (purpose<>'weekly' OR ((d.dtped AT TIME ZONE 'UTC')::date >= (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date END)-interval '1 month' AND (d.dtped AT TIME ZONE 'UTC')::date < (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date+interval '1 month' END)))
 ), assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s))
 SELECT r.source,r.codcli,r.produto,r.codfor,CASE WHEN r.codfor='1119' THEN CASE
 WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY'
 WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END,
 coalesce(nullif(c.rca,''),r.codusur),coalesce(v.nome,coalesce(nullif(c.rca,''),r.codusur),'N/A'),
 coalesce(ss.supervisor,r.codsupervisor),coalesce(ds.nome,ss.supervisor,r.codsupervisor,'N/A'),r.filial,r.tipovenda,r.day,r.amount,r.bonus,r.units,
 r.units/CASE WHEN p.qtde_master>0 THEN p.qtde_master ELSE 1 END,
 coalesce(nullif(p.descricao,''),'Produto '||r.produto),(pd.dtcadastro AT TIME ZONE 'UTC')::date,
 coalesce(c.city,'N/A'),coalesce(c.rede,'N/A'),c.coord,c.coord_name,c.cocoord,c.cocoord_name,c.promotor,c.promotor_name
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli
 LEFT JOIN products p ON p.codigo=r.produto
 LEFT JOIN details pd ON pd.code=r.produto
 LEFT JOIN assignments ss ON ss.client=r.codcli
 LEFT JOIN vendors v ON v.codigo=coalesce(nullif(c.rca,''),r.codusur)
 LEFT JOIN supervisors ds ON ds.codigo=coalesce(ss.supervisor,r.codsupervisor);
$$;

-- Page-local planner settings avoid JIT startup and merge joins caused by opaque helper cardinality.
-- Settings restore automatically on function exit; authorization/RLS remain unchanged.
-- As opções são pequenas projeções; nunca retornam linhas de vendas ao navegador.
CREATE OR REPLACE FUNCTION public.get_dashboard_filters_v1(p_page text,p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb; f jsonb:=p_filters;
BEGIN
 IF p_page NOT IN('coverage','weekly') OR jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Página ou filtros inválidos' USING ERRCODE='22023'; END IF;
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 raw AS MATERIALIZED(SELECT * FROM dashboard_private.sales_facets WHERE s->>'kind'='admin'
 OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (source='current' AND codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))),
 rows AS MATERIALIZED(SELECT r.source,r.day,r.filial,r.tipovenda sale_type,r.produto product,r.codfor supplier,
 coalesce(p.descricao,'Produto '||r.produto) description,
 CASE WHEN r.codfor='1119' THEN CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END virtual_supplier,
 a.seller,coalesce(v.nome,a.seller,'N/A') seller_name,a.supervisor_name,c.city,c.rede,c.coord,c.cocoord,c.promotor
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli LEFT JOIN assignments a ON a.client=r.codcli
 LEFT JOIN public.dim_produtos p ON p.codigo=r.produto LEFT JOIN public.dim_vendedores v ON v.codigo=a.seller),
 scope AS MATERIALIZED(SELECT * FROM rows WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false)))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? seller,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? rede,false)) WHEN 'sem_rede' THEN coalesce(rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR filial=f->>'filial')
 AND (coalesce(f->>'city','')='' OR lower(city)=lower(f->>'city'))),
 supplier_options AS (SELECT DISTINCT supplier code,coalesce(df.nome,supplier) label FROM scope LEFT JOIN public.dim_fornecedores df ON df.codigo=scope.supplier
 UNION SELECT DISTINCT virtual_supplier,CASE virtual_supplier WHEN '1119_TODDYNHO' THEN 'TODDYNHO' WHEN '1119_TODDY' THEN 'TODDY' ELSE 'QUAKER / KEROCOCO' END FROM scope WHERE virtual_supplier IS NOT NULL),
 products AS (SELECT DISTINCT product code,'('||product||') '||description label FROM scope WHERE (coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false)),
 sellers AS(SELECT DISTINCT seller code,seller_name label,supervisor_name supervisor FROM rows
 WHERE (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))),
 hierarchy AS(SELECT * FROM clients), months AS(SELECT DISTINCT to_char(day,'YYYY-MM') code FROM raw WHERE day IS NOT NULL)
 SELECT jsonb_build_object('schema_version',1,'reference_date',coalesce((SELECT max(day) FROM rows WHERE source='current'),(SELECT max(day) FROM rows),current_date),
 'suppliers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM supplier_options t),'[]'),
 'products',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM products t),'[]'),
 'types',coalesce((SELECT jsonb_agg(jsonb_build_object('code',sale_type,'label',sale_type) ORDER BY sale_type) FROM (SELECT DISTINCT sale_type FROM scope WHERE sale_type IS NOT NULL)t),'[]'),
 'sellers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM sellers t),'[]'),
 'supervisors',coalesce((SELECT jsonb_agg(jsonb_build_object('code',label,'label',label) ORDER BY label) FROM(SELECT DISTINCT supervisor_name label FROM rows)t),'[]'),
 'coords',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT coord code,coalesce(coord_name,coord) label FROM hierarchy WHERE coord IS NOT NULL)t),'[]'),
 'cocoords',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT cocoord code,coalesce(cocoord_name,cocoord) label FROM hierarchy WHERE cocoord IS NOT NULL AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)))t),'[]'),
 'promotors',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT promotor code,coalesce(promotor_name,promotor) label FROM hierarchy WHERE promotor IS NOT NULL AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)))t),'[]'),
 'cities',coalesce((SELECT jsonb_agg(city ORDER BY city) FROM(SELECT DISTINCT city FROM clients)t),'[]'),
 'redes',coalesce((SELECT jsonb_agg(jsonb_build_object('code',rede,'label',rede) ORDER BY rede) FROM(SELECT DISTINCT rede FROM clients WHERE rede NOT IN('','N/A'))t),'[]'),
 'months',coalesce((SELECT jsonb_agg(code ORDER BY code DESC) FROM months),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.get_weekly_page_v1(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); f jsonb:=p_filters; ref date; target date; result jsonb;
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(day) FILTER(WHERE source='current'),max(day),current_date) INTO ref FROM dashboard_private.sales_calendar;
 target:=CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',ref)::date ELSE ((f->>'month')||'-01')::date END;
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 rows AS MATERIALIZED(SELECT d.source,d.codcli client,d.day,d.vlvenda amount,d.codfor supplier,d.virtual_supplier,
 coalesce(nullif(c.rca,''),d.codusur) seller,coalesce(v.nome,coalesce(nullif(c.rca,''),d.codusur),'N/A') seller_name,
 coalesce(a.supervisor_name,ds.nome,d.codsupervisor,'N/A') supervisor_name,d.filial,coalesce(c.rede,'N/A') rede,
 c.coord,c.cocoord,c.promotor,c.promotor_name FROM dashboard_private.weekly_day d
 LEFT JOIN clients c ON c.code=d.codcli LEFT JOIN assignments a ON a.client=d.codcli
 LEFT JOIN public.dim_vendedores v ON v.codigo=coalesce(nullif(c.rca,''),d.codusur)
 LEFT JOIN public.dim_supervisores ds ON ds.codigo=d.codsupervisor
 WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (d.source='current' AND d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))))
 AND ((coalesce(f->>'month','current')='current' AND d.source='current') OR (d.source='history' AND d.day>=target-interval '1 month' AND d.day<target+interval '1 month'))),
 filtered AS MATERIALIZED(SELECT * FROM rows WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false)))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? seller,false))
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? rede,false)) WHEN 'sem_rede' THEN coalesce(rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR filial=f->>'filial')),
 selected AS MATERIALIZED(SELECT * FROM filtered WHERE
 (coalesce(f->>'month','current')='current' AND source='current') OR (coalesce(f->>'month','current')<>'current' AND source='history' AND day>=target AND day<target+interval '1 month')),
 first_day AS(SELECT target+CASE extract(isodow FROM target)::int WHEN 6 THEN 2 WHEN 7 THEN 1 ELSE 0 END first),
 week_starts AS(SELECT first start FROM first_day UNION SELECT d::date FROM first_day,generate_series(date_trunc('week',first::timestamp)+interval '7 days',target::timestamp+interval '1 month - 1 day',interval '7 days') d),
 weeks AS(SELECT row_number() OVER(ORDER BY start) id,start,least((date_trunc('week',start::timestamp)+interval '6 days')::date,(target+interval '1 month - 1 day')::date) finish FROM week_starts),
 daily AS(SELECT w.id,extract(dow FROM s.day)::int weekday,sum(s.amount) amount FROM weeks w JOIN selected s ON s.day BETWEEN w.start AND w.finish GROUP BY 1,2),
 week_data AS(SELECT w.id,w.start,w.finish "end",coalesce((SELECT sum(amount) FROM daily d WHERE d.id=w.id),0) total,
 (SELECT jsonb_agg(coalesce(d.amount,0) ORDER BY wd) FROM generate_series(0,6) wd LEFT JOIN daily d ON d.id=w.id AND d.weekday=wd) days FROM weeks w),
 best_daily AS(SELECT day,sum(amount) amount FROM filtered WHERE source='history' AND day>=target-interval '1 month' AND day<target GROUP BY day),
 best AS(SELECT extract(dow FROM day)::int wd,greatest(max(amount),0) amount FROM best_daily GROUP BY 1),
 ranks AS(SELECT CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(promotor,'Sem Promotor') ELSE coalesce(seller,'N/A') END code,
 CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(promotor_name,'Sem Promotor') ELSE coalesce(seller_name,seller,'N/A') END name,
 sum(amount) val,count(DISTINCT client) pos FROM selected GROUP BY 1,2)
 SELECT jsonb_build_object('schema_version',1,'reference_date',ref,'target_month',to_char(target,'YYYY-MM'),
 'weeks',coalesce((SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM week_data w),'[]'),
 'best_days',(SELECT jsonb_agg(coalesce(b.amount,0) ORDER BY wd) FROM generate_series(0,6) wd LEFT JOIN best b USING(wd)),
 'ranking_fat',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY val DESC,code) FROM(SELECT * FROM ranks ORDER BY val DESC,code LIMIT 10)t),'[]'),
 'ranking_pos',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY pos DESC,val DESC,code) FROM(SELECT * FROM ranks ORDER BY pos DESC,val DESC,code LIMIT 10)t),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.get_coverage_page_v1(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); f jsonb:=p_filters; ref date; start_date date; end_date date; prev_start date; prev_end date;
 custom_date boolean; alt boolean; result jsonb; days integer:=greatest(coalesce((f->>'working_days')::int,0),0);
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(day) FILTER(WHERE source='current'),max(day),current_date) INTO ref FROM dashboard_private.sales_calendar;
 custom_date:=nullif(f->>'date_start','') IS NOT NULL AND nullif(f->>'date_end','') IS NOT NULL;
 start_date:=CASE WHEN custom_date THEN (f->>'date_start')::date ELSE date_trunc('month',ref)::date END;
 end_date:=CASE WHEN custom_date THEN (f->>'date_end')::date ELSE (start_date+interval '1 month - 1 day')::date END;
 IF end_date<start_date THEN RAISE EXCEPTION 'Período inválido' USING ERRCODE='22023'; END IF;
 prev_start:=(start_date-interval '1 month')::date; prev_end:=(end_date-interval '1 month')::date;
 IF NOT custom_date THEN prev_end:=start_date-1; END IF;
 alt:=coalesce(jsonb_array_length(f->'types'),0)>0 AND NOT(coalesce(f->'types' ? '1',false) OR coalesce(f->'types' ? '9',false));
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 seller_sup AS(SELECT DISTINCT seller,supervisor_name FROM assignments),branches AS(SELECT client,filial FROM assignments),
 base_clients AS MATERIALIZED(SELECT c.* FROM clients c WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR EXISTS(SELECT 1 FROM seller_sup ss WHERE ss.seller=c.rca AND (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? ss.supervisor_name,false))) OR coalesce(jsonb_array_length(f->'supervisors'),0)=0)
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? c.rca,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR EXISTS(SELECT 1 FROM branches b WHERE b.client=c.code AND b.filial=f->>'filial'))),
 scoped AS MATERIALIZED(SELECT d.source,d.codcli client,d.produto product,d.day,d.codusur seller,
 d.vlvenda amount,d.unit_price,d.boxes,CASE WHEN alt THEN d.vlbonific ELSE d.vlvenda END value
 FROM (SELECT * FROM dashboard_private.sales_month WHERE NOT custom_date
 UNION ALL SELECT * FROM dashboard_private.sales_day WHERE custom_date) d
 JOIN base_clients c ON c.code=d.codcli WHERE (coalesce(f->>'filial','ambas') IN('ambas','all') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false))),
 filtered AS NOT MATERIALIZED(SELECT * FROM scoped d WHERE ((f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR (d.unit_price IS NOT NULL
 AND (f->>'price_min' IS NULL OR d.unit_price>=(f->>'price_min')::numeric)
 AND (f->>'price_max' IS NULL OR d.unit_price<=(f->>'price_max')::numeric)))),
 periods AS MATERIALIZED(
 SELECT r.*,'current'::text period FROM filtered r WHERE (custom_date AND day BETWEEN start_date AND end_date) OR(NOT custom_date AND source='current')
 UNION ALL SELECT r.*,'previous' FROM filtered r WHERE (custom_date AND day BETWEEN prev_start AND prev_end) OR(NOT custom_date AND source='history' AND day BETWEEN prev_start AND prev_end)
 UNION ALL SELECT r.*,'history' FROM filtered r WHERE NOT custom_date AND source='history' AND day NOT BETWEEN prev_start AND prev_end),
 product_clients AS(SELECT product,client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2,3),
 product_counts AS(SELECT product,count(*) FILTER(WHERE period='current' AND value>=1) current_count,count(*) FILTER(WHERE period='previous' AND value>=1) previous_count FROM product_clients GROUP BY product),
 selection AS(SELECT client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2),
 active_history AS(SELECT client FROM scoped WHERE source='history' GROUP BY client HAVING sum(amount)>=1),
 working AS MATERIALIZED(SELECT DISTINCT day FROM dashboard_private.sales_calendar WHERE extract(isodow FROM day) BETWEEN 1 AND 5
 AND (s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (source='current' AND codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))))),
 working_array AS(SELECT array_agg(day ORDER BY day) dates FROM working),
 stats_amounts AS(SELECT product,coalesce(sum(boxes) FILTER(WHERE period='current'),0) current_boxes,
 coalesce(sum(boxes) FILTER(WHERE period='previous'),0) previous_boxes,bool_or(day<date_trunc('month',ref)::date) has_history
 FROM periods GROUP BY product),
 stats AS MATERIALIZED(SELECT t.*,coalesce(nullif(p.descricao,''),'Produto '||t.product) description,(pd.dtcadastro AT TIME ZONE 'UTC')::date registered
 FROM stats_amounts t LEFT JOIN public.dim_produtos p ON p.codigo=t.product LEFT JOIN public.data_product_details pd ON pd.code=t.product),
 stock AS(SELECT product_code,sum(coalesce(stock_qty,0)) qty FROM public.data_stock WHERE coalesce(f->>'filial','ambas') IN('ambas','all') OR filial=f->>'filial' GROUP BY product_code),
 divisors AS MATERIALIZED(SELECT t.*,coalesce(st.qty,0) stock,coalesce(pc.current_count,0) current_count,coalesce(pc.previous_count,0) previous_count,
 greatest(1,CASE WHEN NOT coalesce(has_history,false) AND current_boxes>0 THEN least(
 greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1),
 CASE WHEN days>0 THEN days ELSE greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1) END)
 ELSE CASE WHEN days>0 THEN least(days,(SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered)) ELSE (SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered) END END)::numeric divisor
 FROM stats t LEFT JOIN stock st ON st.product_code=t.product LEFT JOIN product_counts pc USING(product)),
 -- Daily rows are read only for each product's required trend window, with original price buckets.
 trend_totals AS MATERIALIZED(SELECT dv.product,coalesce(sum(d.boxes*CASE WHEN custom_date THEN
 (CASE WHEN d.day BETWEEN start_date AND end_date THEN 1 ELSE 0 END+CASE WHEN d.day BETWEEN prev_start AND prev_end THEN 1 ELSE 0 END) ELSE 1 END),0)/dv.divisor daily_avg
 FROM divisors dv CROSS JOIN working_array w LEFT JOIN (dashboard_private.sales_day d JOIN base_clients c ON c.code=d.codcli)
 ON d.produto=dv.product AND d.day BETWEEN w.dates[greatest(1,cardinality(w.dates)-dv.divisor::int+1)] AND w.dates[cardinality(w.dates)]
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)) AND ((f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR (d.unit_price IS NOT NULL
 AND (f->>'price_min' IS NULL OR d.unit_price>=(f->>'price_min')::numeric)
 AND (f->>'price_max' IS NULL OR d.unit_price<=(f->>'price_max')::numeric)))
 GROUP BY dv.product,dv.divisor),
 trend AS(SELECT d.*,t.daily_avg FROM divisors d JOIN trend_totals t USING(product)),
 table_all AS MATERIALIZED(SELECT product code,'('||product||') '||description descricao,stock "stockQty",current_boxes "boxesSoldCurrentMonth",previous_boxes "boxesSoldPreviousMonth",
 CASE WHEN previous_boxes>0 THEN (current_boxes-previous_boxes)/previous_boxes*100 WHEN current_boxes>0 THEN NULL ELSE 0 END "boxesVariation",
 CASE WHEN previous_count>0 THEN (current_count-previous_count)::numeric/previous_count*100 WHEN current_count>0 THEN NULL ELSE 0 END "pdvVariation",
 CASE WHEN daily_avg>0 THEN stock/daily_avg WHEN stock>0 THEN NULL ELSE 0 END "trendDays",previous_count "clientsPreviousCount",current_count "clientsCurrentCount",
 CASE WHEN (SELECT count(*) FROM base_clients)>0 THEN current_count::numeric/(SELECT count(*) FROM base_clients)*100 ELSE 0 END "coverageCurrent" FROM trend),
 table_filtered AS MATERIALIZED(SELECT * FROM table_all WHERE "boxesSoldCurrentMonth">0 AND CASE coalesce(f->>'trend','all') WHEN 'low' THEN "trendDays"<15 WHEN 'medium' THEN "trendDays">=15 AND "trendDays"<30 WHEN 'good' THEN "trendDays">=30 ELSE true END),
 cities AS(SELECT c.city name,sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN r.boxes ELSE r.value END) value FROM periods r JOIN base_clients c ON c.code=r.client WHERE r.period='current' GROUP BY c.city),
 ranking AS(SELECT CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(c.promotor_name,'N/A') ELSE coalesce(v.nome,coalesce(nullif(c.rca,''),r.seller),'N/A') END name,
 sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN r.boxes ELSE r.value END) value FROM periods r
 JOIN base_clients c ON c.code=r.client LEFT JOIN public.dim_vendedores v ON v.codigo=coalesce(nullif(c.rca,''),r.seller)
 WHERE r.period='current' GROUP BY 1),
 top_product AS(SELECT * FROM table_all WHERE "coverageCurrent">0 ORDER BY "coverageCurrent" DESC,code LIMIT 1)
 SELECT jsonb_build_object('schema_version',1,'reference_date',ref,'active_clients',(SELECT count(*) FROM base_clients),'active_3m',(SELECT count(*) FROM active_history),
 'current_clients',(SELECT count(*) FROM selection WHERE period='current' AND value>=1),'previous_clients',(SELECT count(*) FROM selection WHERE period='previous' AND value>=1),
 'top',coalesce((SELECT to_jsonb(t) FROM top_product t),'null'),
 'rows',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY "stockQty" DESC,code) FROM table_filtered t),'[]'),
 'total_boxes',coalesce((SELECT sum("boxesSoldCurrentMonth") FROM table_filtered),0),
 'chart_total',coalesce((SELECT sum(value) FROM cities),0),
 'cities',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY value DESC,name) FROM(SELECT * FROM cities ORDER BY value DESC,name LIMIT 10)t),'[]'),
 'ranking',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY value DESC,name) FROM(SELECT * FROM ranking ORDER BY value DESC,name LIMIT 10)t),'[]')) INTO result;
 RETURN result;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dashboard_private FROM PUBLIC,anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dashboard_private TO authenticated;
REVOKE ALL ON FUNCTION public.get_dashboard_filters_v1(text,jsonb),public.get_coverage_page_v1(jsonb),public.get_weekly_page_v1(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_filters_v1(text,jsonb),public.get_coverage_page_v1(jsonb),public.get_weekly_page_v1(jsonb) TO authenticated;

-- Mesma autorização de leitura, avaliada uma vez por consulta.
ALTER POLICY "Acesso Leitura Unificado" ON public.data_product_details USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.data_stock USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.dim_vendedores USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.dim_supervisores USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
NOTIFY pgrst,'reload schema';


-- Migration 20261002230259 summary_rpc_cached_client_assignments
-- Cobertura e Semanal: dados, cálculos e opções de filtros no PostgreSQL.
-- Helpers ficam fora do schema exposto pela API; todos preservam RLS.
CREATE SCHEMA IF NOT EXISTS dashboard_private;
REVOKE ALL ON SCHEMA dashboard_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA dashboard_private TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.scope_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $$
DECLARE r text; kind text; sellers text[]; clients text[]; ghosts text[];
BEGIN
 IF auth.uid() IS NULL OR NOT(public.is_admin() OR public.is_approved()) THEN
  RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501';
 END IF;
 SELECT lower(btrim(role)) INTO r FROM public.profiles WHERE id=auth.uid();
 IF r='adm' THEN RETURN jsonb_build_object('kind','admin'); END IF;
 -- Trade: carteira atribuída, inclusive coordenadores com carteira vazia.
 IF EXISTS(SELECT 1 FROM public.data_hierarchy h WHERE r IN(lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor))))
 OR EXISTS(SELECT 1 FROM public.data_client_promoters WHERE lower(btrim(promoter_code))=r) THEN
  kind:='trade';
  SELECT array_agg(cp.client_code) INTO clients FROM public.data_client_promoters cp
  WHERE lower(btrim(cp.promoter_code))=r OR EXISTS(SELECT 1 FROM public.data_hierarchy h
   WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code)) AND r IN(lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor))));
 ELSE
  SELECT array_agg(DISTINCT codusur) INTO sellers FROM (
   SELECT codusur FROM public.data_detailed WHERE lower(btrim(codsupervisor))=r
   UNION ALL SELECT codusur FROM public.data_history WHERE lower(btrim(codsupervisor))=r) s;
  kind:=CASE WHEN sellers IS NULL THEN 'seller' ELSE 'supervisor' END;
  SELECT array_agg(codigo_cliente) INTO clients FROM public.data_clients
  WHERE (kind='seller' AND lower(btrim(rca1))=r) OR (kind='supervisor' AND rca1=ANY(sellers))
   OR (r='1001' AND upper(coalesce(razaosocial,nomecliente,'')) LIKE '%AMERICANAS%');
  -- Mesmo complemento da carteira legado: clientes com venda atual do vendedor/supervisor.
  SELECT array_agg(DISTINCT codcli) INTO ghosts FROM public.data_detailed
  WHERE (kind='seller' AND lower(btrim(codusur))=r) OR (kind='supervisor' AND lower(btrim(codsupervisor))=r);
 END IF;
 RETURN jsonb_build_object('kind',kind,'clients',coalesce(clients,ARRAY[]::text[]),'ghosts',coalesce(ghosts,ARRAY[]::text[]));
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.clients_v1(s jsonb)
RETURNS TABLE(code text,rca text,city text,rede text,coord text,coord_name text,cocoord text,cocoord_name text,promotor text,promotor_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT c.codigo_cliente,CASE WHEN upper(coalesce(c.razaosocial,c.nomecliente,'')) LIKE '%AMERICANAS%' THEN '1001' ELSE c.rca1 END,
 coalesce(nullif(c.cidade,''),'N/A'),coalesce(nullif(c.ramo,''),'N/A'),h.cod_coord,h.nome_coord,h.cod_cocoord,h.nome_cocoord,cp.promoter_code,coalesce(h.nome_promotor,cp.promoter_code)
 FROM public.data_clients c
 LEFT JOIN public.data_client_promoters cp ON cp.client_code=c.codigo_cliente
 LEFT JOIN LATERAL (SELECT * FROM public.data_hierarchy h WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code)) ORDER BY h.id LIMIT 1) h ON true
 WHERE s->>'kind'='admin' OR c.codigo_cliente IN(SELECT jsonb_array_elements_text(s->'clients'))
 OR c.codigo_cliente IN(SELECT jsonb_array_elements_text(s->'ghosts'));
$$;

CREATE OR REPLACE FUNCTION dashboard_private.matches_v1(f jsonb,k text,v text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(jsonb_array_length(f->k),0)=0 OR coalesce(f->k ? v,false);
$$;
CREATE OR REPLACE FUNCTION dashboard_private.rede_v1(f jsonb,v text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(v,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? v,false))
 WHEN 'sem_rede' THEN coalesce(v,'N/A') IN('','N/A') ELSE true END;
$$;

CREATE OR REPLACE FUNCTION dashboard_private.assignments_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT a.* FROM dashboard_private.client_assignments a WHERE s->>'kind'='admin'
 OR a.client IN(SELECT jsonb_array_elements_text(s->'clients')) OR a.client IN(SELECT jsonb_array_elements_text(s->'ghosts'));
$$;

CREATE OR REPLACE FUNCTION dashboard_private.rows_v1(s jsonb,f jsonb DEFAULT '{}'::jsonb,purpose text DEFAULT 'all')
RETURNS TABLE(source text,client text,product text,supplier text,virtual_supplier text,seller text,seller_name text,supervisor text,supervisor_name text,filial text,sale_type text,day date,amount numeric,bonus numeric,units numeric,boxes numeric,description text,registered date,city text,rede text,coord text,coord_name text,cocoord text,cocoord_name text,promotor text,promotor_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 products AS MATERIALIZED(SELECT * FROM public.dim_produtos), details AS MATERIALIZED(SELECT * FROM public.data_product_details),
 vendors AS MATERIALIZED(SELECT * FROM public.dim_vendedores), supervisors AS MATERIALIZED(SELECT * FROM public.dim_supervisores), raw AS MATERIALIZED(
 SELECT 'current'::text source,d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date AS day,coalesce(d.vlvenda,0) amount,coalesce(d.vlbonific,0) bonus,coalesce(d.qtvenda,0) units
 FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (purpose<>'weekly' OR coalesce(f->>'month','current')='current')
 UNION ALL
 SELECT 'history',d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date,coalesce(d.vlvenda,0),coalesce(d.vlbonific,0),coalesce(d.qtvenda,0)
 FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (purpose<>'weekly' OR ((d.dtped AT TIME ZONE 'UTC')::date >= (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date END)-interval '1 month' AND (d.dtped AT TIME ZONE 'UTC')::date < (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date+interval '1 month' END)))
 ), assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s))
 SELECT r.source,r.codcli,r.produto,r.codfor,CASE WHEN r.codfor='1119' THEN CASE
 WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY'
 WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END,
 coalesce(nullif(c.rca,''),r.codusur),coalesce(v.nome,coalesce(nullif(c.rca,''),r.codusur),'N/A'),
 coalesce(ss.supervisor,r.codsupervisor),coalesce(ds.nome,ss.supervisor,r.codsupervisor,'N/A'),r.filial,r.tipovenda,r.day,r.amount,r.bonus,r.units,
 r.units/CASE WHEN p.qtde_master>0 THEN p.qtde_master ELSE 1 END,
 coalesce(nullif(p.descricao,''),'Produto '||r.produto),(pd.dtcadastro AT TIME ZONE 'UTC')::date,
 coalesce(c.city,'N/A'),coalesce(c.rede,'N/A'),c.coord,c.coord_name,c.cocoord,c.cocoord_name,c.promotor,c.promotor_name
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli
 LEFT JOIN products p ON p.codigo=r.produto
 LEFT JOIN details pd ON pd.code=r.produto
 LEFT JOIN assignments ss ON ss.client=r.codcli
 LEFT JOIN vendors v ON v.codigo=coalesce(nullif(c.rca,''),r.codusur)
 LEFT JOIN supervisors ds ON ds.codigo=coalesce(ss.supervisor,r.codsupervisor);
$$;

-- Page-local planner settings avoid JIT startup and merge joins caused by opaque helper cardinality.
-- Settings restore automatically on function exit; authorization/RLS remain unchanged.
-- As opções são pequenas projeções; nunca retornam linhas de vendas ao navegador.
CREATE OR REPLACE FUNCTION public.get_dashboard_filters_v1(p_page text,p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb; f jsonb:=p_filters;
BEGIN
 IF p_page NOT IN('coverage','weekly') OR jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Página ou filtros inválidos' USING ERRCODE='22023'; END IF;
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 raw AS MATERIALIZED(SELECT * FROM dashboard_private.sales_facets WHERE s->>'kind'='admin'
 OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (source='current' AND codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))),
 rows AS MATERIALIZED(SELECT r.source,r.day,r.filial,r.tipovenda sale_type,r.produto product,r.codfor supplier,
 coalesce(p.descricao,'Produto '||r.produto) description,
 CASE WHEN r.codfor='1119' THEN CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END virtual_supplier,
 a.seller,coalesce(v.nome,a.seller,'N/A') seller_name,a.supervisor_name,c.city,c.rede,c.coord,c.cocoord,c.promotor
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli LEFT JOIN assignments a ON a.client=r.codcli
 LEFT JOIN public.dim_produtos p ON p.codigo=r.produto LEFT JOIN public.dim_vendedores v ON v.codigo=a.seller),
 scope AS MATERIALIZED(SELECT * FROM rows WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false)))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? seller,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? rede,false)) WHEN 'sem_rede' THEN coalesce(rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR filial=f->>'filial')
 AND (coalesce(f->>'city','')='' OR lower(city)=lower(f->>'city'))),
 supplier_options AS (SELECT DISTINCT supplier code,coalesce(df.nome,supplier) label FROM scope LEFT JOIN public.dim_fornecedores df ON df.codigo=scope.supplier
 UNION SELECT DISTINCT virtual_supplier,CASE virtual_supplier WHEN '1119_TODDYNHO' THEN 'TODDYNHO' WHEN '1119_TODDY' THEN 'TODDY' ELSE 'QUAKER / KEROCOCO' END FROM scope WHERE virtual_supplier IS NOT NULL),
 products AS (SELECT DISTINCT product code,'('||product||') '||description label FROM scope WHERE (coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false)),
 sellers AS(SELECT DISTINCT seller code,seller_name label,supervisor_name supervisor FROM rows
 WHERE (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))),
 hierarchy AS(SELECT * FROM clients), months AS(SELECT DISTINCT to_char(day,'YYYY-MM') code FROM raw WHERE day IS NOT NULL)
 SELECT jsonb_build_object('schema_version',1,'reference_date',coalesce((SELECT max(day) FROM rows WHERE source='current'),(SELECT max(day) FROM rows),current_date),
 'suppliers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM supplier_options t),'[]'),
 'products',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM products t),'[]'),
 'types',coalesce((SELECT jsonb_agg(jsonb_build_object('code',sale_type,'label',sale_type) ORDER BY sale_type) FROM (SELECT DISTINCT sale_type FROM scope WHERE sale_type IS NOT NULL)t),'[]'),
 'sellers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM sellers t),'[]'),
 'supervisors',coalesce((SELECT jsonb_agg(jsonb_build_object('code',label,'label',label) ORDER BY label) FROM(SELECT DISTINCT supervisor_name label FROM rows)t),'[]'),
 'coords',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT coord code,coalesce(coord_name,coord) label FROM hierarchy WHERE coord IS NOT NULL)t),'[]'),
 'cocoords',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT cocoord code,coalesce(cocoord_name,cocoord) label FROM hierarchy WHERE cocoord IS NOT NULL AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)))t),'[]'),
 'promotors',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT promotor code,coalesce(promotor_name,promotor) label FROM hierarchy WHERE promotor IS NOT NULL AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)))t),'[]'),
 'cities',coalesce((SELECT jsonb_agg(city ORDER BY city) FROM(SELECT DISTINCT city FROM clients)t),'[]'),
 'redes',coalesce((SELECT jsonb_agg(jsonb_build_object('code',rede,'label',rede) ORDER BY rede) FROM(SELECT DISTINCT rede FROM clients WHERE rede NOT IN('','N/A'))t),'[]'),
 'months',coalesce((SELECT jsonb_agg(code ORDER BY code DESC) FROM months),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.get_weekly_page_v1(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); f jsonb:=p_filters; ref date; target date; result jsonb;
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(day) FILTER(WHERE source='current'),max(day),current_date) INTO ref FROM dashboard_private.sales_calendar;
 target:=CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',ref)::date ELSE ((f->>'month')||'-01')::date END;
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 rows AS MATERIALIZED(SELECT d.source,d.codcli client,d.day,d.vlvenda amount,d.codfor supplier,d.virtual_supplier,
 coalesce(nullif(c.rca,''),d.codusur) seller,coalesce(v.nome,coalesce(nullif(c.rca,''),d.codusur),'N/A') seller_name,
 coalesce(a.supervisor_name,ds.nome,d.codsupervisor,'N/A') supervisor_name,d.filial,coalesce(c.rede,'N/A') rede,
 c.coord,c.cocoord,c.promotor,c.promotor_name FROM dashboard_private.weekly_day d
 LEFT JOIN clients c ON c.code=d.codcli LEFT JOIN assignments a ON a.client=d.codcli
 LEFT JOIN public.dim_vendedores v ON v.codigo=coalesce(nullif(c.rca,''),d.codusur)
 LEFT JOIN public.dim_supervisores ds ON ds.codigo=d.codsupervisor
 WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (d.source='current' AND d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))))
 AND ((coalesce(f->>'month','current')='current' AND d.source='current') OR (d.source='history' AND d.day>=target-interval '1 month' AND d.day<target+interval '1 month'))),
 filtered AS MATERIALIZED(SELECT * FROM rows WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false)))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? seller,false))
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? rede,false)) WHEN 'sem_rede' THEN coalesce(rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR filial=f->>'filial')),
 selected AS MATERIALIZED(SELECT * FROM filtered WHERE
 (coalesce(f->>'month','current')='current' AND source='current') OR (coalesce(f->>'month','current')<>'current' AND source='history' AND day>=target AND day<target+interval '1 month')),
 first_day AS(SELECT target+CASE extract(isodow FROM target)::int WHEN 6 THEN 2 WHEN 7 THEN 1 ELSE 0 END first),
 week_starts AS(SELECT first start FROM first_day UNION SELECT d::date FROM first_day,generate_series(date_trunc('week',first::timestamp)+interval '7 days',target::timestamp+interval '1 month - 1 day',interval '7 days') d),
 weeks AS(SELECT row_number() OVER(ORDER BY start) id,start,least((date_trunc('week',start::timestamp)+interval '6 days')::date,(target+interval '1 month - 1 day')::date) finish FROM week_starts),
 daily AS(SELECT w.id,extract(dow FROM s.day)::int weekday,sum(s.amount) amount FROM weeks w JOIN selected s ON s.day BETWEEN w.start AND w.finish GROUP BY 1,2),
 week_data AS(SELECT w.id,w.start,w.finish "end",coalesce((SELECT sum(amount) FROM daily d WHERE d.id=w.id),0) total,
 (SELECT jsonb_agg(coalesce(d.amount,0) ORDER BY wd) FROM generate_series(0,6) wd LEFT JOIN daily d ON d.id=w.id AND d.weekday=wd) days FROM weeks w),
 best_daily AS(SELECT day,sum(amount) amount FROM filtered WHERE source='history' AND day>=target-interval '1 month' AND day<target GROUP BY day),
 best AS(SELECT extract(dow FROM day)::int wd,greatest(max(amount),0) amount FROM best_daily GROUP BY 1),
 ranks AS(SELECT CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(promotor,'Sem Promotor') ELSE coalesce(seller,'N/A') END code,
 CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(promotor_name,'Sem Promotor') ELSE coalesce(seller_name,seller,'N/A') END name,
 sum(amount) val,count(DISTINCT client) pos FROM selected GROUP BY 1,2)
 SELECT jsonb_build_object('schema_version',1,'reference_date',ref,'target_month',to_char(target,'YYYY-MM'),
 'weeks',coalesce((SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM week_data w),'[]'),
 'best_days',(SELECT jsonb_agg(coalesce(b.amount,0) ORDER BY wd) FROM generate_series(0,6) wd LEFT JOIN best b USING(wd)),
 'ranking_fat',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY val DESC,code) FROM(SELECT * FROM ranks ORDER BY val DESC,code LIMIT 10)t),'[]'),
 'ranking_pos',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY pos DESC,val DESC,code) FROM(SELECT * FROM ranks ORDER BY pos DESC,val DESC,code LIMIT 10)t),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.get_coverage_page_v1(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); f jsonb:=p_filters; ref date; start_date date; end_date date; prev_start date; prev_end date;
 custom_date boolean; alt boolean; result jsonb; days integer:=greatest(coalesce((f->>'working_days')::int,0),0);
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(day) FILTER(WHERE source='current'),max(day),current_date) INTO ref FROM dashboard_private.sales_calendar;
 custom_date:=nullif(f->>'date_start','') IS NOT NULL AND nullif(f->>'date_end','') IS NOT NULL;
 start_date:=CASE WHEN custom_date THEN (f->>'date_start')::date ELSE date_trunc('month',ref)::date END;
 end_date:=CASE WHEN custom_date THEN (f->>'date_end')::date ELSE (start_date+interval '1 month - 1 day')::date END;
 IF end_date<start_date THEN RAISE EXCEPTION 'Período inválido' USING ERRCODE='22023'; END IF;
 prev_start:=(start_date-interval '1 month')::date; prev_end:=(end_date-interval '1 month')::date;
 IF NOT custom_date THEN prev_end:=start_date-1; END IF;
 alt:=coalesce(jsonb_array_length(f->'types'),0)>0 AND NOT(coalesce(f->'types' ? '1',false) OR coalesce(f->'types' ? '9',false));
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 seller_sup AS(SELECT DISTINCT seller,supervisor_name FROM assignments),branches AS(SELECT client,filial FROM assignments),
 base_clients AS MATERIALIZED(SELECT c.* FROM clients c WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR EXISTS(SELECT 1 FROM seller_sup ss WHERE ss.seller=c.rca AND (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? ss.supervisor_name,false))) OR coalesce(jsonb_array_length(f->'supervisors'),0)=0)
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? c.rca,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR EXISTS(SELECT 1 FROM branches b WHERE b.client=c.code AND b.filial=f->>'filial'))),
 scoped AS MATERIALIZED(SELECT d.source,d.codcli client,d.produto product,d.day,d.codusur seller,
 d.vlvenda amount,d.unit_price,d.boxes,CASE WHEN alt THEN d.vlbonific ELSE d.vlvenda END value
 FROM (SELECT * FROM dashboard_private.sales_month WHERE NOT custom_date
 UNION ALL SELECT * FROM dashboard_private.sales_day WHERE custom_date) d
 JOIN base_clients c ON c.code=d.codcli WHERE (coalesce(f->>'filial','ambas') IN('ambas','all') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false))),
 filtered AS NOT MATERIALIZED(SELECT * FROM scoped d WHERE ((f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR (d.unit_price IS NOT NULL
 AND (f->>'price_min' IS NULL OR d.unit_price>=(f->>'price_min')::numeric)
 AND (f->>'price_max' IS NULL OR d.unit_price<=(f->>'price_max')::numeric)))),
 periods AS MATERIALIZED(
 SELECT r.*,'current'::text period FROM filtered r WHERE (custom_date AND day BETWEEN start_date AND end_date) OR(NOT custom_date AND source='current')
 UNION ALL SELECT r.*,'previous' FROM filtered r WHERE (custom_date AND day BETWEEN prev_start AND prev_end) OR(NOT custom_date AND source='history' AND day BETWEEN prev_start AND prev_end)
 UNION ALL SELECT r.*,'history' FROM filtered r WHERE NOT custom_date AND source='history' AND day NOT BETWEEN prev_start AND prev_end),
 product_clients AS(SELECT product,client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2,3),
 product_counts AS(SELECT product,count(*) FILTER(WHERE period='current' AND value>=1) current_count,count(*) FILTER(WHERE period='previous' AND value>=1) previous_count FROM product_clients GROUP BY product),
 selection AS(SELECT client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2),
 active_history AS(SELECT client FROM scoped WHERE source='history' GROUP BY client HAVING sum(amount)>=1),
 working AS MATERIALIZED(SELECT DISTINCT day FROM dashboard_private.sales_calendar WHERE extract(isodow FROM day) BETWEEN 1 AND 5
 AND (s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (source='current' AND codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))))),
 working_array AS(SELECT array_agg(day ORDER BY day) dates FROM working),
 stats_amounts AS(SELECT product,coalesce(sum(boxes) FILTER(WHERE period='current'),0) current_boxes,
 coalesce(sum(boxes) FILTER(WHERE period='previous'),0) previous_boxes,bool_or(day<date_trunc('month',ref)::date) has_history
 FROM periods GROUP BY product),
 stats AS MATERIALIZED(SELECT t.*,coalesce(nullif(p.descricao,''),'Produto '||t.product) description,(pd.dtcadastro AT TIME ZONE 'UTC')::date registered
 FROM stats_amounts t LEFT JOIN public.dim_produtos p ON p.codigo=t.product LEFT JOIN public.data_product_details pd ON pd.code=t.product),
 stock AS(SELECT product_code,sum(coalesce(stock_qty,0)) qty FROM public.data_stock WHERE coalesce(f->>'filial','ambas') IN('ambas','all') OR filial=f->>'filial' GROUP BY product_code),
 divisors AS MATERIALIZED(SELECT t.*,coalesce(st.qty,0) stock,coalesce(pc.current_count,0) current_count,coalesce(pc.previous_count,0) previous_count,
 greatest(1,CASE WHEN NOT coalesce(has_history,false) AND current_boxes>0 THEN least(
 greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1),
 CASE WHEN days>0 THEN days ELSE greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1) END)
 ELSE CASE WHEN days>0 THEN least(days,(SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered)) ELSE (SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered) END END)::numeric divisor
 FROM stats t LEFT JOIN stock st ON st.product_code=t.product LEFT JOIN product_counts pc USING(product)),
 -- Daily rows are read only for each product's required trend window, with original price buckets.
 trend_totals AS MATERIALIZED(SELECT dv.product,coalesce(sum(d.boxes*CASE WHEN custom_date THEN
 (CASE WHEN d.day BETWEEN start_date AND end_date THEN 1 ELSE 0 END+CASE WHEN d.day BETWEEN prev_start AND prev_end THEN 1 ELSE 0 END) ELSE 1 END),0)/dv.divisor daily_avg
 FROM divisors dv CROSS JOIN working_array w LEFT JOIN (dashboard_private.sales_day d JOIN base_clients c ON c.code=d.codcli)
 ON d.produto=dv.product AND d.day BETWEEN w.dates[greatest(1,cardinality(w.dates)-dv.divisor::int+1)] AND w.dates[cardinality(w.dates)]
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)) AND ((f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR (d.unit_price IS NOT NULL
 AND (f->>'price_min' IS NULL OR d.unit_price>=(f->>'price_min')::numeric)
 AND (f->>'price_max' IS NULL OR d.unit_price<=(f->>'price_max')::numeric)))
 GROUP BY dv.product,dv.divisor),
 trend AS(SELECT d.*,t.daily_avg FROM divisors d JOIN trend_totals t USING(product)),
 table_all AS MATERIALIZED(SELECT product code,'('||product||') '||description descricao,stock "stockQty",current_boxes "boxesSoldCurrentMonth",previous_boxes "boxesSoldPreviousMonth",
 CASE WHEN previous_boxes>0 THEN (current_boxes-previous_boxes)/previous_boxes*100 WHEN current_boxes>0 THEN NULL ELSE 0 END "boxesVariation",
 CASE WHEN previous_count>0 THEN (current_count-previous_count)::numeric/previous_count*100 WHEN current_count>0 THEN NULL ELSE 0 END "pdvVariation",
 CASE WHEN daily_avg>0 THEN stock/daily_avg WHEN stock>0 THEN NULL ELSE 0 END "trendDays",previous_count "clientsPreviousCount",current_count "clientsCurrentCount",
 CASE WHEN (SELECT count(*) FROM base_clients)>0 THEN current_count::numeric/(SELECT count(*) FROM base_clients)*100 ELSE 0 END "coverageCurrent" FROM trend),
 table_filtered AS MATERIALIZED(SELECT * FROM table_all WHERE "boxesSoldCurrentMonth">0 AND CASE coalesce(f->>'trend','all') WHEN 'low' THEN "trendDays"<15 WHEN 'medium' THEN "trendDays">=15 AND "trendDays"<30 WHEN 'good' THEN "trendDays">=30 ELSE true END),
 cities AS(SELECT c.city name,sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN r.boxes ELSE r.value END) value FROM periods r JOIN base_clients c ON c.code=r.client WHERE r.period='current' GROUP BY c.city),
 ranking AS(SELECT CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(c.promotor_name,'N/A') ELSE coalesce(v.nome,coalesce(nullif(c.rca,''),r.seller),'N/A') END name,
 sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN r.boxes ELSE r.value END) value FROM periods r
 JOIN base_clients c ON c.code=r.client LEFT JOIN public.dim_vendedores v ON v.codigo=coalesce(nullif(c.rca,''),r.seller)
 WHERE r.period='current' GROUP BY 1),
 top_product AS(SELECT * FROM table_all WHERE "coverageCurrent">0 ORDER BY "coverageCurrent" DESC,code LIMIT 1)
 SELECT jsonb_build_object('schema_version',1,'reference_date',ref,'active_clients',(SELECT count(*) FROM base_clients),'active_3m',(SELECT count(*) FROM active_history),
 'current_clients',(SELECT count(*) FROM selection WHERE period='current' AND value>=1),'previous_clients',(SELECT count(*) FROM selection WHERE period='previous' AND value>=1),
 'top',coalesce((SELECT to_jsonb(t) FROM top_product t),'null'),
 'rows',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY "stockQty" DESC,code) FROM table_filtered t),'[]'),
 'total_boxes',coalesce((SELECT sum("boxesSoldCurrentMonth") FROM table_filtered),0),
 'chart_total',coalesce((SELECT sum(value) FROM cities),0),
 'cities',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY value DESC,name) FROM(SELECT * FROM cities ORDER BY value DESC,name LIMIT 10)t),'[]'),
 'ranking',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY value DESC,name) FROM(SELECT * FROM ranking ORDER BY value DESC,name LIMIT 10)t),'[]')) INTO result;
 RETURN result;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dashboard_private FROM PUBLIC,anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dashboard_private TO authenticated;
REVOKE ALL ON FUNCTION public.get_dashboard_filters_v1(text,jsonb),public.get_coverage_page_v1(jsonb),public.get_weekly_page_v1(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_filters_v1(text,jsonb),public.get_coverage_page_v1(jsonb),public.get_weekly_page_v1(jsonb) TO authenticated;

-- Mesma autorização de leitura, avaliada uma vez por consulta.
ALTER POLICY "Acesso Leitura Unificado" ON public.data_product_details USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.data_stock USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.dim_vendedores USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.dim_supervisores USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
NOTIFY pgrst,'reload schema';


-- Migration 20261002230630 shared_monthly_rollups_receivables_summaries
-- Resumos privados: nenhuma mudança nas tabelas originais ou nos downloads legados.
CREATE TABLE IF NOT EXISTS dashboard_private.summary_state (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), dirty boolean NOT NULL DEFAULT true,
 generation bigint NOT NULL DEFAULT 0, refreshed_at timestamptz, last_change timestamptz NOT NULL DEFAULT clock_timestamp());
INSERT INTO dashboard_private.summary_state(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS dashboard_private.sales_day (
 source text NOT NULL, codcli text, produto text, codfor text, filial text, tipovenda text,
 codusur text,codsupervisor text,day date,unit_price numeric,virtual_supplier text,observacaofor text,
 vlvenda numeric NOT NULL,vlbonific numeric NOT NULL,qtvenda numeric NOT NULL,boxes numeric NOT NULL,totpesoliq numeric NOT NULL,
 row_count bigint NOT NULL);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_month (LIKE dashboard_private.sales_day INCLUDING ALL);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_month_core (LIKE dashboard_private.sales_day INCLUDING ALL);
CREATE TABLE IF NOT EXISTS dashboard_private.page_rollups(page text NOT NULL,cache_key jsonb NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(page,cache_key));
CREATE TABLE IF NOT EXISTS dashboard_private.product_suppliers(product text,supplier text,virtual_supplier text);
CREATE TABLE IF NOT EXISTS dashboard_private.receivables_summary(cod_cliente text,dt_vencimento timestamptz,vl_titulos numeric,vl_receber numeric,
 qt_titulos numeric,qt_tit_receber numeric,positive_receber numeric,row_count bigint);
CREATE INDEX IF NOT EXISTS receivables_client_due ON dashboard_private.receivables_summary(cod_cliente,dt_vencimento);
CREATE INDEX IF NOT EXISTS sales_month_core_client ON dashboard_private.sales_month_core(codcli,source);
CREATE INDEX IF NOT EXISTS sales_month_core_supplier ON dashboard_private.sales_month_core(codfor,source);
CREATE TABLE IF NOT EXISTS dashboard_private.weekly_day (
 source text NOT NULL,codcli text,codfor text,filial text,codusur text,codsupervisor text,
 day date,virtual_supplier text,vlvenda numeric NOT NULL);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_facets (
 source text NOT NULL,codcli text,produto text,codfor text,filial text,tipovenda text,day date);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_calendar (source text NOT NULL,codcli text,day date);
CREATE TABLE IF NOT EXISTS dashboard_private.client_assignments (
 client text PRIMARY KEY,seller text,supervisor text,supervisor_name text,filial text);
CREATE INDEX IF NOT EXISTS sales_day_client_date ON dashboard_private.sales_day(codcli,day);
CREATE INDEX IF NOT EXISTS sales_day_supplier_date ON dashboard_private.sales_day(codfor,day);
CREATE INDEX IF NOT EXISTS sales_day_product_date ON dashboard_private.sales_day(produto,day);
CREATE INDEX IF NOT EXISTS sales_month_client ON dashboard_private.sales_month(codcli,source);
CREATE INDEX IF NOT EXISTS sales_month_supplier ON dashboard_private.sales_month(codfor,source);
CREATE INDEX IF NOT EXISTS sales_month_product ON dashboard_private.sales_month(produto,source);
CREATE INDEX IF NOT EXISTS weekly_day_client_date ON dashboard_private.weekly_day(codcli,day);
CREATE INDEX IF NOT EXISTS weekly_day_supplier_date ON dashboard_private.weekly_day(codfor,day);
CREATE INDEX IF NOT EXISTS facets_client ON dashboard_private.sales_facets(codcli);
CREATE INDEX IF NOT EXISTS facets_supplier ON dashboard_private.sales_facets(codfor);
CREATE INDEX IF NOT EXISTS calendar_date ON dashboard_private.sales_calendar(source,day DESC);
CREATE INDEX IF NOT EXISTS calendar_client ON dashboard_private.sales_calendar(codcli,day);

-- Same approved-reader policy as the underlying tables; API endpoints still derive the wallet.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['summary_state','sales_day','sales_month','sales_month_core','weekly_day','sales_facets','sales_calendar','client_assignments','page_rollups','product_suppliers','receivables_summary'] LOOP
  EXECUTE format('ALTER TABLE dashboard_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON dashboard_private.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT ON dashboard_private.%I TO authenticated',t);
  EXECUTE format('DROP POLICY IF EXISTS summary_read ON dashboard_private.%I',t);
  EXECUTE format('CREATE POLICY summary_read ON dashboard_private.%I FOR SELECT TO authenticated USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()))',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.assignments_source_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 raw AS MATERIALIZED(
 SELECT 'current'::text source,codcli,coalesce(nullif(c.rca,''),codusur) seller,codsupervisor,filial,dtped FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))
 UNION ALL SELECT 'history',codcli,coalesce(nullif(c.rca,''),codusur),codsupervisor,filial,dtped FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients'))),
 branch AS MATERIALIZED(SELECT DISTINCT ON(codcli) codcli,seller,filial,codsupervisor,dtped,source FROM raw ORDER BY codcli,source,dtped DESC NULLS LAST,filial),
 sup AS(SELECT DISTINCT ON(seller) seller,codsupervisor FROM branch ORDER BY seller,dtped DESC NULLS LAST,source,codsupervisor)
 SELECT coalesce(c.code,b.codcli),coalesce(nullif(c.rca,''),b.seller),sup.codsupervisor,coalesce(ds.nome,sup.codsupervisor,'N/A'),b.filial
 FROM clients c FULL JOIN branch b ON b.codcli=c.code LEFT JOIN sup ON sup.seller=coalesce(nullif(c.rca,''),b.seller)
 LEFT JOIN public.dim_supervisores ds ON ds.codigo=sup.codsupervisor;
$$;

-- Privileged writer lives outside the exposed schema and checks its caller.
CREATE OR REPLACE FUNCTION dashboard_private.refresh_summaries_v1(force_refresh boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET jit='off' SET work_mem='32MB' AS $$
DECLARE st dashboard_private.summary_state; result jsonb;
BEGIN
 IF NOT ((auth.uid() IS NOT NULL AND public.is_admin()) OR (auth.uid() IS NULL AND session_user IN('postgres','supabase_admin'))) THEN
  RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501';
 END IF;
 IF NOT pg_try_advisory_xact_lock(70261002,1) THEN RETURN jsonb_build_object('status','busy'); END IF;
 SELECT * INTO st FROM dashboard_private.summary_state WHERE id=true;
 IF NOT force_refresh AND NOT st.dirty THEN RETURN jsonb_build_object('status','current','generation',st.generation); END IF;
 -- Capture the revision without locking the upload trigger's state row.
 -- New source commits during the rebuild must leave dirty=true for the next generation.
 -- DELETE/INSERT is atomic under MVCC: concurrent readers keep the previous complete generation.
 DELETE FROM dashboard_private.sales_day;
 INSERT INTO dashboard_private.sales_day
 WITH raw AS MATERIALIZED(
  SELECT 'current'::text source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,
   (dtped AT TIME ZONE 'UTC')::date AS day,coalesce(vlvenda,0) amount,coalesce(vlbonific,0) bonus,coalesce(qtvenda,0) units,coalesce(totpesoliq,0) peso,observacaofor FROM public.data_detailed
  UNION ALL SELECT 'history',codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,
   (dtped AT TIME ZONE 'UTC')::date,coalesce(vlvenda,0),coalesce(vlbonific,0),coalesce(qtvenda,0),coalesce(totpesoliq,0),observacaofor FROM public.data_history),
 enriched AS(SELECT r.*,CASE WHEN units<>0 THEN amount/units END unit_price,
  units/CASE WHEN p.qtde_master>0 THEN p.qtde_master ELSE 1 END boxes,
  CASE WHEN r.codfor='1119' THEN CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END virtual_supplier
  FROM raw r LEFT JOIN public.dim_produtos p ON p.codigo=r.produto)
 SELECT source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,unit_price,virtual_supplier,observacaofor,
 sum(amount),sum(bonus),sum(units),sum(boxes),sum(peso),count(*) FROM enriched
 GROUP BY source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,unit_price,virtual_supplier,observacaofor;
 DELETE FROM dashboard_private.sales_month;
 INSERT INTO dashboard_private.sales_month
 SELECT source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,date_trunc('month',day)::date,unit_price,virtual_supplier,observacaofor,
 sum(vlvenda),sum(vlbonific),sum(qtvenda),sum(boxes),sum(totpesoliq),sum(row_count)
 FROM dashboard_private.sales_day GROUP BY source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,date_trunc('month',day)::date,unit_price,virtual_supplier,observacaofor;
 DELETE FROM dashboard_private.sales_month_core;
 INSERT INTO dashboard_private.sales_month_core SELECT source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,NULL::numeric,virtual_supplier,observacaofor,
 sum(vlvenda),sum(vlbonific),sum(qtvenda),sum(boxes),sum(totpesoliq),sum(row_count) FROM dashboard_private.sales_month
 GROUP BY source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,virtual_supplier,observacaofor;
 DELETE FROM dashboard_private.product_suppliers;
 INSERT INTO dashboard_private.product_suppliers SELECT DISTINCT produto,codfor,virtual_supplier FROM dashboard_private.sales_day;
 DELETE FROM dashboard_private.receivables_summary;
 INSERT INTO dashboard_private.receivables_summary SELECT cod_cliente,dt_vencimento,sum(coalesce(vl_titulos,0)),sum(coalesce(vl_receber,0)),
 sum(coalesce(qt_titulos,0)),sum(coalesce(qt_tit_receber,0)),sum(CASE WHEN vl_receber>0 THEN vl_receber ELSE 0 END),count(*)
 FROM public.data_titulos GROUP BY cod_cliente,dt_vencimento;
 DELETE FROM dashboard_private.weekly_day;
 INSERT INTO dashboard_private.weekly_day SELECT source,codcli,codfor,filial,codusur,codsupervisor,day,virtual_supplier,sum(vlvenda)
 FROM dashboard_private.sales_day GROUP BY source,codcli,codfor,filial,codusur,codsupervisor,day,virtual_supplier;
 DELETE FROM dashboard_private.sales_facets;
 INSERT INTO dashboard_private.sales_facets SELECT source,codcli,produto,codfor,filial,tipovenda,max(day)
 FROM dashboard_private.sales_day GROUP BY source,codcli,produto,codfor,filial,tipovenda,date_trunc('month',day);
 DELETE FROM dashboard_private.sales_calendar;
 INSERT INTO dashboard_private.sales_calendar SELECT DISTINCT source,codcli,day FROM dashboard_private.sales_day;
 DELETE FROM dashboard_private.client_assignments;
 INSERT INTO dashboard_private.client_assignments SELECT * FROM dashboard_private.assignments_source_v1('{"kind":"admin"}');
 DELETE FROM dashboard_private.page_rollups;
 IF to_regprocedure('dashboard_private.coverage_result_v1(jsonb,jsonb)') IS NOT NULL THEN
  INSERT INTO dashboard_private.page_rollups VALUES('coverage','{}',dashboard_private.coverage_result_v1('{"kind":"admin"}','{}')),
  ('coverage','{"suppliers":["707"]}',dashboard_private.coverage_result_v1('{"kind":"admin"}','{"suppliers":["707"]}'));
 END IF;
 IF to_regprocedure('dashboard_private.facet_result_v1(text,jsonb,jsonb)') IS NOT NULL THEN
  INSERT INTO dashboard_private.page_rollups VALUES('filters','{}',dashboard_private.facet_result_v1('coverage','{"kind":"admin"}','{}'));
 END IF;
 ANALYZE dashboard_private.sales_month_core; ANALYZE dashboard_private.receivables_summary;
 ANALYZE dashboard_private.sales_day; ANALYZE dashboard_private.sales_month; ANALYZE dashboard_private.weekly_day;
 ANALYZE dashboard_private.sales_facets; ANALYZE dashboard_private.sales_calendar; ANALYZE dashboard_private.client_assignments;
 UPDATE dashboard_private.summary_state SET dirty=(last_change IS DISTINCT FROM st.last_change),generation=generation+1,refreshed_at=clock_timestamp() WHERE id=true RETURNING
  jsonb_build_object('status','refreshed','generation',generation,'refreshed_at',refreshed_at) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION dashboard_private.assignments_source_v1(jsonb),dashboard_private.refresh_summaries_v1(boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION dashboard_private.refresh_summaries_v1(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_dashboard_summaries_v1()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' SET statement_timeout='60s' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501'; END IF;
 RETURN dashboard_private.refresh_summaries_v1(false);
END $$;
REVOKE ALL ON FUNCTION public.refresh_dashboard_summaries_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.refresh_dashboard_summaries_v1() TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.queue_summaries_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_SCHEMA<>'public' OR TG_TABLE_NAME NOT IN('data_detailed','data_history','data_clients','data_client_promoters','data_hierarchy','dim_produtos','dim_vendedores','dim_supervisores','data_product_details','data_titulos','dim_fornecedores') THEN
  RAISE EXCEPTION 'Origem de atualização inválida';
 END IF;
 IF NOT ((auth.uid() IS NOT NULL AND public.is_admin()) OR (auth.uid() IS NULL AND session_user IN('postgres','supabase_admin'))) THEN
  RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501';
 END IF;
 UPDATE dashboard_private.summary_state SET dirty=true,last_change=clock_timestamp() WHERE id=true;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION dashboard_private.queue_summaries_v1() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['data_detailed','data_history','data_clients','data_client_promoters','data_hierarchy','dim_produtos','dim_vendedores','dim_supervisores','data_product_details','data_titulos','dim_fornecedores'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS dashboard_summary_dirty ON public.%I',t);
  EXECUTE format('CREATE TRIGGER dashboard_summary_dirty AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION dashboard_private.queue_summaries_v1()',t);
 END LOOP;
END $$;
-- One minute safety net for integrations that don't explicitly finish an import.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='dashboard-page-summaries-v1') THEN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='dashboard-page-summaries-v1';
 END IF;
 PERFORM cron.schedule('dashboard-page-summaries-v1','* * * * *','SELECT dashboard_private.refresh_summaries_v1(false)');
END $$;
SELECT dashboard_private.refresh_summaries_v1(true);

CREATE OR REPLACE FUNCTION dashboard_private.assignments_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT a.* FROM dashboard_private.client_assignments a WHERE s->>'kind'='admin'
 OR a.client IN(SELECT jsonb_array_elements_text(s->'clients')) OR a.client IN(SELECT jsonb_array_elements_text(s->'ghosts'));
$$;
GRANT EXECUTE ON FUNCTION dashboard_private.assignments_v1(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION dashboard_private.assignments_v1(jsonb) FROM PUBLIC,anon;


-- Migration 20261002230900 coverage_summary_rollups_and_filter_options
-- Cobertura e Semanal: dados, cálculos e opções de filtros no PostgreSQL.
-- Helpers ficam fora do schema exposto pela API; todos preservam RLS.
CREATE SCHEMA IF NOT EXISTS dashboard_private;
REVOKE ALL ON SCHEMA dashboard_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA dashboard_private TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.scope_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $$
DECLARE r text; kind text; sellers text[]; clients text[]; ghosts text[];
BEGIN
 IF auth.uid() IS NULL OR NOT(public.is_admin() OR public.is_approved()) THEN
  RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501';
 END IF;
 SELECT lower(btrim(role)) INTO r FROM public.profiles WHERE id=auth.uid();
 IF r='adm' THEN RETURN jsonb_build_object('kind','admin'); END IF;
 -- Trade: carteira atribuída, inclusive coordenadores com carteira vazia.
 IF EXISTS(SELECT 1 FROM public.data_hierarchy h WHERE r IN(lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor))))
 OR EXISTS(SELECT 1 FROM public.data_client_promoters WHERE lower(btrim(promoter_code))=r) THEN
  kind:='trade';
  SELECT array_agg(cp.client_code) INTO clients FROM public.data_client_promoters cp
  WHERE lower(btrim(cp.promoter_code))=r OR EXISTS(SELECT 1 FROM public.data_hierarchy h
   WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code)) AND r IN(lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor))));
 ELSE
  SELECT array_agg(DISTINCT codusur) INTO sellers FROM (
   SELECT codusur FROM public.data_detailed WHERE lower(btrim(codsupervisor))=r
   UNION ALL SELECT codusur FROM public.data_history WHERE lower(btrim(codsupervisor))=r) s;
  kind:=CASE WHEN sellers IS NULL THEN 'seller' ELSE 'supervisor' END;
  SELECT array_agg(codigo_cliente) INTO clients FROM public.data_clients
  WHERE (kind='seller' AND lower(btrim(rca1))=r) OR (kind='supervisor' AND rca1=ANY(sellers))
   OR (r='1001' AND upper(coalesce(razaosocial,nomecliente,'')) LIKE '%AMERICANAS%');
  -- Mesmo complemento da carteira legado: clientes com venda atual do vendedor/supervisor.
  SELECT array_agg(DISTINCT codcli) INTO ghosts FROM public.data_detailed
  WHERE (kind='seller' AND lower(btrim(codusur))=r) OR (kind='supervisor' AND lower(btrim(codsupervisor))=r);
 END IF;
 RETURN jsonb_build_object('kind',kind,'clients',coalesce(clients,ARRAY[]::text[]),'ghosts',coalesce(ghosts,ARRAY[]::text[]));
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.clients_v1(s jsonb)
RETURNS TABLE(code text,rca text,city text,rede text,coord text,coord_name text,cocoord text,cocoord_name text,promotor text,promotor_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT c.codigo_cliente,CASE WHEN upper(coalesce(c.razaosocial,c.nomecliente,'')) LIKE '%AMERICANAS%' THEN '1001' ELSE c.rca1 END,
 coalesce(nullif(c.cidade,''),'N/A'),coalesce(nullif(c.ramo,''),'N/A'),h.cod_coord,h.nome_coord,h.cod_cocoord,h.nome_cocoord,cp.promoter_code,coalesce(h.nome_promotor,cp.promoter_code)
 FROM public.data_clients c
 LEFT JOIN public.data_client_promoters cp ON cp.client_code=c.codigo_cliente
 LEFT JOIN LATERAL (SELECT * FROM public.data_hierarchy h WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code)) ORDER BY h.id LIMIT 1) h ON true
 WHERE s->>'kind'='admin' OR c.codigo_cliente IN(SELECT jsonb_array_elements_text(s->'clients'))
 OR c.codigo_cliente IN(SELECT jsonb_array_elements_text(s->'ghosts'));
$$;

CREATE OR REPLACE FUNCTION dashboard_private.matches_v1(f jsonb,k text,v text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(jsonb_array_length(f->k),0)=0 OR coalesce(f->k ? v,false);
$$;
CREATE OR REPLACE FUNCTION dashboard_private.rede_v1(f jsonb,v text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(v,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? v,false))
 WHEN 'sem_rede' THEN coalesce(v,'N/A') IN('','N/A') ELSE true END;
$$;

CREATE OR REPLACE FUNCTION dashboard_private.assignments_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT a.* FROM dashboard_private.client_assignments a WHERE s->>'kind'='admin'
 OR a.client IN(SELECT jsonb_array_elements_text(s->'clients')) OR a.client IN(SELECT jsonb_array_elements_text(s->'ghosts'));
$$;

CREATE OR REPLACE FUNCTION dashboard_private.rows_v1(s jsonb,f jsonb DEFAULT '{}'::jsonb,purpose text DEFAULT 'all')
RETURNS TABLE(source text,client text,product text,supplier text,virtual_supplier text,seller text,seller_name text,supervisor text,supervisor_name text,filial text,sale_type text,day date,amount numeric,bonus numeric,units numeric,boxes numeric,description text,registered date,city text,rede text,coord text,coord_name text,cocoord text,cocoord_name text,promotor text,promotor_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 products AS MATERIALIZED(SELECT * FROM public.dim_produtos), details AS MATERIALIZED(SELECT * FROM public.data_product_details),
 vendors AS MATERIALIZED(SELECT * FROM public.dim_vendedores), supervisors AS MATERIALIZED(SELECT * FROM public.dim_supervisores), raw AS MATERIALIZED(
 SELECT 'current'::text source,d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date AS day,coalesce(d.vlvenda,0) amount,coalesce(d.vlbonific,0) bonus,coalesce(d.qtvenda,0) units
 FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (purpose<>'weekly' OR coalesce(f->>'month','current')='current')
 UNION ALL
 SELECT 'history',d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date,coalesce(d.vlvenda,0),coalesce(d.vlbonific,0),coalesce(d.qtvenda,0)
 FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (purpose<>'weekly' OR ((d.dtped AT TIME ZONE 'UTC')::date >= (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date END)-interval '1 month' AND (d.dtped AT TIME ZONE 'UTC')::date < (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date+interval '1 month' END)))
 ), assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s))
 SELECT r.source,r.codcli,r.produto,r.codfor,CASE WHEN r.codfor='1119' THEN CASE
 WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY'
 WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END,
 coalesce(nullif(c.rca,''),r.codusur),coalesce(v.nome,coalesce(nullif(c.rca,''),r.codusur),'N/A'),
 coalesce(ss.supervisor,r.codsupervisor),coalesce(ds.nome,ss.supervisor,r.codsupervisor,'N/A'),r.filial,r.tipovenda,r.day,r.amount,r.bonus,r.units,
 r.units/CASE WHEN p.qtde_master>0 THEN p.qtde_master ELSE 1 END,
 coalesce(nullif(p.descricao,''),'Produto '||r.produto),(pd.dtcadastro AT TIME ZONE 'UTC')::date,
 coalesce(c.city,'N/A'),coalesce(c.rede,'N/A'),c.coord,c.coord_name,c.cocoord,c.cocoord_name,c.promotor,c.promotor_name
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli
 LEFT JOIN products p ON p.codigo=r.produto
 LEFT JOIN details pd ON pd.code=r.produto
 LEFT JOIN assignments ss ON ss.client=r.codcli
 LEFT JOIN vendors v ON v.codigo=coalesce(nullif(c.rca,''),r.codusur)
 LEFT JOIN supervisors ds ON ds.codigo=coalesce(ss.supervisor,r.codsupervisor);
$$;

-- Page-local planner settings avoid JIT startup and merge joins caused by opaque helper cardinality.
-- Settings restore automatically on function exit; authorization/RLS remain unchanged.
-- As opções são pequenas projeções; nunca retornam linhas de vendas ao navegador.
CREATE OR REPLACE FUNCTION dashboard_private.normalize_page_filters_v1(f jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb:=f; k text; v jsonb;
BEGIN
 FOR k,v IN SELECT * FROM jsonb_each(f) LOOP
  IF v='null'::jsonb OR v='[]'::jsonb OR v='""'::jsonb
   OR (k='filial' AND v IN('"all"'::jsonb,'"ambas"'::jsonb))
   OR (k='mode' AND v='"promoter"'::jsonb) OR (k='month' AND v='"current"'::jsonb)
   OR (k='trend' AND v='"all"'::jsonb) OR (k='metric' AND v='"boxes"'::jsonb)
   OR (k='working_days' AND v='0'::jsonb) THEN result:=result-k; END IF;
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION dashboard_private.normalize_page_filters_v1(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION dashboard_private.normalize_page_filters_v1(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.facet_result_v1(p_page text,s jsonb,p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' AS $$
DECLARE result jsonb; f jsonb:=p_filters;
BEGIN
 IF p_page NOT IN('coverage','weekly') OR jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Página ou filtros inválidos' USING ERRCODE='22023'; END IF;
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 raw AS MATERIALIZED(SELECT * FROM dashboard_private.sales_facets WHERE s->>'kind'='admin'
 OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (source='current' AND codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))),
 rows AS MATERIALIZED(SELECT r.source,r.day,r.filial,r.tipovenda sale_type,r.produto product,r.codfor supplier,
 coalesce(p.descricao,'Produto '||r.produto) description,
 CASE WHEN r.codfor='1119' THEN CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END virtual_supplier,
 a.seller,coalesce(v.nome,a.seller,'N/A') seller_name,a.supervisor_name,c.city,c.rede,c.coord,c.cocoord,c.promotor
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli LEFT JOIN assignments a ON a.client=r.codcli
 LEFT JOIN public.dim_produtos p ON p.codigo=r.produto LEFT JOIN public.dim_vendedores v ON v.codigo=a.seller),
 scope AS MATERIALIZED(SELECT * FROM rows WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false)))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? seller,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? rede,false)) WHEN 'sem_rede' THEN coalesce(rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR filial=f->>'filial')
 AND (coalesce(f->>'city','')='' OR lower(city)=lower(f->>'city'))),
 supplier_options AS (SELECT DISTINCT supplier code,coalesce(df.nome,supplier) label FROM scope LEFT JOIN public.dim_fornecedores df ON df.codigo=scope.supplier
 UNION SELECT DISTINCT virtual_supplier,CASE virtual_supplier WHEN '1119_TODDYNHO' THEN 'TODDYNHO' WHEN '1119_TODDY' THEN 'TODDY' ELSE 'QUAKER / KEROCOCO' END FROM scope WHERE virtual_supplier IS NOT NULL),
 products AS (SELECT DISTINCT product code,'('||product||') '||description label FROM scope WHERE (coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false)),
 sellers AS(SELECT DISTINCT seller code,seller_name label,supervisor_name supervisor FROM rows
 WHERE (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))),
 hierarchy AS(SELECT * FROM clients), months AS(SELECT DISTINCT to_char(day,'YYYY-MM') code FROM raw WHERE day IS NOT NULL)
 SELECT jsonb_build_object('schema_version',1,'reference_date',coalesce((SELECT max(day) FROM rows WHERE source='current'),(SELECT max(day) FROM rows),current_date),
 'suppliers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM supplier_options t),'[]'),
 'products',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM products t),'[]'),
 'types',coalesce((SELECT jsonb_agg(jsonb_build_object('code',sale_type,'label',sale_type) ORDER BY sale_type) FROM (SELECT DISTINCT sale_type FROM scope WHERE sale_type IS NOT NULL)t),'[]'),
 'sellers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM sellers t),'[]'),
 'supervisors',coalesce((SELECT jsonb_agg(jsonb_build_object('code',label,'label',label) ORDER BY label) FROM(SELECT DISTINCT supervisor_name label FROM rows)t),'[]'),
 'coords',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT coord code,coalesce(coord_name,coord) label FROM hierarchy WHERE coord IS NOT NULL)t),'[]'),
 'cocoords',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT cocoord code,coalesce(cocoord_name,cocoord) label FROM hierarchy WHERE cocoord IS NOT NULL AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)))t),'[]'),
 'promotors',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT promotor code,coalesce(promotor_name,promotor) label FROM hierarchy WHERE promotor IS NOT NULL AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)))t),'[]'),
 'cities',coalesce((SELECT jsonb_agg(city ORDER BY city) FROM(SELECT DISTINCT city FROM clients)t),'[]'),
 'redes',coalesce((SELECT jsonb_agg(jsonb_build_object('code',rede,'label',rede) ORDER BY rede) FROM(SELECT DISTINCT rede FROM clients WHERE rede NOT IN('','N/A'))t),'[]'),
 'months',coalesce((SELECT jsonb_agg(code ORDER BY code DESC) FROM months),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.get_dashboard_filters_v1(p_page text,p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET plan_cache_mode='force_custom_plan' SET jit='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb; products jsonb;
BEGIN
 IF p_page NOT IN('coverage','weekly') OR jsonb_typeof(p_filters)<>'object' THEN RAISE EXCEPTION 'Página ou filtros inválidos' USING ERRCODE='22023'; END IF;
 IF s->>'kind'='admin' AND dashboard_private.normalize_page_filters_v1(p_filters-'suppliers')='{}'::jsonb THEN
  SELECT payload INTO result FROM dashboard_private.page_rollups WHERE page='filters' AND cache_key='{}'::jsonb;
  IF FOUND THEN
   IF coalesce(jsonb_array_length(p_filters->'suppliers'),0)>0 THEN
    SELECT coalesce(jsonb_agg(p.item ORDER BY p.ordinal),'[]'::jsonb) INTO products
    FROM jsonb_array_elements(result->'products') WITH ORDINALITY p(item,ordinal)
    WHERE EXISTS(SELECT 1 FROM dashboard_private.product_suppliers x WHERE x.product=p.item->>'code'
     AND (coalesce(p_filters->'suppliers' ? x.supplier,false) OR coalesce(p_filters->'suppliers' ? x.virtual_supplier,false)));
    result:=jsonb_set(result,'{products}',products);
   END IF;
   RETURN result;
  END IF;
 END IF;
 RETURN dashboard_private.facet_result_v1(p_page,s,p_filters);
END $$;

CREATE OR REPLACE FUNCTION public.get_weekly_page_v1(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); f jsonb:=p_filters; ref date; target date; result jsonb;
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(day) FILTER(WHERE source='current'),max(day),current_date) INTO ref FROM dashboard_private.sales_calendar;
 target:=CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',ref)::date ELSE ((f->>'month')||'-01')::date END;
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 rows AS MATERIALIZED(SELECT d.source,d.codcli client,d.day,d.vlvenda amount,d.codfor supplier,d.virtual_supplier,
 coalesce(nullif(c.rca,''),d.codusur) seller,coalesce(v.nome,coalesce(nullif(c.rca,''),d.codusur),'N/A') seller_name,
 coalesce(a.supervisor_name,ds.nome,d.codsupervisor,'N/A') supervisor_name,d.filial,coalesce(c.rede,'N/A') rede,
 c.coord,c.cocoord,c.promotor,c.promotor_name FROM dashboard_private.weekly_day d
 LEFT JOIN clients c ON c.code=d.codcli LEFT JOIN assignments a ON a.client=d.codcli
 LEFT JOIN public.dim_vendedores v ON v.codigo=coalesce(nullif(c.rca,''),d.codusur)
 LEFT JOIN public.dim_supervisores ds ON ds.codigo=d.codsupervisor
 WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (d.source='current' AND d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))))
 AND ((coalesce(f->>'month','current')='current' AND d.source='current') OR (d.source='history' AND d.day>=target-interval '1 month' AND d.day<target+interval '1 month'))),
 filtered AS MATERIALIZED(SELECT * FROM rows WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false)))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? seller,false))
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? rede,false)) WHEN 'sem_rede' THEN coalesce(rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR filial=f->>'filial')),
 selected AS MATERIALIZED(SELECT * FROM filtered WHERE
 (coalesce(f->>'month','current')='current' AND source='current') OR (coalesce(f->>'month','current')<>'current' AND source='history' AND day>=target AND day<target+interval '1 month')),
 first_day AS(SELECT target+CASE extract(isodow FROM target)::int WHEN 6 THEN 2 WHEN 7 THEN 1 ELSE 0 END first),
 week_starts AS(SELECT first start FROM first_day UNION SELECT d::date FROM first_day,generate_series(date_trunc('week',first::timestamp)+interval '7 days',target::timestamp+interval '1 month - 1 day',interval '7 days') d),
 weeks AS(SELECT row_number() OVER(ORDER BY start) id,start,least((date_trunc('week',start::timestamp)+interval '6 days')::date,(target+interval '1 month - 1 day')::date) finish FROM week_starts),
 daily AS(SELECT w.id,extract(dow FROM s.day)::int weekday,sum(s.amount) amount FROM weeks w JOIN selected s ON s.day BETWEEN w.start AND w.finish GROUP BY 1,2),
 week_data AS(SELECT w.id,w.start,w.finish "end",coalesce((SELECT sum(amount) FROM daily d WHERE d.id=w.id),0) total,
 (SELECT jsonb_agg(coalesce(d.amount,0) ORDER BY wd) FROM generate_series(0,6) wd LEFT JOIN daily d ON d.id=w.id AND d.weekday=wd) days FROM weeks w),
 best_daily AS(SELECT day,sum(amount) amount FROM filtered WHERE source='history' AND day>=target-interval '1 month' AND day<target GROUP BY day),
 best AS(SELECT extract(dow FROM day)::int wd,greatest(max(amount),0) amount FROM best_daily GROUP BY 1),
 ranks AS(SELECT CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(promotor,'Sem Promotor') ELSE coalesce(seller,'N/A') END code,
 CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(promotor_name,'Sem Promotor') ELSE coalesce(seller_name,seller,'N/A') END name,
 sum(amount) val,count(DISTINCT client) pos FROM selected GROUP BY 1,2)
 SELECT jsonb_build_object('schema_version',1,'reference_date',ref,'target_month',to_char(target,'YYYY-MM'),
 'weeks',coalesce((SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM week_data w),'[]'),
 'best_days',(SELECT jsonb_agg(coalesce(b.amount,0) ORDER BY wd) FROM generate_series(0,6) wd LEFT JOIN best b USING(wd)),
 'ranking_fat',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY val DESC,code) FROM(SELECT * FROM ranks ORDER BY val DESC,code LIMIT 10)t),'[]'),
 'ranking_pos',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY pos DESC,val DESC,code) FROM(SELECT * FROM ranks ORDER BY pos DESC,val DESC,code LIMIT 10)t),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.coverage_result_v1(s jsonb,p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' AS $$
DECLARE f jsonb:=p_filters; ref date; start_date date; end_date date; prev_start date; prev_end date;
 custom_date boolean; alt boolean; result jsonb; days integer:=greatest(coalesce((f->>'working_days')::int,0),0);
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(day) FILTER(WHERE source='current'),max(day),current_date) INTO ref FROM dashboard_private.sales_calendar;
 custom_date:=nullif(f->>'date_start','') IS NOT NULL AND nullif(f->>'date_end','') IS NOT NULL;
 start_date:=CASE WHEN custom_date THEN (f->>'date_start')::date ELSE date_trunc('month',ref)::date END;
 end_date:=CASE WHEN custom_date THEN (f->>'date_end')::date ELSE (start_date+interval '1 month - 1 day')::date END;
 IF end_date<start_date THEN RAISE EXCEPTION 'Período inválido' USING ERRCODE='22023'; END IF;
 prev_start:=(start_date-interval '1 month')::date; prev_end:=(end_date-interval '1 month')::date;
 IF NOT custom_date THEN prev_end:=start_date-1; END IF;
 alt:=coalesce(jsonb_array_length(f->'types'),0)>0 AND NOT(coalesce(f->'types' ? '1',false) OR coalesce(f->'types' ? '9',false));
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 seller_sup AS(SELECT DISTINCT seller,supervisor_name FROM assignments),branches AS(SELECT client,filial FROM assignments),
 base_clients AS MATERIALIZED(SELECT c.* FROM clients c WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR EXISTS(SELECT 1 FROM seller_sup ss WHERE ss.seller=c.rca AND (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? ss.supervisor_name,false))) OR coalesce(jsonb_array_length(f->'supervisors'),0)=0)
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? c.rca,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR EXISTS(SELECT 1 FROM branches b WHERE b.client=c.code AND b.filial=f->>'filial'))),
 scoped AS MATERIALIZED(SELECT d.source,d.codcli client,d.produto product,d.day,d.codusur seller,
 d.vlvenda amount,d.unit_price,d.boxes,CASE WHEN alt THEN d.vlbonific ELSE d.vlvenda END value
 FROM (SELECT * FROM dashboard_private.sales_month_core WHERE NOT custom_date AND f->>'price_min' IS NULL AND f->>'price_max' IS NULL
 UNION ALL SELECT * FROM dashboard_private.sales_month WHERE NOT custom_date AND (f->>'price_min' IS NOT NULL OR f->>'price_max' IS NOT NULL)
 UNION ALL SELECT * FROM dashboard_private.sales_day WHERE custom_date) d
 JOIN base_clients c ON c.code=d.codcli WHERE (coalesce(f->>'filial','ambas') IN('ambas','all') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false))),
 filtered AS NOT MATERIALIZED(SELECT * FROM scoped d WHERE ((f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR (d.unit_price IS NOT NULL
 AND (f->>'price_min' IS NULL OR d.unit_price>=(f->>'price_min')::numeric)
 AND (f->>'price_max' IS NULL OR d.unit_price<=(f->>'price_max')::numeric)))),
 periods AS MATERIALIZED(
 SELECT r.*,'current'::text period FROM filtered r WHERE (custom_date AND day BETWEEN start_date AND end_date) OR(NOT custom_date AND source='current')
 UNION ALL SELECT r.*,'previous' FROM filtered r WHERE (custom_date AND day BETWEEN prev_start AND prev_end) OR(NOT custom_date AND source='history' AND day BETWEEN prev_start AND prev_end)
 UNION ALL SELECT r.*,'history' FROM filtered r WHERE NOT custom_date AND source='history' AND day NOT BETWEEN prev_start AND prev_end),
 product_clients AS(SELECT product,client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2,3),
 product_counts AS(SELECT product,count(*) FILTER(WHERE period='current' AND value>=1) current_count,count(*) FILTER(WHERE period='previous' AND value>=1) previous_count FROM product_clients GROUP BY product),
 selection AS(SELECT client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2),
 active_history AS(SELECT client FROM scoped WHERE source='history' GROUP BY client HAVING sum(amount)>=1),
 working AS MATERIALIZED(SELECT DISTINCT day FROM dashboard_private.sales_calendar WHERE extract(isodow FROM day) BETWEEN 1 AND 5
 AND (s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (source='current' AND codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))))),
 working_array AS(SELECT array_agg(day ORDER BY day) dates FROM working),
 stats_amounts AS(SELECT product,coalesce(sum(boxes) FILTER(WHERE period='current'),0) current_boxes,
 coalesce(sum(boxes) FILTER(WHERE period='previous'),0) previous_boxes,bool_or(day<date_trunc('month',ref)::date) has_history
 FROM periods GROUP BY product),
 stats AS MATERIALIZED(SELECT t.*,coalesce(nullif(p.descricao,''),'Produto '||t.product) description,(pd.dtcadastro AT TIME ZONE 'UTC')::date registered
 FROM stats_amounts t LEFT JOIN public.dim_produtos p ON p.codigo=t.product LEFT JOIN public.data_product_details pd ON pd.code=t.product),
 stock AS(SELECT product_code,sum(coalesce(stock_qty,0)) qty FROM public.data_stock WHERE coalesce(f->>'filial','ambas') IN('ambas','all') OR filial=f->>'filial' GROUP BY product_code),
 divisors AS MATERIALIZED(SELECT t.*,coalesce(st.qty,0) stock,coalesce(pc.current_count,0) current_count,coalesce(pc.previous_count,0) previous_count,
 greatest(1,CASE WHEN NOT coalesce(has_history,false) AND current_boxes>0 THEN least(
 greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1),
 CASE WHEN days>0 THEN days ELSE greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1) END)
 ELSE CASE WHEN days>0 THEN least(days,(SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered)) ELSE (SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered) END END)::numeric divisor
 FROM stats t LEFT JOIN stock st ON st.product_code=t.product LEFT JOIN product_counts pc USING(product)),
 -- Daily rows are read only for each product's required trend window, with original price buckets.
 trend_totals AS MATERIALIZED(SELECT dv.product,coalesce(sum(d.boxes*CASE WHEN custom_date THEN
 (CASE WHEN d.day BETWEEN start_date AND end_date THEN 1 ELSE 0 END+CASE WHEN d.day BETWEEN prev_start AND prev_end THEN 1 ELSE 0 END) ELSE 1 END),0)/dv.divisor daily_avg
 FROM divisors dv CROSS JOIN working_array w LEFT JOIN (dashboard_private.sales_day d JOIN base_clients c ON c.code=d.codcli)
 ON d.produto=dv.product AND d.day BETWEEN w.dates[greatest(1,cardinality(w.dates)-dv.divisor::int+1)] AND w.dates[cardinality(w.dates)]
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)) AND ((f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR (d.unit_price IS NOT NULL
 AND (f->>'price_min' IS NULL OR d.unit_price>=(f->>'price_min')::numeric)
 AND (f->>'price_max' IS NULL OR d.unit_price<=(f->>'price_max')::numeric)))
 GROUP BY dv.product,dv.divisor),
 trend AS(SELECT d.*,t.daily_avg FROM divisors d JOIN trend_totals t USING(product)),
 table_all AS MATERIALIZED(SELECT product code,'('||product||') '||description descricao,stock "stockQty",current_boxes "boxesSoldCurrentMonth",previous_boxes "boxesSoldPreviousMonth",
 CASE WHEN previous_boxes>0 THEN (current_boxes-previous_boxes)/previous_boxes*100 WHEN current_boxes>0 THEN NULL ELSE 0 END "boxesVariation",
 CASE WHEN previous_count>0 THEN (current_count-previous_count)::numeric/previous_count*100 WHEN current_count>0 THEN NULL ELSE 0 END "pdvVariation",
 CASE WHEN daily_avg>0 THEN stock/daily_avg WHEN stock>0 THEN NULL ELSE 0 END "trendDays",previous_count "clientsPreviousCount",current_count "clientsCurrentCount",
 CASE WHEN (SELECT count(*) FROM base_clients)>0 THEN current_count::numeric/(SELECT count(*) FROM base_clients)*100 ELSE 0 END "coverageCurrent" FROM trend),
 table_filtered AS MATERIALIZED(SELECT * FROM table_all WHERE "boxesSoldCurrentMonth">0 AND CASE coalesce(f->>'trend','all') WHEN 'low' THEN "trendDays"<15 WHEN 'medium' THEN "trendDays">=15 AND "trendDays"<30 WHEN 'good' THEN "trendDays">=30 ELSE true END),
 cities AS(SELECT c.city name,sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN r.boxes ELSE r.value END) value FROM periods r JOIN base_clients c ON c.code=r.client WHERE r.period='current' GROUP BY c.city),
 ranking AS(SELECT CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(c.promotor_name,'N/A') ELSE coalesce(v.nome,coalesce(nullif(c.rca,''),r.seller),'N/A') END name,
 sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN r.boxes ELSE r.value END) value FROM periods r
 JOIN base_clients c ON c.code=r.client LEFT JOIN public.dim_vendedores v ON v.codigo=coalesce(nullif(c.rca,''),r.seller)
 WHERE r.period='current' GROUP BY 1),
 top_product AS(SELECT * FROM table_all WHERE "coverageCurrent">0 ORDER BY "coverageCurrent" DESC,code LIMIT 1)
 SELECT jsonb_build_object('schema_version',1,'reference_date',ref,'active_clients',(SELECT count(*) FROM base_clients),'active_3m',(SELECT count(*) FROM active_history),
 'current_clients',(SELECT count(*) FROM selection WHERE period='current' AND value>=1),'previous_clients',(SELECT count(*) FROM selection WHERE period='previous' AND value>=1),
 'top',coalesce((SELECT to_jsonb(t) FROM top_product t),'null'),
 'rows',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY "stockQty" DESC,code) FROM table_filtered t),'[]'),
 'total_boxes',coalesce((SELECT sum("boxesSoldCurrentMonth") FROM table_filtered),0),
 'chart_total',coalesce((SELECT sum(value) FROM cities),0),
 'cities',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY value DESC,name) FROM(SELECT * FROM cities ORDER BY value DESC,name LIMIT 10)t),'[]'),
 'ranking',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY value DESC,name) FROM(SELECT * FROM ranking ORDER BY value DESC,name LIMIT 10)t),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.get_coverage_page_v1(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET plan_cache_mode='force_custom_plan' SET jit='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb;
BEGIN
 IF jsonb_typeof(p_filters)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 IF s->>'kind'='admin' THEN
  SELECT payload INTO result FROM dashboard_private.page_rollups WHERE page='coverage' AND cache_key=dashboard_private.normalize_page_filters_v1(p_filters);
  IF FOUND THEN RETURN result; END IF;
 END IF;
 RETURN dashboard_private.coverage_result_v1(s,p_filters);
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dashboard_private FROM PUBLIC,anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dashboard_private TO authenticated;
REVOKE ALL ON FUNCTION public.get_dashboard_filters_v1(text,jsonb),public.get_coverage_page_v1(jsonb),public.get_weekly_page_v1(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_filters_v1(text,jsonb),public.get_coverage_page_v1(jsonb),public.get_weekly_page_v1(jsonb) TO authenticated;

-- Mesma autorização de leitura, avaliada uma vez por consulta.
ALTER POLICY "Acesso Leitura Unificado" ON public.data_product_details USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.data_stock USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.dim_vendedores USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.dim_supervisores USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
NOTIFY pgrst,'reload schema';


-- Migration 20261002231606 comparison_kpis_shared_summary_v1
-- Etapa 1: KPIs do Comparativo. Filtros de carteira ainda vêm do fluxo legado.
-- A lista de clientes é uma seleção, NÃO uma autorização; RLS continua aplicada.
-- Não executar o consolidado inteiro para instalar esta função.
CREATE OR REPLACE FUNCTION public.get_comparison_kpis_v1(p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = '' SET statement_timeout = '15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB'
AS $fn$
DECLARE
  result jsonb;
  ref_date date := (p_filters->>'reference_date')::date;
  client_codes text[];
  suppliers text[];
  products text[];
  types text[];
  holidays text[];
  alt_mode boolean;
  total_days integer;
  passed_days integer;
  ratio numeric := 1;
  caller_role text;
  allowed_clients text[];
  is_admin boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_admin() OR public.is_approved()) THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  SELECT lower(btrim(role)) INTO caller_role FROM public.profiles WHERE id=auth.uid();
  is_admin := caller_role='adm';
  -- Carteira derivada da sessão. Os códigos enviados só restringem o resultado.
  SELECT array_agg(cp.client_code) INTO allowed_clients
  FROM public.data_client_promoters cp
  WHERE lower(btrim(cp.promoter_code))=caller_role OR EXISTS (
    SELECT 1 FROM public.data_hierarchy h
    WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code))
      AND caller_role IN (lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor)))
  );
  IF allowed_clients IS NULL AND EXISTS (
    SELECT 1 FROM public.data_hierarchy h WHERE caller_role IN
      (lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor)))) THEN
    allowed_clients := ARRAY[]::text[];
  END IF;
  IF jsonb_typeof(p_filters) <> 'object' OR ref_date IS NULL
     OR jsonb_typeof(p_filters->'client_codes') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'reference_date e client_codes são obrigatórios' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO client_codes FROM jsonb_array_elements_text(p_filters->'client_codes');
  SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO suppliers FROM jsonb_array_elements_text(coalesce(p_filters->'suppliers','[]'));
  SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO products FROM jsonb_array_elements_text(coalesce(p_filters->'products','[]'));
  SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO types FROM jsonb_array_elements_text(coalesce(p_filters->'types','[]'));
  SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO holidays FROM jsonb_array_elements_text(coalesce(p_filters->'holidays','[]'));
  alt_mode := cardinality(types)>0 AND NOT ('1'=ANY(types) OR '9'=ANY(types));
  SELECT count(*), greatest(count(*) FILTER(WHERE d::date<=ref_date),1)
  INTO total_days, passed_days
  FROM pg_catalog.generate_series(date_trunc('month',ref_date::timestamp), date_trunc('month',ref_date::timestamp)+interval '1 month - 1 day', interval '1 day') d
  WHERE extract(isodow FROM d) BETWEEN 1 AND 5 AND NOT (to_char(d,'YYYY-MM-DD')=ANY(holidays));
  IF coalesce((p_filters->>'tendency')::boolean,false) AND passed_days<total_days AND total_days>0 THEN
    ratio := total_days::numeric/passed_days;
  END IF;

  WITH selected_clients AS MATERIALIZED (
    SELECT DISTINCT unnest(client_codes) codcli
  ), client_info AS MATERIALIZED (
    SELECT codigo_cliente,cidade,ramo FROM public.data_clients
  ), product_info AS MATERIALIZED (
    SELECT codigo,descricao,
      (CASE WHEN upper(descricao) LIKE '%CHEETOS%' THEN 1 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%DORITOS%' THEN 2 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%FANDANGOS%' THEN 4 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%RUFFLES%' THEN 8 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%TORCIDA%' THEN 16 ELSE 0 END) salty_mask,
      (CASE WHEN upper(descricao) LIKE '%TODDYNHO%' THEN 1 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%TODDY %' THEN 2 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%QUAKER%' THEN 4 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%KEROCOCO%' THEN 8 ELSE 0 END) foods_mask
    FROM public.dim_produtos
  ), supplier_info AS MATERIALIZED (
    SELECT codigo,pasta,nome FROM public.dim_fornecedores
  ), filtered AS MATERIALIZED (
    SELECT r.source,r.codcli,r.produto,r.codfor,r.tipovenda,r.totpesoliq,c.ramo,
      CASE WHEN alt_mode THEN coalesce(r.vlbonific,0) ELSE coalesce(r.vlvenda,0) END amount,
      to_char(r.dtped AT TIME ZONE 'UTC','YYYY-MM') month_key,r.vlbonific
    FROM (
    SELECT source, codcli, produto, codfor, filial, tipovenda, day::timestamp AT TIME ZONE 'UTC' dtped,
           vlvenda, vlbonific, totpesoliq, observacaofor FROM dashboard_private.sales_month_core
    WHERE source='current' AND codcli IN (SELECT codcli FROM selected_clients) AND (is_admin OR (allowed_clients IS NOT NULL AND codcli=ANY(allowed_clients))
      OR (allowed_clients IS NULL AND lower(btrim(codusur))=caller_role))
    UNION ALL
    SELECT source, codcli, produto, codfor, filial, tipovenda, day::timestamp AT TIME ZONE 'UTC',
           vlvenda, vlbonific, totpesoliq, observacaofor FROM dashboard_private.sales_month_core
    WHERE source='history' AND codcli IN (SELECT codcli FROM selected_clients) AND (is_admin OR (allowed_clients IS NOT NULL AND codcli=ANY(allowed_clients))
      OR (allowed_clients IS NULL AND lower(btrim(codusur))=caller_role))
    ) r
    LEFT JOIN client_info c ON c.codigo_cliente=r.codcli
    LEFT JOIN product_info dp ON dp.codigo=r.produto
    LEFT JOIN supplier_info df ON df.codigo=r.codfor
    WHERE (coalesce(p_filters->>'filial','ambas')='ambas' OR r.filial=p_filters->>'filial')
      AND (coalesce(p_filters->>'city','')='' OR lower(coalesce(c.cidade,'N/A'))=p_filters->>'city')
      AND (coalesce(p_filters->>'pasta','')='' OR (CASE WHEN coalesce(r.observacaofor,'') NOT IN ('','0','00','N/A') THEN r.observacaofor WHEN coalesce(df.pasta,'')<>'' THEN df.pasta WHEN upper(coalesce(df.nome,r.codfor)) LIKE '%PEPSICO%' THEN 'PEPSICO' ELSE 'MULTIMARCAS' END)=p_filters->>'pasta')
      AND (cardinality(products)=0 OR r.produto=ANY(products))
      AND (cardinality(suppliers)=0 OR r.codfor=ANY(suppliers) OR
        (r.codfor='1119' AND (CASE
          WHEN upper(coalesce(nullif(dp.descricao,''),'Produto '||btrim(r.produto))) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO'
          WHEN upper(coalesce(nullif(dp.descricao,''),'Produto '||btrim(r.produto))) LIKE '%TODDY%' THEN '1119_TODDY'
          WHEN upper(coalesce(nullif(dp.descricao,''),'Produto '||btrim(r.produto))) LIKE '%QUAKER%' OR upper(coalesce(nullif(dp.descricao,''),'Produto '||btrim(r.produto))) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO'
          END)=ANY(suppliers)))
  ), sales AS MATERIALIZED (
    SELECT * FROM filtered
    WHERE (cardinality(types)=0 OR tipovenda=ANY(types)) AND (alt_mode OR tipovenda IN ('1','9'))
  ), totals AS (
    SELECT source,sum(amount) fat,sum(coalesce(totpesoliq,0)) peso FROM sales GROUP BY source
  ), losses AS (
    SELECT source,sum(coalesce(vlbonific,0)) perdas FROM filtered
    WHERE tipovenda='5' AND upper(coalesce(ramo,'')) NOT LIKE '%AMERICANAS%' AND upper(coalesce(ramo,'')) NOT LIKE '%BH%'
    GROUP BY source
  ), client_totals AS (
    SELECT source,CASE WHEN source='current' THEN '' ELSE month_key END m,codcli,sum(amount) amount
    FROM sales WHERE codcli IS NOT NULL AND codcli<>'' AND (source='current' OR month_key IS NOT NULL)
    GROUP BY 1,2,3
  ), client_counts AS (
    SELECT source,m,count(*) FILTER(WHERE amount>=1) clients FROM client_totals GROUP BY 1,2
  ), product_totals AS (
    SELECT source,CASE WHEN source='current' THEN '' ELSE month_key END m,codcli,produto,
      min(codfor) codfor,sum(amount) amount
    FROM sales WHERE codcli IS NOT NULL AND codcli<>'' AND (source='current' OR month_key IS NOT NULL)
    GROUP BY 1,2,3,4
  ), mixes AS (
    SELECT source,m,codcli,
      count(*) FILTER(WHERE amount>=1 AND codfor IN ('707','708','752')) mix,
      bit_or(CASE WHEN amount>=1 THEN coalesce(pi.salty_mask,0) ELSE 0 END)=31 salty,
      bit_or(CASE WHEN amount>=1 THEN coalesce(pi.foods_mask,0) ELSE 0 END)=15 foods
    FROM product_totals pt LEFT JOIN product_info pi ON pi.codigo=pt.produto GROUP BY source,m,codcli
  ), month_mix AS (
    SELECT source,m,coalesce(avg(mix) FILTER(WHERE mix>0),0) mix,
      count(*) FILTER(WHERE salty) salty,count(*) FILTER(WHERE foods) foods FROM mixes GROUP BY 1,2
  ), latest AS (
    SELECT month_key FROM sales WHERE source='history' AND month_key IS NOT NULL GROUP BY month_key ORDER BY month_key DESC LIMIT 3
  ), kpis AS (
    SELECT 'current' source,
      coalesce((SELECT clients FROM client_counts WHERE source='current'),0)::numeric clients,
      coalesce((SELECT mix FROM month_mix WHERE source='current'),0) mix,
      coalesce((SELECT salty FROM month_mix WHERE source='current'),0)::numeric salty,
      coalesce((SELECT foods FROM month_mix WHERE source='current'),0)::numeric foods
    UNION ALL
    SELECT 'history',
      coalesce((SELECT sum(clients) FROM client_counts WHERE source='history' AND m IN(SELECT month_key FROM latest)),0)/3.0,
      coalesce((SELECT sum(mix) FROM month_mix WHERE source='history' AND m IN(SELECT month_key FROM latest)),0)/3.0,
      coalesce((SELECT sum(salty) FROM month_mix WHERE source='history' AND m IN(SELECT month_key FROM latest)),0)/3.0,
      coalesce((SELECT sum(foods) FROM month_mix WHERE source='history' AND m IN(SELECT month_key FROM latest)),0)/3.0
  ), final AS (
    SELECT k.source,coalesce(t.fat,0)/CASE WHEN k.source='current' THEN 1 ELSE 3.0 END*CASE WHEN k.source='current' THEN ratio ELSE 1 END fat,
      coalesce(t.peso,0)/CASE WHEN k.source='current' THEN 1 ELSE 3.0 END*CASE WHEN k.source='current' THEN ratio ELSE 1 END peso,
      CASE WHEN k.source='current' AND ratio<>1 THEN floor(k.clients*ratio+0.5) ELSE k.clients END clients,
      k.mix,
      CASE WHEN k.source='current' AND ratio<>1 THEN floor(k.salty*ratio+0.5) ELSE k.salty END salty,
      CASE WHEN k.source='current' AND ratio<>1 THEN floor(k.foods*ratio+0.5) ELSE k.foods END foods,
      coalesce(l.perdas,0)/CASE WHEN k.source='current' THEN 1 ELSE 3.0 END*CASE WHEN k.source='current' THEN ratio ELSE 1 END perdas
    FROM kpis k LEFT JOIN totals t USING(source) LEFT JOIN losses l USING(source)
  )
  SELECT jsonb_build_object('schema_version',1,'reference_date',ref_date,'tendency_ratio',ratio,
    'kpis',jsonb_object_agg(source,jsonb_build_object('fat',fat,'peso',peso,'clients',clients,'mixPepsico',mix,
      'positivacaoSalty',salty,'positivacaoFoods',foods,'perdas',perdas,'ticket',CASE WHEN clients>0 THEN fat/clients ELSE 0 END)))
  INTO result FROM final;
  RETURN result;
END;
$fn$;
REVOKE ALL ON FUNCTION public.get_comparison_kpis_v1(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_comparison_kpis_v1(jsonb) TO authenticated;


-- Migration 20261002231609 titles_shared_summary_v1
-- Títulos: KPIs resumidos por cliente/vencimento; linhas originais e paginação preservadas.
CREATE OR REPLACE FUNCTION public.get_titulos_view_data(p_filial text[] DEFAULT NULL::text[], p_cidade text[] DEFAULT NULL::text[], p_supervisor text[] DEFAULT NULL::text[], p_vendedor text[] DEFAULT NULL::text[], p_rede text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text, p_coordenador text[] DEFAULT NULL::text[], p_cocoordenador text[] DEFAULT NULL::text[], p_page integer DEFAULT 0, p_limit integer DEFAULT 50)
 RETURNS json
 LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET plan_cache_mode='force_custom_plan' SET jit='off' AS $function$
DECLARE s jsonb:=dashboard_private.scope_v1(); result json; v_critical_date date:=CURRENT_DATE-60;
BEGIN
 IF p_page<0 OR p_limit<1 THEN RAISE EXCEPTION 'Paginação inválida' USING ERRCODE='22023'; END IF;
 WITH authorized AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 filtered AS MATERIALIZED(SELECT
        t.cod_cliente,
        t.vl_titulos,
        t.vl_receber,
        t.dt_vencimento,t.row_count,t.positive_receber,
        COALESCE(c.nomecliente, c.razaosocial, c.fantasia, 'Desconhecido') AS nomecliente,
        COALESCE(c.cidade, 'N/A') AS cidade,
        COALESCE(c.rca1, 'N/A') AS vendedor_nome,
        c.ramo,
        c.filial,
        c.supervisor
    FROM dashboard_private.receivables_summary t
    LEFT JOIN public.data_clients c ON (
        COALESCE(c.codigo_cliente, c.cod_cliente, '')::text = t.cod_cliente::text
        OR TRIM(LEADING '0' FROM COALESCE(c.codigo_cliente, c.cod_cliente, '')::text) = TRIM(LEADING '0' FROM t.cod_cliente::text)
    )
    WHERE (p_cidade IS NULL OR c.cidade = ANY(p_cidade))
      AND (
          p_filial IS NULL
          OR c.filial = ANY(p_filial)
          OR TRIM(c.filial) = ANY(p_filial)
          OR TRIM(LEADING '0' FROM COALESCE(c.filial, '')) = ANY(
              SELECT TRIM(LEADING '0' FROM elem) FROM unnest(p_filial) AS elem
          )
          OR LPAD(TRIM(COALESCE(c.filial, '')), 2, '0') = ANY(
              SELECT LPAD(TRIM(elem), 2, '0') FROM unnest(p_filial) AS elem
          )
          OR EXISTS (
              SELECT 1 FROM unnest(p_filial) elem
              WHERE c.filial ILIKE '%' || elem || '%'
          )
          OR EXISTS (
              SELECT 1 FROM public.config_city_branches ccb
              WHERE UPPER(ccb.cidade) = UPPER(COALESCE(c.cidade, ''))
                AND (
                    ccb.filial = ANY(p_filial)
                    OR TRIM(ccb.filial) = ANY(p_filial)
                    OR TRIM(LEADING '0' FROM COALESCE(ccb.filial, '')) = ANY(
                        SELECT TRIM(LEADING '0' FROM elem) FROM unnest(p_filial) AS elem
                    )
                    OR LPAD(TRIM(COALESCE(ccb.filial, '')), 2, '0') = ANY(
                        SELECT LPAD(TRIM(elem), 2, '0') FROM unnest(p_filial) AS elem
                    )
                )
          )
      )
      AND (
          p_supervisor IS NULL
          OR c.supervisor = ANY(p_supervisor)
          OR c.cod_supervisor = ANY(p_supervisor)
          OR UPPER(TRIM(COALESCE(c.supervisor, ''))) = ANY(SELECT UPPER(TRIM(elem)) FROM unnest(p_supervisor) AS elem)
          OR UPPER(TRIM(COALESCE(c.cod_supervisor, ''))) = ANY(SELECT UPPER(TRIM(elem)) FROM unnest(p_supervisor) AS elem)
          OR EXISTS (
              SELECT 1 FROM unnest(p_supervisor) elem
              WHERE (c.supervisor IS NOT NULL AND (c.supervisor ILIKE '%' || elem || '%' OR elem ILIKE '%' || c.supervisor || '%'))
                 OR (c.cod_supervisor IS NOT NULL AND (c.cod_supervisor ILIKE '%' || elem || '%' OR elem ILIKE '%' || c.cod_supervisor || '%'))
                 OR (elem LIKE '% - %' AND (
                     c.supervisor ILIKE '%' || trim(split_part(elem, ' - ', 2)) || '%'
                     OR c.cod_supervisor = trim(split_part(elem, ' - ', 1))
                 ))
          )
          OR EXISTS (
              SELECT 1 FROM public.data_clients c2
              WHERE (
                  (c2.rca1 IS NOT NULL AND c2.rca1 <> '' AND c2.rca1 = c.rca1)
                  OR (c2.vendedor_codigo IS NOT NULL AND c2.vendedor_codigo <> '' AND c2.vendedor_codigo = c.vendedor_codigo)
              )
              AND (
                  c2.supervisor = ANY(p_supervisor)
                  OR c2.cod_supervisor = ANY(p_supervisor)
                  OR UPPER(TRIM(COALESCE(c2.supervisor, ''))) = ANY(SELECT UPPER(TRIM(elem)) FROM unnest(p_supervisor) AS elem)
                  OR EXISTS (
                      SELECT 1 FROM unnest(p_supervisor) elem
                      WHERE c2.supervisor ILIKE '%' || elem || '%'
                         OR elem ILIKE '%' || c2.supervisor || '%'
                         OR (elem LIKE '% - %' AND (
                             c2.supervisor ILIKE '%' || trim(split_part(elem, ' - ', 2)) || '%'
                             OR c2.cod_supervisor = trim(split_part(elem, ' - ', 1))
                         ))
                  )
              )
          )
                    OR EXISTS (
              SELECT 1 FROM public.data_orders o
              WHERE (o.codcli = COALESCE(c.codigo_cliente, c.cod_cliente, ''))
                AND (
                    o.superv = ANY(p_supervisor)
                    OR EXISTS (
                        SELECT 1 FROM unnest(p_supervisor) elem
                        WHERE o.superv ILIKE '%' || elem || '%'
                           OR elem ILIKE '%' || o.superv || '%'
                           OR (elem LIKE '% - %' AND (
                               o.superv ILIKE '%' || trim(split_part(elem, ' - ', 2)) || '%'
                           ))
                    )
                )
          )
      )
      AND (
          p_vendedor IS NULL
          OR c.rca1 = ANY(p_vendedor)
          OR c.vendedor = ANY(p_vendedor)
          OR c.vendedor_codigo = ANY(p_vendedor)
      )
      AND (
          p_coordenador IS NULL
          OR EXISTS (
              SELECT 1 FROM public.data_hierarchy dh
              LEFT JOIN public.data_client_promoters dcp ON dcp.promoter_code = dh.cod_promotor
              WHERE (dh.nome_coord = ANY(p_coordenador) OR dh.cod_coord = ANY(p_coordenador))
                AND (
                    dcp.client_code = COALESCE(c.codigo_cliente, c.cod_cliente)
                    OR dh.cod_promotor = c.rca1
                    OR dh.cod_promotor = c.vendedor_codigo
                )
          )
      )
      AND (
          p_cocoordenador IS NULL
          OR EXISTS (
              SELECT 1 FROM public.data_hierarchy dh
              LEFT JOIN public.data_client_promoters dcp ON dcp.promoter_code = dh.cod_promotor
              WHERE (dh.nome_cocoord = ANY(p_cocoordenador) OR dh.cod_cocoord = ANY(p_cocoordenador))
                AND (
                    dcp.client_code = COALESCE(c.codigo_cliente, c.cod_cliente)
                    OR dh.cod_promotor = c.rca1
                    OR dh.cod_promotor = c.vendedor_codigo
                )
          )
      )
      AND (
          p_rede IS NULL
          OR (array_position(p_rede, 'C/ REDE') IS NOT NULL AND (c.ramo IS NOT NULL AND c.ramo <> '' AND c.ramo <> 'N/A'))
          OR (array_position(p_rede, 'S/ REDE') IS NOT NULL AND (c.ramo IS NULL OR c.ramo = '' OR c.ramo = 'N/A'))
          OR (c.ramo = ANY(p_rede))
      )
      AND (
          p_search IS NULL
          OR p_search = ''
          OR t.cod_cliente::text ILIKE '%' || p_search || '%'
          OR c.nomecliente ILIKE '%' || p_search || '%'
          OR c.razaosocial ILIKE '%' || p_search || '%'
          OR c.fantasia ILIKE '%' || p_search || '%'
      ) AND (s->>'kind'='admin' OR EXISTS(SELECT 1 FROM authorized ac WHERE
 ac.code=COALESCE(c.codigo_cliente,c.cod_cliente,'') OR ac.code=t.cod_cliente
 OR ltrim(ac.code,'0')=ltrim(t.cod_cliente,'0')))),
 rows AS(SELECT t.cod_cliente,t.vl_titulos,t.vl_receber,t.dt_vencimento,f.nomecliente,f.cidade,f.vendedor_nome,f.ramo
 FROM public.data_titulos t JOIN filtered f ON f.cod_cliente=t.cod_cliente AND f.dt_vencimento IS NOT DISTINCT FROM t.dt_vencimento
 ORDER BY t.dt_vencimento ASC NULLS LAST,t.cod_cliente ASC OFFSET (p_page*p_limit) LIMIT p_limit)
 SELECT json_build_object('kpis',json_build_object(
 'total_rows',coalesce((SELECT sum(row_count) FROM filtered),0),
 'total_vl_receber',coalesce((SELECT sum(vl_receber) FROM filtered),0),
 'critical_vl_receber',coalesce((SELECT sum(positive_receber) FROM filtered WHERE dt_vencimento<v_critical_date),0),
 'critical_clients',(SELECT count(DISTINCT cod_cliente) FROM filtered WHERE dt_vencimento<v_critical_date AND positive_receber>0)),
 'rows',coalesce((SELECT json_agg(r) FROM rows r),'[]'::json)) INTO result;
 RETURN result;
END $function$;
REVOKE ALL ON FUNCTION public.get_titulos_view_data(text[],text[],text[],text[],text[],text,text[],text[],integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_titulos_view_data(text[],text[],text[],text[],text[],text,text[],text[],integer,integer) TO authenticated;


-- Migration 20261002231752 shared_summary_import_refresh_and_wallet_assignments
-- Resumos privados: nenhuma mudança nas tabelas originais ou nos downloads legados.
CREATE TABLE IF NOT EXISTS dashboard_private.summary_state (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), dirty boolean NOT NULL DEFAULT true,
 generation bigint NOT NULL DEFAULT 0, refreshed_at timestamptz, last_change timestamptz NOT NULL DEFAULT clock_timestamp());
INSERT INTO dashboard_private.summary_state(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS dashboard_private.sales_day (
 source text NOT NULL, codcli text, produto text, codfor text, filial text, tipovenda text,
 codusur text,codsupervisor text,day date,unit_price numeric,virtual_supplier text,observacaofor text,
 vlvenda numeric NOT NULL,vlbonific numeric NOT NULL,qtvenda numeric NOT NULL,boxes numeric NOT NULL,totpesoliq numeric NOT NULL,
 row_count bigint NOT NULL);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_month (LIKE dashboard_private.sales_day INCLUDING ALL);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_month_core (LIKE dashboard_private.sales_day INCLUDING ALL);
CREATE TABLE IF NOT EXISTS dashboard_private.page_rollups(page text NOT NULL,cache_key jsonb NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(page,cache_key));
CREATE TABLE IF NOT EXISTS dashboard_private.product_suppliers(product text,supplier text,virtual_supplier text);
CREATE TABLE IF NOT EXISTS dashboard_private.receivables_summary(cod_cliente text,dt_vencimento timestamptz,vl_titulos numeric,vl_receber numeric,
 qt_titulos numeric,qt_tit_receber numeric,positive_receber numeric,row_count bigint);
CREATE INDEX IF NOT EXISTS receivables_client_due ON dashboard_private.receivables_summary(cod_cliente,dt_vencimento);
CREATE INDEX IF NOT EXISTS sales_month_core_client ON dashboard_private.sales_month_core(codcli,source);
CREATE INDEX IF NOT EXISTS sales_month_core_supplier ON dashboard_private.sales_month_core(codfor,source);
CREATE TABLE IF NOT EXISTS dashboard_private.weekly_day (
 source text NOT NULL,codcli text,codfor text,filial text,codusur text,codsupervisor text,
 day date,virtual_supplier text,vlvenda numeric NOT NULL);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_facets (
 source text NOT NULL,codcli text,produto text,codfor text,filial text,tipovenda text,day date);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_calendar (source text NOT NULL,codcli text,day date);
CREATE TABLE IF NOT EXISTS dashboard_private.client_assignments (
 client text PRIMARY KEY,seller text,supervisor text,supervisor_name text,filial text);
ALTER TABLE dashboard_private.client_assignments ADD COLUMN IF NOT EXISTS raw_supervisor text;
ALTER TABLE dashboard_private.client_assignments ADD COLUMN IF NOT EXISTS branch_date timestamptz;
ALTER TABLE dashboard_private.client_assignments ADD COLUMN IF NOT EXISTS branch_source text;
CREATE INDEX IF NOT EXISTS sales_day_client_date ON dashboard_private.sales_day(codcli,day);
CREATE INDEX IF NOT EXISTS sales_day_supplier_date ON dashboard_private.sales_day(codfor,day);
CREATE INDEX IF NOT EXISTS sales_day_product_date ON dashboard_private.sales_day(produto,day);
CREATE INDEX IF NOT EXISTS sales_month_client ON dashboard_private.sales_month(codcli,source);
CREATE INDEX IF NOT EXISTS sales_month_supplier ON dashboard_private.sales_month(codfor,source);
CREATE INDEX IF NOT EXISTS sales_month_product ON dashboard_private.sales_month(produto,source);
CREATE INDEX IF NOT EXISTS weekly_day_client_date ON dashboard_private.weekly_day(codcli,day);
CREATE INDEX IF NOT EXISTS weekly_day_supplier_date ON dashboard_private.weekly_day(codfor,day);
CREATE INDEX IF NOT EXISTS facets_client ON dashboard_private.sales_facets(codcli);
CREATE INDEX IF NOT EXISTS facets_supplier ON dashboard_private.sales_facets(codfor);
CREATE INDEX IF NOT EXISTS calendar_date ON dashboard_private.sales_calendar(source,day DESC);
CREATE INDEX IF NOT EXISTS calendar_client ON dashboard_private.sales_calendar(codcli,day);

-- Same approved-reader policy as the underlying tables; API endpoints still derive the wallet.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['summary_state','sales_day','sales_month','sales_month_core','weekly_day','sales_facets','sales_calendar','client_assignments','page_rollups','product_suppliers','receivables_summary'] LOOP
  EXECUTE format('ALTER TABLE dashboard_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON dashboard_private.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT ON dashboard_private.%I TO authenticated',t);
  EXECUTE format('DROP POLICY IF EXISTS summary_read ON dashboard_private.%I',t);
  EXECUTE format('CREATE POLICY summary_read ON dashboard_private.%I FOR SELECT TO authenticated USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()))',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.assignment_branches_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text,raw_supervisor text,branch_date timestamptz,branch_source text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 raw AS MATERIALIZED(
 SELECT 'current'::text source,codcli,coalesce(nullif(c.rca,''),codusur) seller,codsupervisor,filial,dtped FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))
 UNION ALL SELECT 'history',codcli,coalesce(nullif(c.rca,''),codusur),codsupervisor,filial,dtped FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients'))),
 branch AS MATERIALIZED(SELECT DISTINCT ON(codcli) codcli,seller,filial,codsupervisor,dtped,source FROM raw ORDER BY codcli,source,dtped DESC NULLS LAST,filial),
 sup AS(SELECT DISTINCT ON(seller) seller,codsupervisor FROM branch ORDER BY seller,dtped DESC NULLS LAST,source,codsupervisor)
 SELECT coalesce(c.code,b.codcli),coalesce(nullif(c.rca,''),b.seller),sup.codsupervisor,coalesce(ds.nome,sup.codsupervisor,'N/A'),b.filial,b.codsupervisor,b.dtped,b.source
 FROM clients c FULL JOIN branch b ON b.codcli=c.code LEFT JOIN sup ON sup.seller=coalesce(nullif(c.rca,''),b.seller)
 LEFT JOIN public.dim_supervisores ds ON ds.codigo=sup.codsupervisor;
$$;

-- Privileged writer lives outside the exposed schema and checks its caller.
CREATE OR REPLACE FUNCTION dashboard_private.refresh_summaries_v1(force_refresh boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET jit='off' SET work_mem='32MB' AS $$
DECLARE st dashboard_private.summary_state; result jsonb;
BEGIN
 IF NOT ((auth.uid() IS NOT NULL AND public.is_admin()) OR (auth.uid() IS NULL AND (session_user IN('postgres','supabase_admin') OR current_setting('role',true)='service_role'))) THEN
  RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501';
 END IF;
 IF NOT pg_try_advisory_xact_lock(70261002,1) THEN RETURN jsonb_build_object('status','busy'); END IF;
 SELECT * INTO st FROM dashboard_private.summary_state WHERE id=true;
 IF NOT force_refresh AND NOT st.dirty THEN RETURN jsonb_build_object('status','current','generation',st.generation); END IF;
 -- Capture the revision without locking the upload trigger's state row.
 -- New source commits during the rebuild must leave dirty=true for the next generation.
 -- DELETE/INSERT is atomic under MVCC: concurrent readers keep the previous complete generation.
 DELETE FROM dashboard_private.sales_day;
 INSERT INTO dashboard_private.sales_day
 WITH raw AS MATERIALIZED(
  SELECT 'current'::text source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,
   (dtped AT TIME ZONE 'UTC')::date AS day,coalesce(vlvenda,0) amount,coalesce(vlbonific,0) bonus,coalesce(qtvenda,0) units,coalesce(totpesoliq,0) peso,observacaofor FROM public.data_detailed
  UNION ALL SELECT 'history',codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,
   (dtped AT TIME ZONE 'UTC')::date,coalesce(vlvenda,0),coalesce(vlbonific,0),coalesce(qtvenda,0),coalesce(totpesoliq,0),observacaofor FROM public.data_history),
 enriched AS(SELECT r.*,CASE WHEN units<>0 THEN amount/units END unit_price,
  units/CASE WHEN p.qtde_master>0 THEN p.qtde_master ELSE 1 END boxes,
  CASE WHEN r.codfor='1119' THEN CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END virtual_supplier
  FROM raw r LEFT JOIN public.dim_produtos p ON p.codigo=r.produto)
 SELECT source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,unit_price,virtual_supplier,observacaofor,
 sum(amount),sum(bonus),sum(units),sum(boxes),sum(peso),count(*) FROM enriched
 GROUP BY source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,unit_price,virtual_supplier,observacaofor;
 DELETE FROM dashboard_private.sales_month;
 INSERT INTO dashboard_private.sales_month
 SELECT source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,date_trunc('month',day)::date,unit_price,virtual_supplier,observacaofor,
 sum(vlvenda),sum(vlbonific),sum(qtvenda),sum(boxes),sum(totpesoliq),sum(row_count)
 FROM dashboard_private.sales_day GROUP BY source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,date_trunc('month',day)::date,unit_price,virtual_supplier,observacaofor;
 DELETE FROM dashboard_private.sales_month_core;
 INSERT INTO dashboard_private.sales_month_core SELECT source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,NULL::numeric,virtual_supplier,observacaofor,
 sum(vlvenda),sum(vlbonific),sum(qtvenda),sum(boxes),sum(totpesoliq),sum(row_count) FROM dashboard_private.sales_month
 GROUP BY source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,virtual_supplier,observacaofor;
 DELETE FROM dashboard_private.product_suppliers;
 INSERT INTO dashboard_private.product_suppliers SELECT DISTINCT produto,codfor,virtual_supplier FROM dashboard_private.sales_day;
 DELETE FROM dashboard_private.receivables_summary;
 INSERT INTO dashboard_private.receivables_summary SELECT cod_cliente,dt_vencimento,sum(coalesce(vl_titulos,0)),sum(coalesce(vl_receber,0)),
 sum(coalesce(qt_titulos,0)),sum(coalesce(qt_tit_receber,0)),sum(CASE WHEN vl_receber>0 THEN vl_receber ELSE 0 END),count(*)
 FROM public.data_titulos GROUP BY cod_cliente,dt_vencimento;
 DELETE FROM dashboard_private.weekly_day;
 INSERT INTO dashboard_private.weekly_day SELECT source,codcli,codfor,filial,codusur,codsupervisor,day,virtual_supplier,sum(vlvenda)
 FROM dashboard_private.sales_day GROUP BY source,codcli,codfor,filial,codusur,codsupervisor,day,virtual_supplier;
 DELETE FROM dashboard_private.sales_facets;
 INSERT INTO dashboard_private.sales_facets SELECT source,codcli,produto,codfor,filial,tipovenda,max(day)
 FROM dashboard_private.sales_day GROUP BY source,codcli,produto,codfor,filial,tipovenda,date_trunc('month',day);
 DELETE FROM dashboard_private.sales_calendar;
 INSERT INTO dashboard_private.sales_calendar SELECT DISTINCT source,codcli,day FROM dashboard_private.sales_day;
 DELETE FROM dashboard_private.client_assignments;
 INSERT INTO dashboard_private.client_assignments SELECT * FROM dashboard_private.assignment_branches_v1('{"kind":"admin"}') WHERE client IS NOT NULL;
 DELETE FROM dashboard_private.page_rollups;
 IF to_regprocedure('dashboard_private.coverage_result_v1(jsonb,jsonb)') IS NOT NULL THEN
  INSERT INTO dashboard_private.page_rollups VALUES('coverage','{}',dashboard_private.coverage_result_v1('{"kind":"admin"}','{}')),
  ('coverage','{"suppliers":["707"]}',dashboard_private.coverage_result_v1('{"kind":"admin"}','{"suppliers":["707"]}'));
 END IF;
 IF to_regprocedure('dashboard_private.facet_result_v1(text,jsonb,jsonb)') IS NOT NULL THEN
  INSERT INTO dashboard_private.page_rollups VALUES('filters','{}',dashboard_private.facet_result_v1('coverage','{"kind":"admin"}','{}'));
 END IF;
 ANALYZE dashboard_private.sales_month_core; ANALYZE dashboard_private.receivables_summary;
 ANALYZE dashboard_private.sales_day; ANALYZE dashboard_private.sales_month; ANALYZE dashboard_private.weekly_day;
 ANALYZE dashboard_private.sales_facets; ANALYZE dashboard_private.sales_calendar; ANALYZE dashboard_private.client_assignments;
 UPDATE dashboard_private.summary_state SET dirty=(last_change IS DISTINCT FROM st.last_change),generation=generation+1,refreshed_at=clock_timestamp() WHERE id=true RETURNING
  jsonb_build_object('status','refreshed','generation',generation,'refreshed_at',refreshed_at) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION dashboard_private.assignment_branches_v1(jsonb),dashboard_private.refresh_summaries_v1(boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION dashboard_private.refresh_summaries_v1(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_dashboard_summaries_v1()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' SET statement_timeout='60s' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501'; END IF;
 -- Serialize an explicit import finish with the scheduled worker; never return a busy snapshot.
 PERFORM pg_advisory_xact_lock(70261002,1);
 RETURN dashboard_private.refresh_summaries_v1(false);
END $$;
REVOKE ALL ON FUNCTION public.refresh_dashboard_summaries_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.refresh_dashboard_summaries_v1() TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.queue_summaries_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_SCHEMA<>'public' OR TG_TABLE_NAME NOT IN('data_detailed','data_history','data_clients','data_client_promoters','data_hierarchy','dim_produtos','dim_vendedores','dim_supervisores','data_product_details','data_titulos','dim_fornecedores') THEN
  RAISE EXCEPTION 'Origem de atualização inválida';
 END IF;
 IF NOT ((auth.uid() IS NOT NULL AND public.is_admin()) OR (auth.uid() IS NULL AND (session_user IN('postgres','supabase_admin') OR current_setting('role',true)='service_role'))) THEN
  RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501';
 END IF;
 UPDATE dashboard_private.summary_state SET dirty=true,last_change=clock_timestamp() WHERE id=true;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION dashboard_private.queue_summaries_v1() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['data_detailed','data_history','data_clients','data_client_promoters','data_hierarchy','dim_produtos','dim_vendedores','dim_supervisores','data_product_details','data_titulos','dim_fornecedores'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS dashboard_summary_dirty ON public.%I',t);
  EXECUTE format('CREATE TRIGGER dashboard_summary_dirty AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION dashboard_private.queue_summaries_v1()',t);
 END LOOP;
END $$;
-- One minute safety net for integrations that don't explicitly finish an import.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='dashboard-page-summaries-v1') THEN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='dashboard-page-summaries-v1';
 END IF;
 PERFORM cron.schedule('dashboard-page-summaries-v1','* * * * *','SELECT dashboard_private.refresh_summaries_v1(false)');
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.assignments_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH base AS MATERIALIZED(SELECT a.* FROM dashboard_private.client_assignments a WHERE s->>'kind'='admin'
 OR a.client IN(SELECT jsonb_array_elements_text(s->'clients')) OR a.client IN(SELECT jsonb_array_elements_text(s->'ghosts'))),
 sup AS(SELECT DISTINCT ON(seller) seller,raw_supervisor FROM base WHERE branch_source IS NOT NULL
 ORDER BY seller,branch_date DESC NULLS LAST,branch_source,raw_supervisor)
 SELECT b.client,b.seller,sup.raw_supervisor,coalesce(ds.nome,sup.raw_supervisor,'N/A'),b.filial
 FROM base b LEFT JOIN sup ON sup.seller=b.seller LEFT JOIN public.dim_supervisores ds ON ds.codigo=sup.raw_supervisor;
$$;
GRANT EXECUTE ON FUNCTION dashboard_private.assignments_v1(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION dashboard_private.assignments_v1(jsonb) FROM PUBLIC,anon;

SELECT dashboard_private.refresh_summaries_v1(true);


-- Migration 20261002231911 summary_page_wallet_assignments
-- Cobertura e Semanal: dados, cálculos e opções de filtros no PostgreSQL.
-- Helpers ficam fora do schema exposto pela API; todos preservam RLS.
CREATE SCHEMA IF NOT EXISTS dashboard_private;
REVOKE ALL ON SCHEMA dashboard_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA dashboard_private TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.scope_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $$
DECLARE r text; kind text; sellers text[]; clients text[]; ghosts text[];
BEGIN
 IF auth.uid() IS NULL OR NOT(public.is_admin() OR public.is_approved()) THEN
  RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501';
 END IF;
 SELECT lower(btrim(role)) INTO r FROM public.profiles WHERE id=auth.uid();
 IF r='adm' THEN RETURN jsonb_build_object('kind','admin'); END IF;
 -- Trade: carteira atribuída, inclusive coordenadores com carteira vazia.
 IF EXISTS(SELECT 1 FROM public.data_hierarchy h WHERE r IN(lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor))))
 OR EXISTS(SELECT 1 FROM public.data_client_promoters WHERE lower(btrim(promoter_code))=r) THEN
  kind:='trade';
  SELECT array_agg(cp.client_code) INTO clients FROM public.data_client_promoters cp
  WHERE lower(btrim(cp.promoter_code))=r OR EXISTS(SELECT 1 FROM public.data_hierarchy h
   WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code)) AND r IN(lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor))));
 ELSE
  SELECT array_agg(DISTINCT codusur) INTO sellers FROM (
   SELECT codusur FROM public.data_detailed WHERE lower(btrim(codsupervisor))=r
   UNION ALL SELECT codusur FROM public.data_history WHERE lower(btrim(codsupervisor))=r) s;
  kind:=CASE WHEN sellers IS NULL THEN 'seller' ELSE 'supervisor' END;
  SELECT array_agg(codigo_cliente) INTO clients FROM public.data_clients
  WHERE (kind='seller' AND lower(btrim(rca1))=r) OR (kind='supervisor' AND rca1=ANY(sellers))
   OR (r='1001' AND upper(coalesce(razaosocial,nomecliente,'')) LIKE '%AMERICANAS%');
  -- Mesmo complemento da carteira legado: clientes com venda atual do vendedor/supervisor.
  SELECT array_agg(DISTINCT codcli) INTO ghosts FROM public.data_detailed
  WHERE (kind='seller' AND lower(btrim(codusur))=r) OR (kind='supervisor' AND lower(btrim(codsupervisor))=r);
 END IF;
 RETURN jsonb_build_object('kind',kind,'clients',coalesce(clients,ARRAY[]::text[]),'ghosts',coalesce(ghosts,ARRAY[]::text[]));
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.clients_v1(s jsonb)
RETURNS TABLE(code text,rca text,city text,rede text,coord text,coord_name text,cocoord text,cocoord_name text,promotor text,promotor_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT c.codigo_cliente,CASE WHEN upper(coalesce(c.razaosocial,c.nomecliente,'')) LIKE '%AMERICANAS%' THEN '1001' ELSE c.rca1 END,
 coalesce(nullif(c.cidade,''),'N/A'),coalesce(nullif(c.ramo,''),'N/A'),h.cod_coord,h.nome_coord,h.cod_cocoord,h.nome_cocoord,cp.promoter_code,coalesce(h.nome_promotor,cp.promoter_code)
 FROM public.data_clients c
 LEFT JOIN public.data_client_promoters cp ON cp.client_code=c.codigo_cliente
 LEFT JOIN LATERAL (SELECT * FROM public.data_hierarchy h WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code)) ORDER BY h.id LIMIT 1) h ON true
 WHERE s->>'kind'='admin' OR c.codigo_cliente IN(SELECT jsonb_array_elements_text(s->'clients'))
 OR c.codigo_cliente IN(SELECT jsonb_array_elements_text(s->'ghosts'));
$$;

CREATE OR REPLACE FUNCTION dashboard_private.matches_v1(f jsonb,k text,v text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(jsonb_array_length(f->k),0)=0 OR coalesce(f->k ? v,false);
$$;
CREATE OR REPLACE FUNCTION dashboard_private.rede_v1(f jsonb,v text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(v,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? v,false))
 WHEN 'sem_rede' THEN coalesce(v,'N/A') IN('','N/A') ELSE true END;
$$;

CREATE OR REPLACE FUNCTION dashboard_private.assignments_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH base AS MATERIALIZED(SELECT a.* FROM dashboard_private.client_assignments a WHERE s->>'kind'='admin'
 OR a.client IN(SELECT jsonb_array_elements_text(s->'clients')) OR a.client IN(SELECT jsonb_array_elements_text(s->'ghosts'))),
 sup AS(SELECT DISTINCT ON(seller) seller,raw_supervisor FROM base WHERE branch_source IS NOT NULL
 ORDER BY seller,branch_date DESC NULLS LAST,branch_source,raw_supervisor)
 SELECT b.client,b.seller,sup.raw_supervisor,coalesce(ds.nome,sup.raw_supervisor,'N/A'),b.filial
 FROM base b LEFT JOIN sup ON sup.seller=b.seller LEFT JOIN public.dim_supervisores ds ON ds.codigo=sup.raw_supervisor;
$$;

CREATE OR REPLACE FUNCTION dashboard_private.rows_v1(s jsonb,f jsonb DEFAULT '{}'::jsonb,purpose text DEFAULT 'all')
RETURNS TABLE(source text,client text,product text,supplier text,virtual_supplier text,seller text,seller_name text,supervisor text,supervisor_name text,filial text,sale_type text,day date,amount numeric,bonus numeric,units numeric,boxes numeric,description text,registered date,city text,rede text,coord text,coord_name text,cocoord text,cocoord_name text,promotor text,promotor_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 products AS MATERIALIZED(SELECT * FROM public.dim_produtos), details AS MATERIALIZED(SELECT * FROM public.data_product_details),
 vendors AS MATERIALIZED(SELECT * FROM public.dim_vendedores), supervisors AS MATERIALIZED(SELECT * FROM public.dim_supervisores), raw AS MATERIALIZED(
 SELECT 'current'::text source,d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date AS day,coalesce(d.vlvenda,0) amount,coalesce(d.vlbonific,0) bonus,coalesce(d.qtvenda,0) units
 FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (purpose<>'weekly' OR coalesce(f->>'month','current')='current')
 UNION ALL
 SELECT 'history',d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date,coalesce(d.vlvenda,0),coalesce(d.vlbonific,0),coalesce(d.qtvenda,0)
 FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (purpose<>'weekly' OR ((d.dtped AT TIME ZONE 'UTC')::date >= (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date END)-interval '1 month' AND (d.dtped AT TIME ZONE 'UTC')::date < (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date+interval '1 month' END)))
 ), assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s))
 SELECT r.source,r.codcli,r.produto,r.codfor,CASE WHEN r.codfor='1119' THEN CASE
 WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY'
 WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END,
 coalesce(nullif(c.rca,''),r.codusur),coalesce(v.nome,coalesce(nullif(c.rca,''),r.codusur),'N/A'),
 coalesce(ss.supervisor,r.codsupervisor),coalesce(ds.nome,ss.supervisor,r.codsupervisor,'N/A'),r.filial,r.tipovenda,r.day,r.amount,r.bonus,r.units,
 r.units/CASE WHEN p.qtde_master>0 THEN p.qtde_master ELSE 1 END,
 coalesce(nullif(p.descricao,''),'Produto '||r.produto),(pd.dtcadastro AT TIME ZONE 'UTC')::date,
 coalesce(c.city,'N/A'),coalesce(c.rede,'N/A'),c.coord,c.coord_name,c.cocoord,c.cocoord_name,c.promotor,c.promotor_name
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli
 LEFT JOIN products p ON p.codigo=r.produto
 LEFT JOIN details pd ON pd.code=r.produto
 LEFT JOIN assignments ss ON ss.client=r.codcli
 LEFT JOIN vendors v ON v.codigo=coalesce(nullif(c.rca,''),r.codusur)
 LEFT JOIN supervisors ds ON ds.codigo=coalesce(ss.supervisor,r.codsupervisor);
$$;

-- Page-local planner settings avoid JIT startup and merge joins caused by opaque helper cardinality.
-- Settings restore automatically on function exit; authorization/RLS remain unchanged.
-- As opções são pequenas projeções; nunca retornam linhas de vendas ao navegador.
CREATE OR REPLACE FUNCTION dashboard_private.normalize_page_filters_v1(f jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb:=f; k text; v jsonb;
BEGIN
 FOR k,v IN SELECT * FROM jsonb_each(f) LOOP
  IF v='null'::jsonb OR v='[]'::jsonb OR v='""'::jsonb
   OR (k='filial' AND v IN('"all"'::jsonb,'"ambas"'::jsonb))
   OR (k='mode' AND v='"promoter"'::jsonb) OR (k='month' AND v='"current"'::jsonb)
   OR (k='trend' AND v='"all"'::jsonb) OR (k='metric' AND v='"boxes"'::jsonb)
   OR (k='working_days' AND v='0'::jsonb) THEN result:=result-k; END IF;
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION dashboard_private.normalize_page_filters_v1(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION dashboard_private.normalize_page_filters_v1(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.facet_result_v1(p_page text,s jsonb,p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' AS $$
DECLARE result jsonb; f jsonb:=p_filters;
BEGIN
 IF p_page NOT IN('coverage','weekly') OR jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Página ou filtros inválidos' USING ERRCODE='22023'; END IF;
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 raw AS MATERIALIZED(SELECT * FROM dashboard_private.sales_facets WHERE s->>'kind'='admin'
 OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (source='current' AND codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))),
 rows AS MATERIALIZED(SELECT r.source,r.day,r.filial,r.tipovenda sale_type,r.produto product,r.codfor supplier,
 coalesce(p.descricao,'Produto '||r.produto) description,
 CASE WHEN r.codfor='1119' THEN CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END virtual_supplier,
 a.seller,coalesce(v.nome,a.seller,'N/A') seller_name,a.supervisor_name,c.city,c.rede,c.coord,c.cocoord,c.promotor
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli LEFT JOIN assignments a ON a.client=r.codcli
 LEFT JOIN public.dim_produtos p ON p.codigo=r.produto LEFT JOIN public.dim_vendedores v ON v.codigo=a.seller),
 scope AS MATERIALIZED(SELECT * FROM rows WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false)))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? seller,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? rede,false)) WHEN 'sem_rede' THEN coalesce(rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR filial=f->>'filial')
 AND (coalesce(f->>'city','')='' OR lower(city)=lower(f->>'city'))),
 supplier_options AS (SELECT DISTINCT supplier code,coalesce(df.nome,supplier) label FROM scope LEFT JOIN public.dim_fornecedores df ON df.codigo=scope.supplier
 UNION SELECT DISTINCT virtual_supplier,CASE virtual_supplier WHEN '1119_TODDYNHO' THEN 'TODDYNHO' WHEN '1119_TODDY' THEN 'TODDY' ELSE 'QUAKER / KEROCOCO' END FROM scope WHERE virtual_supplier IS NOT NULL),
 products AS (SELECT DISTINCT product code,'('||product||') '||description label FROM scope WHERE (coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false)),
 sellers AS(SELECT DISTINCT seller code,seller_name label,supervisor_name supervisor FROM rows
 WHERE (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))),
 hierarchy AS(SELECT * FROM clients), months AS(SELECT DISTINCT to_char(day,'YYYY-MM') code FROM raw WHERE day IS NOT NULL)
 SELECT jsonb_build_object('schema_version',1,'reference_date',coalesce((SELECT max(day) FROM rows WHERE source='current'),(SELECT max(day) FROM rows),current_date),
 'suppliers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM supplier_options t),'[]'),
 'products',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM products t),'[]'),
 'types',coalesce((SELECT jsonb_agg(jsonb_build_object('code',sale_type,'label',sale_type) ORDER BY sale_type) FROM (SELECT DISTINCT sale_type FROM scope WHERE sale_type IS NOT NULL)t),'[]'),
 'sellers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM sellers t),'[]'),
 'supervisors',coalesce((SELECT jsonb_agg(jsonb_build_object('code',label,'label',label) ORDER BY label) FROM(SELECT DISTINCT supervisor_name label FROM rows)t),'[]'),
 'coords',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT coord code,coalesce(coord_name,coord) label FROM hierarchy WHERE coord IS NOT NULL)t),'[]'),
 'cocoords',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT cocoord code,coalesce(cocoord_name,cocoord) label FROM hierarchy WHERE cocoord IS NOT NULL AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)))t),'[]'),
 'promotors',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT promotor code,coalesce(promotor_name,promotor) label FROM hierarchy WHERE promotor IS NOT NULL AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)))t),'[]'),
 'cities',coalesce((SELECT jsonb_agg(city ORDER BY city) FROM(SELECT DISTINCT city FROM clients)t),'[]'),
 'redes',coalesce((SELECT jsonb_agg(jsonb_build_object('code',rede,'label',rede) ORDER BY rede) FROM(SELECT DISTINCT rede FROM clients WHERE rede NOT IN('','N/A'))t),'[]'),
 'months',coalesce((SELECT jsonb_agg(code ORDER BY code DESC) FROM months),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.get_dashboard_filters_v1(p_page text,p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET plan_cache_mode='force_custom_plan' SET jit='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb; products jsonb;
BEGIN
 IF p_page NOT IN('coverage','weekly') OR jsonb_typeof(p_filters)<>'object' THEN RAISE EXCEPTION 'Página ou filtros inválidos' USING ERRCODE='22023'; END IF;
 IF s->>'kind'='admin' AND dashboard_private.normalize_page_filters_v1(p_filters-'suppliers')='{}'::jsonb THEN
  SELECT payload INTO result FROM dashboard_private.page_rollups WHERE page='filters' AND cache_key='{}'::jsonb;
  IF FOUND THEN
   IF coalesce(jsonb_array_length(p_filters->'suppliers'),0)>0 THEN
    SELECT coalesce(jsonb_agg(p.item ORDER BY p.ordinal),'[]'::jsonb) INTO products
    FROM jsonb_array_elements(result->'products') WITH ORDINALITY p(item,ordinal)
    WHERE EXISTS(SELECT 1 FROM dashboard_private.product_suppliers x WHERE x.product=p.item->>'code'
     AND (coalesce(p_filters->'suppliers' ? x.supplier,false) OR coalesce(p_filters->'suppliers' ? x.virtual_supplier,false)));
    result:=jsonb_set(result,'{products}',products);
   END IF;
   RETURN result;
  END IF;
 END IF;
 RETURN dashboard_private.facet_result_v1(p_page,s,p_filters);
END $$;

CREATE OR REPLACE FUNCTION public.get_weekly_page_v1(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); f jsonb:=p_filters; ref date; target date; result jsonb;
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(day) FILTER(WHERE source='current'),max(day),current_date) INTO ref FROM dashboard_private.sales_calendar;
 target:=CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',ref)::date ELSE ((f->>'month')||'-01')::date END;
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 rows AS MATERIALIZED(SELECT d.source,d.codcli client,d.day,d.vlvenda amount,d.codfor supplier,d.virtual_supplier,
 coalesce(nullif(c.rca,''),d.codusur) seller,coalesce(v.nome,coalesce(nullif(c.rca,''),d.codusur),'N/A') seller_name,
 coalesce(a.supervisor_name,ds.nome,d.codsupervisor,'N/A') supervisor_name,d.filial,coalesce(c.rede,'N/A') rede,
 c.coord,c.cocoord,c.promotor,c.promotor_name FROM dashboard_private.weekly_day d
 LEFT JOIN clients c ON c.code=d.codcli LEFT JOIN assignments a ON a.client=d.codcli
 LEFT JOIN public.dim_vendedores v ON v.codigo=coalesce(nullif(c.rca,''),d.codusur)
 LEFT JOIN public.dim_supervisores ds ON ds.codigo=d.codsupervisor
 WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (d.source='current' AND d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))))
 AND ((coalesce(f->>'month','current')='current' AND d.source='current') OR (d.source='history' AND d.day>=target-interval '1 month' AND d.day<target+interval '1 month'))),
 filtered AS MATERIALIZED(SELECT * FROM rows WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false)))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? seller,false))
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? rede,false)) WHEN 'sem_rede' THEN coalesce(rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR filial=f->>'filial')),
 selected AS MATERIALIZED(SELECT * FROM filtered WHERE
 (coalesce(f->>'month','current')='current' AND source='current') OR (coalesce(f->>'month','current')<>'current' AND source='history' AND day>=target AND day<target+interval '1 month')),
 first_day AS(SELECT target+CASE extract(isodow FROM target)::int WHEN 6 THEN 2 WHEN 7 THEN 1 ELSE 0 END first),
 week_starts AS(SELECT first start FROM first_day UNION SELECT d::date FROM first_day,generate_series(date_trunc('week',first::timestamp)+interval '7 days',target::timestamp+interval '1 month - 1 day',interval '7 days') d),
 weeks AS(SELECT row_number() OVER(ORDER BY start) id,start,least((date_trunc('week',start::timestamp)+interval '6 days')::date,(target+interval '1 month - 1 day')::date) finish FROM week_starts),
 daily AS(SELECT w.id,extract(dow FROM s.day)::int weekday,sum(s.amount) amount FROM weeks w JOIN selected s ON s.day BETWEEN w.start AND w.finish GROUP BY 1,2),
 week_data AS(SELECT w.id,w.start,w.finish "end",coalesce((SELECT sum(amount) FROM daily d WHERE d.id=w.id),0) total,
 (SELECT jsonb_agg(coalesce(d.amount,0) ORDER BY wd) FROM generate_series(0,6) wd LEFT JOIN daily d ON d.id=w.id AND d.weekday=wd) days FROM weeks w),
 best_daily AS(SELECT day,sum(amount) amount FROM filtered WHERE source='history' AND day>=target-interval '1 month' AND day<target GROUP BY day),
 best AS(SELECT extract(dow FROM day)::int wd,greatest(max(amount),0) amount FROM best_daily GROUP BY 1),
 ranks AS(SELECT CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(promotor,'Sem Promotor') ELSE coalesce(seller,'N/A') END code,
 CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(promotor_name,'Sem Promotor') ELSE coalesce(seller_name,seller,'N/A') END name,
 sum(amount) val,count(DISTINCT client) pos FROM selected GROUP BY 1,2)
 SELECT jsonb_build_object('schema_version',1,'reference_date',ref,'target_month',to_char(target,'YYYY-MM'),
 'weeks',coalesce((SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM week_data w),'[]'),
 'best_days',(SELECT jsonb_agg(coalesce(b.amount,0) ORDER BY wd) FROM generate_series(0,6) wd LEFT JOIN best b USING(wd)),
 'ranking_fat',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY val DESC,code) FROM(SELECT * FROM ranks ORDER BY val DESC,code LIMIT 10)t),'[]'),
 'ranking_pos',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY pos DESC,val DESC,code) FROM(SELECT * FROM ranks ORDER BY pos DESC,val DESC,code LIMIT 10)t),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.coverage_result_v1(s jsonb,p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' AS $$
DECLARE f jsonb:=p_filters; ref date; start_date date; end_date date; prev_start date; prev_end date;
 custom_date boolean; alt boolean; result jsonb; days integer:=greatest(coalesce((f->>'working_days')::int,0),0);
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(day) FILTER(WHERE source='current'),max(day),current_date) INTO ref FROM dashboard_private.sales_calendar;
 custom_date:=nullif(f->>'date_start','') IS NOT NULL AND nullif(f->>'date_end','') IS NOT NULL;
 start_date:=CASE WHEN custom_date THEN (f->>'date_start')::date ELSE date_trunc('month',ref)::date END;
 end_date:=CASE WHEN custom_date THEN (f->>'date_end')::date ELSE (start_date+interval '1 month - 1 day')::date END;
 IF end_date<start_date THEN RAISE EXCEPTION 'Período inválido' USING ERRCODE='22023'; END IF;
 prev_start:=(start_date-interval '1 month')::date; prev_end:=(end_date-interval '1 month')::date;
 IF NOT custom_date THEN prev_end:=start_date-1; END IF;
 alt:=coalesce(jsonb_array_length(f->'types'),0)>0 AND NOT(coalesce(f->'types' ? '1',false) OR coalesce(f->'types' ? '9',false));
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 seller_sup AS(SELECT DISTINCT seller,supervisor_name FROM assignments),branches AS(SELECT client,filial FROM assignments),
 base_clients AS MATERIALIZED(SELECT c.* FROM clients c WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR EXISTS(SELECT 1 FROM seller_sup ss WHERE ss.seller=c.rca AND (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? ss.supervisor_name,false))) OR coalesce(jsonb_array_length(f->'supervisors'),0)=0)
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? c.rca,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR EXISTS(SELECT 1 FROM branches b WHERE b.client=c.code AND b.filial=f->>'filial'))),
 scoped AS MATERIALIZED(SELECT d.source,d.codcli client,d.produto product,d.day,d.codusur seller,
 d.vlvenda amount,d.unit_price,d.boxes,CASE WHEN alt THEN d.vlbonific ELSE d.vlvenda END value
 FROM (SELECT * FROM dashboard_private.sales_month_core WHERE NOT custom_date AND f->>'price_min' IS NULL AND f->>'price_max' IS NULL
 UNION ALL SELECT * FROM dashboard_private.sales_month WHERE NOT custom_date AND (f->>'price_min' IS NOT NULL OR f->>'price_max' IS NOT NULL)
 UNION ALL SELECT * FROM dashboard_private.sales_day WHERE custom_date) d
 JOIN base_clients c ON c.code=d.codcli WHERE (coalesce(f->>'filial','ambas') IN('ambas','all') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false))),
 filtered AS NOT MATERIALIZED(SELECT * FROM scoped d WHERE ((f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR (d.unit_price IS NOT NULL
 AND (f->>'price_min' IS NULL OR d.unit_price>=(f->>'price_min')::numeric)
 AND (f->>'price_max' IS NULL OR d.unit_price<=(f->>'price_max')::numeric)))),
 periods AS MATERIALIZED(
 SELECT r.*,'current'::text period FROM filtered r WHERE (custom_date AND day BETWEEN start_date AND end_date) OR(NOT custom_date AND source='current')
 UNION ALL SELECT r.*,'previous' FROM filtered r WHERE (custom_date AND day BETWEEN prev_start AND prev_end) OR(NOT custom_date AND source='history' AND day BETWEEN prev_start AND prev_end)
 UNION ALL SELECT r.*,'history' FROM filtered r WHERE NOT custom_date AND source='history' AND day NOT BETWEEN prev_start AND prev_end),
 product_clients AS(SELECT product,client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2,3),
 product_counts AS(SELECT product,count(*) FILTER(WHERE period='current' AND value>=1) current_count,count(*) FILTER(WHERE period='previous' AND value>=1) previous_count FROM product_clients GROUP BY product),
 selection AS(SELECT client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2),
 active_history AS(SELECT client FROM scoped WHERE source='history' GROUP BY client HAVING sum(amount)>=1),
 working AS MATERIALIZED(SELECT DISTINCT day FROM dashboard_private.sales_calendar WHERE extract(isodow FROM day) BETWEEN 1 AND 5
 AND (s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (source='current' AND codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))))),
 working_array AS(SELECT array_agg(day ORDER BY day) dates FROM working),
 stats_amounts AS(SELECT product,coalesce(sum(boxes) FILTER(WHERE period='current'),0) current_boxes,
 coalesce(sum(boxes) FILTER(WHERE period='previous'),0) previous_boxes,bool_or(day<date_trunc('month',ref)::date) has_history
 FROM periods GROUP BY product),
 stats AS MATERIALIZED(SELECT t.*,coalesce(nullif(p.descricao,''),'Produto '||t.product) description,(pd.dtcadastro AT TIME ZONE 'UTC')::date registered
 FROM stats_amounts t LEFT JOIN public.dim_produtos p ON p.codigo=t.product LEFT JOIN public.data_product_details pd ON pd.code=t.product),
 stock AS(SELECT product_code,sum(coalesce(stock_qty,0)) qty FROM public.data_stock WHERE coalesce(f->>'filial','ambas') IN('ambas','all') OR filial=f->>'filial' GROUP BY product_code),
 divisors AS MATERIALIZED(SELECT t.*,coalesce(st.qty,0) stock,coalesce(pc.current_count,0) current_count,coalesce(pc.previous_count,0) previous_count,
 greatest(1,CASE WHEN NOT coalesce(has_history,false) AND current_boxes>0 THEN least(
 greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1),
 CASE WHEN days>0 THEN days ELSE greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1) END)
 ELSE CASE WHEN days>0 THEN least(days,(SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered)) ELSE (SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered) END END)::numeric divisor
 FROM stats t LEFT JOIN stock st ON st.product_code=t.product LEFT JOIN product_counts pc USING(product)),
 -- Daily rows are read only for each product's required trend window, with original price buckets.
 trend_totals AS MATERIALIZED(SELECT dv.product,coalesce(sum(d.boxes*CASE WHEN custom_date THEN
 (CASE WHEN d.day BETWEEN start_date AND end_date THEN 1 ELSE 0 END+CASE WHEN d.day BETWEEN prev_start AND prev_end THEN 1 ELSE 0 END) ELSE 1 END),0)/dv.divisor daily_avg
 FROM divisors dv CROSS JOIN working_array w LEFT JOIN (dashboard_private.sales_day d JOIN base_clients c ON c.code=d.codcli)
 ON d.produto=dv.product AND d.day BETWEEN w.dates[greatest(1,cardinality(w.dates)-dv.divisor::int+1)] AND w.dates[cardinality(w.dates)]
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)) AND ((f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR (d.unit_price IS NOT NULL
 AND (f->>'price_min' IS NULL OR d.unit_price>=(f->>'price_min')::numeric)
 AND (f->>'price_max' IS NULL OR d.unit_price<=(f->>'price_max')::numeric)))
 GROUP BY dv.product,dv.divisor),
 trend AS(SELECT d.*,t.daily_avg FROM divisors d JOIN trend_totals t USING(product)),
 table_all AS MATERIALIZED(SELECT product code,'('||product||') '||description descricao,stock "stockQty",current_boxes "boxesSoldCurrentMonth",previous_boxes "boxesSoldPreviousMonth",
 CASE WHEN previous_boxes>0 THEN (current_boxes-previous_boxes)/previous_boxes*100 WHEN current_boxes>0 THEN NULL ELSE 0 END "boxesVariation",
 CASE WHEN previous_count>0 THEN (current_count-previous_count)::numeric/previous_count*100 WHEN current_count>0 THEN NULL ELSE 0 END "pdvVariation",
 CASE WHEN daily_avg>0 THEN stock/daily_avg WHEN stock>0 THEN NULL ELSE 0 END "trendDays",previous_count "clientsPreviousCount",current_count "clientsCurrentCount",
 CASE WHEN (SELECT count(*) FROM base_clients)>0 THEN current_count::numeric/(SELECT count(*) FROM base_clients)*100 ELSE 0 END "coverageCurrent" FROM trend),
 table_filtered AS MATERIALIZED(SELECT * FROM table_all WHERE "boxesSoldCurrentMonth">0 AND CASE coalesce(f->>'trend','all') WHEN 'low' THEN "trendDays"<15 WHEN 'medium' THEN "trendDays">=15 AND "trendDays"<30 WHEN 'good' THEN "trendDays">=30 ELSE true END),
 cities AS(SELECT c.city name,sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN r.boxes ELSE r.value END) value FROM periods r JOIN base_clients c ON c.code=r.client WHERE r.period='current' GROUP BY c.city),
 ranking AS(SELECT CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(c.promotor_name,'N/A') ELSE coalesce(v.nome,coalesce(nullif(c.rca,''),r.seller),'N/A') END name,
 sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN r.boxes ELSE r.value END) value FROM periods r
 JOIN base_clients c ON c.code=r.client LEFT JOIN public.dim_vendedores v ON v.codigo=coalesce(nullif(c.rca,''),r.seller)
 WHERE r.period='current' GROUP BY 1),
 top_product AS(SELECT * FROM table_all WHERE "coverageCurrent">0 ORDER BY "coverageCurrent" DESC,code LIMIT 1)
 SELECT jsonb_build_object('schema_version',1,'reference_date',ref,'active_clients',(SELECT count(*) FROM base_clients),'active_3m',(SELECT count(*) FROM active_history),
 'current_clients',(SELECT count(*) FROM selection WHERE period='current' AND value>=1),'previous_clients',(SELECT count(*) FROM selection WHERE period='previous' AND value>=1),
 'top',coalesce((SELECT to_jsonb(t) FROM top_product t),'null'),
 'rows',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY "stockQty" DESC,code) FROM table_filtered t),'[]'),
 'total_boxes',coalesce((SELECT sum("boxesSoldCurrentMonth") FROM table_filtered),0),
 'chart_total',coalesce((SELECT sum(value) FROM cities),0),
 'cities',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY value DESC,name) FROM(SELECT * FROM cities ORDER BY value DESC,name LIMIT 10)t),'[]'),
 'ranking',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY value DESC,name) FROM(SELECT * FROM ranking ORDER BY value DESC,name LIMIT 10)t),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.get_coverage_page_v1(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET plan_cache_mode='force_custom_plan' SET jit='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb;
BEGIN
 IF jsonb_typeof(p_filters)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 IF s->>'kind'='admin' THEN
  SELECT payload INTO result FROM dashboard_private.page_rollups WHERE page='coverage' AND cache_key=dashboard_private.normalize_page_filters_v1(p_filters);
  IF FOUND THEN RETURN result; END IF;
 END IF;
 RETURN dashboard_private.coverage_result_v1(s,p_filters);
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dashboard_private FROM PUBLIC,anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dashboard_private TO authenticated;
REVOKE ALL ON FUNCTION dashboard_private.assignment_branches_v1(jsonb),dashboard_private.queue_summaries_v1() FROM authenticated;
REVOKE ALL ON FUNCTION public.get_dashboard_filters_v1(text,jsonb),public.get_coverage_page_v1(jsonb),public.get_weekly_page_v1(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_filters_v1(text,jsonb),public.get_coverage_page_v1(jsonb),public.get_weekly_page_v1(jsonb) TO authenticated;

-- Mesma autorização de leitura, avaliada uma vez por consulta.
ALTER POLICY "Acesso Leitura Unificado" ON public.data_product_details USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.data_stock USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.dim_vendedores USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.dim_supervisores USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
NOTIFY pgrst,'reload schema';


-- Migration 20261002231915 titles_summary_null_keys
-- Títulos: KPIs resumidos por cliente/vencimento; linhas originais e paginação preservadas.
CREATE OR REPLACE FUNCTION public.get_titulos_view_data(p_filial text[] DEFAULT NULL::text[], p_cidade text[] DEFAULT NULL::text[], p_supervisor text[] DEFAULT NULL::text[], p_vendedor text[] DEFAULT NULL::text[], p_rede text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text, p_coordenador text[] DEFAULT NULL::text[], p_cocoordenador text[] DEFAULT NULL::text[], p_page integer DEFAULT 0, p_limit integer DEFAULT 50)
 RETURNS json
 LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET plan_cache_mode='force_custom_plan' SET jit='off' AS $function$
DECLARE s jsonb:=dashboard_private.scope_v1(); result json; v_critical_date date:=CURRENT_DATE-60;
BEGIN
 IF p_page<0 OR p_limit<1 THEN RAISE EXCEPTION 'Paginação inválida' USING ERRCODE='22023'; END IF;
 WITH authorized AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 filtered AS MATERIALIZED(SELECT
        t.cod_cliente,
        t.vl_titulos,
        t.vl_receber,
        t.dt_vencimento,t.row_count,t.positive_receber,
        COALESCE(c.nomecliente, c.razaosocial, c.fantasia, 'Desconhecido') AS nomecliente,
        COALESCE(c.cidade, 'N/A') AS cidade,
        COALESCE(c.rca1, 'N/A') AS vendedor_nome,
        c.ramo,
        c.filial,
        c.supervisor
    FROM dashboard_private.receivables_summary t
    LEFT JOIN public.data_clients c ON (
        COALESCE(c.codigo_cliente, c.cod_cliente, '')::text = t.cod_cliente::text
        OR TRIM(LEADING '0' FROM COALESCE(c.codigo_cliente, c.cod_cliente, '')::text) = TRIM(LEADING '0' FROM t.cod_cliente::text)
    )
    WHERE (p_cidade IS NULL OR c.cidade = ANY(p_cidade))
      AND (
          p_filial IS NULL
          OR c.filial = ANY(p_filial)
          OR TRIM(c.filial) = ANY(p_filial)
          OR TRIM(LEADING '0' FROM COALESCE(c.filial, '')) = ANY(
              SELECT TRIM(LEADING '0' FROM elem) FROM unnest(p_filial) AS elem
          )
          OR LPAD(TRIM(COALESCE(c.filial, '')), 2, '0') = ANY(
              SELECT LPAD(TRIM(elem), 2, '0') FROM unnest(p_filial) AS elem
          )
          OR EXISTS (
              SELECT 1 FROM unnest(p_filial) elem
              WHERE c.filial ILIKE '%' || elem || '%'
          )
          OR EXISTS (
              SELECT 1 FROM public.config_city_branches ccb
              WHERE UPPER(ccb.cidade) = UPPER(COALESCE(c.cidade, ''))
                AND (
                    ccb.filial = ANY(p_filial)
                    OR TRIM(ccb.filial) = ANY(p_filial)
                    OR TRIM(LEADING '0' FROM COALESCE(ccb.filial, '')) = ANY(
                        SELECT TRIM(LEADING '0' FROM elem) FROM unnest(p_filial) AS elem
                    )
                    OR LPAD(TRIM(COALESCE(ccb.filial, '')), 2, '0') = ANY(
                        SELECT LPAD(TRIM(elem), 2, '0') FROM unnest(p_filial) AS elem
                    )
                )
          )
      )
      AND (
          p_supervisor IS NULL
          OR c.supervisor = ANY(p_supervisor)
          OR c.cod_supervisor = ANY(p_supervisor)
          OR UPPER(TRIM(COALESCE(c.supervisor, ''))) = ANY(SELECT UPPER(TRIM(elem)) FROM unnest(p_supervisor) AS elem)
          OR UPPER(TRIM(COALESCE(c.cod_supervisor, ''))) = ANY(SELECT UPPER(TRIM(elem)) FROM unnest(p_supervisor) AS elem)
          OR EXISTS (
              SELECT 1 FROM unnest(p_supervisor) elem
              WHERE (c.supervisor IS NOT NULL AND (c.supervisor ILIKE '%' || elem || '%' OR elem ILIKE '%' || c.supervisor || '%'))
                 OR (c.cod_supervisor IS NOT NULL AND (c.cod_supervisor ILIKE '%' || elem || '%' OR elem ILIKE '%' || c.cod_supervisor || '%'))
                 OR (elem LIKE '% - %' AND (
                     c.supervisor ILIKE '%' || trim(split_part(elem, ' - ', 2)) || '%'
                     OR c.cod_supervisor = trim(split_part(elem, ' - ', 1))
                 ))
          )
          OR EXISTS (
              SELECT 1 FROM public.data_clients c2
              WHERE (
                  (c2.rca1 IS NOT NULL AND c2.rca1 <> '' AND c2.rca1 = c.rca1)
                  OR (c2.vendedor_codigo IS NOT NULL AND c2.vendedor_codigo <> '' AND c2.vendedor_codigo = c.vendedor_codigo)
              )
              AND (
                  c2.supervisor = ANY(p_supervisor)
                  OR c2.cod_supervisor = ANY(p_supervisor)
                  OR UPPER(TRIM(COALESCE(c2.supervisor, ''))) = ANY(SELECT UPPER(TRIM(elem)) FROM unnest(p_supervisor) AS elem)
                  OR EXISTS (
                      SELECT 1 FROM unnest(p_supervisor) elem
                      WHERE c2.supervisor ILIKE '%' || elem || '%'
                         OR elem ILIKE '%' || c2.supervisor || '%'
                         OR (elem LIKE '% - %' AND (
                             c2.supervisor ILIKE '%' || trim(split_part(elem, ' - ', 2)) || '%'
                             OR c2.cod_supervisor = trim(split_part(elem, ' - ', 1))
                         ))
                  )
              )
          )
                    OR EXISTS (
              SELECT 1 FROM public.data_orders o
              WHERE (o.codcli = COALESCE(c.codigo_cliente, c.cod_cliente, ''))
                AND (
                    o.superv = ANY(p_supervisor)
                    OR EXISTS (
                        SELECT 1 FROM unnest(p_supervisor) elem
                        WHERE o.superv ILIKE '%' || elem || '%'
                           OR elem ILIKE '%' || o.superv || '%'
                           OR (elem LIKE '% - %' AND (
                               o.superv ILIKE '%' || trim(split_part(elem, ' - ', 2)) || '%'
                           ))
                    )
                )
          )
      )
      AND (
          p_vendedor IS NULL
          OR c.rca1 = ANY(p_vendedor)
          OR c.vendedor = ANY(p_vendedor)
          OR c.vendedor_codigo = ANY(p_vendedor)
      )
      AND (
          p_coordenador IS NULL
          OR EXISTS (
              SELECT 1 FROM public.data_hierarchy dh
              LEFT JOIN public.data_client_promoters dcp ON dcp.promoter_code = dh.cod_promotor
              WHERE (dh.nome_coord = ANY(p_coordenador) OR dh.cod_coord = ANY(p_coordenador))
                AND (
                    dcp.client_code = COALESCE(c.codigo_cliente, c.cod_cliente)
                    OR dh.cod_promotor = c.rca1
                    OR dh.cod_promotor = c.vendedor_codigo
                )
          )
      )
      AND (
          p_cocoordenador IS NULL
          OR EXISTS (
              SELECT 1 FROM public.data_hierarchy dh
              LEFT JOIN public.data_client_promoters dcp ON dcp.promoter_code = dh.cod_promotor
              WHERE (dh.nome_cocoord = ANY(p_cocoordenador) OR dh.cod_cocoord = ANY(p_cocoordenador))
                AND (
                    dcp.client_code = COALESCE(c.codigo_cliente, c.cod_cliente)
                    OR dh.cod_promotor = c.rca1
                    OR dh.cod_promotor = c.vendedor_codigo
                )
          )
      )
      AND (
          p_rede IS NULL
          OR (array_position(p_rede, 'C/ REDE') IS NOT NULL AND (c.ramo IS NOT NULL AND c.ramo <> '' AND c.ramo <> 'N/A'))
          OR (array_position(p_rede, 'S/ REDE') IS NOT NULL AND (c.ramo IS NULL OR c.ramo = '' OR c.ramo = 'N/A'))
          OR (c.ramo = ANY(p_rede))
      )
      AND (
          p_search IS NULL
          OR p_search = ''
          OR t.cod_cliente::text ILIKE '%' || p_search || '%'
          OR c.nomecliente ILIKE '%' || p_search || '%'
          OR c.razaosocial ILIKE '%' || p_search || '%'
          OR c.fantasia ILIKE '%' || p_search || '%'
      ) AND (s->>'kind'='admin' OR EXISTS(SELECT 1 FROM authorized ac WHERE
 ac.code=COALESCE(c.codigo_cliente,c.cod_cliente,'') OR ac.code=t.cod_cliente
 OR ltrim(ac.code,'0')=ltrim(t.cod_cliente,'0')))),
 rows AS(SELECT t.cod_cliente,t.vl_titulos,t.vl_receber,t.dt_vencimento,f.nomecliente,f.cidade,f.vendedor_nome,f.ramo
 FROM public.data_titulos t JOIN filtered f ON f.cod_cliente IS NOT DISTINCT FROM t.cod_cliente AND f.dt_vencimento IS NOT DISTINCT FROM t.dt_vencimento
 ORDER BY t.dt_vencimento ASC NULLS LAST,t.cod_cliente ASC OFFSET (p_page*p_limit) LIMIT p_limit)
 SELECT json_build_object('kpis',json_build_object(
 'total_rows',coalesce((SELECT sum(row_count) FROM filtered),0),
 'total_vl_receber',coalesce((SELECT sum(vl_receber) FROM filtered),0),
 'critical_vl_receber',coalesce((SELECT sum(positive_receber) FROM filtered WHERE dt_vencimento<v_critical_date),0),
 'critical_clients',(SELECT count(DISTINCT cod_cliente) FROM filtered WHERE dt_vencimento<v_critical_date AND positive_receber>0)),
 'rows',coalesce((SELECT json_agg(r) FROM rows r),'[]'::json)) INTO result;
 RETURN result;
END $function$;
REVOKE ALL ON FUNCTION public.get_titulos_view_data(text[],text[],text[],text[],text[],text,text[],text[],integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_titulos_view_data(text[],text[],text[],text[],text[],text,text[],text[],integer,integer) TO authenticated;


-- Migration 20261002231918 shared_summary_stock_changes_queue
CREATE OR REPLACE FUNCTION dashboard_private.queue_summaries_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_SCHEMA<>'public' OR TG_TABLE_NAME NOT IN('data_detailed','data_history','data_clients','data_client_promoters','data_hierarchy','dim_produtos','dim_vendedores','dim_supervisores','data_product_details','data_titulos','dim_fornecedores','data_stock') THEN
  RAISE EXCEPTION 'Origem de atualização inválida';
 END IF;
 IF NOT ((auth.uid() IS NOT NULL AND public.is_admin()) OR (auth.uid() IS NULL AND (session_user IN('postgres','supabase_admin') OR current_setting('role',true)='service_role'))) THEN
  RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501';
 END IF;
 UPDATE dashboard_private.summary_state SET dirty=true,last_change=clock_timestamp() WHERE id=true;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION dashboard_private.queue_summaries_v1() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['data_detailed','data_history','data_clients','data_client_promoters','data_hierarchy','dim_produtos','dim_vendedores','dim_supervisores','data_product_details','data_titulos','dim_fornecedores','data_stock'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS dashboard_summary_dirty ON public.%I',t);
  EXECUTE format('CREATE TRIGGER dashboard_summary_dirty AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION dashboard_private.queue_summaries_v1()',t);
 END LOOP;
END $$;

REVOKE ALL ON FUNCTION dashboard_private.queue_summaries_v1(),dashboard_private.assignment_branches_v1(jsonb),dashboard_private.assignments_source_v1(jsonb) FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';


-- COMPARATIVO RPC COMPLETO V2 E COBERTURA AMERICANAS
-- Comparativo RPC completo e correção de Cobertura/Americanas — 02/10/2026
-- Instalar após shared_dashboard_summaries_v1.sql.

-- Comparativo completo: autorização, seleção, indicadores, gráficos e tabelas no banco.
-- Instalar após shared_dashboard_summaries_v1.sql. Nenhuma alteração nas fontes.
CREATE OR REPLACE FUNCTION dashboard_private.comparison_rows_v2(s jsonb,f jsonb)
RETURNS TABLE(source text,codcli text,produto text,codfor text,tipovenda text,day date,
 amount numeric,vlvenda numeric,vlbonific numeric,totpesoliq numeric,ramo text,group_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 selected AS MATERIALIZED(SELECT c.* FROM clients c LEFT JOIN assignments a ON a.client=c.code WHERE
 (coalesce(f->>'mode','promoter')<>'seller' OR s->>'kind'<>'admin' OR nullif(c.rca,'') IS NOT NULL)
 AND (coalesce(f->>'mode','promoter')='seller' OR (
 (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false))
 AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false))
 AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (
 (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? a.supervisor_name,false))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? c.rca,false))))
 AND dashboard_private.rede_v1(f,c.rede)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city')))
 SELECT d.source,d.codcli,d.produto,d.codfor,d.tipovenda,d.day,
 CASE WHEN coalesce(jsonb_array_length(f->'types'),0)>0 AND NOT(coalesce(f->'types' ? '1',false) OR coalesce(f->'types' ? '9',false)) THEN d.vlbonific ELSE d.vlvenda END,
 d.vlvenda,d.vlbonific,d.totpesoliq,c.rede,
 CASE WHEN f->>'facet_pasta'='true' THEN (CASE WHEN coalesce(d.observacaofor,'') NOT IN('','0','00','N/A') THEN d.observacaofor WHEN coalesce(df.pasta,'')<>'' THEN df.pasta WHEN upper(coalesce(df.nome,d.codfor)) LIKE '%PEPSICO%' THEN 'PEPSICO' ELSE 'MULTIMARCAS' END)
 WHEN coalesce(f->>'mode','promoter')='seller' THEN coalesce(ds.nome,d.codsupervisor,'N/A')
 WHEN c.promotor IS NULL THEN 'Sem Hierarquia'
 WHEN coalesce(jsonb_array_length(f->'coords'),0)>0 THEN coalesce(c.promotor_name,c.promotor)
 ELSE coalesce(c.coord_name,c.coord,'Sem Hierarquia') END
 FROM dashboard_private.sales_day d JOIN selected c ON c.code=d.codcli
 LEFT JOIN public.dim_fornecedores df ON df.codigo=d.codfor
 LEFT JOIN public.dim_supervisores ds ON ds.codigo=d.codsupervisor
 WHERE (s->>'kind' IN('admin','trade') OR
 (s->>'kind'='seller' AND lower(btrim(d.codusur))=(SELECT lower(btrim(role)) FROM public.profiles WHERE id=auth.uid())) OR
 (s->>'kind'='supervisor' AND lower(btrim(d.codsupervisor))=(SELECT lower(btrim(role)) FROM public.profiles WHERE id=auth.uid())))
 AND (coalesce(f->>'filial','ambas') IN('all','ambas') OR d.filial=f->>'filial')
 AND (coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(f->>'pasta','')='' OR (CASE WHEN coalesce(d.observacaofor,'') NOT IN('','0','00','N/A') THEN d.observacaofor WHEN coalesce(df.pasta,'')<>'' THEN df.pasta WHEN upper(coalesce(df.nome,d.codfor)) LIKE '%PEPSICO%' THEN 'PEPSICO' ELSE 'MULTIMARCAS' END)=f->>'pasta');
$$;

-- Only compact daily/monthly/group aggregates enter this calendar calculation.
CREATE OR REPLACE FUNCTION dashboard_private.comparison_charts_v2(daily jsonb,monthly jsonb,groups jsonb,ref date,holidays jsonb,tendency boolean,ratio numeric)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE first_day date:=date_trunc('month',ref)::date; last_day date:=(date_trunc('month',ref)+interval '1 month - 1 day')::date;
 first_sunday date:=first_day-extract(dow FROM first_day)::int; week_count int; current_week int;
 wc numeric[]; wh numeric[]; table_days numeric[]; weights numeric[]:=array_fill(0::numeric,ARRAY[7]);
 sums numeric[]:=array_fill(0::numeric,ARRAY[31]); counts int[]:=array_fill(0,ARRAY[31]); prev numeric[]:=array_fill(0::numeric,ARRAY[31]); prev_max int:=0;
 day_sales jsonb:='{}'; rec jsonb; dt date; m date; finish date; wd int; idx int; dow int; i int; k int;
 total_wd int:=0; passed int; total int; value numeric; raw_value numeric; remainder numeric; weight_total numeric; avg_value numeric;
 labels jsonb:='[]'; current_data jsonb:='[]'; history_data jsonb:='[]'; weeks jsonb:='[]'; weekly_rows jsonb:='[]'; grand numeric:=0;
BEGIN
 week_count:=((last_day-first_sunday)/7)+1; current_week:=((ref-first_sunday)/7)+1;
 wc:=array_fill(0::numeric,ARRAY[week_count]); wh:=wc; table_days:=array_fill(0::numeric,ARRAY[week_count*7]);
 FOR rec IN SELECT x FROM jsonb_array_elements(daily) x LOOP
  dt:=(rec->>'day')::date; value:=(rec->>'amount')::numeric; raw_value:=(rec->>'raw_value')::numeric; dow:=extract(dow FROM dt)::int;
  IF rec->>'source'='current' THEN
   idx:=((dt-first_sunday)/7)+1;
   IF dt>=first_sunday AND dt<=first_sunday+week_count*7-1 THEN wc[idx]:=wc[idx]+value; table_days[(idx-1)*7+dow+1]:=table_days[(idx-1)*7+dow+1]+raw_value; END IF;
   IF dt BETWEEN first_day AND last_day THEN day_sales:=jsonb_set(day_sales,ARRAY[dt::text],to_jsonb(coalesce((day_sales->>dt::text)::numeric,0)+value)); END IF;
  ELSE
   m:=date_trunc('month',dt)::date; idx:=((dt-(m-extract(dow FROM m)::int))/7)+1;
   IF idx<=week_count THEN wh[idx]:=wh[idx]+value/3.0; END IF;
   weights[dow+1]:=weights[dow+1]+value;
   IF dt>=first_sunday AND dt<first_day THEN wc[1]:=wc[1]+value; table_days[dow+1]:=table_days[dow+1]+raw_value; END IF;
  END IF;
 END LOOP;
 SELECT sum(weights[j]) INTO value FROM generate_series(1,7) j;
 IF value>0 THEN FOR k IN 1..7 LOOP weights[k]:=weights[k]/value; END LOOP;
 ELSE weights:=array_fill(0::numeric,ARRAY[7]); END IF;
 FOR m IN SELECT DISTINCT date_trunc('month',(x->>'day')::date)::date FROM jsonb_array_elements(daily) x WHERE x->>'source'='history' AND (x->>'has_sales')::boolean LOOP
  finish:=(m+interval '1 month - 1 day')::date; wd:=0; dt:=m;
  WHILE dt<=finish LOOP
   IF extract(isodow FROM dt) BETWEEN 1 AND 5 AND NOT coalesce(holidays ? dt::text,false) THEN
    wd:=wd+1;
    SELECT coalesce(sum((x->>'amount')::numeric),0) INTO value FROM jsonb_array_elements(daily) x WHERE x->>'source'='history' AND x->>'day'=dt::text;
    sums[wd]:=sums[wd]+value; counts[wd]:=counts[wd]+1;
    IF m=(first_day-interval '1 month')::date THEN prev[wd]:=value; prev_max:=wd; END IF;
   END IF;
   dt:=dt+1;
  END LOOP;
 END LOOP;
 SELECT count(*) INTO total_wd FROM generate_series(first_day,last_day,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5 AND NOT coalesce(holidays ? to_char(d,'YYYY-MM-DD'),false);
 wd:=0; dt:=first_day;
 WHILE dt<=last_day LOOP
  value:=coalesce((day_sales->>dt::text)::numeric,0);
  IF extract(isodow FROM dt) BETWEEN 1 AND 5 AND NOT coalesce(holidays ? dt::text,false) THEN
   wd:=wd+1;
   avg_value:=CASE WHEN counts[wd]>0 THEN sums[wd]/counts[wd] WHEN prev_max>0 AND total_wd>prev_max AND wd-(total_wd-prev_max)>0 THEN prev[wd-(total_wd-prev_max)] ELSE 0 END;
   labels:=labels||to_jsonb(dt-first_day+1); current_data:=current_data||to_jsonb(value); history_data:=history_data||to_jsonb(avg_value);
  ELSIF value>0 THEN labels:=labels||to_jsonb(dt-first_day+1); current_data:=current_data||to_jsonb(value); history_data:=history_data||'null'::jsonb;
  END IF;
  dt:=dt+1;
 END LOOP;
 FOR i IN 1..week_count LOOP
  IF tendency AND i=current_week THEN
   SELECT count(*),count(*) FILTER(WHERE d::date<=ref) INTO total,passed FROM generate_series(first_sunday+(i-1)*7,first_sunday+(i-1)*7+6,'1 day') d
    WHERE extract(isodow FROM d) BETWEEN 1 AND 5 AND NOT coalesce(holidays ? to_char(d,'YYYY-MM-DD'),false);
   wc[i]:=CASE WHEN passed>0 AND total>0 THEN wc[i]/passed*total ELSE wh[i] END;
   IF passed>0 AND total>0 THEN
    SELECT sum(table_days[(i-1)*7+j]) INTO value FROM generate_series(1,7) j;
    remainder:=value/passed*total-value;
    SELECT coalesce(sum(weights[extract(dow FROM d)::int+1]),0),count(*) INTO weight_total,k FROM generate_series(first_sunday+(i-1)*7,first_sunday+(i-1)*7+6,'1 day') d
     WHERE d::date>ref AND extract(isodow FROM d) BETWEEN 1 AND 5 AND NOT coalesce(holidays ? to_char(d,'YYYY-MM-DD'),false);
    IF remainder>0 AND k>0 THEN
     FOR dt IN SELECT d::date FROM generate_series(first_sunday+(i-1)*7,first_sunday+(i-1)*7+6,'1 day') d WHERE d::date>ref AND extract(isodow FROM d) BETWEEN 1 AND 5 AND NOT coalesce(holidays ? to_char(d,'YYYY-MM-DD'),false) LOOP
      dow:=extract(dow FROM dt)::int; table_days[(i-1)*7+dow+1]:=remainder*CASE WHEN weight_total>0 THEN weights[dow+1]/weight_total ELSE 1.0/k END;
     END LOOP;
    END IF;
   END IF;
  ELSIF tendency AND i>current_week THEN
   wc[i]:=wh[i];
   IF wh[i]>0 THEN
    SELECT sum(weights[j]) INTO weight_total FROM generate_series(2,6) j;
    FOR k IN 2..6 LOOP table_days[(i-1)*7+k]:=wh[i]*CASE WHEN weight_total>0 THEN weights[k]/weight_total ELSE 0.2 END; END LOOP;
   END IF;
  END IF;
  weeks:=weeks||jsonb_build_object('label','Semana '||i,'current',wc[i],'history',wh[i]);
  SELECT coalesce(sum(table_days[(i-1)*7+j]),0) INTO value FROM generate_series(1,7) j; grand:=grand+value;
  weekly_rows:=weekly_rows||jsonb_build_object('label','Semana '||i,'total',value);
 END LOOP;
 RETURN jsonb_build_object('daily',jsonb_build_object('labels',labels,'current',current_data,'history',history_data),'weekly',weeks,'monthly',monthly,
 'weekly_rows',weekly_rows,'weekly_total',grand,'groups',groups);
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.comparison_result_v2(s jsonb,p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s'
SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' SET enable_nestloop='off' AS $fn$
DECLARE f jsonb:=p_filters; ref_date date; types text[]; alt_mode boolean;
 holidays jsonb:=coalesce(f->'holidays','[]'); total_days int; passed_days int; ratio numeric:=1; result jsonb;
BEGIN
 IF jsonb_typeof(f) IS DISTINCT FROM 'object' OR jsonb_typeof(holidays) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(day) FILTER(WHERE source='current'),max(day),current_date) INTO ref_date FROM dashboard_private.sales_calendar;
 SELECT coalesce(array_agg(value),ARRAY[]::text[]) INTO types FROM jsonb_array_elements_text(coalesce(f->'types','[]'));
 alt_mode:=cardinality(types)>0 AND NOT('1'=ANY(types) OR '9'=ANY(types));
 SELECT count(*),greatest(count(*) FILTER(WHERE d::date<=ref_date),1) INTO total_days,passed_days
 FROM generate_series(date_trunc('month',ref_date)::date,(date_trunc('month',ref_date)+interval '1 month - 1 day')::date,'1 day') d
 WHERE extract(isodow FROM d) BETWEEN 1 AND 5 AND NOT coalesce(holidays ? to_char(d,'YYYY-MM-DD'),false);
 IF coalesce((f->>'tendency')::boolean,false) AND total_days>0 AND passed_days<total_days THEN ratio:=total_days::numeric/passed_days; END IF;
 WITH product_info AS MATERIALIZED (
    SELECT codigo,descricao,
      (CASE WHEN upper(descricao) LIKE '%CHEETOS%' THEN 1 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%DORITOS%' THEN 2 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%FANDANGOS%' THEN 4 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%RUFFLES%' THEN 8 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%TORCIDA%' THEN 16 ELSE 0 END) salty_mask,
      (CASE WHEN upper(descricao) LIKE '%TODDYNHO%' THEN 1 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%TODDY %' THEN 2 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%QUAKER%' THEN 4 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%KEROCOCO%' THEN 8 ELSE 0 END) foods_mask
    FROM public.dim_produtos
  ), filtered AS MATERIALIZED(
 SELECT r.*,to_char(r.day,'YYYY-MM') month_key FROM dashboard_private.comparison_rows_v2(s,f) r
 ), sales AS MATERIALIZED (
    SELECT * FROM filtered
    WHERE (cardinality(types)=0 OR tipovenda=ANY(types)) AND (alt_mode OR tipovenda IN ('1','9'))
  ), totals AS (
    SELECT source,sum(amount) fat,sum(coalesce(totpesoliq,0)) peso FROM sales GROUP BY source
  ), losses AS (
    SELECT source,sum(coalesce(vlbonific,0)) perdas FROM filtered
    WHERE tipovenda='5' AND upper(coalesce(ramo,'')) NOT LIKE '%AMERICANAS%' AND upper(coalesce(ramo,'')) NOT LIKE '%BH%'
    GROUP BY source
  ), client_totals AS (
    SELECT source,CASE WHEN source='current' THEN '' ELSE month_key END m,codcli,sum(amount) amount
    FROM sales WHERE codcli IS NOT NULL AND codcli<>'' AND (source='current' OR month_key IS NOT NULL)
    GROUP BY 1,2,3
  ), client_counts AS (
    SELECT source,m,count(*) FILTER(WHERE amount>=1) clients FROM client_totals GROUP BY 1,2
  ), product_totals AS (
    SELECT source,CASE WHEN source='current' THEN '' ELSE month_key END m,codcli,produto,
      min(codfor) codfor,sum(amount) amount
    FROM sales WHERE codcli IS NOT NULL AND codcli<>'' AND (source='current' OR month_key IS NOT NULL)
    GROUP BY 1,2,3,4
  ), mixes AS (
    SELECT source,m,codcli,
      count(*) FILTER(WHERE amount>=1 AND codfor IN ('707','708','752')) mix,
      bit_or(CASE WHEN amount>=1 THEN coalesce(pi.salty_mask,0) ELSE 0 END)=31 salty,
      bit_or(CASE WHEN amount>=1 THEN coalesce(pi.foods_mask,0) ELSE 0 END)=15 foods
    FROM product_totals pt LEFT JOIN product_info pi ON pi.codigo=pt.produto GROUP BY source,m,codcli
  ), month_mix AS (
    SELECT source,m,coalesce(avg(mix) FILTER(WHERE mix>0),0) mix,
      count(*) FILTER(WHERE salty) salty,count(*) FILTER(WHERE foods) foods FROM mixes GROUP BY 1,2
  ), latest AS (
    SELECT month_key FROM sales WHERE source='history' AND month_key IS NOT NULL GROUP BY month_key ORDER BY month_key DESC LIMIT 3
  ), kpis AS (
    SELECT 'current' source,
      coalesce((SELECT clients FROM client_counts WHERE source='current'),0)::numeric clients,
      coalesce((SELECT mix FROM month_mix WHERE source='current'),0) mix,
      coalesce((SELECT salty FROM month_mix WHERE source='current'),0)::numeric salty,
      coalesce((SELECT foods FROM month_mix WHERE source='current'),0)::numeric foods
    UNION ALL
    SELECT 'history',
      coalesce((SELECT sum(clients) FROM client_counts WHERE source='history' AND m IN(SELECT month_key FROM latest)),0)/3.0,
      coalesce((SELECT sum(mix) FROM month_mix WHERE source='history' AND m IN(SELECT month_key FROM latest)),0)/3.0,
      coalesce((SELECT sum(salty) FROM month_mix WHERE source='history' AND m IN(SELECT month_key FROM latest)),0)/3.0,
      coalesce((SELECT sum(foods) FROM month_mix WHERE source='history' AND m IN(SELECT month_key FROM latest)),0)/3.0
  ), final AS (
    SELECT k.source,coalesce(t.fat,0)/CASE WHEN k.source='current' THEN 1 ELSE 3.0 END*CASE WHEN k.source='current' THEN ratio ELSE 1 END fat,
      coalesce(t.peso,0)/CASE WHEN k.source='current' THEN 1 ELSE 3.0 END*CASE WHEN k.source='current' THEN ratio ELSE 1 END peso,
      CASE WHEN k.source='current' AND ratio<>1 THEN floor(k.clients*ratio+0.5) ELSE k.clients END clients,
      k.mix,
      CASE WHEN k.source='current' AND ratio<>1 THEN floor(k.salty*ratio+0.5) ELSE k.salty END salty,
      CASE WHEN k.source='current' AND ratio<>1 THEN floor(k.foods*ratio+0.5) ELSE k.foods END foods,
      coalesce(l.perdas,0)/CASE WHEN k.source='current' THEN 1 ELSE 3.0 END*CASE WHEN k.source='current' THEN ratio ELSE 1 END perdas
    FROM kpis k LEFT JOIN totals t USING(source) LEFT JOIN losses l USING(source)
  ),
 daily AS(SELECT source,day,coalesce(sum(amount) FILTER(WHERE (cardinality(types)=0 OR tipovenda=ANY(types)) AND (alt_mode OR tipovenda IN('1','9'))),0) amount,
 coalesce(sum(vlvenda) FILTER(WHERE (cardinality(types)=0 OR tipovenda=ANY(types)) AND (source='current' OR alt_mode OR tipovenda IN('1','9'))),0) raw_value,
 bool_or((cardinality(types)=0 OR tipovenda=ANY(types)) AND (alt_mode OR tipovenda IN('1','9'))) has_sales
 FROM filtered WHERE day IS NOT NULL GROUP BY source,day),
 month_totals AS(SELECT month_key,sum(amount) fat FROM sales WHERE source='history' AND month_key IN(SELECT month_key FROM latest) GROUP BY month_key),
 monthly AS(SELECT month_key||'-01' month_date,fat,coalesce((SELECT clients FROM client_counts WHERE source='history' AND m=month_key),0) clients,false is_current FROM month_totals
 UNION ALL SELECT to_char(ref_date,'YYYY-MM')||'-01',fat,clients,true FROM final WHERE source='current'),
 group_totals AS(SELECT group_name name,coalesce(sum(amount) FILTER(WHERE source='current'),0)*ratio current,
 coalesce(sum(amount) FILTER(WHERE source='history' AND day IS NOT NULL),0)/3.0 history
 FROM sales GROUP BY group_name),
 groups AS(SELECT *,CASE WHEN history>0 THEN (current-history)/history*100 WHEN current>0 THEN 100 ELSE 0 END variation FROM group_totals)
 SELECT jsonb_build_object('schema_version',2,'reference_date',ref_date,'tendency_ratio',ratio,
 'summary_generation',(SELECT generation FROM dashboard_private.summary_state WHERE id),
 'kpis',(SELECT jsonb_object_agg(source,jsonb_build_object('fat',fat,'peso',peso,'clients',clients,'mixPepsico',mix,
 'positivacaoSalty',salty,'positivacaoFoods',foods,'perdas',perdas,'ticket',CASE WHEN clients>0 THEN fat/clients ELSE 0 END)) FROM final),
 'charts',dashboard_private.comparison_charts_v2(
 coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY source,day) FROM daily t),'[]'),
 coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY is_current,month_date) FROM monthly t),'[]'),
 coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY name) FROM groups t),'[]'),ref_date,holidays,coalesce((f->>'tendency')::boolean,false),ratio)) INTO result;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION dashboard_private.comparison_rows_v2(jsonb,jsonb),dashboard_private.comparison_charts_v2(jsonb,jsonb,jsonb,date,jsonb,boolean,numeric),dashboard_private.comparison_result_v2(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION dashboard_private.comparison_rows_v2(jsonb,jsonb),dashboard_private.comparison_charts_v2(jsonb,jsonb,jsonb,date,jsonb,boolean,numeric),dashboard_private.comparison_result_v2(jsonb,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.comparison_filters_result_v2(s jsonb,p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s'
SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' SET enable_nestloop='off' AS $$
DECLARE f jsonb:=p_filters; result jsonb; options jsonb;
BEGIN
 IF jsonb_typeof(f) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 result:=dashboard_private.facet_result_v1('coverage',s,f);
 WITH raw AS MATERIALIZED(SELECT r.*,c.cidade city,coalesce(p.descricao,'Produto '||r.produto) description,
 coalesce(df.nome,r.codfor) supplier_name,
 CASE WHEN r.codfor='1119' THEN CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END virtual_supplier,
 r.group_name pasta
 FROM dashboard_private.comparison_rows_v2(s,(f-ARRAY['suppliers','products','city','pasta'])||'{"facet_pasta":true}') r
 JOIN public.data_clients c ON c.codigo_cliente=r.codcli
 LEFT JOIN public.dim_produtos p ON p.codigo=r.produto LEFT JOIN public.dim_fornecedores df ON df.codigo=r.codfor),
 flags AS MATERIALIZED(SELECT *,
 (coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? codfor,false) OR coalesce(f->'suppliers' ? virtual_supplier,false)) sm,
 (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? produto,false)) pm,
 (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? tipovenda,false)) tm,
 (coalesce(f->>'city','')='' OR lower(city)=lower(f->>'city')) cm,
 (coalesce(f->>'pasta','')='' OR pasta=f->>'pasta') fm FROM raw),
 opts AS(SELECT 'suppliers' key,codfor code,supplier_name label FROM flags WHERE pm AND tm AND cm AND fm
 UNION SELECT 'suppliers',virtual_supplier,CASE virtual_supplier WHEN '1119_TODDYNHO' THEN 'TODDYNHO' WHEN '1119_TODDY' THEN 'TODDY' ELSE 'QUAKER / KEROCOCO' END FROM flags WHERE pm AND tm AND cm AND fm AND virtual_supplier IS NOT NULL
 UNION SELECT 'products',produto,'('||produto||') '||description FROM flags WHERE sm AND tm AND cm AND fm
 UNION SELECT 'types',tipovenda,tipovenda FROM flags WHERE sm AND pm AND cm AND fm AND tipovenda IS NOT NULL
 UNION SELECT 'cities',city,city FROM flags WHERE sm AND pm AND tm AND fm AND city NOT IN('','N/A','CIDADE','MUNICIPIO','CIDADE_CLIENTE','NOME DA CIDADE','CITY')
 UNION SELECT 'pastas',pasta,pasta FROM flags WHERE sm AND pm AND tm AND cm)
 SELECT jsonb_object_agg(key,items) INTO options FROM(SELECT key,jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) items FROM opts GROUP BY key)t;
 RETURN result||jsonb_build_object('suppliers',coalesce(options->'suppliers','[]'),'products',coalesce(options->'products','[]'),
 'types',coalesce(options->'types','[]'),'cities',coalesce((SELECT jsonb_agg(x->>'code' ORDER BY x->>'code') FROM jsonb_array_elements(coalesce(options->'cities','[]')) x),'[]'),
 'pastas',coalesce(options->'pastas','[]'));
END $$;
REVOKE ALL ON FUNCTION dashboard_private.comparison_filters_result_v2(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION dashboard_private.comparison_filters_result_v2(jsonb,jsonb) TO authenticated;

-- Cache only administrator-wide selections. Every request still derives its session wallet.
CREATE OR REPLACE FUNCTION public.get_comparison_page_v2(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET plan_cache_mode='force_custom_plan' SET jit='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb; key jsonb;
BEGIN
 IF jsonb_typeof(p_filters) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 key:=dashboard_private.normalize_page_filters_v1(p_filters-ARRAY['holidays','tendency']);
 IF s->>'kind'='admin' AND NOT coalesce((p_filters->>'tendency')::boolean,false) AND coalesce(jsonb_array_length(p_filters->'holidays'),0)=0
 AND key IN('{}'::jsonb,'{"pasta":"PEPSICO"}'::jsonb) THEN
  SELECT payload INTO result FROM dashboard_private.page_rollups WHERE page='comparison' AND cache_key=key;
  IF FOUND THEN RETURN result; END IF;
 END IF;
 RETURN dashboard_private.comparison_result_v2(s,p_filters);
END $$;
CREATE OR REPLACE FUNCTION public.get_comparison_filters_v2(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET plan_cache_mode='force_custom_plan' SET jit='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb; key jsonb;
BEGIN
 IF jsonb_typeof(p_filters) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 key:=dashboard_private.normalize_page_filters_v1(p_filters-ARRAY['holidays','tendency']);
 IF s->>'kind'='admin' AND key IN('{}'::jsonb,'{"pasta":"PEPSICO"}'::jsonb) THEN
  SELECT payload INTO result FROM dashboard_private.page_rollups WHERE page='comparison_filters' AND cache_key=key;
  IF FOUND THEN RETURN result; END IF;
 END IF;
 RETURN dashboard_private.comparison_filters_result_v2(s,p_filters);
END $$;
REVOKE ALL ON FUNCTION public.get_comparison_page_v2(jsonb),public.get_comparison_filters_v2(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_comparison_page_v2(jsonb),public.get_comparison_filters_v2(jsonb) TO authenticated;

-- Import completion polls this short call while the scheduled worker rebuilds the summaries.
-- A long rebuild cannot fit the Data API's 8-second statement timeout.
CREATE OR REPLACE FUNCTION public.get_dashboard_summary_status_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Consulta reservada ao administrador' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('status',CASE WHEN dirty THEN 'pending' ELSE 'current' END,'generation',generation,'refreshed_at',refreshed_at)
 INTO result FROM dashboard_private.summary_state WHERE id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_dashboard_summary_status_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary_status_v1() TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.coverage_result_v1(s jsonb,p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' SET enable_nestloop='off' AS $$
DECLARE f jsonb:=p_filters; ref date; start_date date; end_date date; prev_start date; prev_end date;
 custom_date boolean; alt boolean; result jsonb; days integer:=greatest(coalesce((f->>'working_days')::int,0),0);
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(day) FILTER(WHERE source='current'),max(day),current_date) INTO ref FROM dashboard_private.sales_calendar;
 custom_date:=nullif(f->>'date_start','') IS NOT NULL AND nullif(f->>'date_end','') IS NOT NULL;
 start_date:=CASE WHEN custom_date THEN (f->>'date_start')::date ELSE date_trunc('month',ref)::date END;
 end_date:=CASE WHEN custom_date THEN (f->>'date_end')::date ELSE (start_date+interval '1 month - 1 day')::date END;
 IF end_date<start_date THEN RAISE EXCEPTION 'Período inválido' USING ERRCODE='22023'; END IF;
 prev_start:=(start_date-interval '1 month')::date; prev_end:=(end_date-interval '1 month')::date;
 IF NOT custom_date THEN prev_end:=start_date-1; END IF;
 alt:=coalesce(jsonb_array_length(f->'types'),0)>0 AND NOT(coalesce(f->'types' ? '1',false) OR coalesce(f->'types' ? '9',false));
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 seller_sup AS(SELECT DISTINCT seller,supervisor_name FROM assignments),branches AS(SELECT client,filial FROM assignments),
 base_clients AS MATERIALIZED(SELECT c.* FROM clients c WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR EXISTS(SELECT 1 FROM seller_sup ss WHERE ss.seller=c.rca AND (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? ss.supervisor_name,false))) OR coalesce(jsonb_array_length(f->'supervisors'),0)=0)
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? c.rca,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR EXISTS(SELECT 1 FROM branches b WHERE b.client=c.code AND b.filial=f->>'filial'))),
 scoped AS MATERIALIZED(SELECT d.source,d.codcli client,d.produto product,d.day,d.codusur seller,
 d.vlvenda amount,d.unit_price,d.boxes,CASE WHEN alt THEN d.vlbonific ELSE d.vlvenda END value
 FROM (SELECT * FROM dashboard_private.sales_month_core WHERE NOT custom_date AND f->>'price_min' IS NULL AND f->>'price_max' IS NULL
 UNION ALL SELECT * FROM dashboard_private.sales_month WHERE NOT custom_date AND (f->>'price_min' IS NOT NULL OR f->>'price_max' IS NOT NULL)
 UNION ALL SELECT * FROM dashboard_private.sales_day WHERE custom_date) d
 JOIN base_clients c ON c.code=d.codcli WHERE (coalesce(f->>'filial','ambas') IN('ambas','all') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false))),
 filtered AS NOT MATERIALIZED(SELECT * FROM scoped d WHERE ((f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR (d.unit_price IS NOT NULL
 AND (f->>'price_min' IS NULL OR d.unit_price>=(f->>'price_min')::numeric)
 AND (f->>'price_max' IS NULL OR d.unit_price<=(f->>'price_max')::numeric)))),
 periods AS MATERIALIZED(
 SELECT r.*,'current'::text period FROM filtered r WHERE (custom_date AND day BETWEEN start_date AND end_date) OR(NOT custom_date AND source='current')
 UNION ALL SELECT r.*,'previous' FROM filtered r WHERE (custom_date AND day BETWEEN prev_start AND prev_end) OR(NOT custom_date AND source='history' AND day BETWEEN prev_start AND prev_end)
 UNION ALL SELECT r.*,'history' FROM filtered r WHERE NOT custom_date AND source='history' AND day NOT BETWEEN prev_start AND prev_end),
 product_clients AS(SELECT product,client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2,3),
 product_counts AS(SELECT product,count(*) FILTER(WHERE period='current' AND value>=1) current_count,count(*) FILTER(WHERE period='previous' AND value>=1) previous_count FROM product_clients GROUP BY product),
 selection AS(SELECT client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2),
 active_history AS(SELECT client FROM scoped WHERE source='history' GROUP BY client HAVING sum(amount)>=1),
 working AS MATERIALIZED(SELECT DISTINCT day FROM dashboard_private.sales_calendar WHERE extract(isodow FROM day) BETWEEN 1 AND 5
 AND (s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (source='current' AND codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))))),
 working_array AS(SELECT array_agg(day ORDER BY day) dates FROM working),
 stats_amounts AS(SELECT product,coalesce(sum(boxes) FILTER(WHERE period='current'),0) current_boxes,
 coalesce(sum(boxes) FILTER(WHERE period='previous'),0) previous_boxes,bool_or(day<date_trunc('month',ref)::date) has_history
 FROM periods GROUP BY product),
 stats AS MATERIALIZED(SELECT t.*,coalesce(nullif(p.descricao,''),'Produto '||t.product) description,(pd.dtcadastro AT TIME ZONE 'UTC')::date registered
 FROM stats_amounts t LEFT JOIN public.dim_produtos p ON p.codigo=t.product LEFT JOIN public.data_product_details pd ON pd.code=t.product),
 stock AS(SELECT product_code,sum(coalesce(stock_qty,0)) qty FROM public.data_stock WHERE coalesce(f->>'filial','ambas') IN('ambas','all') OR filial=f->>'filial' GROUP BY product_code),
 divisors AS MATERIALIZED(SELECT t.*,coalesce(st.qty,0) stock,coalesce(pc.current_count,0) current_count,coalesce(pc.previous_count,0) previous_count,
 greatest(1,CASE WHEN NOT coalesce(has_history,false) AND current_boxes>0 THEN least(
 greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1),
 CASE WHEN days>0 THEN days ELSE greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1) END)
 ELSE CASE WHEN days>0 THEN least(days,(SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered)) ELSE (SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered) END END)::numeric divisor
 FROM stats t LEFT JOIN stock st ON st.product_code=t.product LEFT JOIN product_counts pc USING(product)),
 -- Daily rows are read only for each product's required trend window, with original price buckets.
 trend_daily AS MATERIALIZED(SELECT d.produto product,d.day,sum(d.boxes) boxes
 FROM dashboard_private.sales_day d JOIN base_clients c ON c.code=d.codcli
 WHERE true  AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)) AND ((f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR (d.unit_price IS NOT NULL
 AND (f->>'price_min' IS NULL OR d.unit_price>=(f->>'price_min')::numeric)
 AND (f->>'price_max' IS NULL OR d.unit_price<=(f->>'price_max')::numeric)))

 GROUP BY d.produto,d.day),
 trend_totals AS MATERIALIZED(SELECT dv.product,coalesce(sum(d.boxes*CASE WHEN custom_date THEN
 (CASE WHEN d.day BETWEEN start_date AND end_date THEN 1 ELSE 0 END+CASE WHEN d.day BETWEEN prev_start AND prev_end THEN 1 ELSE 0 END) ELSE 1 END),0)/dv.divisor daily_avg
 FROM divisors dv CROSS JOIN working_array w LEFT JOIN trend_daily d
 ON d.product=dv.product AND d.day BETWEEN w.dates[greatest(1,cardinality(w.dates)-dv.divisor::int+1)] AND w.dates[cardinality(w.dates)]
 GROUP BY dv.product,dv.divisor),
 trend AS(SELECT d.*,t.daily_avg FROM divisors d JOIN trend_totals t USING(product)),
 table_all AS MATERIALIZED(SELECT product code,'('||product||') '||description descricao,stock "stockQty",current_boxes "boxesSoldCurrentMonth",previous_boxes "boxesSoldPreviousMonth",
 CASE WHEN previous_boxes>0 THEN (current_boxes-previous_boxes)/previous_boxes*100 WHEN current_boxes>0 THEN NULL ELSE 0 END "boxesVariation",
 CASE WHEN previous_count>0 THEN (current_count-previous_count)::numeric/previous_count*100 WHEN current_count>0 THEN NULL ELSE 0 END "pdvVariation",
 CASE WHEN daily_avg>0 THEN stock/daily_avg WHEN stock>0 THEN NULL ELSE 0 END "trendDays",previous_count "clientsPreviousCount",current_count "clientsCurrentCount",
 CASE WHEN (SELECT count(*) FROM base_clients)>0 THEN current_count::numeric/(SELECT count(*) FROM base_clients)*100 ELSE 0 END "coverageCurrent" FROM trend),
 table_filtered AS MATERIALIZED(SELECT * FROM table_all WHERE "boxesSoldCurrentMonth">0 AND CASE coalesce(f->>'trend','all') WHEN 'low' THEN "trendDays"<15 WHEN 'medium' THEN "trendDays">=15 AND "trendDays"<30 WHEN 'good' THEN "trendDays">=30 ELSE true END),
 cities AS(SELECT c.city name,sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN r.boxes ELSE r.value END) value FROM periods r JOIN base_clients c ON c.code=r.client WHERE r.period='current' GROUP BY c.city),
 ranking AS(SELECT CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(c.promotor_name,'N/A') ELSE coalesce(v.nome,coalesce(nullif(c.rca,''),r.seller),'N/A') END name,
 sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN r.boxes ELSE r.value END) value FROM periods r
 JOIN base_clients c ON c.code=r.client LEFT JOIN public.dim_vendedores v ON v.codigo=coalesce(nullif(c.rca,''),r.seller)
 WHERE r.period='current' GROUP BY 1),
 top_product AS(SELECT * FROM table_all WHERE "coverageCurrent">0 ORDER BY "coverageCurrent" DESC,code LIMIT 1)
 SELECT jsonb_build_object('schema_version',1,'reference_date',ref,'active_clients',(SELECT count(*) FROM base_clients),'active_3m',(SELECT count(*) FROM active_history),
 'current_clients',(SELECT count(*) FROM selection WHERE period='current' AND value>=1),'previous_clients',(SELECT count(*) FROM selection WHERE period='previous' AND value>=1),
 'top',coalesce((SELECT to_jsonb(t) FROM top_product t),'null'),
 'rows',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY "stockQty" DESC,code) FROM table_filtered t),'[]'),
 'total_boxes',coalesce((SELECT sum("boxesSoldCurrentMonth") FROM table_filtered),0),
 'chart_total',coalesce((SELECT sum(value) FROM cities),0),
 'cities',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY value DESC,name) FROM(SELECT * FROM cities ORDER BY value DESC,name LIMIT 10)t),'[]'),
 'ranking',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY value DESC,name) FROM(SELECT * FROM ranking ORDER BY value DESC,name LIMIT 10)t),'[]')) INTO result;
 RETURN result;
END $$;


CREATE OR REPLACE FUNCTION dashboard_private.facet_result_v1(p_page text,s jsonb,p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' SET enable_nestloop='off' AS $$
DECLARE result jsonb; f jsonb:=p_filters;
BEGIN
 IF p_page NOT IN('coverage','weekly') OR jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Página ou filtros inválidos' USING ERRCODE='22023'; END IF;
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 raw AS MATERIALIZED(SELECT * FROM dashboard_private.sales_facets WHERE s->>'kind'='admin'
 OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (source='current' AND codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))),
 rows AS MATERIALIZED(SELECT r.source,r.day,r.filial,r.tipovenda sale_type,r.produto product,r.codfor supplier,
 coalesce(p.descricao,'Produto '||r.produto) description,
 CASE WHEN r.codfor='1119' THEN CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END virtual_supplier,
 a.seller,coalesce(v.nome,a.seller,'N/A') seller_name,a.supervisor_name,c.city,c.rede,c.coord,c.cocoord,c.promotor
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli LEFT JOIN assignments a ON a.client=r.codcli
 LEFT JOIN public.dim_produtos p ON p.codigo=r.produto LEFT JOIN public.dim_vendedores v ON v.codigo=a.seller),
 scope AS MATERIALIZED(SELECT * FROM rows WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false)))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? seller,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? rede,false)) WHEN 'sem_rede' THEN coalesce(rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR filial=f->>'filial')
 AND (coalesce(f->>'city','')='' OR lower(city)=lower(f->>'city'))),
 supplier_options AS (SELECT DISTINCT supplier code,coalesce(df.nome,supplier) label FROM scope LEFT JOIN public.dim_fornecedores df ON df.codigo=scope.supplier
 UNION SELECT DISTINCT virtual_supplier,CASE virtual_supplier WHEN '1119_TODDYNHO' THEN 'TODDYNHO' WHEN '1119_TODDY' THEN 'TODDY' ELSE 'QUAKER / KEROCOCO' END FROM scope WHERE virtual_supplier IS NOT NULL),
 products AS (SELECT DISTINCT product code,'('||product||') '||description label FROM scope WHERE (coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false)),
 sellers AS(SELECT DISTINCT seller code,seller_name label,supervisor_name supervisor FROM rows
 WHERE (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))),
 hierarchy AS(SELECT * FROM clients), months AS(SELECT DISTINCT to_char(day,'YYYY-MM') code FROM raw WHERE day IS NOT NULL)
 SELECT jsonb_build_object('schema_version',1,'reference_date',coalesce((SELECT max(day) FROM rows WHERE source='current'),(SELECT max(day) FROM rows),current_date),
 'suppliers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM supplier_options t),'[]'),
 'products',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM products t),'[]'),
 'types',coalesce((SELECT jsonb_agg(jsonb_build_object('code',sale_type,'label',sale_type) ORDER BY sale_type) FROM (SELECT DISTINCT sale_type FROM scope WHERE sale_type IS NOT NULL)t),'[]'),
 'sellers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM sellers t),'[]'),
 'supervisors',coalesce((SELECT jsonb_agg(jsonb_build_object('code',label,'label',label) ORDER BY label) FROM(SELECT DISTINCT supervisor_name label FROM rows)t),'[]'),
 'coords',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT coord code,coalesce(coord_name,coord) label FROM hierarchy WHERE coord IS NOT NULL)t),'[]'),
 'cocoords',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT cocoord code,coalesce(cocoord_name,cocoord) label FROM hierarchy WHERE cocoord IS NOT NULL AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)))t),'[]'),
 'promotors',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT promotor code,coalesce(promotor_name,promotor) label FROM hierarchy WHERE promotor IS NOT NULL AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)))t),'[]'),
 'cities',coalesce((SELECT jsonb_agg(city ORDER BY city) FROM(SELECT DISTINCT city FROM clients)t),'[]'),
 'redes',coalesce((SELECT jsonb_agg(jsonb_build_object('code',rede,'label',rede) ORDER BY rede) FROM(SELECT DISTINCT rede FROM clients WHERE rede NOT IN('','N/A'))t),'[]'),
 'months',coalesce((SELECT jsonb_agg(code ORDER BY code DESC) FROM months),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.refresh_summaries_v1(force_refresh boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET jit TO 'off'
 SET work_mem TO '32MB'
AS $function$
DECLARE st dashboard_private.summary_state; result jsonb;
BEGIN
 IF NOT ((auth.uid() IS NOT NULL AND public.is_admin()) OR (auth.uid() IS NULL AND (session_user IN('postgres','supabase_admin') OR current_setting('role',true)='service_role'))) THEN
  RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501';
 END IF;
 IF NOT pg_try_advisory_xact_lock(70261002,1) THEN RETURN jsonb_build_object('status','busy'); END IF;
 SELECT * INTO st FROM dashboard_private.summary_state WHERE id=true;
 IF NOT force_refresh AND NOT st.dirty THEN RETURN jsonb_build_object('status','current','generation',st.generation); END IF;
 -- Capture the revision without locking the upload trigger's state row.
 -- New source commits during the rebuild must leave dirty=true for the next generation.
 -- DELETE/INSERT is atomic under MVCC: concurrent readers keep the previous complete generation.
 DELETE FROM dashboard_private.sales_day;
 INSERT INTO dashboard_private.sales_day
 WITH raw AS MATERIALIZED(
  SELECT 'current'::text source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,
   (dtped AT TIME ZONE 'UTC')::date AS day,coalesce(vlvenda,0) amount,coalesce(vlbonific,0) bonus,coalesce(qtvenda,0) units,coalesce(totpesoliq,0) peso,observacaofor FROM public.data_detailed
  UNION ALL SELECT 'history',codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,
   (dtped AT TIME ZONE 'UTC')::date,coalesce(vlvenda,0),coalesce(vlbonific,0),coalesce(qtvenda,0),coalesce(totpesoliq,0),observacaofor FROM public.data_history),
 enriched AS(SELECT r.*,CASE WHEN units<>0 THEN amount/units END unit_price,
  units/CASE WHEN p.qtde_master>0 THEN p.qtde_master ELSE 1 END boxes,
  CASE WHEN r.codfor='1119' THEN CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END virtual_supplier
  FROM raw r LEFT JOIN public.dim_produtos p ON p.codigo=r.produto)
 SELECT source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,unit_price,virtual_supplier,observacaofor,
 sum(amount),sum(bonus),sum(units),sum(boxes),sum(peso),count(*) FROM enriched
 GROUP BY source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,unit_price,virtual_supplier,observacaofor;
 DELETE FROM dashboard_private.sales_month;
 INSERT INTO dashboard_private.sales_month
 SELECT source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,date_trunc('month',day)::date,unit_price,virtual_supplier,observacaofor,
 sum(vlvenda),sum(vlbonific),sum(qtvenda),sum(boxes),sum(totpesoliq),sum(row_count)
 FROM dashboard_private.sales_day GROUP BY source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,date_trunc('month',day)::date,unit_price,virtual_supplier,observacaofor;
 DELETE FROM dashboard_private.sales_month_core;
 INSERT INTO dashboard_private.sales_month_core SELECT source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,NULL::numeric,virtual_supplier,observacaofor,
 sum(vlvenda),sum(vlbonific),sum(qtvenda),sum(boxes),sum(totpesoliq),sum(row_count) FROM dashboard_private.sales_month
 GROUP BY source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,virtual_supplier,observacaofor;
 DELETE FROM dashboard_private.product_suppliers;
 INSERT INTO dashboard_private.product_suppliers SELECT DISTINCT produto,codfor,virtual_supplier FROM dashboard_private.sales_day;
 DELETE FROM dashboard_private.receivables_summary;
 INSERT INTO dashboard_private.receivables_summary SELECT cod_cliente,dt_vencimento,sum(coalesce(vl_titulos,0)),sum(coalesce(vl_receber,0)),
 sum(coalesce(qt_titulos,0)),sum(coalesce(qt_tit_receber,0)),sum(CASE WHEN vl_receber>0 THEN vl_receber ELSE 0 END),count(*)
 FROM public.data_titulos GROUP BY cod_cliente,dt_vencimento;
 DELETE FROM dashboard_private.weekly_day;
 INSERT INTO dashboard_private.weekly_day SELECT source,codcli,codfor,filial,codusur,codsupervisor,day,virtual_supplier,sum(vlvenda)
 FROM dashboard_private.sales_day GROUP BY source,codcli,codfor,filial,codusur,codsupervisor,day,virtual_supplier;
 DELETE FROM dashboard_private.sales_facets;
 INSERT INTO dashboard_private.sales_facets SELECT source,codcli,produto,codfor,filial,tipovenda,max(day)
 FROM dashboard_private.sales_day GROUP BY source,codcli,produto,codfor,filial,tipovenda,date_trunc('month',day);
 DELETE FROM dashboard_private.sales_calendar;
 INSERT INTO dashboard_private.sales_calendar SELECT DISTINCT source,codcli,day FROM dashboard_private.sales_day;
 DELETE FROM dashboard_private.client_assignments;
 INSERT INTO dashboard_private.client_assignments SELECT * FROM dashboard_private.assignment_branches_v1('{"kind":"admin"}') WHERE client IS NOT NULL;
 DELETE FROM dashboard_private.page_rollups;
 IF to_regprocedure('dashboard_private.coverage_result_v1(jsonb,jsonb)') IS NOT NULL THEN
  INSERT INTO dashboard_private.page_rollups VALUES('coverage','{}',dashboard_private.coverage_result_v1('{"kind":"admin"}','{}')),
  ('coverage','{"suppliers":["707"]}',dashboard_private.coverage_result_v1('{"kind":"admin"}','{"suppliers":["707"]}'));
 END IF;
 IF to_regprocedure('dashboard_private.facet_result_v1(text,jsonb,jsonb)') IS NOT NULL THEN
  INSERT INTO dashboard_private.page_rollups VALUES('filters','{}',dashboard_private.facet_result_v1('coverage','{"kind":"admin"}','{}'));
 END IF;
 IF to_regprocedure('dashboard_private.comparison_result_v2(jsonb,jsonb)') IS NOT NULL THEN
  INSERT INTO dashboard_private.page_rollups
  SELECT 'comparison',k,dashboard_private.comparison_result_v2('{"kind":"admin"}',k)||jsonb_build_object('summary_generation',st.generation+1)
  FROM(VALUES('{}'::jsonb),('{"pasta":"PEPSICO"}'::jsonb)) keys(k);
 END IF;
 IF to_regprocedure('dashboard_private.comparison_filters_result_v2(jsonb,jsonb)') IS NOT NULL THEN
  INSERT INTO dashboard_private.page_rollups
  SELECT 'comparison_filters',k,dashboard_private.comparison_filters_result_v2('{"kind":"admin"}',k)
  FROM(VALUES('{}'::jsonb),('{"pasta":"PEPSICO"}'::jsonb)) keys(k);
 END IF;
 ANALYZE dashboard_private.sales_month_core; ANALYZE dashboard_private.receivables_summary;
 ANALYZE dashboard_private.sales_day; ANALYZE dashboard_private.sales_month; ANALYZE dashboard_private.weekly_day;
 ANALYZE dashboard_private.sales_facets; ANALYZE dashboard_private.sales_calendar; ANALYZE dashboard_private.client_assignments;
 UPDATE dashboard_private.summary_state SET dirty=(last_change IS DISTINCT FROM st.last_change),generation=generation+1,refreshed_at=clock_timestamp() WHERE id=true RETURNING
  jsonb_build_object('status','refreshed','generation',generation,'refreshed_at',refreshed_at) INTO result;
 RETURN result;
END $function$

SELECT dashboard_private.refresh_summaries_v1(true);
