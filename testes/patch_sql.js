const fs = require('fs');
const file = 'SQL/SQL_GERAL.sql';
let content = fs.readFileSync(file, 'utf8');

const target = `DROP POLICY IF EXISTS "Admin and Coords Update" ON public.visitas;
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
);`;

const replacement = `DROP POLICY IF EXISTS "Admin and Coords Update" ON public.visitas;
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
      OR role IN (SELECT cod_sup FROM public.data_hierarchy)
    )
  )
);`;

content = content.replace(target, replacement);
fs.writeFileSync(file, content);
console.log('SQL Patch applied.');
