-- ==============================================================================
-- VERIFICATION SCRIPT
-- Run this in the Supabase SQL Editor to inspect Hierarchy and Profile data.
-- This helps verify if 'COORDENADOR 1' exists and is correctly mapped.
-- ==============================================================================

-- 1. Check if 'COORDENADOR 1' exists in the hierarchy table
SELECT 'Checking data_hierarchy for COORDENADOR 1' as check_step;

SELECT *
FROM public.data_hierarchy
WHERE cod_coord = 'COORDENADOR 1'
   OR nome_coord = 'COORDENADOR 1'
LIMIT 20;

-- 2. Count total rows in hierarchy to ensure upload wasn't empty
SELECT 'Total rows in data_hierarchy' as check_step, count(*) as total_rows
FROM public.data_hierarchy;

-- 3. Check the Profile role for the user
-- Replace with the email if known, or just list all 'COORDENADOR 1' roles
SELECT 'Checking profiles for role COORDENADOR 1' as check_step;

SELECT *
FROM public.profiles
WHERE role = 'COORDENADOR 1';

-- 4. Check Client-Promoter links (Sample)
SELECT 'Checking data_client_promoters sample' as check_step;

SELECT *
FROM public.data_client_promoters
LIMIT 10;
