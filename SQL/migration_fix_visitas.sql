-- ==============================================================================
-- MIGRATION SCRIPT: Fix 'visitas' table and reload schema cache
-- ==============================================================================

-- 1. Add the missing column 'cod_cocoord' if it doesn't exist
ALTER TABLE public.visitas ADD COLUMN IF NOT EXISTS cod_cocoord text;

-- 2. Force PostgREST to reload its schema cache
-- This resolves errors like "Could not find the 'cod_cocoord' column in the schema cache"
NOTIFY pgrst, 'reload config';
