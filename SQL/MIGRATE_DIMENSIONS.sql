
-- ==============================================================================
-- MIGRATION: CREATE DIMENSION TABLES
-- ==============================================================================

-- 1. DIM_VENDEDORES (Sellers)
CREATE TABLE IF NOT EXISTS public.dim_vendedores (
    codigo text PRIMARY KEY,
    nome text
);

-- 2. DIM_SUPERVISORES (Supervisors)
CREATE TABLE IF NOT EXISTS public.dim_supervisores (
    codigo text PRIMARY KEY,
    nome text
);

-- 3. DIM_FORNECEDORES (Suppliers)
CREATE TABLE IF NOT EXISTS public.dim_fornecedores (
    codigo text PRIMARY KEY,
    nome text
);

-- 4. DIM_PRODUTOS (Products)
CREATE TABLE IF NOT EXISTS public.dim_produtos (
    codigo text PRIMARY KEY,
    descricao text,
    codfor text,
    mix_marca text,
    mix_categoria text
);

-- 5. ENABLE RLS
ALTER TABLE public.dim_vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_supervisores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_produtos ENABLE ROW LEVEL SECURITY;

-- 6. CREATE POLICIES (Read Access for Authenticated Users)

-- Dim Vendedores
DROP POLICY IF EXISTS "Unified Read Access" ON public.dim_vendedores;
CREATE POLICY "Unified Read Access" ON public.dim_vendedores FOR SELECT TO authenticated USING (public.is_admin() OR public.is_approved());
DROP POLICY IF EXISTS "Admin Write Access" ON public.dim_vendedores;
CREATE POLICY "Admin Write Access" ON public.dim_vendedores FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Dim Supervisores
DROP POLICY IF EXISTS "Unified Read Access" ON public.dim_supervisores;
CREATE POLICY "Unified Read Access" ON public.dim_supervisores FOR SELECT TO authenticated USING (public.is_admin() OR public.is_approved());
DROP POLICY IF EXISTS "Admin Write Access" ON public.dim_supervisores;
CREATE POLICY "Admin Write Access" ON public.dim_supervisores FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Dim Fornecedores
DROP POLICY IF EXISTS "Unified Read Access" ON public.dim_fornecedores;
CREATE POLICY "Unified Read Access" ON public.dim_fornecedores FOR SELECT TO authenticated USING (public.is_admin() OR public.is_approved());
DROP POLICY IF EXISTS "Admin Write Access" ON public.dim_fornecedores;
CREATE POLICY "Admin Write Access" ON public.dim_fornecedores FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Dim Produtos
DROP POLICY IF EXISTS "Unified Read Access" ON public.dim_produtos;
CREATE POLICY "Unified Read Access" ON public.dim_produtos FOR SELECT TO authenticated USING (public.is_admin() OR public.is_approved());
DROP POLICY IF EXISTS "Admin Write Access" ON public.dim_produtos;
CREATE POLICY "Admin Write Access" ON public.dim_produtos FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 7. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_dim_produtos_codfor ON public.dim_produtos (codfor);
CREATE INDEX IF NOT EXISTS idx_dim_produtos_mix_marca ON public.dim_produtos (mix_marca);
CREATE INDEX IF NOT EXISTS idx_dim_produtos_mix_categoria ON public.dim_produtos (mix_categoria);

-- 8. TRIGGER FOR PRODUCT CLASSIFICATION (AUTO-MIX)
CREATE OR REPLACE FUNCTION classify_product_mix()
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

DROP TRIGGER IF EXISTS trg_classify_products ON public.dim_produtos;
CREATE TRIGGER trg_classify_products
BEFORE INSERT OR UPDATE OF descricao ON public.dim_produtos
FOR EACH ROW
EXECUTE FUNCTION classify_product_mix();


-- ==============================================================================
-- MIGRATION: POPULATE DIMENSION TABLES FROM EXISTING DATA
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Starting Population of Dimension Tables...';

    -- 1. POPULATE DIM_VENDEDORES (Sellers)
    -- Extract unique pairs of (codusur, nome) from data_detailed and data_history
    -- Use MAX(nome) to resolve conflicts if a code has multiple names
    INSERT INTO public.dim_vendedores (codigo, nome)
    SELECT codusur, MAX(nome)
    FROM (
        SELECT codusur, nome FROM public.data_detailed WHERE codusur IS NOT NULL
        UNION ALL
        SELECT codusur, nome FROM public.data_history WHERE codusur IS NOT NULL
    ) AS all_sellers
    GROUP BY codusur
    ON CONFLICT (codigo) DO NOTHING;

    RAISE NOTICE 'Populated dim_vendedores.';

    -- 2. POPULATE DIM_SUPERVISORES (Supervisors)
    INSERT INTO public.dim_supervisores (codigo, nome)
    SELECT codsupervisor, MAX(superv)
    FROM (
        SELECT codsupervisor, superv FROM public.data_detailed WHERE codsupervisor IS NOT NULL
        UNION ALL
        SELECT codsupervisor, superv FROM public.data_history WHERE codsupervisor IS NOT NULL
    ) AS all_supervisors
    GROUP BY codsupervisor
    ON CONFLICT (codigo) DO NOTHING;

    RAISE NOTICE 'Populated dim_supervisores.';

    -- 3. POPULATE DIM_FORNECEDORES (Suppliers)
    INSERT INTO public.dim_fornecedores (codigo, nome)
    SELECT codfor, MAX(fornecedor)
    FROM (
        SELECT codfor, fornecedor FROM public.data_detailed WHERE codfor IS NOT NULL
        UNION ALL
        SELECT codfor, fornecedor FROM public.data_history WHERE codfor IS NOT NULL
    ) AS all_suppliers
    GROUP BY codfor
    ON CONFLICT (codigo) DO NOTHING;

    RAISE NOTICE 'Populated dim_fornecedores.';

    -- 4. POPULATE DIM_PRODUTOS (Products)
    -- Also populates mix_marca/mix_categoria via trigger automatically
    INSERT INTO public.dim_produtos (codigo, descricao, codfor)
    SELECT produto, MAX(descricao), MAX(codfor)
    FROM (
        SELECT produto, descricao, codfor FROM public.data_detailed WHERE produto IS NOT NULL
        UNION ALL
        SELECT produto, descricao, codfor FROM public.data_history WHERE produto IS NOT NULL
    ) AS all_products
    GROUP BY produto
    ON CONFLICT (codigo) DO NOTHING;

    -- Force trigger execution for existing rows if needed (though insert should handle it)
    UPDATE public.dim_produtos SET descricao = descricao WHERE mix_marca IS NULL;

    RAISE NOTICE 'Populated dim_produtos.';

END $$;
