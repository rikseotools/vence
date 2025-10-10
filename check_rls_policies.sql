-- Check RLS policies on email_events table
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
WHERE tablename = 'email_events';

-- Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'email_events';

-- Check current role
SELECT current_user, current_setting('role');

-- Check if user has service_role access
SELECT rolname FROM pg_roles WHERE rolname IN ('service_role', 'authenticated', 'anon');