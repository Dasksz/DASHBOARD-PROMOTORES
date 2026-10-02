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
