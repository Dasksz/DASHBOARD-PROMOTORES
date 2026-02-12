-- ==============================================================================
-- MANUAL WEBHOOK SETUP USING PG_NET
--
-- Description:
-- This script manually sets up an HTTP POST trigger using the 'pg_net' extension.
-- This bypasses the need to enable "Database Webhooks" in the Supabase Dashboard,
-- ensuring the 'notify-coordinator' Edge Function is called immediately upon
-- checkout updates.
--
-- Instructions:
-- Run this script in the Supabase SQL Editor.
-- ==============================================================================

-- 1. Enable pg_net extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA extensions;

-- 2. Define the Trigger Function
CREATE OR REPLACE FUNCTION public.trigger_notify_coordinator_http()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text := 'https://dldsocponbjthqxhmttj.supabase.co/functions/v1/notify-coordinator';
  v_api_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZHNvY3BvbmJqdGhxeGhtdHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzgzMzgsImV4cCI6MjA4NTAxNDMzOH0.IGxUEd977uIdhWvMzjDM8ygfISB_Frcf_2air8e3aOs'; -- Anon Key from init.js
  v_payload jsonb;
  v_request_id int;
BEGIN
  -- Construct Payload matching Supabase Webhook format
  v_payload := jsonb_build_object(
    'type', 'UPDATE',
    'table', 'visitas',
    'schema', 'public',
    'record', row_to_json(NEW),
    'old_record', row_to_json(OLD)
  );

  -- Send HTTP POST via pg_net
  -- Note: net.http_post is asynchronous
  SELECT net.http_post(
    url := v_url,
    body := v_payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_api_key
    )
  ) INTO v_request_id;

  RAISE NOTICE 'Manual Webhook Fired via pg_net. Request ID: %', v_request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send manual webhook: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 3. Create the Trigger on 'visitas' table
DROP TRIGGER IF EXISTS "manual_webhook_notify_coordinator" ON public.visitas;

CREATE TRIGGER "manual_webhook_notify_coordinator"
AFTER UPDATE ON public.visitas
FOR EACH ROW
-- Only fire when checkout_at changes from null to a value (Checkout event)
WHEN (OLD.checkout_at IS NULL AND NEW.checkout_at IS NOT NULL)
EXECUTE FUNCTION public.trigger_notify_coordinator_http();

-- Confirmation
RAISE NOTICE 'Manual pg_net webhook configured successfully on public.visitas';
