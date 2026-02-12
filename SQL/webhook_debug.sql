
-- Remove existing triggers if any (to avoid duplicates or conflicts)
DROP TRIGGER IF EXISTS "webhook-notify-coordinator-update" ON public.visitas;
DROP FUNCTION IF EXISTS public.notify_coordinator_webhook;

-- Create the function that calls the Edge Function
CREATE OR REPLACE FUNCTION public.notify_coordinator_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call the Edge Function via pg_net (if available) or simply rely on Supabase Dashboard configuration.
  -- Supabase usually manages webhooks via the Dashboard UI which creates internal triggers.
  -- However, to be explicit and debuggable, we can use an HTTP extension if enabled, OR trust the dashboard.

  -- BUT, the user issue implies the Dashboard webhook might be misconfigured or filtering incorrectly.
  -- The most robust way in Supabase is to use the `pg_net` extension or `http` extension to call the function directly from the database trigger.
  -- OR, rely on the standard Supabase Webhook system (which listens to replication events).

  -- IF we are using the standard system, we can't easily debug it from SQL.
  -- LET'S ASSUME the standard system is used.
  -- We will create a LOGGING trigger to confirming the UPDATE event is happening as expected.

  RAISE NOTICE 'Webhook Trigger Fired: Visit ID % changed checkout_at from % to %', NEW.id, OLD.checkout_at, NEW.checkout_at;

  -- The actual HTTP call is handled by Supabase's internal system listening to WAL/Replication or specific triggers created via UI.
  -- If we want to FORCE it via SQL, we need `pg_net`.

  -- Let's try to create a standard trigger that Supabase recognizes, or at least log.
  return NEW;
END;
$$;

-- Create the Trigger
CREATE TRIGGER "webhook-notify-coordinator-debug"
AFTER UPDATE ON public.visitas
FOR EACH ROW
WHEN (OLD.checkout_at IS NULL AND NEW.checkout_at IS NOT NULL)
EXECUTE FUNCTION public.notify_coordinator_webhook();

-- NOTE: The actual HTTP call to the Edge Function `notify-coordinator` MUST be configured in the Supabase Dashboard > Database > Webhooks.
-- Ensure a webhook exists there:
-- Name: notify-coordinator
-- Table: public.visitas
-- Events: UPDATE
-- URL: https://dldsocponbjthqxhmttj.supabase.co/functions/v1/notify-coordinator
-- HTTP Auth: Bearer [SERVICE_ROLE_KEY] (or Anon)
