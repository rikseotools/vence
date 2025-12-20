-- Check existing RLS policies for psychometric tables
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('psychometric_first_attempts', 'psychometric_test_sessions')
ORDER BY tablename, policyname;

-- Check if RLS is enabled
SELECT 
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('psychometric_first_attempts', 'psychometric_test_sessions');
