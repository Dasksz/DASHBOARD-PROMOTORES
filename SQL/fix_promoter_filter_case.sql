-- Normalize only promoter-filter comparisons; preserve scope_v1, RLS and function privileges.
BEGIN;
DO $patch$
DECLARE fn record; original text; updated text; changed integer:=0; functions_changed integer:=0;
BEGIN
 FOR fn IN SELECT p.oid,n.nspname,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname='public' AND p.proname IN('get_weekly_page_v1','get_overview_filters_v1','get_overview_summary_v1'))
 OR (n.nspname='dashboard_private' AND p.proname IN('facet_result_v1','coverage_result_v1','comparison_rows_v2','rows_v1'))
 LOOP
  original:=pg_get_functiondef(fn.oid);
  updated:=replace(original,'coalesce(f->''promotors'' ? c.promotor,false)',
   'EXISTS(SELECT 1 FROM jsonb_array_elements_text(f->''promotors'') AS selected_promotor(code) WHERE lower(btrim(selected_promotor.code))=lower(btrim(c.promotor)))');
  updated:=replace(updated,'coalesce(f->''promotors'' ? promotor,false)',
   'EXISTS(SELECT 1 FROM jsonb_array_elements_text(f->''promotors'') AS selected_promotor(code) WHERE lower(btrim(selected_promotor.code))=lower(btrim(promotor)))');
  IF updated IS DISTINCT FROM original THEN
   EXECUTE updated;
   changed:=changed+1;
  END IF;
  functions_changed:=functions_changed+1;
 END LOOP;
 IF functions_changed<>7 OR changed<>7 THEN
  RAISE EXCEPTION 'Expected seven unchanged filter definitions; found %, patched %',functions_changed,changed;
 END IF;
END $patch$;
COMMIT;

