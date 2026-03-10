import re

with open('SQL/SQL_GERAL.sql', 'r') as f:
    sql = f.read()

# 1. Add column to idempotency block
idempotency_str = "    -- Ensure 'cod_cocoord' exists in 'visitas'\n    ALTER TABLE public.visitas ADD COLUMN IF NOT EXISTS cod_cocoord text;"
replacement_str = idempotency_str + "\n    ALTER TABLE public.visitas ADD COLUMN IF NOT EXISTS favoritado_por uuid[] DEFAULT '{}';"
sql = sql.replace(idempotency_str, replacement_str)

# 2. Add RLS policy for managers/coords
rls_str = "CREATE POLICY \"Promotores Update\" ON public.visitas FOR UPDATE TO authenticated USING ((select auth.uid()) = id_promotor);\n"
replacement_rls = rls_str + """
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
    )
  )
);
"""
sql = sql.replace(rls_str, replacement_rls)

with open('SQL/SQL_GERAL.sql', 'w') as f:
    f.write(sql)

print("SQL_GERAL patched.")
