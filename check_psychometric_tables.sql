-- Check if psychometric_test_sessions table exists
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'psychometric_test_sessions'
ORDER BY ordinal_position;

-- Check if psychometric_first_attempts table exists  
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'psychometric_first_attempts'
ORDER BY ordinal_position;
