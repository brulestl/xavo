-- Clear all existing prompt usage data
DELETE FROM public.prompt_usage;

-- Reset the daily usage for a specific user (optional)
-- DELETE FROM public.prompt_usage WHERE user_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

-- Verify the table is empty
SELECT * FROM public.prompt_usage;

-- Optional: Drop the prompt usage table entirely (if you want to remove limits completely)
-- DROP TABLE IF EXISTS public.prompt_usage;

-- Optional: Drop the consumption function
-- DROP FUNCTION IF EXISTS public.fn_consume_daily(integer, uuid); 