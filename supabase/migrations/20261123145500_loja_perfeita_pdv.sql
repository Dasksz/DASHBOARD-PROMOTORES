CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.loja_perfeita_pdv (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 cnpjs text[] NOT NULL,
 imported_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.loja_perfeita_pdv ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.loja_perfeita_pdv FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.save_loja_perfeita_pdv(p_cnpjs text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501'; END IF;
 IF coalesce(cardinality(p_cnpjs),0) NOT BETWEEN 1 AND 30000 OR
 EXISTS(SELECT 1 FROM unnest(p_cnpjs) c WHERE c IS NULL OR c !~ '^[0-9]{14}$' OR c='00000000000000')
 THEN RAISE EXCEPTION 'Malha de PDVs inválida ou vazia'; END IF;
 INSERT INTO private.loja_perfeita_pdv(id,cnpjs) VALUES(true,ARRAY(SELECT DISTINCT c FROM unnest(p_cnpjs)c ORDER BY c))
 ON CONFLICT(id) DO UPDATE SET cnpjs=excluded.cnpjs,imported_at=now();
END $$;

CREATE OR REPLACE FUNCTION public.get_loja_perfeita_pdv(p_period text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT (coalesce(public.is_admin(),false) OR coalesce(public.is_approved(),false))
 THEN RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501'; END IF;
 IF p_period IS NULL OR p_period !~ '^[a-zç]+ de [0-9]{4}$' THEN RAISE EXCEPTION 'Período inválido'; END IF;
 WITH source AS (SELECT * FROM private.loja_perfeita_pdv WHERE id),
 candidates AS (
  SELECT lpad(d.doc,14,'0') cnpj,min(c.codigo_cliente) code,count(DISTINCT c.codigo_cliente) n
  FROM public.data_clients c CROSS JOIN LATERAL (SELECT regexp_replace(c.cnpj_cpf,'[^0-9]','','g') doc) d
  WHERE length(d.doc) BETWEEN 10 AND 14 AND nullif(btrim(c.codigo_cliente),'') IS NOT NULL GROUP BY 1
 ), mapped AS (
  SELECT c.* FROM source s JOIN candidates c ON c.cnpj=ANY(s.cnpjs) WHERE c.n=1
 ), audited AS (
  SELECT DISTINCT coalesce(nullif(ltrim(btrim(codigo_cliente),'0'),''),'0') code FROM public.data_nota_perfeita
  WHERE lower(btrim(mes_ano))=p_period AND auditorias>0 AND nullif(btrim(codigo_cliente),'') IS NOT NULL
 )
 SELECT jsonb_build_object('importedAt',s.imported_at,'unmatched',cardinality(s.cnpjs)-(SELECT count(*) FROM mapped),
 'pending',coalesce((SELECT jsonb_agg(DISTINCT m.code) FROM mapped m WHERE NOT EXISTS(
 SELECT 1 FROM audited a WHERE a.code=coalesce(nullif(ltrim(btrim(m.code),'0'),''),'0'))),'[]'::jsonb))
 INTO result FROM source s;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_loja_perfeita_pdv(text[]),public.get_loja_perfeita_pdv(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_loja_perfeita_pdv(text[]),public.get_loja_perfeita_pdv(text) TO authenticated;
NOTIFY pgrst,'reload schema';
