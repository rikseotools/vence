-- Debug: Check why David shows 0 tests completed
-- First, let's find David's user_id based on the info we have

-- Step 1: Find David from Córdoba who's been in Vence for ~25 days
WITH david_user AS (
  SELECT
    up.id,
    up.email,
    up.created_at,
    DATE_PART('day', NOW() - up.created_at) as days_in_vence,
    pup.display_name,
    pup.ciudad,
    up.target_oposicion
  FROM user_profiles up
  LEFT JOIN public_user_profiles pup ON pup.id = up.id
  WHERE pup.display_name ILIKE '%david%'
    AND pup.ciudad ILIKE '%córdoba%'
    AND DATE_PART('day', NOW() - up.created_at) BETWEEN 20 AND 30
)
SELECT * FROM david_user;

-- Step 2: Check his actual tests in the tests table
-- Replace USER_ID_HERE with the ID from Step 1
WITH david_tests AS (
  SELECT
    COUNT(*) as total_tests,
    COUNT(CASE WHEN is_completed = true THEN 1 END) as completed_tests,
    COUNT(CASE WHEN is_completed = false THEN 1 END) as incomplete_tests,
    MIN(created_at) as first_test,
    MAX(created_at) as last_test
  FROM tests
  WHERE user_id = 'USER_ID_HERE' -- Replace with actual ID
)
SELECT * FROM david_tests;

-- Step 3: Call the RPC function to see what it returns
SELECT * FROM get_user_public_stats('USER_ID_HERE'); -- Replace with actual ID

-- Step 4: Check if there's any issue with the tests table data
SELECT
  id,
  title,
  is_completed,
  completed_at,
  created_at,
  questions_answered,
  correct_answers
FROM tests
WHERE user_id = 'USER_ID_HERE' -- Replace with actual ID
ORDER BY created_at DESC
LIMIT 10;

-- Step 5: Check detailed_answers to see if he has answered questions
SELECT
  COUNT(*) as total_answers,
  COUNT(DISTINCT test_session_id) as unique_test_sessions,
  MIN(created_at) as first_answer,
  MAX(created_at) as last_answer
FROM detailed_answers
WHERE user_id = 'USER_ID_HERE'; -- Replace with actual ID

-- Step 6: Cross-check - are there test sessions in detailed_answers that don't exist in tests?
SELECT
  COUNT(DISTINCT da.test_session_id) as sessions_in_detailed_answers,
  COUNT(DISTINCT t.id) as sessions_in_tests
FROM detailed_answers da
LEFT JOIN tests t ON t.id = da.test_session_id
WHERE da.user_id = 'USER_ID_HERE'; -- Replace with actual ID