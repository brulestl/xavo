-- Test script for prompt usage function
-- Run this after deploying the table and function to verify they work

-- Test 1: First prompt of the day (should succeed)
SELECT 'Test 1: First prompt of the day' as test_case;
DO $$
BEGIN
  -- Use a test UUID (replace with actual user ID for testing)
  PERFORM public.fn_consume_daily(3, 'test-user-id-here'::uuid);
  RAISE NOTICE 'SUCCESS: First prompt consumed';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR: %', SQLERRM;
END $$;

-- Check the usage record
SELECT * FROM public.prompt_usage WHERE user_id = '884e627b-8049-41cb-ad9c-c880aa188345'::uuid;

-- Test 2: Second prompt of the day (should succeed)
SELECT 'Test 2: Second prompt of the day' as test_case;
DO $$
BEGIN
  PERFORM public.fn_consume_daily(3, 'test-user-id-here'::uuid);
  RAISE NOTICE 'SUCCESS: Second prompt consumed';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR: %', SQLERRM;
END $$;

-- Check the usage record
SELECT * FROM public.prompt_usage WHERE user_id = 'test-user-id-here'::uuid;

-- Test 3: Third prompt of the day (should succeed)
SELECT 'Test 3: Third prompt of the day' as test_case;
DO $$
BEGIN
  PERFORM public.fn_consume_daily(3, 'test-user-id-here'::uuid);
  RAISE NOTICE 'SUCCESS: Third prompt consumed';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR: %', SQLERRM;
END $$;

-- Check the usage record
SELECT * FROM public.prompt_usage WHERE user_id = 'test-user-id-here'::uuid;

-- Test 4: Fourth prompt of the day (should fail with quota exceeded)
SELECT 'Test 4: Fourth prompt of the day (should fail)' as test_case;
DO $$
BEGIN
  PERFORM public.fn_consume_daily(3, 'test-user-id-here'::uuid);
  RAISE NOTICE 'ERROR: Fourth prompt should have failed!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SUCCESS: Quota exceeded as expected - %', SQLERRM;
END $$;

-- Final check - usage should still be 3
SELECT * FROM public.prompt_usage WHERE user_id = 'test-user-id-here'::uuid;

-- Clean up test data
DELETE FROM public.prompt_usage WHERE user_id = 'test-user-id-here'::uuid; 