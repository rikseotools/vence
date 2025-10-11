-- Check structure of psychometric_questions table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'psychometric_questions' 
ORDER BY ordinal_position;