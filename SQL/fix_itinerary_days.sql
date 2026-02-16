-- ==============================================================================
-- MIGRATION: ADD itinerary_days TO data_client_promoters
-- Reason: To support multi-day selection for Weekly frequency.
-- ==============================================================================

DO $$
BEGIN
    -- Check if column exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'data_client_promoters'
        AND column_name = 'itinerary_days'
    ) THEN
        ALTER TABLE public.data_client_promoters ADD COLUMN itinerary_days text;
    END IF;
END $$;

-- Reload Schema Cache to recognize new column immediately
NOTIFY pgrst, 'reload config';
