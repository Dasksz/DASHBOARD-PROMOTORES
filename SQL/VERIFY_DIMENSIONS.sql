
-- ==============================================================================
-- VERIFICATION SCRIPT
-- ==============================================================================

DO $$
DECLARE
    v_count int;
BEGIN
    RAISE NOTICE 'Verifying Dimension Tables...';

    -- 1. Verify Vendedores
    SELECT COUNT(*) INTO v_count FROM public.dim_vendedores;
    RAISE NOTICE 'dim_vendedores count: %', v_count;
    IF v_count = 0 THEN RAISE WARNING 'dim_vendedores is empty!'; END IF;

    -- 2. Verify Supervisores
    SELECT COUNT(*) INTO v_count FROM public.dim_supervisores;
    RAISE NOTICE 'dim_supervisores count: %', v_count;
    IF v_count = 0 THEN RAISE WARNING 'dim_supervisores is empty!'; END IF;

    -- 3. Verify Fornecedores
    SELECT COUNT(*) INTO v_count FROM public.dim_fornecedores;
    RAISE NOTICE 'dim_fornecedores count: %', v_count;
    IF v_count = 0 THEN RAISE WARNING 'dim_fornecedores is empty!'; END IF;

    -- 4. Verify Produtos
    SELECT COUNT(*) INTO v_count FROM public.dim_produtos;
    RAISE NOTICE 'dim_produtos count: %', v_count;
    IF v_count = 0 THEN RAISE WARNING 'dim_produtos is empty!'; END IF;

    -- 5. Verify Mix Classification
    SELECT COUNT(*) INTO v_count FROM public.dim_produtos WHERE mix_marca IS NOT NULL;
    RAISE NOTICE 'Products with mix_marca: %', v_count;

    SELECT COUNT(*) INTO v_count FROM public.dim_produtos WHERE mix_categoria IS NOT NULL;
    RAISE NOTICE 'Products with mix_categoria: %', v_count;

END $$;
