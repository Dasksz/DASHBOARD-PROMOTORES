CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA dashboard_private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text,approved boolean);
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce((SELECT role='adm' FROM public.profiles WHERE id=auth.uid()),false) $$;
CREATE FUNCTION public.is_approved() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce((SELECT approved FROM public.profiles WHERE id=auth.uid()),false) $$;
CREATE TABLE public.data_clients(codigo_cliente text PRIMARY KEY,rca1 text,cidade text,ramo text,razaosocial text,nomecliente text);
CREATE TABLE public.data_client_promoters(client_code text PRIMARY KEY,promoter_code text);
CREATE TABLE public.data_hierarchy(id uuid,cod_coord text,nome_coord text,cod_cocoord text,nome_cocoord text,cod_promotor text,nome_promotor text);
CREATE TABLE public.dim_supervisores(codigo text PRIMARY KEY,nome text);
CREATE TABLE public.dim_fornecedores(codigo text PRIMARY KEY,nome text,pasta text);
CREATE TABLE public.dim_produtos(codigo text PRIMARY KEY,descricao text);
CREATE TABLE public.data_detailed(codcli text,produto text,codfor text,codusur text,codsupervisor text,tipovenda text,posicao text,vlvenda numeric,vlbonific numeric,totpesoliq numeric);
CREATE TABLE public.data_history(codusur text,codsupervisor text);
CREATE TABLE dashboard_private.client_assignments(client text PRIMARY KEY,seller text,supervisor text,supervisor_name text,filial text,branch_source text,branch_date date,raw_supervisor text);
GRANT USAGE ON SCHEMA auth,dashboard_private TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public,dashboard_private TO authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['data_clients','data_detailed','data_history','data_client_promoters','data_hierarchy','dim_supervisores','dim_fornecedores','dim_produtos'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY approved_reader ON public.%I FOR SELECT TO authenticated USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()))',t);
 END LOOP;
END $$;
