ALTER TABLE public.visitas
 ADD COLUMN IF NOT EXISTS checkout_latitude double precision,
 ADD COLUMN IF NOT EXISTS checkout_longitude double precision,
 ADD COLUMN IF NOT EXISTS checkin_accuracy double precision,
 ADD COLUMN IF NOT EXISTS checkout_accuracy double precision,
 ADD COLUMN IF NOT EXISTS client_latitude double precision,
 ADD COLUMN IF NOT EXISTS client_longitude double precision;

CREATE OR REPLACE FUNCTION public.capture_visit_client_location()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  SELECT c.lat,c.lng INTO NEW.client_latitude,NEW.client_longitude
  FROM public.data_client_coordinates c WHERE c.client_code=coalesce(NEW.client_code,NEW.id_cliente) LIMIT 1;
 ELSE
  NEW.client_latitude := OLD.client_latitude;
  NEW.client_longitude := OLD.client_longitude;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.capture_visit_client_location() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS capture_visit_client_location ON public.visitas;
CREATE TRIGGER capture_visit_client_location BEFORE INSERT OR UPDATE ON public.visitas
 FOR EACH ROW EXECUTE FUNCTION public.capture_visit_client_location();

DO $$
DECLARE definition text;
BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='view_visitas_expanded' AND column_name='checkout_latitude') THEN RETURN; END IF;
 SELECT pg_get_viewdef('public.view_visitas_expanded'::regclass,true) INTO definition;
 definition := regexp_replace(definition,';\s*$','');
 -- Append columns to preserve the existing view column order, privileges and security options.
 EXECUTE 'CREATE OR REPLACE VIEW public.view_visitas_expanded AS SELECT base.*, v.checkout_latitude, v.checkout_longitude, v.checkin_accuracy, v.checkout_accuracy, v.client_latitude, v.client_longitude FROM (' || definition || ') base JOIN public.visitas v ON v.id=base.id';
END;
$$;
CREATE TABLE IF NOT EXISTS public.visit_geo_alerts (
 visit_id bigint PRIMARY KEY REFERENCES public.visitas(id) ON DELETE CASCADE,
 claimed_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 recipient text NOT NULL,
 max_distance_m double precision NOT NULL,
 provider_message_id text
);
ALTER TABLE public.visit_geo_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.visit_geo_alerts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.visit_geo_alerts TO service_role;

ALTER VIEW public.view_visitas_expanded SET (security_invoker = true);
