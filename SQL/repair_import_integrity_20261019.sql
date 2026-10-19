-- One-time audited repair reference. Applied in bounded stages on 2026-10-19.
-- Guards deliberately reject an already repaired or changed dataset.
BEGIN;
SET LOCAL statement_timeout = '120s';
SET LOCAL work_mem = '96MB';
SET LOCAL TIME ZONE 'UTC';
SELECT pg_advisory_xact_lock(70261019,1);
LOCK TABLE public.data_detailed,public.data_history,public.data_nota_perfeita,public.data_clients IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS dashboard_private.repair_20261019_rows (
 source_table text NOT NULL, original_id text NOT NULL, row_data jsonb NOT NULL,
 PRIMARY KEY(source_table,original_id)
);
REVOKE ALL ON dashboard_private.repair_20261019_rows FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.data_detailed)<>39532 OR
    (SELECT count(*) FROM public.data_history)<>255412 OR
    (SELECT count(*) FROM public.data_nota_perfeita)<>900 THEN
  RAISE EXCEPTION 'Source changed since audit; review before applying repair';
 END IF;
END $$;
WITH ranked AS (SELECT id,row_number() OVER(PARTITION BY to_jsonb(s)-'id' ORDER BY id) rn FROM public.data_detailed s),
 removed AS (DELETE FROM public.data_detailed s USING ranked r WHERE s.id=r.id AND r.rn>1 RETURNING s.*)
INSERT INTO dashboard_private.repair_20261019_rows SELECT 'data_detailed',id::text,to_jsonb(r) FROM removed r;
WITH ranked AS (SELECT id,row_number() OVER(PARTITION BY to_jsonb(s)-'id' ORDER BY id) rn FROM public.data_history s),
 removed AS (DELETE FROM public.data_history s USING ranked r WHERE s.id=r.id AND r.rn>1 RETURNING s.*)
INSERT INTO dashboard_private.repair_20261019_rows SELECT 'data_history',id::text,to_jsonb(r) FROM removed r;
WITH ranked AS (SELECT id,row_number() OVER(PARTITION BY to_jsonb(s)-ARRAY['id','updated_at'] ORDER BY id) rn FROM public.data_nota_perfeita s),
 removed AS (DELETE FROM public.data_nota_perfeita s USING ranked r WHERE s.id=r.id AND r.rn>1 RETURNING s.*)
INSERT INTO dashboard_private.repair_20261019_rows SELECT 'data_nota_perfeita',id::text,to_jsonb(r) FROM removed r;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.data_detailed)<>19766 OR
    (SELECT count(*) FROM public.data_history)<>127706 OR
    (SELECT count(*) FROM public.data_nota_perfeita)<>450 OR
    (SELECT sum(vlvenda) FROM public.data_detailed)<>1253528.955 THEN
  RAISE EXCEPTION 'Unexpected deduplication result';
 END IF;
END $$;
INSERT INTO dashboard_private.repair_20261019_rows
 SELECT 'data_clients',id::text,to_jsonb(c) FROM public.data_clients c WHERE ramo ~ '^[0-9]+$';
ALTER TABLE public.data_clients ADD COLUMN activity_code text;
UPDATE public.data_clients SET activity_code=ramo,ramo='N/A' WHERE ramo ~ '^[0-9]+$';
CREATE FUNCTION dashboard_private.set_import_fingerprint() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE content jsonb;
BEGIN
 content:=to_jsonb(NEW)-ARRAY['id','import_fingerprint','updated_at','created_at'];
 IF TG_TABLE_NAME IN('data_detailed','data_history') THEN
  content:=content||jsonb_build_object('dtped',extract(epoch FROM NEW.dtped),'dtsaida',extract(epoch FROM NEW.dtsaida));
 END IF;
 NEW.import_fingerprint:=encode(sha256(convert_to(content::text,'UTF8')),'hex');
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION dashboard_private.set_import_fingerprint() FROM PUBLIC,anon,authenticated;
ALTER TABLE public.data_detailed ADD COLUMN import_fingerprint text;
ALTER TABLE public.data_history ADD COLUMN import_fingerprint text;
ALTER TABLE public.data_nota_perfeita ADD COLUMN import_fingerprint text;
CREATE TRIGGER import_fingerprint BEFORE INSERT OR UPDATE ON public.data_detailed FOR EACH ROW EXECUTE FUNCTION dashboard_private.set_import_fingerprint();
CREATE TRIGGER import_fingerprint BEFORE INSERT OR UPDATE ON public.data_history FOR EACH ROW EXECUTE FUNCTION dashboard_private.set_import_fingerprint();
CREATE TRIGGER import_fingerprint BEFORE INSERT OR UPDATE ON public.data_nota_perfeita FOR EACH ROW EXECUTE FUNCTION dashboard_private.set_import_fingerprint();
UPDATE public.data_detailed SET import_fingerprint=null;
UPDATE public.data_history SET import_fingerprint=null;
UPDATE public.data_nota_perfeita SET import_fingerprint=null;
ALTER TABLE public.data_detailed ALTER COLUMN import_fingerprint SET NOT NULL;
ALTER TABLE public.data_history ALTER COLUMN import_fingerprint SET NOT NULL;
ALTER TABLE public.data_nota_perfeita ALTER COLUMN import_fingerprint SET NOT NULL;
CREATE UNIQUE INDEX data_detailed_import_content_unique ON public.data_detailed(import_fingerprint);
CREATE UNIQUE INDEX data_history_import_content_unique ON public.data_history(import_fingerprint);
CREATE UNIQUE INDEX data_nota_perfeita_import_content_unique ON public.data_nota_perfeita(import_fingerprint);
INSERT INTO dashboard_private.repair_20261019_rows
 SELECT 'data_metadata',key,to_jsonb(m) FROM public.data_metadata m WHERE key LIKE 'hash_%' OR key='count_nota_perfeita_clients';
UPDATE public.data_metadata SET value='repair-20261019-'||gen_random_uuid()::text
 WHERE key IN('hash_detailed','hash_history','hash_clients','hash_nota_perfeita');
UPDATE public.data_metadata SET value=(SELECT count(DISTINCT codigo_cliente)::text FROM public.data_nota_perfeita) WHERE key='count_nota_perfeita_clients';
-- Metadata for unchanged targets must describe their preserved table, not the omitted input file.
UPDATE public.data_metadata SET value='repair-20261019-'||gen_random_uuid()::text
 WHERE key IN('hash_metas_pesquisas','hash_metas_lojaperfeita');
INSERT INTO dashboard_private.repair_20261019_rows
 SELECT 'function',p.oid::regprocedure::text,jsonb_build_object('definition',pg_get_functiondef(p.oid))
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='dashboard_private' AND proname='comparison_charts_v2';
COMMIT;
