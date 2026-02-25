-- ==============================================================================
-- UPDATE: RELACAO ROTA INVOLVES
-- This script creates the new table for mapping Seller Codes to Involves Codes.
-- It is designed to be idempotent (safe to run multiple times).
-- ==============================================================================

-- 1. Create Table (if not exists)
CREATE TABLE IF NOT EXISTS public.relacao_rota_involves (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  seller_code text, -- Código do Vendedor (RCA)
  involves_code text, -- Código na tabela de notas (Pesquisador)
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Create Indexes (if not exists)
CREATE INDEX IF NOT EXISTS idx_relacao_rota_involves_seller ON public.relacao_rota_involves (seller_code);
CREATE INDEX IF NOT EXISTS idx_relacao_rota_involves_involves ON public.relacao_rota_involves (involves_code);

-- 3. Enable RLS
ALTER TABLE public.relacao_rota_involves ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies (Drop first to ensure update)

-- Read Access: Allow all authenticated users (or restrict to approved/admin if preferred)
-- Using standard logic: Admins or Approved users can read.
DROP POLICY IF EXISTS "Acesso Leitura Unificado" ON public.relacao_rota_involves;
CREATE POLICY "Acesso Leitura Unificado" ON public.relacao_rota_involves
FOR SELECT
TO authenticated
USING (public.is_admin() OR public.is_approved());

-- Write Access: Admin Only
DROP POLICY IF EXISTS "Acesso Escrita Admin (Insert)" ON public.relacao_rota_involves;
CREATE POLICY "Acesso Escrita Admin (Insert)" ON public.relacao_rota_involves
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Acesso Escrita Admin (Update)" ON public.relacao_rota_involves;
CREATE POLICY "Acesso Escrita Admin (Update)" ON public.relacao_rota_involves
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Acesso Escrita Admin (Delete)" ON public.relacao_rota_involves;
CREATE POLICY "Acesso Escrita Admin (Delete)" ON public.relacao_rota_involves
FOR DELETE
TO authenticated
USING (public.is_admin());

-- 5. Grant Permissions (Standard)
GRANT SELECT ON public.relacao_rota_involves TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.relacao_rota_involves TO authenticated;

-- Confirmation
SELECT 'Tabela relacao_rota_involves configurada com sucesso.' as status;
